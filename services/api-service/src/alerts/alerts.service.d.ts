import { PrismaService } from "@polyforge/shared-db";
import { CreateAlertDto } from "./dto/create-alert.dto";
export declare class AlertsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(userId: string): Promise<any[]>;
    create(userId: string, dto: CreateAlertDto): Promise<any>;
    remove(id: string, userId: string): Promise<void>;
}
//# sourceMappingURL=alerts.service.d.ts.map