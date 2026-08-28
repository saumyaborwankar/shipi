import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

export interface GoogleProfile {
  email: string;
  googleSub: string;
}

interface AuthStatePayload {
  redirectUri: string;
  codeVerifier: string;
}

const DEFAULT_REDIRECT_URIS = ['shipi://auth'];
const DEFAULT_PUBLIC_URL = 'http://localhost:3001';

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  private get clientId(): string {
    return this.requiredConfig('GOOGLE_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.requiredConfig('GOOGLE_CLIENT_SECRET');
  }

  private get callbackUrl(): string {
    return (
      this.configService.get<string>('GOOGLE_CALLBACK_URL') ??
      `${this.publicUrl}/auth/google/callback`
    );
  }

  private get publicUrl(): string {
    return (
      this.configService.get<string>('SHIPI_PUBLIC_URL') ?? DEFAULT_PUBLIC_URL
    );
  }

  private allowedRedirectUris(): string[] {
    const raw = this.configService.get<string>('APP_REDIRECT_URIS');
    if (!raw) {
      return DEFAULT_REDIRECT_URIS;
    }
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  defaultRedirectUri(): string {
    return this.allowedRedirectUris()[0] ?? DEFAULT_REDIRECT_URIS[0];
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new BadRequestException(`${key} is not configured on the server`);
    }
    return value;
  }

  /**
   * Accepts either an exact match from APP_REDIRECT_URIS, or — when
   * GOOGLE_ALLOW_LOOPBACK is enabled (dev only) — any 127.0.0.1/localhost
   * port, which the desktop app uses for its in-process callback server.
   */
  validateRedirectUri(uri: string | undefined): string {
    if (!uri) {
      throw new BadRequestException('Missing redirect_uri');
    }
    if (this.allowedRedirectUris().includes(uri)) {
      return uri;
    }
    const allowLoopback = this.configService.get<string>(
      'GOOGLE_ALLOW_LOOPBACK',
    );
    if (allowLoopback && allowLoopback !== 'false') {
      try {
        const parsed = new URL(uri);
        if (
          (parsed.hostname === '127.0.0.1' ||
            parsed.hostname === 'localhost') &&
          parsed.port !== ''
        ) {
          return uri;
        }
      } catch {
        // fall through to the rejection below
      }
    }
    throw new BadRequestException('Unknown redirect_uri');
  }

  signState(redirectUri: string): string {
    const payload: AuthStatePayload = {
      redirectUri,
      codeVerifier: randomBytes(32).toString('base64url'),
    };
    return this.jwtService.sign(payload, { expiresIn: 600 });
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: sha256b64url(this.verifyState(state).codeVerifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  getRedirectUri(state: string | undefined): string {
    return this.verifyState(state).redirectUri;
  }

  private verifyState(state: string | undefined): AuthStatePayload {
    if (!state) {
      throw new BadRequestException('Missing OAuth state');
    }
    try {
      return this.jwtService.verify<AuthStatePayload>(state);
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
  }

  async exchangeCode(
    code: string | undefined,
    state: string | undefined,
  ): Promise<{ profile: GoogleProfile; redirectUri: string }> {
    if (!code) {
      throw new BadRequestException('Missing OAuth code');
    }
    const payload = this.verifyState(state);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.callbackUrl,
        grant_type: 'authorization_code',
        code_verifier: payload.codeVerifier,
      }),
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedException('Google could not complete the sign-in');
    }

    const tokenBody = (await tokenRes.json()) as { id_token?: string };
    if (!tokenBody.id_token) {
      throw new UnauthorizedException('Google did not return an ID token');
    }

    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
        tokenBody.id_token,
      )}`,
    );
    if (!infoRes.ok) {
      throw new UnauthorizedException('Google ID token could not be verified');
    }

    const info = (await infoRes.json()) as {
      aud?: string;
      email?: string;
      email_verified?: boolean | string;
      sub?: string;
    };

    if (info.aud !== this.clientId) {
      throw new UnauthorizedException('Google ID token audience mismatch');
    }
    if (!info.email || !info.sub) {
      throw new UnauthorizedException('Google account is missing an email');
    }
    const verified =
      info.email_verified === true || info.email_verified === 'true';
    if (!verified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    return {
      profile: { email: info.email.toLowerCase(), googleSub: info.sub },
      redirectUri: payload.redirectUri,
    };
  }
}

function sha256b64url(input: string): string {
  return createHash('sha256').update(input).digest('base64url');
}
