import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { Redis } from 'ioredis';
import { AuthService } from './auth.service.js';
import type { UsersService } from '../users/users.service.js';
import type { MailService } from '../mail/mail.service.js';
import type { RefreshToken } from './entities/refresh-token.entity.js';
import type { User } from '../users/entities/user.entity.js';

vi.mock('argon2', () => ({
  verify: vi.fn(),
  hash: vi.fn(),
  argon2id: 2,
}));

const CONFIG: Record<string, number | string> = {
  JWT_ACCESS_EXPIRES_SECONDS: 900,
  JWT_REFRESH_EXPIRES_DAYS: 30,
  ACCOUNT_LOCK_5_MINUTES: 15,
  ACCOUNT_LOCK_7_MINUTES: 30,
  ACCOUNT_LOCK_8_MINUTES: 120,
  ACCOUNT_LOCK_9_PLUS_MINUTES: 300,
  IP_LOCK_WINDOW_MINUTES: 5,
  IP_LOCK_MINUTES: 15,
  EMAIL_VERIFICATION_CODE_TTL_MINUTES: 15,
};

async function expectHttpStatus(
  promise: Promise<unknown>,
  status: number,
): Promise<void> {
  try {
    await promise;
    throw new Error('Se esperaba que la promesa fuera rechazada');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(status);
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@monea.com',
    name: 'Test',
    timezone: 'America/Bogota',
    passwordHash: 'hash',
    failedLoginAttempts: 0,
    lockedUntil: null,
    emailVerified: true,
    mustChangePassword: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    create: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    registerFailedAttempt: ReturnType<typeof vi.fn>;
    resetFailedAttempts: ReturnType<typeof vi.fn>;
    markEmailVerified: ReturnType<typeof vi.fn>;
    setPassword: ReturnType<typeof vi.fn>;
  };
  let mailService: {
    sendVerificationCode: ReturnType<typeof vi.fn>;
    sendTemporaryPassword: ReturnType<typeof vi.fn>;
  };
  let redis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    sadd: ReturnType<typeof vi.fn>;
    srem: ReturnType<typeof vi.fn>;
    smembers: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    zadd: ReturnType<typeof vi.fn>;
    zremrangebyscore: ReturnType<typeof vi.fn>;
    zcard: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    ttl: ReturnType<typeof vi.fn>;
  };

  const ctx = { ip: '10.0.0.1', userAgent: 'vitest' };

  beforeEach(() => {
    vi.clearAllMocks();

    usersService = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      registerFailedAttempt: vi.fn().mockResolvedValue(undefined),
      resetFailedAttempts: vi.fn().mockResolvedValue(undefined),
      markEmailVerified: vi.fn().mockResolvedValue(undefined),
      setPassword: vi.fn().mockResolvedValue(undefined),
    };

    mailService = {
      sendVerificationCode: vi.fn().mockResolvedValue(undefined),
      sendTemporaryPassword: vi.fn().mockResolvedValue(undefined),
    };

    redis = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
      sadd: vi.fn().mockResolvedValue(1),
      srem: vi.fn().mockResolvedValue(1),
      smembers: vi.fn().mockResolvedValue([]),
      del: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      zadd: vi.fn().mockResolvedValue(1),
      zremrangebyscore: vi.fn().mockResolvedValue(0),
      zcard: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
      ttl: vi.fn().mockResolvedValue(-2),
    };

    const configService = {
      get: vi.fn((key: string, fallback?: unknown) =>
        key in CONFIG ? CONFIG[key] : fallback,
      ),
    } as unknown as ConfigService;

    const jwtService = {
      signAsync: vi.fn().mockResolvedValue('signed.jwt.token'),
    } as unknown as JwtService;

    const refreshTokenRepository = {
      create: vi.fn((value: unknown) => value),
      save: vi.fn((value: unknown) => Promise.resolve(value)),
      findOne: vi.fn(),
      update: vi.fn(),
    } as unknown as Repository<RefreshToken>;

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService,
      configService,
      mailService as unknown as MailService,
      refreshTokenRepository,
      redis as unknown as Redis,
    );
  });

  describe('registro y verificación de correo', () => {
    it('registra al usuario, guarda el código 6 dígitos en Redis y envía el correo', async () => {
      usersService.create.mockResolvedValue(makeUser());

      const result = await service.register({
        email: 'test@monea.com',
        password: 'Password123',
        name: 'Test',
      });

      expect(result).toEqual({ email: 'test@monea.com', registered: true });
      expect(redis.set).toHaveBeenCalledWith(
        'auth:email-verification:test@monea.com',
        expect.stringMatching(/^\d{6}$/),
        'EX',
        900,
      );
      expect(mailService.sendVerificationCode).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@monea.com',
          code: expect.stringMatching(/^\d{6}$/),
          expiresInMinutes: 15,
        }),
      );
    });

    it('mantiene el registro exitoso aunque falle el envío del correo', async () => {
      usersService.create.mockResolvedValue(makeUser());
      mailService.sendVerificationCode.mockRejectedValue(new Error('SMTP caído'));

      await expect(
        service.register({
          email: 'test@monea.com',
          password: 'Password123',
          name: 'Test',
        }),
      ).resolves.toEqual({ email: 'test@monea.com', registered: true });
    });

    it('verifica el correo, elimina el código y devuelve los tokens de sesión', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      redis.get.mockResolvedValue('123456');

      const result = await service.verifyEmail(
        { email: 'test@monea.com', code: '123456' },
        ctx,
      );

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.emailVerified).toBe(true);
      expect(usersService.markEmailVerified).toHaveBeenCalledWith('user-1');
      expect(redis.del).toHaveBeenCalledWith(
        'auth:email-verification:test@monea.com',
      );
    });

    it('rechaza un código incorrecto sin marcar el correo', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      redis.get.mockResolvedValue('123456');

      await expect(
        service.verifyEmail(
          { email: 'test@monea.com', code: '654321' },
          ctx,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.markEmailVerified).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('rechaza la verificación si el código expiró', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      redis.get.mockResolvedValue(null);

      await expect(
        service.verifyEmail(
          { email: 'test@monea.com', code: '123456' },
          ctx,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('reenvía el código a un correo no verificado', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ emailVerified: false }),
      );

      const result = await service.resendVerification('test@monea.com');

      expect(result.sent).toBe(true);
      expect(mailService.sendVerificationCode).toHaveBeenCalledTimes(1);
    });

    it('no revela ni envía nada cuando el correo no existe al reenviar', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.resendVerification('missing@monea.com');

      expect(result.sent).toBe(true);
      expect(mailService.sendVerificationCode).not.toHaveBeenCalled();
    });
  });

  describe('recuperación de contraseña', () => {
    it('no revela si el correo existe y responde sent=true', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('missing@monea.com');

      expect(result.sent).toBe(true);
      expect(result.message).toContain('Si el correo missing@monea.com existe');
      expect(mailService.sendTemporaryPassword).not.toHaveBeenCalled();
      expect(usersService.setPassword).not.toHaveBeenCalled();
    });

    it('genera una contraseña temporal de 8 caracteres y obliga el cambio', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      vi.mocked(argon2.hash).mockResolvedValue('temporary-hash');

      const result = await service.forgotPassword('test@monea.com');

      expect(result.sent).toBe(true);
      expect(usersService.setPassword).toHaveBeenCalledWith(
        'user-1',
        'temporary-hash',
        true,
      );
      expect(mailService.sendTemporaryPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@monea.com',
          temporaryPassword: expect.stringMatching(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8}$/,
          ),
        }),
      );
    });

    it('revierte la contraseña y responde sent=false si falla el correo', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      vi.mocked(argon2.hash).mockResolvedValue('temporary-hash');
      mailService.sendTemporaryPassword.mockRejectedValue(new Error('SMTP caído'));

      const result = await service.forgotPassword('test@monea.com');

      expect(result.sent).toBe(false);
      expect(usersService.setPassword).toHaveBeenLastCalledWith(
        'user-1',
        'hash',
        false,
      );
    });
  });

  describe('computeAccountLock', () => {
    it('no bloquea antes del quinto intento', () => {
      expect(service.computeAccountLock(1)).toBe(0);
      expect(service.computeAccountLock(4)).toBe(0);
    });

    it('bloquea 15 minutos con 5 y 6 intentos', () => {
      expect(service.computeAccountLock(5)).toBe(15);
      expect(service.computeAccountLock(6)).toBe(15);
    });

    it('escala el bloqueo según el intento (7 -> 30, 8 -> 120, 9+ -> 300)', () => {
      expect(service.computeAccountLock(7)).toBe(30);
      expect(service.computeAccountLock(8)).toBe(120);
      expect(service.computeAccountLock(9)).toBe(300);
      expect(service.computeAccountLock(20)).toBe(300);
    });
  });

  describe('login', () => {
    it('bloquea la cuenta al quinto intento fallido con 423 y minutos de bloqueo', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ failedLoginAttempts: 4 }),
      );
      vi.mocked(argon2.verify).mockResolvedValue(false);

      await expectHttpStatus(
        service.login({ email: 'test@monea.com', password: 'bad' }, ctx),
        423,
      );

      expect(usersService.registerFailedAttempt).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Date),
      );
      const [, lockedUntil] = usersService.registerFailedAttempt.mock.calls[0];
      const minutes = (lockedUntil.getTime() - Date.now()) / 60000;
      expect(minutes).toBeGreaterThan(14);
      expect(minutes).toBeLessThanOrEqual(15);
    });

    it('responde 401 cuando el intento fallido aún no alcanza el bloqueo', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ failedLoginAttempts: 1 }),
      );
      vi.mocked(argon2.verify).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@monea.com', password: 'bad' }, ctx),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.registerFailedAttempt).toHaveBeenCalledWith(
        expect.anything(),
        null,
      );
    });

    it('rechaza con 423 si la cuenta ya está bloqueada sin verificar la contraseña', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60000);
      usersService.findByEmail.mockResolvedValue(
        makeUser({ failedLoginAttempts: 5, lockedUntil }),
      );

      await expectHttpStatus(
        service.login({ email: 'test@monea.com', password: 'any' }, ctx),
        423,
      );

      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('rechaza con 401 y registra fallo de IP si el usuario no existe', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@monea.com', password: 'any' }, ctx),
      ).rejects.toThrow(UnauthorizedException);
      expect(redis.zadd).toHaveBeenCalled();
    });

    it('inicia sesión correctamente y reinicia los intentos de la cuenta', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const result = await service.login(
        { email: 'test@monea.com', password: 'good' },
        ctx,
      );

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.id).toBe('user-1');
      expect(usersService.resetFailedAttempts).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('auth:access:'),
        'user-1',
        'EX',
        900,
      );
    });

    it('devuelve solo el correo y emailVerified=false cuando falta verificar', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ emailVerified: false }),
      );
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const result = await service.login(
        { email: 'test@monea.com', password: 'good' },
        ctx,
      );

      expect(result).toEqual({
        email: 'test@monea.com',
        emailVerified: false,
      });
      expect(result).not.toHaveProperty('accessToken');
      expect(redis.set).not.toHaveBeenCalledWith(
        expect.stringContaining('auth:access:'),
        expect.anything(),
        'EX',
        expect.anything(),
      );
    });

    it('emite tokens y marca mustChangePassword=true cuando debe actualizar la contraseña', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ mustChangePassword: true }),
      );
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const result = await service.login(
        { email: 'test@monea.com', password: 'temporary' },
        ctx,
      );

      expect(result).toMatchObject({
        accessToken: 'signed.jwt.token',
        user: { mustChangePassword: true },
      });
    });

    it('bloquea el login antes de buscar al usuario si la IP está bloqueada', async () => {
      redis.ttl.mockResolvedValue(120);

      await expectHttpStatus(
        service.login({ email: 'test@monea.com', password: 'any' }, ctx),
        429,
      );

      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('IP locking', () => {
    it('marca la IP como bloqueada al alcanzar 20 fallos en la ventana', async () => {
      redis.zcard.mockResolvedValue(20);

      await service.registerIpFailure('10.0.0.1');

      expect(redis.set).toHaveBeenCalledWith(
        'auth:ip-block:10.0.0.1',
        '1',
        'EX',
        15 * 60,
      );
      expect(redis.set).toHaveBeenCalledWith(
        'auth:ip-flagged:10.0.0.1',
        '1',
        'EX',
        (15 + 5) * 60,
      );
    });

    it('no bloquea la IP si no alcanza el umbral', async () => {
      redis.zcard.mockResolvedValue(3);

      await service.registerIpFailure('10.0.0.1');

      expect(redis.set).not.toHaveBeenCalledWith(
        'auth:ip-block:10.0.0.1',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('ignora IPs vacías sin tocar Redis', async () => {
      await service.registerIpFailure('');
      await service.assertIpNotBlocked('');

      expect(redis.zadd).not.toHaveBeenCalled();
      expect(redis.ttl).not.toHaveBeenCalled();
    });

    it('assertIpNotBlocked lanza 429 con los minutos restantes cuando hay bloqueo', async () => {
      redis.ttl.mockResolvedValue(90);

      await expectHttpStatus(service.assertIpNotBlocked('10.0.0.1'), 429);
    });

    it('assertIpNotBlocked no lanza nada si la IP no está bloqueada', async () => {
      redis.ttl.mockResolvedValue(-2);

      await expect(service.assertIpNotBlocked('10.0.0.1')).resolves.toBeUndefined();
    });
  });
});
