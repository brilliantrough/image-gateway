import { useEffect, useMemo, useState } from "react";
import {
  buildInvocationFormContext,
  getProtocolFormSpec,
  type InvocationMode,
  type InvocationPlaybookRecipe,
} from "../lib/protocol-form-specs.js";
import type { PublicInvocationCatalog, ProtocolType } from "../types/config.js";
import type { InvocationDraft, InvocationResponse } from "../types/invocation.js";
import { InputAssetsPanel } from "./invocation/input-assets-panel.js";
import { InvocationResultPanel } from "./invocation/invocation-result-panel.js";
import { ProtocolParameterForm } from "./invocation/protocol-parameter-form.js";
import { ChannelSessionPanel } from "./invocation/channel-session-panel.js";
import { SidebarNav } from "./sidebar-nav.js";

type InvocationStudioPageProps = {
  initialCatalog?: PublicInvocationCatalog;
};

export function InvocationStudioPage(props: InvocationStudioPageProps) {
  const [catalog, setCatalog] = useState<PublicInvocationCatalog | null>(props.initialCatalog ?? null);
  const [isLoading, setIsLoading] = useState(!props.initialCatalog);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<InvocationDraft>(createInvocationDraft());
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [runResult, setRunResult] = useState<InvocationResponse | null>(null);

  const channels = catalog?.channels ?? [];
  const models = catalog?.models ?? [];
  const minimalMode = catalog?.frontendSettings?.invocationStudio.minimalMode ?? false;
  const priorityByModelId = useMemo(
    () => new Map((catalog?.priorities ?? []).map((priority) => [priority.modelId, priority.priority])),
    [catalog?.priorities],
  );
  const minimalModels = useMemo(() => {
    const modelByDisplayName = new Map<string, typeof models[number]>();

    for (const model of models) {
      const key = model.displayName.trim() || model.providerModelName || model.id;
      const current = modelByDisplayName.get(key);
      const nextPriority = priorityByModelId.get(model.id) ?? 0;
      const currentPriority = current ? priorityByModelId.get(current.id) ?? 0 : -1;

      if (!current || nextPriority > currentPriority) {
        modelByDisplayName.set(key, model);
      }
    }

    return Array.from(modelByDisplayName.values()).sort((left, right) =>
      (left.displayName || left.providerModelName).localeCompare(right.displayName || right.providerModelName),
    );
  }, [models, priorityByModelId]);
  const availableModels = minimalMode ? minimalModels : models.filter((item) => item.channelId === draft.channelId);
  const activeChannel = channels.find((item) => item.id === draft.channelId) ?? null;
  const activeModel = availableModels.find((item) => item.id === draft.modelId) ?? null;
  const spec = activeChannel ? getProtocolFormSpec(activeChannel.protocolType) : null;
  const previewItem = runResult?.response.data[0] ?? null;
  const previewSrc = previewItem?.url
    ? previewItem.url
    : previewItem?.b64_json
      ? `data:${previewItem.mime_type ?? "image/png"};base64,${previewItem.b64_json}`
      : "";
  const sourceImage =
    draft.assets.imageInputKind === "url" ? draft.assets.imageUrl.trim() : draft.assets.imageDataUrl;
  const requiresImage = draft.mode === "image-to-image" || draft.mode === "edit";
  const requiresMask = draft.mode === "edit";

  const formContext =
    activeChannel && activeModel
      ? buildInvocationFormContext({
          protocolType: activeChannel.protocolType,
          mode: draft.mode,
          modelName: activeModel.providerModelName,
        })
      : null;

  const visibleFieldCount = spec
    ? spec.groups.reduce(
        (count, group) =>
          count +
          group.fields.filter(
            (field) => !formContext || !field.visibleWhen || field.visibleWhen(formContext),
          ).length,
        0,
      )
    : 0;

  useEffect(() => {
    if (props.initialCatalog) {
      return;
    }

    const controller = new AbortController();

    async function loadCatalog() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await fetch("/v1/public/catalog", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readGatewayErrorMessage(response));
        }

        setCatalog(await readJsonResponse<PublicInvocationCatalog>(response));
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Failed to load public catalog.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadCatalog();
    return () => controller.abort();
  }, [props.initialCatalog]);

  useEffect(() => {
    if (channels.length === 0) {
      setDraft((current) =>
        current.channelId || current.modelId ? { ...current, channelId: "", modelId: "" } : current,
      );
      return;
    }

    if (minimalMode) {
      const selectedModel = availableModels.find((item) => item.id === draft.modelId) ?? availableModels[0];
      if (selectedModel && draft.channelId !== selectedModel.channelId) {
        setDraft((current) => ({ ...current, channelId: selectedModel.channelId }));
      }
      return;
    }

    if (!channels.some((item) => item.id === draft.channelId)) {
      setDraft((current) => ({ ...current, channelId: channels[0]!.id }));
    }
  }, [availableModels, channels, draft.channelId, draft.modelId, minimalMode]);

  useEffect(() => {
    if (availableModels.length === 0) {
      setDraft((current) => (current.modelId ? { ...current, modelId: "" } : current));
      return;
    }

    if (!availableModels.some((item) => item.id === draft.modelId)) {
      const nextModel = availableModels[0]!;
      setDraft((current) => ({
        ...current,
        modelId: nextModel.id,
        channelId: minimalMode ? nextModel.channelId : current.channelId,
      }));
    }
  }, [availableModels, draft.modelId, minimalMode]);

  useEffect(() => {
    if (!spec || !activeModel) {
      return;
    }

    setDraft((current) => ({
      ...current,
      mode: spec.defaultMode,
      values: spec.getInitialValues(activeModel.providerModelName),
      assets: createEmptyInvocationAssets(),
    }));
    setRunResult(null);
    setRunError("");
  }, [spec?.protocolType, activeModel?.id]);

  const payloadState = useMemo(() => {
    if (!activeChannel || !activeModel) {
      return { payload: null, error: "" };
    }

    try {
      return {
        payload: buildInvocationPayload({
          protocolType: activeChannel.protocolType,
          mode: draft.mode,
          values: draft.values,
          image: requiresImage ? sourceImage : "",
          mask: requiresMask ? draft.assets.maskDataUrl : "",
        }),
        error: "",
      };
    } catch (error) {
      return {
        payload: null,
        error: error instanceof Error ? error.message : "Invalid invocation payload.",
      };
    }
  }, [
    activeChannel,
    activeModel,
    draft.mode,
    draft.values,
    requiresImage,
    sourceImage,
    requiresMask,
    draft.assets.maskDataUrl,
  ]);

  const requestPreview = useMemo(() => {
    if (!activeChannel || !activeModel || !payloadState.payload) {
      return "";
    }

    return JSON.stringify(
      {
        channelId: activeChannel.id,
        modelId: activeModel.id,
        mode: draft.mode,
        ...payloadState.payload,
      },
      null,
      2,
    );
  }, [activeChannel, activeModel, draft.mode, payloadState.payload]);

  const curlPreview = useMemo(() => {
    if (!requestPreview) {
      return "";
    }

    const origin = globalThis.location?.origin ?? "http://localhost:3000";
    return [
      `curl -X POST ${origin}/v1/invocation/run \\`,
      '  -H "content-type: application/json" \\',
      `  -d '${requestPreview}'`,
    ].join("\n");
  }, [requestPreview]);

  const runInvocation = async () => {
    if (!activeChannel || !activeModel) {
      return;
    }

    if (payloadState.error || !payloadState.payload) {
      setRunError(payloadState.error || "Invalid invocation payload.");
      return;
    }

    if (requiresImage && !sourceImage) {
      setRunError("Add a source image before running image-to-image or edit mode.");
      return;
    }

    if (requiresMask && !draft.assets.maskDataUrl) {
      setRunError("Add a mask image before running edit mode.");
      return;
    }

    setIsRunning(true);
    setRunError("");
    setRunResult(null);

    try {
      const response = await fetch("/v1/invocation/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          channelId: activeChannel.id,
          modelId: activeModel.id,
          mode: draft.mode,
          ...payloadState.payload,
        }),
      });

      if (!response.ok) {
        throw new Error(await readGatewayErrorMessage(response));
      }

      setRunResult(await readJsonResponse<InvocationResponse>(response));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Invocation failed.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className={`app-shell ${minimalMode ? "app-shell--minimal" : ""}`}>
      {minimalMode ? null : <SidebarNav
        title="Invocation Studio"
        subtitle="Public Protocol Workspace"
        items={[
          { href: "#session", label: "Session", meta: activeChannel?.protocolType ?? "Protocol" },
          { href: "#parameters", label: "Parameters", meta: `${visibleFieldCount} fields` },
          { href: "#assets", label: "Assets", meta: requiresImage ? "Input active" : "Optional" },
          { href: "#result", label: "Result", meta: runResult ? "Rendered" : "Idle" },
        ]}
        actions={<a href="/?admin=1" className="section-nav__button section-nav__button--link">Admin</a>}
      />}
      <main className="page-shell page-shell--wide">
        {minimalMode ? null : <section className="hero-panel hero-panel--compact hero-panel--workspace">
          <div>
            <p className="eyebrow">Protocol-driven invocation</p>
            <h1>Invocation Studio</h1>
            <p className="hero-panel__copy">
              Select a public channel and model, then let the trusted gateway execute the request.
              Provider secrets and upstream config remain private on the backend.
            </p>
          </div>
          <div className="hero-panel__orb" aria-hidden="true" />
        </section>}

        {isLoading ? <section className="notice">Loading public catalog…</section> : null}
        {loadError ? (
          <section className="notice notice--error">Public catalog load failed: {loadError}</section>
        ) : null}

        {!isLoading && !loadError && activeChannel && activeModel && spec ? (
          <div className="studio-layout">
            <div className="studio-layout__main">
              <ChannelSessionPanel
                channels={channels}
                availableModels={availableModels}
                activeChannel={activeChannel}
                activeModel={activeModel}
                spec={spec}
                mode={draft.mode}
                isRunning={isRunning}
                minimalMode={minimalMode}
                onRun={runInvocation}
                onChannelChange={(channelId) =>
                  setDraft((current) => ({
                    ...current,
                    channelId,
                  }))
                }
                onModelChange={(modelId) =>
                  setDraft((current) => ({
                    ...current,
                    modelId,
                    channelId:
                      minimalMode
                        ? availableModels.find((item) => item.id === modelId)?.channelId ?? current.channelId
                        : current.channelId,
                  }))
                }
                onModeChange={(mode) =>
                  setDraft((current) => ({
                    ...current,
                    mode,
                  }))
                }
              />

              <ProtocolParameterForm
                spec={spec}
                mode={draft.mode}
                modelName={activeModel.providerModelName}
                values={draft.values}
                minimalMode={minimalMode}
                onValueChange={(key, value) =>
                  setDraft((current) => ({
                    ...current,
                    values: { ...current.values, [key]: value },
                  }))
                }
                onApplyRecipe={(recipe) =>
                  setDraft((current) => applyInvocationRecipe(current, recipe))
                }
              />

              <InputAssetsPanel
                requiresImage={requiresImage}
                requiresMask={requiresMask}
                imageInputKind={draft.assets.imageInputKind}
                imageUrl={draft.assets.imageUrl}
                imageDataUrl={draft.assets.imageDataUrl}
                imageFileName={draft.assets.imageFileName}
                maskDataUrl={draft.assets.maskDataUrl}
                maskFileName={draft.assets.maskFileName}
                onImageInputKindChange={(imageInputKind) =>
                  setDraft((current) => ({
                    ...current,
                    assets: {
                      ...current.assets,
                      imageInputKind,
                      imageUrl: imageInputKind === "upload" ? "" : current.assets.imageUrl,
                      imageDataUrl: imageInputKind === "url" ? "" : current.assets.imageDataUrl,
                      imageFileName: imageInputKind === "url" ? "" : current.assets.imageFileName,
                    },
                  }))
                }
                onImageUrlChange={(imageUrl) =>
                  setDraft((current) => ({
                    ...current,
                    assets: {
                      ...current.assets,
                      imageUrl,
                    },
                  }))
                }
                onImageFileChange={(file) => {
                  void readSelectedFile(file).then((asset) => {
                    setDraft((current) => ({
                      ...current,
                      assets: {
                        ...current.assets,
                        imageDataUrl: asset.dataUrl,
                        imageFileName: asset.name,
                      },
                    }));
                  });
                }}
                onMaskFileChange={(file) => {
                  void readSelectedFile(file).then((asset) => {
                    setDraft((current) => ({
                      ...current,
                      assets: {
                        ...current.assets,
                        maskDataUrl: asset.dataUrl,
                        maskFileName: asset.name,
                      },
                    }));
                  });
                }}
              />
            </div>

            <div className="studio-layout__aside">
              <InvocationResultPanel
                isRunning={isRunning}
                runError={runError}
                payloadError={payloadState.error}
                previewSrc={previewSrc}
                requestPreview={requestPreview}
                curlPreview={curlPreview}
                runResult={runResult}
                minimalMode={minimalMode}
              />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function buildInvocationPayload(input: {
  protocolType: ProtocolType;
  mode: InvocationMode;
  values: Record<string, unknown>;
  image: string;
  mask: string;
}) {
  const rawExtraBody = parseExtraBody(String(input.values.extra_body ?? "{}"));
  const prompt = String(input.values.prompt ?? "").trim();
  const size = String(input.values.size ?? "").trim();
  const nValue = Number(String(input.values.n ?? "1"));
  const n = Number.isFinite(nValue) && nValue > 0 ? nValue : 1;
  const image = input.image || undefined;
  const mask = input.mask || undefined;
  const negativePrompt = String(input.values.negative_prompt ?? "").trim() || undefined;
  const responseFormat = String(input.values.response_format ?? "b64_json");
  const outputFormat = String(input.values.output_format ?? "").trim() || undefined;
  const outputCompressionRaw = String(input.values.output_compression ?? "").trim();
  const outputCompression =
    outputCompressionRaw && Number.isFinite(Number(outputCompressionRaw))
      ? Number(outputCompressionRaw)
      : undefined;
  const seedValue = String(input.values.seed ?? "").trim();
  const seed = seedValue ? Number(seedValue) : undefined;

  switch (input.protocolType) {
    case "volcengine-ark": {
      const extraBody = { ...rawExtraBody };
      if (typeof input.values.watermark === "boolean") {
        extraBody.watermark = input.values.watermark;
      }

      return {
        prompt,
        size,
        n,
        response_format: responseFormat,
        output_format: outputFormat,
        seed,
        image,
        mask,
        extra_body: extraBody,
      };
    }
    case "aliyun-qwen-image": {
      const extraBody = { ...rawExtraBody };
      if (typeof input.values.watermark === "boolean") {
        extraBody.watermark = input.values.watermark;
      }
      if (typeof input.values.prompt_extend === "boolean") {
        extraBody.prompt_extend = input.values.prompt_extend;
      }

      return {
        prompt,
        size,
        n,
        negative_prompt: negativePrompt,
        image,
        mask,
        response_format: responseFormat,
        extra_body: extraBody,
      };
    }
    case "apimart-async": {
      const extraBody = { ...rawExtraBody };
      const resolution = String(input.values.resolution ?? "").trim();
      const thinkingMode = String(input.values.thinking_mode ?? "").trim();
      const enableSequential = String(input.values.enable_sequential ?? "").trim();
      const seedValue = String(input.values.seed ?? "").trim();
      if (resolution) {
        extraBody.resolution = resolution;
      }
      if (negativePrompt) {
        extraBody.negative_prompt = negativePrompt;
      }
      if (thinkingMode) {
        extraBody.thinking_mode = thinkingMode === "true";
      }
      if (enableSequential) {
        extraBody.enable_sequential = enableSequential === "true";
      }
      if (seedValue) {
        const parsedSeed = Number(seedValue);
        if (Number.isFinite(parsedSeed)) {
          extraBody.seed = parsedSeed;
        }
      }
      if (typeof input.values.watermark === "boolean") {
        extraBody.watermark = input.values.watermark;
      }
      assignJsonArray(extraBody, "bbox_list", input.values.bbox_list);
      assignJsonArray(extraBody, "color_palette", input.values.color_palette);

      return {
        prompt,
        size,
        n,
        response_format: responseFormat,
        image,
        mask,
        extra_body: extraBody,
      };
    }
    case "google-gemini": {
      const extraBody = { ...rawExtraBody };
      const imageSize = String(input.values.quality ?? "").trim();
      if (size) {
        extraBody.aspectRatio = size;
      }
      if (imageSize) {
        extraBody.imageSize = imageSize;
      }

      return {
        prompt,
        size,
        n,
        response_format: responseFormat,
        quality: imageSize,
        image,
        mask,
        extra_body: extraBody,
      };
    }
    default: {
      const extraBody = { ...rawExtraBody };
      const moderation = String(input.values.moderation ?? "").trim();
      if (moderation) {
        extraBody.moderation = moderation;
      }

      return {
        prompt,
        size,
        n,
        response_format: responseFormat,
        output_format: outputFormat,
        output_compression: outputCompression,
        quality: String(input.values.quality ?? "").trim() || undefined,
        style: String(input.values.style ?? "").trim() || undefined,
        background: String(input.values.background ?? "").trim() || undefined,
        image,
        mask,
        extra_body: extraBody,
      };
    }
  }
}

function assignJsonArray(target: Record<string, unknown>, key: string, value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return;
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${key} must be a JSON array.`);
  }

  target[key] = parsed;
}

function applyInvocationRecipe(draft: InvocationDraft, recipe: InvocationPlaybookRecipe): InvocationDraft {
  if (!recipe.values) {
    return draft;
  }

  return {
    ...draft,
    values: {
      ...draft.values,
      ...recipe.values,
    },
  };
}

function createInvocationDraft(): InvocationDraft {
  return {
    channelId: "",
    modelId: "",
    mode: "text-to-image",
    values: {},
    assets: createEmptyInvocationAssets(),
  };
}

function createEmptyInvocationAssets() {
  return {
    imageInputKind: "upload" as const,
    imageUrl: "",
    imageDataUrl: "",
    imageFileName: "",
    maskDataUrl: "",
    maskFileName: "",
  };
}

function parseExtraBody(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("Extra Body JSON must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Extra Body JSON must be an object.");
  }

  return parsed as Record<string, unknown>;
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
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Expected JSON from backend but received '${contentType || "unknown content type"}'.`,
    );
  }

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
