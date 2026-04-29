import { create } from 'zustand';
import { API_BASE_URL, type BackendUser, readErrorMessage } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  trustScore: number;
  totalScans: number;
  totalReports: number;
  location: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingSession: boolean;
  login: (email: string, password: string) => Promise<{ requiresTwoFactor: boolean; email?: string }>;
  verifyLoginOtp: (email: string, code: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<string>;
  verifyEmail: (token: string) => Promise<string>;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

function normalizeUser(user: BackendUser): User {
  return {
    id: user.id ?? user.user_id ?? '',
    name: user.name ?? '',
    email: user.email ?? '',
    role: user.role === 'admin' ? 'admin' : 'user',
    trustScore: Number(user.trustScore ?? 50),
    totalScans: Number(user.totalScans ?? 0),
    totalReports: Number(user.totalReports ?? 0),
    location: user.location ?? null,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isCheckingSession: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          identifier: email,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as {
        user?: BackendUser;
        requiresTwoFactor?: boolean;
        email?: string;
      };

      if (data.requiresTwoFactor) {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return { requiresTwoFactor: true, email: data.email ?? email };
      }

      set({
        user: data.user ? normalizeUser(data.user) : null,
        isAuthenticated: !!data.user,
        isLoading: false,
      });
      return { requiresTwoFactor: false };
    } catch (error) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      throw error;
    }
  },

  verifyLoginOtp: async (email: string, code: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { user?: BackendUser };
      set({
        user: data.user ? normalizeUser(data.user) : null,
        isAuthenticated: !!data.user,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      throw error;
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { message?: string };
      set({ isLoading: false });
      return data.message ?? 'Account created successfully.';
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  verifyEmail: async (token: string) => {
    const response = await fetch(
      `${API_BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
      { method: 'GET' },
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = (await response.json()) as { message?: string };
    return data.message ?? 'Email verified successfully.';
  },

  checkSession: async () => {
    set({ isCheckingSession: true });
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        set({ user: null, isAuthenticated: false, isCheckingSession: false });
        return;
      }

      const data = (await response.json()) as { user?: BackendUser };
      set({
        user: data.user ? normalizeUser(data.user) : null,
        isAuthenticated: !!data.user,
        isCheckingSession: false,
      });
    } catch {
      set({ user: null, isAuthenticated: false, isCheckingSession: false });
    }
  },

  logout: async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Always clear local auth state, even if the network call fails.
    }

    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));
