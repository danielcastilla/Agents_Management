'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { useWebSocket } from '@/components/providers/websocket-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Moon,
  Sun,
  LogOut,
  User,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';

export function Header() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const { unreadCount, notifications, markAllAsRead } = useNotificationStore();
  const { isConnected } = useWebSocket();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      {/* Left side - Breadcrumb or Search could go here */}
      <div className="flex items-center space-x-4">
        {/* Connection status */}
        <div
          className={cn(
            'flex items-center space-x-1 text-xs',
            isConnected ? 'text-green-600' : 'text-muted-foreground'
          )}
        >
          {isConnected ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-4">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border bg-background shadow-lg">
              <div className="flex items-center justify-between border-b p-4">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    No notifications
                  </p>
                ) : (
                  notifications.slice(0, 10).map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'border-b p-4 hover:bg-accent',
                        !notification.read && 'bg-accent/50'
                      )}
                    >
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <Button
            variant="ghost"
            className="flex items-center space-x-2"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback>
                {user?.name ? getInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:inline-block text-sm font-medium">
              {user?.name}
            </span>
          </Button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-background shadow-lg">
              <div className="border-b p-4">
                <p className="font-medium">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <div className="p-2">
                <Link
                  href="/settings/profile"
                  className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
