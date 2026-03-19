import { invoke } from "@tauri-apps/api/core";

const API_URL = "http://localhost:3001";

async function getAccessToken(): Promise<string | null> {
  try {
    return await invoke<string | null>("get_token", { key: "access_token" });
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json();

  if (!res.ok) throw new Error(body.error?.message || "Request failed");
  return body.data;
}

export const api = {
  auth: {
    register: (data: { email: string; username: string; password: string }) =>
      request<{ user: any; tokens: any }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<{ user: any; tokens: any }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    refresh: (refreshToken: string) =>
      request<{ tokens: any }>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),
    verifyStudent: (studentEmail: string) =>
      request<{ verified: boolean }>("/auth/verify-student", { method: "POST", body: JSON.stringify({ studentEmail }) }),
    me: () => request<{ id: string; email: string; username: string; isStudent: boolean; referralCode: string }>("/auth/me"),
  },
  games: {
    list: (page = 1) => request<any[]>(`/games?page=${page}`),
    featured: () => request<any[]>("/games/featured"),
    getBySlug: (slug: string) => request<any>(`/games/${slug}`),
    search: (q: string) => request<any[]>(`/games/search?q=${encodeURIComponent(q)}`),
  },
  library: {
    list: () => request<any[]>("/library"),
    download: (id: string) => request<{ url: string; expires_at: string }>(`/library/${id}/download`),
    updatePlayTime: (id: string, playTimeMins: number) =>
      request<any>(`/library/${id}`, { method: "PATCH", body: JSON.stringify({ playTimeMins }) }),
  },
  payments: {
    init: (data: any) => request<any>("/payments/init", { method: "POST", body: JSON.stringify(data) }),
    installments: (binNumber: string, price: string) =>
      request<any>(`/payments/installments?binNumber=${binNumber}&price=${price}`),
    history: () => request<any[]>("/payments/history"),
  },
};
