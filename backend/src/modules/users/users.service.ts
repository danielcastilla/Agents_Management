// ===========================================
// Users Service
// ===========================================

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditAction, EntityType, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { PaginatedResult, createPaginatedResult } from '@/common/dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly BCRYPT_ROUNDS = 12;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get all users with pagination and filtering
   */
  async findAll(query: UsersQueryDto): Promise<PaginatedResult<UserResponseDto>> {
    const { page, limit, sortBy, sortOrder, search, role, isActive } = query;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get total count and users
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          [sortBy || 'createdAt']: sortOrder || 'desc',
        },
        skip: query.skip,
        take: query.take,
      }),
    ]);

    return createPaginatedResult(users, total, query);
  }

  /**
   * Get user by ID
   */
  async findOne(id: string): Promise<UserResponseDto> {
    // Check cache first
    const cached = await this.redis.get<UserResponseDto>(`user:${id}`);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            agents: true,
            agentRuns: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const response: UserResponseDto = {
      ...user,
      agentsCount: user._count.agents,
      runsCount: user._count.agentRuns,
    };

    // Cache result
    await this.redis.set(`user:${id}`, response, this.CACHE_TTL);

    return response;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Create new user
   */
  async create(
    createUserDto: CreateUserDto,
    createdById: string,
  ): Promise<UserResponseDto> {
    const { email, password, firstName, lastName, role } = createUserDto;

    // Check if email exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        role: role || UserRole.OPERATOR,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create audit log
    await this.createAuditLog(
      createdById,
      AuditAction.CREATE,
      EntityType.USER,
      user.id,
      null,
      { email: user.email, role: user.role },
    );

    this.logger.log(`User created: ${user.email} by ${createdById}`);

    return user;
  }

  /**
   * Update user
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    updatedById: string,
  ): Promise<UserResponseDto> {
    // Get current user state for audit
    const currentUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!currentUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check email uniqueness if changing
    if (updateUserDto.email && updateUserDto.email !== currentUser.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email.toLowerCase() },
      });

      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (updateUserDto.email) {
      updateData.email = updateUserDto.email.toLowerCase();
    }
    if (updateUserDto.firstName !== undefined) {
      updateData.firstName = updateUserDto.firstName;
    }
    if (updateUserDto.lastName !== undefined) {
      updateData.lastName = updateUserDto.lastName;
    }
    if (updateUserDto.role) {
      updateData.role = updateUserDto.role;
    }
    if (updateUserDto.isActive !== undefined) {
      updateData.isActive = updateUserDto.isActive;
    }
    if (updateUserDto.password) {
      updateData.passwordHash = await bcrypt.hash(
        updateUserDto.password,
        this.BCRYPT_ROUNDS,
      );
    }

    // Update user
    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Invalidate cache
    await this.redis.del(`user:${id}`);

    // Create audit log
    await this.createAuditLog(
      updatedById,
      AuditAction.UPDATE,
      EntityType.USER,
      id,
      { email: currentUser.email, role: currentUser.role },
      { email: user.email, role: user.role },
    );

    this.logger.log(`User updated: ${user.email} by ${updatedById}`);

    return user;
  }

  /**
   * Delete user
   */
  async remove(id: string, deletedById: string): Promise<void> {
    // Prevent self-deletion
    if (id === deletedById) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Soft delete by deactivating
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate cache
    await this.redis.del(`user:${id}`);

    // Invalidate refresh token
    await this.redis.del(`refresh_token:${id}`);

    // Create audit log
    await this.createAuditLog(
      deletedById,
      AuditAction.DELETE,
      EntityType.USER,
      id,
      { email: user.email },
      null,
    );

    this.logger.log(`User deleted: ${user.email} by ${deletedById}`);
  }

  /**
   * Set user active status
   */
  async setActiveStatus(
    id: string,
    isActive: boolean,
    updatedById: string,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent self-deactivation
    if (id === updatedById && !isActive) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Invalidate cache
    await this.redis.del(`user:${id}`);

    // If deactivating, invalidate refresh token
    if (!isActive) {
      await this.redis.del(`refresh_token:${id}`);
    }

    // Create audit log
    await this.createAuditLog(
      updatedById,
      isActive ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE,
      EntityType.USER,
      id,
      { isActive: user.isActive },
      { isActive: updated.isActive },
    );

    this.logger.log(
      `User ${isActive ? 'activated' : 'deactivated'}: ${user.email} by ${updatedById}`,
    );

    return updated;
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    userId: string,
    action: AuditAction,
    entityType: EntityType,
    entityId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : undefined,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : undefined,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}
