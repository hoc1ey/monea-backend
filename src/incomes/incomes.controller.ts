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
import { IncomesService } from './incomes.service.js';
import { CreateIncomeDto } from './dto/create-income.dto.js';
import { UpdateIncomeDto } from './dto/update-income.dto.js';
import { QueryIncomeDto } from './dto/query-income.dto.js';
import {
  IncomeResponseDto,
  PaginatedIncomeResponseDto,
} from './dto/income-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Incomes')
@ApiBearerAuth()
@Controller('incomes')
export class IncomesController {
  constructor(private readonly incomesService: IncomesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo ingreso monetario' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Ingreso registrado correctamente',
    type: IncomeResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta bancaria no encontrada' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateIncomeDto,
  ) {
    return this.incomesService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar ingresos con paginación y filtros opcionales (cuenta, rango de fechas)',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Ingresos obtenidos correctamente',
    type: PaginatedIncomeResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: QueryIncomeDto,
  ) {
    return this.incomesService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener el detalle de un ingreso' })
  @ApiParam({ name: 'id', description: 'ID del ingreso (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Ingreso obtenido correctamente',
    type: IncomeResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Ingreso no encontrado' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.incomesService.findOne(userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Actualizar información de un ingreso (ingresos automáticos solo permiten nombre y descripción)',
  })
  @ApiParam({ name: 'id', description: 'ID del ingreso (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Ingreso actualizado correctamente',
    type: IncomeResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos inválidos o intento de modificar monto en ingreso automático' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Ingreso no encontrado' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateIncomeDto,
  ) {
    return this.incomesService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Eliminar lógicamente un ingreso (no permitido para ingresos de origen automático)',
  })
  @ApiParam({ name: 'id', description: 'ID del ingreso (UUID)' })
  @SwaggerApiResponse({ status: 200, description: 'Ingreso eliminado correctamente' })
  @SwaggerApiResponse({ status: 400, description: 'No se puede eliminar ingreso automático' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Ingreso no encontrado' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.incomesService.remove(userId, id);
  }
}
