import {
  Injectable,
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
import { randomBytes, randomUUID, createHash } from 'crypto';
import * as argon2 from 'argon2';
import { REDIS_CLIENT } from '../config/redis.module.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

export interface RequestContext {
  ip: string;
  userAgent: string;
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
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  /**
   * Registro de un nuevo usuario con emisión de tokens.
   */
  async register(dto: RegisterDto, ctx: RequestContext): Promise<AuthTokensResponse> {
    const user = await this.usersService.create(dto);
    return this.issueTokens(user as User, ctx);
  }

  /**
   * Inicio de sesión con validación de bloqueos de IP y cuenta.
   */
  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthTokensResponse> {
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

    // 5. Login exitoso: reiniciar solo la cuenta (la IP no se reinicia)
    await this.usersService.resetFailedAttempts(user);

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
