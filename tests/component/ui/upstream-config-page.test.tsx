import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../src/app.js";
import { UpstreamConfigPage } from "../../../src/ui/app.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
        /drag providers into the order each public model should use/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows admin login panel before config center when admin login is required", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            enabled: true,
            authenticated: false,
            username: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    render(<UpstreamConfigPage requireAdminLogin defaultWorkspace="config" />);

    expect(await screen.findByRole("heading", { name: "Config Center Login" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
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
    expect(screen.getAllByText("Validation failed").length).toBeGreaterThan(0);
  });

  it("adds a model row tied to an existing channel", async () => {
    const user = userEvent.setup();

    render(<UpstreamConfigPage />);

    await user.click(screen.getByRole("button", { name: "Add Channel" }));
    const channelNameInputs = screen.getAllByLabelText("Channel Name");
    await user.clear(channelNameInputs.at(-1)!);
    await user.type(channelNameInputs.at(-1)!, "Stability Proxy");

    expect(screen.getAllByLabelText("Route Display Name")[0]).toHaveValue("gpt-image-1");
    expect(screen.getAllByLabelText("Route Model Channel")[0]).toHaveValue("channel-openai");

    await user.click(screen.getByRole("button", { name: "Add Model" }));

    const newModelChannel = screen.getAllByLabelText("Route Model Channel").at(-1) as HTMLSelectElement;

    expect(screen.getAllByText("Unnamed Model").length).toBeGreaterThan(0);
    expect(newModelChannel.value).not.toBe("");
    expect(newModelChannel.selectedOptions[0]?.textContent).toBeTruthy();
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

  it("reorders a duplicate display-name group by dragging provider routes", async () => {
    render(<UpstreamConfigPage />);

    const initialRows = screen.getAllByTestId("priority-row-gpt-image-1");
    expect(initialRows[0]).toHaveTextContent("OpenAI Main");
    expect(initialRows[1]).toHaveTextContent("Azure Backup");

    fireEvent.dragStart(initialRows[1]!);
    fireEvent.dragOver(initialRows[0]!);
    fireEvent.drop(initialRows[0]!);

    await waitFor(() => {
      const rows = screen.getAllByTestId("priority-row-gpt-image-1");
      expect(rows[0]).toHaveTextContent("Azure Backup");
      expect(rows[1]).toHaveTextContent("OpenAI Main");
    });
  });

  it("deletes a provider model and removes its priority row", async () => {
    const user = userEvent.setup();

    render(<UpstreamConfigPage />);

    const providerCard = screen.getByRole("heading", { name: "OpenAI Main" }).closest("article");
    expect(providerCard).toBeTruthy();

    await user.click(within(providerCard!).getAllByRole("button", { name: "Delete Provider Model" })[0]!);

    expect(within(providerCard!).queryByDisplayValue("gpt-image-1")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("priority-row-gpt-image-1")).toHaveLength(1);
  });

  it("deletes a channel and cascades its models and priorities", async () => {
    const user = userEvent.setup();

    render(<UpstreamConfigPage />);

    const openAiCard = screen.getByRole("heading", { name: "OpenAI Main" }).closest("article");
    expect(openAiCard).toBeTruthy();

    await user.click(within(openAiCard!).getByRole("button", { name: "Delete Channel" }));

    expect(screen.queryByRole("heading", { name: "OpenAI Main" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Azure Backup" })).toBeInTheDocument();
    expect(screen.getByLabelText("Route Model Channel")).toHaveValue("channel-azure");
    expect(screen.queryAllByTestId("priority-row-gpt-image-1")).toHaveLength(1);
  });

  it("exports json even when validation fails", async () => {
    const user = userEvent.setup();

    render(<UpstreamConfigPage />);

    await user.click(screen.getByRole("button", { name: "Add Channel" }));
    await user.click(screen.getByRole("button", { name: "Export JSON" }));

    expect(screen.getByLabelText("Export JSON Preview")).toBeInTheDocument();
    expect(screen.getByText(/export contains validation errors/i)).toBeInTheDocument();
  });

  it("loads the active backend config on mount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            version: 1,
            channels: [
              {
                id: "loaded-channel",
                name: "Loaded Provider",
                protocolType: "openai",
                baseUrl: "https://api.example.com/v1",
                apiKey: "loaded-key",
                stripResponseFormat: true,
                enabled: true,
              },
            ],
            models: [
              {
                id: "loaded-model",
                displayName: "loaded-image",
                providerModelName: "provider-loaded-image",
                channelId: "loaded-channel",
                modelKind: "image-generation",
                enabled: true,
              },
            ],
            priorities: [{ modelId: "loaded-model", priority: 300 }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    render(<UpstreamConfigPage />);

    expect(await screen.findByRole("heading", { name: "Loaded Provider" })).toBeInTheDocument();
    expect(screen.getByLabelText("Route Provider Model Name")).toHaveValue("provider-loaded-image");
  });

  it("shows the provider compatibility toggle", () => {
    render(<UpstreamConfigPage />);

    expect(screen.getAllByText(/strip response_format for this provider/i).length).toBeGreaterThan(0);
  });

  it("saves the edited config through the backend config API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(String(init.body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          error: {
            message: "Runtime upstream config persistence is not enabled.",
          },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UpstreamConfigPage />);

    const providerModelInput = screen.getAllByLabelText("Route Provider Model Name")[0]!;
    await user.clear(providerModelInput);
    await user.type(providerModelInput, "edited-provider-model");
    await user.click(screen.getByRole("button", { name: "Save Config" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/config/upstreams",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall?.[1]?.body).toContain('"providerModelName": "edited-provider-model"');
    expect(screen.getByLabelText("Export JSON Preview")).toHaveTextContent(
      '"providerModelName": "edited-provider-model"',
    );
    expect(screen.getAllByText("Saved").length).toBeGreaterThan(0);
  });

  it("keeps local edits visible when backend save fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          return new Response(
            JSON.stringify({
              error: {
                message: "Failed to write upstream config file.",
              },
            }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            error: {
              message: "Runtime upstream config persistence is not enabled.",
            },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
      }),
    );

    render(<UpstreamConfigPage />);

    const providerModelInput = screen.getAllByLabelText("Route Provider Model Name")[0]!;
    await user.clear(providerModelInput);
    await user.type(providerModelInput, "failed-save-provider-model");
    await user.click(screen.getByRole("button", { name: "Save Config" }));

    expect((await screen.findAllByText(/save failed/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Route Provider Model Name")[0]).toHaveValue(
      "failed-save-provider-model",
    );
  });

  it("tests a provider model from the current draft and renders the preview", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST" && String(_input).includes("/test-image")) {
        return new Response(
          JSON.stringify({
            channelId: "channel-openai",
            channelName: "OpenAI Main",
            modelId: "model-openai-gpt-image-1",
            displayName: "gpt-image-1",
            providerModelName: "gpt-image-1",
            response: {
              data: [{ b64_json: "YWJj", mime_type: "image/png" }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          error: {
            message: "Runtime upstream config persistence is not enabled.",
          },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UpstreamConfigPage />);

    await user.clear(screen.getByLabelText("Provider Test Prompt"));
    await user.type(screen.getByLabelText("Provider Test Prompt"), "test bench prompt");
    await user.click(screen.getByRole("button", { name: "Run Test" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/config/upstreams/test-image",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    expect(await screen.findByAltText("Provider test output")).toBeInTheDocument();
  });

  it("runs an image-to-image provider test with an uploaded source image", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST" && String(_input).includes("/test-image")) {
        expect(JSON.parse(String(init.body))).toMatchObject({
          prompt: "把图片里的猫换成卡通风格",
          image: expect.stringContaining("data:image/png;base64,"),
        });

        return new Response(
          JSON.stringify({
            channelId: "channel-openai",
            channelName: "OpenAI Main",
            modelId: "model-openai-gpt-image-1",
            displayName: "gpt-image-1",
            providerModelName: "gpt-image-1",
            mode: "image-to-image",
            response: {
              data: [{ b64_json: "YWJj", mime_type: "image/png" }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: { message: "not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UpstreamConfigPage />);

    await user.selectOptions(screen.getByLabelText("Provider Test Mode"), "image-to-image");
    const file = new File(["cat"], "cat.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Provider Test Source Image"), file);
    await user.click(screen.getByRole("button", { name: "Run Test" }));

    expect(await screen.findByAltText("Provider test output")).toBeInTheDocument();
  });
});
