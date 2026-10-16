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
import { LoansService } from './loans.service.js';
import { CreateLoanDto } from './dto/create-loan.dto.js';
import { UpdateLoanDto } from './dto/update-loan.dto.js';
import { QueryLoanDto } from './dto/query-loan.dto.js';
import { PayLoanInstallmentDto } from './dto/pay-installment.dto.js';
import {
  LoanResponseDto,
  PayLoanInstallmentResponseDto,
} from './dto/loan-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un préstamo (genera egreso y cuotas)' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Préstamo registrado correctamente',
    type: LoanResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLoanDto,
  ) {
    return this.loansService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar los préstamos del usuario (filtro opcional por estado)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Préstamos obtenidos correctamente',
    type: [LoanResponseDto],
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: QueryLoanDto,
  ) {
    return this.loansService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener el detalle de un préstamo con sus cuotas' })
  @ApiParam({ name: 'id', description: 'ID del préstamo (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Préstamo obtenido correctamente',
    type: LoanResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Préstamo no encontrado' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.loansService.findOne(userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar un préstamo' })
  @ApiParam({ name: 'id', description: 'ID del préstamo (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Préstamo actualizado correctamente',
    type: LoanResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Préstamo no encontrado' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateLoanDto,
  ) {
    return this.loansService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar lógicamente un préstamo' })
  @ApiParam({ name: 'id', description: 'ID del préstamo (UUID)' })
  @SwaggerApiResponse({ status: 200, description: 'Préstamo eliminado correctamente' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Préstamo no encontrado' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.loansService.remove(userId, id);
  }

  @Post(':id/installments/:installmentId/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pagar una cuota (crea un ingreso en la cuenta indicada)' })
  @ApiParam({ name: 'id', description: 'ID del préstamo (UUID)' })
  @ApiParam({ name: 'installmentId', description: 'ID de la cuota (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Cuota pagada correctamente',
    type: PayLoanInstallmentResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos o cuota ya pagada' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Préstamo, cuota o cuenta no encontrada' })
  async payInstallment(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('installmentId', new ParseUUIDPipe({ version: '4' }))
    installmentId: string,
    @Body() dto: PayLoanInstallmentDto,
  ) {
    return this.loansService.payInstallment(userId, id, installmentId, dto);
  }
}
