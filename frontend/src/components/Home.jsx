const FLOW_ITEMS = [
  {
    id: "document",
    title: "Document Checklist",
    description: "เอกสารนิติบุคคลและงบการเงิน",
    icon: "🗂️",
    action: "เตรียมเอกสาร",
    handler: "checklist",
  },
  {
    id: "assessment",
    title: "IPO Financial Readiness",
    description: "ประเมินความพร้อมด้านการเงิน",
    icon: "📊",
    action: "คลิกปุ่มประเมิน",
    handler: "start",
  },
  {
    id: "report",
    title: "Progress Report",
    description: "ผลการประเมินล่าสุดแบบเรียลไทม์",
    icon: "📈",
    action: "คลิกรายงาน",
    handler: "report",
  },
];

function Home({
  status,
  isAdminRole,
  onStartAssessment,
  onGoToAdmin,
  onNavigate,
}) {
  const handleClick = (handler) => {
    if (handler === "start") {
      onStartAssessment();
    } else if (handler === "admin") {
      onGoToAdmin();
    } else if (onNavigate) {
      onNavigate(handler);
    }
  };

  return (
    <div className="home-layout">
      <div className="home-flows">
        {FLOW_ITEMS.map((item) => (
          <article key={item.id} className="flow-card">
            <div className="flow-card__icon" aria-hidden="true">
              <span>{item.icon}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <button
              type="button"
              className="primary-btn flow-card__action"
              onClick={() => handleClick(item.handler)}
            >
              {item.action}
            </button>
          </article>
        ))}
        {isAdminRole && (
          <article className="flow-card admin-card">
            <div className="flow-card__icon" aria-hidden="true">
              <span>🧑‍💼</span>
            </div>
            <h3>Admin</h3>
            <p>กำหนดสิทธิ์/สร้างบัญชีใหม่</p>
            <button
              type="button"
              className="primary-btn flow-card__action"
              onClick={() => handleClick("admin")}
            >
              คลิกจัดการผู้ใช้งานระบบ

            </button>
          </article>
        )}
      </div>


    </div>
  );
}

export default Home;
