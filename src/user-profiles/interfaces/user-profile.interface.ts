export interface IUserProfileResponse {
  id: string;
  userId: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  website?: string;
  dateOfBirth?: Date;
  phoneNumber?: string;
  language: string;
  timezone: string;
  profileVisibility: 'public' | 'private' | 'friends';
  showOnlineStatus: boolean;
  allowFriendRequests: boolean;
  allowMessages: boolean;
  showActivityStatus: boolean;
  totalGamesPlayed: number;
  totalGamesWon: number;
  totalPoints: number;
  winRate: number;
  lastActiveAt?: Date;
  socialLinks?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
  achievements?: string[];
  badges?: {
    id: string;
    name: string;
    description: string;
    earnedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProfileStats {
  totalGamesPlayed: number;
  totalGamesWon: number;
  totalPoints: number;
  winRate: number;
  averageGameDuration: number;
  longestWinStreak: number;
  currentWinStreak: number;
  fastestGameCompletion: number;
  perfectGames: number;
  friendsCount: number;
  achievementsCount: number;
  badgesCount: number;
}

export interface IUserProfileSummary {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  totalGamesPlayed: number;
  totalGamesWon: number;
  winRate: number;
  lastActiveAt?: Date;
  isOnline: boolean;
  isFriend: boolean;
  friendStatus?: 'pending' | 'accepted' | 'rejected' | 'blocked';
}

export interface IAvatarUploadResult {
  url: string;
  key: string;
  size: number;
  width: number;
  height: number;
  format: string;
}

export interface IPrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  showOnlineStatus: boolean;
  allowFriendRequests: boolean;
  allowMessages: boolean;
  showActivityStatus: boolean;
  showEmail: boolean;
  showPhoneNumber: boolean;
  showDateOfBirth: boolean;
  showLocation: boolean;
  showWebsite: boolean;
  showSocialLinks: boolean;
  showStatistics: boolean;
  showAchievements: boolean;
  showBadges: boolean;
}
