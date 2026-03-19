export interface User {
  id: string;
  email: string;
  username: string;
  isStudent: boolean;
  referralCode: string;
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
  releaseDate: string;
  downloadUrl?: string;
  downloadSize?: number;
  fileHash?: string;
  minRequirements: Record<string, string>;
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
