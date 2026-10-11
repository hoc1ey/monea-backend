import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { LogoutDto } from './dto/logout.dto.js';
import { IsPublic } from '../common/decorators/is-public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @IsPublic()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  @SwaggerApiResponse({ status: 201, description: 'Usuario registrado correctamente' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const tokens = await this.authService.register(dto, {
      ip: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
    return {
      data: tokens,
      message: 'Usuario registrado correctamente',
    };
  }

  @IsPublic()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener tokens' })
  @SwaggerApiResponse({ status: 200, description: 'Sesión iniciada correctamente' })
  @SwaggerApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @SwaggerApiResponse({ status: 423, description: 'Cuenta bloqueada temporalmente' })
  @SwaggerApiResponse({ status: 429, description: 'IP bloqueada por demasiados intentos' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const tokens = await this.authService.login(dto, {
      ip: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
    return {
      data: tokens,
      message: 'Sesión iniciada correctamente',
    };
  }

  @IsPublic()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar tokens usando el refresh token' })
  @SwaggerApiResponse({ status: 200, description: 'Tokens renovados correctamente' })
  @SwaggerApiResponse({ status: 401, description: 'Refresh token inválido, expirado o revocado' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const tokens = await this.authService.refresh(dto.refreshToken, {
      ip: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
    return {
      data: tokens,
      message: 'Tokens renovados correctamente',
    };
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión actual' })
  @SwaggerApiResponse({ status: 200, description: 'Sesión cerrada correctamente' })
  async logout(
    @CurrentUser('id') userId: string,
    @CurrentUser('jti') jti: string,
    @Body() dto: LogoutDto,
  ) {
    const result = await this.authService.logout(userId, jti, dto.refreshToken);
    return {
      data: null,
      message: result.message,
    };
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar todas las sesiones activas' })
  @SwaggerApiResponse({ status: 200, description: 'Todas las sesiones cerradas correctamente' })
  async logoutAll(@CurrentUser('id') userId: string) {
    const result = await this.authService.logoutAll(userId);
    return {
      data: null,
      message: result.message,
    };
  }
}
