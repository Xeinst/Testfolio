from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from backtester import run_backtest
from analytics import (
    asset_analyzer,
    portfolio_optimizer,
    efficient_frontier,
    rebalancing_sensitivity,
    time_value_of_money,
)

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


class AssetAnalyzerRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str


@app.post("/api/asset_analyzer")
def api_asset_analyzer(req: AssetAnalyzerRequest):
    return asset_analyzer(req.ticker, req.start_date, req.end_date)


class OptimizerRequest(BaseModel):
    tickers: list[str]
    start_date: str
    end_date: str
    risk_free_rate: float = 0.02


@app.post("/api/optimizer")
def api_optimizer(req: OptimizerRequest):
    return portfolio_optimizer(req.tickers, req.start_date, req.end_date, req.risk_free_rate)


class FrontierRequest(BaseModel):
    tickers: list[str]
    start_date: str
    end_date: str
    num_points: int = 50
    risk_free_rate: float = 0.02


@app.post("/api/efficient_frontier")
def api_efficient_frontier(req: FrontierRequest):
    return efficient_frontier(
        req.tickers, req.start_date, req.end_date, req.num_points, req.risk_free_rate
    )


class RebalSensitivityRequest(BaseModel):
    tickers: list[str]
    weights: Optional[list[float]] = None
    start_date: str
    end_date: str
    starting_value: float = 100_000


@app.post("/api/rebalancing_sensitivity")
def api_rebalancing_sensitivity(req: RebalSensitivityRequest):
    return rebalancing_sensitivity(
        req.tickers, req.weights or [], req.start_date, req.end_date, req.starting_value
    )


class TVMRequest(BaseModel):
    pv: Optional[float] = None
    fv: Optional[float] = None
    rate: Optional[float] = None
    nper: Optional[float] = None
    pmt: float = 0
    rate_decimal: bool = True


@app.post("/api/tvm")
def api_tvm(req: TVMRequest):
    return time_value_of_money(
        req.pv, req.fv, req.rate, req.nper, req.pmt, req.rate_decimal
    )
