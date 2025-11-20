import { Position } from "ccxt";
import { exchange } from "./exchange";

export interface AccountInformationAndPerformance {
  currentPositionsValue: number;
  contractValue: number;
  totalCashValue: number;
  availableCash: number;
  currentTotalReturn: number;
  positions: Position[];
  sharpeRatio: number;
}

export async function getAccountInformationAndPerformance(
  initialCapital: number
): Promise<AccountInformationAndPerformance> {
  let positions: Position[] = [];
  let currentPositionsValue = 0;
  let contractValue = 0;
  let totalCashValue = 0;
  let availableCash = 0;

  // Handle Spot vs Futures differences
  try {
    // Try fetching positions (Futures)
    if (typeof exchange.fetchPositions === "function") {
      positions = await exchange.fetchPositions(["BTC/USDT"]);
      currentPositionsValue = positions.reduce((acc, position) => {
        return (
          acc + (position.initialMargin || 0) + (position.unrealizedPnl || 0)
        );
      }, 0);
      contractValue = positions.reduce((acc, position) => {
        return acc + (position.contracts || 0);
      }, 0);
    }
  } catch (e) {
    // Likely Spot exchange, no positions endpoint
    console.warn("Could not fetch positions (likely Spot exchange)");
  }

  // Fetch Balance
  try {
    const balance = await exchange.fetchBalance();
    // Assume USDT is the quote currency for value calculation
    if (balance.USDT) {
      totalCashValue = balance.USDT.total || 0;
      availableCash = balance.USDT.free || 0;
    } else {
      // Fallback if USDT not present or different structure
      totalCashValue = 0; // Need a way to calc total value of all assets for Spot
      availableCash = 0;
    }

    // For Spot, "Positions" are just non-zero balances of other coins
    if (positions.length === 0) {
      // Iterate over balances to simulate "positions" for Spot
      // This is a simplification. A real spot bot needs current prices to calc value.
      // For now, we stick to the availableCash as the primary metric for the MVP.
    }
  } catch (e) {
    console.error("Error fetching balance:", e);
  }

  const currentTotalReturn =
    initialCapital > 0
      ? (totalCashValue - initialCapital) / initialCapital
      : 0;

  // Sharpe ratio calculation simplified or skipped if no PnL history
  const sharpeRatio = 0; // Placeholder

  return {
    currentPositionsValue,
    contractValue,
    totalCashValue,
    availableCash,
    currentTotalReturn,
    positions,
    sharpeRatio,
  };
}

export function formatAccountPerformance(
  accountPerformance: AccountInformationAndPerformance
) {
  const { currentTotalReturn, availableCash, totalCashValue, positions } =
    accountPerformance;

  const output = `## HERE IS YOUR ACCOUNT INFORMATION & PERFORMANCE
Current Total Return (percent): ${currentTotalReturn * 100}%
Available Cash: ${availableCash}
Current Account Value: ${totalCashValue}
Positions: ${
    positions.length > 0
      ? positions
          .map((position) =>
            JSON.stringify({
              symbol: position.symbol,
              quantity: position.contracts,
              entry_price: position.entryPrice,
              current_price: position.markPrice,
              liquidation_price: position.liquidationPrice,
              unrealized_pnl: position.unrealizedPnl,
              leverage: position.leverage,
              notional_usd: position.notional,
              side: position.side,
              stopLoss: position.stopLossPrice,
              takeProfit: position.takeProfitPrice,
            })
          )
          .join("\n")
      : "No open futures positions (Spot balances may exist)"
  }`;
  return output;
}
