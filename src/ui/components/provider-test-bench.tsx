import { useEffect, useMemo, useState } from "react";
import {
  buildInvocationFormContext,
  getProtocolFormSpec,
  type InvocationMode,
} from "../lib/protocol-form-specs.js";
import { CurlPreviewCard } from "./invocation/curl-preview-card.js";
import { RequestPreviewCard } from "./invocation/request-preview-card.js";
import type { ChannelConfig, GatewayUpstreamConfig, ModelConfig } from "../types/config.js";

type TestResponse = {
  channelId: string;
  channelName: string;
  modelId: string;
  displayName: string;
  providerModelName: string;
  mode?: "text-to-image" | "image-to-image" | "edit";
  response: {
    data: Array<{
      b64_json?: string | null;
      url?: string | null;
      mime_type?: string | null;
      revised_prompt?: string | null;
    }>;
  };
};

type TestMode = "text-to-image" | "image-to-image" | "edit";

export function ProviderTestBench(props: {
  config: GatewayUpstreamConfig;
  channels: ChannelConfig[];
  models: ModelConfig[];
}) {
  const [channelId, setChannelId] = useState("");
  const [modelId, setModelId] = useState("");
  const [testMode, setTestMode] = useState<TestMode>("text-to-image");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [imageInputKind, setImageInputKind] = useState<"upload" | "url">("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageFileName, setImageFileName] = useState("");
  const [maskDataUrl, setMaskDataUrl] = useState("");
  const [maskFileName, setMaskFileName] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [testResult, setTestResult] = useState<TestResponse | null>(null);

  const availableChannels = useMemo(
    () => props.channels.filter((channel) => props.models.some((model) => model.channelId === channel.id)),
    [props.channels, props.models],
  );
  const availableModels = useMemo(
    () => props.models.filter((model) => model.channelId === channelId),
    [props.models, channelId],
  );
  const activeChannel = props.channels.find((channel) => channel.id === channelId) ?? null;
  const activeModel = props.models.find((model) => model.id === modelId) ?? null;
  const spec = activeChannel ? getProtocolFormSpec(activeChannel.protocolType) : null;
  const previewItem = testResult?.response.data[0] ?? null;
  const previewSrc = previewItem?.url
    ? previewItem.url
    : previewItem?.b64_json
      ? `data:${previewItem.mime_type ?? "image/png"};base64,${previewItem.b64_json}`
      : "";
  const requiresImage = testMode === "image-to-image" || testMode === "edit";
  const requiresMask = testMode === "edit";
  const sourceImage = imageInputKind === "url" ? imageUrl.trim() : imageDataUrl;
  const protocolHint = activeChannel ? getProtocolTestHint(activeChannel.protocolType) : "";
  const structuredExtraBodyState = useMemo(() => {
    try {
      return {
        extraBody: buildStructuredExtraBody(values, parseExtraBody(String(values.extra_body ?? "{}"))),
        error: "",
      };
    } catch (error) {
      return {
        extraBody: {},
        error: error instanceof Error ? error.message : "Invalid test payload.",
      };
    }
  }, [values]);

  const context =
    activeChannel && activeModel && spec
      ? buildInvocationFormContext({
          protocolType: activeChannel.protocolType,
          mode: testMode,
          modelName: activeModel.providerModelName,
        })
      : null;

  const visibleGroups =
    context && spec
      ? spec.groups
          .map((group) => ({
            ...group,
            visibleFields: group.fields.filter(
              (field) => !field.visibleWhen || field.visibleWhen(context),
            ),
          }))
          .filter((group) => group.visibleFields.length > 0)
      : [];

  useEffect(() => {
    if (availableChannels.length === 0) {
      setChannelId("");
      return;
    }

    if (!availableChannels.some((channel) => channel.id === channelId)) {
      setChannelId(availableChannels[0]!.id);
    }
  }, [availableChannels, channelId]);

  useEffect(() => {
    if (availableModels.length === 0) {
      setModelId("");
      return;
    }

    if (!availableModels.some((model) => model.id === modelId)) {
      setModelId(availableModels[0]!.id);
    }
  }, [availableModels, modelId]);

  useEffect(() => {
    if (!spec || !activeModel) {
      return;
    }

    const initialValues = spec.getInitialValues(activeModel.providerModelName);
    const nextMode = spec.supportedModes.includes(testMode) ? testMode : (spec.defaultMode as TestMode);
    setTestMode(nextMode);
    setValues({
      ...initialValues,
      prompt: getSuggestedPromptForMode(String(initialValues.prompt ?? ""), nextMode),
    });
    setImageInputKind("upload");
    setImageUrl("");
    setImageDataUrl("");
    setImageFileName("");
    setMaskDataUrl("");
    setMaskFileName("");
    setTestError("");
    setTestResult(null);
  }, [spec?.protocolType, activeModel?.id]);

  useEffect(() => {
    setValues((current) => ({
      ...current,
      prompt: getSuggestedPromptForMode(String(current.prompt ?? ""), testMode),
    }));
  }, [testMode]);

  const requestPreview = useMemo(() => {
    if (!activeChannel || !activeModel) {
      return "";
    }

    const seedValue = String(values.seed ?? "").trim();
    const nValue = Number(String(values.n ?? "1"));

    return JSON.stringify(
      {
        config: {
          version: props.config.version,
          channels: props.config.channels.length,
          models: props.config.models.length,
        },
        channelId: activeChannel.id,
        modelId: activeModel.id,
        protocolType: activeChannel.protocolType,
        mode: testMode,
        prompt: String(values.prompt ?? "").trim(),
        negative_prompt: getOptionalString(values.negative_prompt),
        size: String(values.size ?? "").trim(),
        n: Number.isFinite(nValue) && nValue > 0 ? nValue : 1,
        response_format: String(values.response_format ?? "b64_json"),
        background: getOptionalString(values.background),
        output_format: getOptionalString(values.output_format),
        quality: getOptionalString(values.quality),
        style: getOptionalString(values.style),
        seed: seedValue ? Number(seedValue) : undefined,
        extra_body: structuredExtraBodyState.extraBody,
        image: requiresImage ? summarizeAsset(sourceImage) : undefined,
        mask: requiresMask ? summarizeAsset(maskDataUrl) : undefined,
      },
      null,
      2,
    );
  }, [
    activeChannel,
    activeModel,
    values,
    structuredExtraBodyState.extraBody,
    props.config.version,
    props.config.channels.length,
    props.config.models.length,
    testMode,
    requiresImage,
    sourceImage,
    requiresMask,
    maskDataUrl,
  ]);

  const curlPreview = useMemo(() => {
    if (!requestPreview) {
      return "";
    }

    const origin = globalThis.location?.origin ?? "http://localhost:3000";
    return [
      `curl -X POST ${origin}/v1/config/upstreams/test-image \\`,
      '  -H "content-type: application/json" \\',
      `  -d '${requestPreview}'`,
    ].join("\n");
  }, [requestPreview]);

  const runTest = async () => {
    if (!channelId || !modelId || !String(values.prompt ?? "").trim()) {
      setTestError("Choose a provider model and enter a prompt before testing.");
      return;
    }

    if (requiresImage && !sourceImage) {
      setTestError("Upload a source image before running image-to-image or edit tests.");
      return;
    }

    if (requiresMask && !maskDataUrl) {
      setTestError("Upload a mask image before running edit tests.");
      return;
    }

    setIsTesting(true);
    setTestError("");
    setTestResult(null);

    try {
      if (structuredExtraBodyState.error) {
        throw new Error(structuredExtraBodyState.error);
      }

      const extraBody = structuredExtraBodyState.extraBody;
      const seedValue = String(values.seed ?? "").trim();
      const nValue = Number(String(values.n ?? "1"));
      const response = await fetch("/v1/config/upstreams/test-image", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          config: props.config,
          modelId,
          prompt: String(values.prompt ?? "").trim(),
          negative_prompt: getOptionalString(values.negative_prompt),
          size: String(values.size ?? "").trim(),
          n: Number.isFinite(nValue) && nValue > 0 ? nValue : 1,
          response_format: String(values.response_format ?? "b64_json"),
          background: getOptionalString(values.background),
          output_format: getOptionalString(values.output_format),
          quality: getOptionalString(values.quality),
          style: getOptionalString(values.style),
          seed: seedValue ? Number(seedValue) : undefined,
          extra_body: extraBody,
          image: requiresImage ? sourceImage : undefined,
          mask: requiresMask ? maskDataUrl : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await readGatewayErrorMessage(response));
      }

      setTestResult((await readJsonResponse<TestResponse>(response)) as TestResponse);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Provider test failed.");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <section id="test-bench" className="panel test-bench">
      <div className="test-bench__header">
        <div>
          <h2>Provider Test Bench</h2>
          <p>
            Test the current page draft against a specific provider model before deciding whether to
            save compatibility switches.
          </p>
        </div>
        <button type="button" onClick={runTest} disabled={isTesting || !channelId || !modelId}>
          {isTesting ? "Testing..." : "Run Test"}
        </button>
      </div>

      <nav className="test-bench__section-nav" aria-label="Provider test bench sections">
        <a href="#test-bench-session">Session</a>
        <a href="#test-bench-params">Protocol Params</a>
        <a href="#test-bench-assets">Assets</a>
        <a href="#test-bench-payload">Payload</a>
      </nav>

      <div className="test-bench__grid">
        <section className="test-bench__controls">
          <div id="test-bench-session" className="test-bench__session-grid test-bench__block">
            <div className="test-bench__block-header">
              <h3>Session</h3>
              <p>Select the exact provider channel, upstream model, and invocation mode.</p>
            </div>
            <label>
              Provider Channel
              <select
                aria-label="Provider Test Channel"
                value={channelId}
                onChange={(event) => setChannelId(event.target.value)}
              >
                {availableChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name || channel.id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Provider Model
              <select
                aria-label="Provider Test Model"
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.providerModelName || model.displayName || model.id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Test Mode
              <select
                aria-label="Provider Test Mode"
                value={testMode}
                onChange={(event) => setTestMode(event.target.value as TestMode)}
              >
                {(spec?.supportedModes.filter(
                  (mode): mode is TestMode => mode !== "group",
                ) ?? ["text-to-image", "image-to-image", "edit"]).map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === "text-to-image"
                      ? "Text to Image"
                      : mode === "image-to-image"
                        ? "Image to Image"
                        : "Edit with Mask"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {protocolHint ? <p className="test-bench__hint">{protocolHint}</p> : null}

          {spec && context ? (
            <>
              <div className="test-bench__protocol-summary">
                <div className="invocation-family">
                  <div className="invocation-family__badge">{spec.getFamilyLabel(context.modelFamily)}</div>
                  <div className="invocation-family__meta">
                    <strong>{spec.title}</strong>
                    <span>{activeModel?.providerModelName ?? "unselected"}</span>
                  </div>
                </div>

                <div className="invocation-family-notes">
                  {spec.getFamilyNotes(context).map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </div>

              <div id="test-bench-params" className="test-bench__group-list test-bench__block">
                <div className="test-bench__block-header">
                  <h3>Protocol Params</h3>
                  <p>These controls come from the same protocol spec used by Invocation Studio.</p>
                </div>
                {visibleGroups.map((group) => (
                  <section
                    key={group.id}
                    className={`invocation-group-card invocation-group-card--${group.id}`}
                  >
                    <header className="invocation-group-card__header">
                      <div>
                        <h3>{group.title}</h3>
                        {group.description ? (
                          <p>
                            {typeof group.description === "function"
                              ? group.description(context)
                              : group.description}
                          </p>
                        ) : null}
                      </div>
                      <span>{group.visibleFields.length} fields</span>
                    </header>

                    <div className="invocation-fields">
                      {group.visibleFields.map((field) => {
                        const helpText =
                          typeof field.helpText === "function"
                            ? field.helpText(context)
                            : field.helpText;
                        const value = values[field.key];
                        const options =
                          typeof field.options === "function" ? field.options(context) : field.options;

                        return (
                          <label
                            key={field.key}
                            className={
                              field.kind === "checkbox"
                                ? "invocation-field invocation-field--checkbox"
                                : "invocation-field"
                            }
                          >
                            <span className="invocation-field__label">{field.label}</span>
                            {field.kind === "checkbox" ? (
                              <span className="invocation-toggle">
                                <span className="invocation-toggle__copy">
                                  <strong>{field.label}</strong>
                                  <span>{Boolean(value) ? "Enabled" : "Disabled"}</span>
                                </span>
                                <span className="invocation-toggle__control">
                                  <input
                                    aria-label={getProviderTestAriaLabel(field.key, field.label)}
                                    type="checkbox"
                                    checked={Boolean(value)}
                                    onChange={(event) =>
                                      setValues((current) => ({
                                        ...current,
                                        [field.key]: event.target.checked,
                                      }))
                                    }
                                  />
                                  <span aria-hidden="true" className="invocation-toggle__track" />
                                </span>
                              </span>
                            ) : field.kind === "textarea" || field.kind === "json" ? (
                              <textarea
                                aria-label={getProviderTestAriaLabel(field.key, field.label)}
                                className={field.kind === "json" ? "invocation-json test-bench__extra-body" : undefined}
                                value={String(value ?? "")}
                                placeholder={field.placeholder}
                                onChange={(event) =>
                                  setValues((current) => ({
                                    ...current,
                                    [field.key]: event.target.value,
                                  }))
                                }
                              />
                            ) : field.kind === "select" ? (
                              <select
                                aria-label={getProviderTestAriaLabel(field.key, field.label)}
                                value={String(value ?? "")}
                                onChange={(event) =>
                                  setValues((current) => ({
                                    ...current,
                                    [field.key]: event.target.value,
                                  }))
                                }
                              >
                                {(options ?? []).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                aria-label={getProviderTestAriaLabel(field.key, field.label)}
                                type={field.kind === "number" ? "number" : "text"}
                                value={String(value ?? "")}
                                placeholder={field.placeholder}
                                onChange={(event) =>
                                  setValues((current) => ({
                                    ...current,
                                    [field.key]: event.target.value,
                                  }))
                                }
                              />
                            )}
                            {helpText ? <small>{helpText}</small> : null}
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : null}

          {requiresImage ? (
            <div id="test-bench-assets" className="test-bench__upload test-bench__block">
              <div className="test-bench__block-header">
                <h3>Assets</h3>
                <p>Provide the source image or mask required by image-to-image and edit modes.</p>
              </div>
              <div className="test-bench__mode-switch">
                <button
                  type="button"
                  className={imageInputKind === "upload" ? "is-active" : ""}
                  onClick={() => setImageInputKind("upload")}
                >
                  Upload file
                </button>
                <button
                  type="button"
                  className={imageInputKind === "url" ? "is-active" : ""}
                  onClick={() => setImageInputKind("url")}
                >
                  Image URL
                </button>
              </div>
              {imageInputKind === "upload" ? (
                <label>
                  Source Image
                  <input
                    aria-label="Provider Test Source Image"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      void readSelectedFile(event.currentTarget.files?.[0] ?? null).then((file) => {
                        setImageDataUrl(file.dataUrl);
                        setImageFileName(file.name);
                      });
                    }}
                  />
                </label>
              ) : (
                <label>
                  Source Image URL
                  <input
                    aria-label="Provider Test Source Image URL"
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    placeholder="https://example.com/cat.png"
                  />
                </label>
              )}
              {sourceImage ? (
                <div className="test-bench__source-preview">
                  <img src={sourceImage} alt="Provider test source" />
                  <span>{imageInputKind === "url" ? imageUrl : imageFileName}</span>
                </div>
              ) : imageInputKind === "upload" ? (
                <p className="test-bench__hint">
                  Choose your local cat.png here. Some providers, including Ark, may require a
                  reachable image URL instead of a browser data URL.
                </p>
              ) : (
                <p className="test-bench__hint">Use this when the upstream requires a public image URL.</p>
              )}
            </div>
          ) : !requiresMask ? (
            <div id="test-bench-assets" className="test-bench__upload test-bench__block">
              <div className="test-bench__block-header">
                <h3>Assets</h3>
                <p>Text-to-image mode does not require source assets for this test.</p>
              </div>
            </div>
          ) : null}

          {requiresMask ? (
            <div className="test-bench__upload">
              <label>
                Mask Image
                <input
                  aria-label="Provider Test Mask Image"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void readSelectedFile(event.currentTarget.files?.[0] ?? null).then((file) => {
                      setMaskDataUrl(file.dataUrl);
                      setMaskFileName(file.name);
                    });
                  }}
                />
              </label>
              {maskDataUrl ? (
                <div className="test-bench__source-preview">
                  <img src={maskDataUrl} alt="Provider test mask" />
                  <span>{maskFileName}</span>
                </div>
              ) : (
                <p className="test-bench__hint">A mask is only required for edit tests.</p>
              )}
            </div>
          ) : null}

          <div className="test-bench__meta">
            <div>
              <span className="meta-label">Channel ID</span>
              <code>{activeChannel?.id ?? "unselected"}</code>
            </div>
            <div>
              <span className="meta-label">Provider Model Name</span>
              <code>{activeModel?.providerModelName ?? "unselected"}</code>
            </div>
            <div>
              <span className="meta-label">Public Display Name</span>
              <code>{activeModel?.displayName ?? "unselected"}</code>
            </div>
            <div>
              <span className="meta-label">Test Mode</span>
              <code>{testMode}</code>
            </div>
            <div>
              <span className="meta-label">Size</span>
              <code>{String(values.size ?? "unset")}</code>
            </div>
            <div>
              <span className="meta-label">Strip response_format</span>
              <code>{activeChannel?.stripResponseFormat ? "enabled" : "disabled"}</code>
            </div>
          </div>

          <div id="test-bench-payload" className="test-bench__block">
            <div className="test-bench__block-header">
              <h3>Payload</h3>
              <p>Preview the exact structured request this test will send to the backend route.</p>
            </div>
            <RequestPreviewCard
              requestPreview={requestPreview}
              payloadError={structuredExtraBodyState.error}
            />
            <CurlPreviewCard curlPreview={curlPreview} />
          </div>

          {testError ? <p className="field-error">{testError}</p> : null}
        </section>

        <section className="test-bench__preview">
          {previewSrc ? (
            <>
              <img src={previewSrc} alt="Provider test output" className="test-bench__image" />
              <div className="test-bench__result-meta">
                <strong>{testResult?.channelName}</strong>
                <p>
                  {testResult?.providerModelName}
                  {testResult?.mode ? ` · ${testResult.mode}` : ""}
                </p>
              </div>
            </>
          ) : (
            <div className="test-bench__empty">
              <strong>{isTesting ? "Waiting for upstream image..." : "No preview yet"}</strong>
              <p>
                Successful tests render here. Validation or upstream errors normally return much
                faster than image generation.
              </p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

async function readGatewayErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: {
        message?: string;
      };
    };

    return payload.error?.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function readSelectedFile(file: File | null): Promise<{ name: string; dataUrl: string }> {
  if (!file) {
    return Promise.resolve({ name: "", dataUrl: "" });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        dataUrl: typeof reader.result === "string" ? reader.result : "",
      });
    reader.onerror = () => reject(new Error("Failed to read selected image file."));
    reader.readAsDataURL(file);
  });
}

function getProtocolTestHint(protocolType: ChannelConfig["protocolType"]): string {
  switch (protocolType) {
    case "volcengine-ark":
      return "火山方舟 Seedream 4.0/4.5/5.0 的 size 应按文档填写：例如 `2k`、`3k`、`4k` 或 `WIDTHxHEIGHT`。`1:1` 这类比例值不能直接当成 size 传。";
    case "aliyun-qwen-image":
      return "阿里云 Qwen Image 会把 1024x1024 自动转换为 1024*1024，并把 extra_body 合并到 parameters。";
    case "apimart-async":
      return "APIMart async 会提交任务并轮询结果，测试耗时通常更长，当前结果以 URL 为主。";
    default:
      return "";
  }
}

function parseExtraBody(value: string): Record<string, unknown> {
  const trimmed = value.trim();

  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Extra Body JSON must be an object.");
  }

  return parsed as Record<string, unknown>;
}

function buildStructuredExtraBody(
  values: Record<string, unknown>,
  rawExtraBody: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...rawExtraBody };
  const guidanceScaleValue = String(values.guidance_scale ?? "").trim();

  assignOptionalBoolean(merged, "watermark", values.watermark);
  assignOptionalBoolean(merged, "prompt_extend", values.prompt_extend);
  assignOptionalBoolean(merged, "stream", values.stream);

  if (guidanceScaleValue) {
    const parsed = Number(guidanceScaleValue);
    if (Number.isFinite(parsed)) {
      merged.guidance_scale = parsed;
    }
  }

  return merged;
}

function assignOptionalBoolean(target: Record<string, unknown>, key: string, value: unknown) {
  if (typeof value === "boolean") {
    target[key] = value;
    return;
  }

  if (typeof value === "string" && (value === "true" || value === "false")) {
    target[key] = value === "true";
  }
}

function getOptionalString(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function getSuggestedPromptForMode(currentPrompt: string, mode: TestMode): string {
  if (mode === "image-to-image") {
    return "把图片里的猫换成卡通风格";
  }

  if (mode === "edit") {
    return "只修改蒙版区域，把图片里的猫换成卡通风格，其他区域保持不变";
  }

  return currentPrompt || "一只带电影感光影的橘猫，坐在窗边。";
}

function getProviderTestAriaLabel(key: string, label: string): string {
  switch (key) {
    case "prompt":
      return "Provider Test Prompt";
    case "size":
      return "Provider Test Size";
    case "response_format":
      return "Provider Test Response Format";
    case "extra_body":
      return "Provider Test Extra Body";
    default:
      return `Provider Test ${label}`;
  }
}

function summarizeAsset(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("data:")) {
    return "[data-url]";
  }

  return trimmed;
}
