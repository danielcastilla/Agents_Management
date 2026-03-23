import { create } from 'zustand';
import { apiHelpers } from '@/lib/api';

export interface RunMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: any[];
  createdAt: string;
}

export interface Run {
  id: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input: string;
  output?: string;
  error?: string;
  tokensUsed?: number;
  duration?: number;
  messages?: RunMessage[];
  createdAt: string;
  completedAt?: string;
}

interface RunsState {
  runs: Run[];
  selectedRun: Run | null;
  isLoading: boolean;
  isStartingRun: boolean;
  error: string | null;
  streamingContent: string;
  isStreaming: boolean;

  // Actions
  fetchRuns: (params?: Record<string, any>) => Promise<void>;
  fetchRunsByAgent: (agentId: string) => Promise<void>;
  fetchRun: (id: string) => Promise<void>;
  startRun: (agentId: string, input: string) => Promise<Run>;
  cancelRun: (id: string) => Promise<void>;
  setSelectedRun: (run: Run | null) => void;
  updateRunStatus: (id: string, status: Run['status'], data?: Partial<Run>) => void;
  appendStreamContent: (content: string) => void;
  clearStreamContent: () => void;
  setStreaming: (streaming: boolean) => void;
  clearError: () => void;
}

export const useRunsStore = create<RunsState>((set, get) => ({
  runs: [],
  selectedRun: null,
  isLoading: false,
  isStartingRun: false,
  error: null,
  streamingContent: '',
  isStreaming: false,

  fetchRuns: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiHelpers.runs.list(params);
      set({ runs: response.data.data || response.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch runs',
        isLoading: false,
      });
    }
  },

  fetchRunsByAgent: async (agentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiHelpers.runs.list({ agentId });
      set({ runs: response.data.data || response.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch runs',
        isLoading: false,
      });
    }
  },

  fetchRun: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiHelpers.runs.get(id);
      set({ selectedRun: response.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch run',
        isLoading: false,
      });
    }
  },

  startRun: async (agentId, input) => {
    set({ isStartingRun: true, error: null, streamingContent: '', isStreaming: true });
    try {
      const response = await apiHelpers.runs.start(agentId, { input });
      const newRun = response.data;
      set((state) => ({
        runs: [newRun, ...state.runs],
        selectedRun: newRun,
        isStartingRun: false,
      }));
      return newRun;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to start run',
        isStartingRun: false,
        isStreaming: false,
      });
      throw error;
    }
  },

  cancelRun: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await apiHelpers.runs.cancel(id);
      set((state) => ({
        runs: state.runs.map((r) =>
          r.id === id ? { ...r, status: 'cancelled' as const } : r
        ),
        isLoading: false,
        isStreaming: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to cancel run',
        isLoading: false,
      });
      throw error;
    }
  },

  setSelectedRun: (run) => set({ selectedRun: run }),

  updateRunStatus: (id, status, data) => {
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === id ? { ...r, status, ...data } : r
      ),
      selectedRun:
        state.selectedRun?.id === id
          ? { ...state.selectedRun, status, ...data }
          : state.selectedRun,
      isStreaming: status === 'running',
    }));
  },

  appendStreamContent: (content) => {
    set((state) => ({
      streamingContent: state.streamingContent + content,
    }));
  },

  clearStreamContent: () => set({ streamingContent: '' }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  clearError: () => set({ error: null }),
}));
