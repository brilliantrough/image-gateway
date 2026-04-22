import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../src/app.js";
import { UpstreamConfigPage } from "../../../src/ui/app.js";

afterEach(() => {
  cleanup();
});

describe("frontend static app", () => {
  const provider = { generateImage: vi.fn() };
  let uiRoot = "";
  let app = buildApp({ provider, uiRoot: path.resolve("dist/ui") });

  beforeAll(async () => {
    uiRoot = await mkdtemp(path.join(os.tmpdir(), "image-gateway-ui-"));
    const indexPath = path.join(uiRoot, "index.html");
    app = buildApp({ provider, uiRoot });
    await writeFile(indexPath, "<!DOCTYPE html><html><body><div>Upstream Config Center</div></body></html>");
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

  it("adds a channel and requires a custom protocol name", async () => {
    const user = userEvent.setup();

    render(<UpstreamConfigPage />);

    await user.click(screen.getByRole("button", { name: "Add Channel" }));
    const protocolSelect = screen.getAllByLabelText("Protocol").at(-1);
    expect(protocolSelect).toBeTruthy();
    await user.selectOptions(protocolSelect!, "custom");
    await user.tab();

    expect(screen.getAllByText(/requires a custom protocol name/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Validation failed")).toBeInTheDocument();
  });

  it("adds a model row tied to an existing channel", async () => {
    const user = userEvent.setup();

    render(<UpstreamConfigPage />);

    await user.click(screen.getByRole("button", { name: "Add Channel" }));
    const channelNameInputs = screen.getAllByLabelText("Channel Name");
    await user.clear(channelNameInputs.at(-1)!);
    await user.type(channelNameInputs.at(-1)!, "Stability Proxy");

    const displayNamesBefore = screen.getAllByLabelText("Display Name");
    const modelChannelsBefore = screen.getAllByLabelText("Model Channel");

    await user.click(screen.getByRole("button", { name: "Add Model" }));

    const displayNamesAfter = screen.getAllByLabelText("Display Name");
    const modelChannelsAfter = screen.getAllByLabelText("Model Channel");
    const newModelChannel = modelChannelsAfter.at(-1) as HTMLSelectElement;

    expect(displayNamesAfter).toHaveLength(displayNamesBefore.length + 1);
    expect(modelChannelsAfter).toHaveLength(modelChannelsBefore.length + 1);
    expect(newModelChannel.value).not.toBe("");
    expect(newModelChannel.selectedOptions[0]?.textContent).toBe("Stability Proxy");
  });
});
