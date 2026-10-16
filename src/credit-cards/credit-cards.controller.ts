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
import { CreditCardsService } from './credit-cards.service.js';
import { CreateCreditCardDto } from './dto/create-credit-card.dto.js';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto.js';
import { CreditCardResponseDto } from './dto/credit-card-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Credit Cards')
@ApiBearerAuth()
@Controller('credit-cards')
export class CreditCardsController {
  constructor(private readonly creditCardsService: CreditCardsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar una nueva tarjeta de crédito' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Tarjeta creada correctamente',
    type: CreditCardResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCreditCardDto,
  ) {
    return this.creditCardsService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar las tarjetas de crédito del usuario' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Tarjetas obtenidas correctamente',
    type: CreditCardResponseDto,
    isArray: true,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async findAll(@CurrentUser('id') userId: string) {
    return this.creditCardsService.findAll(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener el detalle de una tarjeta de crédito' })
  @ApiParam({ name: 'id', description: 'ID de la tarjeta (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Tarjeta obtenida correctamente',
    type: CreditCardResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Tarjeta no encontrada' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.creditCardsService.findOne(userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar una tarjeta de crédito y sus recordatorios' })
  @ApiParam({ name: 'id', description: 'ID de la tarjeta (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Tarjeta actualizada correctamente',
    type: CreditCardResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Tarjeta no encontrada' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCreditCardDto,
  ) {
    return this.creditCardsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar lógicamente una tarjeta de crédito y cancelar sus recordatorios',
  })
  @ApiParam({ name: 'id', description: 'ID de la tarjeta (UUID)' })
  @SwaggerApiResponse({ status: 200, description: 'Tarjeta eliminada correctamente' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Tarjeta no encontrada' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.creditCardsService.remove(userId, id);
  }
}
