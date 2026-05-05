import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@polyforge/shared-db", () => ({
  PrismaService: class PrismaService {},
}));

import { NotificationsService } from "./notifications.service";

function makePrisma() {
  return {
    notificationHistory: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

describe("NotificationsService", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new NotificationsService(prisma as any);
  });

  it("paginates notification history for the current user", async () => {
    const rows = [
      { id: "n-3", userId: "user-1", sentAt: new Date("2026-01-03") },
      { id: "n-2", userId: "user-1", sentAt: new Date("2026-01-02") },
    ];
    prisma.notificationHistory.findMany.mockResolvedValue(rows);
    prisma.notificationHistory.count.mockResolvedValue(6);

    const result = await service.list("user-1", 2, 2);

    expect(result).toEqual({
      data: rows,
      total: 6,
      page: 2,
      limit: 2,
      totalPages: 3,
      hasNext: true,
    });
    expect(prisma.notificationHistory.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { sentAt: "desc" },
      skip: 2,
      take: 2,
    });
  });

  it("scopes both data and count queries to the supplied user id", async () => {
    await service.list("user-2", 1, 20);

    expect(prisma.notificationHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-2" } }),
    );
    expect(prisma.notificationHistory.count).toHaveBeenCalledWith({
      where: { userId: "user-2" },
    });
  });

  it("returns an empty first page when the user has no notifications", async () => {
    const result = await service.list("user-empty", 1, 50);

    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
      hasNext: false,
    });
  });
});
