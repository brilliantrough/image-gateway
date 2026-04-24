import type { ProtocolType } from "../types/config.js";
import {
  getApimartModelContract,
  inferApimartModelFamily,
  type ApimartModelFamily,
} from "../../lib/apimart-async-contract.js";
import {
  getArkModelContract,
  inferArkModelFamily,
  type ArkModelFamily,
} from "../../lib/volcengine-ark-contract.js";
import {
  getGeminiImageContract,
  inferGeminiImageFamily,
  type GeminiImageModelFamily,
} from "../../lib/google-gemini-contract.js";

export type InvocationMode = "text-to-image" | "image-to-image" | "edit" | "group";

export type InvocationModelFamily =
  | "openai-gpt-image"
  | ArkModelFamily
  | "aliyun-qwen-image-2"
  | "aliyun-qwen-image-edit"
  | ApimartModelFamily
  | GeminiImageModelFamily
  | "generic";

export type InvocationFormContext = {
  mode: InvocationMode;
  modelName: string;
  modelFamily: InvocationModelFamily;
};

export type InvocationFieldKey =
  | "prompt"
  | "size"
  | "response_format"
  | "quality"
  | "style"
  | "background"
  | "output_format"
  | "output_compression"
  | "moderation"
  | "negative_prompt"
  | "seed"
  | "n"
  | "watermark"
  | "prompt_extend"
  | "resolution"
  | "thinking_mode"
  | "enable_sequential"
  | "bbox_list"
  | "color_palette"
  | "extra_body";

export type InvocationField = {
  key: InvocationFieldKey;
  label: string;
  kind: "text" | "textarea" | "number" | "select" | "json" | "checkbox";
  helpText?: string | ((context: InvocationFormContext) => string | undefined);
  placeholder?: string;
  options?: Array<{ label: string; value: string }> | ((context: InvocationFormContext) => Array<{ label: string; value: string }>);
  visibleWhen?: (context: InvocationFormContext) => boolean;
};

export type InvocationFieldGroup = {
  id: string;
  title: string;
  description?: string | ((context: InvocationFormContext) => string | undefined);
  fields: InvocationField[];
};

export type InvocationPlaybookRecipe = {
  id: string;
  title: string;
  summary: string;
  badge?: string;
  notes: string[];
  values?: Record<string, unknown>;
};

export type InvocationPlaybook = {
  title: string;
  description: string;
  recipes: InvocationPlaybookRecipe[];
};

export type ProtocolFormSpec = {
  protocolType: ProtocolType;
  title: string;
  description: string;
  supportedModes: InvocationMode[];
  defaultMode: InvocationMode;
  hints: string[];
  groups: InvocationFieldGroup[];
  resolveModelFamily: (modelName: string) => InvocationModelFamily;
  getFamilyLabel: (family: InvocationModelFamily) => string;
  getFamilyNotes: (context: InvocationFormContext) => string[];
  getPlaybook: (context: InvocationFormContext) => InvocationPlaybook;
  getInitialValues(modelName: string): Record<string, unknown>;
};

const responseFormatField: InvocationField = {
  key: "response_format",
  label: "Response Format",
  kind: "select",
  options: [
    { label: "b64_json", value: "b64_json" },
    { label: "url", value: "url" },
  ],
};

const openAiSizeOptions = [
  { label: "1024x1024", value: "1024x1024" },
  { label: "1024x1536", value: "1024x1536" },
  { label: "1536x1024", value: "1536x1024" },
  { label: "auto", value: "auto" },
];

const squareSizeOptions = [
  { label: "2048x2048 · 1:1 default", value: "2048x2048" },
  { label: "2688x1536 · 16:9", value: "2688x1536" },
  { label: "1536x2688 · 9:16", value: "1536x2688" },
  { label: "2368x1728 · 4:3", value: "2368x1728" },
  { label: "1728x2368 · 3:4", value: "1728x2368" },
];

const ratioSizeOptions = [
  { label: "1:1", value: "1:1" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "3:2", value: "3:2" },
  { label: "2:3", value: "2:3" },
];

const outputFormatOptions = [
  { label: "Default", value: "" },
  { label: "png", value: "png" },
  { label: "jpeg", value: "jpeg" },
  { label: "webp", value: "webp" },
];

const imageCountOptions = [
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
];

const imageCountUpToSixOptions = [
  ...imageCountOptions,
  { label: "5", value: "5" },
  { label: "6", value: "6" },
];

const resolutionOptions = [
  { label: "1K", value: "1K" },
  { label: "2K", value: "2K" },
];

const arkFamilyLabels: Record<InvocationModelFamily, string> = {
  "ark-seedream-5": getArkModelContract("ark-seedream-5").label,
  "ark-seedream-4-5": getArkModelContract("ark-seedream-4-5").label,
  "ark-seedream-4": getArkModelContract("ark-seedream-4").label,
  "ark-seedream-3": getArkModelContract("ark-seedream-3").label,
  "ark-seededit-3": getArkModelContract("ark-seededit-3").label,
  "aliyun-qwen-image-2": "Qwen Image 2.x",
  "aliyun-qwen-image-edit": "Qwen Image Edit",
  "apimart-qwen-image": getApimartModelContract("apimart-qwen-image").label,
  "apimart-wan-image": getApimartModelContract("apimart-wan-image").label,
  "gemini-3-flash-image": getGeminiImageContract("gemini-3-flash-image").label,
  "gemini-3-pro-image": getGeminiImageContract("gemini-3-pro-image").label,
  "openai-gpt-image": "GPT Image",
  generic: "Generic",
};

export function getProtocolFormSpec(protocolType: ProtocolType): ProtocolFormSpec {
  switch (protocolType) {
    case "volcengine-ark":
      return {
        protocolType,
        title: "Volcengine Ark Invocation",
        description: "Dedicated Ark ImageGenerations form for Seedream and SeedEdit families.",
        supportedModes: ["text-to-image", "image-to-image", "edit", "group"],
        defaultMode: "text-to-image",
        hints: [
          "Ark 不同模型家族对尺寸、seed、输出格式和组图能力的支持差异很大。",
          "建议优先使用浏览器上传或公网 URL，不要混用多张图片和掩码的语义。",
        ],
        groups: [
          {
            id: "prompt",
            title: "Prompt",
            description: (context) =>
              context.modelFamily === "ark-seededit-3"
                ? "SeedEdit 更偏向编辑/重绘，提示词建议强调要保留的主体与要替换的风格。"
                : "Seedream 更适合直接描述构图、光线、风格和细节密度。",
            fields: [
              {
                key: "prompt",
                label: "Prompt",
                kind: "textarea",
                helpText: (context) =>
                  context.mode === "edit"
                    ? "编辑模式下建议明确“保留什么”和“替换什么”。"
                    : "直接描述主体、风格、镜头语言和画面细节。",
              },
              {
                key: "negative_prompt",
                label: "Negative Prompt",
                kind: "textarea",
                visibleWhen: ({ modelFamily }) => modelFamily === "ark-seedream-3",
                helpText: "当前仅保留为 Seedream 3.x 扩展占位，其他 Ark 家族请走 Extra Body JSON。",
              },
            ],
          },
          {
            id: "output",
            title: "Output",
            description: "输出尺寸、返回格式和基础产物数量。",
            fields: [
              {
                key: "size",
                label: "Size",
                kind: "text",
                helpText: (context) => getArkSizeHelpText(context.modelFamily),
                placeholder: "2k or 2560x1440",
              },
              responseFormatField,
              {
                key: "output_format",
                label: "Output Format",
                kind: "select",
                options: outputFormatOptions,
                visibleWhen: ({ modelFamily }) => getArkModelContract(modelFamily).supportsOutputFormat,
                helpText: "按 Seedream 5.0 lite 文档作为固定控件暴露；其他 Ark 家族不显示。",
              },
              {
                key: "n",
                label: "Image Count",
                kind: "select",
                options: imageCountOptions,
                visibleWhen: ({ mode, modelFamily }) =>
                  (mode === "text-to-image" || mode === "group") &&
                  modelFamily !== "ark-seededit-3",
                helpText: (context) =>
                  context.mode === "group"
                    ? "组图模式会映射到 Ark 的 sequential image generation。"
                    : "多图输出会按模型家族映射为组图能力或顺序生成。",
              },
            ],
          },
          {
            id: "controls",
            title: "Advanced Controls",
            description: "常用高级参数面板。面板值会优先覆盖 Raw JSON 里的同名字段。",
            fields: [
              {
                key: "watermark",
                label: "Watermark",
                kind: "checkbox",
                helpText: "控制 Ark 上游是否带水印。",
              },
              {
                key: "seed",
                label: "Seed",
                kind: "number",
                visibleWhen: ({ modelFamily }) => getArkModelContract(modelFamily).supportsSeed,
                helpText:
                  "Ark 目前仅对 Seedream 3.x T2I / SeedEdit 3.x I2I 明确支持 seed，4.x/4.5/5.x 默认不透传。",
              },
            ],
          },
          {
            id: "raw-json",
            title: "Raw JSON Fallback",
            description: "只用于文档外或后续新增的 Ark 字段；固定表单不会混入未核验参数。",
            fields: [
              {
                key: "extra_body",
                label: "Extra Body JSON",
                kind: "json",
                helpText: (context) => getArkExtraBodyHelpText(context.modelFamily, context.mode),
                placeholder: '{\n  "stream": false\n}',
              },
            ],
          },
        ],
        resolveModelFamily: inferArkModelFamily,
        getFamilyLabel: (family) => arkFamilyLabels[family] ?? "Generic",
        getFamilyNotes: getArkFamilyNotes,
        getPlaybook: getArkPlaybook,
        getInitialValues(modelName) {
          return getArkDefaultValues(inferArkModelFamily(modelName));
        },
      };
    case "aliyun-qwen-image":
      return {
        protocolType,
        title: "Aliyun Qwen Image Invocation",
        description: "Native DashScope Qwen Image request form.",
        supportedModes: ["text-to-image", "image-to-image", "edit"],
        defaultMode: "text-to-image",
        hints: [
          "阿里云图像协议是 `model + input.messages + parameters`，不是 OpenAI Images 原生体。",
          "Token Plan 文本兼容 Base URL 不能直接当图像 endpoint；网关会把 `/compatible-mode/v1` 改到图像接口。",
          "固定控件仅暴露阿里云文档已列出的通用参数；其他字段仍放在 Extra Body JSON。",
        ],
        groups: [
          {
            id: "prompt",
            title: "Prompt",
            description: "Qwen Image 直接使用 messages content，图像和 mask 会追加到同一条用户消息中。",
            fields: [
              {
                key: "prompt",
                label: "Prompt",
                kind: "textarea",
              },
              {
                key: "negative_prompt",
                label: "Negative Prompt",
                kind: "textarea",
                helpText: "会映射到 `parameters.negative_prompt`。",
              },
            ],
          },
          {
            id: "output",
            title: "Output",
            description: "阿里云原生 `size` 使用 `宽*高`；UI 用更易读的 `x`，提交时自动转换。",
            fields: [
              {
                key: "size",
                label: "Size",
                kind: "select",
                helpText: "例如 `1024x1024` 会被转换成 `1024*1024`。",
                options: squareSizeOptions,
                placeholder: "2048x2048",
              },
              {
                key: "n",
                label: "Image Count",
                kind: "select",
                options: imageCountUpToSixOptions,
                helpText: "Qwen Image 2.0 系列支持 1-6 张。",
              },
            ],
          },
          {
            id: "controls",
            title: "Advanced Parameters",
            description: (context) =>
              context.modelFamily === "aliyun-qwen-image-edit"
                ? "编辑模型建议优先在这里设置常用参数，再用 Raw JSON 补充细项。"
                : "文生图模型常见的 `prompt_extend`、`watermark` 建议在这里设置。",
            fields: [
              {
                key: "watermark",
                label: "Watermark",
                kind: "checkbox",
                helpText: "映射到阿里云 `parameters.watermark`。",
              },
              {
                key: "prompt_extend",
                label: "Prompt Extend",
                kind: "checkbox",
                helpText: "映射到阿里云 `parameters.prompt_extend`。",
              },
            ],
          },
          {
            id: "raw-json",
            title: "Raw JSON Fallback",
            description: "继续补充协议支持但当前未单独建控件的 parameters 字段。",
            fields: [
              {
                key: "extra_body",
                label: "Extra Body JSON",
                kind: "json",
                helpText:
                  "固定控件外的阿里云 parameters 字段可放这里，但不要重复填写已展示的固定字段。",
                placeholder: '{\n  "watermark": false,\n  "prompt_extend": true\n}',
              },
            ],
          },
        ],
        resolveModelFamily: inferAliyunModelFamily,
        getFamilyLabel: (family) => arkFamilyLabels[family] ?? "Generic",
        getFamilyNotes: getAliyunFamilyNotes,
        getPlaybook: getAliyunPlaybook,
        getInitialValues(modelName) {
          const family = inferAliyunModelFamily(modelName);

          return {
            prompt:
              family === "aliyun-qwen-image-edit"
                ? "保留主体轮廓，把整张图改成细腻的卡通插画风格。"
                : "一只带电影感光影的橘猫，坐在窗边。",
            size: "1024x1024",
            n: 1,
            negative_prompt: "",
            watermark: false,
            prompt_extend: true,
            extra_body: "{}",
          };
        },
      };
    case "apimart-async":
      return {
        protocolType,
        title: "APIMart Async Invocation",
        description: "Async task submission form with polling.",
        supportedModes: ["text-to-image", "image-to-image", "edit"],
        defaultMode: "text-to-image",
        hints: [
          "APIMart 是异步任务协议，提交快但成功出图通常需要轮询等待。",
          "固定控件会按模型族切换，Qwen 与 Wan 不共用同一套参数。",
        ],
        groups: [
          {
            id: "prompt",
            title: "Prompt",
            fields: [
              { key: "prompt", label: "Prompt", kind: "textarea" },
              {
                key: "negative_prompt",
                label: "Negative Prompt",
                kind: "textarea",
                helpText: "当前通过 Extra Body JSON 更稳妥；该字段本身不直接映射到固定 submit 字段。",
                visibleWhen: () => false,
              },
            ],
          },
          {
            id: "output",
            title: "Output",
            description: (context) =>
              context.modelFamily === "apimart-wan-image"
                ? "Wan 2.7 Image 使用分辨率档位或比例类 size，并支持单图或序列图。"
                : "按照 APIMart Qwen Image 文档，比例与分辨率档位分开配置。",
            fields: [
              {
                key: "size",
                label: "Size",
                kind: "select",
                helpText: (context) =>
                  context.modelFamily === "apimart-wan-image"
                    ? "Wan 2.7 Image 支持 2K/4K 或比例值。"
                    : "比例字段。",
                options: (context) =>
                  context.modelFamily === "apimart-wan-image"
                    ? [
                        { label: "2K", value: "2K" },
                        { label: "4K", value: "4K" },
                        ...ratioSizeOptions,
                      ]
                    : ratioSizeOptions,
                placeholder: "1:1",
              },
              {
                key: "resolution",
                label: "Resolution",
                kind: "select",
                options: resolutionOptions,
                helpText: "APIMart Qwen Image 文档提供 1K/2K 两档。",
                visibleWhen: ({ modelFamily }) => modelFamily === "apimart-qwen-image",
              },
              {
                key: "n",
                label: "Image Count",
                kind: "select",
                options: imageCountUpToSixOptions,
                helpText: "文档范围为 1-6。",
              },
              {
                key: "response_format",
                label: "Response Format",
                kind: "select",
                options: [
                  { label: "url", value: "url" },
                  { label: "b64_json", value: "b64_json" },
                ],
                helpText: "这是网关本地返回格式，不会下发到 APIMart submit 请求。",
              },
            ],
          },
          {
            id: "controls",
            title: "Protocol Controls",
            description: (context) =>
              context.modelFamily === "apimart-wan-image"
                ? "Wan 固定控件按官方文档暴露；数组字段用 JSON 文本填写。"
                : "固定控件仅保留 APIMart 文档已公开的字段。",
            fields: [
              {
                key: "negative_prompt",
                label: "Negative Prompt",
                kind: "textarea",
                helpText: "会通过 Extra Body JSON 透传为同名字段。",
              },
              {
                key: "thinking_mode",
                label: "Thinking Mode",
                kind: "select",
                options: [
                  { label: "true", value: "true" },
                  { label: "false", value: "false" },
                ],
                visibleWhen: ({ modelFamily }) => modelFamily === "apimart-wan-image",
                helpText: "Wan 2.7 Image 文档参数，会转换为布尔值。",
              },
              {
                key: "enable_sequential",
                label: "Enable Sequential",
                kind: "select",
                options: [
                  { label: "false", value: "false" },
                  { label: "true", value: "true" },
                ],
                visibleWhen: ({ modelFamily }) => modelFamily === "apimart-wan-image",
                helpText: "生成序列图时开启，会转换为布尔值。",
              },
              {
                key: "seed",
                label: "Seed",
                kind: "number",
                visibleWhen: ({ modelFamily }) => modelFamily === "apimart-wan-image",
                helpText: "可选随机种子，留空则不发送。",
              },
              {
                key: "watermark",
                label: "Watermark",
                kind: "checkbox",
                visibleWhen: ({ modelFamily }) => modelFamily === "apimart-wan-image",
                helpText: "Wan 2.7 Image 文档参数。",
              },
              {
                key: "bbox_list",
                label: "BBox List JSON",
                kind: "json",
                visibleWhen: ({ modelFamily }) => modelFamily === "apimart-wan-image",
                helpText: "Wan 2.7 Image 的 bbox_list 数组，必须是 JSON 数组。",
                placeholder: "[]",
              },
              {
                key: "color_palette",
                label: "Color Palette JSON",
                kind: "json",
                visibleWhen: ({ modelFamily }) => modelFamily === "apimart-wan-image",
                helpText: "Wan 2.7 Image 的 color_palette 数组，必须是 JSON 数组。",
                placeholder: "[]",
              },
              {
                key: "extra_body",
                label: "Extra Body JSON",
                kind: "json",
                helpText:
                  "只用于补充该协议后续新增字段；固定字段会优先写入并覆盖同名键。",
                placeholder: '{\n  "image_urls": [\"https://example.com/source.png\"]\n}',
              },
            ],
          },
        ],
        resolveModelFamily: inferApimartModelFamily,
        getFamilyLabel: (family) => arkFamilyLabels[family] ?? "Generic",
        getFamilyNotes: (context) => getApimartModelContract(context.modelFamily).familyNotes,
        getPlaybook: getApimartPlaybook,
        getInitialValues(modelName) {
          const contract = getApimartModelContract(modelName);

          return {
            prompt: "一只带电影感光影的橘猫，坐在窗边。",
            size: contract.defaultSize,
            ...contract.defaultValues,
            response_format: "url",
            n: 1,
            extra_body: "{}",
          };
        },
      };
    case "google-gemini":
      return {
        protocolType,
        title: "Google Gemini Image Invocation",
        description: "Native Gemini generateContent image generation form.",
        supportedModes: ["text-to-image", "image-to-image"],
        defaultMode: "text-to-image",
        hints: [
          "Gemini 图片生成走 `models/{model}:generateContent`，不是 OpenAI Images 协议。",
          "Base URL 建议配置 `https://generativelanguage.googleapis.com/v1beta`，网关会自动拼接模型路径。",
        ],
        groups: [
          {
            id: "prompt",
            title: "Prompt",
            fields: [{ key: "prompt", label: "Prompt", kind: "textarea" }],
          },
          {
            id: "output",
            title: "Image Config",
            description: "Gemini 使用 `imageConfig.aspectRatio` 和 `imageConfig.imageSize` 控制输出。",
            fields: [
              {
                key: "size",
                label: "Aspect Ratio",
                kind: "select",
                options: (context) =>
                  getGeminiImageContract(context.modelFamily).aspectRatios.map((value) => ({
                    label: value,
                    value,
                  })),
                helpText: "映射到 Gemini `imageConfig.aspectRatio`。",
              },
              {
                key: "quality",
                label: "Image Size",
                kind: "select",
                options: (context) =>
                  getGeminiImageContract(context.modelFamily).imageSizes.map((value) => ({
                    label: value,
                    value,
                  })),
                helpText: "映射到 Gemini `imageConfig.imageSize`；必须使用官方枚举大小写。",
              },
              responseFormatField,
            ],
          },
          {
            id: "raw-json",
            title: "Raw JSON Fallback",
            description: "可放 Gemini generateContent 的额外顶层字段；固定字段会覆盖同名键。",
            fields: [
              {
                key: "extra_body",
                label: "Extra Body JSON",
                kind: "json",
                helpText: "不要在这里重复填写 contents、generationConfig、imageConfig。",
                placeholder: "{}",
              },
            ],
          },
        ],
        resolveModelFamily: inferGeminiImageFamily,
        getFamilyLabel: (family) => arkFamilyLabels[family] ?? "Gemini Image",
        getFamilyNotes: (context) => getGeminiImageContract(context.modelFamily).familyNotes,
        getPlaybook: getGeminiPlaybook,
        getInitialValues(modelName) {
          const contract = getGeminiImageContract(modelName);

          return {
            prompt: "一只带电影感光影的橘猫，坐在窗边。",
            size: contract.defaultAspectRatio,
            quality: contract.defaultImageSize,
            response_format: "b64_json",
            n: 1,
            extra_body: "{}",
          };
        },
      };
    default:
      return {
        protocolType,
        title: "OpenAI-Compatible Invocation",
        description: "OpenAI-compatible image generation form.",
        supportedModes: ["text-to-image", "image-to-image", "edit"],
        defaultMode: "text-to-image",
        hints: [
          "这里的固定控件以 OpenAI 官方 Images API 为基准。",
          "第三方兼容上游如果拒绝某些官方字段，请再退回 Extra Body JSON 或后台兼容开关。",
        ],
        groups: [
          {
            id: "prompt",
            title: "Prompt",
            fields: [{ key: "prompt", label: "Prompt", kind: "textarea" }],
          },
          {
            id: "output",
            title: "Output",
            description: "标准 OpenAI 风格输出参数。",
            fields: [
              {
                key: "size",
                label: "Size",
                kind: "select",
                options: (context) =>
                  context.modelFamily === "openai-gpt-image" ? openAiSizeOptions : openAiSizeOptions,
                placeholder: "1024x1024",
              },
              {
                key: "output_format",
                label: "Output Format",
                kind: "select",
                options: outputFormatOptions,
                visibleWhen: ({ modelFamily }) => modelFamily === "openai-gpt-image",
                helpText: "OpenAI 官方 `gpt-image-*` 支持 `png/jpeg/webp`。",
              },
              {
                key: "output_compression",
                label: "Output Compression",
                kind: "select",
                visibleWhen: ({ modelFamily }) => modelFamily === "openai-gpt-image",
                options: [
                  { label: "Default", value: "" },
                  { label: "100", value: "100" },
                  { label: "90", value: "90" },
                  { label: "80", value: "80" },
                  { label: "70", value: "70" },
                ],
                helpText: "仅 `jpeg/webp` 有意义。",
              },
              {
                key: "response_format",
                label: "Response Format",
                kind: "select",
                options: [
                  { label: "b64_json", value: "b64_json" },
                  { label: "url", value: "url" },
                ],
                visibleWhen: ({ modelFamily }) => modelFamily !== "openai-gpt-image",
                helpText: "`gpt-image-*` 官方响应默认返回 base64；`url` 主要给 DALL-E 兼容模型使用。",
              },
            ],
          },
          {
            id: "controls",
            title: "Quality Controls",
            fields: [
              {
                key: "quality",
                label: "Quality",
                kind: "select",
                options: [
                  { label: "Default", value: "" },
                  { label: "auto", value: "auto" },
                  { label: "low", value: "low" },
                  { label: "medium", value: "medium" },
                  { label: "high", value: "high" },
                ],
              },
              {
                key: "moderation",
                label: "Moderation",
                kind: "select",
                visibleWhen: ({ modelFamily }) => modelFamily === "openai-gpt-image",
                options: [
                  { label: "Default", value: "" },
                  { label: "auto", value: "auto" },
                  { label: "low", value: "low" },
                ],
              },
              {
                key: "style",
                label: "Style",
                kind: "select",
                options: [
                  { label: "Default", value: "" },
                  { label: "vivid", value: "vivid" },
                  { label: "natural", value: "natural" },
                ],
                visibleWhen: ({ modelFamily }) => modelFamily !== "openai-gpt-image",
              },
              {
                key: "background",
                label: "Background",
                kind: "select",
                options: [
                  { label: "Default", value: "" },
                  { label: "auto", value: "auto" },
                  { label: "transparent", value: "transparent" },
                  { label: "opaque", value: "opaque" },
                ],
              },
            ],
          },
          {
            id: "advanced",
            title: "Advanced JSON",
            description: "用于 provider-specific 扩展字段。",
            fields: [{ key: "extra_body", label: "Extra Body JSON", kind: "json" }],
          },
        ],
        resolveModelFamily: inferOpenAICompatibleModelFamily,
        getFamilyLabel: (family) => arkFamilyLabels[family] ?? "Generic",
        getFamilyNotes: (context) =>
          context.modelFamily === "openai-gpt-image"
            ? [
                "如果接的是 OpenAI 官方 `gpt-image-*`，这组字段通常最接近真实行为。",
                "若是第三方兼容服务，`response_format`、`quality`、`background` 可能会被部分拒绝。",
              ]
            : [
                "第三方兼容协议经常只支持部分 OpenAI 字段。",
                "如果上游会拒绝 `response_format`，请在 Config Center 打开 strip response_format。",
              ],
        getPlaybook: getOpenAICompatiblePlaybook,
        getInitialValues(modelName) {
          return {
            prompt: "一只带电影感光影的橘猫，坐在窗边。",
            size: "1024x1024",
            response_format: "b64_json",
            quality: "",
            style: "",
            background: "",
            output_format: "",
            output_compression: "",
            moderation: "",
            extra_body: "{}",
            ...(inferOpenAICompatibleModelFamily(modelName) === "openai-gpt-image"
              ? {
                  quality: "high",
                  output_format: "png",
                  response_format: "b64_json",
                }
              : {}),
          };
        },
      };
  }
}

export function buildInvocationFormContext(input: {
  protocolType: ProtocolType;
  mode: InvocationMode;
  modelName: string;
}): InvocationFormContext {
  const spec = getProtocolFormSpec(input.protocolType);
  const modelFamily = spec.resolveModelFamily(input.modelName);

  return {
    mode: input.mode,
    modelName: input.modelName,
    modelFamily,
  };
}

function inferAliyunModelFamily(modelName: string): InvocationModelFamily {
  const normalized = modelName.toLowerCase();

  if (normalized.includes("qwen-image-edit")) {
    return "aliyun-qwen-image-edit";
  }
  if (normalized.includes("qwen-image-2")) {
    return "aliyun-qwen-image-2";
  }

  return "generic";
}

function inferOpenAICompatibleModelFamily(modelName: string): InvocationModelFamily {
  if (modelName.toLowerCase().includes("gpt-image")) {
    return "openai-gpt-image";
  }

  return "generic";
}

function getArkDefaultValues(family: InvocationModelFamily): Record<string, unknown> {
  const contract = getArkModelContract(family);

  switch (family) {
    case "ark-seedream-5":
      return {
        prompt: "一只带电影感光影的橘猫，坐在窗边。",
        size: contract.defaultSize,
        response_format: "url",
        output_format: "png",
        n: 1,
        seed: "",
        watermark: false,
        extra_body: "{}",
      };
    case "ark-seedream-4-5":
    case "ark-seedream-4":
      return {
        prompt: "一只带电影感光影的橘猫，坐在窗边。",
        size: contract.defaultSize,
        response_format: "url",
        output_format: "",
        n: 1,
        seed: "",
        watermark: false,
        extra_body: "{}",
      };
    case "ark-seededit-3":
      return {
        prompt: "保留主体，把图片里的猫改成卡通插画风格。",
        size: contract.defaultSize,
        response_format: "url",
        output_format: "",
        n: 1,
        seed: "123456",
        watermark: false,
        extra_body: "{}",
      };
    default:
      return {
        prompt: "一只带电影感光影的橘猫，坐在窗边。",
        size: contract.defaultSize,
        response_format: "url",
        output_format: "",
        n: 1,
        seed: contract.supportsSeed ? "123456" : "",
        watermark: false,
        extra_body: "{}",
      };
  }
}

function getArkFamilyNotes(context: InvocationFormContext): string[] {
  return getArkModelContract(context.modelFamily).familyNotes;
}

function getAliyunFamilyNotes(context: InvocationFormContext): string[] {
  if (context.modelFamily === "aliyun-qwen-image-edit") {
    return [
      "当前会把图片、mask 一并组织进 `input.messages[].content`。",
      "常见扩展项如 `prompt_extend`、`watermark` 建议继续放在 Extra Body JSON。",
    ];
  }

  return [
    "Qwen Image 2.x 文生图默认更适合直接走 `prompt + parameters` 组合。",
    "网关会在需要时把结果 URL 下载成 `b64_json`。",
  ];
}

function getArkSizeHelpText(family: InvocationModelFamily): string {
  return getArkModelContract(family).sizeHelpText;
}

function getArkExtraBodyHelpText(
  family: InvocationModelFamily,
  mode: InvocationMode,
): string {
  const base = "可放 Ark 特有字段，如 `stream`、`tools`、组图附加控制等。";

  if (mode === "group") {
    return `${base} 组图模式下也可补充 sequential image generation 相关控制。`;
  }

  if (family === "ark-seededit-3") {
    return `${base} 编辑模型建议结合 mask 和编辑指令一起测试。`;
  }

  if (family === "ark-seedream-5") {
    return `${base} Seedream 5.x 场景下还可以重点测试输出质量相关扩展参数。`;
  }

  return base;
}

function getArkPlaybook(context: InvocationFormContext): InvocationPlaybook {
  if (context.modelFamily === "ark-seededit-3") {
    return {
      title: "Protocol Playbook",
      description: "按 Ark SeedEdit 的编辑语义组织提示词、尺寸和常用补充参数。",
      recipes: [
        {
          id: "ark-edit-cartoon",
          title: "Cartoon Restyle",
          summary: "适合单主体图片改风格，尽量保留轮廓和构图。",
          badge: "Edit",
          values: {
            prompt: "保留主体轮廓，把图片里的猫改成卡通插画风格，保留动作和构图。",
            size: "1024x1024",
            response_format: "url",
            seed: "123456",
            extra_body: JSON.stringify({ watermark: false }, null, 2),
          },
          notes: [
            "编辑模式建议明确写出要保留的主体和要替换的风格。",
            "如果局部修改明显，建议同时上传 mask。",
          ],
        },
        {
          id: "ark-edit-preserve",
          title: "Preserve Composition",
          summary: "适合保留背景和镜头关系，只改主体质感或材质。",
          badge: "I2I",
          values: {
            prompt: "保持原始构图和背景关系，只把主体变成高细节 3D 卡通材质。",
            size: "1024x1024",
            response_format: "url",
            seed: "123456",
            extra_body: JSON.stringify({ watermark: false }, null, 2),
          },
          notes: [
            "如果结果漂移大，先降低 prompt 改动幅度。",
            "需要更稳定时保留 seed。",
          ],
        },
      ],
    };
  }

  return {
    title: "Protocol Playbook",
    description: "按 Ark Seedream 家族常见工作流给出推荐参数起点。",
    recipes: [
      {
        id: "ark-poster",
        title: "Poster Baseline",
        summary: "适合海报和高细节宣传图，优先保留较高尺寸与 PNG 输出。",
        badge: "T2I",
        values: {
          prompt: "生成一张高质感电影海报：霓虹夜景中的橘猫，镜头压低，戏剧性光影，海报排版留白。",
          size: getArkModelContract(context.modelFamily).defaultSize,
          response_format: "url",
          output_format: getArkModelContract(context.modelFamily).supportsOutputFormat ? "png" : "",
          n: 1,
          extra_body: JSON.stringify({ watermark: false }, null, 2),
        },
        notes: [
          "Seedream 5.x 建议优先 `2k`，Seedream 3.x 更适合明确像素尺寸。",
          "如果是海报场景，prompt 里直接写构图和留白会比事后编辑更稳定。",
        ],
      },
      {
        id: "ark-batch",
        title: "Batch Variants",
        summary: "适合一次性出多张候选图，后续再精修。",
        badge: "Group",
        values: {
          prompt: "同一主体的三种风格变体：电影写实、日系插画、极简平面设计。",
          size: getArkModelContract(context.modelFamily).defaultSize,
          response_format: "url",
          n: 3,
          extra_body: JSON.stringify(
            { watermark: false, sequential_image_generation: true },
            null,
            2,
          ),
        },
        notes: [
          "更适合在 group 模式下使用。",
          "如果模型家族不支持多图，会退化成顺序生成语义。",
        ],
      },
    ],
  };
}

function getAliyunPlaybook(context: InvocationFormContext): InvocationPlaybook {
  if (context.modelFamily === "aliyun-qwen-image-edit") {
    return {
      title: "Protocol Playbook",
      description: "按 Qwen Image Edit 的 messages + parameters 结构给出常用编辑模板。",
      recipes: [
        {
          id: "aliyun-edit-restyle",
          title: "Restyle Edit",
          summary: "保留主体结构，整体转成插画或卡通风格。",
          badge: "Edit",
          values: {
            prompt: "保留主体轮廓和姿态，把整张图改成柔和的卡通插画风格。",
            size: "1024x1024",
            response_format: "b64_json",
            prompt_extend: true,
            extra_body: JSON.stringify({ watermark: false }, null, 2),
          },
          notes: [
            "阿里云编辑协议会把图片和 mask 一起放到 `input.messages[].content`。",
            "如果只想改局部，建议同时上传 mask。",
          ],
        },
      ],
    };
  }

  return {
    title: "Protocol Playbook",
    description: "按 Qwen Image 2.x 文生图场景给出一组可直接套用的建议值。",
    recipes: [
      {
        id: "aliyun-cinematic",
        title: "Cinematic Poster",
        summary: "适合直接测试阿里云原生协议的高质量文生图链路。",
        badge: "T2I",
        values: {
          prompt: "生成一张电影感极强的橘猫海报，暖色逆光，镜头层次丰富，画面中心主体突出。",
          size: "1024x1024",
          response_format: "b64_json",
          prompt_extend: true,
          extra_body: JSON.stringify({ watermark: false }, null, 2),
        },
        notes: [
          "如果你希望模型主动润色提示词，保留 `prompt_extend=true`。",
          "需要直观预览时建议保留 `b64_json`。",
        ],
      },
      {
        id: "aliyun-clean",
        title: "Clean Prompt Run",
        summary: "关闭提示词扩写，方便观察原始 prompt 的直接效果。",
        badge: "Direct",
        values: {
          prompt: "一只橘猫坐在窗边，午后阳光，浅景深，真实摄影风格。",
          size: "1024x1024",
          response_format: "b64_json",
          prompt_extend: false,
          extra_body: JSON.stringify({ watermark: false }, null, 2),
        },
        notes: [
          "适合做 prompt 对比实验。",
          "如果结果偏散，可以再手动补细节而不是打开扩写。",
        ],
      },
    ],
  };
}

function getApimartPlaybook(): InvocationPlaybook {
  return {
    title: "Protocol Playbook",
    description: "APIMart 更适合把 provider-specific 参数收拢到 Extra Body JSON 中。",
    recipes: [
      {
        id: "apimart-qwen-default",
        title: "Qwen Async Baseline",
        summary: "适合先打通异步提交流程，再看轮询和结果转码表现。",
        badge: "Async",
        values: {
          prompt: "生成一张电影感橘猫海报，柔和光影，主体居中。",
          size: "1:1",
          response_format: "url",
          n: 1,
          resolution: "2K",
          extra_body: JSON.stringify({ watermark: false }, null, 2),
        },
        notes: [
          "先用最少字段验证 submit 和 poll 是否正常。",
          "更细的模型参数建议都继续放在 Extra Body JSON。",
        ],
      },
    ],
  };
}

function getGeminiPlaybook(context: InvocationFormContext): InvocationPlaybook {
  const contract = getGeminiImageContract(context.modelFamily);

  return {
    title: "Protocol Playbook",
    description: "按 Gemini generateContent 图片协议给出推荐参数起点。",
    recipes: [
      {
        id: "gemini-poster",
        title: "Cinematic Poster",
        summary: "适合先验证 Gemini 图片生成链路和 inline image 返回。",
        badge: "Gemini",
        values: {
          prompt: "生成一张电影感橘猫海报，暖色逆光，画面中心主体突出，细节丰富。",
          size: contract.defaultAspectRatio,
          quality: contract.defaultImageSize,
          response_format: "b64_json",
          extra_body: "{}",
        },
        notes: [
          "Gemini 图片结果以 inline image data 返回，网关会规范成 `b64_json`。",
          "如果要图生图，请上传图片；当前适配器要求 data URL 输入。",
        ],
      },
    ],
  };
}

function getOpenAICompatiblePlaybook(context: InvocationFormContext): InvocationPlaybook {
  return {
    title: "Protocol Playbook",
    description: "适合 OpenAI 官方或第三方兼容协议的常见试跑模板。",
    recipes: [
      {
        id: "openai-high-quality",
        title: "High Quality PNG",
        summary: "适合官方 `gpt-image-*` 或高兼容上游的默认高质量出图。",
        badge: "Compat",
        values: {
          prompt: "生成一张高质量电影剧照风格橘猫肖像，层次感强，背景柔和虚化。",
          size: "1024x1024",
          response_format: "b64_json",
          quality: context.modelFamily === "openai-gpt-image" ? "high" : "",
          output_format: context.modelFamily === "openai-gpt-image" ? "png" : "",
          extra_body: "{}",
        },
        notes: [
          "第三方兼容上游如果拒绝 `quality` 或 `output_format`，先清空这两个字段。",
          "如果客户端需要直接展示，保留 `b64_json` 更稳。",
        ],
      },
    ],
  };
}
