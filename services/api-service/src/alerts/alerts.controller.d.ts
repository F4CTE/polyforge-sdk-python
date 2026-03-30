import { AlertsService } from "./alerts.service";
import { CreateAlertDto } from "./dto/create-alert.dto";
export declare class AlertsController {
    private readonly alerts;
    constructor(alerts: AlertsService);
    list(user: any): Promise<any[]>;
    create(user: any, dto: CreateAlertDto): Promise<any>;
    remove(id: string, user: any): Promise<void>;
}
//# sourceMappingURL=alerts.controller.d.ts.map