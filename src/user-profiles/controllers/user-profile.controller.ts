import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserProfileService } from '../services/user-profile.service';
import { UserActivityService } from '../services/user-activity.service';
import { UserStatisticsService } from '../services/user-statistics.service';
import { CreateProfileDto } from '../dto/create-profile.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UploadAvatarDto } from '../dto/upload-avatar.dto';
import { SendFriendRequestDto, RespondToFriendRequestDto, BlockUserDto, SearchFriendsDto } from '../dto/friend-request.dto';
import { CreatePreferenceDto, UpdatePreferenceDto, BulkUpdatePreferencesDto } from '../dto/user-preference.dto';
import { IUserProfileResponse, IUserProfileStats, IUserProfileSummary, IPrivacySettings } from '../interfaces/user-profile.interface';

@ApiTags('User Profiles')
@Controller('user-profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserProfileController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly userActivityService: UserActivityService,
    private readonly userStatisticsService: UserStatisticsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user profile' })
  @ApiResponse({ status: 201, description: 'Profile created successfully' })
  @ApiResponse({ status: 400, description: 'Profile already exists' })
  async createProfile(
    @CurrentUser('id') userId: string,
    @Body() createProfileDto: CreateProfileDto,
  ): Promise<IUserProfileResponse> {
    return this.userProfileService.createProfile(userId, createProfileDto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getMyProfile(@CurrentUser('id') userId: string): Promise<IUserProfileResponse> {
    return this.userProfileService.getProfile(userId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user profile by ID' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 403, description: 'Profile is private' })
  async getProfile(
    @Param('userId') profileUserId: string,
    @CurrentUser('id') requestingUserId: string,
  ): Promise<IUserProfileResponse> {
    return this.userProfileService.getProfile(profileUserId, requestingUserId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<IUserProfileResponse> {
    return this.userProfileService.updateProfile(userId, updateProfileDto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload avatar for current user' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Avatar uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or upload failed' })
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() uploadAvatarDto: UploadAvatarDto,
  ) {
    return this.userProfileService.uploadAvatar(userId, file, uploadAvatarDto);
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Delete current user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar deleted successfully' })
  async deleteAvatar(@CurrentUser('id') userId: string): Promise<void> {
    return this.userProfileService.deleteAvatar(userId);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get current user statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getMyStats(@CurrentUser('id') userId: string): Promise<IUserProfileStats> {
    return this.userProfileService.getProfileStats(userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search user profiles' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchProfiles(
    @Query('q') query: string,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
    @CurrentUser('id') requestingUserId: string,
  ): Promise<IUserProfileSummary[]> {
    return this.userProfileService.searchProfiles(query, requestingUserId, limit, offset);
  }

  // Friend management endpoints
  @Post('friends/request')
  @ApiOperation({ summary: 'Send friend request' })
  @ApiResponse({ status: 201, description: 'Friend request sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or already exists' })
  @ApiResponse({ status: 403, description: 'User does not accept friend requests' })
  async sendFriendRequest(
    @CurrentUser('id') userId: string,
    @Body() sendFriendRequestDto: SendFriendRequestDto,
  ): Promise<void> {
    return this.userProfileService.sendFriendRequest(userId, sendFriendRequestDto);
  }

  @Get('friends/requests')
  @ApiOperation({ summary: 'Get pending friend requests' })
  @ApiResponse({ status: 200, description: 'Friend requests retrieved successfully' })
  async getFriendRequests(@CurrentUser('id') userId: string) {
    return this.userProfileService.getFriendRequests(userId);
  }

  @Put('friends/requests/:requestId')
  @ApiOperation({ summary: 'Respond to friend request' })
  @ApiResponse({ status: 200, description: 'Response processed successfully' })
  @ApiResponse({ status: 404, description: 'Friend request not found' })
  async respondToFriendRequest(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
    @Body() respondDto: RespondToFriendRequestDto,
  ): Promise<void> {
    return this.userProfileService.respondToFriendRequest(userId, requestId, respondDto);
  }

  @Get('friends')
  @ApiOperation({ summary: 'Get user friends' })
  @ApiResponse({ status: 200, description: 'Friends retrieved successfully' })
  async getFriends(
    @CurrentUser('id') userId: string,
    @Query() searchDto: SearchFriendsDto,
  ) {
    return this.userProfileService.getFriends(userId, searchDto);
  }

  @Delete('friends/:friendUserId')
  @ApiOperation({ summary: 'Remove friend' })
  @ApiResponse({ status: 200, description: 'Friend removed successfully' })
  @ApiResponse({ status: 404, description: 'Friendship not found' })
  async removeFriend(
    @CurrentUser('id') userId: string,
    @Param('friendUserId') friendUserId: string,
  ): Promise<void> {
    return this.userProfileService.removeFriend(userId, friendUserId);
  }

  @Post('friends/block')
  @ApiOperation({ summary: 'Block user' })
  @ApiResponse({ status: 201, description: 'User blocked successfully' })
  @ApiResponse({ status: 400, description: 'Cannot block yourself' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async blockUser(
    @CurrentUser('id') userId: string,
    @Body() blockUserDto: BlockUserDto,
  ): Promise<void> {
    return this.userProfileService.blockUser(userId, blockUserDto);
  }

  // Preference management endpoints
  @Post('preferences')
  @ApiOperation({ summary: 'Create user preference' })
  @ApiResponse({ status: 201, description: 'Preference created successfully' })
  @ApiResponse({ status: 400, description: 'Preference already exists' })
  async createPreference(
    @CurrentUser('id') userId: string,
    @Body() createPreferenceDto: CreatePreferenceDto,
  ) {
    return this.userProfileService.createPreference(userId, createPreferenceDto);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get user preferences' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved successfully' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.userProfileService.getPreferences(userId);
  }

  @Put('preferences/:key')
  @ApiOperation({ summary: 'Update user preference' })
  @ApiResponse({ status: 200, description: 'Preference updated successfully' })
  @ApiResponse({ status: 404, description: 'Preference not found' })
  async updatePreference(
    @CurrentUser('id') userId: string,
    @Param('key') key: string,
    @Body() updatePreferenceDto: UpdatePreferenceDto,
  ) {
    return this.userProfileService.updatePreference(userId, key, updatePreferenceDto);
  }

  @Delete('preferences/:key')
  @ApiOperation({ summary: 'Delete user preference' })
  @ApiResponse({ status: 200, description: 'Preference deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete system preference' })
  @ApiResponse({ status: 404, description: 'Preference not found' })
  async deletePreference(
    @CurrentUser('id') userId: string,
    @Param('key') key: string,
  ): Promise<void> {
    return this.userProfileService.deletePreference(userId, key);
  }

  // Privacy settings endpoints
  @Get('privacy')
  @ApiOperation({ summary: 'Get privacy settings' })
  @ApiResponse({ status: 200, description: 'Privacy settings retrieved successfully' })
  async getPrivacySettings(@CurrentUser('id') userId: string): Promise<IPrivacySettings> {
    return this.userProfileService.getPrivacySettings(userId);
  }

  @Put('privacy')
  @ApiOperation({ summary: 'Update privacy settings' })
  @ApiResponse({ status: 200, description: 'Privacy settings updated successfully' })
  async updatePrivacySettings(
    @CurrentUser('id') userId: string,
    @Body() privacySettings: Partial<IPrivacySettings>,
  ): Promise<void> {
    return this.userProfileService.updatePrivacySettings(userId, privacySettings);
  }

  // Activity endpoints
  @Get('activities')
  @ApiOperation({ summary: 'Get user activities' })
  @ApiResponse({ status: 200, description: 'Activities retrieved successfully' })
  async getActivities(
    @CurrentUser('id') userId: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
    @Query('type') activityType?: string,
  ) {
    return this.userActivityService.getUserActivities(userId, limit, offset, activityType ? [activityType as any] : undefined);
  }

  @Get('activities/stats')
  @ApiOperation({ summary: 'Get activity statistics' })
  @ApiResponse({ status: 200, description: 'Activity statistics retrieved successfully' })
  async getActivityStats(
    @CurrentUser('id') userId: string,
    @Query('days') days: number = 30,
  ) {
    return this.userActivityService.getActivityStats(userId, days);
  }

  @Get('activities/summary')
  @ApiOperation({ summary: 'Get activity summary' })
  @ApiResponse({ status: 200, description: 'Activity summary retrieved successfully' })
  async getActivitySummary(@CurrentUser('id') userId: string) {
    return this.userActivityService.getActivitySummary(userId);
  }

  // Statistics endpoints
  @Get('statistics/history/:type')
  @ApiOperation({ summary: 'Get statistic history' })
  @ApiResponse({ status: 200, description: 'Statistic history retrieved successfully' })
  async getStatisticHistory(
    @CurrentUser('id') userId: string,
    @Param('type') type: string,
    @Query('days') days: number = 30,
  ) {
    return this.userStatisticsService.getStatisticHistory(userId, type as any, days);
  }

  @Get('statistics/comparison/:type')
  @ApiOperation({ summary: 'Get statistic comparison' })
  @ApiResponse({ status: 200, description: 'Statistic comparison retrieved successfully' })
  async getStatisticComparison(
    @CurrentUser('id') userId: string,
    @Param('type') type: string,
  ) {
    return this.userStatisticsService.getComparisonStats(userId, type as any);
  }

  @Get('statistics/leaderboard/:type')
  @ApiOperation({ summary: 'Get leaderboard for statistic type' })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully' })
  async getLeaderboard(
    @Param('type') type: string,
    @Query('limit') limit: number = 10,
  ) {
    const leaderboard = await this.userStatisticsService.getLeaderboardStats(type as any, limit);
    return leaderboard.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }
}
