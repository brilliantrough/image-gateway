import type { ProtocolType } from "../types/config.js";

export const PROTOCOL_OPTIONS: Array<{ value: ProtocolType; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "azure-openai", label: "Azure OpenAI" },
  { value: "aliyun", label: "阿里云" },
  { value: "tencent", label: "腾讯云" },
  { value: "custom", label: "Custom" },
];

export function getProtocolLabel(protocolType: ProtocolType, protocolName?: string): string {
  if (protocolType === "custom") {
    return protocolName?.trim() || "Custom";
  }

  return PROTOCOL_OPTIONS.find((option) => option.value === protocolType)?.label ?? protocolType;
}
