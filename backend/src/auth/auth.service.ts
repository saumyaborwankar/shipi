import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleProfile } from './google-oauth.service';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      if (existing.authProvider === 'google') {
        throw new UnauthorizedException(
          'This email is signed up with Google — use "Continue with Google" to sign in',
        );
      }
      throw new UnauthorizedException(
        'An account with this email already exists',
      );
    }

    const user = await this.userRepository.save(
      this.userRepository.create({
        email: dto.email.toLowerCase(),
        authProvider: 'password',
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      }),
    );

    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses Google sign-in — use "Continue with Google" instead',
      );
    }
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResult(user);
  }

  /**
   * Signs a user in with a verified Google profile. Same email = same
   * account: an existing password-created account is linked (googleSub
   * attached) so it can be used either way.
   */
  async googleLogin(profile: GoogleProfile): Promise<AuthResult> {
    const email = profile.email.toLowerCase();
    let user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      user = await this.userRepository.save(
        this.userRepository.create({
          email,
          passwordHash: null,
          authProvider: 'google',
          googleSub: profile.googleSub,
        }),
      );
    } else if (user.googleSub !== profile.googleSub) {
      user.googleSub = profile.googleSub;
      user = await this.userRepository.save(user);
    }

    return this.buildAuthResult(user);
  }

  private buildAuthResult(user: User): AuthResult {
    return {
      accessToken: this.jwtService.sign({ sub: user.id, email: user.email }),
      user: { id: user.id, email: user.email },
    };
  }
}
