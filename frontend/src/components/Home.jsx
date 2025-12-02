const FLOW_ITEMS = [
  {
    id: "assessment",
    title: "Financial Readiness",
    description: "ประเมินความพร้อมด้านงบการเงินก่อนยื่น IPO",
    icon: "📊",
    action: "เริ่มประเมิน",
    handler: "start",
  },
  {
    id: "document",
    title: "Document Checklist",
    description: "ตรวจสอบเอกสารสำคัญที่ต้องเตรียม",
    icon: "🗂️",
    action: "เปิดเช็กลิสต์",
    handler: "checklist",
  },
  {
    id: "compliance",
    title: "Compliance Tracker",
    description: "ติดตามข้อกำกับและเงื่อนไขจากตลาดหลักทรัพย์",
    icon: "🛡️",
    action: "ดูรายละเอียด",
    handler: "compliance",
  },
  {
    id: "report",
    title: "Progress Report",
    description: "ภาพรวมผลการประเมินล่าสุดแบบเรียลไทม์",
    icon: "📈",
    action: "ดูรายงาน",
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
            <h3>จัดการผู้ใช้</h3>
            <p>ควบคุมสิทธิ์และสร้างบัญชีใหม่สำหรับทีม IPO</p>
            <button
              type="button"
              className="primary-btn flow-card__action"
              onClick={() => handleClick("admin")}
            >
              ไปที่ Admin
            </button>
          </article>
        )}
      </div>

      <div className="home-status">
        {status ? status : "พร้อมสำหรับการประเมินรอบถัดไป"}
      </div>
    </div>
  );
}

export default Home;
