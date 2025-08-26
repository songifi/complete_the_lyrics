import { UserResponseDto } from "../dto/user-response.dto";

export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  lockedUsers: number;
  newUsersThisMonth: number;
  newUsersThisWeek: number;
  newUsersToday: number;
  averageLoginFrequency: number;
}

export interface PaginatedUsers {
  users: UserResponseDto[];
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrev: boolean;
}