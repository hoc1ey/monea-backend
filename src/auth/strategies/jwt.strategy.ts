import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../config/redis.module.js';

export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub || !payload.jti) {
      throw new UnauthorizedException('Token inválido');
    }

    // Verifica que la clave auth:access:{jti} exista en Redis (si no, 401)
    const sessionUserId = await this.redis.get(`auth:access:${payload.jti}`);
    if (!sessionUserId || sessionUserId !== payload.sub) {
      throw new UnauthorizedException('Sesión expirada o revocada');
    }

    return {
      id: payload.sub,
      email: payload.email,
      jti: payload.jti,
    };
  }
}
