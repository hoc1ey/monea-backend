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
import { RecurringExpensesService } from './recurring-expenses.service.js';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto.js';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto.js';
import { SetRecurringExpenseActiveDto } from './dto/set-active.dto.js';
import { RecurringExpenseConfigResponseDto } from './dto/recurring-expense-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Recurring Expenses')
@ApiBearerAuth()
@Controller('recurring-expenses')
export class RecurringExpensesController {
  constructor(
    private readonly recurringExpensesService: RecurringExpensesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una configuración de egreso recurrente' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Configuración de egreso recurrente creada',
    type: RecurringExpenseConfigResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRecurringExpenseDto,
  ) {
    return this.recurringExpensesService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar las configuraciones de egresos recurrentes' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Configuraciones de egresos recurrentes obtenidas correctamente',
    type: [RecurringExpenseConfigResponseDto],
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async findAll(@CurrentUser('id') userId: string) {
    return this.recurringExpensesService.findAll(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener el detalle de una configuración' })
  @ApiParam({ name: 'id', description: 'ID de la configuración (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Configuración de egreso recurrente obtenida correctamente',
    type: RecurringExpenseConfigResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Configuración no encontrada' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recurringExpensesService.findOne(userId, id);
  }

  @Patch(':id/active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar o desactivar una configuración' })
  @ApiParam({ name: 'id', description: 'ID de la configuración (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Configuración activada o desactivada correctamente',
    type: RecurringExpenseConfigResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Configuración no encontrada' })
  async setActive(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SetRecurringExpenseActiveDto,
  ) {
    return this.recurringExpensesService.setActive(userId, id, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar una configuración de egreso recurrente' })
  @ApiParam({ name: 'id', description: 'ID de la configuración (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Configuración de egreso recurrente actualizada correctamente',
    type: RecurringExpenseConfigResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Configuración no encontrada' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateRecurringExpenseDto,
  ) {
    return this.recurringExpensesService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar lógicamente una configuración' })
  @ApiParam({ name: 'id', description: 'ID de la configuración (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Configuración de egreso recurrente eliminada correctamente',
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Configuración no encontrada' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recurringExpensesService.remove(userId, id);
  }
}
