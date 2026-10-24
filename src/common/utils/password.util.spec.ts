import { describe, it, expect } from 'vitest';
import {
  generateTemporaryPassword,
  generateVerificationCode,
} from './password.util.js';

describe('password.util', () => {
  it('genera un código de verificación de 6 dígitos', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateVerificationCode()).toMatch(/^\d{6}$/);
    }
  });

  it('genera una contraseña temporal de 8 caracteres con mayúscula, minúscula y número', () => {
    for (let i = 0; i < 20; i++) {
      const password = generateTemporaryPassword();
      expect(password).toHaveLength(8);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/\d/);
    }
  });

  it('rechaza longitudes menores a 3', () => {
    expect(() => generateTemporaryPassword(2)).toThrow();
  });
});
