import { Repository, ObjectLiteral, FindOptionsWhere } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

/**
 * Realiza un borrado lógico actualizando isDeleted: true y deletedAt: new Date().
 * Si el registro no existe o no pertenece al usuario, lanza NotFoundException.
 */
export async function softDelete<T extends ObjectLiteral>(
  repo: Repository<T>,
  id: string,
  userId: string,
): Promise<void> {
  const criteria = {
    id,
    userId,
    isDeleted: false,
  } as unknown as FindOptionsWhere<T>;

  const updateData = {
    isDeleted: true,
    deletedAt: new Date(),
  } as unknown as Partial<T>;

  const result = await repo.update(criteria, updateData);

  if (!result.affected) {
    throw new NotFoundException('Recurso no encontrado');
  }
}
