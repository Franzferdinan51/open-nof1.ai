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
      return { model: gpt4o, name: "GPT-4o" };
    case "gemini":
      return { model: gemini15Pro, name: "Gemini 1.5 Pro" };
    case "local":
      return {
        model: getLocalModel(process.env.LOCAL_MODEL_ID),
        name: "Local Model",
      };
    case "deepseek":
    default:
      // Default to DeepSeek via OpenRouter as per original setup
      return { model: deepseekR1, name: "DeepSeek R1" };
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
  // The Prisma schema expects specific Enums. If we support any symbol, we might need to update schema or map strings.
  // For now, we'll stick to BTC/USDT for the main logic or basic mapping.
  const prismaSymbol =
    Object.values(Symbol).find((s) => s === symbol) || Symbol.BTC;
  const tradingPair = `${prismaSymbol}/USDT`;

  const currentMarketState = await getCurrentMarketState(tradingPair);
  const accountInformationAndPerformance =
    await getAccountInformationAndPerformance(initialCapital);
  // Count previous Chat entries to provide an invocation counter in the prompt
  const invocationCount = await prisma.chat.count();

  const userPrompt = generateUserPrompt({
    currentMarketState,
    accountInformationAndPerformance,
    startTime: new Date(),
    invocationCount,
  });

  const { model, name: modelName } = getActiveModel(modelOverride);

  const { object, reasoning } = await generateObject({
    model: model,
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
          "The reason why you do this opeartion, and tell me your anlyaise, for example: Currently holding all my positions in ETH, SOL, XRP, BTC, DOGE, and BNB as none of my invalidation conditions have been triggered, though XRP and BNB are showing slight unrealized losses. My overall account is up 10.51% with $4927.64 in cash, so I'll continue to monitor my existing trades."
        ),
    }),
  });

  if (object.opeartion === Opeartion.Buy) {
    await prisma.chat.create({
      data: {
        model: modelName,
        reasoning: reasoning || "<no reasoning>",
        chat: object.chat || "<no chat>",
        userPrompt,
        tradings: {
          createMany: {
            data: {
              symbol: prismaSymbol,
              opeartion: object.opeartion,
              pricing: object.buy?.pricing,
              amount: object.buy?.amount,
              leverage: object.buy?.leverage,
            },
          },
        },
      },
    });
  }

  if (object.opeartion === Opeartion.Sell) {
    await prisma.chat.create({
      data: {
        model: modelName,
        reasoning: reasoning || "<no reasoning>",
        chat: object.chat || "<no chat>",
        userPrompt,
        tradings: {
          createMany: {
            data: {
              symbol: prismaSymbol,
              opeartion: object.opeartion,
            },
          },
        },
      },
    });
  }

  if (object.opeartion === Opeartion.Hold) {
    const shouldAdjustProfit =
      object.adjustProfit?.stopLoss && object.adjustProfit?.takeProfit;
    await prisma.chat.create({
      data: {
        model: modelName,
        reasoning: reasoning || "<no reasoning>",
        chat: object.chat || "<no chat>",
        userPrompt,
        tradings: {
          createMany: {
            data: {
              symbol: prismaSymbol,
              opeartion: object.opeartion,
              stopLoss: shouldAdjustProfit
                ? object.adjustProfit?.stopLoss
                : undefined,
              takeProfit: shouldAdjustProfit
                ? object.adjustProfit?.takeProfit
                : undefined,
            },
          },
        },
      },
    });
  }
}
