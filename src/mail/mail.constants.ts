import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const MAIL_MODULE_DIR = dirname(fileURLToPath(import.meta.url));

export const MAIL_TEMPLATES_DIR = join(MAIL_MODULE_DIR, 'templates');
export const MAIL_ASSETS_DIR = join(MAIL_MODULE_DIR, 'assets');
export const MAIL_LOGO_CID = 'monea-logo';
