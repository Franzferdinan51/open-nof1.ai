from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from trading_env import AgentEvolverWrapper, TradingEnv
import uvicorn

app = FastAPI(title="AgentEvolver Service")
agent = AgentEvolverWrapper()
env = TradingEnv() # Internal env state for tracking

class MarketStateRequest(BaseModel):
    symbol: str = "BTC/USDT"
    # Optional: passing current state from Next.js if we want the TS app to be the source of truth
    price: Optional[float] = None
    balance: Optional[float] = None
    position: Optional[float] = None

class ActionResponse(BaseModel):
    action: str
    reasoning: str
    confidence: float
    metrics: Dict[str, Any]

@app.post("/act", response_model=ActionResponse)
async def act(request: MarketStateRequest):
    try:
        # If price provided, update internal env state (partial sync)
        # Otherwise use internal env's data fetcher
        obs = env._get_observation()

        if request.price:
            obs["price"] = request.price

        decision = agent.act(obs)

        return ActionResponse(
            action=decision["action"],
            reasoning=decision["reasoning"],
            confidence=decision["confidence"],
            metrics=decision["observation"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/evolve")
async def evolve():
    # Placeholder for triggering the self-evolution training loop
    return {"status": "Evolution cycle started (simulation)"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
