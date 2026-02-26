"""
Extra tools: Asset Analyzer, Portfolio Optimizer, Efficient Frontier,
Rebalancing Sensitivity, Time Value of Money. No paywall.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Optional
from backtester import get_prices, run_backtest


def asset_analyzer(ticker: str, start_date: str, end_date: str) -> dict:
    """Single-asset stats: CAGR, vol, Sharpe, max DD, rolling 1y return."""
    ticker = (ticker or "").strip().upper()
    if not ticker:
        return {"error": "Ticker required."}
    start = pd.Timestamp(start_date).date()
    end = pd.Timestamp(end_date).date()
    if start >= end:
        return {"error": "Start date must be before end date."}
    prices = get_prices([ticker], start, end)
    if prices.empty or len(prices) < 2:
        return {"error": "Could not load price data for this ticker and date range."}
    series = prices.iloc[:, 0].dropna()
    if len(series) < 2:
        return {"error": "Insufficient data."}
    rets = series.pct_change().dropna()
    total_ret = (series.iloc[-1] / series.iloc[0]) - 1
    years = (series.index[-1] - series.index[0]).days / 365.25
    cagr = (1 + total_ret) ** (1 / years) - 1 if years > 0 else 0
    vol = float(rets.std() * np.sqrt(252)) if len(rets) > 0 else 0
    rf = 0.02
    sharpe = (cagr - rf) / vol if vol > 0 else 0
    cummax = series.cummax()
    drawdown = (series - cummax) / cummax
    max_dd = float(drawdown.min())
    # Rolling 1Y return (approx 252 trading days)
    rolling = series.pct_change(252).dropna()
    roll_1y_min = float(rolling.min() * 100) if len(rolling) > 0 else None
    roll_1y_max = float(rolling.max() * 100) if len(rolling) > 0 else None
    roll_1y_mean = float(rolling.mean() * 100) if len(rolling) > 0 else None
    return {
        "ticker": ticker,
        "cagr": round(cagr * 100, 2),
        "volatility": round(vol * 100, 2),
        "sharpe": round(sharpe, 2),
        "max_drawdown": round(max_dd * 100, 2),
        "total_return": round(total_ret * 100, 2),
        "years": round(years, 2),
        "rolling_1y_min": round(roll_1y_min, 2) if roll_1y_min is not None else None,
        "rolling_1y_max": round(roll_1y_max, 2) if roll_1y_max is not None else None,
        "rolling_1y_mean": round(roll_1y_mean, 2) if roll_1y_mean is not None else None,
        "error": None,
    }


def portfolio_optimizer(
    tickers: list[str],
    start_date: str,
    end_date: str,
    risk_free_rate: float = 0.02,
) -> dict:
    """Mean-variance: max Sharpe and min vol weights."""
    tickers = [t.strip().upper() for t in tickers if t and str(t).strip()]
    if len(tickers) < 2:
        return {"error": "At least 2 tickers required."}
    start = pd.Timestamp(start_date).date()
    end = pd.Timestamp(end_date).date()
    if start >= end:
        return {"error": "Start date must be before end date."}
    prices = get_prices(tickers, start, end)
    if prices.empty or len(prices) < 2:
        return {"error": "Could not load price data."}
    # Align to common index
    prices = prices.dropna(how="all").ffill().bfill()
    available = [c for c in tickers if c in prices.columns]
    if len(available) < 2:
        return {"error": "Need at least 2 assets with data."}
    pr = prices[available]
    rets = pr.pct_change().dropna()
    if len(rets) < 2:
        return {"error": "Insufficient return data."}
    mu = rets.mean().values * 252
    cov = rets.cov().values * 252
    n = len(mu)
    inv_cov = np.linalg.pinv(cov)

    # Min volatility
    ones = np.ones(n)
    w_minvol = inv_cov @ ones
    w_minvol = w_minvol / w_minvol.sum()

    # Max Sharpe
    excess = mu - risk_free_rate
    w_sharpe = inv_cov @ excess
    if w_sharpe.sum() != 0:
        w_sharpe = w_sharpe / w_sharpe.sum()
    else:
        w_sharpe = np.ones(n) / n

    def port_stats(w):
        r = float(w @ mu)
        v = float(np.sqrt(w @ cov @ w))
        s = (r - risk_free_rate) / v if v > 0 else 0
        return r * 100, v * 100, s

    r_min, v_min, s_min = port_stats(w_minvol)
    r_sharpe, v_sharpe, s_sharpe = port_stats(w_sharpe)

    return {
        "tickers": available,
        "min_volatility": {
            "weights": {available[i]: round(float(w_minvol[i]), 4) for i in range(n)},
            "cagr": round(r_min, 2),
            "volatility": round(v_min, 2),
            "sharpe": round(s_min, 2),
        },
        "max_sharpe": {
            "weights": {available[i]: round(float(w_sharpe[i]), 4) for i in range(n)},
            "cagr": round(r_sharpe, 2),
            "volatility": round(v_sharpe, 2),
            "sharpe": round(s_sharpe, 2),
        },
        "error": None,
    }


def efficient_frontier(
    tickers: list[str],
    start_date: str,
    end_date: str,
    num_points: int = 50,
    risk_free_rate: float = 0.02,
) -> dict:
    """Efficient frontier: return vs vol for a grid of portfolios."""
    tickers = [t.strip().upper() for t in tickers if t and str(t).strip()]
    if len(tickers) < 2:
        return {"error": "At least 2 tickers required."}
    start = pd.Timestamp(start_date).date()
    end = pd.Timestamp(end_date).date()
    if start >= end:
        return {"error": "Start date must be before end date."}
    prices = get_prices(tickers, start, end)
    if prices.empty or len(prices) < 2:
        return {"error": "Could not load price data."}
    prices = prices.dropna(how="all").ffill().bfill()
    available = [c for c in tickers if c in prices.columns]
    if len(available) < 2:
        return {"error": "Need at least 2 assets with data."}
    rets = prices[available].pct_change().dropna()
    if len(rets) < 2:
        return {"error": "Insufficient data."}
    mu = rets.mean().values * 252
    cov = rets.cov().values * 252
    n = len(mu)
    inv_cov = np.linalg.pinv(cov)
    ones = np.ones(n)
    excess = mu - risk_free_rate
    w_minvol = inv_cov @ ones
    w_minvol = w_minvol / w_minvol.sum()
    w_maxsharpe = inv_cov @ excess
    if w_maxsharpe.sum() != 0:
        w_maxsharpe = w_maxsharpe / w_maxsharpe.sum()
    else:
        w_maxsharpe = np.ones(n) / n
    min_ret = float(w_minvol @ mu) * 100
    max_ret = float(mu.max()) * 100
    frontier = []
    for i in range(num_points + 1):
        t = i / num_points
        w = (1 - t) * w_minvol + t * w_maxsharpe
        w = np.clip(w, 0, 1)
        w = w / w.sum()
        r = float(w @ mu) * 100
        v = float(np.sqrt(w @ cov @ w)) * 100
        s = (r / 100 - risk_free_rate) / (v / 100) if v > 0 else 0
        frontier.append({"return": round(r, 2), "volatility": round(v, 2), "sharpe": round(s, 2)})
    return {
        "tickers": available,
        "frontier": frontier,
        "min_vol_return": round(min_ret, 2),
        "max_sharpe_return": round(float(w_maxsharpe @ mu) * 100, 2),
        "error": None,
    }


def rebalancing_sensitivity(
    tickers: list[str],
    weights: list[float],
    start_date: str,
    end_date: str,
    starting_value: float = 100_000,
) -> dict:
    """Run backtest at multiple rebalance frequencies; return comparison."""
    tickers = [t.strip().upper() for t in tickers if t and str(t).strip()]
    if not tickers:
        return {"error": "At least one ticker required."}
    if weights and len(weights) == len(tickers):
        w = np.array(weights, dtype=float)
        w = w / w.sum()
    else:
        w = np.ones(len(tickers)) / len(tickers)
    port = [{"name": "Portfolio", "tickers": tickers, "weights": w.tolist()}]
    freqs = ["daily", "weekly", "monthly", "quarterly", "yearly"]
    results = []
    curves = {}
    for freq in freqs:
        out = run_backtest(
            portfolios=port,
            start_date=start_date,
            end_date=end_date,
            starting_value=starting_value,
            rebalance_freq=freq,
        )
        if out.get("error"):
            return out
        metrics = out.get("metrics") or []
        m = next((x for x in metrics if x.get("name") == "Portfolio"), metrics[0] if metrics else None)
        if m:
            results.append({
                "rebalance_freq": freq,
                "cagr": m.get("cagr"),
                "volatility": m.get("volatility"),
                "sharpe": m.get("sharpe"),
                "max_drawdown": m.get("max_drawdown"),
                "final_value": m.get("final_value"),
            })
            curves[freq] = out.get("equity_curves", {}).get("Portfolio", [])
    return {
        "tickers": tickers,
        "results": results,
        "equity_curves": curves,
        "error": None,
    }


def time_value_of_money(
    pv: Optional[float] = None,
    fv: Optional[float] = None,
    rate: Optional[float] = None,
    nper: Optional[float] = None,
    pmt: float = 0,
    rate_decimal: bool = True,
) -> dict:
    """TVM: solve for the missing one of pv, fv, rate, nper. rate in decimal (e.g. 0.05) unless rate_decimal=False."""
    # rate as decimal per period (e.g. annual 0.05)
    if pv is not None and fv is not None and rate is not None and nper is not None:
        return {"error": "Leave one of PV, FV, rate, or nper blank to solve for it."}
    if sum(x is None for x in [pv, fv, rate, nper]) != 1:
        return {"error": "Exactly one of PV, FV, rate, or nper must be unknown (null)."}
    r = rate if rate is not None else 0.05
    if not rate_decimal:
        r = r / 100.0
    if pv is None:
        if r == -1:
            pv = (fv - pmt * nper) if fv is not None and nper is not None else None
        else:
            pv = (fv - pmt * (((1 + r) ** nper - 1) / r)) / (1 + r) ** nper if fv is not None and nper is not None else None
        return {"pv": round(pv, 2), "fv": fv, "rate": rate, "nper": nper, "pmt": pmt, "error": None}
    if fv is None:
        if r == -1:
            fv = pv + pmt * nper
        else:
            fv = pv * (1 + r) ** nper + pmt * (((1 + r) ** nper - 1) / r)
        return {"pv": pv, "fv": round(fv, 2), "rate": rate, "nper": nper, "pmt": pmt, "error": None}
    if nper is None:
        if fv is None or pv is None or pv == 0:
            return {"error": "Cannot solve for nper with given inputs."}
        try:
            from math import log
            if abs(r) < 1e-10:
                nper = (fv - pv) / pmt if pmt != 0 else 0
            else:
                # FV = PV*(1+r)^nper + pmt*(((1+r)^nper - 1)/r). Solve for nper.
                nper = log((fv + pmt / r) / (pv + pmt / r)) / log(1 + r) if (pv + pmt / r) != 0 else 0
        except Exception:
            nper = 0
        return {"pv": pv, "fv": fv, "rate": rate, "nper": round(nper, 2), "pmt": pmt, "error": None}
    if rate is None:
        # Solve for rate numerically (simple bisection)
        def f(x):
            if abs(x) < 1e-10:
                return pv + pmt * nper - fv
            return pv * (1 + x) ** nper + pmt * (((1 + x) ** nper - 1) / x) - fv
        lo, hi = -0.99, 5.0
        for _ in range(100):
            mid = (lo + hi) / 2
            if f(mid) * f(lo) <= 0:
                hi = mid
            else:
                lo = mid
        rate = (lo + hi) / 2
        return {"pv": pv, "fv": fv, "rate": round(rate * 100 if rate_decimal else rate, 4), "nper": nper, "pmt": pmt, "error": None}
    return {"error": "Invalid TVM inputs."}
