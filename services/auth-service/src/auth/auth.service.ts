import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '@polyforge/shared-types';
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
            },
        };
    }

    async login(dto: LoginDto) {
        const user = await this.usersService.findByEmail(dto.email);

        if (!user || user.deleted || user.suspended) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isValid = await this.usersService.validatePassword(user, dto.password);
        if (!isValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const token = this.generateToken(user);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
            },
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