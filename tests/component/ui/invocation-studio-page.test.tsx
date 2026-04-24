import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvocationStudioPage } from "../../../src/ui/components/invocation-studio-page.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const catalogPayload = {
  version: 1 as const,
  channels: [
    {
      id: "seed",
      name: "Seed",
      protocolType: "volcengine-ark" as const,
    },
    {
      id: "aliyun",
      name: "Aliyun",
      protocolType: "aliyun-qwen-image" as const,
    },
  ],
  models: [
    {
      id: "seedream",
      displayName: "seedream",
      providerModelName: "doubao-seedream-5-0-250428",
      channelId: "seed",
      modelKind: "image-generation" as const,
      enabled: true,
    },
    {
      id: "seedream3",
      displayName: "seedream3",
      providerModelName: "doubao-seedream-3-0-t2i-250415",
      channelId: "seed",
      modelKind: "image-generation" as const,
      enabled: true,
    },
    {
      id: "qwen-image",
      displayName: "qwen-image",
      providerModelName: "qwen-image-2.0",
      channelId: "aliyun",
      modelKind: "image-generation" as const,
      enabled: true,
    },
  ],
  priorities: [
    { modelId: "seedream", priority: 100 },
    { modelId: "seedream3", priority: 90 },
    { modelId: "qwen-image", priority: 80 },
  ],
};

const minimalCatalogPayload = {
  ...catalogPayload,
  frontendSettings: {
    invocationStudio: {
      minimalMode: true,
    },
  },
};

function getRequestPreviewValue() {
  return String(screen.getByLabelText("Request Preview").getAttribute("value") ?? "") ||
    (screen.getByLabelText("Request Preview") as HTMLTextAreaElement).value;
}

describe("InvocationStudioPage", () => {
  it("loads protocol-specific fields from a public catalog", () => {
    render(<InvocationStudioPage initialCatalog={catalogPayload} />);

    expect(screen.getByRole("heading", { name: "Invocation Studio" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Parameters" })).toBeInTheDocument();
    expect(screen.getByText(/Volcengine Ark Invocation/i)).toBeInTheDocument();
    expect(screen.getByText("Seedream 5.x")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Advanced Controls" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Protocol Playbook" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Invocation" })).toBeInTheDocument();
  });

  it("changes visible fields when the model family changes", async () => {
    const user = userEvent.setup();
    render(<InvocationStudioPage initialCatalog={catalogPayload} />);

    expect(screen.queryByRole("spinbutton", { name: /Seed/i })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Output Format/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Size/i })).toHaveValue("2k");

    await user.selectOptions(screen.getByLabelText("Model"), "seedream3");

    expect(screen.getByText("Seedream 3.x T2I")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /Seed/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Output Format/i })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Size/i })).toHaveValue("1024x1024");
  });

  it("surfaces payload errors without crashing the page", () => {
    render(<InvocationStudioPage initialCatalog={catalogPayload} />);

    const extraBodyLabel = screen.getByText("Extra Body JSON").closest("label");
    const extraBody = extraBodyLabel?.querySelector("textarea");
    expect(extraBody).toBeTruthy();

    fireEvent.change(extraBody!, { target: { value: "{broken" } });

    expect(screen.getByText("Extra Body JSON must be valid JSON.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Invocation" })).toBeInTheDocument();
  });

  it("applies playbook templates into the current form", async () => {
    const user = userEvent.setup();
    render(<InvocationStudioPage initialCatalog={catalogPayload} />);

    await user.click(screen.getAllByRole("button", { name: "Apply" })[0]!);

    expect(screen.getByRole("textbox", { name: /Prompt/i })).toHaveValue(
      "生成一张高质感电影海报：霓虹夜景中的橘猫，镜头压低，戏剧性光影，海报排版留白。",
    );
    expect(screen.getByRole("textbox", { name: /Size/i })).toHaveValue("2k");
  });

  it("runs invocation through the backend route", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/v1/invocation/run") {
        return new Response(
          JSON.stringify({
            channelId: "seed",
            channelName: "Seed",
            protocolType: "volcengine-ark",
            modelId: "seedream",
            displayName: "seedream",
            providerModelName: "doubao-seedream-5-0-250428",
            mode: "text-to-image",
            response: {
              request_id: "req_123",
              data: [{ url: "https://example.com/result.png" }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<InvocationStudioPage initialCatalog={catalogPayload} />);
    await user.click(screen.getByRole("button", { name: "Run Invocation" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/invocation/run",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(await screen.findByAltText("Invocation output")).toBeInTheDocument();
    expect(getRequestPreviewValue()).toContain('"channelId": "seed"');
  });

  it("keeps Ark fixed controls separate from raw json fallback", () => {
    render(<InvocationStudioPage initialCatalog={catalogPayload} />);

    const extraBodyLabel = screen.getByText("Extra Body JSON").closest("label");
    const extraBody = extraBodyLabel?.querySelector("textarea");
    expect(extraBody).toBeTruthy();
    fireEvent.change(extraBody!, {
      target: { value: '{"watermark":true,"stream":true,"custom_flag":"keep"}' },
    });

    expect(getRequestPreviewValue()).toContain('"custom_flag": "keep"');
    expect(getRequestPreviewValue()).toContain('"stream": true');
    expect(getRequestPreviewValue()).toContain('"watermark": false');
  });

  it("loads the public catalog from backend when no initial catalog is provided", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(catalogPayload), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    render(<InvocationStudioPage />);

    expect(await screen.findByRole("heading", { name: "Parameters" })).toBeInTheDocument();
    expect(screen.getByText(/Volcengine Ark Invocation/i)).toBeInTheDocument();
  });

  it("renders and prepares Aliyun fixed parameters without protocol mixing", async () => {
    const user = userEvent.setup();
    render(<InvocationStudioPage initialCatalog={catalogPayload} />);

    await user.selectOptions(screen.getByLabelText("Channel"), "aliyun");
    expect(screen.getByRole("heading", { name: "Parameters" })).toBeInTheDocument();
    expect(screen.getByText(/Aliyun Qwen Image Invocation/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cinematic Poster" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Response Format/i })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Image Count/i })).toBeInTheDocument();

    const promptExtend = screen.getByRole("checkbox", { name: /Prompt Extend/i });
    const watermark = screen.getByRole("checkbox", { name: /Watermark/i });
    expect(promptExtend).toBeChecked();
    expect(watermark).not.toBeChecked();

    const extraBodyLabel = screen.getByText("Extra Body JSON").closest("label");
    const extraBody = extraBodyLabel?.querySelector("textarea");
    expect(extraBody).toBeTruthy();
    fireEvent.change(extraBody!, {
      target: { value: '{"prompt_extend":false,"watermark":true,"style_rewrite":"cinematic"}' },
    });

    await user.click(promptExtend);
    await user.click(watermark);
    expect(getRequestPreviewValue()).toContain('"channelId": "aliyun"');
    expect(getRequestPreviewValue()).toContain('"prompt_extend": false');
    expect(getRequestPreviewValue()).toContain('"watermark": true');
    expect(getRequestPreviewValue()).toContain('"style_rewrite": "cinematic"');
  });

  it("renders APIMart Qwen fields from its own protocol list", async () => {
    const user = userEvent.setup();
    const apimartCatalog = {
      ...catalogPayload,
      channels: [
        ...catalogPayload.channels,
        {
          id: "apimart",
          name: "APIMart",
          protocolType: "apimart-async" as const,
        },
      ],
      models: [
        ...catalogPayload.models,
        {
          id: "apimart-qwen",
          displayName: "apimart-qwen",
          providerModelName: "qwen-image-2.0",
          channelId: "apimart",
          modelKind: "image-generation" as const,
          enabled: true,
        },
      ],
      priorities: [
        ...catalogPayload.priorities,
        { modelId: "apimart-qwen", priority: 70 },
      ],
    };

    render(<InvocationStudioPage initialCatalog={apimartCatalog} />);
    await user.selectOptions(screen.getByLabelText("Channel"), "apimart");

    expect(screen.getByText(/APIMart Async Invocation/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Size/i })).toHaveValue("1:1");
    expect(screen.getByRole("combobox", { name: /Resolution/i })).toHaveValue("1K");
    expect(screen.getByRole("combobox", { name: /Image Count/i })).toHaveValue("1");
    expect(screen.getByRole("combobox", { name: /Response Format/i })).toHaveValue("url");
    expect(screen.getByRole("textbox", { name: /Negative Prompt/i })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Watermark/i })).not.toBeInTheDocument();
  });

  it("renders APIMart Wan fields without Qwen-only resolution", async () => {
    const user = userEvent.setup();
    const apimartCatalog = {
      ...catalogPayload,
      channels: [
        ...catalogPayload.channels,
        {
          id: "apimart",
          name: "APIMart",
          protocolType: "apimart-async" as const,
        },
      ],
      models: [
        ...catalogPayload.models,
        {
          id: "apimart-wan",
          displayName: "wan2.7-image-pro",
          providerModelName: "wan2.7-image-pro",
          channelId: "apimart",
          modelKind: "image-generation" as const,
          enabled: true,
        },
      ],
      priorities: [
        ...catalogPayload.priorities,
        { modelId: "apimart-wan", priority: 70 },
      ],
    };

    render(<InvocationStudioPage initialCatalog={apimartCatalog} />);
    await user.selectOptions(screen.getByLabelText("Channel"), "apimart");

    expect(screen.getByText("APIMart Wan 2.7 Image")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Size/i })).toHaveValue("2K");
    expect(screen.queryByRole("combobox", { name: /Resolution/i })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Thinking Mode/i })).toHaveValue("true");
    expect(screen.getByRole("combobox", { name: /Enable Sequential/i })).toHaveValue("false");
    expect(screen.getByRole("checkbox", { name: /Watermark/i })).not.toBeChecked();

    fireEvent.change(screen.getByRole("textbox", { name: /BBox List JSON/i }), {
      target: { value: '[{"prompt":"cat","x":10,"y":20}]' },
    });

    expect(getRequestPreviewValue()).toContain('"thinking_mode": true');
    expect(getRequestPreviewValue()).toContain('"bbox_list"');
    expect(getRequestPreviewValue()).not.toContain('"resolution"');
  });

  it("renders Google Gemini image config fields", async () => {
    const user = userEvent.setup();
    const geminiCatalog = {
      ...catalogPayload,
      channels: [
        ...catalogPayload.channels,
        {
          id: "gemini",
          name: "Google Gemini",
          protocolType: "google-gemini" as const,
        },
      ],
      models: [
        ...catalogPayload.models,
        {
          id: "gemini-flash-image",
          displayName: "gemini-image",
          providerModelName: "gemini-3.1-flash-image-preview",
          channelId: "gemini",
          modelKind: "image-generation" as const,
          enabled: true,
        },
      ],
      priorities: [
        ...catalogPayload.priorities,
        { modelId: "gemini-flash-image", priority: 70 },
      ],
    };

    render(<InvocationStudioPage initialCatalog={geminiCatalog} />);
    await user.selectOptions(screen.getByLabelText("Channel"), "gemini");

    expect(screen.getByText(/Google Gemini Image Invocation/i)).toBeInTheDocument();
    expect(screen.getByText("Gemini 3 Flash Image")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Aspect Ratio/i })).toHaveValue("1:1");
    expect(screen.getByRole("combobox", { name: /Image Size/i })).toHaveValue("1K");
    expect(screen.getByRole("combobox", { name: /Response Format/i })).toHaveValue("b64_json");

    await user.selectOptions(screen.getByRole("combobox", { name: /Image Size/i }), "512");
    expect(getRequestPreviewValue()).toContain('"imageSize": "512"');
  });

  it("uses the highest-priority provider protocol in minimal mode", async () => {
    const user = userEvent.setup();
    const duplicateModelCatalog = {
      version: 1 as const,
      channels: [
        {
          id: "openai",
          name: "OpenAI",
          protocolType: "openai" as const,
        },
        {
          id: "apimart",
          name: "APIMart",
          protocolType: "apimart-async" as const,
        },
      ],
      models: [
        {
          id: "same-apimart",
          displayName: "shared-model",
          providerModelName: "qwen-image-2.0",
          channelId: "apimart",
          modelKind: "image-generation" as const,
          enabled: true,
        },
        {
          id: "same-openai",
          displayName: "shared-model",
          providerModelName: "gpt-image-1",
          channelId: "openai",
          modelKind: "image-generation" as const,
          enabled: true,
        },
      ],
      priorities: [
        { modelId: "same-apimart", priority: 10 },
        { modelId: "same-openai", priority: 100 },
      ],
      frontendSettings: {
        invocationStudio: {
          minimalMode: true,
        },
      },
    };

    render(<InvocationStudioPage initialCatalog={duplicateModelCatalog} />);
    await user.selectOptions(screen.getByLabelText("Model"), "same-openai");

    expect(screen.queryByLabelText("Channel")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Background/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Resolution/i })).not.toBeInTheDocument();
  });

  it("renders minimal public mode without provider or protocol controls", async () => {
    render(<InvocationStudioPage initialCatalog={minimalCatalogPayload} />);

    expect(screen.getByRole("heading", { name: "Create Image" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Channel")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
    expect(screen.queryByText(/Volcengine Ark Invocation/i)).not.toBeInTheDocument();
    expect(screen.queryByText("doubao-seedream-5-0-250428")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Request Preview")).not.toBeInTheDocument();
  });
});
