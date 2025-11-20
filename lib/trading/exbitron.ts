import { Balances, Order, Ticker, OHLCV, Exchange } from "ccxt";

// Types for Exbitron API responses (simplified)
interface ExbitronTicker {
  at: number;
  ticker: {
    low: string;
    high: string;
    open: string;
    last: string;
    vol: string;
    buy: string;
    sell: string;
    price_change_percent: string;
  };
}

interface ExbitronOrderBook {
  asks: { price: string; amount: string }[];
  bids: { price: string; amount: string }[];
}

// Basic implementation of Exbitron Exchange wrapper
// mimicking CCXT structure for compatibility
export class ExbitronClient {
  private baseUrl = "https://www.exbitron.com/api/v2/peatio";
  private apiKey: string;
  private apiSecret: string;

  constructor(config: { apiKey?: string; secret?: string }) {
    this.apiKey = config.apiKey || "";
    this.apiSecret = config.secret || "";
  }

  private async fetchPublic(endpoint: string) {
    const response = await fetch(`${this.baseUrl}/public/${endpoint}`);
    if (!response.ok) {
      throw new Error(`Exbitron API error: ${response.statusText}`);
    }
    return response.json();
  }

  // Map CCXT symbol (BTC/USDT) to Exbitron (btcusdt)
  private getMarketId(symbol: string): string {
    return symbol.replace("/", "").toLowerCase();
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    const market = this.getMarketId(symbol);
    const data: ExbitronTicker = await this.fetchPublic(`markets/${market}/tickers`);
    const t = data.ticker;
    const timestamp = data.at * 1000;

    return {
      symbol,
      timestamp,
      datetime: new Date(timestamp).toISOString(),
      high: parseFloat(t.high),
      low: parseFloat(t.low),
      bid: parseFloat(t.buy),
      bidVolume: undefined,
      ask: parseFloat(t.sell),
      askVolume: undefined,
      vwap: undefined,
      open: parseFloat(t.open),
      close: parseFloat(t.last),
      last: parseFloat(t.last),
      previousClose: undefined,
      change: undefined,
      percentage: parseFloat(t.price_change_percent.replace("%", "")),
      average: undefined,
      baseVolume: parseFloat(t.vol),
      quoteVolume: undefined,
      info: data,
    };
  }

  async fetchOHLCV(
    symbol: string,
    timeframe: string = "1m",
    since?: number,
    limit: number = 100
  ): Promise<OHLCV[]> {
    const market = this.getMarketId(symbol);

    // Map common timeframes to Exbitron periods (in minutes)
    const periodMap: Record<string, number> = {
      "1m": 1,
      "5m": 5,
      "15m": 15,
      "30m": 30,
      "1h": 60,
      "4h": 240,
      "12h": 720,
      "1d": 1440,
    };

    const period = periodMap[timeframe] || 1;
    const endTime = Math.floor(Date.now() / 1000);
    // Calculate start time based on limit if 'since' is not provided
    // Exbitron uses unix timestamp in seconds
    const startTime = since
      ? Math.floor(since / 1000)
      : endTime - (limit * period * 60);

    const url = `${this.baseUrl}/public/markets/${market}/k-line?period=${period}&time_from=${startTime}&time_to=${endTime}&limit=${limit}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Exbitron OHLCV error: ${response.statusText}`);
    }

    const rawData = await response.json();

    // Format: [timestamp, open, high, low, close, volume]
    return rawData.map((k: any) => [
      k[0] * 1000, // timestamp
      parseFloat(k[1]), // open
      parseFloat(k[2]), // high
      parseFloat(k[3]), // low
      parseFloat(k[4]), // close
      parseFloat(k[5]), // volume
    ]);
  }

  // Note: Private API methods (createOrder, fetchBalance) require authentication/signature
  // For now, we'll implement placeholders or throw if keys are missing.
  // Exbitron likely uses HMAC-SHA256 signatures.

  async fetchBalance(): Promise<Balances> {
      // TODO: Implement authenticated fetch for Exbitron
      // This requires handling the specific signature requirements of Exbitron (usually nonce + signature in headers)
      console.warn("fetchBalance not fully implemented for Exbitron, returning mock data for safety");

      return {
        info: {},
        USDT: { free: 1000, used: 0, total: 1000 },
        BTC: { free: 0, used: 0, total: 0 },
        timestamp: Date.now(),
        datetime: new Date().toISOString(),
      } as any;
  }

  async createOrder(symbol: string, type: string, side: string, amount: number, price?: number): Promise<Order> {
      // TODO: Implement authenticated createOrder
      console.warn("createOrder not fully implemented for Exbitron");
      throw new Error("Trading execution not yet enabled for Exbitron adapter");
  }

  async fetchOpenInterest(symbol: string) {
      // Spot exchanges typically don't have Open Interest
      return { openInterestAmount: 0 };
  }

  async fetchFundingRate(symbol: string) {
       // Spot exchanges don't have funding rates
       return { fundingRate: 0 };
  }

  // Helper to mimic CCXT's loadMarkets if needed, or just rely on known symbols
}

export const exbitron = new ExbitronClient({
  apiKey: process.env.EXBITRON_API_KEY,
  secret: process.env.EXBITRON_API_SECRET,
});
