export type ArkModelFamily =
  | "ark-seedream-5"
  | "ark-seedream-4-5"
  | "ark-seedream-4"
  | "ark-seedream-3"
  | "ark-seededit-3"
  | "generic";

export type ArkModelContract = {
  family: ArkModelFamily;
  label: string;
  defaultSize: string;
  sizeHelpText: string;
  sizePresets: string[];
  allowPixelSize: boolean;
  minPixels?: number;
  maxPixels?: number;
  supportsSeed: boolean;
  supportsSequentialImageGeneration: boolean;
  supportsOutputFormat: boolean;
  familyNotes: string[];
};

const ARK_MODEL_CONTRACTS: Record<ArkModelFamily, ArkModelContract> = {
  "ark-seedream-5": {
    family: "ark-seedream-5",
    label: "Seedream 5.x",
    defaultSize: "2k",
    sizeHelpText:
      "官方文档允许 `2k`、`3k` 或 `WIDTHxHEIGHT`。像素模式需满足总像素范围 [3686400, 10404496]。",
    sizePresets: ["2k", "3k"],
    allowPixelSize: true,
    minPixels: 2_560 * 1_440,
    maxPixels: 10_404_496,
    supportsSeed: false,
    supportsSequentialImageGeneration: true,
    supportsOutputFormat: true,
    familyNotes: [
      "Seedream 5.x 通常优先用 `2k` 或更高档位尺寸，`output_format` 更有实际意义。",
      "如果你需要多图，优先在 group 模式下测试组图行为。",
    ],
  },
  "ark-seedream-4-5": {
    family: "ark-seedream-4-5",
    label: "Seedream 4.5",
    defaultSize: "2k",
    sizeHelpText:
      "官方文档允许 `2k`、`4k` 或 `WIDTHxHEIGHT`。像素模式需满足总像素范围 [3686400, 16777216]。",
    sizePresets: ["2k", "4k"],
    allowPixelSize: true,
    minPixels: 2_560 * 1_440,
    maxPixels: 4_096 * 4_096,
    supportsSeed: false,
    supportsSequentialImageGeneration: true,
    supportsOutputFormat: false,
    familyNotes: [
      "Seedream 4.x / 4.5 的 `size` 必须符合各自文档约束，不能再传 `1:1` 这类比例值。",
      "这两个家族默认不透传 seed。",
    ],
  },
  "ark-seedream-4": {
    family: "ark-seedream-4",
    label: "Seedream 4.x",
    defaultSize: "1k",
    sizeHelpText:
      "官方文档允许 `1k`、`2k`、`4k` 或 `WIDTHxHEIGHT`。像素模式需满足总像素范围 [921600, 16777216]。",
    sizePresets: ["1k", "2k", "4k"],
    allowPixelSize: true,
    minPixels: 1_280 * 720,
    maxPixels: 4_096 * 4_096,
    supportsSeed: false,
    supportsSequentialImageGeneration: true,
    supportsOutputFormat: false,
    familyNotes: [
      "Seedream 4.x / 4.5 的 `size` 必须符合各自文档约束，不能再传 `1:1` 这类比例值。",
      "这两个家族默认不透传 seed。",
    ],
  },
  "ark-seedream-3": {
    family: "ark-seedream-3",
    label: "Seedream 3.x T2I",
    defaultSize: "1024x1024",
    sizeHelpText:
      "该家族目前按像素尺寸使用更稳，建议使用 `1024x1024`、`1024x1792`、`1792x1024` 等明确值。",
    sizePresets: [],
    allowPixelSize: true,
    supportsSeed: true,
    supportsSequentialImageGeneration: false,
    supportsOutputFormat: false,
    familyNotes: [
      "Seedream 3.x 是当前 Ark 家族里 seed 语义最明确的一组。",
      "如果需要复现性，可以优先在这一家族上测试 seed。",
    ],
  },
  "ark-seededit-3": {
    family: "ark-seededit-3",
    label: "SeedEdit 3.x I2I",
    defaultSize: "1024x1024",
    sizeHelpText:
      "该家族目前按像素尺寸使用更稳，建议使用 `1024x1024`、`1024x1792`、`1792x1024` 等明确值。",
    sizePresets: [],
    allowPixelSize: true,
    supportsSeed: true,
    supportsSequentialImageGeneration: false,
    supportsOutputFormat: false,
    familyNotes: [
      "SeedEdit 3.x 更偏图生图/编辑，请务必提供源图。",
      "如果需要更稳定的编辑方向，可同时提供 mask 并明确写出保留区域。",
    ],
  },
  generic: {
    family: "generic",
    label: "Generic",
    defaultSize: "2k",
    sizeHelpText:
      "Ark 尺寸支持依赖模型家族。Seedream 4.0/4.5/5.0 不应再传 `1:1`、`16:9` 这类比例值作为 `size`。",
    sizePresets: [],
    allowPixelSize: true,
    supportsSeed: false,
    supportsSequentialImageGeneration: false,
    supportsOutputFormat: false,
    familyNotes: [
      "未识别到细分模型家族，当前使用通用 Ark 表单策略。",
      "如有更细的官方能力差异，建议后续继续补充该家族识别规则。",
    ],
  },
};

export function inferArkModelFamily(modelName: string): ArkModelFamily {
  const normalized = modelName.toLowerCase();

  if (normalized.includes("seedream-5-")) {
    return "ark-seedream-5";
  }
  if (normalized.includes("seedream-4-5")) {
    return "ark-seedream-4-5";
  }
  if (normalized.includes("seedream-4-")) {
    return "ark-seedream-4";
  }
  if (normalized.includes("seedream-3-0-t2i")) {
    return "ark-seedream-3";
  }
  if (normalized.includes("seededit-3-0-i2i")) {
    return "ark-seededit-3";
  }

  return "generic";
}

export function getArkModelContract(modelOrFamily: string | ArkModelFamily): ArkModelContract {
  const family = isArkModelFamily(modelOrFamily) ? modelOrFamily : inferArkModelFamily(modelOrFamily);
  return ARK_MODEL_CONTRACTS[family];
}

function isArkModelFamily(value: string): value is ArkModelFamily {
  return value in ARK_MODEL_CONTRACTS;
}
