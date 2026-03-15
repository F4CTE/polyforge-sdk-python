import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '@polyforge/shared-types';

function deriveUserStatus(user: {
    emailVerified: boolean;
    polymarketConnected: boolean;
    suspended: boolean;
}): string {
    if (user.suspended) return 'SUSPENDED';
    if (user.polymarketConnected) return 'CONNECTED';
    if (user.emailVerified) return 'VERIFIED';
    return 'UNVERIFIED';
}

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) { }

    async register(dto: RegisterDto) {
        const user = await this.usersService.create({
            email: dto.email,
            password: dto.password,
            username: dto.username,
        });

        const token = this.generateToken(user);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                status: deriveUserStatus(user),
                createdAt: user.createdAt,
            },
        };
    }

    async login(dto: LoginDto) {
        const user = await this.usersService.findByEmail(dto.email);

        if (!user || user.deleted) {
            throw new HttpException(
                { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
                HttpStatus.BAD_REQUEST,
            );
        }

        if (user.suspended) {
            throw new HttpException(
                { code: 'ACCOUNT_SUSPENDED', message: 'This account has been suspended' },
                HttpStatus.FORBIDDEN,
            );
        }

        const isValid = await this.usersService.validatePassword(user, dto.password);
        if (!isValid) {
            throw new HttpException(
                { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
                HttpStatus.BAD_REQUEST,
            );
        }

        if (user.totpEnabled) {
            if (!dto.totpCode) {
                throw new HttpException(
                    { code: 'TOTP_REQUIRED', message: '2FA code is required' },
                    HttpStatus.BAD_REQUEST,
                );
            }
            // TODO: validate TOTP code against user.totpSecret once 2FA is implemented
        }

        const token = this.generateToken(user);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                status: deriveUserStatus(user),
                polymarketConnected: user.polymarketConnected,
                emailVerified: user.emailVerified,
            },
            requiresTotp: user.totpEnabled,
        };
    }

    private generateToken(user: { id: string; email: string; username: string }): string {
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            username: user.username,
        };
        return this.jwtService.sign(payload);
    }
}
