import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './user.entity';

describe('AuthService', () => {
  let service: AuthService;
  const userRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const jwtService = { sign: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService.sign.mockReturnValue('signed-token');
  });

  describe('register', () => {
    it('hashes the password and returns a token', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockImplementation((dto: Partial<User>) => dto);
      let savedUser: { passwordHash: string; email: string } | undefined;
      userRepository.save.mockImplementation((user: Partial<User>) => {
        savedUser = user as { passwordHash: string; email: string };
        return Promise.resolve(user);
      });

      const result = await service.register({
        email: 'a@b.com',
        password: 'password123',
      });

      expect(savedUser).toBeDefined();
      expect(savedUser?.passwordHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', savedUser!.passwordHash)).toBe(
        true,
      );
      expect(result.accessToken).toBe('signed-token');
      expect(savedUser?.email).toBe('a@b.com');
    });

    it('rejects a duplicate email', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'user-1' });
      await expect(
        service.register({ email: 'a@b.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('returns a token for valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 4);
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: hash,
      });

      const result = await service.login({
        email: 'a@b.com',
        password: 'password123',
      });
      expect(result.accessToken).toBe('signed-token');
    });

    it('rejects invalid credentials', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('tells a Google-only account to use Google sign-in', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: null,
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'whatever' }),
      ).rejects.toThrow(/Google/);
    });
  });

  describe('googleLogin', () => {
    it('creates a Google account when the email is new', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockImplementation((dto: Partial<User>) => dto);
      let savedUser: Partial<User> | undefined;
      userRepository.save.mockImplementation((user: Partial<User>) => {
        savedUser = user;
        return Promise.resolve({ id: 'user-1', ...user });
      });

      const result = await service.googleLogin({
        email: 'A@B.com',
        googleSub: 'sub-123',
      });

      expect(savedUser).toMatchObject({
        email: 'a@b.com',
        passwordHash: null,
        authProvider: 'google',
        googleSub: 'sub-123',
      });
      expect(result.accessToken).toBe('signed-token');
      expect(result.user.email).toBe('a@b.com');
    });

    it('links googleSub onto an existing password account', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: 'hash',
        authProvider: 'password',
        googleSub: null,
      });
      let savedUser: Partial<User> | undefined;
      userRepository.save.mockImplementation((user: Partial<User>) => {
        savedUser = user;
        return Promise.resolve(user);
      });

      const result = await service.googleLogin({
        email: 'a@b.com',
        googleSub: 'sub-123',
      });

      expect(savedUser).toMatchObject({
        id: 'user-1',
        googleSub: 'sub-123',
      });
      expect(result.accessToken).toBe('signed-token');
    });

    it('does not rewrite the account when googleSub already matches', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: null,
        authProvider: 'google',
        googleSub: 'sub-123',
      });

      const result = await service.googleLogin({
        email: 'a@b.com',
        googleSub: 'sub-123',
      });

      expect(userRepository.save).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('signed-token');
    });
  });
});
