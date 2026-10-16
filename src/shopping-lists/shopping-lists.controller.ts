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
import { ShoppingListsService } from './shopping-lists.service.js';
import { CreateShoppingListDto } from './dto/create-shopping-list.dto.js';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto.js';
import { QueryShoppingListDto } from './dto/query-shopping-list.dto.js';
import { CreateShoppingListItemDto } from './dto/create-shopping-list-item.dto.js';
import { UpdateShoppingListItemDto } from './dto/update-shopping-list-item.dto.js';
import { ToggleShoppingListItemCheckDto } from './dto/toggle-shopping-list-item-check.dto.js';
import { CloseShoppingListDto } from './dto/close-shopping-list.dto.js';
import {
  ShoppingListResponseDto,
  ShoppingListItemResponseDto,
  CloseShoppingListResponseDto,
} from './dto/shopping-list-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Shopping Lists')
@ApiBearerAuth()
@Controller('shopping-lists')
export class ShoppingListsController {
  constructor(private readonly shoppingListsService: ShoppingListsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una lista de compras con ítems iniciales opcionales' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Lista creada correctamente',
    type: ShoppingListResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateShoppingListDto,
  ) {
    return this.shoppingListsService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar las listas del usuario (filtro opcional por estado)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Listas obtenidas correctamente',
    type: [ShoppingListResponseDto],
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: QueryShoppingListDto,
  ) {
    return this.shoppingListsService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener el detalle de una lista con sus ítems' })
  @ApiParam({ name: 'id', description: 'ID de la lista (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Lista obtenida correctamente',
    type: ShoppingListResponseDto,
  })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Lista no encontrada' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.shoppingListsService.findOne(userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renombrar una lista abierta' })
  @ApiParam({ name: 'id', description: 'ID de la lista (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Lista actualizada correctamente',
    type: ShoppingListResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos inválidos o lista cerrada' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Lista no encontrada' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateShoppingListDto,
  ) {
    return this.shoppingListsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar lógicamente una lista y sus ítems' })
  @ApiParam({ name: 'id', description: 'ID de la lista (UUID)' })
  @SwaggerApiResponse({ status: 200, description: 'Lista eliminada correctamente' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Lista no encontrada' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.shoppingListsService.remove(userId, id);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Agregar un ítem a una lista abierta' })
  @ApiParam({ name: 'id', description: 'ID de la lista (UUID)' })
  @SwaggerApiResponse({
    status: 201,
    description: 'Ítem agregado correctamente',
    type: ShoppingListItemResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos inválidos o lista cerrada' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Lista no encontrada' })
  async addItem(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateShoppingListItemDto,
  ) {
    return this.shoppingListsService.addItem(userId, id, dto);
  }

  @Patch(':id/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar el nombre y/o precio de un ítem' })
  @ApiParam({ name: 'id', description: 'ID de la lista (UUID)' })
  @ApiParam({ name: 'itemId', description: 'ID del ítem (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Ítem actualizado correctamente',
    type: ShoppingListItemResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos inválidos o lista cerrada' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Lista o ítem no encontrado' })
  async updateItem(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: UpdateShoppingListItemDto,
  ) {
    return this.shoppingListsService.updateItem(userId, id, itemId, dto);
  }

  @Patch(':id/items/:itemId/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar o desmarcar un ítem como comprado' })
  @ApiParam({ name: 'id', description: 'ID de la lista (UUID)' })
  @ApiParam({ name: 'itemId', description: 'ID del ítem (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Ítem actualizado correctamente',
    type: ShoppingListItemResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Datos inválidos o lista cerrada' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Lista o ítem no encontrado' })
  async toggleItemCheck(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: ToggleShoppingListItemCheckDto,
  ) {
    return this.shoppingListsService.toggleItemCheck(userId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar lógicamente un ítem de una lista abierta' })
  @ApiParam({ name: 'id', description: 'ID de la lista (UUID)' })
  @ApiParam({ name: 'itemId', description: 'ID del ítem (UUID)' })
  @SwaggerApiResponse({ status: 200, description: 'Ítem eliminado correctamente' })
  @SwaggerApiResponse({ status: 400, description: 'La lista no está abierta' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Lista o ítem no encontrado' })
  async removeItem(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ) {
    return this.shoppingListsService.removeItem(userId, id, itemId);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cerrar la lista: valida precios/total (XOR), crea el egreso y traslada lo no comprado',
  })
  @ApiParam({ name: 'id', description: 'ID de la lista (UUID)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Lista cerrada correctamente',
    type: CloseShoppingListResponseDto,
  })
  @SwaggerApiResponse({ status: 400, description: 'Validación del cierre inválida' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Lista o cuenta no encontrada' })
  async close(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CloseShoppingListDto,
  ) {
    return this.shoppingListsService.close(userId, id, dto);
  }
}
