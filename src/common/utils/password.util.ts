import { randomInt } from 'crypto';

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALL_CHARACTERS = `${LOWERCASE}${UPPERCASE}${DIGITS}`;

function pickRandom(characters: string): string {
  return characters[randomInt(0, characters.length)];
}

/**
 * Genera un código numérico aleatorio (por defecto de 6 dígitos).
 */
export function generateVerificationCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += pickRandom(DIGITS);
  }
  return code;
}

/**
 * Genera una contraseña temporal que siempre incluye al menos una minúscula,
 * una mayúscula y un dígito.
 */
export function generateTemporaryPassword(length = 8): string {
  if (length < 3) {
    throw new Error('La longitud mínima de la contraseña temporal es 3');
  }

  const characters = [
    pickRandom(LOWERCASE),
    pickRandom(UPPERCASE),
    pickRandom(DIGITS),
  ];

  while (characters.length < length) {
    characters.push(pickRandom(ALL_CHARACTERS));
  }

  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }

  return characters.join('');
}
