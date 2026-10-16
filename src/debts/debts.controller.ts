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
import { DebtsService } from './debts.service.js';
import { CreateDebtDto } from './dto/create-debt.dto.js';
import { UpdateDebtDto } from './dto/update-debt.dto.js';
import { QueryDebtDto } from './dto/query-debt.dto.js';
import { PayDebtInstallmentDto } from './dto/pay-installment.dto.js';
import {
  DebtResponseDto,
  PayDebtInstallmentResponseDto,
} from './dto/debt-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Debts')
@ApiBearerAuth()
@Controller('debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar una deuda con su plan de cuotas' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Deuda registrada correctamente',
    type: DebtResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDebtDto,
  ) {
    return this.debtsService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar las deudas del usuario (filtro opcional por estado)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Deudas obtenidas correctamente',
    type: [DebtResponseDto],
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: QueryDebtDto,
  ) {
    return this.debtsService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener el detalle de una deuda con sus cuotas' })
  @ApiParam({ name: 'id', description: 'ID de la deuda (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Deuda obtenida correctamente',
    type: DebtResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Deuda no encontrada' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.debtsService.findOne(userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar una deuda' })
  @ApiParam({ name: 'id', description: 'ID de la deuda (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Deuda actualizada correctamente',
    type: DebtResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Deuda no encontrada' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.debtsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar lógicamente una deuda' })
  @ApiParam({ name: 'id', description: 'ID de la deuda (UUID)' })
  @SwaggerApiResponse({ status: 200, description: 'Deuda eliminada correctamente' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Deuda no encontrada' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.debtsService.remove(userId, id);
  }

  @Post(':id/installments/:installmentId/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pagar una cuota (crea un egreso en la cuenta indicada)' })
  @ApiParam({ name: 'id', description: 'ID de la deuda (UUID)' })
  @ApiParam({ name: 'installmentId', description: 'ID de la cuota (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Cuota pagada correctamente',
    type: PayDebtInstallmentResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos o cuota ya pagada' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Deuda, cuota o cuenta no encontrada' })
  async payInstallment(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('installmentId', new ParseUUIDPipe({ version: '4' }))
    installmentId: string,
    @Body() dto: PayDebtInstallmentDto,
  ) {
    return this.debtsService.payInstallment(userId, id, installmentId, dto);
  }
}
