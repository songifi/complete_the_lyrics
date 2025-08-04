export interface RoomActivity {
  eventType: string;
  userId: string;
  username: string;
  timestamp: Date;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface RoomAnalytics {
  totalMembers: number;
  activeMembers: number;
  peakConcurrency: number;
  averageSessionDuration: number;
  messageCount: number;
  moderationActions: number;
  createdAt: Date;
  lastActivity: Date;
}
