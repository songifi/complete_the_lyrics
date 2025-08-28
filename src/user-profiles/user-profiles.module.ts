import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UserProfileController } from './controllers/user-profile.controller';
import { UserProfileService } from './services/user-profile.service';
import { AvatarUploadService } from './services/avatar-upload.service';
import { UserActivityService } from './services/user-activity.service';
import { UserStatisticsService } from './services/user-statistics.service';
import { UserProfile } from './entities/user-profile.entity';
import { UserActivity } from './entities/user-activity.entity';
import { UserFriend } from './entities/user-friend.entity';
import { UserPreference } from './entities/user-preference.entity';
import { UserStatistic } from './entities/user-statistic.entity';
import { User } from '../User/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserProfile,
      UserActivity,
      UserFriend,
      UserPreference,
      UserStatistic,
      User,
    ]),
    ConfigModule,
  ],
  controllers: [UserProfileController],
  providers: [
    UserProfileService,
    AvatarUploadService,
    UserActivityService,
    UserStatisticsService,
  ],
  exports: [
    UserProfileService,
    AvatarUploadService,
    UserActivityService,
    UserStatisticsService,
  ],
})
export class UserProfilesModule {}
