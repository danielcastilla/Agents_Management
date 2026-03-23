'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiHelpers } from '@/lib/api';
import { formatDate, getInitials, cn } from '@/lib/utils';
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Pencil,
  Trash2,
  Shield,
  Mail,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await apiHelpers.users.list();
      setUsers(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      // Demo data
      setUsers([
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'admin',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          role: 'user',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '3',
          name: 'Bob Wilson',
          email: 'bob@example.com',
          role: 'viewer',
          isActive: false,
          createdAt: new Date(Date.now() - 604800000).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      await apiHelpers.users.delete(selectedUser.id);
      setUsers(users.filter((u) => u.id !== selectedUser.id));
      toast({
        title: 'User deleted',
        description: `${selectedUser.name} has been removed.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete user.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Admin</Badge>;
      case 'user':
        return <Badge variant="default">User</Badge>;
      case 'viewer':
        return <Badge variant="secondary">Viewer</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-muted-foreground">
              Manage team members and their access
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>

        {/* Users List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No users found</h3>
              <p className="text-muted-foreground">
                {searchQuery || roleFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Invite your first team member'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.name}</p>
                          {!user.isActive && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getRoleBadge(user.role)}
                      <div className="text-sm text-muted-foreground">
                        {user.lastLoginAt
                          ? `Last login ${formatDate(user.lastLoginAt)}`
                          : 'Never logged in'}
                      </div>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMenuOpen(menuOpen === user.id ? null : user.id)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                        {menuOpen === user.id && (
                          <div className="absolute right-0 top-8 z-10 w-48 rounded-md border bg-background shadow-lg">
                            <button
                              className="flex w-full items-center px-4 py-2 text-sm hover:bg-accent"
                              onClick={() => setMenuOpen(null)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </button>
                            <button
                              className="flex w-full items-center px-4 py-2 text-sm hover:bg-accent"
                              onClick={() => setMenuOpen(null)}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Change Role
                            </button>
                            <button
                              className="flex w-full items-center px-4 py-2 text-sm text-destructive hover:bg-accent"
                              onClick={() => {
                                setSelectedUser(user);
                                setDeleteDialogOpen(true);
                                setMenuOpen(null);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{selectedUser?.name}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
