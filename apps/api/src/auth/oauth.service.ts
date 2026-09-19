import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '../config/env';

export interface OauthProfile {
  providerUserId: string;
  email?: string;
  fullName?: string;
}

const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

/**
 * Google/Apple kimlik doğrulaması yalnızca istemcinin native SDK'dan aldığı
 * id_token'ı burada doğrular — parola/gizli anahtar bu akışta sunucuya girmez.
 */
@Injectable()
export class OauthService {
  private readonly googleClient = new OAuth2Client();
  private readonly googleAudiences: string[];
  private readonly appleBundleId: string;

  constructor(config: ConfigService<Env, true>) {
    this.googleAudiences = [
      config.get('GOOGLE_MOBILE_CLIENT_ID', { infer: true }),
      config.get('GOOGLE_ADMIN_CLIENT_ID', { infer: true }),
    ].filter((v): v is string => !!v);
    this.appleBundleId = config.get('APPLE_BUNDLE_ID', { infer: true });
  }

  async verify(provider: 'google' | 'apple', idToken: string): Promise<OauthProfile> {
    return provider === 'google' ? this.verifyGoogle(idToken) : this.verifyApple(idToken);
  }

  private async verifyGoogle(idToken: string): Promise<OauthProfile> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.googleAudiences,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('no sub');
      return { providerUserId: payload.sub, email: payload.email, fullName: payload.name };
    } catch {
      throw new UnauthorizedException('Google oturumu doğrulanamadı.');
    }
  }

  private async verifyApple(idToken: string): Promise<OauthProfile> {
    try {
      const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: this.appleBundleId,
      });
      if (!payload.sub) throw new Error('no sub');
      return {
        providerUserId: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
      };
    } catch {
      throw new UnauthorizedException('Apple oturumu doğrulanamadı.');
    }
  }
}
