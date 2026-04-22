import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../src/app.js";
import { UpstreamConfigPage } from "../../../src/ui/app.js";

describe("frontend static app", () => {
  const uiRoot = path.resolve("dist/ui");
  const indexPath = path.join(uiRoot, "index.html");
  let previousIndexHtml: string | null = null;
  const provider = { generateImage: vi.fn() };
  const app = buildApp({ provider });

  beforeAll(async () => {
    await mkdir(uiRoot, { recursive: true });
    try {
      previousIndexHtml = await import("node:fs/promises").then(({ readFile }) =>
        readFile(indexPath, "utf8"),
      );
    } catch {
      previousIndexHtml = null;
    }

    await writeFile(indexPath, "<!DOCTYPE html><html><body><div>Upstream Config Center</div></body></html>");
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    if (previousIndexHtml === null) {
      await rm(indexPath, { force: true });
      return;
    }

    await writeFile(indexPath, previousIndexHtml);
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

describe("UpstreamConfigPage", () => {
  it("renders action controls and routing rules", () => {
    render(<UpstreamConfigPage />);

    expect(screen.getByRole("button", { name: "Add Channel" })).toBeInTheDocument();
    expect(
      screen.getByText(
        /models with the same display name are selected by descending numeric priority/i,
      ),
    ).toBeInTheDocument();
  });
});
