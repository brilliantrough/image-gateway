export type ApimartModelFamily = "apimart-qwen-image" | "apimart-wan-image" | "generic";

export type ApimartModelContract = {
  family: ApimartModelFamily;
  label: string;
  defaultSize: string;
  defaultValues: Record<string, unknown>;
  fixedExtraFields: string[];
  familyNotes: string[];
};

const APIMART_MODEL_CONTRACTS: Record<ApimartModelFamily, ApimartModelContract> = {
  "apimart-qwen-image": {
    family: "apimart-qwen-image",
    label: "APIMart Qwen Image",
    defaultSize: "1:1",
    defaultValues: {
      resolution: "1K",
      negative_prompt: "",
    },
    fixedExtraFields: ["resolution", "negative_prompt"],
    familyNotes: [
      "Qwen Image 使用 `size` 比例、`resolution` 档位、`n` 和 `negative_prompt`。",
      "图生图输入通过网关的 image/images 映射到 APIMart `image_urls`。",
    ],
  },
  "apimart-wan-image": {
    family: "apimart-wan-image",
    label: "APIMart Wan 2.7 Image",
    defaultSize: "2K",
    defaultValues: {
      thinking_mode: "true",
      enable_sequential: "false",
      negative_prompt: "",
      seed: "",
      watermark: false,
      bbox_list: "[]",
      color_palette: "[]",
    },
    fixedExtraFields: [
      "thinking_mode",
      "enable_sequential",
      "negative_prompt",
      "watermark",
      "seed",
      "bbox_list",
      "color_palette",
    ],
    familyNotes: [
      "Wan 2.7 Image 使用 APIMart async 提交和轮询，但参数集不同于 Qwen Image。",
      "`bbox_list` 和 `color_palette` 是数组字段，前端用 JSON 文本填写后再发送。",
    ],
  },
  generic: {
    family: "generic",
    label: "APIMart Generic",
    defaultSize: "1:1",
    defaultValues: {},
    fixedExtraFields: [],
    familyNotes: [
      "未识别到具体 APIMart 模型族，固定控件只保留通用 async 字段。",
      "模型专属字段先放到 Extra Body JSON，确认文档后再提升为固定控件。",
    ],
  },
};

export function inferApimartModelFamily(modelName: string): ApimartModelFamily {
  const normalized = modelName.toLowerCase();

  if (normalized.includes("wan2.7-image")) {
    return "apimart-wan-image";
  }
  if (normalized.includes("qwen-image")) {
    return "apimart-qwen-image";
  }

  return "generic";
}

export function getApimartModelContract(modelOrFamily: string | ApimartModelFamily): ApimartModelContract {
  const family = isApimartModelFamily(modelOrFamily)
    ? modelOrFamily
    : inferApimartModelFamily(modelOrFamily);
  return APIMART_MODEL_CONTRACTS[family];
}

function isApimartModelFamily(value: string): value is ApimartModelFamily {
  return value in APIMART_MODEL_CONTRACTS;
}
