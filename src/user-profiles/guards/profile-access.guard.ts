import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserProfileService } from '../services/user-profile.service';

@Injectable()
export class ProfileAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userProfileService: UserProfileService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const profileUserId = request.params.userId;
    const requestingUserId = request.user?.id;

    // If no requesting user, only allow public profiles
    if (!requestingUserId) {
      const profile = await this.userProfileService.getProfile(profileUserId);
      return profile.profileVisibility === 'public';
    }

    // User can always access their own profile
    if (profileUserId === requestingUserId) {
      return true;
    }

    // Check if requesting user can view the profile based on privacy settings
    try {
      await this.userProfileService.getProfile(profileUserId, requestingUserId);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return false;
      }
      throw error;
    }
  }
}
