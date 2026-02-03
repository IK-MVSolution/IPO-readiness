import { useEffect, useState } from "react";
import mvLogo from "../Photo/MVLogo.png";
import "./App.css";
import Home from "./components/Home";
import AssessmentUpload from "./components/Assessment";
import AssessmentReport from "./components/AssessmentReport";
import ProgressReport from "./components/ProgressReport";
import AuditLogs from "./components/AuditLogs";
import DocumentChecklist from "./components/DocumentChecklist";

function App() {
  const USER_STORAGE_KEY = "ipo-readiness-user";
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginSlowHint, setLoginSlowHint] = useState(false);
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
    setLoginSlowHint(false);
    setStatus("");
    const slowTimer = setTimeout(() => setLoginSlowHint(true), 5000);
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
      if (remember) {
        window.localStorage.setItem(
          USER_STORAGE_KEY,
          JSON.stringify({ user: data.user, remember: true })
        );
      } else {
        window.localStorage.removeItem(USER_STORAGE_KEY);
      }
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
      clearTimeout(slowTimer);
      setLoading(false);
      setLoginSlowHint(false);
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
    if (!storedUser) return;

    try {
      const parsed = JSON.parse(storedUser);
      const userData = parsed?.user || parsed;
      const shouldRestore = parsed?.remember === true;

      if (shouldRestore && userData?.id) {
        setCurrentUser(userData);
        setRemember(true);
        setView("home");
        setStatus(`ยินดีต้อนรับกลับ ${userData.name}`);
      } else {
        // Clean up old/invalid cached sessions so the app drops to the login screen
        window.localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (error) {
      window.localStorage.removeItem(USER_STORAGE_KEY);
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
            {loginSlowHint && loading && (
              <p className="status-message login-slow-hint">
                กำลังเชื่อมต่อเซิร์ฟเวอร์... หากโหลดนาน อาจเป็นเพราะเซิร์ฟเวอร์กำลังเริ่มทำงาน (รอได้ถึง ~1 นาที) กรุณารอสักครู่
              </p>
            )}
            {status && !loginSlowHint && <p className="status-message">{status}</p>}
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
      {/* Cartoon Coaster Background */}
      <div className="coaster-background">
        <div className="clouds">
          <div className="cloud cloud-1"></div>
          <div className="cloud cloud-2"></div>
        </div>
        <div className="coaster-container">
          {/* SVG Track and Carts */}
          <svg className="coaster-track-svg" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice">
            <defs>
              <path
                id="trackPath"
                d="M -100,250 Q 150,250 250,150 C 350,50 450,50 500,200 Q 550,350 700,100 T 1300,250"
              />
            </defs>

            <use href="#trackPath" fill="none" stroke="#e5e7eb" strokeWidth="4" className="track-rail-back" />
            <use href="#trackPath" fill="none" stroke="#374151" strokeWidth="6" className="track-rail-front" />

            {/* Struts */}
            <line x1="250" y1="150" x2="250" y2="400" stroke="#9ca3af" strokeWidth="2" />
            <line x1="500" y1="200" x2="500" y2="400" stroke="#9ca3af" strokeWidth="2" />
            <line x1="700" y1="100" x2="700" y2="400" stroke="#9ca3af" strokeWidth="2" />

            {/* Cart 1 */}
            <g className="cart-group cart-1">
              {/* Connector */}
              <rect x="-65" y="-12" width="20" height="4" fill="#7f1d1d" />
              {/* Body */}
              <rect x="-60" y="-35" width="60" height="30" rx="4" fill="#ef4444" stroke="#b91c1c" strokeWidth="2" />
              {/* Passenger */}
              <circle cx="-30" cy="-45" r="10" fill="#fcd34d" />
              {/* Wheels */}
              <circle cx="-50" cy="-5" r="5" fill="#1f2937" stroke="#999" strokeWidth="1" />
              <circle cx="-10" cy="-5" r="5" fill="#1f2937" stroke="#999" strokeWidth="1" />
            </g>

            {/* Cart 2 */}
            <g className="cart-group cart-2">
              <rect x="-65" y="-12" width="20" height="4" fill="#7f1d1d" />
              <rect x="-60" y="-35" width="60" height="30" rx="4" fill="#ef4444" stroke="#b91c1c" strokeWidth="2" />
              <circle cx="-30" cy="-45" r="10" fill="#fcd34d" />
              <circle cx="-50" cy="-5" r="5" fill="#1f2937" stroke="#999" strokeWidth="1" />
              <circle cx="-10" cy="-5" r="5" fill="#1f2937" stroke="#999" strokeWidth="1" />
            </g>

            {/* Cart 3 */}
            <g className="cart-group cart-3">
              <rect x="-60" y="-35" width="60" height="30" rx="4" fill="#ef4444" stroke="#b91c1c" strokeWidth="2" />
              <circle cx="-30" cy="-45" r="10" fill="#fcd34d" />
              <circle cx="-50" cy="-5" r="5" fill="#1f2937" stroke="#999" strokeWidth="1" />
              <circle cx="-10" cy="-5" r="5" fill="#1f2937" stroke="#999" strokeWidth="1" />
            </g>
          </svg>
        </div>
      </div>

      <header className="modern-header sticky-top glass-effect">
        <div className="header-content">
          <div className="brand-section">
            <img src={mvLogo} alt="MV Solution" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-name">MV Solution</span>
              <span className="brand-divider">/</span>
              <span className="brand-product">IPO Readiness</span>
            </div>
          </div>

          <div className="actions-section">
            <div className="user-profile">
              <div className="avatar-circle">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <span className="greeting-text">สวัสดีครับ</span>
                <span className="user-name">{currentUser.name}</span>
              </div>
            </div>

            <div className="header-buttons">
              {isAdminRole && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleAuditLogs}
                  title="Audit Logs"
                >
                  <span role="img" aria-label="logs">📋</span>
                </button>
              )}
              <div className="divider-vertical"></div>
              <button
                type="button"
                className="logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
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
              } else if (flow === "report") {
                setView("progress");
              } else if (flow === "assessment-report") {
                setView("assessment-report");
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

              // บันทึกผลประเมินและสร้างโปรเจกต์ใน Client Portfolio (ข้อมูลจริง)
              try {
                await fetch(`${API_BASE}/api/assessments/save`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    data: data?.data,
                    metrics: data?.metrics,
                    user_id: currentUser?.id,
                  }),
                });
              } catch (err) {
                console.error("Failed to save assessment:", err);
              }

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
            onBackToUpload={handleStartAssessment}
            onBackHome={goHome}
          />
        )}

        {safeView === "progress" && (
          <ProgressReport onBack={goHome} apiBase={API_BASE} />
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
