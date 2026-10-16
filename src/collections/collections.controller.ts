import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
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
import { CollectionsService } from './collections.service.js';
import { CreateCollectionDto } from './dto/create-collection.dto.js';
import { UpdateCollectionDto } from './dto/update-collection.dto.js';
import { QueryCollectionDto } from './dto/query-collection.dto.js';
import { PayCollectionInstallmentDto } from './dto/pay-installment.dto.js';
import {
  CollectionResponseDto,
  PayCollectionInstallmentResponseDto,
} from './dto/collection-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Collections')
@ApiBearerAuth()
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un cobro con su plan de cuotas' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Cobro registrado correctamente',
    type: CollectionResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.collectionsService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar los cobros del usuario (filtro opcional por estado)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Cobros obtenidos correctamente',
    type: [CollectionResponseDto],
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: QueryCollectionDto,
  ) {
    return this.collectionsService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener el detalle de un cobro con sus cuotas' })
  @ApiParam({ name: 'id', description: 'ID del cobro (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Cobro obtenido correctamente',
    type: CollectionResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cobro no encontrado' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.collectionsService.findOne(userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar un cobro' })
  @ApiParam({ name: 'id', description: 'ID del cobro (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Cobro actualizado correctamente',
    type: CollectionResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cobro no encontrado' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar lógicamente un cobro' })
  @ApiParam({ name: 'id', description: 'ID del cobro (UUID)' })
  @SwaggerApiResponse({ status: 200, description: 'Cobro eliminado correctamente' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cobro no encontrado' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.collectionsService.remove(userId, id);
  }

  @Post(':id/installments/:installmentId/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pagar una cuota (crea un ingreso en la cuenta indicada)' })
  @ApiParam({ name: 'id', description: 'ID del cobro (UUID)' })
  @ApiParam({ name: 'installmentId', description: 'ID de la cuota (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Cuota pagada correctamente',
    type: PayCollectionInstallmentResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos o cuota ya pagada' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cobro, cuota o cuenta no encontrada' })
  async payInstallment(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('installmentId', new ParseUUIDPipe({ version: '4' }))
    installmentId: string,
    @Body() dto: PayCollectionInstallmentDto,
  ) {
    return this.collectionsService.payInstallment(
      userId,
      id,
      installmentId,
      dto,
    );
  }
}
