import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import admin from 'firebase-admin';
import { DeviceToken } from './entities/device-token.entity.js';
import {
  FIREBASE_APP,
  DevicePlatform,
} from './notifications.constants.js';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
    @Inject(FIREBASE_APP)
    private readonly firebaseApp: admin.app.App,
  ) {}

  /**
   * Registra un token de dispositivo con lógica upsert.
   * Si el token ya existía asignado a otro usuario, se reasigna al usuario actual.
   */
  async registerDevice(
    userId: string,
    token: string,
    platform: DevicePlatform = DevicePlatform.ANDROID,
  ): Promise<DeviceToken> {
    const existing = await this.deviceTokenRepository.findOne({
      where: { token },
    });

    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      existing.isActive = true;
      existing.lastUsedAt = new Date();
      existing.isDeleted = false;
      existing.deletedAt = null;
      return this.deviceTokenRepository.save(existing);
    }

    const newDevice = this.deviceTokenRepository.create({
      userId,
      token,
      platform,
      isActive: true,
      lastUsedAt: new Date(),
    });

    return this.deviceTokenRepository.save(newDevice);
  }

  /**
   * Desactiva un token de dispositivo (isActive = false).
   */
  async unregisterDevice(userId: string, token: string): Promise<void> {
    const device = await this.deviceTokenRepository.findOne({
      where: { userId, token, isDeleted: false },
    });

    if (!device) {
      throw new NotFoundException('Dispositivo no encontrado');
    }

    device.isActive = false;
    await this.deviceTokenRepository.save(device);
  }

  /**
   * Envía una notificación push a todos los tokens activos del usuario mediante sendEachForMulticast.
   * Los tokens que reporten 'registration-token-not-registered' o 'invalid-registration-token' se desactivan.
   */
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<{ sentCount: number; failureCount: number }> {
    const activeDevices = await this.deviceTokenRepository.find({
      where: { userId, isActive: true, isDeleted: false },
    });

    if (activeDevices.length === 0) {
      return { sentCount: 0, failureCount: 0 };
    }

    const tokens = activeDevices.map((d) => d.token);

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data ?? {},
    };

    try {
      const response = await admin
        .messaging(this.firebaseApp)
        .sendEachForMulticast(message);

      const tokensToDeactivate: string[] = [];

      response.responses.forEach((res, index) => {
        if (!res.success && res.error) {
          const errorCode = res.error.code;
          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token'
          ) {
            tokensToDeactivate.push(tokens[index]);
          }
        }
      });

      if (tokensToDeactivate.length > 0) {
        await this.deviceTokenRepository.update(
          { token: In(tokensToDeactivate) },
          { isActive: false },
        );
      }

      return {
        sentCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      this.logger.error(
        'Error enviando notificaciones push a través de Firebase Admin:',
        error,
      );
      return { sentCount: 0, failureCount: tokens.length };
    }
  }
}
