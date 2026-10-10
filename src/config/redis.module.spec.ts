import { describe, it, expect } from 'vitest';
import { REDIS_CLIENT, RedisModule } from './redis.module.js';

describe('redis.module', () => {
  it('should define REDIS_CLIENT token', () => {
    expect(REDIS_CLIENT).toBe('REDIS_CLIENT');
  });

  it('should have RedisModule defined', () => {
    expect(RedisModule).toBeDefined();
  });
});
