import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from ipo_readiness.services.parser_thai import parse_financial_files
from ipo_readiness.services.metrics_engine import compute_metrics
from ipo_readiness.services.user_service import (
    init_user_store,
    create_user,
    list_users,
    authenticate_user,
    update_user,
    delete_user,
)
from ipo_readiness.services.audit_service import (
    init_audit_store,
    log_action,
    list_logs,
)
from ipo_readiness.services.dashboard_service import (
    init_dashboard_store,
    list_projects,
    list_team_members,
    list_assessments,
    create_project,
    create_assessment_manual,
    save_assessment_and_create_project,
)

app = Flask(__name__)

# CORS: local + Vercel (regex) + FRONTEND_URL หรือ * ถ้าไม่ตั้ง
_cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    re.compile(r"^https://[a-z0-9-]+\.vercel\.app$"),  # Vercel preview deployments
]
_frontend_url = (os.environ.get("FRONTEND_URL") or "").strip()
if _frontend_url:
    _cors_origins.append(_frontend_url)
else:
    _cors_origins.append("*")
CORS(app, origins=_cors_origins)


def _safe_init(name, fn):
    """Run init function; log error and continue so app can at least serve /api/health."""
    try:
        fn()
    except Exception as e:
        import traceback
        print(f"[WARN] {name} init failed: {e}")
        traceback.print_exc()


_safe_init("user_store", init_user_store)
_safe_init("audit_store", init_audit_store)
_safe_init("dashboard_store", init_dashboard_store)

@app.route("/api/health", methods=["GET"])
@app.route("/", methods=["GET"])
def health_check():
    """Health check endpoint - ใช้สำหรับ cron job เพื่อให้ instance ตื่นอยู่ (ไม่ sleep)"""
    return jsonify({"status": "ok", "service": "IPO Readiness API"}), 200

@app.route("/api/analyze/preview", methods=["POST"])
def analyze_preview():
    """Preview: ดึงชื่อบริษัทจากไฟล์ที่อัปโหลดก่อนประมวลผลจริง (ตรวจสอบไฟล์ผิด)"""
    try:
        workbooks = request.files.getlist("workbooks") or []
        if not workbooks:
            single = request.files.get("workbook")
            if single:
                workbooks = [single]
        if not workbooks:
            return jsonify({"error": "กรุณาอัปโหลดไฟล์ข้อมูลทางการเงิน"}), 400
        
        from ipo_readiness.services.parser_thai import _extract_company_name, _load_workbook_from_upload
        
        companies = []
        for idx, file in enumerate(workbooks):
            filename = getattr(file, "filename", "") or getattr(file, "name", f"file_{idx+1}")
            try:
                workbook, _ = _load_workbook_from_upload(file)
                company_name = _extract_company_name(workbook)
                companies.append({
                    "file": filename,
                    "company": company_name or "(ไม่พบชื่อบริษัท)"
                })
            except Exception as e:
                companies.append({
                    "file": filename,
                    "company": f"(อ่านไฟล์ไม่ได้: {str(e)})"
                })
        
        unique_companies = set([c["company"] for c in companies if c["company"] and c["company"] != "(ไม่พบชื่อบริษัท)" and not c["company"].startswith("(อ่าน")])
        is_consistent = len(unique_companies) <= 1
        
        return jsonify({
            "companies": companies,
            "is_consistent": is_consistent,
            "unique_companies": list(unique_companies) if unique_companies else [],
            "message": "ชื่อบริษัทตรงกัน" if is_consistent else "⚠️ พบชื่อบริษัทไม่ตรงกัน - กรุณาตรวจสอบไฟล์"
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        workbooks = request.files.getlist("workbooks") or []
        if not workbooks:
            single = request.files.get("workbook")
            if single:
                workbooks = [single]
        if not workbooks:
            return jsonify({"error": "กรุณาอัปโหลดไฟล์ข้อมูลทางการเงิน"}), 400
        data = parse_financial_files(workbooks)
        metrics = compute_metrics(data)
        return jsonify({"data": data, "metrics": metrics})
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/dashboard/projects", methods=["GET", "POST"])
def dashboard_projects():
    try:
        if request.method == "POST":
            payload = request.get_json(force=True)
            project = create_project(
                client=payload.get("client"),
                phase=payload.get("phase"),
                readiness=int(payload.get("readiness", 0)),
                status=payload.get("status"),
                next_milestone=payload.get("next_milestone"),
                risk=payload.get("risk", "Low")
            )
            return jsonify({"project": project.__dict__}), 201

        projects = [p.__dict__ for p in list_projects()]
        return jsonify({"projects": projects})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/assessments/save", methods=["POST"])
def save_assessment():
    """Save assessment result and create project for Client Portfolio."""
    try:
        payload = request.get_json(force=True)
        data = payload.get("data") or {}
        metrics = payload.get("metrics") or {}
        user_id = payload.get("user_id")
        company_name = data.get("company_name") or "บริษัทไม่ระบุชื่อ"
        project = save_assessment_and_create_project(
            company_name=company_name,
            user_id=user_id,
            metrics=metrics,
        )
        return jsonify({"project": project.__dict__}), 201
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/dashboard/assessments", methods=["GET", "POST"])
def dashboard_assessments():
    """Client Portfolio: ข้อมูลจริงจาก assessments (ไม่มี Mock)."""
    try:
        if request.method == "POST":
            payload = request.get_json(force=True)
            a = create_assessment_manual(
                company_name=payload.get("company_name") or payload.get("client") or "",
                user_id=payload.get("user_id"),
                phase=payload.get("phase", "Filing Prep"),
                status=payload.get("status", "On Track"),
                readiness_score=int(payload.get("readiness_score") or payload.get("readiness", 0)),
                next_milestone=payload.get("next_milestone", ""),
                risk=payload.get("risk", "Low"),
            )
            return jsonify({
                "assessment": {
                    "id": a.id,
                    "company_name": a.company_name,
                    "assessed_by": a.assessed_by,
                    "readiness_score": a.readiness_score,
                    "phase": a.phase,
                    "status": a.status,
                    "next_milestone": a.next_milestone,
                    "risk": a.risk,
                    "created_at": a.created_at,
                }
            }), 201

        # ความเป็นส่วนตัว: user ธรรมดาเห็นเฉพาะของตัวเอง, Admin เห็นทุกคน หรือเลือกดูของคนใดคนหนึ่งจาก Team Pulse
        user_id_param = request.args.get("user_id", type=int)
        role_param = request.args.get("role", "").strip().lower()
        view_user_id_param = request.args.get("view_user_id", type=int)

        if role_param == "admin":
            filter_by = view_user_id_param if view_user_id_param is not None else None
        else:
            filter_by = user_id_param

        items = list_assessments(filter_by_user_id=filter_by)
        data = [
            {
                "id": a.id,
                "company_name": a.company_name,
                "assessed_by": a.assessed_by,
                "readiness_score": a.readiness_score,
                "phase": a.phase,
                "status": a.status,
                "next_milestone": a.next_milestone,
                "risk": a.risk,
                "created_at": a.created_at,
            }
            for a in items
        ]
        return jsonify({"assessments": data})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/dashboard/team", methods=["GET"])
def dashboard_team():
    try:
        members = [m.__dict__ for m in list_team_members()]
        return jsonify({"members": members})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/admin/users", methods=["GET", "POST"])
def admin_users():
    try:
        if request.method == "POST":
            payload = request.get_json(force=True)
            name = payload.get("name", "")
            email = payload.get("email", "")
            role = payload.get("role", "user")
            password = payload.get("password", "")
            user = create_user(name=name, email=email, role=role, password=password)
            return jsonify({"user": user.__dict__}), 201

        users = [u.__dict__ for u in list_users()]
        return jsonify({"users": users})
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/admin/users/<int:user_id>", methods=["PUT", "PATCH", "DELETE"])
def admin_user_detail(user_id: int):
    try:
        if request.method in ("PUT", "PATCH"):
            payload = request.get_json(force=True)
            name = payload.get("name", "")
            email = payload.get("email", "")
            role = payload.get("role", "")
            password = payload.get("password", "")
            user = update_user(user_id=user_id, name=name, email=email, role=role, password=password or None)
            return jsonify({"user": user.__dict__})

        delete_user(user_id=user_id)
        return jsonify({"status": "deleted"})
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    try:
        payload = request.get_json(force=True)
        email = payload.get("email", "")
        password = payload.get("password", "")
        user = authenticate_user(email=email, password=password)
        return jsonify({"user": user.__dict__})
    except ValueError as err:
        return jsonify({"error": str(err)}), 401
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/auth/forgot-password", methods=["POST"])
def auth_forgot_password():
    try:
        # Mock endpoint - in reality this would send an email
        payload = request.get_json(force=True)
        email = payload.get("email", "")
        if not email:
            return jsonify({"error": "Email is required"}), 400
        
        # Simulate success regardless of email existence for security
        return jsonify({"message": "Password reset link sent"})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/auth/reset-password", methods=["POST"])
def auth_reset_password():
    try:
        # Mock endpoint - in reality this would verify token and update password
        payload = request.get_json(force=True)
        password = payload.get("password", "")
        if not password:
            return jsonify({"error": "Password is required"}), 400
        
        # Simulate success
        return jsonify({"message": "Password updated successfully"})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/admin/audit-logs", methods=["GET", "POST"])
def admin_audit_logs():
    try:
        if request.method == "POST":
            payload = request.get_json(force=True)
            user_id = payload.get("user_id")
            user_name = payload.get("user_name", "Unknown")
            action = payload.get("action", "Unknown Action")
            details = payload.get("details", "")
            log = log_action(user_id, user_name, action, details)
            return jsonify({"log": log.__dict__}), 201

        logs = [l.__dict__ for l in list_logs(limit=200)]
        return jsonify({"logs": logs})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__=="__main__":
    port = int(os.environ.get("PORT", 5001))
    debug = os.environ.get("FLASK_ENV", "development") == "development"
    app.run(host='0.0.0.0', port=port, debug=debug)
