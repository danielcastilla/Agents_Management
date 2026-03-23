'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiHelpers } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import {
  FileText,
  Search,
  Filter,
  Download,
  User,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  userId: string;
  userName: string;
  ipAddress: string;
  details: Record<string, any>;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, resourceFilter]);

  const fetchLogs = async () => {
    try {
      const response = await apiHelpers.audit.list({
        page,
        limit: 20,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        resource: resourceFilter !== 'all' ? resourceFilter : undefined,
      });
      setLogs(response.data.data || response.data || []);
      setTotalPages(response.data.meta?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      // Demo data
      setLogs([
        {
          id: '1',
          action: 'CREATE',
          resource: 'agent',
          resourceId: 'agent-1',
          userId: 'user-1',
          userName: 'John Doe',
          ipAddress: '192.168.1.100',
          details: { name: 'Customer Support Bot' },
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          action: 'RUN',
          resource: 'agent',
          resourceId: 'agent-1',
          userId: 'user-1',
          userName: 'John Doe',
          ipAddress: '192.168.1.100',
          details: { runId: 'run-1' },
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '3',
          action: 'UPDATE',
          resource: 'tool',
          resourceId: 'tool-1',
          userId: 'user-2',
          userName: 'Jane Smith',
          ipAddress: '192.168.1.101',
          details: { changes: { isActive: true } },
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '4',
          action: 'LOGIN',
          resource: 'auth',
          resourceId: 'user-1',
          userId: 'user-1',
          userName: 'John Doe',
          ipAddress: '192.168.1.100',
          details: {},
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await apiHelpers.audit.export({
        action: actionFilter !== 'all' ? actionFilter : undefined,
        resource: resourceFilter !== 'all' ? resourceFilter : undefined,
      });
      
      // Create download link
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case 'CREATE':
        return <Badge variant="success">Create</Badge>;
      case 'UPDATE':
        return <Badge variant="info">Update</Badge>;
      case 'DELETE':
        return <Badge variant="destructive">Delete</Badge>;
      case 'RUN':
        return <Badge variant="default">Run</Badge>;
      case 'LOGIN':
        return <Badge variant="secondary">Login</Badge>;
      case 'LOGOUT':
        return <Badge variant="secondary">Logout</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const actions = ['CREATE', 'UPDATE', 'DELETE', 'RUN', 'LOGIN', 'LOGOUT'];
  const resources = ['agent', 'tool', 'user', 'auth', 'run'];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Audit Logs</h1>
            <p className="text-muted-foreground">
              Track all activities and changes in your system
            </p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Resources</option>
              {resources.map((resource) => (
                <option key={resource} value={resource}>
                  {resource.charAt(0).toUpperCase() + resource.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Logs List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No logs found</h3>
              <p className="text-muted-foreground">
                {searchQuery || actionFilter !== 'all' || resourceFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No activity recorded yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-muted p-2">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {getActionBadge(log.action)}
                            <span className="font-medium capitalize">{log.resource}</span>
                            <span className="text-muted-foreground">
                              #{log.resourceId.slice(0, 8)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.userName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(log.createdAt, true)}
                            </span>
                            <span>{log.ipAddress}</span>
                          </div>
                        </div>
                      </div>
                      {Object.keys(log.details).length > 0 && (
                        <code className="text-xs bg-muted px-2 py-1 rounded max-w-xs truncate">
                          {JSON.stringify(log.details)}
                        </code>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
