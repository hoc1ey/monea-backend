import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { AuthService } from '../auth/auth.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @SwaggerApiResponse({ status: 200, description: 'Perfil obtenido correctamente' })
  async getProfile(@CurrentUser('id') userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      data: user,
      message: 'Perfil obtenido correctamente',
    };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar perfil del usuario autenticado' })
  @SwaggerApiResponse({ status: 200, description: 'Perfil actualizado correctamente' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(userId, dto);
    return {
      data: updated,
      message: 'Perfil actualizado correctamente',
    };
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  @SwaggerApiResponse({ status: 200, description: 'Contraseña actualizada correctamente' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    const deleteAllSessions = dto.deleteAllSessions ?? true;

    await this.usersService.changePassword(
      userId,
      dto,
      deleteAllSessions
        ? (uid) => this.authService.logoutAll(uid).then(() => undefined)
        : undefined,
    );
    return {
      data: null,
      message: 'Contraseña actualizada correctamente',
    };
  }
}
