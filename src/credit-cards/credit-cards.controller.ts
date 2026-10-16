import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
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
import { CreditCardBillingService } from './credit-card-billing.service.js';
import { CreateCreditCardDto } from './dto/create-credit-card.dto.js';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto.js';
import { CreditCardResponseDto } from './dto/credit-card-response.dto.js';
import { ReportQueryDto } from './dto/report-query.dto.js';
import { ReportRangeQueryDto } from './dto/report-range-query.dto.js';
import { PayCreditCardDto } from './dto/pay-credit-card.dto.js';
import { CreditCardPaymentResponseDto } from './dto/credit-card-payment-response.dto.js';
import {
  CreditCardMonthlyReportResponseDto,
  CreditCardRangeReportResponseDto,
  CreditCardDebtResponseDto,
} from './dto/credit-card-report-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Credit Cards')
@ApiBearerAuth()
@Controller('credit-cards')
export class CreditCardsController {
  constructor(
    private readonly creditCardsService: CreditCardsService,
    private readonly creditCardBillingService: CreditCardBillingService,
  ) {}

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

  @Get(':id/report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reporte mensual de deuda de la tarjeta para un periodo' })
  @ApiParam({ name: 'id', description: 'ID de la tarjeta (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Reporte generado',
    type: CreditCardMonthlyReportResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Periodo inválido' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Tarjeta no encontrada' })
  async getReport(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: ReportQueryDto,
  ) {
    const data = await this.creditCardBillingService.getMonthlyReport(
      userId,
      id,
      query.period,
    );
    return { data, message: 'Reporte generado' };
  }

  @Get(':id/report/range')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reporte mes a mes de deuda de la tarjeta en un rango' })
  @ApiParam({ name: 'id', description: 'ID de la tarjeta (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Reporte generado',
    type: CreditCardRangeReportResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Rango inválido' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Tarjeta no encontrada' })
  async getRangeReport(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: ReportRangeQueryDto,
  ) {
    const data = await this.creditCardBillingService.getRangeReport(
      userId,
      id,
      query.from,
      query.to,
    );
    return { data, message: 'Reporte generado' };
  }

  @Get(':id/debt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deuda actual y cupo disponible de la tarjeta' })
  @ApiParam({ name: 'id', description: 'ID de la tarjeta (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Deuda obtenida correctamente',
    type: CreditCardDebtResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Tarjeta no encontrada' })
  async getDebt(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const data = await this.creditCardBillingService.getCurrentDebt(userId, id);
    return { data, message: 'Deuda obtenida correctamente' };
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Marcar un periodo de la tarjeta como pagado generando un egreso',
  })
  @ApiParam({ name: 'id', description: 'ID de la tarjeta (UUID)' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Tarjeta pagada correctamente',
    type: CreditCardPaymentResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Periodo inválido o sin deuda' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Tarjeta o cuenta no encontrada' })
  @SwaggerApiResponse({ status: 409, description: 'El periodo ya fue pagado' })
  async pay(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PayCreditCardDto,
  ) {
    const data = await this.creditCardBillingService.markPeriodAsPaid(userId, id, {
      accountId: dto.accountId,
      period: dto.period,
    });
    return { data, message: 'Tarjeta pagada correctamente' };
  }
}
