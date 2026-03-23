'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiHelpers } from '@/lib/api';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  DollarSign,
  Clock,
  Bot,
  Play,
  Users,
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
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

interface AnalyticsData {
  tokenUsage: {
    total: number;
    byProvider: Array<{ provider: string; tokens: number; cost: number }>;
    trend: number;
  };
  runs: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    byDay: Array<{ date: string; count: number; success: number; failed: number }>;
  };
  agents: {
    total: number;
    active: number;
    byModel: Array<{ model: string; count: number }>;
    topPerformers: Array<{ name: string; successRate: number; runs: number }>;
  };
  costs: {
    total: number;
    byMonth: Array<{ month: string; cost: number }>;
    projected: number;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await apiHelpers.analytics.dashboard();
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Demo data
      setData({
        tokenUsage: {
          total: 2450000,
          byProvider: [
            { provider: 'OpenAI', tokens: 1800000, cost: 36.00 },
            { provider: 'Anthropic', tokens: 650000, cost: 12.75 },
          ],
          trend: 12.5,
        },
        runs: {
          total: 1547,
          successful: 1489,
          failed: 58,
          averageDuration: 3500,
          byDay: [
            { date: 'Mon', count: 45, success: 43, failed: 2 },
            { date: 'Tue', count: 52, success: 50, failed: 2 },
            { date: 'Wed', count: 78, success: 75, failed: 3 },
            { date: 'Thu', count: 65, success: 62, failed: 3 },
            { date: 'Fri', count: 89, success: 87, failed: 2 },
            { date: 'Sat', count: 34, success: 33, failed: 1 },
            { date: 'Sun', count: 42, success: 41, failed: 1 },
          ],
        },
        agents: {
          total: 12,
          active: 8,
          byModel: [
            { model: 'GPT-4 Turbo', count: 5 },
            { model: 'Claude 3 Opus', count: 3 },
            { model: 'GPT-3.5 Turbo', count: 4 },
          ],
          topPerformers: [
            { name: 'Customer Support', successRate: 98.5, runs: 450 },
            { name: 'Code Reviewer', successRate: 99.1, runs: 280 },
            { name: 'Data Analyst', successRate: 95.2, runs: 320 },
          ],
        },
        costs: {
          total: 48.75,
          byMonth: [
            { month: 'Jan', cost: 32.50 },
            { month: 'Feb', cost: 38.20 },
            { month: 'Mar', cost: 42.80 },
            { month: 'Apr', cost: 48.75 },
          ],
          projected: 65.00,
        },
      });
    } finally {
      setIsLoading(false);
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

  if (!data) return null;

  const successRate = ((data.runs.successful / data.runs.total) * 100).toFixed(1);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">
              Detailed insights into your AI agents performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  dateRange === range
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Total Tokens
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(data.tokenUsage.total)}</div>
              <div className="flex items-center gap-1 text-sm">
                {data.tokenUsage.trend > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={data.tokenUsage.trend > 0 ? 'text-green-500' : 'text-red-500'}>
                  {Math.abs(data.tokenUsage.trend)}%
                </span>
                <span className="text-muted-foreground">vs last period</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Cost
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.costs.total)}</div>
              <p className="text-sm text-muted-foreground">
                Projected: {formatCurrency(data.costs.projected)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Total Runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(data.runs.total)}</div>
              <p className="text-sm text-muted-foreground">
                {successRate}% success rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Avg Duration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(data.runs.averageDuration / 1000).toFixed(1)}s
              </div>
              <p className="text-sm text-muted-foreground">per run</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Runs Over Time</CardTitle>
              <CardDescription>Success vs Failed runs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.runs.byDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="success"
                      stackId="1"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      stackId="1"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Trend</CardTitle>
              <CardDescription>Monthly spending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.costs.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value) => [`$${value}`, 'Cost']} />
                    <Bar dataKey="cost" fill="hsl(var(--primary))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Tokens by Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.tokenUsage.byProvider}
                      dataKey="tokens"
                      nameKey="provider"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ provider }) => provider}
                    >
                      {data.tokenUsage.byProvider.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNumber(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {data.tokenUsage.byProvider.map((p, i) => (
                  <div key={p.provider} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span>{p.provider}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(p.cost)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agents by Model</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.agents.byModel}
                      dataKey="count"
                      nameKey="model"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      label={({ model }) => model}
                    >
                      {data.agents.byModel.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>By success rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.agents.topPerformers.map((agent, index) => (
                  <div key={agent.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {agent.runs} runs
                        </p>
                      </div>
                    </div>
                    <Badge variant="success">{agent.successRate}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
