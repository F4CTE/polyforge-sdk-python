import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@polyforge/shared-db';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findByUsername(username: string) {
        return this.prisma.user.findUnique({
            where: { username },
        });
    }

    async findById(id: string) {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }

    async create(data: {
        email: string;
        password: string;
        username: string;
    }) {
        const existingEmail = await this.findByEmail(data.email);
        if (existingEmail) {
            throw new HttpException(
                { code: 'EMAIL_TAKEN', message: 'Email is already registered' },
                HttpStatus.CONFLICT,
            );
        }

        const existingUsername = await this.findByUsername(data.username);
        if (existingUsername) {
            throw new HttpException(
                { code: 'USERNAME_TAKEN', message: 'Username is already taken' },
                HttpStatus.CONFLICT,
            );
        }

        const passwordHash = await bcrypt.hash(data.password, 12);

        return this.prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                username: data.username,
                tosAcceptedAt: new Date(),
            },
        });
    }

    async validatePassword(user: { passwordHash: string }, password: string): Promise<boolean> {
        return bcrypt.compare(password, user.passwordHash);
    }
}
