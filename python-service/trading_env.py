import ccxt
import asyncio
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple

class TradingEnv:
    def __init__(self, symbol: str = "BTC/USDT", initial_balance: float = 1000.0):
        self.symbol = symbol
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.position = 0.0  # Amount of asset held
        self.entry_price = 0.0

        # Use standard CCXT. Check for Exbitron support, fallback to Binance for data.
        if hasattr(ccxt, 'exbitron'):
            self.exchange = ccxt.exbitron()
        else:
            print("Exbitron not found in CCXT, falling back to Binance for market data simulation.")
            self.exchange = ccxt.binance()

    def reset(self) -> Dict[str, Any]:
        self.balance = self.initial_balance
        self.position = 0.0
        self.entry_price = 0.0
        return self._get_observation()

    def _get_observation(self) -> Dict[str, Any]:
        # Fetch latest OHLCV
        try:
            # Use standard fetch_ohlcv (synchronous in standard ccxt)
            ohlcv = self.exchange.fetch_ohlcv(self.symbol, timeframe='1m', limit=20)
            # Simple indicators
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

            # Calculate minimal state features
            current_price = df['close'].iloc[-1]
            ma_short = df['close'].rolling(window=7).mean().iloc[-1]
            ma_long = df['close'].rolling(window=14).mean().iloc[-1]
            rsi = self._calculate_rsi(df['close'], 14)

            return {
                "price": current_price,
                "ma_7": ma_short,
                "ma_14": ma_long,
                "rsi": rsi,
                "balance": self.balance,
                "position": self.position,
                "pnl": self._calculate_pnl(current_price)
            }
        except Exception as e:
            print(f"Error fetching observation: {e}")
            return {}

    def _calculate_rsi(self, series, period):
        delta = series.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs.iloc[-1]))

    def _calculate_pnl(self, current_price):
        if self.position == 0:
            return 0.0
        return (current_price - self.entry_price) * self.position

    def step(self, action: int) -> Tuple[Dict[str, Any], float, bool, Dict[str, Any]]:
        # Actions: 0=Hold, 1=Buy, 2=Sell
        obs = self._get_observation()
        current_price = obs.get("price", 0)
        reward = 0
        done = False

        if current_price == 0:
            return obs, 0, False, {"error": "No price data"}

        if action == 1: # Buy
            if self.balance > 0:
                # Buy max
                amount = self.balance / current_price
                cost = amount * current_price
                fee = cost * 0.001
                self.position += (amount - (fee/current_price))
                self.balance = 0
                self.entry_price = current_price

        elif action == 2: # Sell
            if self.position > 0:
                revenue = self.position * current_price
                fee = revenue * 0.001
                self.balance += (revenue - fee)
                self.position = 0

                # Reward is the % change in total portfolio value since last step?
                # Or realized PnL? Let's use realized PnL for this step.
                reward = (current_price - self.entry_price) / self.entry_price

        # Calculate total value for reward shaping
        total_value = self.balance + (self.position * current_price)

        return obs, reward, done, {"total_value": total_value}

# Simple agent wrapper (placeholder for the full AgentEvolver model)
class AgentEvolverWrapper:
    def __init__(self):
        # In a real deployment, this would load the trained model
        # or connect to the AgentEvolver training loop.
        pass

    def act(self, observation: Dict[str, Any]) -> dict:
        # Simple logic to demonstrate "evolution" (or just reaction)
        # Replace this with the actual LLM call or Policy Network
        price = observation.get("price", 0)
        ma_7 = observation.get("ma_7", 0)
        ma_14 = observation.get("ma_14", 0)

        action = "Hold"
        confidence = 0.0
        reasoning = "Market is stable."

        if ma_7 > ma_14:
            action = "Buy"
            confidence = 0.8
            reasoning = "Short term trend crossed above long term trend (Golden Cross)."
        elif ma_7 < ma_14:
            action = "Sell"
            confidence = 0.8
            reasoning = "Short term trend crossed below long term trend (Death Cross)."

        return {
            "action": action,
            "confidence": confidence,
            "reasoning": reasoning,
            "observation": observation
        }
