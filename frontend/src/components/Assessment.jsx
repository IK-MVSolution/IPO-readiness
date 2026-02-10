import { useRef, useState } from "react";

const initialState = [];

function AssessmentUpload({ apiBase, onBack, onComplete }) {
  const [files, setFiles] = useState(initialState);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [checkingFiles, setCheckingFiles] = useState(false);
  const formRef = useRef(null);

  const handleFileChange = async (event) => {
    const { files: selected } = event.target;
    const fileList = Array.from(selected);
    setFiles(fileList);
    setPreviewData(null);
    setStatus("");

    // ตรวจสอบชื่อบริษัทจากไฟล์ที่เลือก (ถ้ามีหลายไฟล์)
    if (fileList.length > 0) {
      setCheckingFiles(true);
      try {
        const formData = new FormData();
        fileList.forEach((file) => formData.append("workbooks", file));
        const response = await fetch(`${apiBase}/api/analyze/preview`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (response.ok) {
          setPreviewData(data);
          if (!data.is_consistent && fileList.length > 1) {
            setStatus(`⚠️ พบชื่อบริษัทไม่ตรงกัน:\n${data.companies.map(c => `- ${c.file}: ${c.company}`).join('\n')}\n\nกรุณาตรวจสอบและอัปโหลดเฉพาะไฟล์ของบริษัทเดียวกัน`);
          } else if (data.companies.length > 0) {
            const company = data.companies[0].company;
            if (company && company !== "(ไม่พบชื่อบริษัท)") {
              setStatus(`✓ พบชื่อบริษัท: ${company}`);
            }
          }
        } else {
          setStatus(data.error || "ไม่สามารถตรวจสอบไฟล์ได้");
        }
      } catch (error) {
        console.error("Preview error:", error);
        // ไม่แสดง error ถ้า preview ล้มเหลว - ให้ประมวลผลได้ (backward compatibility)
      } finally {
        setCheckingFiles(false);
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!files.length) {
      setStatus("กรุณาเลือกอย่างน้อย 1 ไฟล์ข้อมูลทางการเงิน");
      return;
    }
    // ตรวจสอบอีกครั้งก่อนประมวลผล (ถ้ามีหลายไฟล์และชื่อไม่ตรงกัน)
    if (previewData && !previewData.is_consistent && files.length > 1) {
      setStatus("⚠️ ไม่สามารถประมวลผลได้: ชื่อบริษัทในไฟล์ไม่ตรงกัน กรุณาตรวจสอบไฟล์");
      return;
    }
    setLoading(true);
    setStatus("กำลังประมวลผล...");
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("workbooks", file));
      const response = await fetch(`${apiBase}/api/analyze`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการประเมิน");
      }
      setStatus("รอแป๊บนะครับ กำลังจัดทำรายงาน...");
      setTimeout(() => {
        setLoading(false);
        onComplete?.(data);
        resetForm();
      }, 3000);
    } catch (error) {
      setStatus(error.message);
      setLoading(false);
    }
  };

  const resetForm = () => {
    formRef.current?.reset();
    setFiles(initialState);
  };

  return (
    <section className="assessment-layout">
      {loading && (
        <div className="assessment-loading">
          <div className="loading-car">
            <span role="img" aria-label="car">
              🚗
            </span>
          </div>
          <p>รอแป๊บนะครับ ระบบกำลังประเมินข้อมูลให้...</p>
        </div>
      )}
      <header className="assessment-header">
        <div>
          <p className="eyebrow">IPO Readiness</p>
          <h2>อัปโหลดไฟล์เพื่อประเมิน</h2>
          <p>ใช้ไฟล์ Excel เทมเพลตที่มี 3 แท็บ (FS, PL, Ratio) ตามตำแหน่งเซลล์กำหนด</p>
        </div>
        <div className="assessment-actions">
          <button type="button" className="ghost-btn" onClick={resetForm}>
            ล้างข้อมูล
          </button>
          <button type="button" className="pill-btn danger" onClick={onBack}>
            กลับหน้าหลัก
          </button>
        </div>
      </header>

      <form className="assessment-form" onSubmit={handleSubmit} ref={formRef}>
        <label className="assessment-field">
          <span>เลือกไฟล์การเงิน (.xlsx)</span>
          <input
            type="file"
            name="workbooks"
            accept=".xlsx,.xls"
            multiple
            onChange={handleFileChange}
            required
            disabled={checkingFiles}
          />
          <small>
            สามารถเลือกพร้อมกันได้หลายไฟล์ (งบฐานะ/งบกำไร/อัตราส่วน) หรือไฟล์เดียวที่รวมทุกแท็บ
            {checkingFiles && " (กำลังตรวจสอบไฟล์...)"}
          </small>
        </label>

        {previewData && previewData.companies.length > 0 && (
          <div className={`file-preview ${previewData.is_consistent ? 'file-preview--ok' : 'file-preview--warning'}`}>
            <strong>ชื่อบริษัทที่พบในไฟล์:</strong>
            <ul>
              {previewData.companies.map((item, idx) => (
                <li key={idx}>
                  <span className="file-name">{item.file}:</span> {item.company}
                </li>
              ))}
            </ul>
            {!previewData.is_consistent && files.length > 1 && (
              <p className="warning-text">⚠️ ชื่อบริษัทไม่ตรงกัน - กรุณาตรวจสอบและอัปโหลดเฉพาะไฟล์ของบริษัทเดียวกัน</p>
            )}
          </div>
        )}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? "กำลังประมวลผล..." : "ประเมินความพร้อม"}
        </button>
      </form>

      {status && <p className="status">{status}</p>}
    </section>
  );
}

export default AssessmentUpload;
