import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, getApps, getApp, type App } from 'firebase-admin/app';
import { FIREBASE_APP } from './notifications.constants.js';

export const firebaseProvider: Provider = {
  provide: FIREBASE_APP,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): App => {
    const apps = getApps();
    if (apps.length > 0) {
      return getApp();
    }

    const base64 = configService.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64');
    if (!base64) {
      return initializeApp({ projectId: 'moneo-dev' }, 'moneo-dev');
    }

    try {
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);

      if (
        serviceAccount.project_id &&
        serviceAccount.private_key &&
        serviceAccount.client_email
      ) {
        return initializeApp({
          credential: cert(serviceAccount),
        });
      }

      return initializeApp(
        { projectId: serviceAccount.project_id || 'moneo-dev' },
        'moneo-dev',
      );
    } catch (error) {
      console.warn(
        'Advertencia: No se pudo inicializar Firebase con las credenciales proporcionadas. Se inicializa en modo desarrollo:',
        error,
      );
      return initializeApp({ projectId: 'moneo-dev' }, 'moneo-dev');
    }
  },
};
