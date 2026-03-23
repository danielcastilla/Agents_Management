'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAgentsStore, Agent } from '@/stores/agents-store';
import { useRunsStore } from '@/stores/runs-store';
import { formatRelativeTime, formatDuration, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  ArrowLeft,
  Play,
  Pencil,
  Copy,
  Trash2,
  Clock,
  Zap,
  Settings,
  History,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params?.id as string;
  
  const { agents, fetchAgents, deleteAgent, cloneAgent } = useAgentsStore();
  const { runs, fetchRunsByAgent, startRun, isStartingRun } = useRunsStore();
  const { toast } = useToast();
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'runs' | 'settings'>('overview');

  useEffect(() => {
    const loadData = async () => {
      await fetchAgents();
      if (agentId) {
        await fetchRunsByAgent(agentId);
      }
      setIsLoading(false);
    };
    loadData();
  }, [agentId, fetchAgents, fetchRunsByAgent]);

  useEffect(() => {
    const found = agents.find((a) => a.id === agentId);
    setAgent(found || null);
  }, [agents, agentId]);

  const handleDelete = async () => {
    if (!agent) return;

    try {
      await deleteAgent(agent.id);
      toast({
        title: 'Agent deleted',
        description: `${agent.name} has been deleted.`,
      });
      router.push('/agents');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete agent.',
        variant: 'destructive',
      });
    }
    setDeleteDialogOpen(false);
  };

  const handleClone = async () => {
    if (!agent) return;

    try {
      const cloned = await cloneAgent(agent.id, `${agent.name} (Copy)`);
      toast({
        title: 'Agent cloned',
        description: `${cloned.name} has been created.`,
      });
      router.push(`/agents/${cloned.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clone agent.',
        variant: 'destructive',
      });
    }
  };

  const handleStartRun = async () => {
    if (!agent || !runInput.trim()) return;

    try {
      const run = await startRun(agent.id, runInput);
      toast({
        title: 'Run started',
        description: 'Agent execution has been initiated.',
      });
      setRunDialogOpen(false);
      setRunInput('');
      router.push(`/runs/${run.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start run.',
        variant: 'destructive',
      });
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

  if (!agent) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Agent not found</h2>
          <p className="text-muted-foreground mb-4">
            The agent you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link href="/agents">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const agentRuns = runs.filter((r) => r.agentId === agentId);
  const successfulRuns = agentRuns.filter((r) => r.status === 'completed').length;
  const totalTokens = agentRuns.reduce((acc, r) => acc + (r.tokensUsed || 0), 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Link href="/agents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agents
        </Link>

        {/* Agent Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{agent.name}</h1>
                <Badge
                  variant={
                    agent.status === 'active'
                      ? 'success'
                      : agent.status === 'inactive'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {agent.status}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">{agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setRunDialogOpen(true)}>
              <Play className="mr-2 h-4 w-4" />
              Run Agent
            </Button>
            <Link href={`/agents/${agent.id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button variant="outline" onClick={handleClone}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex gap-4">
            {['overview', 'runs', 'settings'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Runs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agentRuns.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Success Rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {agentRuns.length > 0
                    ? ((successfulRuns / agentRuns.length) * 100).toFixed(1)
                    : 0}
                  %
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Tokens</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Version</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">v{agent.version}</div>
              </CardContent>
            </Card>

            {/* Configuration */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium">{agent.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Temperature</span>
                  <span className="font-medium">{agent.temperature ?? 0.7}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Tokens</span>
                  <span className="font-medium">{agent.maxTokens ?? 4096}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tools</span>
                  <span className="font-medium">{agent.tools?.length ?? 0} configured</span>
                </div>
              </CardContent>
            </Card>

            {/* System Prompt */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  System Prompt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md max-h-48 overflow-y-auto">
                  {agent.systemPrompt || 'No system prompt configured'}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'runs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5" />
                Execution History
              </h3>
            </div>
            {agentRuns.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Play className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No runs yet</p>
                </CardContent>
              </Card>
            ) : (
              agentRuns.map((run) => (
                <Card key={run.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Link href={`/runs/${run.id}`} className="font-medium hover:underline">
                          Run #{run.id.slice(0, 8)}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {formatRelativeTime(run.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {run.duration && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {formatDuration(run.duration)}
                          </span>
                        )}
                        {run.tokensUsed && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Zap className="h-4 w-4" />
                            {run.tokensUsed.toLocaleString()}
                          </span>
                        )}
                        <Badge
                          variant={
                            run.status === 'completed' ? 'success' :
                            run.status === 'failed' ? 'destructive' :
                            run.status === 'running' ? 'info' : 'secondary'
                          }
                        >
                          {run.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <Card>
            <CardHeader>
              <CardTitle>Agent Settings</CardTitle>
              <CardDescription>Configure advanced agent settings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Settings coming soon. Use the Edit button to modify agent configuration.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Run Dialog */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Agent</DialogTitle>
            <DialogDescription>
              Enter the input for {agent.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your prompt or question..."
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartRun} loading={isStartingRun} disabled={!runInput.trim()}>
              Start Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{agent.name}&rdquo;? This action cannot be undone.
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
