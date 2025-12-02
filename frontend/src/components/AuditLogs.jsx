import { useState, useEffect, useMemo } from "react";

export default function AuditLogs({ onBack }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [actionFilter, setActionFilter] = useState("all");
    const [userFilter, setUserFilter] = useState("all");
    const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/admin/audit-logs`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to fetch logs");
            setLogs(data.logs || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const uniqueActions = useMemo(() => {
        const actions = new Set(logs.map(log => log.action));
        return Array.from(actions).sort();
    }, [logs]);

    const uniqueUsers = useMemo(() => {
        const users = new Set(logs.map(log => log.user_name));
        return Array.from(users).sort();
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = searchTerm === "" ||
                log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesAction = actionFilter === "all" || log.action === actionFilter;
            const matchesUser = userFilter === "all" || log.user_name === userFilter;

            return matchesSearch && matchesAction && matchesUser;
        });
    }, [logs, searchTerm, actionFilter, userFilter]);

    const handleExport = () => {
        if (!filteredLogs.length) return;
        const headers = ["ID", "Timestamp", "User", "Action", "Details"];
        const csvContent = [
            headers.join(","),
            ...filteredLogs.map((log) =>
                [
                    log.id,
                    `"${log.created_at}"`,
                    `"${log.user_name}"`,
                    `"${log.action}"`,
                    `"${log.details || ''}"`,
                ].join(",")
            ),
        ].join("\n");

        // Add UTF-8 BOM so Excel can properly read Thai characters
        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `audit_logs_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearFilters = () => {
        setSearchTerm("");
        setActionFilter("all");
        setUserFilter("all");
    };

    return (
        <section className="audit-page-full">
            <div className="audit-page-header">
                <div>
                    <button type="button" className="ghost-btn" onClick={onBack}>
                        ← กลับ
                    </button>
                    <div className="audit-header-title">
                        <p className="tag ghost">Audit Logs</p>
                        <h2>บันทึกการใช้งานระบบ</h2>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleExport}
                    className="primary-btn"
                    disabled={!filteredLogs.length}
                >
                    📥 Export CSV
                </button>
            </div>

            {error && <p className="status error">{error}</p>}

            <div className="audit-filters">
                <input
                    type="text"
                    placeholder="🔍 ค้นหา..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="filter-search"
                />
                <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="filter-select"
                >
                    <option value="all">การกระทำทั้งหมด</option>
                    {uniqueActions.map(action => (
                        <option key={action} value={action}>{action}</option>
                    ))}
                </select>
                <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="filter-select"
                >
                    <option value="all">ผู้ใช้ทั้งหมด</option>
                    {uniqueUsers.map(user => (
                        <option key={user} value={user}>{user}</option>
                    ))}
                </select>
                {(searchTerm || actionFilter !== "all" || userFilter !== "all") && (
                    <button type="button" onClick={clearFilters} className="ghost-btn small">
                        ล้างตัวกรอง
                    </button>
                )}
                <span className="filter-count">
                    แสดง {filteredLogs.length} จาก {logs.length} รายการ
                </span>
            </div>

            <div className="audit-table-container">
                {loading ? (
                    <p className="loading-text">กำลังโหลดข้อมูล...</p>
                ) : (
                    <table className="audit-table-full">
                        <thead>
                            <tr>
                                <th>เวลา</th>
                                <th>ผู้ใช้งาน</th>
                                <th>การกระทำ</th>
                                <th>รายละเอียด</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map((log) => (
                                <tr key={log.id}>
                                    <td className="timestamp">
                                        {new Date(log.created_at).toLocaleString("th-TH", {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                    <td className="user-cell">
                                        <strong>{log.user_name}</strong>
                                    </td>
                                    <td>
                                        <span className="action-badge">{log.action}</span>
                                    </td>
                                    <td className="details-cell">{log.details || "-"}</td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="empty-cell">
                                        {logs.length === 0 ? "ไม่พบข้อมูลบันทึก" : "ไม่พบผลลัพธ์ที่ตรงกับตัวกรอง"}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </section>
    );
}
