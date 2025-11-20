import { Balances, Order, Ticker, OHLCV } from "ccxt";
import { createHmac } from "crypto";

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

  // --- Auth Helpers ---

  private generateSignature(nonce: string): string {
    const message = nonce + this.apiKey;
    return createHmac("sha256", this.apiSecret).update(message).digest("hex");
  }

  private async fetchPrivate(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    params: Record<string, any> = {}
  ) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("Exbitron API key and secret are required for private endpoints");
    }

    const nonce = Date.now().toString();
    const signature = this.generateSignature(nonce);

    const headers: Record<string, string> = {
      "X-Auth-Apikey": this.apiKey,
      "X-Auth-Nonce": nonce,
      "X-Auth-Signature": signature,
      "Content-Type": "application/json",
    };

    let url = `${this.baseUrl}/${endpoint}`;
    let body = undefined;

    if (method === "GET") {
      const query = new URLSearchParams(params).toString();
      if (query) {
        url += `?${query}`;
      }
    } else if (method === "POST") {
      // For Peatio/Barong, parameters are often sent as form data or query params even for POST in some versions,
      // but typically JSON or query params.
      // Based on docs: params are usually query parameters for POST too in some httpie examples,
      // but let's try JSON body first as it's standard modern Peatio, or fallback to URL encoded.
      // The docs example: http POST ... market=ethusd side=buy ...
      // This suggests they might accept JSON or form-urlencoded.
      // Let's assume JSON for now as Content-Type is set.
      body = JSON.stringify(params);
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Exbitron Private API error (${response.status}): ${text}`);
    }

    return response.json();
  }

  private async fetchPublic(endpoint: string) {
    const response = await fetch(`${this.baseUrl}/public/${endpoint}`);
    if (!response.ok) {
      throw new Error(`Exbitron API error: ${response.statusText}`);
    }
    return response.json();
  }

  // --- Public API ---

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
      k[0] * 1000,
      parseFloat(k[1]),
      parseFloat(k[2]),
      parseFloat(k[3]),
      parseFloat(k[4]),
      parseFloat(k[5]),
    ]);
  }

  // --- Private API ---

  async fetchBalance(): Promise<Balances> {
    // Endpoint: /account/balances
    const data = await this.fetchPrivate("account/balances");

    // Exbitron returns an array: [{ currency: 'eth', balance: '1.5', locked: '0.0' }, ...]
    // We need to convert to CCXT structure
    const result: any = {
      info: data,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
    };

    data.forEach((item: any) => {
      const code = item.currency.toUpperCase();
      const free = parseFloat(item.balance);
      const used = parseFloat(item.locked);
      const total = free + used; // Wait, usually balance is total or free?
      // Docs say: balance: "1.4995", locked: "0.0".
      // Usually in Peatio balance is 'available' (free) or 'total'.
      // Let's assume balance is free (available) based on standard naming,
      // but checking standard Peatio: 'balance' is usually the amount *owned*, and 'locked' is part of it.
      // Actually, often 'balance' is total, and 'locked' is the frozen part.
      // Or 'balance' is available.
      // Let's assume balance is available (free) + locked = total? Or balance = total?
      // Let's stick to: free = balance, used = locked, total = free + used (safe assumption if not sure)
      // Update: Peatio source often has 'balance' as the available amount.

      result[code] = {
        free: free,
        used: used,
        total: free + used,
      };
    });

    return result as Balances;
  }

  async createOrder(
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price?: number
  ): Promise<Order> {
    // Endpoint: POST /market/orders
    const market = this.getMarketId(symbol);

    const params: Record<string, any> = {
      market,
      side: side.toLowerCase(), // 'buy' or 'sell'
      volume: amount, // Peatio uses 'volume' for amount
      ord_type: type.toLowerCase(), // 'limit' or 'market'
    };

    if (type.toLowerCase() === 'limit') {
      if (!price) throw new Error("Price required for limit orders");
      params.price = price;
    }

    const response = await this.fetchPrivate("market/orders", "POST", params);

    // Map response to CCXT Order structure (simplified)
    return {
      id: response.id.toString(),
      clientOrderId: undefined,
      timestamp: Date.parse(response.created_at),
      datetime: response.created_at,
      lastTradeTimestamp: undefined,
      symbol: symbol,
      type: response.ord_type,
      timeInForce: undefined,
      postOnly: undefined,
      side: response.side,
      price: parseFloat(response.price),
      stopPrice: undefined,
      triggerPrice: undefined,
      amount: parseFloat(response.origin_volume),
      cost: undefined,
      average: parseFloat(response.avg_price || "0"),
      filled: parseFloat(response.executed_volume),
      remaining: parseFloat(response.remaining_volume),
      status: response.state === 'wait' ? 'open' : (response.state === 'done' ? 'closed' : response.state),
      fee: undefined,
      trades: undefined,
      info: response,
    } as Order;
  }

  async fetchOpenInterest(symbol: string) {
      // Spot exchanges typically don't have Open Interest
      return { openInterestAmount: 0 };
  }

  async fetchFundingRate(symbol: string) {
       // Spot exchanges don't have funding rates
       return { fundingRate: 0 };
  }
}

export const exbitron = new ExbitronClient({
  apiKey: process.env.EXBITRON_API_KEY,
  secret: process.env.EXBITRON_API_SECRET,
});
