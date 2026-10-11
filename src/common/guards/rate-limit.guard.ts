import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface AuthenticatedUser {
  id: string;
  jti?: string;
}

/**
 * Guard de rate-limiting que selecciona el throttler correcto según si la ruta
 * es pública (strict) o autenticada (relaxed), y rastrea por IP o userId.
 *
 * La selección de throttler se realiza mediante `skipIf` configurado en AppModule:
 * - 'strict': se salta si el usuario está autenticado (req.user existe)
 * - 'relaxed': se salta si el usuario no está autenticado (ruta pública)
 *
 * Si RATE_LIMIT_ENABLED=false no aplica ningún límite.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env['RATE_LIMIT_ENABLED'] === 'false') {
      return true;
    }
    return super.canActivate(context);
  }

  /**
   * Tracker: userId para rutas autenticadas, IP para rutas públicas.
   */
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as AuthenticatedUser | undefined;

    if (user?.id) {
      return `user:${user.id}`;
    }

    const ip =
      (req['ip'] as string | undefined) ??
      ((req['socket'] as Record<string, unknown> | undefined)?.['remoteAddress'] as
        | string
        | undefined) ??
      'unknown';

    return ip;
  }
}
