'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAgentsStore, Agent } from '@/stores/agents-store';
import { formatRelativeTime, getStatusColor, cn } from '@/lib/utils';
import {
  Bot,
  Plus,
  Search,
  MoreVertical,
  Play,
  Pencil,
  Copy,
  Trash2,
  Filter,
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

export default function AgentsPage() {
  const { agents, isLoading, fetchAgents, deleteAgent, cloneAgent } = useAgentsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async () => {
    if (!selectedAgent) return;

    try {
      await deleteAgent(selectedAgent.id);
      toast({
        title: 'Agent deleted',
        description: `${selectedAgent.name} has been deleted.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete agent.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedAgent(null);
    }
  };

  const handleClone = async (agent: Agent) => {
    try {
      const cloned = await cloneAgent(agent.id, `${agent.name} (Copy)`);
      toast({
        title: 'Agent cloned',
        description: `${cloned.name} has been created.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clone agent.',
        variant: 'destructive',
      });
    }
    setMenuOpen(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Agents</h1>
            <p className="text-muted-foreground">
              Manage your AI agents and their configurations
            </p>
          </div>
          <Link href="/agents/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Agent
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Agents Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredAgents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No agents found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first agent'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Link href="/agents/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Agent
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => (
              <Card key={agent.id} className="relative group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          <Link
                            href={`/agents/${agent.id}`}
                            className="hover:underline"
                          >
                            {agent.name}
                          </Link>
                        </CardTitle>
                        <Badge
                          variant={
                            agent.status === 'active'
                              ? 'success'
                              : agent.status === 'inactive'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="mt-1"
                        >
                          {agent.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setMenuOpen(menuOpen === agent.id ? null : agent.id)
                        }
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                      {menuOpen === agent.id && (
                        <div className="absolute right-0 top-8 z-10 w-48 rounded-md border bg-background shadow-lg">
                          <Link
                            href={`/agents/${agent.id}/run`}
                            className="flex items-center px-4 py-2 text-sm hover:bg-accent"
                            onClick={() => setMenuOpen(null)}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Run Agent
                          </Link>
                          <Link
                            href={`/agents/${agent.id}/edit`}
                            className="flex items-center px-4 py-2 text-sm hover:bg-accent"
                            onClick={() => setMenuOpen(null)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                          <button
                            className="flex w-full items-center px-4 py-2 text-sm hover:bg-accent"
                            onClick={() => handleClone(agent)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Clone
                          </button>
                          <button
                            className="flex w-full items-center px-4 py-2 text-sm text-destructive hover:bg-accent"
                            onClick={() => {
                              setSelectedAgent(agent);
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
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-2 mb-4">
                    {agent.description || 'No description'}
                  </CardDescription>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Model: {agent.model}</span>
                    <span>v{agent.version}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Updated {formatRelativeTime(agent.updatedAt)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{selectedAgent?.name}&rdquo;? This
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
