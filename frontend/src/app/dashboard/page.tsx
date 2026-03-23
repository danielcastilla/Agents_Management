'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiHelpers } from '@/lib/api';
import { formatNumber, formatCurrency, formatRelativeTime } from '@/lib/utils';
import {
  Bot,
  Play,
  Wrench,
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface DashboardData {
  overview: {
    totalAgents: number;
    activeAgents: number;
    totalRuns: number;
    runsToday: number;
    totalTools: number;
    totalUsers: number;
  };
  tokenUsage: {
    totalTokens: number;
    totalCost: number;
    trend: number;
  };
  recentRuns: Array<{
    id: string;
    agentName: string;
    status: string;
    duration: number;
    createdAt: string;
  }>;
  runsTimeSeries: Array<{
    date: string;
    count: number;
  }>;
  topAgents: Array<{
    id: string;
    name: string;
    runs: number;
    successRate: number;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await apiHelpers.analytics.dashboard();
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  // Mock data for demo
  const mockData: DashboardData = data || {
    overview: {
      totalAgents: 12,
      activeAgents: 8,
      totalRuns: 1547,
      runsToday: 89,
      totalTools: 24,
      totalUsers: 15,
    },
    tokenUsage: {
      totalTokens: 2450000,
      totalCost: 48.75,
      trend: 12.5,
    },
    recentRuns: [
      { id: '1', agentName: 'Customer Support Bot', status: 'completed', duration: 2500, createdAt: new Date().toISOString() },
      { id: '2', agentName: 'Data Analyst', status: 'running', duration: 0, createdAt: new Date().toISOString() },
      { id: '3', agentName: 'Code Review Agent', status: 'completed', duration: 4200, createdAt: new Date().toISOString() },
    ],
    runsTimeSeries: [
      { date: 'Mon', count: 45 },
      { date: 'Tue', count: 52 },
      { date: 'Wed', count: 78 },
      { date: 'Thu', count: 65 },
      { date: 'Fri', count: 89 },
      { date: 'Sat', count: 34 },
      { date: 'Sun', count: 42 },
    ],
    topAgents: [
      { id: '1', name: 'Customer Support', runs: 450, successRate: 98.5 },
      { id: '2', name: 'Data Analyst', runs: 320, successRate: 95.2 },
      { id: '3', name: 'Code Reviewer', runs: 280, successRate: 99.1 },
    ],
  };

  const stats = [
    {
      title: 'Total Agents',
      value: mockData.overview.totalAgents,
      subtitle: `${mockData.overview.activeAgents} active`,
      icon: Bot,
      color: 'text-blue-600',
    },
    {
      title: 'Total Runs',
      value: formatNumber(mockData.overview.totalRuns),
      subtitle: `${mockData.overview.runsToday} today`,
      icon: Play,
      color: 'text-green-600',
    },
    {
      title: 'Tools',
      value: mockData.overview.totalTools,
      subtitle: 'Available',
      icon: Wrench,
      color: 'text-purple-600',
    },
    {
      title: 'Team Members',
      value: mockData.overview.totalUsers,
      subtitle: 'Active users',
      icon: Users,
      color: 'text-orange-600',
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your AI agents and their performance
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Token Usage & Cost */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Token Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumber(mockData.tokenUsage.totalTokens)}
              </div>
              <p className="text-sm text-muted-foreground">Total tokens this month</p>
              <div className="mt-4 flex items-center gap-2">
                {mockData.tokenUsage.trend > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={mockData.tokenUsage.trend > 0 ? 'text-green-500' : 'text-red-500'}>
                  {Math.abs(mockData.tokenUsage.trend)}%
                </span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Estimated Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(mockData.tokenUsage.totalCost)}
              </div>
              <p className="text-sm text-muted-foreground">This month</p>
              <div className="mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Budget</span>
                  <span>$100.00</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(mockData.tokenUsage.totalCost / 100) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Runs Over Time</CardTitle>
              <CardDescription>Number of agent runs per day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockData.runsTimeSeries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Agents</CardTitle>
              <CardDescription>By number of runs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockData.topAgents} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="runs" fill="hsl(var(--primary))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Runs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Runs</CardTitle>
            <CardDescription>Latest agent executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockData.recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-4">
                    <Bot className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{run.agentName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatRelativeTime(run.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {run.duration > 0 && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {(run.duration / 1000).toFixed(1)}s
                      </div>
                    )}
                    <Badge
                      variant={
                        run.status === 'completed'
                          ? 'success'
                          : run.status === 'running'
                          ? 'info'
                          : 'destructive'
                      }
                    >
                      {run.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
