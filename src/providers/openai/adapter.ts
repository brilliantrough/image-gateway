import type OpenAI from "openai";
import { OpenAICompatibleImageProvider } from "../openai-compatible/adapter.js";

export class OpenAIImageProvider extends OpenAICompatibleImageProvider {
  constructor(
    client: OpenAI,
    options: {
      stripResponseFormat?: boolean;
      supportsSeed?: boolean;
    } = {},
  ) {
    super(client, "openai", options);
  }
}
