import { BlockEvaluator, BlockResult } from "./block.types";

type BlockParams = Record<string, string | number | undefined>;

// game_started — fires when a game's status transitions to LIVE
export const GameStartedBlock: BlockEvaluator = {
  async evaluate(block, ctx, redis): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const eventTicker = String(params.eventTicker ?? "");
    if (!eventTicker) return { fired: false, reason: "no eventTicker" };

    const gameState = await redis.getJson<{
      status: string;
      prevStatus: string;
      updatedAt: number;
    }>(`cache:sports:game:${eventTicker}`);

    if (!gameState) return { fired: false, reason: "no game state cached" };

    const fired =
      gameState.status === "LIVE" &&
      gameState.prevStatus !== "LIVE" &&
      ctx.now - gameState.updatedAt < 120_000;

    return {
      fired,
      reason: fired
        ? `game started: ${eventTicker}`
        : `status: ${gameState.status}`,
      metadata: { eventTicker, status: gameState.status },
    };
  },
};

// pregame_window — fires N minutes before scheduled game start
export const PregameWindowBlock: BlockEvaluator = {
  async evaluate(block, ctx, _redis, prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const eventTicker = String(params.eventTicker ?? "");
    const minutesBefore = params.minutesBefore;
    if (!eventTicker || minutesBefore === undefined)
      return { fired: false, reason: "invalid config" };

    const event = await prisma.event.findUnique({
      where: { id: eventTicker },
      select: { startDate: true },
    });
    if (!event?.startDate)
      return { fired: false, reason: "no event or start date" };

    const windowMs = parseFloat(String(minutesBefore)) * 60_000;
    const timeToStart = event.startDate.getTime() - ctx.now;

    const fired = timeToStart > 0 && timeToStart <= windowMs;
    return {
      fired,
      reason: fired
        ? `${Math.round(timeToStart / 60_000)}m before game`
        : `game starts in ${Math.round(timeToStart / 60_000)}m`,
      metadata: {
        eventTicker,
        minutesToStart: Math.round(timeToStart / 60_000),
      },
    };
  },
};

// halftime — fires when game status transitions to HALFTIME
export const HalftimeBlock: BlockEvaluator = {
  async evaluate(block, ctx, redis): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const eventTicker = String(params.eventTicker ?? "");
    if (!eventTicker) return { fired: false, reason: "no eventTicker" };

    const gameState = await redis.getJson<{
      status: string;
      prevStatus: string;
      updatedAt: number;
    }>(`cache:sports:game:${eventTicker}`);

    if (!gameState) return { fired: false, reason: "no game state cached" };

    const fired =
      gameState.status === "HALFTIME" &&
      gameState.prevStatus !== "HALFTIME" &&
      ctx.now - gameState.updatedAt < 120_000;

    return {
      fired,
      reason: fired
        ? `halftime: ${eventTicker}`
        : `status: ${gameState.status}`,
      metadata: { eventTicker, status: gameState.status },
    };
  },
};

// sport_score_above — condition: checks if a team's score exceeds threshold
export const SportScoreAboveBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const eventTicker = String(params.eventTicker ?? "");
    const team = String(params.team ?? "home");
    const threshold = params.threshold;
    if (!eventTicker || threshold === undefined)
      return { fired: false, reason: "invalid config" };

    const scoreData = await redis.getJson<{
      homeScore: number;
      awayScore: number;
    }>(`cache:sports:score:${eventTicker}`);

    if (!scoreData) return { fired: false, reason: "no score data cached" };

    const score = team === "away" ? scoreData.awayScore : scoreData.homeScore;
    const thresh = parseFloat(String(threshold));
    const fired = score > thresh;

    return {
      fired,
      reason: fired
        ? `${team} score ${score} > ${thresh}`
        : `${team} score ${score} <= ${thresh}`,
      metadata: {
        eventTicker,
        team,
        score,
        threshold: thresh,
        homeScore: scoreData.homeScore,
        awayScore: scoreData.awayScore,
      },
    };
  },
};
