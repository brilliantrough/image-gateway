export type GeminiImageModelFamily = "gemini-3-flash-image" | "gemini-3-pro-image" | "generic";

export type GeminiImageContract = {
  family: GeminiImageModelFamily;
  label: string;
  defaultAspectRatio: string;
  defaultImageSize: string;
  aspectRatios: string[];
  imageSizes: string[];
  familyNotes: string[];
};

const GEMINI_IMAGE_CONTRACTS: Record<GeminiImageModelFamily, GeminiImageContract> = {
  "gemini-3-flash-image": {
    family: "gemini-3-flash-image",
    label: "Gemini 3 Flash Image",
    defaultAspectRatio: "1:1",
    defaultImageSize: "1K",
    aspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "5:2", "2:5"],
    imageSizes: ["512", "1K", "2K", "4K"],
    familyNotes: [
      "Gemini 图片模型通过 `generateContent` 返回 inline image data，不是 OpenAI Images 协议。",
      "Flash Image 支持 `512`、`1K`、`2K`、`4K` imageSize，以及官方 Flash 专属 `5:2` / `2:5` 长宽比。",
    ],
  },
  "gemini-3-pro-image": {
    family: "gemini-3-pro-image",
    label: "Gemini 3 Pro Image",
    defaultAspectRatio: "1:1",
    defaultImageSize: "1K",
    aspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    imageSizes: ["1K", "2K", "4K"],
    familyNotes: [
      "Gemini Pro Image 使用 `generateContent` 的 `imageConfig` 控制输出图像。",
      "Pro Image 文档支持 `1K`、`2K`、`4K` imageSize。",
    ],
  },
  generic: {
    family: "generic",
    label: "Gemini Image",
    defaultAspectRatio: "1:1",
    defaultImageSize: "1K",
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    imageSizes: ["1K", "2K", "4K"],
    familyNotes: [
      "未识别到具体 Gemini 图片模型族，使用保守的 imageConfig 参数。",
      "如模型文档新增参数，应先更新 contract，再暴露 UI 控件。",
    ],
  },
};

export function inferGeminiImageFamily(modelName: string): GeminiImageModelFamily {
  const normalized = normalizeGeminiModelName(modelName);

  if (normalized.includes("flash-image")) {
    return "gemini-3-flash-image";
  }
  if (normalized.includes("pro-image")) {
    return "gemini-3-pro-image";
  }

  return "generic";
}

export function getGeminiImageContract(modelOrFamily: string | GeminiImageModelFamily): GeminiImageContract {
  const family = isGeminiImageFamily(modelOrFamily)
    ? modelOrFamily
    : inferGeminiImageFamily(modelOrFamily);
  return GEMINI_IMAGE_CONTRACTS[family];
}

function isGeminiImageFamily(value: string): value is GeminiImageModelFamily {
  return value in GEMINI_IMAGE_CONTRACTS;
}

function normalizeGeminiModelName(modelName: string): string {
  return modelName.toLowerCase().replaceAll("_", "-");
}
