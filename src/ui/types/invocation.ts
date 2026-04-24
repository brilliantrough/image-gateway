import type { InvocationMode } from "../lib/protocol-form-specs.js";

export type InvocationImageInputKind = "upload" | "url";

export type InvocationAssetsDraft = {
  imageInputKind: InvocationImageInputKind;
  imageUrl: string;
  imageDataUrl: string;
  imageFileName: string;
  maskDataUrl: string;
  maskFileName: string;
};

export type InvocationDraft = {
  channelId: string;
  modelId: string;
  mode: InvocationMode;
  values: Record<string, unknown>;
  assets: InvocationAssetsDraft;
};

export type InvocationResponse = {
  channelId: string;
  channelName: string;
  protocolType: string;
  modelId: string;
  displayName: string;
  providerModelName: string;
  mode: string;
  response: {
    request_id: string;
    data: Array<{
      url?: string | null;
      b64_json?: string | null;
      mime_type?: string | null;
      revised_prompt?: string | null;
    }>;
  };
};
