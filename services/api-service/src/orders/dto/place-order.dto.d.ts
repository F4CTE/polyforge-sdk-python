export declare enum OrderSideDto {
    BUY = "BUY",
    SELL = "SELL"
}
export declare enum OrderOutcomeDto {
    YES = "YES",
    NO = "NO"
}
export declare enum OrderTypeDto {
    GTC = "GTC",
    FOK = "FOK",
    GTD = "GTD"
}
export declare class PlaceOrderDto {
    tokenId: string;
    side: OrderSideDto;
    outcome: OrderOutcomeDto;
    size: number;
    price: number;
    orderType?: OrderTypeDto;
}
//# sourceMappingURL=place-order.dto.d.ts.map