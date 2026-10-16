import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { User } from './entities/user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

export function isValidIanaTimezone(tz: string): boolean {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    const supported = Intl.supportedValuesOf('timeZone');
    if (supported.includes(tz)) return true;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Crea un usuario verificando correo único y hasheando contraseña con argon2id.
   * No devuelve el passwordHash.
   */
  async create(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.userRepository.findOne({
      where: { email, isDeleted: false },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    if (dto.timezone && !isValidIanaTimezone(dto.timezone)) {
      throw new BadRequestException('Zona horaria inválida');
    }

    const defaultTz =
      this.configService.get<string>('DEFAULT_TIMEZONE') ?? 'America/Bogota';
    const timezone = dto.timezone ?? defaultTz;

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = this.userRepository.create({
      email,
      passwordHash,
      name: dto.name,
      timezone,
    });

    const saved = await this.userRepository.save(user);

    // Omitir passwordHash del resultado
    const { passwordHash: _, ...userWithoutPassword } = saved;
    return userWithoutPassword as Omit<User, 'passwordHash'>;
  }

  /**
   * Busca usuario por email incluyendo passwordHash (para autenticación).
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.toLowerCase().trim() })
      .andWhere('user.isDeleted = false')
      .getOne();
  }

  /**
   * Busca usuario por id excluyendo passwordHash.
   */
  async findById(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findOne({
      where: { id, isDeleted: false },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  /**
   * Actualiza el perfil del usuario (nombre y zona horaria).
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findById(userId);

    if (dto.timezone) {
      if (!isValidIanaTimezone(dto.timezone)) {
        throw new BadRequestException('Zona horaria inválida');
      }
      user.timezone = dto.timezone;
    }

    if (dto.name) {
      user.name = dto.name;
    }

    const updated = await this.userRepository.save(user as User);
    return updated;
  }

  /**
   * Cambia la contraseña del usuario previa validación de la contraseña actual.
   * Ejecuta opcionalmente un callback para revocar tokens de sesión.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    onPasswordChanged?: (userId: string) => Promise<void>,
  ): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .andWhere('user.isDeleted = false')
      .getOne();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isMatch = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!isMatch) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    user.passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.userRepository.save(user);

    if (onPasswordChanged) {
      await onPasswordChanged(userId);
    }

    return { message: 'Contraseña actualizada correctamente' };
  }

  /**
   * Incrementa el contador de intentos fallidos y actualiza la fecha de bloqueo si corresponde.
   */
  async registerFailedAttempt(user: User, lockedUntil: Date | null): Promise<void> {
    await this.userRepository.update(
      { id: user.id, isDeleted: false },
      {
        failedLoginAttempts: user.failedLoginAttempts + 1,
        lockedUntil,
      },
    );
  }

  /**
   * Reinicia intentos fallidos y actualiza fecha de último inicio de sesión.
   */
  async resetFailedAttempts(user: User): Promise<void> {
    await this.userRepository.update(
      { id: user.id, isDeleted: false },
      {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    );
  }
}
