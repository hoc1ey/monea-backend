import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import admin from 'firebase-admin';
import { FIREBASE_APP } from './notifications.constants.js';

export const firebaseProvider: Provider = {
  provide: FIREBASE_APP,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    if (admin.apps.length > 0) {
      return admin.app();
    }

    const base64 = configService.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64');
    if (!base64) {
      return admin.initializeApp({ projectId: 'moneo-dev' }, 'moneo-dev');
    }

    try {
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);

      if (
        serviceAccount.project_id &&
        serviceAccount.private_key &&
        serviceAccount.client_email
      ) {
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }

      return admin.initializeApp(
        { projectId: serviceAccount.project_id || 'moneo-dev' },
        'moneo-dev',
      );
    } catch (error) {
      console.warn(
        'Advertencia: No se pudo inicializar Firebase con las credenciales proporcionadas. Se inicializa en modo desarrollo:',
        error,
      );
      return admin.initializeApp({ projectId: 'moneo-dev' }, 'moneo-dev');
    }
  },
};
