import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service.js';
import { QueryReportDto } from './dto/query-report.dto.js';
import {
  MonthlySummaryResponseDto,
  MonthlyHistoryResponseDto,
  BalanceHistoryResponseDto,
} from './dto/report-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Sumatoria de ingresos y egresos del mes actual (por separado). Egresos incluyen diferidos',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Resumen mensual obtenido correctamente',
    type: MonthlySummaryResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'accountId inválido' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async getMonthlySummary(
    @CurrentUser('id') userId: string,
    @Query() query: QueryReportDto,
  ) {
    return this.reportsService.getMonthlySummary(userId, query);
  }

  @Get('monthly-history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Sumatoria mensual de ingresos y egresos del mes actual y los 4 meses anteriores. Egresos incluyen diferidos',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Historial mensual obtenido correctamente',
    type: MonthlyHistoryResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'accountId inválido' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async getMonthlyHistory(
    @CurrentUser('id') userId: string,
    @Query() query: QueryReportDto,
  ) {
    return this.reportsService.getMonthlyHistory(userId, query);
  }

  @Get('balance-history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Balance general de la(s) cuenta(s) al cierre del mes actual y los 4 meses anteriores (egresos CORRIENTE únicamente)',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Balance general obtenido correctamente',
    type: BalanceHistoryResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'accountId inválido' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async getBalanceHistory(
    @CurrentUser('id') userId: string,
    @Query() query: QueryReportDto,
  ) {
    return this.reportsService.getBalanceHistory(userId, query);
  }
}
