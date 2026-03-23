'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAgentsStore } from '@/stores/agents-store';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Bot, Save } from 'lucide-react';

const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  model: z.string().min(1, 'Model is required'),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(128000).optional(),
  status: z.enum(['active', 'inactive', 'draft']).optional(),
});

type CreateAgentForm = z.infer<typeof createAgentSchema>;

const models = [
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
];

export default function NewAgentPage() {
  const router = useRouter();
  const { createAgent } = useAgentsStore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: '',
      description: '',
      model: 'gpt-4-turbo',
      systemPrompt: '',
      temperature: 0.7,
      maxTokens: 4096,
      status: 'draft',
    },
  });

  const temperature = watch('temperature');

  const onSubmit = async (data: CreateAgentForm) => {
    setIsLoading(true);
    try {
      const agent = await createAgent(data);
      toast({
        title: 'Agent created',
        description: `${agent.name} has been created successfully.`,
      });
      router.push(`/agents/${agent.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create agent.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back Button */}
        <Link href="/agents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agents
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Create New Agent</h1>
            <p className="text-muted-foreground">Configure your AI agent</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Set the name and description for your agent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name *
                </label>
                <Input
                  id="name"
                  placeholder="My AI Agent"
                  {...register('name')}
                  error={errors.name?.message}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="description"
                  placeholder="What does this agent do?"
                  {...register('description')}
                  error={errors.description?.message}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="status"
                  {...register('status')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Model Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Model Configuration</CardTitle>
              <CardDescription>
                Select the AI model and configure its parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="model" className="text-sm font-medium">
                  Model *
                </label>
                <select
                  id="model"
                  {...register('model')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {models.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="temperature" className="text-sm font-medium">
                  Temperature: {temperature}
                </label>
                <Controller
                  name="temperature"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Lower values make the output more focused and deterministic
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="maxTokens" className="text-sm font-medium">
                  Max Tokens
                </label>
                <Input
                  id="maxTokens"
                  type="number"
                  {...register('maxTokens', { valueAsNumber: true })}
                  error={errors.maxTokens?.message}
                />
              </div>
            </CardContent>
          </Card>

          {/* System Prompt */}
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>
                Define the behavior and personality of your agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="systemPrompt"
                placeholder="You are a helpful AI assistant..."
                rows={8}
                {...register('systemPrompt')}
                error={errors.systemPrompt?.message}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link href="/agents">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
