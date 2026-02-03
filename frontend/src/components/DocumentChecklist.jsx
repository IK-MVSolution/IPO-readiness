export default function DocumentChecklist({ onBack }) {
    const handleOpenDBD = () => {
        window.open("https://datawarehouse.dbd.go.th/index", "_blank");
    };

    return (
        <section className="document-checklist-page">
            <div className="document-page-header">
                <div>
                    <button type="button" className="ghost-btn" onClick={onBack}>
                        ← กลับ
                    </button>
                    <div className="document-header-title">
                        <p className="tag ghost">DBD Data Warehouse</p>
                        <h2>ฐานข้อมูลกรมพัฒนาธุรกิจการค้า (DBD)</h2>
                        <p className="subtitle">
                            เอกสารที่ต้องดาวน์โหลดจาก DBD Data Warehouse สำหรับการวิเคราะห์ความพร้อม IPO
                        </p>
                    </div>
                </div>
            </div>

            {/* Required Documents Info */}
            <div className="dbd-info-section">
                <div className="dbd-info-card glass-effect">
                    <div className="dbd-info-header">
                        <span className="dbd-icon">🏛️</span>
                        <h3>เอกสารที่ต้องดาวน์โหลด</h3>
                    </div>
                    <p className="dbd-info-description">
                        กรุณาดาวน์โหลดเอกสาร 3 รายการต่อไปนี้จาก DBD Data Warehouse เพื่อใช้ในการวิเคราะห์
                    </p>
                    
                    <div className="required-docs-list">
                        <div className="required-doc-item">
                            <span className="doc-number">1</span>
                            <div className="doc-info">
                                <span className="doc-icon">📊</span>
                                <div>
                                    <strong>งบแสดงฐานะการเงิน</strong>
                                    <p>Balance Sheet / Statement of Financial Position</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="required-doc-item">
                            <span className="doc-number">2</span>
                            <div className="doc-info">
                                <span className="doc-icon">💰</span>
                                <div>
                                    <strong>งบกำไรขาดทุน</strong>
                                    <p>Income Statement / Profit and Loss Statement</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="required-doc-item">
                            <span className="doc-number">3</span>
                            <div className="doc-info">
                                <span className="doc-icon">📈</span>
                                <div>
                                    <strong>อัตราส่วนทางการเงิน</strong>
                                    <p>Financial Ratios Analysis</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="dbd-action-section">
                        <button
                            type="button"
                            className="dbd-link-btn primary"
                            onClick={handleOpenDBD}
                        >
                            🔗 เปิด DBD Data Warehouse
                            <span className="external-icon">↗</span>
                        </button>
                        <small className="external-note">
                            *เปิดในแท็บใหม่ - จำเป็นต้องมี DBD Account
                        </small>
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="dbd-instructions">
                <h3>วิธีดาวน์โหลดเอกสาร</h3>
                <div className="instruction-steps">
                    <div className="instruction-step">
                        <span className="step-number">1</span>
                        <div>
                            <strong>เข้าสู่ระบบ DBD Data Warehouse</strong>
                            <p>ใช้ DBD Account ของคุณเพื่อเข้าสู่ระบบ</p>
                        </div>
                    </div>
                    <div className="instruction-step">
                        <span className="step-number">2</span>
                        <div>
                            <strong>ค้นหาบริษัท</strong>
                            <p>ใส่ชื่อบริษัทหรือเลขทะเบียนนิติบุคคลเพื่อค้นหา</p>
                        </div>
                    </div>
                    <div className="instruction-step">
                        <span className="step-number">3</span>
                        <div>
                            <strong>ดาวน์โหลดเอกสาร</strong>
                            <p>เลือกดาวน์โหลดงบการเงินและอัตราส่วนทางการเงิน</p>
                        </div>
                    </div>
                    <div className="instruction-step">
                        <span className="step-number">4</span>
                        <div>
                            <strong>อัปโหลดเพื่อวิเคราะห์</strong>
                            <p>นำไฟล์ที่ได้มาอัปโหลดในหน้า "วิเคราะห์ความพร้อม"</p>
                        </div>
                    </div>
                </div>
            </div>

        </section>
    );
}
