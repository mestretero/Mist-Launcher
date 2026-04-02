import { API_URL } from "./api";

export function getAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http")) return avatarUrl;
  return `${API_URL}${avatarUrl}`;
}
