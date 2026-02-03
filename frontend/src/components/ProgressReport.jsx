import React, { useState, useEffect } from "react";
import "./ProgressReport.css";

const ProgressReport = ({ onBack, apiBase = "http://localhost:5001" }) => {
    const [filter, setFilter] = useState("All");
    const [projects, setProjects] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [newProject, setNewProject] = useState({
        client: "",
        phase: "Filing Prep",
        readiness: 0,
        status: "On Track",
        next_milestone: "",
        risk: "Low"
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [projectsRes, teamRes] = await Promise.all([
                    fetch(`${apiBase}/api/dashboard/projects`),
                    fetch(`${apiBase}/api/dashboard/team`)
                ]);

                if (!projectsRes.ok || !teamRes.ok) {
                    throw new Error("Failed to fetch dashboard data");
                }

                const projectsData = await projectsRes.json();
                const teamData = await teamRes.json();

                setProjects(projectsData.projects || []);
                setTeamMembers(teamData.members || []);
            } catch (err) {
                console.error("Dashboard error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [apiBase]);

    if (loading) {
        return (
            <div className="progress-report-container cockpit-theme loading-view">
                <div className="loader"></div>
                <p>Loading Dashboard...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="progress-report-container cockpit-theme error-view">
                <p>Error: {error}</p>
                <button className="primary-btn" onClick={onBack}>Back to Home</button>
            </div>
        );
    }

    const totalProjects = projects.length;
    const highRiskProjects = projects.filter(p => p.risk === "High").length;
    const avgReadiness = totalProjects > 0
        ? Math.round(projects.reduce((acc, p) => acc + p.readiness, 0) / totalProjects)
        : 0;
    const avgTeamLoad = teamMembers.length > 0
        ? Math.round(teamMembers.reduce((m, t) => m + t.load, 0) / teamMembers.length)
        : 0;



    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewProject(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${apiBase}/api/dashboard/projects`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newProject)
            });
            if (!res.ok) throw new Error("Failed to create project");

            const data = await res.json();
            setProjects(prev => [...prev, data.project]);
            setShowModal(false);
            setNewProject({
                client: "",
                phase: "Filing Prep",
                readiness: 0,
                status: "On Track",
                next_milestone: "",
                risk: "Low"
            });
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header-simple">
                <div className="header-left">
                    <button className="back-btn" onClick={onBack}>
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1>Consultant Cockpit</h1>
                        <p className="subtitle">Real-time IPO Readiness Overview</p>
                    </div>
                </div>
                <div className="header-right">
                    <button className="primary-btn sm" onClick={() => setShowModal(true)}>+ New Project</button>
                    <div className="date-badge">
                        {new Date().toLocaleDateString('th-TH', {
                            year: 'numeric', month: 'long', day: 'numeric'
                        })}
                    </div>
                </div>
            </header>

            {/* Executive Summary (KPIs) */}
            <div className="kpi-grid">
                <div className="kpi-card blue">
                    <div className="kpi-icon">
                        <span className="material-symbols-outlined">analytics</span>
                    </div>
                    <div className="kpi-content">
                        <h3>Total Active Projects</h3>
                        <div className="kpi-value">{totalProjects}</div>
                        <span className="kpi-trend positive">↑ 2 from last month</span>
                    </div>
                </div>
                <div className="kpi-card green">
                    <div className="kpi-icon">
                        <span className="material-symbols-outlined">track_changes</span>
                    </div>
                    <div className="kpi-content">
                        <h3>Avg. Readiness</h3>
                        <div className="kpi-value">{avgReadiness}%</div>
                        <span className="kpi-trend">Across portfolio</span>
                    </div>
                </div>
                <div className="kpi-card red">
                    <div className="kpi-icon">
                        <span className="material-symbols-outlined">warning</span>
                    </div>
                    <div className="kpi-content">
                        <h3>Critical Risks</h3>
                        <div className="kpi-value">{highRiskProjects}</div>
                        <span className="kpi-trend negative">Requires attention</span>
                    </div>
                </div>
                <div className="kpi-card purple">
                    <div className="kpi-icon">
                        <span className="material-symbols-outlined">bolt</span>
                    </div>
                    <div className="kpi-content">
                        <h3>Team Load</h3>
                        <div className="kpi-value">{avgTeamLoad}%</div>
                        <span className="kpi-trend">Optimal capacity</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-content-grid">
                {/* Portfolio Health */}
                <section className="dashboard-section main-section">
                    <div className="section-header">
                        <h2>Client Portfolio</h2>
                        <div className="filter-pills">
                            {['All', 'High Risk', 'Filing Prep', 'Audit'].map(f => (
                                <button
                                    key={f}
                                    className={`filter-pill ${filter === f ? 'active' : ''}`}
                                    onClick={() => setFilter(f)}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="projects-table-wrapper">
                        <table className="projects-table">
                            <thead>
                                <tr>
                                    <th>Client / ID</th>
                                    <th>ประเมินโดย</th>
                                    <th>Phase</th>
                                    <th>Readiness Health</th>
                                    <th>Status</th>
                                    <th>Next Milestone</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.filter(p => {
                                    if (filter === 'All') return true;
                                    if (filter === 'High Risk') return p.risk === 'High';
                                    if (filter === 'Filing Prep') return p.phase === 'Filing Prep';
                                    if (filter === 'Audit') return p.phase.includes('Audit');
                                    return true;
                                }).map(project => (
                                    <tr key={project.id} className={project.risk === 'High' ? 'risk-row' : ''}>
                                        <td>
                                            <div className="client-info">
                                                <strong>{project.client}</strong>
                                                <small>ID: {project.id}</small>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="assessed-by">{project.assessed_by || '–'}</span>
                                        </td>
                                        <td><span className="phase-tag">{project.phase}</span></td>
                                        <td>
                                            <div className="progress-cell">
                                                <div className="progress-track">
                                                    <div
                                                        className={`progress-fill ${project.readiness >= 80 ? 'high' : project.readiness >= 50 ? 'med' : 'low'}`}
                                                        style={{ width: `${project.readiness}%` }}
                                                    ></div>
                                                </div>
                                                <span>{project.readiness}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-dot ${project.status.toLowerCase().replace(' ', '-')}`}></span>
                                            {project.status}
                                        </td>
                                        <td className="w-150">{project.next_milestone || project.nextMilestone}</td>
                                        <td>
                                            <button className="icon-action-btn">
                                                <span className="material-symbols-outlined">arrow_forward</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Team Pulse */}
                <aside className="dashboard-section side-section">
                    <div className="section-header">
                        <h2>Team Pulse</h2>
                        <button className="icon-btn-sm">
                            <span className="material-symbols-outlined">more_vert</span>
                        </button>
                    </div>

                    <div className="team-pulse-list">
                        {teamMembers.map(member => (
                            <div key={member.id} className="pulse-item">
                                <div className="pulse-header">
                                    <div className="pulse-avatar">{member.avatar}</div>
                                    <div className="pulse-info">
                                        <h4>{member.name}</h4>
                                        <span>{member.role}</span>
                                    </div>
                                    <div className={`load-indicator ${member.load > 100 ? 'over' : 'good'}`}>
                                        {member.load}%
                                    </div>
                                </div>
                                <div className="pulse-bar-wrapper">
                                    <div className="pulse-bar">
                                        <div
                                            className={`pulse-fill ${member.load > 100 ? 'red' : 'blue'}`}
                                            style={{ width: `${Math.min(member.load, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="pulse-stats">
                                    <span>{member.active_tasks} Active</span>
                                    <span>{member.pending} Pending</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>

            {/* Add Project Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Add New Project</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateProject}>
                            <div className="form-group">
                                <label>Client Name</label>
                                <input
                                    type="text"
                                    name="client"
                                    value={newProject.client}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Company Name"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Phase</label>
                                    <select name="phase" value={newProject.phase} onChange={handleInputChange}>
                                        <option>Filing Prep</option>
                                        <option>Internal Audit</option>
                                        <option>Pre-Audit</option>
                                        <option>SEC Q&A</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select name="status" value={newProject.status} onChange={handleInputChange}>
                                        <option>On Track</option>
                                        <option>At Risk</option>
                                        <option>Delayed</option>
                                        <option>Pending Review</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Readiness (%)</label>
                                    <input
                                        type="number"
                                        name="readiness"
                                        min="0" max="100"
                                        value={newProject.readiness}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Risk Level</label>
                                    <select name="risk" value={newProject.risk} onChange={handleInputChange}>
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Next Milestone</label>
                                <input
                                    type="text"
                                    name="next_milestone"
                                    value={newProject.next_milestone}
                                    onChange={handleInputChange}
                                    placeholder="e.g. Submit Filing"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="primary-btn">Create Project</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgressReport;
