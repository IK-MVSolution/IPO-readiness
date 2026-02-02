import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";


const metricLabels = {
  roa: "ROA",
  roe: "ROE",
  current_ratio: "Current Ratio",
  debt_to_equity: "หนี้สินต่อส่วนของผู้ถือหุ้น",
  debt_to_assets: "หนี้สินต่อสินทรัพย์รวม",
  gross_margin: "Gross Margin",
  net_profit_margin: "Net Profit Margin",
  total_revenue: "รายได้รวม",
  gross_profit: "กำไรขั้นต้น",
  net_profit: "กำไรสุทธิ",
  total_assets: "สินทรัพย์รวม",
  total_liabilities: "หนี้สินรวม",
  shareholders_equity: "ส่วนของผู้ถือหุ้น",
};

const formatNumber = (value, { fraction = 0 } = {}) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(value);
};

const formatCurrency = (value) => formatNumber(value, { fraction: 0 });

const formatCompact = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatNumber(value, { fraction: abs >= 10 ? 0 : 2 });
};

function averageFromSeries(series = {}) {
  const values = Object.values(series).filter((val) => typeof val === "number");
  if (!values.length) return null;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function LineChart({
  series,
  years,
  color = "#38bdf8",
  label = "",
  formatter = (value) => formatNumber(value),
  axisFormatter = (value) => formatCompact(value),
  height = 200,
  fillArea = false,
}) {
  const dataset = years.map((year, idx) => {
    const raw = series?.[year];
    const value = typeof raw === "number" ? raw : null;
    return { year, value, index: idx };
  });
  const values = dataset.filter((item) => item.value !== null).map((item) => item.value);
  if (!values.length) return <p className="chart-empty">ไม่มีข้อมูล</p>;

  const latestEntry = [...dataset].reverse().find((item) => item.value !== null);

  const width = 420;
  const margin = { top: 20, right: 24, bottom: 30, left: 64 };
  const svgHeight = height;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = (maxValue - minValue || Math.abs(maxValue) || 1) * 0.1;
  const lowerBound = minValue >= 0 ? 0 : minValue - padding;
  const upperBound = maxValue <= 0 ? 0 : maxValue + padding;
  const span = upperBound - lowerBound || 1;

  const scaleX = (index) => {
    if (years.length <= 1) return margin.left + innerWidth / 2;
    return margin.left + (index / (years.length - 1)) * innerWidth;
  };
  const scaleY = (value) =>
    margin.top + innerHeight - ((value - lowerBound) / span) * innerHeight;

  const points = dataset
    .filter((item) => item.value !== null)
    .map((item) => ({
      x: scaleX(item.index),
      y: scaleY(item.value),
      year: item.year,
      value: item.value,
    }));

  const pointPath = points.map((point) => `${point.x},${point.y}`).join(" ");
  const baseLineY = margin.top + innerHeight;
  const showArea = fillArea && points.length > 1;

  const areaPath = showArea
    ? `M ${points[0].x} ${baseLineY} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1].x
    } ${baseLineY} Z`
    : "";

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, idx) => lowerBound + (span / tickCount) * idx);

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <div>
          <p>{label}</p>
          {latestEntry && <small>ข้อมูลปี {latestEntry.year}</small>}
        </div>
        {latestEntry && <strong>{formatter(latestEntry.value)}</strong>}
      </div>
      <div className="chart-content">
        <div className="chart-canvas" style={{ height }}>
          <svg viewBox={`0 0 ${width} ${svgHeight}`} className="chart-line" preserveAspectRatio="none">
            <g className="chart-grid">
              {ticks.map((tick) => {
                const y = scaleY(tick);
                return (
                  <g key={tick}>
                    <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
                    <text x={margin.left - 12} y={y + 4} textAnchor="end">
                      {axisFormatter(tick)}
                    </text>
                  </g>
                );
              })}
            </g>
            <g className="chart-grid-vertical" opacity="0.1">
              {years.map((year, idx) => {
                const x = scaleX(idx);
                return <line key={year} x1={x} x2={x} y1={margin.top} y2={baseLineY} stroke="currentColor" />;
              })}
            </g>
            <line
              className="chart-axis-line"
              x1={margin.left}
              y1={margin.top}
              x2={margin.left}
              y2={baseLineY}
            />
            <line
              className="chart-axis-line"
              x1={margin.left}
              y1={baseLineY}
              x2={width - margin.right}
              y2={baseLineY}
            />
            {showArea && <path d={areaPath} fill={color} opacity="0.12" />}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="3"
              points={pointPath}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point, idx) => (
              <circle
                key={idx}
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#fff"
                stroke={color}
                strokeWidth="2"
              />
            ))}
            <g className="chart-xaxis">
              {years.map((year, index) => (
                <text
                  key={year}
                  x={scaleX(index)}
                  y={svgHeight - 5}
                  textAnchor="middle"
                  className="chart-label"
                  fill="#64748b"
                  fontSize="12"
                  fontWeight="500"
                >
                  {year}
                </text>
              ))}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ series = {}, years = [], color = "#0ea5e9" }) {
  const points = years
    .map((year, idx) => {
      const value = typeof series?.[year] === "number" ? series[year] : null;
      return { year, value, idx };
    })
    .filter((item) => item.value !== null);

  if (points.length < 2) {
    return <span className="sparkline-empty">-</span>;
  }

  const values = points.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const mapY = (val) => 36 - ((val - min) / span) * 24;
  const mapX = (idx) => 12 + (idx / (years.length - 1 || 1)) * 96;
  const path = points.map((pt) => `${mapX(pt.idx)},${mapY(pt.value)}`).join(" ");

  return (
    <svg viewBox="0 0 120 40" className="sparkline">
      <polyline fill="none" stroke={color} strokeWidth="2" points={path} strokeLinecap="round" />
      {points.map((pt, index) => (
        <circle key={index} cx={mapX(pt.idx)} cy={mapY(pt.value)} r="2" fill={color} />
      ))}
    </svg>
  );
}

function DonutChart({ value = 0, label = "" }) {
  const normalized = Math.min(Math.max(value, 0), 20);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = ((20 - normalized) / 20) * circumference;

  return (
    <div className="donut-chart">
      <svg width="90" height="90">
        <circle cx="45" cy="45" r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
        <circle
          cx="45"
          cy="45"
          r={radius}
          stroke="#38bdf8"
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
        />
      </svg>
      <div className="donut-label">
        <strong>{value.toFixed(2)}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

const getLevelTone = (level = "") => {
  if (!level) return "neutral";
  if (level.includes("ดี")) return "positive";
  if (level.includes("ใหญ่") || level.includes("กลาง")) return "informative";
  if (level.includes("ไม่มี")) return "muted";
  if (level.includes("ต้องปรับปรุง") || level.includes("ต่ำ")) return "warning";
  return "neutral";
};

const calcTrend = (series = {}, orderedYears = []) => {
  const numericYears = orderedYears.filter((year) => typeof series?.[year] === "number");
  if (numericYears.length < 2) {
    return { delta: 0, direction: "flat" };
  }
  const latest = series[numericYears[numericYears.length - 1]];
  const prev = series[numericYears[numericYears.length - 2]];
  const delta = latest - prev;
  if (Math.abs(delta) < 0.001) return { delta: 0, direction: "flat" };
  return { delta, direction: delta > 0 ? "up" : "down" };
};

function AssessmentReport({ result, onBackToUpload, onBackHome }) {
  if (!result) {
    return (
      <div className="assessment-empty-state">
        <div className="empty-state-card glass-effect">
          <div className="empty-icon">📊</div>
          <h2>ยังไม่มีผลลัพธ์การประเมิน</h2>
          <p>กรุณาอัปโหลดไฟล์ข้อมูลการเงินเพื่อเริ่มการวิเคราะห์ความพร้อม IPO</p>
          <button type="button" className="primary-btn huge" onClick={onBackToUpload}>
            เริ่มการประเมินใหม่
          </button>
        </div>
      </div>
    );
  }

  const { data, metrics } = result;
  const years = data?.years || [];
  const heuristics = metrics?.heuristics || {};
  const ipoAssessment = metrics?.ipo_assessment || {};

  // Debug: Check if company_name is in data
  console.log("🔍 Debug - Full result data:", data);
  console.log("🏢 Company name from data:", data?.company_name);

  const revenueAvg = averageFromSeries(metrics?.total_revenue);
  const netMarginAvg = averageFromSeries(metrics?.net_profit_margin);
  const roaAvg = averageFromSeries(metrics?.roa);
  const assetAvg = averageFromSeries(metrics?.total_assets);
  const equityAvg = averageFromSeries(metrics?.shareholders_equity);
  const profitAvg = averageFromSeries(metrics?.net_profit);
  const grossAvg = averageFromSeries(metrics?.gross_profit);
  const liabilitiesAvg = averageFromSeries(metrics?.total_liabilities);

  const highlightCards = [
    {
      label: "รายได้เฉลี่ย",
      value: revenueAvg ? `฿${formatCurrency(revenueAvg)}` : "-",
      desc: "ภาพรวมยอดขายต่อปี",
    },
    {
      label: "กำไรสุทธิ (% เฉลี่ย)",
      value: netMarginAvg ? `${formatNumber(netMarginAvg, { fraction: 2 })}%` : "-",
      desc: "Net Profit Margin",
    },
    {
      label: "ROA เฉลี่ย",
      value: roaAvg ? `${formatNumber(roaAvg, { fraction: 2 })}%` : "-",
      desc: "ประสิทธิภาพการใช้สินทรัพย์",
    },
  ];

  const tabs = [
    { key: "overview", label: "ภาพรวม" },
    { key: "insights", label: "ข้อมูลเชิงลึก" },
    { key: "reports", label: "รายงาน" },
  ];
  const [activeTab, setActiveTab] = useState("overview");
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef(null);

  const insightsRows = useMemo(() => {
    if (!heuristics.breakdown) return [];
    return heuristics.breakdown.map((item) => {
      const series = metrics[item.key] || {};
      const avg = averageFromSeries(series) || item.average;
      const { delta, direction } = calcTrend(series, years);
      return {
        key: item.key,
        label: item.label,
        avg,
        level: item.level,
        score: `${item.score}/${item.max_score}`,
        scoreValue: item.score,
        scoreMax: item.max_score,
        series,
        trendDelta: delta,
        trendDirection: direction,
      };
    });
  }, [heuristics.breakdown, metrics, years]);

  const statusCounts = insightsRows.reduce(
    (acc, row) => {
      const tone = getLevelTone(row.level);
      acc[tone] = (acc[tone] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { total: 0 }
  );

  const handleExportPdf = async () => {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save("IPO-Executive-Report.pdf");
    } catch (error) {
      console.error("Failed to export PDF", error);
      window.alert("ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExporting(false);
    }
  };

  const insightTopMetrics = insightsRows.slice(0, 3);
  const insightWorst = insightsRows
    .filter((row) => row.level === "ต้องปรับปรุง")
    .slice(0, 3);
  const strengthMetrics = insightsRows.filter((row) => row.level?.includes("ดี")).slice(0, 3);

  const revenueTrend = calcTrend(metrics?.total_revenue, years);
  const profitTrend = calcTrend(metrics?.net_profit, years);
  const marginTrend = calcTrend(metrics?.net_profit_margin, years);

  const reportHighlightCards = [
    {
      label: "Momentum รายได้",
      value: revenueAvg ? `฿${formatCurrency(revenueAvg)}` : "-",
      meta: "เฉลี่ย 5 ปี",
      trend: revenueTrend,
    },
    {
      label: "กำไรสุทธิ",
      value: profitAvg ? `฿${formatCurrency(profitAvg)}` : "-",
      meta: "เฉลี่ย 5 ปี",
      trend: profitTrend,
    },
    {
      label: "Net Margin",
      value: netMarginAvg ? `${formatNumber(netMarginAvg, { fraction: 2 })}%` : "-",
      meta: "เฉลี่ย 5 ปี",
      trend: marginTrend,
    },
  ];

  const reportTags = [
    { label: "สถานะรวม", value: heuristics.readiness || "ไม่ระบุ" },
    { label: "คะแนน", value: `${heuristics.score || 0}/${heuristics.max_score || heuristics.score || 0}` },
    { label: "ROA Avg", value: roaAvg ? `${formatNumber(roaAvg, { fraction: 2 })}%` : "-" },
    { label: "ทรัพย์สินเฉลี่ย", value: assetAvg ? `฿${formatCurrency(assetAvg)}` : "-" },
  ];

  const narrativeSections = useMemo(
    () => [
      {
        title: "ภาพรวมผลการประเมิน",
        summary: `ระดับความพร้อมอยู่ที่ ${heuristics.readiness || "ไม่ระบุ"}`,
        bullets: [
          `คะแนนรวม ${heuristics.score || 0}/${heuristics.max_score || heuristics.score || 0} (${heuristics.percentage || 0}%)`,
          revenueAvg ? `รายได้เฉลี่ยรอบ 5 ปีประมาณ ฿${formatCurrency(revenueAvg)}` : "ยังไม่มีข้อมูลรายได้เฉลี่ย",
          netMarginAvg
            ? `อัตรากำไรสุทธิเฉลี่ย ${formatNumber(netMarginAvg, { fraction: 2 })}%`
            : "ยังไม่มีข้อมูลกำไรสุทธิ",
        ],
      },
      {
        title: "ปัจจัยสนับสนุน",
        summary: "ตัวชี้วัดที่ทำได้ดี",
        bullets:
          strengthMetrics.length > 0
            ? strengthMetrics.map(
              (metric) => `${metric.label}: ${metric.level} (${metric.scoreValue}/${metric.scoreMax})`
            )
            : ["ยังไม่มีตัวชี้วัดที่อยู่ในระดับดีมาก"],
      },
      {
        title: "ประเด็นที่ควรเร่งปรับ",
        summary: "โฟกัสรายการที่อยู่ในสถานะต้องปรับปรุง",
        bullets:
          insightWorst.length > 0
            ? insightWorst.map((metric) => `${metric.label}: ${metric.level} (${metric.scoreValue}/${metric.scoreMax})`)
            : ["ยังไม่พบตัวชี้วัดที่อยู่ในระดับต้องปรับปรุง"],
      },
    ],
    [heuristics, revenueAvg, netMarginAvg, strengthMetrics, insightWorst]
  );

  return (
    <div className="assessment-dashboard">
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">MV</div>
        <nav>
          {tabs.map((tab) => (
            <span
              key={tab.key}
              className={`sidebar-item ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </span>
          ))}
          <span className="sidebar-item">ทีมงาน</span>
        </nav>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p className="eyebrow">IPO Assessment</p>
            <h1>ภาพรวมการประเมินล่าสุด</h1>
            {data?.company_name && (
              <p style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#1e293b',
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ color: '#64748b' }}>🏢</span>
                {data.company_name}
              </p>
            )}
          </div>
          <div className="topbar-actions">
            <input type="text" placeholder="ค้นหา..." />
            <button type="button" className="btn btn-blue" onClick={onBackToUpload}>
              ประเมินใหม่
            </button>
            <button type="button" className="btn btn-red" onClick={onBackHome}>
              กลับหน้าแรก
            </button>
          </div>
        </header>




        {activeTab === "overview" && (
          <>
            {/* IPO Readiness Assessment - New Section */}
            {ipoAssessment?.readiness_level && (
              <section className="ipo-assessment-section">
                <div className="ipo-assessment-header">
                  <div className="ipo-readiness-badge" data-level={ipoAssessment.readiness_level}>
                    <span className="badge-icon">
                      {ipoAssessment.readiness_level === "พร้อมสำหรับ SET" && "🏆"}
                      {ipoAssessment.readiness_level === "พร้อมสำหรับ mai" && "✅"}
                      {ipoAssessment.readiness_level === "ใกล้พร้อม" && "📈"}
                      {ipoAssessment.readiness_level === "ต้องพัฒนาเพิ่มเติม" && "⚠️"}
                    </span>
                    <div>
                      <p className="badge-label">ระดับความพร้อม IPO</p>
                      <h2 className="badge-value">{ipoAssessment.readiness_level}</h2>
                    </div>
                  </div>
                  
                  <div className="ipo-market-cards">
                    <div className={`market-card ${ipoAssessment.set_assessment?.passed ? 'passed' : 'not-passed'}`}>
                      <div className="market-card-header">
                        <span className="market-icon">{ipoAssessment.set_assessment?.passed ? '✅' : '❌'}</span>
                        <span className="market-name">SET</span>
                      </div>
                      <p className="market-status">
                        {ipoAssessment.set_assessment?.passed ? 'ผ่านเกณฑ์' : `${ipoAssessment.set_assessment?.pass_count || 0}/${ipoAssessment.set_assessment?.total_checks || 5} เกณฑ์`}
                      </p>
                    </div>
                    <div className={`market-card ${ipoAssessment.mai_assessment?.passed ? 'passed' : 'not-passed'}`}>
                      <div className="market-card-header">
                        <span className="market-icon">{ipoAssessment.mai_assessment?.passed ? '✅' : '❌'}</span>
                        <span className="market-name">mai</span>
                      </div>
                      <p className="market-status">
                        {ipoAssessment.mai_assessment?.passed ? 'ผ่านเกณฑ์' : `${ipoAssessment.mai_assessment?.pass_count || 0}/${ipoAssessment.mai_assessment?.total_checks || 5} เกณฑ์`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Key Figures */}
                <div className="ipo-key-figures">
                  <h4>ข้อมูลสำคัญสำหรับ IPO</h4>
                  <div className="key-figures-grid">
                    <div className="key-figure">
                      <span className="figure-label">กำไรสุทธิปีล่าสุด</span>
                      <span className="figure-value">
                        {ipoAssessment.key_figures?.latest_profit 
                          ? `฿${formatCurrency(ipoAssessment.key_figures.latest_profit)}`
                          : '-'}
                      </span>
                      <span className="figure-requirement">
                        SET ≥75M | mai ≥25M
                      </span>
                    </div>
                    <div className="key-figure">
                      <span className="figure-label">กำไรรวม 2-3 ปี</span>
                      <span className="figure-value">
                        {ipoAssessment.key_figures?.cumulative_profit 
                          ? `฿${formatCurrency(ipoAssessment.key_figures.cumulative_profit)}`
                          : '-'}
                      </span>
                      <span className="figure-requirement">
                        SET ≥125M | mai ≥40M
                      </span>
                    </div>
                    <div className="key-figure">
                      <span className="figure-label">ส่วนของผู้ถือหุ้น</span>
                      <span className="figure-value">
                        {ipoAssessment.key_figures?.shareholders_equity 
                          ? `฿${formatCurrency(ipoAssessment.key_figures.shareholders_equity)}`
                          : '-'}
                      </span>
                      <span className="figure-requirement">
                        SET ≥800M | mai ≥100M
                      </span>
                    </div>
                    <div className="key-figure">
                      <span className="figure-label">Track Record</span>
                      <span className="figure-value">
                        {ipoAssessment.key_figures?.track_record_years || 0} ปี
                      </span>
                      <span className="figure-requirement">
                        SET ≥3 ปี | mai ≥2 ปี
                      </span>
                    </div>
                  </div>
                </div>

                {/* Criteria Checklist */}
                <div className="ipo-criteria-section">
                  <div className="criteria-column">
                    <h5>เกณฑ์ SET ({ipoAssessment.set_assessment?.pass_count || 0}/{ipoAssessment.set_assessment?.total_checks || 5})</h5>
                    <ul className="criteria-list">
                      {ipoAssessment.set_assessment?.checks?.map((check, idx) => (
                        <li key={idx} className={check.passed ? 'passed' : 'failed'}>
                          <span className="check-icon">{check.passed ? '✓' : '✗'}</span>
                          <span className="check-name">{check.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="criteria-column">
                    <h5>เกณฑ์ mai ({ipoAssessment.mai_assessment?.pass_count || 0}/{ipoAssessment.mai_assessment?.total_checks || 5})</h5>
                    <ul className="criteria-list">
                      {ipoAssessment.mai_assessment?.checks?.map((check, idx) => (
                        <li key={idx} className={check.passed ? 'passed' : 'failed'}>
                          <span className="check-icon">{check.passed ? '✓' : '✗'}</span>
                          <span className="check-name">{check.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                {ipoAssessment.recommendations?.length > 0 && (
                  <div className="ipo-recommendations">
                    <h4>💡 คำแนะนำ</h4>
                    <div className="recommendations-list">
                      {ipoAssessment.recommendations.slice(0, 5).map((rec, idx) => (
                        <div key={idx} className={`recommendation-item priority-${rec.priority}`}>
                          <span className="rec-priority">{rec.priority}</span>
                          <span className="rec-category">{rec.category}</span>
                          <span className="rec-message">{rec.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="dashboard-widgets">
              <article className="widget widget-score">
                <div>
                  <p>สุขภาพการเงิน</p>
                  <h2>
                    {ipoAssessment.financial_health?.score || heuristics.score || 0}
                    <small> / {ipoAssessment.financial_health?.max_score || heuristics.max_score || 0}</small>
                  </h2>
                  <p className="status-label">{ipoAssessment.financial_health?.level || heuristics.readiness || "ไม่ระบุ"}</p>
                </div>
                <div className="score-progress">
                  <div
                    className="score-progress__bar"
                    style={{ width: `${ipoAssessment.financial_health?.percentage || heuristics.percentage || 0}%` }}
                  />
                </div>
                <small>{ipoAssessment.financial_health?.percentage || heuristics.percentage || 0}% ของคะแนนทั้งหมด</small>
              </article>
              {highlightCards.map((card) => (
                <article className="widget" key={card.label}>
                  <p>{card.label}</p>
                  <h3>{card.value}</h3>
                  <small>{card.desc}</small>
                </article>
              ))}
            </section>

            <section className="dashboard-grid">
              <article className="panel">
                <h4>สัดส่วนกำไรสุทธิ</h4>
                <DonutChart value={netMarginAvg || 0} label="Net Margin %" />
              </article>

              <article className="panel">
                <h4>ขนาดสินทรัพย์ / ส่วนของผู้ถือหุ้น</h4>
                <div className="mini-bars">
                  <div>
                    <span>สินทรัพย์เฉลี่ย</span>
                    <strong>{assetAvg ? `฿${formatCurrency(assetAvg)}` : "-"}</strong>
                  </div>
                  <div>
                    <span>ส่วนของผู้ถือหุ้น</span>
                    <strong>{equityAvg ? `฿${formatCurrency(equityAvg)}` : "-"}</strong>
                  </div>
                </div>
              </article>

              <article className="panel">
                <h4>กำไรขั้นต้น / สุทธิ</h4>
                <div className="mini-bars">
                  <div>
                    <span>Gross Profit</span>
                    <strong>{grossAvg ? `฿${formatCurrency(grossAvg)}` : "-"}</strong>
                  </div>
                  <div>
                    <span>Net Profit</span>
                    <strong>{profitAvg ? `฿${formatCurrency(profitAvg)}` : "-"}</strong>
                  </div>
                </div>
              </article>

              <article className="panel span-2">
                <h4>แนวโน้มรายได้รวม</h4>
                <LineChart
                  series={metrics?.total_revenue}
                  years={years}
                  color="#4c6ef5"
                  label="Revenue (฿)"
                  formatter={(value) => `฿${formatCurrency(value)}`}
                  axisFormatter={(value) => `฿${formatCompact(value)}`}
                  height={220}
                  fillArea
                />
              </article>

              <article className="panel">
                <h4>ROA / ROE</h4>
                <LineChart
                  series={metrics?.roa}
                  years={years}
                  color="#f97316"
                  label="ROA %"
                  formatter={(value) => `${formatNumber(value, { fraction: 1 })}%`}
                  axisFormatter={(value) => `${formatNumber(value, { fraction: 0 })}%`}
                  height={150}
                />
                <LineChart
                  series={metrics?.roe}
                  years={years}
                  color="#22d3ee"
                  label="ROE %"
                  formatter={(value) => `${formatNumber(value, { fraction: 1 })}%`}
                  axisFormatter={(value) => `${formatNumber(value, { fraction: 0 })}%`}
                  height={150}
                />
              </article>

              <article className="panel">
                <h4>โครงสร้างทุน</h4>
                <div className="ratio-bars">
                  {["debt_to_equity", "debt_to_assets", "current_ratio"].map((key) => (
                    <div key={key} className="ratio-row">
                      <span>{metricLabels[key]}</span>
                      <div className="ratio-bar">
                        <div
                          style={{
                            width: `${Math.min((averageFromSeries(metrics?.[key]) || 0) * 40, 100)}%`,
                          }}
                        />
                      </div>
                      <strong>
                        {formatNumber(averageFromSeries(metrics?.[key]) || 0, { fraction: 2 })}
                      </strong>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel span-2">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">ตัวชี้วัดสำคัญ</p>
                    <h4>คะแนนย่อยแต่ละหมวด</h4>
                  </div>
                  <p className="panel-subtitle">ดูสถานะและคะแนนพร้อมสัญลักษณ์สี</p>
                </div>
                <div className="scorecard-breakdown compact enhanced-grid">
                  {heuristics.breakdown?.map((item) => {
                    const tone = getLevelTone(item.level);
                    return (
                      <div key={item.key} className={`scorecard-item enhanced ${tone}`}>
                        <div className="scorecard-item__meta">
                          <span className="score-badge">
                            {item.score}/{item.max_score}
                          </span>
                          <span className={`level-badge ${tone}`}>{item.level || "ไม่ระบุ"}</span>
                        </div>
                        <p className="scorecard-title">{item.label}</p>
                        <div className="scorecard-progress">
                          <div
                            className="scorecard-progress__fill"
                            style={{
                              width: `${Math.min((item.score / item.max_score) * 100 || 0, 100)}%`,
                            }}
                          />
                        </div>
                        <small>ค่าเฉลี่ย {formatNumber(averageFromSeries(metrics[item.key]), { fraction: 2 })}</small>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>
          </>
        )}

        {activeTab === "insights" && (
          <section className="panel span-2 insights-section redesigned">
            <div className="insights-hero">
              <div className="insights-hero__summary">
                <div>
                  <p className="eyebrow">ข้อมูลเชิงลึก</p>
                  <h3>สถานะตัวชี้วัด {statusCounts.total} รายการ</h3>
                  <p className="muted">จัดลำดับความสำคัญการปรับปรุงด้วยสีและแนวโน้ม</p>
                </div>
                <div className="insights-counters">
                  {["positive", "informative", "warning", "muted"].map((tone) => (
                    <div key={tone} className={`insights-counter ${tone}`}>
                      <strong>{statusCounts[tone] || 0}</strong>
                      <span>
                        {tone === "positive" && "ดี/แข็งแรง"}
                        {tone === "informative" && "ขนาดธุรกิจ"}
                        {tone === "warning" && "ต้องปรับปรุง"}
                        {tone === "muted" && "ไม่มีข้อมูล"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="insights-highlight-cards">
                {insightTopMetrics.map((item, idx) => (
                  <article key={item.key} className="insight-card">
                    <span className="insight-card__icon" aria-hidden="true">
                      {["📈", "📊", "💹"][idx] || "📌"}
                    </span>
                    <div className="insight-card__body">
                      <p>{item.label}</p>
                      <strong>{formatNumber(item.avg, { fraction: 2 })}</strong>
                      <div className="trend-row">
                        <span className={`trend-chip ${item.trendDirection}`}>
                          {item.trendDirection === "up" && "▲"}
                          {item.trendDirection === "down" && "▼"}
                          {item.trendDirection === "flat" && "▬"} {formatNumber(item.trendDelta, { fraction: 2 })}
                        </span>
                        <span className={`level-badge ${getLevelTone(item.level)}`}>{item.level}</span>
                      </div>
                    </div>
                    <Sparkline series={item.series} years={years} />
                  </article>
                ))}
              </div>
            </div>

            <div className="insights-grid redesigned">
              <div className="insights-panel enhanced">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">ภาพรวมตัวชี้วัด</p>
                    <h4>เปรียบเทียบค่าเฉลี่ย 5 ปีและคะแนน</h4>
                  </div>
                  <p className="panel-subtitle">มีสกอร์ {insightsRows.length} รายการ</p>
                </div>
                <div className="insights-table-wrapper sleek">
                  <table>
                    <thead>
                      <tr>
                        <th>ตัวชี้วัด</th>
                        <th>ค่าเฉลี่ย 5 ปี</th>
                        <th>แนวโน้ม</th>
                        <th>สถานะ</th>
                        <th>คะแนน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insightsRows.map((row) => (
                        <tr key={row.label} className={getLevelTone(row.level)}>
                          <td>
                            <div className="metric-cell">
                              <span>{row.label}</span>
                              <Sparkline series={row.series} years={years} color="#94a3b8" />
                            </div>
                          </td>
                          <td>
                            <div className="table-bar">
                              <div
                                style={{
                                  width: `${Math.min(
                                    Math.abs(row.avg || 0) > 100 ? 100 : (Math.abs(row.avg || 0) / 100) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                              <span>{formatNumber(row.avg, { fraction: 2 })}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`trend-chip ${row.trendDirection}`}>
                              {row.trendDirection === "up" && "▲"}
                              {row.trendDirection === "down" && "▼"}
                              {row.trendDirection === "flat" && "▬"} {formatNumber(row.trendDelta, { fraction: 2 })}
                            </span>
                          </td>
                          <td>
                            <span className={`level-badge ${getLevelTone(row.level)}`}>{row.level}</span>
                          </td>
                          <td>
                            <div className="score-badge compact">
                              {row.scoreValue}/{row.scoreMax}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="insight-warnings enhanced">
                <h5>ตัวชี้วัดที่ต้องปรับปรุง</h5>
                <p>โฟกัส 3 รายการที่อยู่ในระดับ “ต้องปรับปรุง” มากที่สุด</p>
                {insightWorst.length === 0 && <p>ไม่มีตัวชี้วัดที่อยู่ในระดับต้องปรับปรุง</p>}
                {insightWorst.map((item) => (
                  <div key={item.key} className="warning-card">
                    <div>
                      <strong>{item.label}</strong>
                      <p>ค่าเฉลี่ย {formatNumber(item.avg, { fraction: 2 })}</p>
                    </div>
                    <div className="warning-actions">
                      <span className="warning-chip">ปรับปรุงด่วน</span>
                      <button type="button" className="ghost-btn small">
                        ดูแนวโน้ม
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "reports" && (
          <section className="panel span-2 reports-layout" ref={reportRef}>
            <div className="report-cover">
              <div>
                <p className="eyebrow">Executive Overview</p>
                <h3>ภาพรวมผลการประเมินล่าสุด</h3>
                <p>เทมเพลตสำหรับส่งมอบรายงานให้ผู้บริหารหรือทีมที่เกี่ยวข้อง สามารถใช้กับบริษัทอื่น ๆ ได้ทันที</p>
              </div>
              <div className="report-cover__score">
                <span>คะแนนรวม</span>
                <strong>
                  {heuristics.score || 0}
                  <small>/{heuristics.max_score || heuristics.score || 0}</small>
                </strong>
                <p>{heuristics.readiness || "ไม่ระบุ"}</p>
              </div>
              <div className="report-tags">
                {reportTags.map((tag) => (
                  <div key={tag.label}>
                    <span>{tag.label}</span>
                    <strong>{tag.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="report-highlight-cards">
              {reportHighlightCards.map((card) => (
                <article key={card.label} className="report-highlight">
                  <p>{card.label}</p>
                  <h4>{card.value}</h4>
                  <div className={`trend-chip ${card.trend.direction}`}>
                    {card.trend.direction === "up" && "▲"}
                    {card.trend.direction === "down" && "▼"}
                    {card.trend.direction === "flat" && "▬"} {formatNumber(card.trend.delta, { fraction: 2 })}
                  </div>
                  <small>{card.meta}</small>
                </article>
              ))}
            </div>

            <div className="report-charts-grid">
              <article className="report-chart span-2">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Growth Track</p>
                    <h4>แนวโน้มรายได้รวม</h4>
                  </div>
                  <p className="panel-subtitle">ข้อมูลย้อนหลัง {years.length} ปี</p>
                </div>
                <LineChart
                  series={metrics?.total_revenue}
                  years={years}
                  color="#4c6ef5"
                  label="Revenue (฿)"
                  formatter={(value) => `฿${formatCurrency(value)}`}
                  axisFormatter={(value) => `฿${formatCompact(value)}`}
                  height={220}
                  fillArea
                />
              </article>

              <article className="report-chart">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Profitability</p>
                    <h4>Net Margin %</h4>
                  </div>
                </div>
                <LineChart
                  series={metrics?.net_profit_margin}
                  years={years}
                  color="#22d3ee"
                  label="Net Margin %"
                  formatter={(value) => `${formatNumber(value, { fraction: 2 })}%`}
                  axisFormatter={(value) => `${formatNumber(value, { fraction: 0 })}%`}
                  height={160}
                />
              </article>

              <article className="report-chart">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">ROA / ROE</p>
                    <h4>ประสิทธิภาพการใช้สินทรัพย์</h4>
                  </div>
                </div>
                <LineChart
                  series={metrics?.roa}
                  years={years}
                  color="#fb923c"
                  label="ROA %"
                  formatter={(value) => `${formatNumber(value, { fraction: 1 })}%`}
                  axisFormatter={(value) => `${formatNumber(value, { fraction: 0 })}%`}
                  height={160}
                />
              </article>

              <article className="report-chart span-2">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Balance Sheet</p>
                    <h4>สินทรัพย์ vs ส่วนของผู้ถือหุ้น</h4>
                  </div>
                </div>
                <div className="report-balance">
                  <div>
                    <span>สินทรัพย์เฉลี่ย</span>
                    <strong>{assetAvg ? `฿${formatCurrency(assetAvg)}` : "-"}</strong>
                  </div>
                  <div>
                    <span>ส่วนของผู้ถือหุ้นเฉลี่ย</span>
                    <strong>{equityAvg ? `฿${formatCurrency(equityAvg)}` : "-"}</strong>
                  </div>
                  <div>
                    <span>หนี้สินรวมเฉลี่ย</span>
                    <strong>{liabilitiesAvg ? `฿${formatCurrency(liabilitiesAvg)}` : "-"}</strong>
                  </div>
                </div>
              </article>
            </div>

            <div className="report-narrative">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Narrative Template</p>
                  <h4>ข้อคิดเห็นเชิงกลยุทธ์</h4>
                </div>
                <p className="panel-subtitle">สามารถปรับข้อความตามบริษัทได้ทันที</p>
              </div>
              <div className="report-narrative__grid">
                {narrativeSections.map((section) => (
                  <article key={section.title}>
                    <h5>{section.title}</h5>
                    <p>{section.summary}</p>
                    <ul>
                      {section.bullets.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>

            <div className="reports-actions expanded">
              <div>
                <p className="eyebrow">Export</p>
                <h4>รายงานที่สามารถส่งออก</h4>
                <p>เลือกช่องทางการนำเสนอผลการประเมิน</p>
              </div>
              <div className="reports-actions__buttons">
                <button
                  type="button"
                  className="primary-btn outline"
                  onClick={handleExportPdf}
                  disabled={isExporting}
                >
                  {isExporting ? "กำลังสร้าง..." : "ดาวน์โหลด Executive PDF"}
                </button>
                <button type="button" className="primary-btn">ส่งออก CSV ตัวชี้วัด</button>
                <button type="button" className="ghost-btn">เปิด Report Builder</button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default AssessmentReport;
