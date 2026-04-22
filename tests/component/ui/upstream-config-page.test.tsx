import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
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

  it("offers Volcengine Ark as a provider protocol", () => {
    render(<UpstreamConfigPage />);

    const [protocolSelect] = screen.getAllByLabelText("Protocol") as HTMLSelectElement[];
    const option = within(protocolSelect).getByRole("option", {
      name: "Volcengine Ark / 火山方舟",
    });

    expect(option).toHaveValue("volcengine-ark");
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

  it("adds a model directly inside a provider card", async () => {
    const user = userEvent.setup();

    render(<UpstreamConfigPage />);

    await user.click(screen.getByRole("button", { name: "Add Channel" }));
    const channelNameInputs = screen.getAllByLabelText("Channel Name");
    await user.clear(channelNameInputs.at(-1)!);
    await user.type(channelNameInputs.at(-1)!, "Provider Scoped Test");

    const quickAddInputs = screen.getAllByLabelText("Quick Add Provider Model");
    await user.type(quickAddInputs.at(-1)!, "doubao-seedream-4-0{enter}");

    const providerCard = screen
      .getByRole("heading", { name: "Provider Scoped Test" })
      .closest("article");

    expect(providerCard).toBeTruthy();

    const providerCardQueries = within(providerCard!);
    const providerCardDisplayNames = providerCardQueries.getAllByLabelText(
      "Provider Card Display Name",
    );
    const providerCardModelNames = providerCardQueries.getAllByLabelText("Provider Card Model Name");
    const priorityRows = screen.getAllByTestId("priority-row-doubao-seedream-4-0");

    expect(providerCardDisplayNames.at(-1)).toHaveValue("doubao-seedream-4-0");
    expect(providerCardModelNames.at(-1)).toHaveValue("doubao-seedream-4-0");
    expect(priorityRows[0]).toHaveTextContent("Provider Scoped Test");
  });

  it("reorders a duplicate display-name group by descending priority", async () => {
    const user = userEvent.setup();

    render(<UpstreamConfigPage />);

    const priorityInputs = screen.getAllByLabelText("Priority");
    await user.clear(priorityInputs[0]!);
    await user.type(priorityInputs[0]!, "1000");
    await user.clear(priorityInputs[1]!);
    await user.type(priorityInputs[1]!, "100");

    const rows = screen.getAllByTestId("priority-row-gpt-image-1");
    expect(rows[0]).toHaveTextContent("OpenAI Main");
    expect(within(rows[0]!).getByLabelText("Priority")).toHaveValue(1000);
    expect(rows[1]).toHaveTextContent("Azure Backup");
    expect(within(rows[1]!).getByLabelText("Priority")).toHaveValue(100);
  });
});
