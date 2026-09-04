import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import TaskBoard from "./TaskBoard";
import { API_URL, SOCKET_URL, apiUrl, assetUrl } from "../config";
import { Activity, ArrowRight, Bell, CalendarDays, Check, CheckCircle2, Clock3, FolderKanban, LayoutDashboard, ListTodo, LogOut, Pencil, Plus, Search, Settings, Share2, Trash2, Users, X } from "lucide-react";

const apiRequest = async (path, options = {}) => {
  const token = localStorage.getItem("taskflow_token");
  const headers = { Authorization: `Bearer ${token}`, ...options.headers };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  });
  const responseText = await response.text();
  let data = {};
  try { data = responseText ? JSON.parse(responseText) : {}; }
  catch { data = {}; }
  if (!response.ok) {
    const error = new Error(data.message || "Cannot reach the TaskFlow server. Start the backend and try again.");
    error.status = response.status;
    throw error;
  }
  return data;
};

const toDateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";

function Dashboard({ user, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", dueDate: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [boardSection, setBoardSection] = useState("board");
  const [workspaceView, setWorkspaceView] = useState("overview");
  const [coverFile, setCoverFile] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [showInvitations, setShowInvitations] = useState(() => new URLSearchParams(window.location.search).has("invitation"));
  const [respondingInvitation, setRespondingInvitation] = useState(null);

  useEffect(() => {
    apiRequest("/api/projects")
      .then((data) => setProjects(data.projects))
      .catch((error) => error.status === 401 ? onLogout() : setMessage(error.message))
      .finally(() => setLoading(false));
  }, [onLogout]);

  useEffect(() => {
    apiRequest("/api/invitations").then((data) => setInvitations(data.invitations)).catch(() => {});
    const socket = io(SOCKET_URL, {
      path: `${API_URL}/socket.io`,
      auth: { token: localStorage.getItem("taskflow_token") },
      transports: ["websocket", "polling"],
    });
    socket.on("invitation:created", ({ invitation }) => setInvitations((current) => current.some((item) => item._id === invitation._id) ? current : [invitation, ...current]));
    socket.on("invitation:updated", ({ invitationId }) => setInvitations((current) => current.filter((item) => item._id !== invitationId)));
    return () => socket.disconnect();
  }, []);

  const respondToInvitation = async (invitation, response) => {
    setRespondingInvitation(invitation._id); setMessage("");
    try {
      await apiRequest(`/api/invitations/${invitation._id}`, { method: "PATCH", body: JSON.stringify({ response }) });
      setInvitations((current) => current.filter((item) => item._id !== invitation._id));
      if (response === "accepted") {
        const data = await apiRequest("/api/projects");
        setProjects(data.projects);
        setMessage(`You joined “${invitation.project.name}”. It is now available under Shared with me.`);
      }
      if (new URLSearchParams(window.location.search).has("invitation")) window.history.replaceState({}, "", window.location.pathname);
    } catch (error) { setMessage(error.message); }
    finally { setRespondingInvitation(null); }
  };

  const createProject = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const data = await apiRequest("/api/projects", { method: "POST", body: JSON.stringify(form) });
      let project = data.project;
      if (coverFile) {
        const imageData = new FormData(); imageData.append("image", coverFile);
        const coverData = await apiRequest(`/api/projects/${project._id}/cover`, { method: "POST", body: imageData });
        project = { ...project, coverImage: coverData.coverImage };
      }
      setProjects((current) => [project, ...current]);
      setForm({ name: "", description: "", dueDate: "" });
      setCoverFile(null);
      setShowForm(false);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const openCreateForm = () => {
    setEditingProject(null);
    setCoverFile(null);
    setForm({ name: "", description: "", dueDate: "", status: "active" });
    setShowForm(true);
  };

  const openEditForm = (project) => {
    setEditingProject(project);
    setCoverFile(null);
    setForm({
      name: project.name,
      description: project.description || "",
      dueDate: toDateInput(project.dueDate),
      status: project.status,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveProject = async (event) => {
    if (!editingProject) return createProject(event);
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const data = await apiRequest(`/api/projects/${editingProject._id}`, { method: "PATCH", body: JSON.stringify(form) });
      let updatedProject = data.project;
      if (coverFile) {
        const imageData = new FormData(); imageData.append("image", coverFile);
        const coverData = await apiRequest(`/api/projects/${editingProject._id}/cover`, { method: "POST", body: imageData });
        updatedProject = { ...updatedProject, coverImage: coverData.coverImage };
      }
      setProjects((current) => current.map((item) => item._id === editingProject._id ? updatedProject : item));
      setEditingProject(null);
      setCoverFile(null);
      setShowForm(false);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (project, status) => {
    setMessage("");
    try {
      const data = await apiRequest(`/api/projects/${project._id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setProjects((current) => current.map((item) => item._id === project._id ? data.project : item));
    } catch (error) { setMessage(error.message); }
  };

  const deleteProject = async (project) => {
    if (!window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return;
    setMessage("");
    try {
      await apiRequest(`/api/projects/${project._id}`, { method: "DELETE" });
      setProjects((current) => current.filter((item) => item._id !== project._id));
    } catch (error) { setMessage(error.message); }
  };

  const activeCount = projects.filter((project) => project.status === "active").length;
  const completedCount = projects.filter((project) => project.status === "completed").length;
  const filteredProjects = projects.filter((project) => {
    const matchesSearch = `${project.name} ${project.description || ""}`.toLowerCase().includes(search.toLowerCase());
    const projectOwnerId = project.owner?._id || project.owner;
    const matchesOwnership = workspaceView !== "shared" || projectOwnerId !== user.id;
    return matchesSearch && matchesOwnership && (statusFilter === "all" || project.status === statusFilter);
  });

  const navigateWorkspace = (view) => {
    setWorkspaceView(view);
    setSearch("");
    if (view === "active") setStatusFilter("active");
    else if (view === "completed") setStatusFilter("completed");
    else setStatusFilter("all");
    window.setTimeout(() => document.getElementById(view === "overview" ? "dashboard" : "projects")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
  };

  if (selectedProject) {
    const navigateBoard = (section) => { setBoardSection(section); window.setTimeout(() => document.getElementById(section === "board" ? "project-board" : section)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30); };
    return <div className="dashboard-shell"><aside className="dashboard-sidebar"><a className="brand brand--light" href="#project-board"><span className="brand__mark">T</span><span>TaskFlow</span></a><div className="sidebar-project"><span>Current project</span><strong>{selectedProject.name}</strong></div><nav className="side-nav side-nav--project"><span className="side-nav__label">Workspace</span><button className={boardSection === "board" ? "side-nav__active" : ""} type="button" onClick={() => navigateBoard("board")}><LayoutDashboard size={18} /><span>Board overview</span></button><button className={boardSection === "tasks" ? "side-nav__active" : ""} type="button" onClick={() => navigateBoard("tasks")}><ListTodo size={18} /><span>Tasks</span></button><button className={boardSection === "activity" ? "side-nav__active" : ""} type="button" onClick={() => navigateBoard("activity")}><Activity size={18} /><span>Activity</span></button><button className={boardSection === "team" ? "side-nav__active" : ""} type="button" onClick={() => navigateBoard("team")}><Users size={18} /><span>Team</span><small>{(selectedProject.members?.length || 0) + 1}</small></button><span className="side-nav__label side-nav__label--second">Manage</span><button type="button" onClick={() => { setSelectedProject(null); setBoardSection("board"); }}><FolderKanban size={18} /><span>All projects</span></button><button type="button" onClick={() => navigateBoard("settings")}><Settings size={18} /><span>Project settings</span></button></nav><div className="sidebar-user"><span className="avatar avatar--small">{user.name.slice(0, 2).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><button type="button" onClick={onLogout} title="Sign out"><LogOut size={16} /></button></div></aside><main className="dashboard-main"><TaskBoard project={selectedProject} onBack={() => { setSelectedProject(null); setBoardSection("board"); }} panelRequest={boardSection} /></main></div>;
  }

  return (
    <div className="dashboard-shell dashboard-shell--trello">
      <header className="taskflow-topbar">
        <a className="taskflow-topbar__brand" href="#dashboard"><span className="brand__mark">T</span><strong>TaskFlow</strong></a>
        <nav className="taskflow-topbar__nav" aria-label="Application"><button type="button" onClick={() => navigateWorkspace("projects")}>Workspaces</button><button type="button" onClick={() => navigateWorkspace("overview")}>Recent</button></nav>
        <label className="taskflow-topbar__search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search boards" aria-label="Search boards" /></label>
        <button className="taskflow-topbar__create" type="button" onClick={openCreateForm}><Plus size={16} /> Create</button>
        <button className="taskflow-topbar__icon" type="button" onClick={() => setShowInvitations((current) => !current)} aria-label="Project invitations"><Bell size={18} />{invitations.length > 0 && <span>{invitations.length}</span>}</button>
        <button className="taskflow-topbar__avatar" type="button" title={user.name}>{user.name.slice(0, 2).toUpperCase()}</button>
      </header>
      <aside className="dashboard-sidebar">
        <div className="workspace-identity"><span>{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name.split(" ")[0]}'s Workspace</strong><small>TaskFlow workspace</small></div></div>
        <nav className="side-nav side-nav--workspace"><span className="side-nav__label">Workspace</span><button className={workspaceView === "overview" ? "side-nav__active" : ""} type="button" onClick={() => navigateWorkspace("overview")}><LayoutDashboard size={18} /><span>Overview</span></button><button className={workspaceView === "projects" ? "side-nav__active" : ""} type="button" onClick={() => navigateWorkspace("projects")}><FolderKanban size={18} /><span>All projects</span><small>{projects.length}</small></button><button className={workspaceView === "shared" ? "side-nav__active" : ""} type="button" onClick={() => navigateWorkspace("shared")}><Share2 size={18} /><span>Shared with me</span><small>{projects.filter((project) => (project.owner?._id || project.owner) !== user.id).length}</small></button><span className="side-nav__label side-nav__label--second">Quick filters</span><button className={workspaceView === "active" ? "side-nav__active" : ""} type="button" onClick={() => navigateWorkspace("active")}><Clock3 size={18} /><span>In progress</span><small>{activeCount}</small></button><button className={workspaceView === "completed" ? "side-nav__active" : ""} type="button" onClick={() => navigateWorkspace("completed")}><CheckCircle2 size={18} /><span>Completed</span><small>{completedCount}</small></button><span className="side-nav__label side-nav__label--second">Create</span><button type="button" onClick={openCreateForm}><Plus size={18} /><span>New project</span></button></nav>
        <div className="sidebar-user"><span className="avatar avatar--small">{user.name.slice(0, 2).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><button type="button" onClick={onLogout} title="Sign out"><LogOut size={16} /></button></div>
      </aside>

      <main className="dashboard-main" id="dashboard">
        <header className="dashboard-header"><div><p className="eyebrow">{user.name.split(" ")[0]}'s Workspace</p><h1>Your boards</h1><p className="dashboard-subtitle">Open a board to plan tasks, share updates, and move work forward.</p></div><div className="dashboard-header__actions"><button className="button" type="button" onClick={openCreateForm}><Plus size={17} /> Create board</button></div></header>
        {showInvitations && <section className="invitation-center"><div className="invitation-center__heading"><div><p className="eyebrow">Notifications</p><h2>Project invitations</h2></div><button type="button" onClick={() => setShowInvitations(false)} aria-label="Close invitations"><X size={18} /></button></div>{invitations.length === 0 ? <div className="invitation-empty"><Bell size={24} /><p>You have no pending invitations.</p></div> : invitations.map((invitation) => <article className="invitation-card" key={invitation._id}>{invitation.project.coverImage ? <img src={assetUrl(invitation.project.coverImage)} alt="" /> : <span className="invitation-card__icon"><FolderKanban size={20} /></span>}<div><strong>{invitation.project.name}</strong><p><b>{invitation.invitedBy.name}</b> invited you to collaborate.</p><small>{new Date(invitation.createdAt).toLocaleString()}</small></div><div className="invitation-card__actions"><button type="button" className="button button--small" disabled={respondingInvitation === invitation._id} onClick={() => respondToInvitation(invitation, "accepted")}><Check size={15} />Accept</button><button type="button" className="button button--secondary button--small" disabled={respondingInvitation === invitation._id} onClick={() => respondToInvitation(invitation, "declined")}><X size={15} />Decline</button></div></article>)}</section>}
        <section className="dashboard-stats" aria-label="Project summary">
          <div><span className="stat-icon"><FolderKanban size={18} /></span><strong>{projects.length}</strong><span>Total boards</span></div>
          <div><span className="stat-icon stat-icon--amber"><Clock3 size={18} /></span><strong>{activeCount}</strong><span>In progress</span></div>
          <div><span className="stat-icon stat-icon--green"><CheckCircle2 size={18} /></span><strong>{completedCount}</strong><span>Completed</span></div>
        </section>

        {message && <p className="dashboard-message" role="alert">{message}</p>}
        {showForm && (
          <form className="project-form" onSubmit={saveProject}>
            <div className="project-form__heading"><div><span className="preview-card__label">{editingProject ? "EDIT PROJECT" : "NEW PROJECT"}</span><h2>{editingProject ? "Update project details" : "What are you working on?"}</h2></div><button type="button" onClick={() => { setShowForm(false); setEditingProject(null); }} aria-label="Close">×</button></div>
            <label>Project name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength="2" maxLength="100" placeholder="e.g. Mobile app launch" autoFocus required /></label>
            <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength="500" placeholder="A short summary of the goal" rows="3" /></label>
            <label>Due date<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
            <label className="image-field">Cover photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} /><span>{coverFile ? coverFile.name : editingProject?.coverImage ? "Choose a new image to replace the current cover" : "JPG, PNG, WebP or GIF · max 5 MB"}</span></label>
            {editingProject && <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">In progress</option><option value="on-hold">On hold</option><option value="completed">Completed</option></select></label>}
            <button className="button" type="submit" disabled={saving}>{saving ? "Saving…" : editingProject ? "Save changes" : "Create project"}</button>
          </form>
        )}

        <section className="projects-section" id="projects">
          <div className="section-heading"><div><h2>Boards</h2><span>{filteredProjects.length} shown</span></div><div className="project-tools"><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search boards" aria-label="Search boards" /></label><div className="filter-tabs">{[["all","All"],["active","Active"],["on-hold","On hold"],["completed","Completed"]].map(([value,label]) => <button className={statusFilter === value ? "active" : ""} type="button" key={value} onClick={() => setStatusFilter(value)}>{label}</button>)}</div></div></div>
          {loading ? <p className="empty-state">Loading your projects…</p> : projects.length === 0 ? (
            <div className="empty-state"><span>◇</span><h3>Your workspace is ready</h3><p>Create your first project to start organizing the work.</p><button className="button" type="button" onClick={openCreateForm}>Create first project</button></div>
          ) : filteredProjects.length === 0 ? <div className="empty-state"><Search size={28} /><h3>No projects found</h3><p>Try another search or status filter.</p></div> : (
            <div className="project-grid">{filteredProjects.map((project, index) => {
              const isOwner = (project.owner?._id || project.owner) === user.id;
              return (
              <article className="project-card trello-board-card" key={project._id}>
                <button className={`trello-board-card__cover trello-board-card__cover--${index % 6}`} type="button" onClick={() => setSelectedProject(project)} aria-label={`Open ${project.name}`}>
                  {project.coverImage && <img src={assetUrl(project.coverImage)} alt="" />}
                  <span className="trello-board-card__shade" />
                  <strong>{project.name}</strong>
                  <span className={`trello-board-card__status trello-board-card__status--${project.status}`}>{project.status === "active" ? "Active" : project.status === "on-hold" ? "On hold" : "Completed"}</span>
                </button>
                <div className="trello-board-card__body"><p>{project.description || "Add a description to help your team understand this board."}</p><div className="project-meta"><span><CalendarDays size={14} />{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "No due date"}</span><span><Users size={14} />{(project.members?.length || 0) + 1}</span></div><footer><span>{!isOwner ? "Shared with you" : "Your board"}</span><div className="card-actions"><button type="button" onClick={() => openEditForm(project)} aria-label={`Edit ${project.name}`}><Pencil size={14} /></button>{isOwner && <button type="button" onClick={() => deleteProject(project)} aria-label={`Delete ${project.name}`}><Trash2 size={14} /></button>}<button type="button" onClick={() => setSelectedProject(project)} aria-label={`Open ${project.name}`}><ArrowRight size={15} /></button></div></footer></div>
              </article>
            );})}</div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
