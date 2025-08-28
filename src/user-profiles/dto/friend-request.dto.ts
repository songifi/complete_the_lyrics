import { IsString, IsOptional, IsEnum } from 'class-validator';
import { FriendStatus } from '../entities/user-friend.entity';

export class SendFriendRequestDto {
  @IsString()
  friendUsername: string;

  @IsString()
  @IsOptional()
  message?: string;
}

export class RespondToFriendRequestDto {
  @IsEnum(FriendStatus)
  status: FriendStatus;

  @IsString()
  @IsOptional()
  message?: string;
}

export class BlockUserDto {
  @IsString()
  username: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class SearchFriendsDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsString()
  @IsOptional()
  status?: FriendStatus;

  @IsOptional()
  limit?: number = 20;

  @IsOptional()
  offset?: number = 0;
}
