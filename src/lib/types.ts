export interface User {
  id: string;
  email: string;
  username: string;
  isStudent: boolean;
  referralCode: string;
  avatarUrl?: string;
  bio?: string;
  walletBalance: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  isAdmin: boolean;
  preferences?: Record<string, any>;
  createdAt?: string;
}

export interface Game {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: string;
  discountPercent: number;
  coverImageUrl: string;
  screenshots: string[];
  categories: string[];
  trailerUrl?: string;
  releaseDate: string;
  downloadUrl?: string;
  downloadSize?: string;
  fileHash?: string;
  minRequirements?: Record<string, string>;
  publisher: { name: string; slug: string };
}

export interface LibraryItem {
  id: string;
  gameId: string;
  purchasedAt: string;
  installPath: string | null;
  playTimeMins: number;
  lastPlayedAt: string | null;
  game: Game;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface WishlistItem {
  id: string;
  gameId: string;
  addedAt: string;
  game: Game;
}

export interface Review {
  id: string;
  userId: string;
  gameId: string;
  rating: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { username: string; avatarUrl?: string };
}

export interface ReviewStats {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

export interface WalletTransaction {
  id: string;
  amount: string;
  type: 'DEPOSIT' | 'PURCHASE' | 'REFERRAL_EARNING' | 'REFUND';
  referenceId?: string;
  balanceAfter: string;
  description?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  createdAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface AchievementStats {
  total: number;
  unlocked: number;
}

export interface Friend {
  id: string;
  friendshipId: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
  createdAt: string;
}

export interface CartItem {
  id: string;
  gameId: string;
  addedAt: string;
  game: Game;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
  items: { id: string; gameId: string; game: Game }[];
}

export interface CommunityLinkMirror {
  id: string;
  sourceName: string;
  url: string;
}

export interface CommunityLink {
  id: string;
  title: string;
  description?: string;
  size?: string;
  crackInfo?: string;
  score: number;
  virusReports: number;
  isAdminPost: boolean;
  isHidden: boolean;
  createdAt: string;
  user: { username: string; avatarUrl?: string };
  mirrors: CommunityLinkMirror[];
  userVote: "UP" | "DOWN" | null;
  hasReported: boolean;
}

export interface Room {
  id: string;
  hostId: string;
  host: { id: string; username: string; avatarUrl?: string };
  gameId?: string;
  game?: { id: string; title: string; slug: string; coverImageUrl: string };
  gameName: string;
  name: string;
  code: string;
  visibility: "FRIENDS" | "SCHEDULED" | "PUBLIC";
  status: "WAITING" | "PLAYING" | "CLOSED";
  maxPlayers: number;
  config?: Record<string, any>;
  hostOnline?: boolean;
  createdAt: string;
  closedAt?: string;
  players: RoomPlayer[];
}

export interface RoomPlayer {
  id: string;
  userId: string;
  user: { id: string; username: string; avatarUrl?: string };
  status: "CONNECTING" | "CONNECTED" | "READY" | "DISCONNECTED";
  joinedAt: string;
}

export interface RoomMessage {
  id: string;
  userId?: string;
  username?: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
}

