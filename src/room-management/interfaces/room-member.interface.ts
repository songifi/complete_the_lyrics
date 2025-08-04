import { RoomRole } from '../enums';

export interface RoomMember {
  userId: string;
  username: string;
  role: RoomRole;
  joinedAt: Date;
  lastActivity: Date;
  isMuted: boolean;
  isBanned: boolean;
  muteExpiresAt?: Date;
  banExpiresAt?: Date;
  permissions: string[];
  metadata: Record<string, any>;
}
