import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../src/app.js";

describe("frontend static app", () => {
  const provider = { generateImage: vi.fn() };
  const app = buildApp({ provider });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves the frontend shell at /", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Upstream Config Center");
  });
});
