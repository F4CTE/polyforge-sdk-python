import { PortfolioService } from "./portfolio.service";
declare class PnlQueryDto {
    period?: string;
    strategyId?: string;
}
export declare class PortfolioController {
    private readonly portfolio;
    constructor(portfolio: PortfolioService);
    getPortfolio(user: any): Promise<any>;
    getPnl(user: any, query: PnlQueryDto): Promise<any>;
}
export {};
//# sourceMappingURL=portfolio.controller.d.ts.map