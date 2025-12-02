from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple


def compute_metrics(data: Dict) -> Dict[str, Dict[int, float]]:
    ratios = data.get("ratios", {})
    income = data.get("income_statement", {})
    balance = data.get("balance_sheet", {})

    total_revenue = income.get("total_revenue", {})
    net_profit = income.get("net_profit", {})
    gross_profit = income.get("gross_profit", {})
    total_assets = balance.get("total_assets", {})
    shareholders_equity = balance.get("shareholders_equity", {})
    total_liabilities = balance.get("total_liabilities", {})

    gross_margin = _margin_series(gross_profit, total_revenue)

    metrics: Dict[str, Dict[int, float] | Dict[str, object]] = {
        "roa": ratios.get("roa", {}),
        "roe": ratios.get("roe", {}),
        "current_ratio": ratios.get("current_ratio", {}),
        "debt_to_equity": ratios.get("debt_to_equity", {})
        or _safe_ratio_series(total_liabilities, shareholders_equity),
        "debt_to_assets": ratios.get("debt_to_assets", {})
        or _safe_ratio_series(total_liabilities, total_assets),
        "gross_profit": gross_profit,
        "net_profit": net_profit,
        "total_revenue": total_revenue,
        "gross_margin": gross_margin,
        "net_profit_margin": _margin_series(net_profit, total_revenue),
        "total_assets": total_assets,
        "shareholders_equity": shareholders_equity,
    }
    metrics["heuristics"] = _heuristic_score(metrics)
    return metrics


def _safe_ratio_series(numerator: Dict[int, float], denominator: Dict[int, float]) -> Dict[int, float]:
    ratios = {}
    for year, num in numerator.items():
        den = denominator.get(year)
        if den and den != 0:
            ratios[year] = (num / den)
    return ratios


def _margin_series(numerator: Dict[int, float], denominator: Dict[int, float]) -> Dict[int, float]:
    margins = {}
    for year, num in numerator.items():
        den = denominator.get(year)
        if den and den != 0:
            margins[year] = (num / den) * 100
    return margins


def _heuristic_score(metrics: Dict[str, Dict[int, float]]) -> Dict[str, object]:
    breakdown = []
    total_score = 0
    total_possible = 0

    def add_metric(key: str, label: str, series_key: str, max_points: int, scorer):
        nonlocal total_score, total_possible
        series = metrics.get(series_key, {})
        average = _average_latest(series)
        entry = {"key": key, "label": label, "average": average}
        if average is None:
            entry.update({"score": 0, "max_score": 0, "level": "ไม่มีข้อมูล"})
            breakdown.append(entry)
            return
        score, level = scorer(average, max_points)
        entry.update({"score": score, "max_score": max_points, "level": level})
        breakdown.append(entry)
        total_score += score
        total_possible += max_points

    add_metric("roa", "ROA", "roa", 2, _score_positive_bands(8, 3))
    add_metric("roe", "ROE", "roe", 2, _score_positive_bands(15, 8))
    add_metric("current_ratio", "อัตราส่วนทุนหมุนเวียน", "current_ratio", 2, _score_current_ratio)
    add_metric("de_ratio", "D/E Ratio", "debt_to_equity", 2, _score_inverse_bands(1.0, 1.5))
    add_metric("debt_assets", "หนี้สินต่อสินทรัพย์รวม", "debt_to_assets", 2, _score_inverse_bands(0.6, 0.75))
    add_metric("gross_margin", "Gross Margin", "gross_margin", 1, _score_positive_bands(25, 15))
    add_metric("net_margin", "Net Margin", "net_profit_margin", 1, _score_positive_bands(12, 6))
    add_metric("revenue_scale", "ขนาดรายได้", "total_revenue", 1, _score_size)
    add_metric("asset_scale", "ขนาดสินทรัพย์", "total_assets", 1, _score_size)
    add_metric("equity_scale", "ขนาดส่วนของผู้ถือหุ้น", "shareholders_equity", 1, _score_size)

    percentage = (total_score / total_possible * 100) if total_possible else 0.0
    readiness = "พร้อมสูง" if percentage >= 70 else "ปานกลาง" if percentage >= 50 else "ต่ำ"

    return {
        "score": total_score,
        "max_score": total_possible,
        "percentage": round(percentage, 2),
        "readiness": readiness,
        "breakdown": breakdown,
    }


def _average_latest(series: Dict[int, Optional[float]], limit: int = 5) -> Optional[float]:
    if not series:
        return None
    ordered_years = sorted(
        [year for year, value in series.items() if value is not None],
        reverse=True,
    )
    values: List[float] = []
    for year in ordered_years[:limit]:
        value = series.get(year)
        if value is not None:
            values.append(float(value))
    if not values:
        return None
    return sum(values) / len(values)


def _score_positive_bands(good: float, fair: float):
    def scorer(value: float, max_points: int) -> Tuple[int, str]:
        if value >= good:
            return max_points, "ดีมาก"
        if value >= fair:
            return max(1, max_points - 1), "พอใช้"
        return 0, "ต้องปรับปรุง"

    return scorer


def _score_inverse_bands(good: float, fair: float):
    def scorer(value: float, max_points: int) -> Tuple[int, str]:
        if value <= good:
            return max_points, "ดีมาก"
        if value <= fair:
            return max(1, max_points - 1), "พอใช้"
        return 0, "ต้องปรับปรุง"

    return scorer


def _score_current_ratio(value: float, max_points: int) -> Tuple[int, str]:
    if 1.2 <= value <= 3.0:
        return max_points, "ดีมาก"
    if (1.0 <= value < 1.2) or (3.0 < value <= 5.0):
        return max(1, max_points - 1), "พอใช้"
    return 0, "ต้องปรับปรุง"


def _score_size(value: float, max_points: int) -> Tuple[int, str]:
    if value is None or value <= 0:
        return 0, "ไม่มีข้อมูล"
    scale = math.log10(value)
    if scale >= 9:  # ~1,000 ล้านบาทขึ้นไป
        return max_points, "ขนาดใหญ่"
    if scale >= 8:
        return max(1, max_points - 1), "ขนาดกลาง"
    return 0, "ขนาดเล็ก"
