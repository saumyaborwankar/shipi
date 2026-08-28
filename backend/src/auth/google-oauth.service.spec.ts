import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GoogleOAuthService } from './google-oauth.service';

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  const jwtService = { sign: jest.fn(), verify: jest.fn() };

  const configValues: Record<string, string> = {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:3001/auth/google/callback',
    APP_REDIRECT_URIS: 'shipi://auth,http://localhost:8081/auth',
    GOOGLE_ALLOW_LOOPBACK: 'true',
  };
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthService,
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<GoogleOAuthService>(GoogleOAuthService);
  });

  const mockFetch = (
    responses: { ok: boolean; body: unknown }[],
  ): jest.SpyInstance => {
    return jest.spyOn(global, 'fetch').mockImplementation((() =>
      Promise.resolve({
        ok: responses[0]?.ok ?? true,
        json: () => responses.shift()?.body ?? {},
      })) as typeof fetch);
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateRedirectUri', () => {
    it('accepts exact allowlist matches', () => {
      expect(service.validateRedirectUri('shipi://auth')).toBe('shipi://auth');
      expect(service.validateRedirectUri('http://localhost:8081/auth')).toBe(
        'http://localhost:8081/auth',
      );
    });

    it('rejects unknown uris', () => {
      expect(() =>
        service.validateRedirectUri('https://evil.example/auth'),
      ).toThrow(BadRequestException);
      expect(() => service.validateRedirectUri(undefined)).toThrow(
        BadRequestException,
      );
    });

    it('accepts loopback uris with a port when loopback is enabled', () => {
      expect(
        service.validateRedirectUri('http://127.0.0.1:52341/shipi-callback'),
      ).toBe('http://127.0.0.1:52341/shipi-callback');
      expect(
        service.validateRedirectUri('http://localhost:52341/shipi-callback'),
      ).toBe('http://localhost:52341/shipi-callback');
    });

    it('does not accept a loopback scheme without a port', () => {
      expect(() =>
        service.validateRedirectUri('http://127.0.0.1/shipi-callback'),
      ).toThrow(BadRequestException);
    });
  });

  describe('buildAuthUrl', () => {
    it('includes the client, state, pkce and callback', () => {
      jwtService.verify.mockReturnValue({
        redirectUri: 'shipi://auth',
        codeVerifier:
          'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123',
      });

      const url = service.buildAuthUrl('state-jwt');

      expect(url).toContain('client_id=client-id');
      expect(url).toContain(
        `redirect_uri=${encodeURIComponent(
          'http://localhost:3001/auth/google/callback',
        )}`,
      );
      expect(url).toContain('state=state-jwt');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
    });
  });

  describe('exchangeCode', () => {
    const goodInfo = {
      aud: 'client-id',
      email: 'User@Example.com',
      email_verified: true,
      sub: 'sub-1',
    };

    it('returns a profile and redirect uri on success', async () => {
      jwtService.verify.mockReturnValue({
        redirectUri: 'shipi://auth',
        codeVerifier: 'verifier',
      });
      mockFetch([
        { ok: true, body: { id_token: 'id-token' } },
        { ok: true, body: goodInfo },
      ]);

      const res = await service.exchangeCode('code', 'state');

      expect(res.profile).toEqual({
        email: 'user@example.com',
        googleSub: 'sub-1',
      });
      expect(res.redirectUri).toBe('shipi://auth');
    });

    it('rejects a token with the wrong audience', async () => {
      jwtService.verify.mockReturnValue({
        redirectUri: 'shipi://auth',
        codeVerifier: 'verifier',
      });
      mockFetch([
        { ok: true, body: { id_token: 'id-token' } },
        { ok: true, body: { ...goodInfo, aud: 'someone-elses-client' } },
      ]);

      await expect(service.exchangeCode('code', 'state')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an unverified email', async () => {
      jwtService.verify.mockReturnValue({
        redirectUri: 'shipi://auth',
        codeVerifier: 'verifier',
      });
      mockFetch([
        { ok: true, body: { id_token: 'id-token' } },
        { ok: true, body: { ...goodInfo, email_verified: false } },
      ]);

      await expect(service.exchangeCode('code', 'state')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a state it cannot verify', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('bad state');
      });
      await expect(service.exchangeCode('code', 'forged')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
