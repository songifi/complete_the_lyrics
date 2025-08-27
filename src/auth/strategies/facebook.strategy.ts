import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private configService: ConfigService) {
    const isTestEnv = configService.get<string>('NODE_ENV') === 'test' || configService.get<string>('IS_TEST') === 'true';

    const clientIDFromEnv = configService.get<string>('FACEBOOK_APP_ID');
    if (!clientIDFromEnv && !isTestEnv) {
      throw new Error('FACEBOOK_APP_ID is not set. Please configure it in environment variables.');
    }
    const clientID = clientIDFromEnv ?? 'mock_app_id';

    const clientSecretFromEnv = configService.get<string>('FACEBOOK_APP_SECRET');
    if (!clientSecretFromEnv && !isTestEnv) {
      throw new Error('FACEBOOK_APP_SECRET is not set. Please configure it in environment variables.');
    }
    const clientSecret = clientSecretFromEnv ?? 'mock_app_secret';

    const callbackURLFromEnv = configService.get<string>('FACEBOOK_CALLBACK_URL');
    if (!callbackURLFromEnv && !isTestEnv) {
      throw new Error('FACEBOOK_CALLBACK_URL is not set. Please configure it in environment variables.');
    }
    const callbackURL = callbackURLFromEnv ?? 'http://localhost:3000/auth/facebook/callback';
    
    super({
      clientID,
      clientSecret,
      callbackURL,
      profileFields: ['id', 'emails', 'name', 'photos'],
      state: true,
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: any, user?: any, info?: any) => void,
  ): void {
    try {
      const user = {
        provider: 'facebook',
        providerId: profile.id,
        email: profile.emails?.[0]?.value,
        username: profile.displayName || profile.emails?.[0]?.value?.split('@')[0],
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName,
        avatar: profile.photos?.[0]?.value,
      };

      done(null, user);
    } catch (err) {
      done(err as Error);
    }
  }
}

