// ===========================================
// Authentication Service
// ===========================================

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuditAction, EntityType, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
}

export interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * User login
   */
  async login(
    loginDto: LoginDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      this.logger.warn(`Login attempt failed: User not found - ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      this.logger.warn(`Login attempt failed: User inactive - ${email}`);
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Login attempt failed: Invalid password - ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Store refresh token in Redis
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create audit log
    await this.createAuditLog(
      user.id,
      AuditAction.LOGIN,
      EntityType.USER,
      user.id,
      metadata,
    );

    this.logger.log(`User logged in: ${email}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.getExpiresInSeconds(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Register new user
   */
  async register(
    registerDto: RegisterDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName, role } = registerDto;

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
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    // Create audit log
    await this.createAuditLog(
      user.id,
      AuditAction.CREATE,
      EntityType.USER,
      user.id,
      metadata,
      null,
      { email: user.email, role: user.role },
    );

    this.logger.log(`New user registered: ${email}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.getExpiresInSeconds(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<AuthResponseDto> {
    // Verify refresh token exists in Redis
    const storedToken = await this.redisService.get<string>(
      `refresh_token:${userId}`,
    );

    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Store new refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.debug(`Tokens refreshed for user: ${user.email}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.getExpiresInSeconds(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Logout user
   */
  async logout(userId: string, metadata: RequestMetadata): Promise<void> {
    // Remove refresh token from Redis
    await this.redisService.del(`refresh_token:${userId}`);

    // Create audit log
    await this.createAuditLog(
      userId,
      AuditAction.LOGOUT,
      EntityType.USER,
      userId,
      metadata,
    );

    this.logger.log(`User logged out: ${userId}`);
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
    createdAt: Date;
    lastLoginAt: Date | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    metadata: RequestMetadata,
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate refresh token (force re-login)
    await this.redisService.del(`refresh_token:${userId}`);

    // Create audit log
    await this.createAuditLog(
      userId,
      AuditAction.CONFIG_CHANGE,
      EntityType.USER,
      userId,
      metadata,
      null,
      { action: 'password_changed' },
    );

    this.logger.log(`Password changed for user: ${userId}`);
  }

  /**
   * Validate user from JWT payload
   */
  async validateUser(payload: JwtPayload): Promise<{
    id: string;
    email: string;
    role: UserRole;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      role,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      role,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Store refresh token in Redis
   */
  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    await this.redisService.set(
      `refresh_token:${userId}`,
      refreshToken,
      this.REFRESH_TOKEN_TTL,
    );
  }

  /**
   * Get token expiration in seconds
   */
  private getExpiresInSeconds(): number {
    const expiresIn = this.configService.get<string>('jwt.expiresIn', '24h');
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    
    if (!match) return 86400; // Default 24 hours

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 86400;
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    userId: string,
    action: AuditAction,
    entityType: EntityType,
    entityId: string,
    metadata: RequestMetadata,
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
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}
