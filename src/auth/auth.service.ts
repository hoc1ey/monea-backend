import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from 'crypto';
import * as argon2 from 'argon2';
import { REDIS_CLIENT } from '../config/redis.module.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';
import { MailService } from '../mail/mail.service.js';
import {
  generateTemporaryPassword,
  generateVerificationCode,
} from '../common/utils/password.util.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';

const EMAIL_VERIFICATION_KEY_PREFIX = 'auth:email-verification:';

export interface RequestContext {
  ip: string;
  userAgent: string;
}

export interface RegisterResponse {
  email: string;
  registered: boolean;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    email: string;
    name: string;
    timezone: string;
    emailVerified: boolean;
    mustChangePassword: boolean;
  };
}

export interface EmailVerificationRequiredResponse {
  email: string;
  emailVerified: false;
}

export type LoginResponse =
  | AuthTokensResponse
  | EmailVerificationRequiredResponse;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  /**
   * Registro de un nuevo usuario. Envía un código de verificación al correo
   * y no emite tokens hasta que el usuario inicie sesión.
   */
  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const user = await this.usersService.create(dto);
    await this.storeAndSendVerificationCode(user.email, user.name);

    return { email: user.email, registered: true };
  }

  /**
   * Verifica el correo del usuario con el código almacenado en Redis y, si es
   * correcto, emite los tokens de sesión.
   */
  async verifyEmail(
    dto: VerifyEmailDto,
    ctx: RequestContext,
  ): Promise<AuthTokensResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);
    const key = this.verificationKey(email);
    const storedCode = await this.redis.get(key);

    if (!user || !storedCode || !this.codesMatch(storedCode, dto.code)) {
      throw new BadRequestException('Código inválido o expirado');
    }

    await this.usersService.markEmailVerified(user.id);
    await this.redis.del(key);

    user.emailVerified = true;
    return this.issueTokens(user, ctx);
  }

  /**
   * Reenvía el código de verificación. La respuesta es genérica para no
   * revelar si el correo está registrado.
   */
  async resendVerification(
    email: string,
  ): Promise<{ sent: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (user && !user.emailVerified) {
      await this.storeAndSendVerificationCode(user.email, user.name);
    }

    return {
      sent: true,
      message:
        'Si el correo está registrado y aún no ha sido verificado, recibirás un nuevo código de verificación',
    };
  }

  /**
   * Genera una contraseña temporal, la envía por correo y obliga al usuario a
   * cambiarla en su próximo inicio de sesión. No revela si el correo existe.
   */
  async forgotPassword(
    email: string,
  ): Promise<{ sent: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const genericMessage = `Si el correo ${normalizedEmail} existe, recibirás un correo con tu nueva contraseña temporal`;
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      return { sent: true, message: genericMessage };
    }

    const previousPasswordHash = user.passwordHash;
    const previousMustChangePassword = user.mustChangePassword;

    try {
      const temporaryPassword = generateTemporaryPassword(8);
      const passwordHash = await argon2.hash(temporaryPassword, {
        type: argon2.argon2id,
      });

      await this.usersService.setPassword(user.id, passwordHash, true);

      try {
        await this.mailService.sendTemporaryPassword({
          to: user.email,
          name: user.name,
          temporaryPassword,
        });
      } catch (error) {
        await this.usersService.setPassword(
          user.id,
          previousPasswordHash,
          previousMustChangePassword,
        );
        throw error;
      }

      await this.logoutAll(user.id);

      return { sent: true, message: genericMessage };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `No se pudo procesar la recuperación de contraseña para ${normalizedEmail}: ${message}`,
      );
      return {
        sent: false,
        message: 'No se pudo procesar la solicitud. Intenta de nuevo más tarde',
      };
    }
  }

  private async storeAndSendVerificationCode(
    email: string,
    name: string,
  ): Promise<boolean> {
    const ttlMinutes = this.configService.get<number>(
      'EMAIL_VERIFICATION_CODE_TTL_MINUTES',
      15,
    );
    const code = generateVerificationCode(6);

    await this.redis.set(
      this.verificationKey(email),
      code,
      'EX',
      ttlMinutes * 60,
    );

    try {
      await this.mailService.sendVerificationCode({
        to: email,
        name,
        code,
        expiresInMinutes: ttlMinutes,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `No se pudo enviar el código de verificación a ${email}: ${message}`,
      );
      return false;
    }
  }

  private verificationKey(email: string): string {
    return `${EMAIL_VERIFICATION_KEY_PREFIX}${email.toLowerCase().trim()}`;
  }

  private codesMatch(storedCode: string, providedCode: string): boolean {
    const stored = Buffer.from(storedCode);
    const provided = Buffer.from(providedCode);
    return (
      stored.length === provided.length && timingSafeEqual(stored, provided)
    );
  }

  /**
   * Inicio de sesión con validación de bloqueos de IP y cuenta.
   */
  async login(dto: LoginDto, ctx: RequestContext): Promise<LoginResponse> {
    // 1. Validar que la IP no esté bloqueada
    await this.assertIpNotBlocked(ctx.ip);

    // 2. Buscar usuario por email (incluyendo passwordHash)
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      await this.registerIpFailure(ctx.ip);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Verificar si la cuenta está bloqueada
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      throw new HttpException(
        {
          message: `Cuenta bloqueada temporalmente por intentos fallidos. Intente de nuevo en ${remainingMinutes} minuto(s).`,
          retryAfterMinutes: remainingMinutes,
        },
        HttpStatus.LOCKED,
      );
    }

    // 4. Comparar contraseñas
    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      const nextAttempts = user.failedLoginAttempts + 1;
      const lockMinutes = this.computeAccountLock(nextAttempts);
      const lockedUntil = lockMinutes > 0 ? new Date(Date.now() + lockMinutes * 60000) : null;

      await this.usersService.registerFailedAttempt(user, lockedUntil);
      await this.registerIpFailure(ctx.ip);

      if (lockMinutes > 0) {
        throw new HttpException(
          {
            message: `Cuenta bloqueada temporalmente por superar intentos fallidos. Intente de nuevo en ${lockMinutes} minuto(s).`,
            retryAfterMinutes: lockMinutes,
          },
          HttpStatus.LOCKED,
        );
      }

      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 5. Credenciales correctas: reiniciar solo la cuenta (la IP no se reinicia)
    await this.usersService.resetFailedAttempts(user);

    // 6. El frontend debe verificar el correo antes de obtener tokens
    if (!user.emailVerified) {
      await this.storeAndSendVerificationCode(user.email, user.name);
      return { email: user.email, emailVerified: false };
    }

    // 7. Si debe cambiar la contraseña, se emiten tokens y el flag viaja en user
    return this.issueTokens(user, ctx);
  }

  /**
   * Emite access token (guardado en Redis) y refresh token (hash guardado en BD).
   */
  async issueTokens(
    user: User | Omit<User, 'passwordHash'>,
    ctx: RequestContext,
    familyId?: string,
  ): Promise<AuthTokensResponse> {
    const jti = randomUUID();
    const accessTtl = this.configService.get<number>('JWT_ACCESS_EXPIRES_SECONDS', 900);
    const refreshDays = this.configService.get<number>('JWT_REFRESH_EXPIRES_DAYS', 30);

    // Firmar Access Token JWT
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        jti,
      },
      {
        expiresIn: accessTtl,
      },
    );

    // Guardar en Redis auth:access:{jti} -> userId
    await this.redis.set(`auth:access:${jti}`, user.id, 'EX', accessTtl);

    // Guardar jti en el set de sesiones activas del usuario
    await this.redis.sadd(`auth:user-sessions:${user.id}`, jti);
    await this.redis.expire(`auth:user-sessions:${user.id}`, refreshDays * 86400);

    // Generar refresh token seguro (64 bytes aleatorios)
    const rawRefreshToken = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');

    const expiresAt = new Date(Date.now() + refreshDays * 86400 * 1000);
    const tokenFamilyId = familyId ?? randomUUID();

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      familyId: tokenFamilyId,
      tokenHash,
      expiresAt,
      ip: ctx.ip || '',
      userAgent: ctx.userAgent || '',
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: accessTtl,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        emailVerified: user.emailVerified ?? false,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    };
  }

  /**
   * Calcula los minutos de bloqueo progresivo según el número de intentos fallidos.
   */
  computeAccountLock(attempts: number): number {
    if (attempts < 5) return 0;
    if (attempts === 5 || attempts === 6) {
      return this.configService.get<number>('ACCOUNT_LOCK_5_MINUTES', 15);
    }
    if (attempts === 7) {
      return this.configService.get<number>('ACCOUNT_LOCK_7_MINUTES', 30);
    }
    if (attempts === 8) {
      return this.configService.get<number>('ACCOUNT_LOCK_8_MINUTES', 120);
    }
    return this.configService.get<number>('ACCOUNT_LOCK_9_PLUS_MINUTES', 300);
  }

  /**
   * Registra un fallo de IP en el sorted set temporal y activa o renueva bloqueo si supera 20 intentos.
   */
  async registerIpFailure(ip: string): Promise<void> {
    if (!ip) return;

    const windowMinutes = this.configService.get<number>('IP_LOCK_WINDOW_MINUTES', 5);
    const lockMinutes = this.configService.get<number>('IP_LOCK_MINUTES', 15);
    const windowMs = windowMinutes * 60 * 1000;
    const now = Date.now();

    const keyFails = `auth:ip-fails:${ip}`;
    const keyBlock = `auth:ip-block:${ip}`;
    const keyFlagged = `auth:ip-flagged:${ip}`;

    // 1. Agregar timestamp actual al sorted set
    await this.redis.zadd(keyFails, now, `${now}-${randomBytes(4).toString('hex')}`);

    // 2. Limpiar fallos anteriores a la ventana
    await this.redis.zremrangebyscore(keyFails, 0, now - windowMs);
    await this.redis.expire(keyFails, windowMinutes * 60);

    // 3. Contar intentos en la ventana
    const count = await this.redis.zcard(keyFails);

    const isFlagged = await this.redis.exists(keyFlagged);

    if (count >= 20 || isFlagged === 1) {
      // Bloquear o renovar bloqueo
      await this.redis.set(keyBlock, '1', 'EX', lockMinutes * 60);
      await this.redis.set(keyFlagged, '1', 'EX', (lockMinutes + windowMinutes) * 60);
    }
  }

  /**
   * Verifica si la IP está bloqueada. Si lo está, lanza 429 Too Many Requests con el tiempo restante.
   */
  async assertIpNotBlocked(ip: string): Promise<void> {
    if (!ip) return;

    const keyBlock = `auth:ip-block:${ip}`;
    const ttl = await this.redis.ttl(keyBlock);

    if (ttl > 0) {
      const remainingMinutes = Math.max(1, Math.ceil(ttl / 60));
      throw new HttpException(
        {
          message: `Demasiados intentos desde esta dirección IP. Intente de nuevo en ${remainingMinutes} minuto(s).`,
          retryAfterMinutes: remainingMinutes,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Refresco y rotación de tokens con detección de reutilización.
   */
  async refresh(rawRefreshToken: string, ctx: RequestContext): Promise<AuthTokensResponse> {
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');

    const token = await this.refreshTokenRepository.findOne({
      where: { tokenHash, isDeleted: false },
      relations: { user: true },
    });

    if (!token) {
      throw new UnauthorizedException('Token inválido');
    }

    // Detección de reutilización: si ya fue revocado, invalidar toda la familia
    if (token.revokedAt !== null) {
      await this.refreshTokenRepository.update(
        { familyId: token.familyId, isDeleted: false },
        { revokedAt: new Date() },
      );
      await this.logoutAll(token.userId);
      throw new UnauthorizedException('Token revocado. Reutilización detectada.');
    }

    // Validar expiración
    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException('Token expirado');
    }

    // Emitir nuevo par de tokens dentro de la misma familia
    const newTokens = await this.issueTokens(token.user, ctx, token.familyId);

    // Obtener el ID del nuevo refresh token para enlazarlo
    const newTokenHash = createHash('sha256').update(newTokens.refreshToken).digest('hex');
    const newSavedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash: newTokenHash, isDeleted: false },
    });

    // Revocar el token actual marcando replacedByTokenId
    token.revokedAt = new Date();
    token.replacedByTokenId = newSavedToken ? newSavedToken.id : null;
    await this.refreshTokenRepository.save(token);

    return newTokens;
  }

  /**
   * Cierre de sesión individual: elimina el access token de Redis y revoca el refresh token asociado.
   */
  async logout(userId: string, jti: string, rawRefreshToken?: string): Promise<{ message: string }> {
    if (jti) {
      await this.redis.del(`auth:access:${jti}`);
      await this.redis.srem(`auth:user-sessions:${userId}`, jti);
    }

    if (rawRefreshToken) {
      const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
      await this.refreshTokenRepository.update(
        { tokenHash, userId, isDeleted: false },
        { revokedAt: new Date() },
      );
    }

    return { message: 'Sesión cerrada correctamente' };
  }

  /**
   * Cierre de todas las sesiones: revoca todos los refresh tokens y elimina todos los access tokens en Redis.
   */
  async logoutAll(userId: string): Promise<{ message: string }> {
    // 1. Revocar todos los refresh tokens en base de datos
    await this.refreshTokenRepository.update(
      { userId, isDeleted: false },
      { revokedAt: new Date() },
    );

    // 2. Obtener y eliminar todos los JTI de Redis
    const sessionKey = `auth:user-sessions:${userId}`;
    const jtis = await this.redis.smembers(sessionKey);

    if (jtis && jtis.length > 0) {
      const keysToDelete = jtis.map((jti) => `auth:access:${jti}`);
      await this.redis.del(...keysToDelete);
    }

    await this.redis.del(sessionKey);

    return { message: 'Todas las sesiones activas han sido cerradas' };
  }
}
