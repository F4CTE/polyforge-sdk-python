// ─────────────────────────────────────────────────────────────────────────────
// Sports Markets — types for Kalshi sports trading module
// ─────────────────────────────────────────────────────────────────────────────

export enum SportsCategory {
  NFL = "NFL",
  NBA = "NBA",
  MLB = "MLB",
  NHL = "NHL",
  SOCCER = "SOCCER",
  MMA = "MMA",
  GOLF = "GOLF",
  TENNIS = "TENNIS",
  NCAA_FOOTBALL = "NCAA_FOOTBALL",
  NCAA_BASKETBALL = "NCAA_BASKETBALL",
  F1 = "F1",
  NASCAR = "NASCAR",
  BOXING = "BOXING",
  CRICKET = "CRICKET",
  RUGBY = "RUGBY",
  ESPORTS = "ESPORTS",
  OTHER = "OTHER",
}

export const SPORTS_SERIES_TICKERS: Record<SportsCategory, string[]> = {
  [SportsCategory.NFL]: ["NFL", "NFLSZN"],
  [SportsCategory.NBA]: ["NBA", "NBASZN"],
  [SportsCategory.MLB]: ["MLB", "MLBSZN"],
  [SportsCategory.NHL]: ["NHL", "NHLSZN"],
  [SportsCategory.SOCCER]: ["SOCCER", "EPL", "MLS", "UCL", "WORLDCUP"],
  [SportsCategory.MMA]: ["UFC", "MMA"],
  [SportsCategory.GOLF]: ["PGA", "GOLF"],
  [SportsCategory.TENNIS]: ["ATP", "WTA", "TENNIS"],
  [SportsCategory.NCAA_FOOTBALL]: ["NCAAF", "CFB"],
  [SportsCategory.NCAA_BASKETBALL]: ["NCAAB", "CBB", "MARCHMAD"],
  [SportsCategory.F1]: ["F1"],
  [SportsCategory.NASCAR]: ["NASCAR"],
  [SportsCategory.BOXING]: ["BOXING"],
  [SportsCategory.CRICKET]: ["CRICKET", "IPL"],
  [SportsCategory.RUGBY]: ["RUGBY"],
  [SportsCategory.ESPORTS]: ["ESPORTS", "LOL", "CSGO", "DOTA2"],
  [SportsCategory.OTHER]: [],
};

export const SPORTS_CATEGORY_LABELS: Record<SportsCategory, string> = {
  [SportsCategory.NFL]: "NFL Football",
  [SportsCategory.NBA]: "NBA Basketball",
  [SportsCategory.MLB]: "MLB Baseball",
  [SportsCategory.NHL]: "NHL Hockey",
  [SportsCategory.SOCCER]: "Soccer",
  [SportsCategory.MMA]: "MMA / UFC",
  [SportsCategory.GOLF]: "Golf",
  [SportsCategory.TENNIS]: "Tennis",
  [SportsCategory.NCAA_FOOTBALL]: "College Football",
  [SportsCategory.NCAA_BASKETBALL]: "College Basketball",
  [SportsCategory.F1]: "Formula 1",
  [SportsCategory.NASCAR]: "NASCAR",
  [SportsCategory.BOXING]: "Boxing",
  [SportsCategory.CRICKET]: "Cricket",
  [SportsCategory.RUGBY]: "Rugby",
  [SportsCategory.ESPORTS]: "Esports",
  [SportsCategory.OTHER]: "Other Sports",
};

export enum GameStatus {
  SCHEDULED = "SCHEDULED",
  PREGAME = "PREGAME",
  LIVE = "LIVE",
  HALFTIME = "HALFTIME",
  FINAL = "FINAL",
  POSTPONED = "POSTPONED",
  CANCELLED = "CANCELLED",
}

export interface SportEvent {
  eventTicker: string;
  title: string;
  category: SportsCategory;
  seriesTicker: string;
  startTime: string | null;
  endTime: string | null;
  gameStatus: GameStatus;
  marketCount: number;
}

export interface SportMarket {
  id: string;
  title: string;
  category: string;
  seriesSlug: string | null;
  eventTicker: string | null;
  endDate: string | null;
  closed: boolean;
  volume24h: string;
  yesPrice: string | null;
  noPrice: string | null;
}

export interface SportMilestone {
  id: string;
  eventTicker: string;
  description: string;
  status: string;
  value: unknown;
}

export interface SportLiveData {
  milestoneId: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface ComboCollection {
  collectionTicker: string;
  title: string;
  description: string | null;
  marketCount: number;
  seriesTicker: string | null;
}

export interface ComboLookupRequest {
  collectionTicker: string;
  selectedMarkets: Array<{
    marketTicker: string;
    eventTicker: string;
    side: "yes" | "no";
  }>;
}

export interface ComboLookupResponse {
  eventTicker: string;
  marketTicker: string;
}
