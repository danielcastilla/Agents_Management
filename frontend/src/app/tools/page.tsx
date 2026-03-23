'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiHelpers } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Pencil,
  Trash2,
  Code,
  Zap,
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

interface Tool {
  id: string;
  name: string;
  description: string;
  type: string;
  schema: Record<string, any>;
  implementation: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await apiHelpers.tools.list();
      setTools(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      // Demo data
      setTools([
        {
          id: '1',
          name: 'web_search',
          description: 'Search the web for information',
          type: 'function',
          schema: { query: { type: 'string' } },
          implementation: 'async function web_search(query) { ... }',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'send_email',
          description: 'Send an email to specified recipients',
          type: 'function',
          schema: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
          implementation: 'async function send_email(to, subject, body) { ... }',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'database_query',
          description: 'Query the database for data',
          type: 'database',
          schema: { query: { type: 'string' } },
          implementation: 'SELECT * FROM ...',
          isActive: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTool) return;

    try {
      await apiHelpers.tools.delete(selectedTool.id);
      setTools(tools.filter((t) => t.id !== selectedTool.id));
      toast({
        title: 'Tool deleted',
        description: `${selectedTool.name} has been deleted.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete tool.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedTool(null);
    }
  };

  const toggleToolStatus = async (tool: Tool) => {
    try {
      await apiHelpers.tools.update(tool.id, { isActive: !tool.isActive });
      setTools(tools.map((t) => 
        t.id === tool.id ? { ...t, isActive: !t.isActive } : t
      ));
      toast({
        title: tool.isActive ? 'Tool disabled' : 'Tool enabled',
        description: `${tool.name} has been ${tool.isActive ? 'disabled' : 'enabled'}.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update tool status.',
        variant: 'destructive',
      });
    }
    setMenuOpen(null);
  };

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || tool.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const toolTypes = Array.from(new Set(tools.map((t) => t.type)));

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tools</h1>
            <p className="text-muted-foreground">
              Manage tools available to your AI agents
            </p>
          </div>
          <Link href="/tools/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Tool
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              {toolTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tools Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredTools.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No tools found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first tool'}
              </p>
              {!searchQuery && typeFilter === 'all' && (
                <Link href="/tools/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Tool
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map((tool) => (
              <Card key={tool.id} className={cn(!tool.isActive && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        {tool.type === 'function' ? (
                          <Code className="h-5 w-5 text-primary" />
                        ) : (
                          <Zap className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{tool.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{tool.type}</Badge>
                          <Badge variant={tool.isActive ? 'success' : 'secondary'}>
                            {tool.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMenuOpen(menuOpen === tool.id ? null : tool.id)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                      {menuOpen === tool.id && (
                        <div className="absolute right-0 top-8 z-10 w-48 rounded-md border bg-background shadow-lg">
                          <Link
                            href={`/tools/${tool.id}/edit`}
                            className="flex items-center px-4 py-2 text-sm hover:bg-accent"
                            onClick={() => setMenuOpen(null)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                          <button
                            className="flex w-full items-center px-4 py-2 text-sm hover:bg-accent"
                            onClick={() => toggleToolStatus(tool)}
                          >
                            <Zap className="mr-2 h-4 w-4" />
                            {tool.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            className="flex w-full items-center px-4 py-2 text-sm text-destructive hover:bg-accent"
                            onClick={() => {
                              setSelectedTool(tool);
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
                    {tool.description}
                  </CardDescription>
                  <div className="text-xs text-muted-foreground">
                    Updated {formatRelativeTime(tool.updatedAt)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tool</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{selectedTool?.name}&rdquo;? This
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
