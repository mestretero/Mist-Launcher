import { invoke } from "@tauri-apps/api/core";

const API_URL = "http://localhost:3001";

let cachedAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  cachedAccessToken = token;
}

async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const token = await invoke<string | null>("get_token", { key: "access_token" });
    if (token) cachedAccessToken = token;
    return token;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}, _retry = false): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Auto-refresh on 401 (expired access token)
  if (res.status === 401 && !_retry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return request<T>(path, options, true);
  }

  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message || "Request failed");
  return body.data;
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const refreshToken = await invoke<string | null>("get_token", { key: "refresh_token" });
    if (!refreshToken) return false;

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;

    const body = await res.json();
    const tokens = body.data?.tokens;
    if (!tokens) return false;

    await invoke("store_token", { key: "access_token", value: tokens.accessToken });
    await invoke("store_token", { key: "refresh_token", value: tokens.refreshToken });
    cachedAccessToken = tokens.accessToken;
    return true;
  } catch {
    return false;
  }
}

export const api = {
  auth: {
    register: (data: { email: string; username: string; password: string }) =>
      request<{ user: any; tokens: any }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<{ user?: any; tokens?: any; requires2FA?: boolean; userId?: string }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    refresh: (refreshToken: string) =>
      request<{ tokens: any }>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),
    verifyStudent: (studentEmail: string) =>
      request<{ verified: boolean }>("/auth/verify-student", { method: "POST", body: JSON.stringify({ studentEmail }) }),
    me: () => request<{ id: string; email: string; username: string; isStudent: boolean; referralCode: string; avatarUrl?: string; bio?: string; walletBalance: string; isEmailVerified: boolean; twoFactorEnabled: boolean; preferences?: Record<string, any>; createdAt?: string }>("/auth/me"),
    updateProfile: (data: { bio?: string; avatarUrl?: string }) =>
      request<any>("/auth/profile", { method: "PATCH", body: JSON.stringify(data) }),
    updatePreferences: (prefs: Record<string, any>) =>
      request<any>("/auth/preferences", { method: "PATCH", body: JSON.stringify(prefs) }),
    forgotPassword: (email: string) =>
      request<any>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
    resetPassword: (token: string, password: string) =>
      request<any>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword: password }) }),
    verifyEmail: (token: string) =>
      request<any>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
    twoFactor: {
      setup: () =>
        request<{ qrCodeDataUrl: string; secret: string }>("/auth/2fa/setup", { method: "POST" }),
      verify: (token: string) =>
        request<{ enabled: boolean }>("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ token }) }),
      disable: () =>
        request<{ enabled: boolean }>("/auth/2fa/disable", { method: "POST" }),
      login: (userId: string, token: string) =>
        request<{ user: any; tokens: any }>("/auth/2fa/login", { method: "POST", body: JSON.stringify({ userId, token }) }),
    },
  },
  games: {
    list: (page = 1, category?: string) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (category && category !== "Tümü") params.set("category", category);
      return request<any[]>(`/games?${params}`);
    },
    featured: () => request<any[]>("/games/featured"),
    getBySlug: (slug: string) => request<any>(`/games/${slug}`),
    search: (q: string) => request<any[]>(`/games/search?q=${encodeURIComponent(q)}`),
    dlcs: (slug: string) => request<any[]>(`/games/${slug}/dlcs`),
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
  wishlist: {
    list: () => request<any[]>("/wishlist"),
    add: (gameId: string) => request<any>(`/wishlist/${gameId}`, { method: "POST" }),
    remove: (gameId: string) => request<any>(`/wishlist/${gameId}`, { method: "DELETE" }),
    check: (gameId: string) => request<{ wishlisted: boolean }>(`/wishlist/${gameId}/check`),
  },
  wallet: {
    get: () => request<any>("/wallet"),
    deposit: (amount: string) => request<any>("/wallet/deposit", { method: "POST", body: JSON.stringify({ amount }) }),
    history: () => request<any[]>("/wallet/history"),
  },
  reviews: {
    list: (slug: string) => request<any>(`/games/${slug}/reviews`),
    create: (slug: string, data: { rating: number; content: string }) =>
      request<any>(`/games/${slug}/reviews`, { method: "POST", body: JSON.stringify(data) }),
    update: (slug: string, data: { rating: number; content: string }) =>
      request<any>(`/games/${slug}/reviews`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (slug: string) => request<any>(`/games/${slug}/reviews`, { method: "DELETE" }),
  },
  notifications: {
    list: () => request<{ notifications: any[]; unreadCount: number }>("/notifications"),
    markRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: "PATCH" }),
    markAllRead: () => request<any>("/notifications/read-all", { method: "POST" }),
  },
  friends: {
    list: () => request<any[]>("/friends"),
    pending: () => request<any[]>("/friends/pending"),
    search: (q: string) => request<any[]>(`/friends/search?q=${encodeURIComponent(q)}`),
    request: (username: string) => request<any>("/friends/request", { method: "POST", body: JSON.stringify({ username }) }),
    accept: (id: string) => request<any>(`/friends/${id}/accept`, { method: "POST" }),
    reject: (id: string) => request<any>(`/friends/${id}/reject`, { method: "POST" }),
    remove: (id: string) => request<any>(`/friends/${id}`, { method: "DELETE" }),
  },
  achievements: {
    forGame: (slug: string) => request<any>(`/games/${slug}/achievements`),
    forLibraryItem: (id: string) => request<any>(`/library/${id}/achievements`),
  },
  collections: {
    list: () => request<any[]>("/collections"),
    create: (name: string) => request<any>("/collections", { method: "POST", body: JSON.stringify({ name }) }),
    remove: (id: string) => request<any>(`/collections/${id}`, { method: "DELETE" }),
    addGame: (id: string, gameId: string) => request<any>(`/collections/${id}/games/${gameId}`, { method: "POST" }),
    removeGame: (id: string, gameId: string) => request<any>(`/collections/${id}/games/${gameId}`, { method: "DELETE" }),
  },
  cart: {
    get: () => request<any>("/cart"),
    add: (gameId: string) => request<any>(`/cart/${gameId}`, { method: "POST" }),
    remove: (gameId: string) => request<any>(`/cart/${gameId}`, { method: "DELETE" }),
    clear: () => request<any>("/cart", { method: "DELETE" }),
  },
};
