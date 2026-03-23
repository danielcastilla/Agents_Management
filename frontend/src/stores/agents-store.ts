import { create } from 'zustand';
import { apiHelpers } from '@/lib/api';

export interface Agent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  status: 'active' | 'inactive' | 'draft';
  version: number;
  tools: string[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentsState {
  agents: Agent[];
  selectedAgent: Agent | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchAgents: (params?: Record<string, any>) => Promise<void>;
  fetchAgent: (id: string) => Promise<void>;
  createAgent: (data: Partial<Agent>) => Promise<Agent>;
  updateAgent: (id: string, data: Partial<Agent>) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
  cloneAgent: (id: string, name?: string) => Promise<Agent>;
  setSelectedAgent: (agent: Agent | null) => void;
  clearError: () => void;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  selectedAgent: null,
  isLoading: false,
  error: null,

  fetchAgents: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiHelpers.agents.list(params);
      set({ agents: response.data.data || response.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch agents',
        isLoading: false,
      });
    }
  },

  fetchAgent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiHelpers.agents.get(id);
      set({ selectedAgent: response.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch agent',
        isLoading: false,
      });
    }
  },

  createAgent: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiHelpers.agents.create(data);
      const newAgent = response.data;
      set((state) => ({
        agents: [newAgent, ...state.agents],
        isLoading: false,
      }));
      return newAgent;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create agent',
        isLoading: false,
      });
      throw error;
    }
  },

  updateAgent: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiHelpers.agents.update(id, data);
      const updatedAgent = response.data;
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? updatedAgent : a)),
        selectedAgent:
          state.selectedAgent?.id === id ? updatedAgent : state.selectedAgent,
        isLoading: false,
      }));
      return updatedAgent;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update agent',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteAgent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await apiHelpers.agents.delete(id);
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== id),
        selectedAgent: state.selectedAgent?.id === id ? null : state.selectedAgent,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete agent',
        isLoading: false,
      });
      throw error;
    }
  },

  cloneAgent: async (id, name) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiHelpers.agents.clone(id, name);
      const clonedAgent = response.data;
      set((state) => ({
        agents: [clonedAgent, ...state.agents],
        isLoading: false,
      }));
      return clonedAgent;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to clone agent',
        isLoading: false,
      });
      throw error;
    }
  },

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  
  clearError: () => set({ error: null }),
}));
