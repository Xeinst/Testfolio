from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from backtester import run_backtest

app = FastAPI(title="Testfolio (No Paywall)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CashflowItem(BaseModel):
    amount: float
    freq: str = "yearly"
    start: Optional[str] = None
    end: Optional[str] = None


class PortfolioInput(BaseModel):
    name: str = "Portfolio"
    tickers: list[str]
    weights: Optional[list[float]] = None


class BacktestRequest(BaseModel):
    portfolios: list[PortfolioInput]
    start_date: str
    end_date: str
    starting_value: float = 100_000
    rebalance_freq: str = "yearly"
    adjust_inflation: bool = False
    cashflows: Optional[list[CashflowItem]] = None
    rolling_months: Optional[int] = None


@app.get("/")
def root():
    return {"app": "Testfolio", "paywall": False}


@app.post("/api/backtest")
def backtest(req: BacktestRequest):
    portfolios = [
        {"name": p.name, "tickers": p.tickers, "weights": p.weights}
        for p in req.portfolios
    ]
    return run_backtest(
        portfolios=portfolios,
        start_date=req.start_date,
        end_date=req.end_date,
        starting_value=req.starting_value,
        rebalance_freq=req.rebalance_freq,
        adjust_inflation=req.adjust_inflation,
        cashflows=[c.model_dump() for c in (req.cashflows or [])],
        rolling_months=req.rolling_months,
    )
