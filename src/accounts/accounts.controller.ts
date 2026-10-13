import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';
import { AccountResponseDto } from './dto/account-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva cuenta bancaria' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Cuenta creada correctamente',
    type: AccountResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountsService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar cuentas bancarias activas del usuario con saldo calculado',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Cuentas obtenidas correctamente',
    type: [AccountResponseDto],
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async findAll(@CurrentUser('id') userId: string) {
    return this.accountsService.findAll(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener detalle de una cuenta bancaria con saldo calculado',
  })
  @ApiParam({ name: 'id', description: 'ID de la cuenta (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Cuenta obtenida correctamente',
    type: AccountResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.accountsService.findOne(userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar una cuenta bancaria (saldo inicial editable afecta saldo calculado)',
  })
  @ApiParam({ name: 'id', description: 'ID de la cuenta (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Cuenta actualizada correctamente',
    type: AccountResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar lógicamente una cuenta bancaria' })
  @ApiParam({ name: 'id', description: 'ID de la cuenta (UUID)' })
  @SwaggerApiResponse({ status: 200, description: 'Cuenta eliminada correctamente' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.accountsService.remove(userId, id);
  }
}
