import {
  Controller,
  Get,
  Post,
  Body,
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
import { TransfersService } from './transfers.service.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { QueryTransferDto } from './dto/query-transfer.dto.js';
import {
  TransferResponseDto,
  PaginatedTransferResponseDto,
} from './dto/transfer-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Transfers')
@ApiBearerAuth()
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Transferir dinero entre dos cuentas: genera un egreso en la origen y un ingreso en la destino',
  })
  @SwaggerApiResponse({
    status: 201,
    description: 'Transferencia registrada correctamente',
    type: TransferResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos o cuentas iguales' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTransferDto,
  ) {
    return this.transfersService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Listar transferencias con paginación y filtros opcionales (cuenta origen/destino, rango de fechas)',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Transferencias obtenidas correctamente',
    type: PaginatedTransferResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: QueryTransferDto,
  ) {
    return this.transfersService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener el detalle de una transferencia' })
  @ApiParam({ name: 'id', description: 'ID de la transferencia (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Transferencia obtenida correctamente',
    type: TransferResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Transferencia no encontrada' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.transfersService.findOne(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Eliminar lógicamente una transferencia junto con su egreso e ingreso asociados',
  })
  @ApiParam({ name: 'id', description: 'ID de la transferencia (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Transferencia eliminada correctamente',
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Transferencia no encontrada' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.transfersService.remove(userId, id);
  }
}
