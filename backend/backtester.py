"""
Portfolio backtester engine - no limits, no paywall.
Uses yfinance for market data.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, date
from typing import Optional


def get_prices(tickers: list[str], start: date, end: date) -> pd.DataFrame:
    """Fetch adjusted close prices from Yahoo Finance."""
    if not tickers:
        return pd.DataFrame()
    syms = [t.strip().upper() for t in tickers if t and str(t).strip()]
    if not syms:
        return pd.DataFrame()
    try:
        data = yf.download(
            syms,
            start=start.isoformat(),
            end=end.isoformat(),
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    except Exception:
        return pd.DataFrame()
    if data.empty:
        return pd.DataFrame()
    if len(syms) == 1:
        if isinstance(data.columns, pd.MultiIndex):
            data = data[syms[0]].copy()
        close = data["Close"].copy() if "Close" in data.columns else data.iloc[:, 0].copy()
        if isinstance(close, pd.Series):
            out = close.to_frame(name=syms[0])
        else:
            out = close
    else:
        if isinstance(data.columns, pd.MultiIndex):
            out = data.xs("Close", axis=1, level=1).copy()
            out.columns = [c for c in out.columns]
        else:
            out = data["Close"].copy() if "Close" in data.columns else data.copy()
        if isinstance(out, pd.Series):
            out = out.to_frame()
        # keep only requested tickers that exist
        available = [c for c in syms if c in out.columns]
        if available:
            out = out[available].copy()
    out = out.dropna(how="all").ffill().bfill()
    return out


def run_backtest(
    portfolios: list[dict],
    start_date: str,
    end_date: str,
    starting_value: float = 100_000,
    rebalance_freq: str = "yearly",
    adjust_inflation: bool = False,
    cashflows: Optional[list[dict]] = None,
    rolling_months: Optional[int] = None,
) -> dict:
    """
    Run backtest for one or more portfolios.
    portfolios: list of { "name": str, "tickers": list[str], "weights": list[float] }
    rebalance_freq: "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
    cashflows: optional list of { "amount": float, "freq": str, "start": str, "end": str }
    """
    start = pd.Timestamp(start_date).date()
    end = pd.Timestamp(end_date).date()
    if start >= end:
        return {"error": "Start date must be before end date."}

    all_tickers = []
    for p in portfolios:
        all_tickers.extend(p.get("tickers") or [])
    all_tickers = list(dict.fromkeys([t.strip().upper() for t in all_tickers if t]))

    prices = get_prices(all_tickers, start, end)
    if prices.empty or len(prices) < 2:
        return {"error": "Could not load enough price data for the given tickers and date range."}

    freq_map = {
        "daily": "D",
        "weekly": "W",
        "monthly": "ME",
        "quarterly": "QE",
        "yearly": "YE",
    }
    rebal_freq = freq_map.get(rebalance_freq, "YE")

    results = []
    equity_curves = {}

    for port in portfolios:
        name = port.get("name") or "Portfolio"
        tickers = [t.strip().upper() for t in (port.get("tickers") or []) if t]
        weights = list(port.get("weights") or [])
        if not tickers:
            continue
        if len(weights) != len(tickers):
            weights = [1.0 / len(tickers)] * len(tickers)
        w = np.array(weights, dtype=float)
        w = w / w.sum()

        common = [t for t in tickers if t in prices.columns]
        if not common:
            continue
        pr = prices[common].dropna(how="all").ffill().bfill()
        if len(pr) < 2:
            continue
        w_common = np.array([w[tickers.index(c)] for c in common], dtype=float)
        w_common = w_common / w_common.sum()

        # Build calendar for rebalancing
        dr = pd.date_range(start=pr.index.min(), end=pr.index.max(), freq=rebal_freq)
        rebal_dates = set(pr.index[pr.index.isin(dr)]) if hasattr(pr.index, "isin") else set()
        rebal_dates.add(pr.index[0])
        rebal_dates = sorted(rebal_dates)

        # Simulate
        vals = [starting_value]
        dates = [pr.index[0]]
        cash = starting_value
        shares = np.zeros(len(common))
        prev_rebal = pr.index[0]

        for i in range(1, len(pr)):
            dt = pr.index[i]
            row = pr.iloc[i]
            prev_row = pr.iloc[i - 1]
            if dt in rebal_dates or prev_rebal is None:
                # Rebalance: target weights of current portfolio value
                port_val = cash + (shares * np.array(prev_row)).sum()
                if port_val <= 0:
                    port_val = starting_value
                target_val = port_val * w_common
                prices_today = np.array(row)
                prices_today = np.where(prices_today <= 0, np.nan, prices_today)
                np.nan_to_num(prices_today, copy=False, nan=1.0)
                new_shares = np.zeros(len(common))
                for j in range(len(common)):
                    if prices_today[j] > 0:
                        new_shares[j] = target_val[j] / prices_today[j]
                cash = port_val - (new_shares * prices_today).sum()
                shares = new_shares
                prev_rebal = dt
            port_val = cash + (shares * np.array(row)).sum()
            vals.append(port_val)
            dates.append(dt)

        equity = pd.Series(vals, index=dates)
        equity_curves[name] = [
            {"date": str(d.date()), "value": round(float(v), 2)}
            for d, v in equity.items()
        ]

        # Metrics
        rets = equity.pct_change().dropna()
        if len(rets) < 2:
            results.append({"name": name, "error": "Insufficient data"})
            continue
        total_ret = (equity.iloc[-1] / equity.iloc[0]) - 1
        years = (equity.index[-1] - equity.index[0]).days / 365.25
        cagr = (1 + total_ret) ** (1 / years) - 1 if years > 0 else 0
        vol = rets.std() * np.sqrt(252) if len(rets) > 1 else 0
        rf = 0.02
        sharpe = (cagr - rf) / vol if vol and vol > 0 else 0
        cummax = equity.cummax()
        drawdown = (equity - cummax) / cummax
        max_dd = drawdown.min()

        results.append({
            "name": name,
            "cagr": round(float(cagr) * 100, 2),
            "volatility": round(float(vol) * 100, 2),
            "sharpe": round(float(sharpe), 2),
            "max_drawdown": round(float(max_dd) * 100, 2),
            "total_return": round(float(total_ret) * 100, 2),
            "final_value": round(float(equity.iloc[-1]), 2),
            "years": round(float(years), 2),
        })

    return {
        "equity_curves": equity_curves,
        "metrics": results,
        "error": None,
    }
