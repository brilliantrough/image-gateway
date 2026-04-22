import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../src/app.js";

describe("frontend static app", () => {
  const uiRoot = path.resolve("dist/ui");
  const provider = { generateImage: vi.fn() };
  const app = buildApp({ provider });

  beforeAll(async () => {
    await mkdir(uiRoot, { recursive: true });
    await writeFile(
      path.join(uiRoot, "index.html"),
      "<!DOCTYPE html><html><body><div>Upstream Config Center</div></body></html>",
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await rm(uiRoot, { recursive: true, force: true });
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
