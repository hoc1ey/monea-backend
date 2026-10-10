import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorador para marcar endpoints como públicos (omite validación de JwtAuthGuard)
 */
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);
