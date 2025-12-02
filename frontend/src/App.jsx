import { useEffect, useState } from "react";
import mvLogo from "../Photo/MVLogo.png";
import "./App.css";
import Home from "./components/Home";
import AssessmentUpload from "./components/Assessment";
import AssessmentReport from "./components/AssessmentReport";
import AuditLogs from "./components/AuditLogs";
import DocumentChecklist from "./components/DocumentChecklist";

function App() {
  const USER_STORAGE_KEY = "ipo-readiness-user";
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [adminStatus, setAdminStatus] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "analyst",
    password: "",
  });

  const isLoggedIn = Boolean(currentUser);
  const isAdminRole = currentUser?.role === "admin";

  // Allow login, forgot-password, and reset-password views when not logged in
  const safeView = !isLoggedIn
    ? (["forgot-password", "reset-password"].includes(view) ? view : "login")
    : view === "admin" && !isAdminRole
      ? "home"
      : view;
  const isAdminView = safeView === "admin";
  const isAssessmentUploadView = safeView === "assessment-upload";
  const isAssessmentReportView = safeView === "assessment-report";
  const handleStartAssessment = () => {
    setStatus("");
    setAssessmentResult(null);
    setView("assessment-upload");
  };
  const handleGoToAdminView = () => setView("admin");

  const logAction = async (action, details = "") => {
    if (!currentUser) return;
    try {
      await fetch(`${API_BASE}/api/admin/audit-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser.id,
          user_name: currentUser.name,
          action,
          details,
        }),
      });
    } catch (error) {
      console.error("Failed to log action:", error);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      }
      setCurrentUser(data.user);
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      setView("home");
      setStatus(`ยินดีต้อนรับ ${data.user.name}`);

      // Log login event
      await fetch(`${API_BASE}/api/admin/audit-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: data.user.id,
          user_name: data.user.name,
          action: "Login",
          details: `Logged in from ${email}`,
        }),
      }).catch(err => console.error("Failed to log login:", err));
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/users`);
      if (!response.ok) throw new Error("ไม่สามารถดึงรายชื่อผู้ใช้ได้");
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      setAdminStatus(error.message);
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setAdminStatus("");
    setAdminLoading(true);
    try {
      const payload = {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      };
      if (!editingUserId || newUser.password) {
        if (newUser.password) {
          payload.password = newUser.password;
        } else if (!editingUserId) {
          throw new Error("กรุณาระบุรหัสผ่าน");
        }
      }
      const url = editingUserId
        ? `${API_BASE}/api/admin/users/${editingUserId}`
        : `${API_BASE}/api/admin/users`;
      const method = editingUserId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
      setNewUser({ name: "", email: "", role: "analyst", password: "" });
      setEditingUserId(null);
      fetchUsers();
      setAdminStatus("บันทึกข้อมูลสำเร็จ");
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (view === "admin" && isAdminRole) {
      fetchUsers();
    }
  }, [view, isAdminRole]);
  useEffect(() => {
    const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser(parsed);
        setView("home");
        setStatus(`ยินดีต้อนรับกลับ ${parsed.name}`);
      } catch (error) {
        window.localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
  }, []);

  const handleAuditLogs = () => {
    setView("audit-logs");
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("ยืนยันการลบผู้ใช้?")) return;
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("ลบผู้ใช้ไม่สำเร็จ");
      if (editingUserId === userId) {
        handleCancelEdit();
      }
      fetchUsers();
    } catch (error) {
      setAdminStatus(error.message);
    }
  };

  const handleEditUser = (user) => {
    setNewUser({
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
    });
    setEditingUserId(user.id);
    setAdminStatus(`กำลังแก้ไขผู้ใช้ ${user.email}`);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setNewUser({ name: "", email: "", role: "analyst", password: "" });
    setAdminStatus("");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    setView("login");
  };

  const goHome = () => setView("home");

  if (safeView === "login") {
    return (
      <div className="login-container">
        <div className="login-background">
          <div className="road-container">
            <div className="road"></div>
            <div className="car-wrapper">
              <div className="car-body">
                <div className="car-top"></div>
                <div className="car-bottom"></div>
                <div className="wheel wheel-front"></div>
                <div className="wheel wheel-back"></div>
                <div className="light-beam"></div>
              </div>
              <div className="wind"></div>
            </div>
            <div className="clouds">
              <div className="cloud cloud-1"></div>
              <div className="cloud cloud-2"></div>
              <div className="cloud cloud-3"></div>
            </div>
          </div>
        </div>

        <div className="login-content">
          <div className="login-card glass-effect">
            <div className="login-header">
              <div className="logo-container">
                <img src={mvLogo} alt="MV Solution" className="app-logo" />
              </div>
              <h1>MV Solution</h1>
              <p className="subtitle">IPO Readiness System</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="input-group">
                <input
                  type="email"
                  id="email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <label htmlFor="email">Email Address</label>
              </div>

              <div className="input-group">
                <input
                  type="password"
                  id="password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <label htmlFor="password">Password</label>
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <a
                  href="#"
                  className="forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    setView("forgot-password");
                    setStatus("");
                  }}
                >
                  Forgot Password?
                </a>
              </div>

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? <span className="loader"></span> : "Sign In →"}
              </button>
            </form>
            {status && <p className="status-message">{status}</p>}
            <div className="login-footer">
              <p>© 2025 MV Solution. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (safeView === "forgot-password") {
    return (
      <div className="login-container">
        <div className="login-background">
          <div className="road-container">
            <div className="road"></div>
            <div className="car-wrapper">
              <div className="car-body">
                <div className="car-top"></div>
                <div className="car-bottom"></div>
                <div className="wheel wheel-front"></div>
                <div className="wheel wheel-back"></div>
                <div className="light-beam"></div>
              </div>
              <div className="wind"></div>
            </div>
            <div className="clouds">
              <div className="cloud cloud-1"></div>
              <div className="cloud cloud-2"></div>
              <div className="cloud cloud-3"></div>
            </div>
          </div>
        </div>

        <div className="login-content">
          <div className="login-card glass-effect">
            <div className="login-header">
              <div className="logo-container">
                <img src={mvLogo} alt="MV Solution" className="app-logo" />
              </div>
              <h1>Reset Password</h1>
              <p className="subtitle">Enter your email to receive reset instructions</p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                setStatus("");
                try {
                  const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error || "Failed to send reset link");
                  setStatus("Reset link sent to your email!");
                } catch (error) {
                  setStatus(error.message);
                } finally {
                  setLoading(false);
                }
              }}
              className="login-form"
            >
              <div className="input-group">
                <input
                  type="email"
                  id="reset-email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <label htmlFor="reset-email">Email Address</label>
              </div>

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? <span className="loader"></span> : "Send Reset Link →"}
              </button>

              <div className="form-options" style={{ justifyContent: "center", marginTop: "10px" }}>
                <a
                  href="#"
                  className="forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    setView("login");
                    setStatus("");
                  }}
                >
                  ← Back to Login
                </a>
              </div>
            </form>
            {status && (
              <div style={{ textAlign: "center" }}>
                <p className="status-message">{status}</p>
                {/* Temporary link for testing */}
                <a
                  href="#"
                  style={{ fontSize: "12px", color: "#aaa", marginTop: "10px", display: "block" }}
                  onClick={(e) => {
                    e.preventDefault();
                    setView("reset-password");
                    setStatus("");
                  }}
                >
                  (Test: Go to New Password Page)
                </a>
              </div>
            )}
            <div className="login-footer">
              <p>© 2025 MV Solution. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (safeView === "reset-password") {
    return (
      <div className="login-container">
        <div className="login-background">
          <div className="road-container">
            <div className="road"></div>
            <div className="car-wrapper">
              <div className="car-body">
                <div className="car-top"></div>
                <div className="car-bottom"></div>
                <div className="wheel wheel-front"></div>
                <div className="wheel wheel-back"></div>
                <div className="light-beam"></div>
              </div>
              <div className="wind"></div>
            </div>
            <div className="clouds">
              <div className="cloud cloud-1"></div>
              <div className="cloud cloud-2"></div>
              <div className="cloud cloud-3"></div>
            </div>
          </div>
        </div>

        <div className="login-content">
          <div className="login-card glass-effect">
            <div className="login-header">
              <div className="logo-container">
                <img src={mvLogo} alt="MV Solution" className="app-logo" />
              </div>
              <h1>New Password</h1>
              <p className="subtitle">Create a new password for your account</p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                setStatus("");
                try {
                  const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error || "Failed to update password");
                  setStatus("Password updated successfully!");
                  setTimeout(() => {
                    setView("login");
                    setStatus("");
                  }, 2000);
                } catch (error) {
                  setStatus(error.message);
                } finally {
                  setLoading(false);
                }
              }}
              className="login-form"
            >
              <div className="input-group">
                <input
                  type="password"
                  id="new-password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <label htmlFor="new-password">New Password</label>
              </div>

              <div className="input-group">
                <input
                  type="password"
                  id="confirm-password"
                  placeholder=" "
                  required
                />
                <label htmlFor="confirm-password">Confirm Password</label>
              </div>

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? <span className="loader"></span> : "Set New Password →"}
              </button>
            </form>
            {status && <p className="status-message">{status}</p>}
            <div className="login-footer">
              <p>© 2025 MV Solution. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <img src={mvLogo} alt="MV Solution" />
          <div>
            <p className="eyebrow">MV Solution IPO Readiness</p>
          </div>
        </div>
        <div className="dashboard-actions">
          <div className="greeting-pill">
            <span role="img" aria-label="waving hand">
              👋
            </span>
            <div>
              <small>สวัสดีครับ</small>
              <strong>{currentUser.name}</strong>
            </div>
          </div>
          {isAdminRole && (
            <button type="button" className="pill-btn" onClick={handleAuditLogs}>
              Audit Logs
            </button>
          )}
          <button type="button" className="pill-btn danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      <div className="app-shell">
        {safeView === "home" && (
          <Home
            status={status}
            isAdminRole={isAdminRole}
            onStartAssessment={handleStartAssessment}
            onGoToAdmin={handleGoToAdminView}
            onNavigate={(flow) => {
              if (flow === "checklist") {
                setView("document-checklist");
              } else {
                setStatus(`กำลังนำไปยังโมดูล ${flow?.toUpperCase()}`);
              }
            }}
          />
        )}

        {isAssessmentUploadView && (
          <AssessmentUpload
            apiBase={API_BASE}
            onBack={goHome}
            onComplete={async (data) => {
              setAssessmentResult(data);
              setView("assessment-report");

              // Log assessment completion
              const companyName = data?.data?.company_name || "Unknown Company";
              const score = data?.metrics?.heuristics?.score || 0;
              const readiness = data?.metrics?.heuristics?.readiness || "N/A";
              await logAction(
                "Assessment Completed",
                `Company: ${companyName}, Score: ${score}, Readiness: ${readiness}`
              );
            }}
          />
        )}

        {isAssessmentReportView && (
          <AssessmentReport
            result={assessmentResult}
            onBackToUpload={() => setView("assessment-upload")}
            onBackHome={goHome}
          />
        )}

        {safeView === "admin" && (
          <section className="admin-page">
            <div className="admin-page__header">
              <button type="button" className="ghost-btn" onClick={goHome}>
                ← กลับหน้า Home
              </button>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setView("audit-logs")}
                >
                  View Audit Logs
                </button>
                <span>{users.length} ผู้ใช้ในระบบ</span>
              </div>
            </div>
            <div className="admin-card">
              <div className="admin-card__header">
                <div>
                  <p className="tag ghost">User Admin</p>
                  <h3>สร้างผู้ใช้ใหม่</h3>
                  <p>จัดการบัญชีผู้ใช้ระบบวิเคราะห์ได้จากศูนย์กลาง</p>
                </div>
                <button type="button" onClick={fetchUsers} className="ghost-btn">
                  รีเฟรชรายชื่อ
                </button>
              </div>
              <form className="admin-form" onSubmit={handleCreateUser}>
                <label className="field">
                  <span>ชื่อ-นามสกุล</span>
                  <input
                    type="text"
                    placeholder="เช่น ปิยะพงศ์ วิสุทธิเดชา"
                    value={newUser.name}
                    onChange={(event) =>
                      setNewUser({ ...newUser, name: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>อีเมล</span>
                  <input
                    type="email"
                    placeholder="user@mvsolution.co.th"
                    value={newUser.email}
                    onChange={(event) =>
                      setNewUser({ ...newUser, email: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>บทบาท</span>
                  <select
                    value={newUser.role}
                    onChange={(event) =>
                      setNewUser({ ...newUser, role: event.target.value })
                    }
                  >
                    <option value="analyst">Analyst</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="field">
                  <span>รหัสผ่านชั่วคราว</span>
                  <input
                    type="password"
                    placeholder="กำหนดรหัสผ่าน"
                    value={newUser.password}
                    onChange={(event) =>
                      setNewUser({ ...newUser, password: event.target.value })
                    }
                    required
                  />
                </label>
                <button type="submit" className="primary-btn" disabled={adminLoading}>
                  {adminLoading
                    ? editingUserId
                      ? "กำลังบันทึก..."
                      : "กำลังสร้าง..."
                    : editingUserId
                      ? "บันทึกการแก้ไข"
                      : "บันทึกผู้ใช้"}
                </button>
                {editingUserId && (
                  <button type="button" className="ghost-btn" onClick={handleCancelEdit}>
                    ยกเลิกการแก้ไข
                  </button>
                )}
              </form>
              {adminStatus && <p className="status admin-status">{adminStatus}</p>}
              <div className="admin-users">
                <div className="admin-users__header">
                  <h4>ผู้ใช้ล่าสุด</h4>
                  <span>{users.length} รายการ</span>
                </div>
                <ul>
                  {users.map((user) => (
                    <li key={user.id}>
                      <div>
                        <p>{user.name}</p>
                        <span>{user.email}</span>
                      </div>
                      <div className="admin-user__actions">
                        <span className="badge">{user.role}</span>
                        <button type="button" onClick={() => handleEditUser(user)}>
                          แก้ไข
                        </button>
                        <button type="button" onClick={() => handleDeleteUser(user.id)}>
                          ลบ
                        </button>
                      </div>
                    </li>
                  ))}
                  {users.length === 0 && (
                    <li className="empty">ยังไม่มีข้อมูลผู้ใช้</li>
                  )}
                </ul>
              </div>
            </div>
            <p className="disclaimer">
              เฉพาะผู้ดูแลระบบที่ได้รับสิทธิ์เท่านั้น กรุณาใช้อย่างระมัดระวัง
            </p>
          </section>
        )}

        {safeView === "audit-logs" && (
          <AuditLogs onBack={goHome} />
        )}

        {safeView === "document-checklist" && (
          <DocumentChecklist onBack={goHome} />
        )}
      </div>
    </div>
  );
}

export default App;
