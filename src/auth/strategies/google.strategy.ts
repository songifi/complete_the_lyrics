import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    const isTestEnv = configService.get<string>('NODE_ENV') === 'test' || configService.get<string>('IS_TEST') === 'true';

    const clientIDFromEnv = configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientIDFromEnv && !isTestEnv) {
      throw new Error('GOOGLE_CLIENT_ID is not set. Please configure it in environment variables.');
    }
    const clientID = clientIDFromEnv ?? 'mock_client_id';

    const clientSecretFromEnv = configService.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientSecretFromEnv && !isTestEnv) {
      throw new Error('GOOGLE_CLIENT_SECRET is not set. Please configure it in environment variables.');
    }
    const clientSecret = clientSecretFromEnv ?? 'mock_client_secret';

    const callbackURLFromEnv = configService.get<string>('GOOGLE_CALLBACK_URL');
    if (!callbackURLFromEnv && !isTestEnv) {
      throw new Error('GOOGLE_CALLBACK_URL is not set. Please configure it in environment variables.');
    }
    const callbackURL = callbackURLFromEnv ?? 'http://localhost:3000/auth/google/callback';
    
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      state: true,
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    try {
      const email = profile.emails?.[0]?.value;
      const username = profile.displayName ?? email?.split('@')[0];
      const user = {
        provider: 'google' as const,
        providerId: profile.id,
        email,
        username,
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

