import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { IsPublic, IS_PUBLIC_KEY } from './is-public.decorator.js';

describe('IsPublic decorator', () => {
  it('should set isPublic metadata to true on the route handler', () => {
    class TestController {
      @IsPublic()
      publicMethod() {}
    }

    const reflector = new Reflector();
    const handler = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'publicMethod',
    )?.value;

    const isPublic = reflector.get(IS_PUBLIC_KEY, handler);
    expect(isPublic).toBe(true);
  });
});
