import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService, AuthResult } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto);
  }

  /**
   * Starts Google sign-in. Redirects to Google, which calls back into
   * /auth/google/callback; the backend then redirects the user's browser
   * back to the validated `redirect_uri` with ?token & ?email.
   */
  @Get('google')
  google(
    @Query('redirect_uri') redirectUri: string | undefined,
    @Res() res: Response,
  ) {
    const uri = this.googleOAuthService.validateRedirectUri(redirectUri);
    const state = this.googleOAuthService.signState(uri);
    return res.redirect(this.googleOAuthService.buildAuthUrl(state));
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    let redirectUri: string | null = null;
    try {
      const { profile, redirectUri: target } =
        await this.googleOAuthService.exchangeCode(code, state);
      redirectUri = target;
      const result = await this.authService.googleLogin(profile);
      return res.redirect(
        this.withQuery(redirectUri, {
          token: result.accessToken,
          email: result.user.email,
        }),
      );
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Google sign-in failed';
      let target = redirectUri;
      if (!target) {
        try {
          target = this.googleOAuthService.getRedirectUri(state);
        } catch {
          target = this.googleOAuthService.defaultRedirectUri();
        }
      }
      return res.redirect(this.withQuery(target, { error }));
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { id: string; email: string }) {
    return user;
  }

  private withQuery(base: string, params: Record<string, string>): string {
    const url = new URL(base);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }
}
