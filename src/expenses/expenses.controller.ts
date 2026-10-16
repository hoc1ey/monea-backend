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
import { ExpensesService } from './expenses.service.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';
import { QueryExpenseDto } from './dto/query-expense.dto.js';
import { SetExpenseAmountDto } from './dto/set-amount.dto.js';
import {
  ExpenseResponseDto,
  PaginatedExpenseResponseDto,
} from './dto/expense-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo egreso corriente' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Egreso registrado correctamente',
    type: ExpenseResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Listar egresos con paginación y filtros (cuenta, tarjeta, método de pago, rango de fechas, monto pendiente)',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Egresos obtenidos correctamente',
    type: PaginatedExpenseResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: QueryExpenseDto,
  ) {
    return this.expensesService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener el detalle de un egreso' })
  @ApiParam({ name: 'id', description: 'ID del egreso (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Egreso obtenido correctamente',
    type: ExpenseResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Egreso no encontrado' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.expensesService.findOne(userId, id);
  }

  @Patch(':id/amount')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fijar el monto de un egreso variable (amountPending = true)',
  })
  @ApiParam({ name: 'id', description: 'ID del egreso (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Monto del egreso actualizado correctamente',
    type: ExpenseResponseDto,
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'El egreso no tiene el monto pendiente por definir',
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Egreso no encontrado' })
  async setAmount(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SetExpenseAmountDto,
  ) {
    return this.expensesService.setAmount(userId, id, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar un egreso' })
  @ApiParam({ name: 'id', description: 'ID del egreso (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Egreso actualizado correctamente',
    type: ExpenseResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos inválidos o egreso inmutable' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Egreso no encontrado' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar lógicamente un egreso (no permitido para egresos automáticos)',
  })
  @ApiParam({ name: 'id', description: 'ID del egreso (UUID)' })
  @SwaggerApiResponse({ status: 200, description: 'Egreso eliminado correctamente' })
  @SwaggerApiResponse({ status: 400, description: 'Egreso no eliminable' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Egreso no encontrado' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.expensesService.remove(userId, id);
  }
}
