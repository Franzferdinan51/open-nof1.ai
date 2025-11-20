import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// --- DEEPSEEK ---
const deepseekModel = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export const deepseek = deepseekModel("deepseek-chat");
export const deepseekThinking = deepseekModel("deepseek-reasoner");

// --- OPENROUTER ---
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const deepseekv31 = openrouter("deepseek/deepseek-v3.2-exp");
export const deepseekR1 = openrouter("deepseek/deepseek-r1-0528");
// Export a generic OpenRouter factory if needed
export const getOpenRouterModel = (modelId: string) => openrouter(modelId);

// --- OPENAI ---
const openaiModel = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const gpt4o = openaiModel("gpt-4o");
export const gpt4Turbo = openaiModel("gpt-4-turbo");

// --- GOOGLE (GEMINI) ---
const googleModel = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const gemini15Pro = googleModel("models/gemini-1.5-pro-latest");
export const gemini15Flash = googleModel("models/gemini-1.5-flash-latest");

// --- LOCAL / OPENAI COMPATIBLE (LM Studio) ---
// Users should set LOCAL_LLM_BASE_URL (e.g., http://localhost:1234/v1)
const localModel = createOpenAICompatible({
  name: "local",
  baseURL: process.env.LOCAL_LLM_BASE_URL || "http://localhost:1234/v1",
  apiKey: "not-needed", // usually
});

// Allow user to specify the model ID for local (e.g., "llama-3-8b")
export const getLocalModel = (modelId: string = "local-model") =>
  localModel(modelId);
