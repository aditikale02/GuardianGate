import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

let app: any;

beforeAll(async () => {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/guardian_gate";
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || "12345678901234567890123456789012";
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || "12345678901234567890123456789012";
  process.env.QR_SECRET = process.env.QR_SECRET || "12345678901234567890123456789012";

  app = (await import("../src/app")).default;
});

describe("API health", () => {
  it("responds with 200 and ok status", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
