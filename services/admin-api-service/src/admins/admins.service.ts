import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaAdminService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";

@Injectable()
export class AdminsService {
  constructor(
    private readonly adminDb: PrismaAdminService,
    private readonly redis: RedisService,
  ) {}

  async findAll() {
    const admins = await this.adminDb.admin.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        active: true,
        createdAt: true,
        lastSeen: true,
      },
    });
    return admins;
  }

  async create(dto: CreateAdminDto) {
    const existing = await this.adminDb.admin.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException({
        code: "EMAIL_TAKEN",
        message: "An admin with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const admin = await this.adminDb.admin.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        passwordHash,
        role: dto.role,
        active: true,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        active: true,
        createdAt: true,
        lastSeen: true,
      },
    });

    return admin;
  }

  async update(id: string, requesterId: string, dto: UpdateAdminDto) {
    const admin = await this.findOrFail(id);

    // Cannot change your own role or deactivate yourself
    if (
      id === requesterId &&
      (dto.role !== undefined || dto.active === false)
    ) {
      throw new ForbiddenException({
        code: "SELF_MODIFY",
        message:
          "You cannot change your own role or deactivate your own account",
      });
    }

    const data: Record<string, unknown> = {};
    if (dto.displayName !== undefined) data["displayName"] = dto.displayName;
    if (dto.role !== undefined) data["role"] = dto.role;
    if (dto.active !== undefined) data["active"] = dto.active;
    if (dto.password !== undefined)
      data["passwordHash"] = await bcrypt.hash(dto.password, 12);

    const updated = await this.adminDb.admin.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        active: true,
        createdAt: true,
        lastSeen: true,
      },
    });

    // Invalidate all active sessions if role or active status changed
    if (dto.role !== undefined || dto.active !== undefined) {
      await this.invalidateAdminSessions(id);
    }

    return updated;
  }

  async deactivate(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new ForbiddenException({
        code: "SELF_DEACTIVATE",
        message: "You cannot deactivate your own account",
      });
    }

    await this.findOrFail(id);

    await this.adminDb.admin.update({
      where: { id },
      data: { active: false },
    });

    // Force-log the admin out immediately
    await this.invalidateAdminSessions(id);

    return { deactivated: true };
  }

  /** Scan and delete all Redis sessions belonging to the given admin ID. */
  private async invalidateAdminSessions(adminId: string): Promise<void> {
    const client = this.redis.getClient();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        "admin:session:*",
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        const values = await client.mget(...keys);
        const toDelete = keys.filter((_, i) => values[i] === adminId);
        if (toDelete.length > 0) {
          await client.del(...toDelete);
        }
      }
    } while (cursor !== "0");
  }

  private async findOrFail(id: string) {
    const admin = await this.adminDb.admin.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Admin not found",
      });
    }
    return admin;
  }
}
