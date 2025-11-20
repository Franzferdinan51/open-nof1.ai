import ccxt
import asyncio
import pandas as pd
import numpy as np
import os
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

# Agent wrapper for AgentEvolver integration
class AgentEvolverWrapper:
    def __init__(self):
        # This wrapper serves as the interface between the OpenTradingBot API and the AgentEvolver framework.
        # In a production setup, this would load a trained model checkpoint or connect to a running
        # AgentEvolver inference service.

        self.model_path = os.environ.get("AGENT_EVOLVER_MODEL_PATH")
        if self.model_path:
            print(f"Loading AgentEvolver model from {self.model_path}...")
            # TODO: Implement model loading logic here when AgentEvolver library is installed
            # from agentevolver import Agent
            # self.agent = Agent.load(self.model_path)
            pass
        else:
            print("No AGENT_EVOLVER_MODEL_PATH set. Using heuristic fallback strategy.")

    def act(self, observation: Dict[str, Any]) -> dict:
        """
        Predicts an action based on the observation.

        Returns:
            dict: { "action": "Buy"|"Sell"|"Hold", "confidence": float, "reasoning": str, ... }
        """

        # 1. Real Agent Inference (Placeholder)
        # if self.model_path:
        #     return self.agent.predict(observation)

        # 2. Heuristic Strategy (Fallback/Demo)
        # This simple strategy demonstrates the input/output structure required by the API.
        price = observation.get("price", 0)
        ma_7 = observation.get("ma_7", 0)
        ma_14 = observation.get("ma_14", 0)

        action = "Hold"
        confidence = 0.0
        reasoning = "Market conditions are neutral."

        if ma_7 > ma_14:
            action = "Buy"
            confidence = 0.85
            reasoning = f"Technical Indicator Signal: Short-term MA ({ma_7:.2f}) crossed above Long-term MA ({ma_14:.2f}) indicating a bullish trend (Golden Cross)."
        elif ma_7 < ma_14:
            action = "Sell"
            confidence = 0.85
            reasoning = f"Technical Indicator Signal: Short-term MA ({ma_7:.2f}) crossed below Long-term MA ({ma_14:.2f}) indicating a bearish trend (Death Cross)."

        return {
            "action": action,
            "confidence": confidence,
            "reasoning": reasoning,
            "observation": observation
        }
