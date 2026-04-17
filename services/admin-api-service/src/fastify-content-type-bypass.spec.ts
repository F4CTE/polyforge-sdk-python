/**
 * Regression test for GHSA-247c-9743-5963 (CVE-2025-32442 follow-up).
 *
 * Fastify <= 5.8.4 allowed complete bypass of body schema validation by
 * prepending a space to the Content-Type header (e.g. " application/json").
 * The body was parsed as JSON but validation was skipped entirely.
 *
 * Fixed in fastify 5.8.5. This test verifies the bypass no longer works.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

describe("GHSA-247c-9743-5963 – Content-Type leading-space validation bypass", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();

    // Route with strict body schema: requires `name` (string) field.
    app.post(
      "/guarded",
      {
        schema: {
          body: {
            type: "object",
            required: ["name"],
            properties: { name: { type: "string" } },
            additionalProperties: false,
          },
        },
      },
      async (req) => {
        return { ok: true, body: req.body };
      },
    );

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("validates body normally with correct Content-Type", async () => {
    // Missing required `name` → should return 400
    const res = await app.inject({
      method: "POST",
      url: "/guarded",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ unexpected: true }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("does NOT bypass schema validation when Content-Type has a leading space", async () => {
    // Pre-5.8.5: this request returned 200 with validation silently skipped.
    // Post-5.8.5: the body must still satisfy the schema.
    const res = await app.inject({
      method: "POST",
      url: "/guarded",
      headers: { "content-type": " application/json" }, // leading space — the bypass vector
      payload: JSON.stringify({ unexpected: true }),
    });

    // Body is missing required `name` → schema validation must fire and reject it.
    expect(res.statusCode).toBe(400);
  });

  it("accepts valid body even with leading-space Content-Type", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/guarded",
      headers: { "content-type": " application/json" },
      payload: JSON.stringify({ name: "alice" }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, body: { name: "alice" } });
  });
});
