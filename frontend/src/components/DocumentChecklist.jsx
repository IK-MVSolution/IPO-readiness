import { useState } from "react";

const REQUIRED_DOCUMENTS = [
    {
        id: 1,
        name: "งบแสดงฐานะการเงิน",
        description: "ดาวน์โหลดงบแสดงฐานะการเงินจาก DBD Data Warehouse",
        icon: "📊",
        filename: "balance_sheet_dbd.pdf",
    },
    {
        id: 2,
        name: "งบกำไรขาดทุน",
        description: "ดาวน์โหลดงบกำไรขาดทุนจาก DBD Data Warehouse",
        icon: "💰",
        filename: "income_statement_dbd.pdf",
    },
    {
        id: 3,
        name: "อัตราส่วนทางการเงิน",
        description: "ดาวน์โหลดอัตราส่วนทางการเงินจาก DBD Data Warehouse",
        icon: "📈",
        filename: "financial_ratios_dbd.pdf",
    },
];

export default function DocumentChecklist({ onBack }) {
    const [downloadedDocs, setDownloadedDocs] = useState(new Set());

    const handleDownload = (doc) => {
        // Simulate download - in production, this would download actual files
        const link = document.createElement("a");
        link.href = "#"; // In production: link to actual file
        link.download = doc.filename;

        // For demo: create a simple text file
        const blob = new Blob(
            [`ตัวอย่างเอกสาร: ${doc.name}\n\nเอกสารจริงควรดาวน์โหลดจาก DBD Data Warehouse:\nhttps://datawarehouse.dbd.go.th/index\n\nเอกสารนี้จำเป็นสำหรับการเตรียมความพร้อม IPO`],
            { type: "text/plain" }
        );
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        // Mark as downloaded
        setDownloadedDocs(new Set([...downloadedDocs, doc.id]));
    };

    const handleOpenDBD = () => {
        window.open("https://datawarehouse.dbd.go.th/index", "_blank");
    };

    const completionPercentage = Math.round(
        (downloadedDocs.size / REQUIRED_DOCUMENTS.length) * 100
    );

    return (
        <section className="document-checklist-page">
            <div className="document-page-header">
                <div>
                    <button type="button" className="ghost-btn" onClick={onBack}>
                        ← กลับ
                    </button>
                    <div className="document-header-title">
                        <p className="tag ghost">Document Checklist</p>
                        <h2>เอกสารที่ต้องเตรียมจาก DBD</h2>
                        <p className="subtitle">
                            เตรียมเอกสาร 3 อย่างจาก DBD Data Warehouse สำหรับการเตรียมความพร้อม IPO
                        </p>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="document-progress">
                <div className="progress-header">
                    <span>ความคืบหน้า</span>
                    <span className="progress-percentage">{completionPercentage}%</span>
                </div>
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${completionPercentage}%` }}
                    />
                </div>
                <p className="progress-text">
                    ดาวน์โหลดแล้ว {downloadedDocs.size} จาก {REQUIRED_DOCUMENTS.length} ไฟล์
                </p>
            </div>

            {/* Document List */}
            <div className="document-list">
                <h3>เอกสารที่จำเป็นจาก DBD</h3>
                <div className="document-grid">
                    {REQUIRED_DOCUMENTS.map((doc) => {
                        const isDownloaded = downloadedDocs.has(doc.id);
                        return (
                            <article key={doc.id} className={`document-item ${isDownloaded ? "downloaded" : ""}`}>
                                <div className="document-item-header">
                                    <div className="document-icon">{doc.icon}</div>
                                    {isDownloaded && (
                                        <span className="document-badge">✓ ดาวน์โหลดแล้ว</span>
                                    )}
                                </div>
                                <h4>{doc.name}</h4>
                                <p>{doc.description}</p>
                                <button
                                    type="button"
                                    className={`document-download-btn ${isDownloaded ? "secondary" : "primary"}`}
                                    onClick={() => handleDownload(doc)}
                                >
                                    {isDownloaded ? "📥 ดาวน์โหลดอีกครั้ง" : "📥 ดาวน์โหลด"}
                                </button>
                            </article>
                        );
                    })}
                </div>
            </div>

            {/* DBD External Link Section */}
            <div className="external-link-section">
                <div className="external-link-card glass-effect">
                    <div className="external-link-icon">🏛️</div>
                    <div className="external-link-content">
                        <h3>ฐานข้อมูลกรมพัฒนาธุรกิจการค้า (DBD)</h3>
                        <p>
                            เข้าถึงข้อมูลธุรกิจและเอกสารทางการค้าจากกรมพัฒนาธุรกิจการค้า
                            เพื่อตรวจสอบข้อมูลบริษัทและดาวน์โหลดเอกสารเพิ่มเติม
                        </p>
                        <button
                            type="button"
                            className="dbd-link-btn"
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

            {/* Additional Resources */}
            <div className="document-resources">
                <h3>ข้อมูลเพิ่มเติม</h3>
                <div className="resource-list">
                    <div className="resource-item">
                        <span className="resource-icon">📖</span>
                        <div>
                            <strong>คู่มือการยื่นขออนุญาต IPO</strong>
                            <p>แนวทางและขั้นตอนการเตรียมความพร้อม</p>
                        </div>
                    </div>
                    <div className="resource-item">
                        <span className="resource-icon">⚖️</span>
                        <div>
                            <strong>ข้อกำหนดของ ก.ล.ต.</strong>
                            <p>กฎระเบียบและเงื่อนไขที่ต้องปฏิบัติตาม</p>
                        </div>
                    </div>
                    <div className="resource-item">
                        <span className="resource-icon">💼</span>
                        <div>
                            <strong>เอกสารประกอบจากที่ปรึกษาทางการเงิน</strong>
                            <p>แบบฟอร์มและเทมเพลตเพิ่มเติม</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
