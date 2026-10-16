import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';

describe('Arranque con .env incompleto (e2e)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('impide el arranque cuando una variable obligatoria es inválida', async () => {
    vi.stubEnv('DATABASE_URL', 'no-es-una-url-de-postgres');

    const { AppModule } = await import('./../src/app.module.js');

    await expect(
      Test.createTestingModule({ imports: [AppModule] }).compile(),
    ).rejects.toThrow(/Configuración de entorno inválida/);
  });
});
