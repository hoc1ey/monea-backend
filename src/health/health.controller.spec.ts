import { describe, it, expect, beforeEach } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('should return health check data with success message', () => {
    const result = controller.check();
    expect(result).toHaveProperty('data');
    expect(result.data.status).toBe('ok');
    expect(typeof result.data.uptime).toBe('number');
    expect(typeof result.data.timestamp).toBe('string');
    expect(result.message).toBe('Servicio operativo');
  });
});
