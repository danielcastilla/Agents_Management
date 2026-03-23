'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRunsStore, Run } from '@/stores/runs-store';
import { formatRelativeTime, formatDuration, cn } from '@/lib/utils';
import { useWebSocket } from '@/components/providers/websocket-provider';
import {
  Play,
  Search,
  Filter,
  Clock,
  Bot,
  CheckCircle,
  XCircle,
  Loader2,
  StopCircle,
} from 'lucide-react';

export default function RunsPage() {
  const { runs, isLoading, fetchRuns, updateRunStatus } = useRunsStore();
  const { socket } = useWebSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Listen for real-time run updates
  useEffect(() => {
    if (!socket) return;

    const handleRunUpdate = (data: any) => {
      const payload = data.data || data;
      updateRunStatus(payload.runId, payload.status, payload);
    };

    socket.on('run:completed', handleRunUpdate);
    socket.on('run:failed', handleRunUpdate);
    socket.on('run:progress', handleRunUpdate);

    return () => {
      socket.off('run:completed', handleRunUpdate);
      socket.off('run:failed', handleRunUpdate);
      socket.off('run:progress', handleRunUpdate);
    };
  }, [socket, updateRunStatus]);

  const filteredRuns = runs.filter((run) => {
    const matchesSearch = run.input
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: Run['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'cancelled':
        return <StopCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: Run['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'running':
        return <Badge variant="info">Running</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Runs</h1>
            <p className="text-muted-foreground">
              View and manage agent execution history
            </p>
          </div>
          <Link href="/agents">
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Start New Run
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search runs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Runs List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredRuns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Play className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No runs found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Start a run to see it here'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredRuns.map((run) => (
              <Card key={run.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(run.status)}
                      <div>
                        <Link
                          href={`/runs/${run.id}`}
                          className="font-medium hover:underline"
                        >
                          Run #{run.id.slice(0, 8)}
                        </Link>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Bot className="h-3 w-3" />
                          <span>Agent {run.agentId.slice(0, 8)}</span>
                          <span>•</span>
                          <span>{formatRelativeTime(run.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {run.duration && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {formatDuration(run.duration)}
                        </div>
                      )}
                      {run.tokensUsed && (
                        <span className="text-sm text-muted-foreground">
                          {run.tokensUsed.toLocaleString()} tokens
                        </span>
                      )}
                      {getStatusBadge(run.status)}
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <p className="text-sm line-clamp-2">{run.input}</p>
                  </div>
                  {run.error && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {run.error}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
