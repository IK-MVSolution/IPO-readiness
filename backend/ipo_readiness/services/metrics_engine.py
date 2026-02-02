from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple, Any

# =============================================================================
# เกณฑ์ IPO ตามประกาศตลาดหลักทรัพย์ (มีผลตั้งแต่ 1 มกราคม 2568)
# =============================================================================

# SET - ตลาดหลักทรัพย์แห่งประเทศไทย (เกณฑ์กำไร - Profit Test)
SET_CRITERIA = {
    "min_equity": 800_000_000,           # ส่วนของผู้ถือหุ้น >= 800 ล้านบาท
    "min_profit_cumulative": 125_000_000, # กำไรสุทธิรวม 2-3 ปี >= 125 ล้านบาท
    "min_profit_latest": 75_000_000,      # กำไรสุทธิปีล่าสุด >= 75 ล้านบาท
    "min_paid_capital": 100_000_000,      # ทุนชำระแล้ว >= 100 ล้านบาท
    "track_record_years": 3,              # ผลการดำเนินงาน >= 3 ปี
    "label": "SET",
    "label_th": "ตลาดหลักทรัพย์แห่งประเทศไทย (SET)",
}

# mai - ตลาดหลักทรัพย์ เอ็ม เอ ไอ (เกณฑ์กำไร - Profit Test)
MAI_CRITERIA = {
    "min_equity": 100_000_000,            # ส่วนของผู้ถือหุ้น >= 100 ล้านบาท
    "min_profit_cumulative": 40_000_000,  # กำไรสุทธิรวม 2-3 ปี >= 40 ล้านบาท
    "min_profit_latest": 25_000_000,      # กำไรสุทธิปีล่าสุด >= 25 ล้านบาท
    "min_paid_capital": 50_000_000,       # ทุนชำระแล้ว >= 50 ล้านบาท
    "track_record_years": 2,              # ผลการดำเนินงาน >= 2 ปี
    "label": "mai",
    "label_th": "ตลาดหลักทรัพย์ เอ็ม เอ ไอ (mai)",
}


def compute_metrics(data: Dict) -> Dict[str, Any]:
    """Compute all metrics and IPO readiness assessment from raw financial data."""
    print("\n" + "=" * 80)
    print("🔢 เริ่มคำนวณ Metrics และประเมินความพร้อม IPO")
    print("=" * 80)

    # แยกหมวดข้อมูล
    ratios = data.get("ratios", {})
    income = data.get("income_statement", {})
    balance = data.get("balance_sheet", {})

    total_revenue = income.get("total_revenue", {})
    net_profit = income.get("net_profit", {})
    gross_profit = income.get("gross_profit", {})
    total_assets = balance.get("total_assets", {})
    shareholders_equity = balance.get("shareholders_equity", {})
    total_liabilities = balance.get("total_liabilities", {})

    # ตรวจจับหน่วยข้อมูล (ล้านบาท vs บาท)
    unit_multiplier = _detect_unit_multiplier(total_assets, shareholders_equity, total_revenue)
    print(f"\n📐 หน่วยข้อมูล: {'ล้านบาท' if unit_multiplier == 1_000_000 else 'บาท'}")

    # คำนวณ margin
    gross_margin = _margin_series(gross_profit, total_revenue)
    net_profit_margin = _margin_series(net_profit, total_revenue)

    # สร้าง metrics dictionary
    metrics: Dict[str, Any] = {
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
        "net_profit_margin": net_profit_margin,
        "total_assets": total_assets,
        "shareholders_equity": shareholders_equity,
        "total_liabilities": total_liabilities,
        "unit_multiplier": unit_multiplier,
    }

    # ประเมินความพร้อม IPO
    metrics["ipo_assessment"] = _assess_ipo_readiness(metrics, unit_multiplier)
    
    # สร้างคะแนน heuristics (สำหรับ backward compatibility)
    metrics["heuristics"] = _create_heuristics_from_assessment(metrics["ipo_assessment"])

    _print_assessment_summary(metrics["ipo_assessment"])

    return metrics


def _detect_unit_multiplier(
    total_assets: Dict[int, float],
    shareholders_equity: Dict[int, float],
    total_revenue: Dict[int, float]
) -> int:
    """
    ตรวจจับว่าข้อมูลอยู่ในหน่วยอะไร
    - ถ้าค่าสูงสุด < 100,000 น่าจะเป็นหน่วยล้านบาท
    - ถ้าค่าสูงสุด >= 100,000 น่าจะเป็นหน่วยบาท หรือพันบาท
    """
    all_values = []
    for series in [total_assets, shareholders_equity, total_revenue]:
        all_values.extend([v for v in series.values() if v and v > 0])
    
    if not all_values:
        return 1  # ไม่มีข้อมูล ใช้หน่วยบาท

    max_value = max(all_values)
    
    # ถ้าค่าสูงสุด < 50,000 น่าจะเป็นหน่วยล้านบาท
    # เพราะบริษัทที่จะ IPO ควรมีสินทรัพย์อย่างน้อย 100 ล้านบาท
    if max_value < 50_000:
        return 1_000_000  # ข้อมูลเป็นล้านบาท ต้องคูณ 1,000,000
    elif max_value < 50_000_000:
        return 1_000  # ข้อมูลเป็นพันบาท ต้องคูณ 1,000
    else:
        return 1  # ข้อมูลเป็นบาทอยู่แล้ว


def _assess_ipo_readiness(metrics: Dict, unit_multiplier: int) -> Dict[str, Any]:
    """ประเมินความพร้อม IPO ตามเกณฑ์ SET และ mai"""
    
    net_profit = metrics.get("net_profit", {})
    shareholders_equity = metrics.get("shareholders_equity", {})
    
    # หาปีที่มีข้อมูล (เรียงจากใหม่ไปเก่า)
    profit_years = sorted([y for y, v in net_profit.items() if v is not None], reverse=True)
    equity_years = sorted([y for y, v in shareholders_equity.items() if v is not None], reverse=True)
    
    # คำนวณค่าสำคัญ (แปลงหน่วยเป็นบาท)
    latest_profit = _get_latest_value(net_profit) 
    latest_profit_baht = (latest_profit * unit_multiplier) if latest_profit else 0
    
    cumulative_profit_2_3_years = _get_cumulative_profit(net_profit, years=3)
    cumulative_profit_baht = (cumulative_profit_2_3_years * unit_multiplier) if cumulative_profit_2_3_years else 0
    
    latest_equity = _get_latest_value(shareholders_equity)
    latest_equity_baht = (latest_equity * unit_multiplier) if latest_equity else 0
    
    track_record_years = len(profit_years)
    
    # ตรวจสอบกำไรในงวดสะสม (ต้องเป็นบวก)
    has_cumulative_profit = latest_profit_baht > 0 if latest_profit_baht else False
    
    print(f"\n📊 ข้อมูลสำคัญ:")
    print(f"   - กำไรสุทธิปีล่าสุด: {_format_currency(latest_profit_baht)}")
    print(f"   - กำไรสุทธิรวม 2-3 ปี: {_format_currency(cumulative_profit_baht)}")
    print(f"   - ส่วนของผู้ถือหุ้น: {_format_currency(latest_equity_baht)}")
    print(f"   - Track Record: {track_record_years} ปี")

    # ประเมิน SET
    set_assessment = _check_criteria(
        SET_CRITERIA,
        latest_profit_baht,
        cumulative_profit_baht,
        latest_equity_baht,
        track_record_years,
        has_cumulative_profit
    )
    
    # ประเมิน mai
    mai_assessment = _check_criteria(
        MAI_CRITERIA,
        latest_profit_baht,
        cumulative_profit_baht,
        latest_equity_baht,
        track_record_years,
        has_cumulative_profit
    )
    
    # คำนวณคะแนนอัตราส่วนทางการเงิน (Financial Health Score)
    financial_health = _calculate_financial_health_score(metrics)
    
    # กำหนดระดับความพร้อม
    if set_assessment["passed"]:
        readiness_level = "พร้อมสำหรับ SET"
        readiness_score = 100
    elif mai_assessment["passed"]:
        readiness_level = "พร้อมสำหรับ mai"
        readiness_score = 75
    elif mai_assessment["pass_count"] >= 3:
        readiness_level = "ใกล้พร้อม"
        readiness_score = 50
    else:
        readiness_level = "ต้องพัฒนาเพิ่มเติม"
        readiness_score = 25

    # สร้างคำแนะนำ
    recommendations = _generate_recommendations(set_assessment, mai_assessment, financial_health)

    return {
        "readiness_level": readiness_level,
        "readiness_score": readiness_score,
        "set_assessment": set_assessment,
        "mai_assessment": mai_assessment,
        "financial_health": financial_health,
        "key_figures": {
            "latest_profit": latest_profit_baht,
            "cumulative_profit": cumulative_profit_baht,
            "shareholders_equity": latest_equity_baht,
            "track_record_years": track_record_years,
            "has_cumulative_profit": has_cumulative_profit,
        },
        "recommendations": recommendations,
        "unit_multiplier": unit_multiplier,
    }


def _check_criteria(
    criteria: Dict,
    latest_profit: float,
    cumulative_profit: float,
    equity: float,
    track_years: int,
    has_cumulative_profit: bool
) -> Dict[str, Any]:
    """ตรวจสอบเกณฑ์ IPO แต่ละตลาด"""
    
    checks = []
    pass_count = 0
    
    # 1. ส่วนของผู้ถือหุ้น
    equity_pass = equity >= criteria["min_equity"]
    checks.append({
        "name": "ส่วนของผู้ถือหุ้น",
        "required": criteria["min_equity"],
        "actual": equity,
        "passed": equity_pass,
        "gap": max(0, criteria["min_equity"] - equity),
    })
    if equity_pass:
        pass_count += 1
    
    # 2. กำไรสุทธิปีล่าสุด
    profit_latest_pass = latest_profit >= criteria["min_profit_latest"]
    checks.append({
        "name": "กำไรสุทธิปีล่าสุด",
        "required": criteria["min_profit_latest"],
        "actual": latest_profit,
        "passed": profit_latest_pass,
        "gap": max(0, criteria["min_profit_latest"] - latest_profit),
    })
    if profit_latest_pass:
        pass_count += 1
    
    # 3. กำไรสุทธิรวม 2-3 ปี
    profit_cumulative_pass = cumulative_profit >= criteria["min_profit_cumulative"]
    checks.append({
        "name": "กำไรสุทธิรวม 2-3 ปี",
        "required": criteria["min_profit_cumulative"],
        "actual": cumulative_profit,
        "passed": profit_cumulative_pass,
        "gap": max(0, criteria["min_profit_cumulative"] - cumulative_profit),
    })
    if profit_cumulative_pass:
        pass_count += 1
    
    # 4. Track Record
    track_pass = track_years >= criteria["track_record_years"]
    checks.append({
        "name": f"ผลการดำเนินงาน (ปี)",
        "required": criteria["track_record_years"],
        "actual": track_years,
        "passed": track_pass,
        "gap": max(0, criteria["track_record_years"] - track_years),
    })
    if track_pass:
        pass_count += 1
    
    # 5. มีกำไรในงวดสะสม
    checks.append({
        "name": "มีกำไรในงวดสะสม",
        "required": "มีกำไร (>0)",
        "actual": "มีกำไร" if has_cumulative_profit else "ขาดทุน",
        "passed": has_cumulative_profit,
        "gap": 0 if has_cumulative_profit else latest_profit,
    })
    if has_cumulative_profit:
        pass_count += 1
    
    total_checks = len(checks)
    passed_all = pass_count == total_checks
    
    return {
        "market": criteria["label"],
        "market_th": criteria["label_th"],
        "passed": passed_all,
        "pass_count": pass_count,
        "total_checks": total_checks,
        "percentage": round((pass_count / total_checks) * 100, 1),
        "checks": checks,
    }


def _calculate_financial_health_score(metrics: Dict) -> Dict[str, Any]:
    """คำนวณคะแนนสุขภาพทางการเงิน (อัตราส่วนทางการเงิน)"""
    
    breakdown = []
    total_score = 0
    total_possible = 0

    def add_metric(key: str, label: str, series_key: str, max_points: int, scorer):
        nonlocal total_score, total_possible
        series = metrics.get(series_key, {})
        latest = _get_latest_value(series)
        
        entry = {"key": key, "label": label, "value": latest}
        
        if latest is None:
            entry.update({"score": 0, "max_score": 0, "level": "ไม่มีข้อมูล"})
            breakdown.append(entry)
            return
        
        score, level = scorer(latest, max_points)
        entry.update({"score": score, "max_score": max_points, "level": level})
        breakdown.append(entry)
        total_score += score
        total_possible += max_points

    # อัตราส่วนทางการเงินที่สำคัญ
    add_metric("roa", "ROA (%)", "roa", 2, _score_positive_bands(8, 3))
    add_metric("roe", "ROE (%)", "roe", 2, _score_positive_bands(15, 8))
    add_metric("current_ratio", "Current Ratio (เท่า)", "current_ratio", 2, _score_current_ratio)
    add_metric("de_ratio", "D/E Ratio (เท่า)", "debt_to_equity", 2, _score_inverse_bands(1.0, 1.5))
    add_metric("debt_assets", "Debt to Assets (%)", "debt_to_assets", 2, _score_inverse_bands(0.6, 0.75))
    add_metric("gross_margin", "Gross Margin (%)", "gross_margin", 1, _score_positive_bands(25, 15))
    add_metric("net_margin", "Net Margin (%)", "net_profit_margin", 1, _score_positive_bands(12, 6))

    percentage = (total_score / total_possible * 100) if total_possible else 0.0
    
    if percentage >= 80:
        health_level = "ดีมาก"
    elif percentage >= 60:
        health_level = "ดี"
    elif percentage >= 40:
        health_level = "พอใช้"
    else:
        health_level = "ต้องปรับปรุง"

    return {
        "score": total_score,
        "max_score": total_possible,
        "percentage": round(percentage, 1),
        "level": health_level,
        "breakdown": breakdown,
    }


def _generate_recommendations(
    set_assessment: Dict,
    mai_assessment: Dict,
    financial_health: Dict
) -> List[Dict[str, str]]:
    """สร้างคำแนะนำตามผลการประเมิน"""
    
    recommendations = []
    
    # คำแนะนำจากเกณฑ์ที่ยังไม่ผ่าน
    if not mai_assessment["passed"]:
        for check in mai_assessment["checks"]:
            if not check["passed"] and check["gap"]:
                if "ส่วนของผู้ถือหุ้น" in check["name"]:
                    recommendations.append({
                        "category": "ทุน",
                        "priority": "สูง",
                        "message": f"เพิ่มส่วนของผู้ถือหุ้นอีก {_format_currency(check['gap'])} เพื่อผ่านเกณฑ์ mai",
                    })
                elif "กำไรสุทธิปีล่าสุด" in check["name"]:
                    recommendations.append({
                        "category": "กำไร",
                        "priority": "สูง",
                        "message": f"เพิ่มกำไรสุทธิปีล่าสุดอีก {_format_currency(check['gap'])} เพื่อผ่านเกณฑ์ mai",
                    })
                elif "กำไรสุทธิรวม" in check["name"]:
                    recommendations.append({
                        "category": "กำไร",
                        "priority": "สูง",
                        "message": f"กำไรสะสม 2-3 ปียังขาดอีก {_format_currency(check['gap'])}",
                    })
                elif "ผลการดำเนินงาน" in check["name"]:
                    recommendations.append({
                        "category": "Track Record",
                        "priority": "กลาง",
                        "message": f"ต้องมีผลการดำเนินงานอีก {int(check['gap'])} ปี",
                    })
                elif "งวดสะสม" in check["name"]:
                    recommendations.append({
                        "category": "กำไร",
                        "priority": "สูง",
                        "message": "ต้องมีกำไรในงวดสะสมก่อนยื่นคำขอ (ไม่ขาดทุน)",
                    })
    
    # คำแนะนำจากอัตราส่วนทางการเงิน
    for item in financial_health.get("breakdown", []):
        if item.get("level") == "ต้องปรับปรุง":
            if item["key"] == "current_ratio":
                recommendations.append({
                    "category": "สภาพคล่อง",
                    "priority": "กลาง",
                    "message": f"ปรับปรุง Current Ratio (ปัจจุบัน {item['value']:.2f} เท่า, ควรอยู่ระหว่าง 1.2-3.0)",
                })
            elif item["key"] == "de_ratio":
                recommendations.append({
                    "category": "หนี้สิน",
                    "priority": "กลาง",
                    "message": f"ลดอัตราส่วน D/E (ปัจจุบัน {item['value']:.2f} เท่า, ควร ≤1.0)",
                })
            elif item["key"] == "roe":
                recommendations.append({
                    "category": "ผลตอบแทน",
                    "priority": "กลาง",
                    "message": f"เพิ่ม ROE (ปัจจุบัน {item['value']:.1f}%, ควร ≥15%)",
                })
    
    # เรียงตาม priority
    priority_order = {"สูง": 0, "กลาง": 1, "ต่ำ": 2}
    recommendations.sort(key=lambda x: priority_order.get(x["priority"], 2))
    
    return recommendations


def _create_heuristics_from_assessment(assessment: Dict) -> Dict[str, Any]:
    """สร้าง heuristics format เดิมเพื่อ backward compatibility"""
    
    financial_health = assessment.get("financial_health", {})
    
    # กำหนด readiness จากระดับความพร้อม
    readiness_map = {
        "พร้อมสำหรับ SET": "พร้อมสูง",
        "พร้อมสำหรับ mai": "พร้อมสูง",
        "ใกล้พร้อม": "ปานกลาง",
        "ต้องพัฒนาเพิ่มเติม": "ต่ำ",
    }
    
    readiness_level = assessment.get("readiness_level", "ต่ำ")
    
    return {
        "score": financial_health.get("score", 0),
        "max_score": financial_health.get("max_score", 0),
        "percentage": assessment.get("readiness_score", 0),
        "readiness": readiness_map.get(readiness_level, "ต่ำ"),
        "breakdown": financial_health.get("breakdown", []),
        # เพิ่มข้อมูล IPO assessment
        "ipo_readiness": readiness_level,
        "set_eligible": assessment.get("set_assessment", {}).get("passed", False),
        "mai_eligible": assessment.get("mai_assessment", {}).get("passed", False),
    }


def _print_assessment_summary(assessment: Dict):
    """แสดงสรุปผลการประเมิน"""
    
    print(f"\n{'='*80}")
    print("📋 สรุปผลการประเมินความพร้อม IPO")
    print("="*80)
    
    print(f"\n🎯 ระดับความพร้อม: {assessment['readiness_level']}")
    
    set_result = assessment["set_assessment"]
    mai_result = assessment["mai_assessment"]
    
    print(f"\n📊 ผลการประเมิน SET: {'✅ ผ่าน' if set_result['passed'] else '❌ ไม่ผ่าน'} ({set_result['pass_count']}/{set_result['total_checks']} เกณฑ์)")
    print(f"📊 ผลการประเมิน mai: {'✅ ผ่าน' if mai_result['passed'] else '❌ ไม่ผ่าน'} ({mai_result['pass_count']}/{mai_result['total_checks']} เกณฑ์)")
    
    health = assessment["financial_health"]
    print(f"\n💪 สุขภาพทางการเงิน: {health['level']} ({health['score']}/{health['max_score']} คะแนน, {health['percentage']}%)")
    
    if assessment["recommendations"]:
        print(f"\n💡 คำแนะนำ ({len(assessment['recommendations'])} รายการ):")
        for i, rec in enumerate(assessment["recommendations"][:5], 1):
            print(f"   {i}. [{rec['priority']}] {rec['message']}")
    
    print("="*80 + "\n")


# =============================================================================
# Helper Functions
# =============================================================================

def _get_latest_value(series: Dict[int, Optional[float]]) -> Optional[float]:
    """ดึงค่าปีล่าสุดที่มีข้อมูล"""
    if not series:
        return None
    valid_years = sorted([y for y, v in series.items() if v is not None], reverse=True)
    if not valid_years:
        return None
    return series.get(valid_years[0])


def _get_cumulative_profit(series: Dict[int, Optional[float]], years: int = 3) -> Optional[float]:
    """คำนวณกำไรสะสม 2-3 ปีล่าสุด"""
    if not series:
        return None
    valid_years = sorted([y for y, v in series.items() if v is not None], reverse=True)
    if not valid_years:
        return None
    
    # ใช้ค่า 2-3 ปีล่าสุด
    years_to_use = valid_years[:years]
    values = [series.get(y, 0) for y in years_to_use if series.get(y) is not None]
    
    if not values:
        return None
    return sum(values)


def _safe_ratio_series(numerator: Dict[int, float], denominator: Dict[int, float]) -> Dict[int, float]:
    """สร้าง series ของ ratio แบบปลอดภัย"""
    ratios = {}
    for year, num in numerator.items():
        den = denominator.get(year)
        if den and den != 0:
            ratios[year] = num / den
    return ratios


def _margin_series(numerator: Dict[int, float], denominator: Dict[int, float]) -> Dict[int, float]:
    """คำนวณ margin เป็นเปอร์เซ็นต์"""
    margins = {}
    for year, num in numerator.items():
        den = denominator.get(year)
        if den and den != 0:
            margins[year] = (num / den) * 100
    return margins


def _format_currency(value: float) -> str:
    """แปลงตัวเลขเป็นรูปแบบเงินบาท"""
    if value >= 1_000_000_000:
        return f"{value / 1_000_000_000:,.2f} พันล้านบาท"
    elif value >= 1_000_000:
        return f"{value / 1_000_000:,.2f} ล้านบาท"
    elif value >= 1_000:
        return f"{value / 1_000:,.2f} พันบาท"
    else:
        return f"{value:,.2f} บาท"


def _score_positive_bands(good: float, fair: float):
    """เกณฑ์แบบ ค่ายิ่งมากยิ่งดี"""
    def scorer(value: float, max_points: int) -> Tuple[int, str]:
        if value >= good:
            return max_points, "ดีมาก"
        if value >= fair:
            return max(1, max_points - 1), "พอใช้"
        return 0, "ต้องปรับปรุง"
    return scorer


def _score_inverse_bands(good: float, fair: float):
    """เกณฑ์แบบ ค่ายิ่งน้อยยิ่งดี"""
    def scorer(value: float, max_points: int) -> Tuple[int, str]:
        if value <= good:
            return max_points, "ดีมาก"
        if value <= fair:
            return max(1, max_points - 1), "พอใช้"
        return 0, "ต้องปรับปรุง"
    return scorer


def _score_current_ratio(value: float, max_points: int) -> Tuple[int, str]:
    """เกณฑ์ Current Ratio (กลางๆ ดีที่สุด)"""
    if 1.2 <= value <= 3.0:
        return max_points, "ดีมาก"
    if (1.0 <= value < 1.2) or (3.0 < value <= 5.0):
        return max(1, max_points - 1), "พอใช้"
    return 0, "ต้องปรับปรุง"
