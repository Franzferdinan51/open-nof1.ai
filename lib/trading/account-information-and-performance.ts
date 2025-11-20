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
    // This is expected for Exbitron
  }

  // Fetch Balance and Calculate Spot Portfolio Value
  try {
    const balance = await exchange.fetchBalance();

    // 1. Get USDT Balances
    const usdtFree = balance.USDT ? (balance.USDT.free || 0) : 0;
    const usdtTotal = balance.USDT ? (balance.USDT.total || 0) : 0;

    availableCash = usdtFree;
    let totalPortfolioValue = usdtTotal;

    // 2. Calculate value of other assets (Spot Positions)
    // Filter for non-zero balances that are not USDT
    const otherAssets = Object.keys(balance).filter(currency =>
      currency !== 'USDT' &&
      currency !== 'info' &&
      currency !== 'free' &&
      currency !== 'used' &&
      currency !== 'total' &&
      balance[currency]?.total &&
      balance[currency]?.total > 0
    );

    // If no futures positions were found, we can treat spot assets as "positions" for display
    const spotPositions: Position[] = [];

    for (const currency of otherAssets) {
      try {
        const amount = balance[currency].total || 0;
        if (amount > 0) {
          // Fetch current price
          // Ensure symbol format matches (e.g. BTC/USDT)
          const symbol = `${currency}/USDT`;
          const ticker = await exchange.fetchTicker(symbol);
          const price = ticker.last || 0;
          const valueInUsdt = amount * price;

          totalPortfolioValue += valueInUsdt;
          currentPositionsValue += valueInUsdt;

          // Construct a pseudo-Position object for the UI/AI to understand
          spotPositions.push({
            symbol: symbol,
            type: 'spot',
            side: 'long',
            amount: amount,
            contracts: amount, // using contracts field for quantity
            price: price,
            notional: valueInUsdt,
            leverage: 1,
            initialMargin: valueInUsdt,
            maintenanceMargin: 0,
            unrealizedPnl: 0, // Hard to track without average entry price
            collateral: 0,
            info: {},
            id: currency,
            timestamp: Date.now(),
            datetime: new Date().toISOString(),
            entryPrice: 0, // would need trade history to calculate
            markPrice: price,
            liquidationPrice: 0,
            marginMode: 'spot',
            hedged: false,
            percentage: 0
          } as unknown as Position);
        }
      } catch (err) {
        console.warn(`Could not fetch ticker or calc value for ${currency}:`, err);
      }
    }

    totalCashValue = totalPortfolioValue;

    // If we are in Spot mode and found spot positions, use them
    if (positions.length === 0 && spotPositions.length > 0) {
      positions = spotPositions;
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
              quantity: position.contracts || position.amount,
              current_price: position.markPrice || position.price,
              notional_usd: position.notional,
              side: position.side,
              // Only show relevant fields for Spot
              type: position.type || 'future',
            })
          )
          .join("\n")
      : "No open positions"
  }`;
  return output;
}
