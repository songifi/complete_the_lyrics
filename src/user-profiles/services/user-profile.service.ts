import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from '../entities/user-profile.entity';
import { UserActivity, ActivityType } from '../entities/user-activity.entity';
import { UserFriend, FriendStatus } from '../entities/user-friend.entity';
import { UserPreference } from '../entities/user-preference.entity';
import { UserStatistic, StatisticType } from '../entities/user-statistic.entity';
import { CreateProfileDto } from '../dto/create-profile.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UploadAvatarDto } from '../dto/upload-avatar.dto';
import { SendFriendRequestDto, RespondToFriendRequestDto, BlockUserDto, SearchFriendsDto } from '../dto/friend-request.dto';
import { CreatePreferenceDto, UpdatePreferenceDto, BulkUpdatePreferencesDto } from '../dto/user-preference.dto';
import { IUserProfileResponse, IUserProfileStats, IUserProfileSummary, IAvatarUploadResult, IPrivacySettings } from '../interfaces/user-profile.interface';
import { AvatarUploadService } from './avatar-upload.service';
import { UserActivityService } from './user-activity.service';
import { UserStatisticsService } from './user-statistics.service';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private userProfileRepository: Repository<UserProfile>,
    @InjectRepository(UserFriend)
    private userFriendRepository: Repository<UserFriend>,
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
    private avatarUploadService: AvatarUploadService,
    private userActivityService: UserActivityService,
    private userStatisticsService: UserStatisticsService,
  ) {}

  async createProfile(userId: string, createProfileDto: CreateProfileDto): Promise<IUserProfileResponse> {
    const existingProfile = await this.userProfileRepository.findOne({ where: { userId } });
    if (existingProfile) {
      throw new BadRequestException('Profile already exists for this user');
    }

    const profile = this.userProfileRepository.create({
      userId,
      ...createProfileDto,
    });

    const savedProfile = await this.userProfileRepository.save(profile);
    
    // Log activity
    await this.userActivityService.logActivity(userId, ActivityType.PROFILE_UPDATED, {
      action: 'profile_created',
    });

    return this.mapToResponse(savedProfile);
  }

  async getProfile(userId: string, requestingUserId?: string): Promise<IUserProfileResponse> {
    const profile = await this.userProfileRepository.findOne({ 
      where: { userId },
      relations: ['user'],
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Check privacy settings
    if (requestingUserId && requestingUserId !== userId) {
      const canView = await this.canViewProfile(userId, requestingUserId);
      if (!canView) {
        throw new ForbiddenException('Profile is private');
      }
    }

    return this.mapToResponse(profile);
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<IUserProfileResponse> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    Object.assign(profile, updateProfileDto);
    const updatedProfile = await this.userProfileRepository.save(profile);

    // Log activity
    await this.userActivityService.logActivity(userId, ActivityType.PROFILE_UPDATED, {
      updatedFields: Object.keys(updateProfileDto),
    });

    return this.mapToResponse(updatedProfile);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File, uploadAvatarDto: UploadAvatarDto): Promise<IAvatarUploadResult> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Delete old avatar if exists
    if (profile.avatarKey) {
      await this.avatarUploadService.deleteAvatar(profile.avatarKey);
    }

    // Upload new avatar
    const uploadResult = await this.avatarUploadService.uploadAvatar(file, uploadAvatarDto);

    // Update profile
    profile.avatarUrl = uploadResult.url;
    profile.avatarKey = uploadResult.key;
    await this.userProfileRepository.save(profile);

    // Log activity
    await this.userActivityService.logActivity(userId, ActivityType.AVATAR_UPLOADED, {
      avatarSize: uploadResult.size,
      avatarDimensions: `${uploadResult.width}x${uploadResult.height}`,
    });

    return uploadResult;
  }

  async deleteAvatar(userId: string): Promise<void> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.avatarKey) {
      await this.avatarUploadService.deleteAvatar(profile.avatarKey);
      profile.avatarUrl = null;
      profile.avatarKey = null;
      await this.userProfileRepository.save(profile);
    }
  }

  async getProfileStats(userId: string): Promise<IUserProfileStats> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const statistics = await this.userStatisticsService.getUserStatistics(userId);
    
    return {
      totalGamesPlayed: profile.totalGamesPlayed,
      totalGamesWon: profile.totalGamesWon,
      totalPoints: profile.totalPoints,
      winRate: profile.winRate,
      averageGameDuration: statistics.averageGameDuration || 0,
      longestWinStreak: statistics.longestWinStreak || 0,
      currentWinStreak: statistics.currentWinStreak || 0,
      fastestGameCompletion: statistics.fastestGameCompletion || 0,
      perfectGames: statistics.perfectGames || 0,
      friendsCount: await this.getFriendsCount(userId),
      achievementsCount: profile.achievements?.length || 0,
      badgesCount: profile.badges?.length || 0,
    };
  }

  async searchProfiles(query: string, requestingUserId?: string, limit: number = 20, offset: number = 0): Promise<IUserProfileSummary[]> {
    const profiles = await this.userProfileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.user', 'user')
      .where('user.username ILIKE :query OR profile.bio ILIKE :query OR profile.location ILIKE :query', {
        query: `%${query}%`,
      })
      .andWhere('profile.profileVisibility = :visibility', { visibility: 'public' })
      .limit(limit)
      .offset(offset)
      .getMany();

    const summaries: IUserProfileSummary[] = [];
    
    for (const profile of profiles) {
      if (requestingUserId && requestingUserId !== profile.userId) {
        const canView = await this.canViewProfile(profile.userId, requestingUserId);
        if (!canView) continue;
      }

      const isFriend = requestingUserId ? await this.areFriends(profile.userId, requestingUserId) : false;
      const friendStatus = requestingUserId ? await this.getFriendStatus(profile.userId, requestingUserId) : undefined;

      summaries.push({
        id: profile.id,
        userId: profile.userId,
        username: profile.user.username,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio,
        location: profile.location,
        totalGamesPlayed: profile.totalGamesPlayed,
        totalGamesWon: profile.totalGamesWon,
        winRate: profile.winRate,
        lastActiveAt: profile.lastActiveAt,
        isOnline: this.isUserOnline(profile.lastActiveAt),
        isFriend,
        friendStatus,
      });
    }

    return summaries;
  }

  // Friend management methods
  async sendFriendRequest(userId: string, sendFriendRequestDto: SendFriendRequestDto): Promise<void> {
    const friendProfile = await this.userProfileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.user', 'user')
      .where('user.username = :username', { username: sendFriendRequestDto.friendUsername })
      .getOne();

    if (!friendProfile) {
      throw new NotFoundException('User not found');
    }

    if (friendProfile.userId === userId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    if (!friendProfile.allowFriendRequests) {
      throw new ForbiddenException('This user does not accept friend requests');
    }

    const existingRequest = await this.userFriendRepository.findOne({
      where: [
        { userProfileId: userId, friendProfileId: friendProfile.id },
        { userProfileId: friendProfile.id, friendProfileId: userId },
      ],
    });

    if (existingRequest) {
      throw new BadRequestException('Friend request already exists');
    }

    const friendRequest = this.userFriendRepository.create({
      userProfileId: userId,
      friendProfileId: friendProfile.id,
      status: FriendStatus.PENDING,
    });

    await this.userFriendRepository.save(friendRequest);

    // Log activity
    await this.userActivityService.logActivity(userId, ActivityType.FRIEND_ADDED, {
      friendUsername: sendFriendRequestDto.friendUsername,
      message: sendFriendRequestDto.message,
    });
  }

  async respondToFriendRequest(userId: string, requestId: string, respondDto: RespondToFriendRequestDto): Promise<void> {
    const friendRequest = await this.userFriendRepository.findOne({
      where: { id: requestId, friendProfileId: userId, status: FriendStatus.PENDING },
    });

    if (!friendRequest) {
      throw new NotFoundException('Friend request not found');
    }

    friendRequest.status = respondDto.status;
    if (respondDto.status === FriendStatus.ACCEPTED) {
      friendRequest.acceptedAt = new Date();
    }

    await this.userFriendRepository.save(friendRequest);

    // Log activity
    const activityType = respondDto.status === FriendStatus.ACCEPTED ? ActivityType.FRIEND_ADDED : ActivityType.FRIEND_REMOVED;
    await this.userActivityService.logActivity(userId, activityType, {
      friendRequestId: requestId,
      response: respondDto.status,
    });
  }

  async getFriendRequests(userId: string): Promise<any[]> {
    const requests = await this.userFriendRepository
      .createQueryBuilder('friend')
      .leftJoinAndSelect('friend.userProfile', 'userProfile')
      .leftJoinAndSelect('userProfile.user', 'user')
      .where('friend.friendProfileId = :userId', { userId })
      .andWhere('friend.status = :status', { status: FriendStatus.PENDING })
      .getMany();

    return requests.map(request => ({
      id: request.id,
      user: {
        id: request.userProfile.userId,
        username: request.userProfile.user.username,
        avatarUrl: request.userProfile.avatarUrl,
      },
      createdAt: request.createdAt,
    }));
  }

  async getFriends(userId: string, searchDto: SearchFriendsDto): Promise<any[]> {
    const query = this.userFriendRepository
      .createQueryBuilder('friend')
      .leftJoinAndSelect('friend.friendProfile', 'friendProfile')
      .leftJoinAndSelect('friendProfile.user', 'user')
      .where('friend.userProfileId = :userId', { userId })
      .andWhere('friend.status = :status', { status: FriendStatus.ACCEPTED });

    if (searchDto.query) {
      query.andWhere('user.username ILIKE :query', { query: `%${searchDto.query}%` });
    }

    const friends = await query
      .limit(searchDto.limit || 20)
      .offset(searchDto.offset || 0)
      .getMany();

    return friends.map(friend => ({
      id: friend.friendProfile.id,
      userId: friend.friendProfile.userId,
      username: friend.friendProfile.user.username,
      avatarUrl: friend.friendProfile.avatarUrl,
      bio: friend.friendProfile.bio,
      lastActiveAt: friend.friendProfile.lastActiveAt,
      isOnline: this.isUserOnline(friend.friendProfile.lastActiveAt),
      friendshipCreatedAt: friend.createdAt,
      lastInteractionAt: friend.lastInteractionAt,
    }));
  }

  async removeFriend(userId: string, friendUserId: string): Promise<void> {
    const friendRequest = await this.userFriendRepository.findOne({
      where: [
        { userProfileId: userId, friendProfileId: friendUserId, status: FriendStatus.ACCEPTED },
        { userProfileId: friendUserId, friendProfileId: userId, status: FriendStatus.ACCEPTED },
      ],
    });

    if (!friendRequest) {
      throw new NotFoundException('Friendship not found');
    }

    await this.userFriendRepository.remove(friendRequest);

    // Log activity
    await this.userActivityService.logActivity(userId, ActivityType.FRIEND_REMOVED, {
      friendUserId,
    });
  }

  async blockUser(userId: string, blockUserDto: BlockUserDto): Promise<void> {
    const userToBlock = await this.userProfileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.user', 'user')
      .where('user.username = :username', { username: blockUserDto.username })
      .getOne();

    if (!userToBlock) {
      throw new NotFoundException('User not found');
    }

    if (userToBlock.userId === userId) {
      throw new BadRequestException('Cannot block yourself');
    }

    let friendRequest = await this.userFriendRepository.findOne({
      where: [
        { userProfileId: userId, friendProfileId: userToBlock.id },
        { userProfileId: userToBlock.id, friendProfileId: userId },
      ],
    });

    if (!friendRequest) {
      friendRequest = this.userFriendRepository.create({
        userProfileId: userId,
        friendProfileId: userToBlock.id,
        status: FriendStatus.BLOCKED,
      });
    } else {
      friendRequest.status = FriendStatus.BLOCKED;
    }

    friendRequest.blockReason = blockUserDto.reason;
    friendRequest.blockedAt = new Date();

    await this.userFriendRepository.save(friendRequest);
  }

  // Preference management methods
  async createPreference(userId: string, createPreferenceDto: CreatePreferenceDto): Promise<UserPreference> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const existingPreference = await this.userPreferenceRepository.findOne({
      where: { userProfileId: profile.id, key: createPreferenceDto.key },
    });

    if (existingPreference) {
      throw new BadRequestException('Preference already exists');
    }

    const preference = this.userPreferenceRepository.create({
      userProfileId: profile.id,
      ...createPreferenceDto,
    });

    const savedPreference = await this.userPreferenceRepository.save(preference);

    // Log activity
    await this.userActivityService.logActivity(userId, ActivityType.PREFERENCE_CHANGED, {
      preferenceKey: createPreferenceDto.key,
      action: 'created',
    });

    return savedPreference;
  }

  async updatePreference(userId: string, key: string, updatePreferenceDto: UpdatePreferenceDto): Promise<UserPreference> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const preference = await this.userPreferenceRepository.findOne({
      where: { userProfileId: profile.id, key },
    });

    if (!preference) {
      throw new NotFoundException('Preference not found');
    }

    Object.assign(preference, updatePreferenceDto);
    const updatedPreference = await this.userPreferenceRepository.save(preference);

    // Log activity
    await this.userActivityService.logActivity(userId, ActivityType.PREFERENCE_CHANGED, {
      preferenceKey: key,
      action: 'updated',
    });

    return updatedPreference;
  }

  async getPreferences(userId: string): Promise<UserPreference[]> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.userPreferenceRepository.find({
      where: { userProfileId: profile.id },
    });
  }

  async deletePreference(userId: string, key: string): Promise<void> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const preference = await this.userPreferenceRepository.findOne({
      where: { userProfileId: profile.id, key },
    });

    if (!preference) {
      throw new NotFoundException('Preference not found');
    }

    if (preference.isSystem) {
      throw new BadRequestException('Cannot delete system preferences');
    }

    await this.userPreferenceRepository.remove(preference);

    // Log activity
    await this.userActivityService.logActivity(userId, ActivityType.PREFERENCE_CHANGED, {
      preferenceKey: key,
      action: 'deleted',
    });
  }

  // Privacy settings methods
  async updatePrivacySettings(userId: string, privacySettings: Partial<IPrivacySettings>): Promise<void> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    Object.assign(profile, privacySettings);
    await this.userProfileRepository.save(profile);

    // Log activity
    await this.userActivityService.logActivity(userId, ActivityType.PRIVACY_SETTING_CHANGED, {
      updatedSettings: Object.keys(privacySettings),
    });
  }

  async getPrivacySettings(userId: string): Promise<IPrivacySettings> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return {
      profileVisibility: profile.profileVisibility,
      showOnlineStatus: profile.showOnlineStatus,
      allowFriendRequests: profile.allowFriendRequests,
      allowMessages: profile.allowMessages,
      showActivityStatus: profile.showActivityStatus,
      showEmail: false, // These would be additional fields in the profile
      showPhoneNumber: false,
      showDateOfBirth: false,
      showLocation: true,
      showWebsite: true,
      showSocialLinks: true,
      showStatistics: true,
      showAchievements: true,
      showBadges: true,
    };
  }

  // Helper methods
  private async canViewProfile(profileUserId: string, requestingUserId: string): Promise<boolean> {
    const profile = await this.userProfileRepository.findOne({ where: { userId: profileUserId } });
    if (!profile) return false;

    if (profile.profileVisibility === 'public') return true;
    if (profile.profileVisibility === 'private') return false;
    if (profile.profileVisibility === 'friends') {
      return await this.areFriends(profileUserId, requestingUserId);
    }

    return false;
  }

  private async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.userFriendRepository.findOne({
      where: [
        { userProfileId: userId1, friendProfileId: userId2, status: FriendStatus.ACCEPTED },
        { userProfileId: userId2, friendProfileId: userId1, status: FriendStatus.ACCEPTED },
      ],
    });
    return !!friendship;
  }

  private async getFriendStatus(userId1: string, userId2: string): Promise<FriendStatus | undefined> {
    const friendship = await this.userFriendRepository.findOne({
      where: [
        { userProfileId: userId1, friendProfileId: userId2 },
        { userProfileId: userId2, friendProfileId: userId1 },
      ],
    });
    return friendship?.status;
  }

  private async getFriendsCount(userId: string): Promise<number> {
    return this.userFriendRepository.count({
      where: [
        { userProfileId: userId, status: FriendStatus.ACCEPTED },
        { friendProfileId: userId, status: FriendStatus.ACCEPTED },
      ],
    });
  }

  private isUserOnline(lastActiveAt?: Date): boolean {
    if (!lastActiveAt) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastActiveAt > fiveMinutesAgo;
  }

  private mapToResponse(profile: UserProfile): IUserProfileResponse {
    return {
      id: profile.id,
      userId: profile.userId,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      location: profile.location,
      website: profile.website,
      dateOfBirth: profile.dateOfBirth,
      phoneNumber: profile.phoneNumber,
      language: profile.language,
      timezone: profile.timezone,
      profileVisibility: profile.profileVisibility,
      showOnlineStatus: profile.showOnlineStatus,
      allowFriendRequests: profile.allowFriendRequests,
      allowMessages: profile.allowMessages,
      showActivityStatus: profile.showActivityStatus,
      totalGamesPlayed: profile.totalGamesPlayed,
      totalGamesWon: profile.totalGamesWon,
      totalPoints: profile.totalPoints,
      winRate: profile.winRate,
      lastActiveAt: profile.lastActiveAt,
      socialLinks: profile.socialLinks,
      achievements: profile.achievements,
      badges: profile.badges,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
