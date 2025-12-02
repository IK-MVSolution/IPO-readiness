import { useRef, useState } from "react";

const initialState = [];

function AssessmentUpload({ apiBase, onBack, onComplete }) {
  const [files, setFiles] = useState(initialState);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);

  const handleFileChange = (event) => {
    const { files: selected } = event.target;
    setFiles(Array.from(selected));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!files.length) {
      setStatus("กรุณาเลือกอย่างน้อย 1 ไฟล์ข้อมูลทางการเงิน");
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
          />
          <small>
            สามารถเลือกพร้อมกันได้หลายไฟล์ (งบฐานะ/งบกำไร/อัตราส่วน) หรือไฟล์เดียวที่รวมทุกแท็บ
          </small>
        </label>

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? "กำลังประมวลผล..." : "ประเมินความพร้อม"}
        </button>
      </form>

      {status && <p className="status">{status}</p>}
    </section>
  );
}

export default AssessmentUpload;
