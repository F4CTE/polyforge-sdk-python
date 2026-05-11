import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapGracefulShutdown,
  GlobalExceptionFilter,
  PrismaExceptionFilter,
} from "./index";

function createHost() {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: "GET", url: "/test" }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, send };
}

describe("GlobalExceptionFilter", () => {
  it("maps Fastify CORS errors to a masked 403 with a request id", () => {
    const { host, status, send } = createHost();

    new GlobalExceptionFilter().catch(
      new Error("CORS: origin https://evil.example not allowed"),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        code: "CORS_FORBIDDEN",
        message: "Forbidden",
        requestId: expect.any(String),
      }),
    );
  });

  it("masks production 500 responses", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const { host, send } = createHost();

    try {
      new GlobalExceptionFilter().catch(new Error("secret details"), host);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      }),
    );
  });

  it("preserves application error codes and suggestions", () => {
    const { host, send } = createHost();
    const error = new HttpException(
      { code: "NOT_CONNECTED", message: "Missing credentials" },
      HttpStatus.BAD_REQUEST,
    );

    new GlobalExceptionFilter().catch(error, host);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "NOT_CONNECTED",
        message: "Missing credentials",
        suggestion:
          "Import Polymarket credentials in Settings > Trading Account",
      }),
    );
  });
});

describe("PrismaExceptionFilter", () => {
  it("maps P2002 unique constraint errors to conflict responses", () => {
    const { host, status, send } = createHost();
    const error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["email"] },
      },
    );

    new PrismaExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        code: "UNIQUE_CONSTRAINT_VIOLATION",
        message: "A resource with these unique fields already exists",
        requestId: expect.any(String),
      }),
    );
  });

  it("maps P2003 foreign key violations to 400", () => {
    const { host, status, send } = createHost();
    const error = new Prisma.PrismaClientKnownRequestError(
      "Foreign key constraint failed",
      {
        code: "P2003",
        clientVersion: "test",
        meta: { field_name: "user_id" },
      },
    );

    new PrismaExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        code: "FOREIGN_KEY_VIOLATION",
        message: "Referenced resource does not exist",
        requestId: expect.any(String),
      }),
    );
  });

  it("maps P2014 relation violations to 400", () => {
    const { host, status, send } = createHost();
    const error = new Prisma.PrismaClientKnownRequestError(
      "The change you are trying to make would violate the required relation",
      {
        code: "P2014",
        clientVersion: "test",
        meta: { relation_name: "UserToProfile" },
      },
    );

    new PrismaExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        code: "INVALID_RELATION",
        message: "The change would violate a required relation",
        requestId: expect.any(String),
      }),
    );
  });

  it("maps P2025 not-found errors to 404", () => {
    const { host, status, send } = createHost();
    const error = new Prisma.PrismaClientKnownRequestError(
      "Record to update not found",
      {
        code: "P2025",
        clientVersion: "test",
        meta: { cause: "Record to update not found or changed by another user" },
      },
    );

    new PrismaExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        code: "NOT_FOUND",
        message: "The requested resource does not exist",
        requestId: expect.any(String),
      }),
    );
  });

  it("masks production default errors", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const { host, status, send } = createHost();

    try {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Raw query failed",
        {
          code: "P2010",
          clientVersion: "test",
        },
      );

      new PrismaExceptionFilter().catch(error, host);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: "DATABASE_ERROR",
          message: "Internal server error",
          requestId: expect.any(String),
        }),
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("preserves error detail in non-production default messages", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const { host, status, send } = createHost();

    try {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Raw query failed",
        {
          code: "P2010",
          clientVersion: "test",
        },
      );

      new PrismaExceptionFilter().catch(error, host);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: "DATABASE_ERROR",
          message: "Raw query failed",
          requestId: expect.any(String),
        }),
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe("bootstrapGracefulShutdown", () => {
  it("enables Nest shutdown hooks and registers a SIGTERM handler", () => {
    const app = {
      enableShutdownHooks: vi.fn(),
      close: vi.fn(),
    };
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const once = vi
      .spyOn(process, "once")
      .mockImplementation(() => process as NodeJS.Process);

    try {
      bootstrapGracefulShutdown(app as any, logger);
      expect(app.enableShutdownHooks).toHaveBeenCalled();
      expect(once).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    } finally {
      once.mockRestore();
    }
  });
});
