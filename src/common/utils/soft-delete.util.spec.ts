import { describe, it, expect, vi } from 'vitest';
import { softDelete } from './soft-delete.util.js';
import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

describe('softDelete util', () => {
  it('should successfully update record with isDeleted: true and deletedAt', async () => {
    const updateMock = vi.fn().mockResolvedValue({ affected: 1 });
    const mockRepo = {
      update: updateMock,
    } as unknown as Repository<any>;

    await expect(softDelete(mockRepo, 'item-uuid', 'user-uuid')).resolves.toBeUndefined();

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-uuid',
        userId: 'user-uuid',
        isDeleted: false,
      }),
      expect.objectContaining({
        isDeleted: true,
        deletedAt: expect.any(Date),
      }),
    );
  });

  it('should throw NotFoundException when affected is 0', async () => {
    const mockRepo = {
      update: vi.fn().mockResolvedValue({ affected: 0 }),
    } as unknown as Repository<any>;

    await expect(softDelete(mockRepo, 'item-uuid', 'user-uuid')).rejects.toThrow(
      NotFoundException,
    );
  });
});
