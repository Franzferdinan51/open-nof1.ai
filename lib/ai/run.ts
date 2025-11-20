import { generateObject } from "ai";
import { generateUserPrompt, tradingPrompt } from "./prompt";
import { getCurrentMarketState } from "../trading/current-market-state";
import { z } from "zod";
import {
  deepseekR1,
  gpt4o,
  gemini15Pro,
  getLocalModel,
  getOpenRouterModel,
} from "./model";
import { getAccountInformationAndPerformance } from "../trading/account-information-and-performance";
import { prisma } from "../prisma";
import { Opeartion, Symbol } from "@prisma/client";

// Helper to get the model based on env config or parameter
function getActiveModel(modelName?: string) {
  const configuredModel = modelName || process.env.ACTIVE_MODEL || "deepseek";

  switch (configuredModel.toLowerCase()) {
    case "openai":
    case "gpt4o":
      return { model: gpt4o, name: "GPT-4o", type: "sdk" };
    case "gemini":
      return { model: gemini15Pro, name: "Gemini 1.5 Pro", type: "sdk" };
    case "local":
      return {
        model: getLocalModel(process.env.LOCAL_MODEL_ID),
        name: "Local Model",
        type: "sdk",
      };
    case "agentevolver":
      return { model: null, name: "AgentEvolver", type: "agent_evolver" };
    case "deepseek":
    default:
      // Default to DeepSeek via OpenRouter as per original setup
      return { model: deepseekR1, name: "DeepSeek R1", type: "sdk" };
  }
}

async function callAgentEvolver(currentState: any) {
  // Call the Python bridge
  // Assumes python service is running on localhost:8000
  const AGENT_EVOLVER_URL =
    process.env.AGENT_EVOLVER_URL || "http://localhost:8000";
  try {
    const response = await fetch(`${AGENT_EVOLVER_URL}/act`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price: currentState.current_price,
        // Can add more state here
      }),
    });

    if (!response.ok) {
      throw new Error(`AgentEvolver API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      opeartion: data.action, // 'Buy', 'Sell', 'Hold'
      reasoning: data.reasoning,
      confidence: data.confidence,
    };
  } catch (e) {
    console.error("Error calling AgentEvolver:", e);
    // Fallback to Hold
    return { opeartion: "Hold", reasoning: "Error calling agent service." };
  }
}

/**
 * you can interval trading using cron job
 */
export async function run(
  initialCapital: number,
  modelOverride?: string,
  symbol: string = "BTC"
) {
  // Resolve symbol string to Enum if possible, or just use BTC as default for now if dynamic
  const prismaSymbol =
    Object.values(Symbol).find((s) => s === symbol) || Symbol.BTC;
  const tradingPair = `${prismaSymbol}/USDT`;

  const currentMarketState = await getCurrentMarketState(tradingPair);
  const accountInformationAndPerformance =
    await getAccountInformationAndPerformance(initialCapital);
  // Count previous Chat entries to provide an invocation counter in the prompt
  const invocationCount = await prisma.chat.count();

  const {
    model,
    name: modelName,
    type: modelType,
  } = getActiveModel(modelOverride);

  let operation: string;
  let reasoning: string;
  let chatContent = "<no chat>";
  let buyParams = null;
  let adjustParams = null;

  if (modelType === "agent_evolver") {
    const decision = await callAgentEvolver(currentMarketState);
    operation = decision.opeartion;
    reasoning = decision.reasoning;
    chatContent = `Confidence: ${decision.confidence}`;

    // Map string op to Enum logic
    // Basic mapping for AgentEvolver which returns simple strings
    if (operation.toLowerCase() === "buy") {
        buyParams = {
            pricing: currentMarketState.current_price,
            amount: 0.001, // Default or derived from env
            leverage: 1
        };
    }

  } else {
    // Use Vercel AI SDK
    const userPrompt = generateUserPrompt({
      currentMarketState,
      accountInformationAndPerformance,
      startTime: new Date(),
      invocationCount,
    });

    const { object, reasoning: r } = await generateObject({
      model: model as any,
      system: tradingPrompt,
      prompt: userPrompt,
      output: "object",
      mode: "json",
      schema: z.object({
        opeartion: z.nativeEnum(Opeartion),
        buy: z
          .object({
            pricing: z.number().describe("The pricing of you want to buy in."),
            amount: z.number(),
            leverage: z.number().min(1).max(20),
          })
          .optional()
          .describe("If opeartion is buy, generate object"),
        sell: z
          .object({
            percentage: z
              .number()
              .min(0)
              .max(100)
              .describe("Percentage of position to sell"),
          })
          .optional()
          .describe("If opeartion is sell, generate object"),
        adjustProfit: z
          .object({
            stopLoss: z
              .number()
              .optional()
              .describe("The stop loss of you want to set."),
            takeProfit: z
              .number()
              .optional()
              .describe("The take profit of you want to set."),
          })
          .optional()
          .describe(
            "If opeartion is hold and you want to adjust the profit, generate object"
          ),
        chat: z
          .string()
          .describe(
            "The reason why you do this opeartion, and tell me your anlyaise..."
          ),
      }),
    });

    operation = object.opeartion;
    reasoning = r || "<no reasoning>";
    chatContent = object.chat;
    buyParams = object.buy;
    adjustParams = object.adjustProfit;
  }

  // Execute / Save to DB logic (Unified)
  // Map string operation to Prisma Enum if needed
  let dbOp: Opeartion;
  if (operation.toLowerCase() === 'buy') dbOp = Opeartion.Buy;
  else if (operation.toLowerCase() === 'sell') dbOp = Opeartion.Sell;
  else dbOp = Opeartion.Hold;

  if (dbOp === Opeartion.Buy) {
    await prisma.chat.create({
      data: {
        model: modelName,
        reasoning: reasoning,
        chat: chatContent,
        userPrompt: modelType === 'agent_evolver' ? "Agent State Input" : "Prompt",
        tradings: {
          createMany: {
            data: {
              symbol: prismaSymbol,
              opeartion: dbOp,
              pricing: buyParams?.pricing,
              amount: buyParams?.amount,
              leverage: buyParams?.leverage,
            },
          },
        },
      },
    });
  }

  if (dbOp === Opeartion.Sell) {
    await prisma.chat.create({
      data: {
        model: modelName,
        reasoning: reasoning,
        chat: chatContent,
        userPrompt: modelType === 'agent_evolver' ? "Agent State Input" : "Prompt",
        tradings: {
          createMany: {
            data: {
              symbol: prismaSymbol,
              opeartion: dbOp,
            },
          },
        },
      },
    });
  }

  if (dbOp === Opeartion.Hold) {
    const shouldAdjustProfit =
      adjustParams?.stopLoss && adjustParams?.takeProfit;
    await prisma.chat.create({
      data: {
        model: modelName,
        reasoning: reasoning,
        chat: chatContent,
        userPrompt: modelType === 'agent_evolver' ? "Agent State Input" : "Prompt",
        tradings: {
          createMany: {
            data: {
              symbol: prismaSymbol,
              opeartion: dbOp,
              stopLoss: shouldAdjustProfit
                ? adjustParams?.stopLoss
                : undefined,
              takeProfit: shouldAdjustProfit
                ? adjustParams?.takeProfit
                : undefined,
            },
          },
        },
      },
    });
  }
}
