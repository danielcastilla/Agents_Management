'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRunsStore, Run } from '@/stores/runs-store';
import { useWebSocket } from '@/components/providers/websocket-provider';
import { formatRelativeTime, formatDuration, cn } from '@/lib/utils';
import {
  ArrowLeft,
  Play,
  Clock,
  Zap,
  Bot,
  CheckCircle,
  XCircle,
  Loader2,
  StopCircle,
  MessageSquare,
  Wrench,
} from 'lucide-react';

interface StreamChunk {
  type: 'message' | 'tool_call' | 'tool_result' | 'error';
  content: string;
  timestamp: Date;
  toolName?: string;
}

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params?.id as string;
  
  const { runs, fetchRun, cancelRun, updateRunStatus } = useRunsStore();
  const { socket } = useWebSocket();
  
  const [run, setRun] = useState<Run | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [streamChunks, setStreamChunks] = useState<StreamChunk[]>([]);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const loadRun = async () => {
      if (runId) {
        await fetchRun(runId);
      }
      setIsLoading(false);
    };
    loadRun();
  }, [runId, fetchRun]);

  useEffect(() => {
    const found = runs.find((r) => r.id === runId);
    setRun(found || null);
  }, [runs, runId]);

  // Real-time streaming updates
  useEffect(() => {
    if (!socket || !runId) return;

    const handleStream = (data: any) => {
      if (data.runId !== runId) return;

      const chunk: StreamChunk = {
        type: data.type || 'message',
        content: data.content || data.chunk || '',
        timestamp: new Date(),
        toolName: data.toolName,
      };

      setStreamChunks((prev) => [...prev, chunk]);
    };

    const handleComplete = (data: any) => {
      if (data.runId !== runId) return;
      updateRunStatus(runId, 'completed', data);
    };

    const handleError = (data: any) => {
      if (data.runId !== runId) return;
      updateRunStatus(runId, 'failed', { error: data.error });
    };

    socket.on('run:stream', handleStream);
    socket.on('run:completed', handleComplete);
    socket.on('run:failed', handleError);

    return () => {
      socket.off('run:stream', handleStream);
      socket.off('run:completed', handleComplete);
      socket.off('run:failed', handleError);
    };
  }, [socket, runId, updateRunStatus]);

  const handleCancel = async () => {
    if (!run) return;
    
    setIsCancelling(true);
    try {
      await cancelRun(run.id);
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusIcon = (status: Run['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'running':
        return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'cancelled':
        return <StopCircle className="h-6 w-6 text-gray-500" />;
      default:
        return <Clock className="h-6 w-6 text-yellow-500" />;
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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!run) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <Play className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Run not found</h2>
          <p className="text-muted-foreground mb-4">
            The run you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link href="/runs">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Runs
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Link href="/runs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Runs
        </Link>

        {/* Run Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {getStatusIcon(run.status)}
            <div>
              <h1 className="text-3xl font-bold">Run #{run.id.slice(0, 8)}</h1>
              <div className="flex items-center gap-3 mt-1">
                {getStatusBadge(run.status)}
                <span className="text-sm text-muted-foreground">
                  Started {formatRelativeTime(run.createdAt)}
                </span>
              </div>
            </div>
          </div>
          {run.status === 'running' && (
            <Button variant="outline" onClick={handleCancel} loading={isCancelling}>
              <StopCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Duration</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xl font-bold">
                {run.duration ? formatDuration(run.duration) : run.status === 'running' ? 'In progress' : '-'}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tokens Used</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-xl font-bold">
                {run.tokensUsed?.toLocaleString() || '-'}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Agent</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <Link href={`/agents/${run.agentId}`} className="text-xl font-bold hover:underline">
                {run.agentId.slice(0, 8)}
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tool Calls</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span className="text-xl font-bold">
                {streamChunks.filter((c) => c.type === 'tool_call').length}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Input
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md">
              <p className="whitespace-pre-wrap">{run.input}</p>
            </div>
          </CardContent>
        </Card>

        {/* Streaming Output */}
        {(run.status === 'running' || streamChunks.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {run.status === 'running' && <Loader2 className="h-5 w-5 animate-spin" />}
                Stream Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-md p-4 max-h-96 overflow-y-auto space-y-2">
                {streamChunks.map((chunk, index) => (
                  <div key={index} className={cn(
                    'p-2 rounded',
                    chunk.type === 'tool_call' && 'bg-blue-100 dark:bg-blue-900/30',
                    chunk.type === 'tool_result' && 'bg-green-100 dark:bg-green-900/30',
                    chunk.type === 'error' && 'bg-red-100 dark:bg-red-900/30',
                  )}>
                    {chunk.type === 'tool_call' && (
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                        <Wrench className="h-3 w-3" />
                        Calling: {chunk.toolName}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{chunk.content}</p>
                  </div>
                ))}
                {run.status === 'running' && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Streaming...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Final Output */}
        {run.output && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-md prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap">{run.output}</pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {run.error && (
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
                <p className="text-red-600 dark:text-red-400">{run.error}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
