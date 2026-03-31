import { invoke } from "@tauri-apps/api/core";
import type { Room, RoomMessage, Group, GroupMessage, GroupMember } from "./types";

export const API_URL = "http://localhost:3001";

let cachedAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  cachedAccessToken = token;
}

export async function getAccessToken(): Promise<string | null> {
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
    ...((options.headers as Record<string, string>) || {}),
  };
  // Only set Content-Type for requests with body
  if (options.body) headers["Content-Type"] = "application/json";
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
    me: () => request<{ id: string; email: string; username: string; isStudent: boolean; isAdmin: boolean; referralCode: string; avatarUrl?: string; bio?: string; walletBalance: string; isEmailVerified: boolean; twoFactorEnabled: boolean; preferences?: Record<string, any>; createdAt?: string }>("/auth/me"),
    updateProfile: (data: { bio?: string; avatarUrl?: string }) =>
      request<any>("/auth/profile", { method: "PATCH", body: JSON.stringify(data) }),
    uploadAvatar: async (file: File) => {
      const token = await getAccessToken();
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/auth/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Upload failed");
      return body.data;
    },
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
    list: async (page = 1, limit = 20, category?: string) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (category && category !== "Tümü") params.set("category", category);
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/games?${params}`, { headers });
      const body = await res.json();
      return { games: body.data || [], meta: body.meta || { total: 0, page: 1 } };
    },
    featured: () => request<any[]>("/games/featured"),
    recommended: () => request<any[]>("/games/recommended"),
    getBySlug: (slug: string) => request<any>(`/games/${slug}`),
    search: (q: string) => request<any[]>(`/games/search?q=${encodeURIComponent(q)}`),
    getDescription: (slug: string, lang: string) => request<{ description: string; shortDescription?: string }>(`/games/${slug}/description?lang=${lang}`),
    localizedDescription: (title: string, lang: string) => request<{ description: string | null }>(`/games/localized-description?title=${encodeURIComponent(title)}&lang=${lang}`),
    dlcs: (slug: string) => request<any[]>(`/games/${slug}/dlcs`),
    submitRequest: (gameTitle: string, reason: string) =>
      request<any>("/games/request", { method: "POST", body: JSON.stringify({ gameTitle, reason }) }),
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
  communityLinks: {
    list: (slug: string) => request<{ links: any[] }>(`/games/${slug}/community-links`),
    create: (slug: string, data: { title: string; description?: string; size?: string; crackInfo?: string; mirrors: { sourceName: string; url: string }[] }) =>
      request<any>(`/games/${slug}/community-links`, { method: "POST", body: JSON.stringify(data) }),
    vote: (slug: string, linkId: string, voteType: "UP" | "DOWN") =>
      request<{ score: number; userVote: string | null }>(`/games/${slug}/community-links/${linkId}/vote`, { method: "POST", body: JSON.stringify({ voteType }) }),
    report: (slug: string, linkId: string) =>
      request<{ reported: boolean; virusReports: number }>(`/games/${slug}/community-links/${linkId}/report`, { method: "POST" }),
    delete: (slug: string, linkId: string) =>
      request<void>(`/games/${slug}/community-links/${linkId}`, { method: "DELETE" }),
    toggleHide: (slug: string, linkId: string) =>
      request<{ isHidden: boolean }>(`/games/${slug}/community-links/${linkId}/toggle-hide`, { method: "PATCH" }),
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
  profiles: {
    get: (username: string) =>
      request<any>(`/profiles/${username}`),
    getMe: () =>
      request<any>("/profiles/me"),
    updateMe: (data: { visibility?: string; allowComments?: boolean; bannerTheme?: string; customStatus?: string }) =>
      request<any>("/profiles/me", { method: "PATCH", body: JSON.stringify(data) }),
    saveBlocks: (blocks: any[]) =>
      request<any>("/profiles/me/blocks", { method: "PUT", body: JSON.stringify(blocks) }),
    addBlock: (type: string, config?: any) =>
      request<any>("/profiles/me/blocks", { method: "POST", body: JSON.stringify({ type, config }) }),
    deleteBlock: (id: string) =>
      request<any>(`/profiles/me/blocks/${id}`, { method: "DELETE" }),
    getComments: (username: string, page = 1) =>
      request<any>(`/profiles/${username}/comments?page=${page}&limit=20`),
    addComment: (username: string, content: string) =>
      request<any>(`/profiles/${username}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
    deleteComment: (username: string, commentId: string) =>
      request<any>(`/profiles/${username}/comments/${commentId}`, { method: "DELETE" }),
    getLibrarySummary: (username: string) =>
      request<any>(`/profiles/${username}/library-summary`),
    syncGames: (games: Array<{ title: string; coverUrl?: string | null; playTimeMins: number; exePathHash: string; lastPlayedAt?: string | null }>) =>
      request<any[]>("/profiles/me/sync-games", { method: "POST", body: JSON.stringify(games) }),
    syncGame: (data: { exePathHash: string; playTimeMins: number; lastPlayedAt?: string | null; title?: string }) =>
      request<any>("/profiles/me/sync-games", { method: "PATCH", body: JSON.stringify(data) }),
  },
  marketplace: {
    getThemes: () => request<any[]>("/marketplace/themes"),
    getMyThemes: () => request<string[]>("/marketplace/my-themes"),
    purchase: (themeId: string) =>
      request<{ success: boolean; newBalance: number }>(`/marketplace/themes/${themeId}/purchase`, { method: "POST" }),
  },
  dm: {
    conversations: () => request<any[]>("/dm/conversations"),
    messages: (friendId: string) => request<any[]>(`/dm/${friendId}/messages`),
    send: (friendId: string, content: string) =>
      request<any>(`/dm/${friendId}`, { method: "POST", body: JSON.stringify({ content }) }),
  },
  groups: {
    list: () => request<Group[]>("/groups"),
    messages: (groupId: string) => request<GroupMessage[]>(`/groups/${groupId}/messages`),
    send: (groupId: string, content: string) =>
      request<GroupMessage>(`/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ content }) }),
    create: (name: string, memberIds: string[]) =>
      request<Group>("/groups", { method: "POST", body: JSON.stringify({ name, memberIds }) }),
    addMember: (groupId: string, newUserId: string) =>
      request<GroupMember>(`/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ newUserId }) }),
    removeMember: (groupId: string, userId: string) =>
      request<void>(`/groups/${groupId}/members/${userId}`, { method: "DELETE" }),
    leave: (groupId: string) =>
      request<void>(`/groups/${groupId}/leave`, { method: "DELETE" }),
    delete: (groupId: string) =>
      request<void>(`/groups/${groupId}`, { method: "DELETE" }),
  },
  rooms: {
    list: () => request<Room[]>("/rooms"),
    getById: (id: string) => request<Room>(`/rooms/${id}`),
    create: (data: {
      gameName: string;
      name: string;
      maxPlayers?: number;
      serverAddress?: string;
      discordLink?: string;
      description?: string;
      visibility?: "FRIENDS" | "SCHEDULED" | "PUBLIC";
      durationHours?: number;
      language?: string;
      scheduledStart?: string;
      scheduledEnd?: string;
    }) => request<Room>("/rooms", { method: "POST", body: JSON.stringify(data) }),
    close: (id: string) => request<void>(`/rooms/${id}`, { method: "DELETE" }),
    getMessages: (id: string, before?: string) => {
      const params = before ? `?before=${before}` : "";
      return request<RoomMessage[]>(`/rooms/${id}/messages${params}`);
    },
  },
  admin: {
    stats: () =>
      request<{ totalUsers: number; bannedUsers: number; openReports: number; reportedLinks: number }>("/admin/stats"),
    listUsers: (search?: string, page = 1, limit = 20) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      return request<{ users: any[]; total: number; page: number; limit: number }>(`/admin/users?${params}`);
    },
    banUser: (id: string) => request<{ success: boolean }>(`/admin/users/${id}/ban`, { method: "POST" }),
    unbanUser: (id: string) => request<{ success: boolean }>(`/admin/users/${id}/unban`, { method: "POST" }),
    reportedUsers: (page = 1, limit = 20) =>
      request<{ users: any[]; total: number }>(`/admin/reported-users?page=${page}&limit=${limit}`),
    getUserReports: (userId: string) =>
      request<any[]>(`/admin/reported-users/${userId}/reports`),
    resolveReport: (reportId: string, status: "RESOLVED" | "DISMISSED") =>
      request<any>(`/admin/reports/${reportId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    reportedLinks: (page = 1, limit = 20) =>
      request<{ links: any[]; total: number }>(`/admin/reported-links?page=${page}&limit=${limit}`),
    hideLink: (linkId: string) =>
      request<any>(`/admin/links/${linkId}/hide`, { method: "POST" }),
    deleteLink: (linkId: string) =>
      request<void>(`/admin/links/${linkId}`, { method: "DELETE" }),
    gameRequests: (page = 1, limit = 20) =>
      request<{ requests: any[]; total: number }>(`/admin/game-requests?page=${page}&limit=${limit}`),
    resolveGameRequest: (id: string, status: "APPROVED" | "REJECTED") =>
      request<any>(`/admin/game-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    deleteGameRequest: (id: string) =>
      request<void>(`/admin/game-requests/${id}`, { method: "DELETE" }),
  },
};
