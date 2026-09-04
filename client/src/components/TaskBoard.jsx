import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Activity, ArrowLeft, Bell, CalendarDays, CheckCircle2, Circle, Clock3, Filter, Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { API_URL, SOCKET_URL, apiUrl, assetUrl } from "../config";

const columns = [
  ["todo", "To do"],
  ["in-progress", "In progress"],
  ["done", "Done"],
];

const emptyTask = { title: "", description: "", priority: "medium", dueDate: "", status: "todo", assignee: "" };
const toDateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const memberUserId = (member) => member.user._id || member.user.id;

const request = async (path, options = {}) => {
  const headers = { Authorization: `Bearer ${localStorage.getItem("taskflow_token")}`, ...options.headers };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data.message || "Cannot reach the TaskFlow server.");
  return data;
};

function TaskBoard({ project, onBack, panelRequest = "board" }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyTask);
  const [message, setMessage] = useState("");
  const [draggedId, setDraggedId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState({ owner: null, members: [], pendingInvitations: [], canManage: false });
  const [showTeam, setShowTeam] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [liveStatus, setLiveStatus] = useState("connecting");
  const [taskSearch, setTaskSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [activity, setActivity] = useState([]);
  const [showActivity, setShowActivity] = useState(false);
  const [unreadActivity, setUnreadActivity] = useState(0);
  const [projectAttachments, setProjectAttachments] = useState(project.attachments || []);
  const [taskImageFiles, setTaskImageFiles] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [quickAddStatus, setQuickAddStatus] = useState(null);
  const [quickTitle, setQuickTitle] = useState("");

  useEffect(() => {
    Promise.all([request(`/api/projects/${project._id}/tasks`), request(`/api/projects/${project._id}/members`), request(`/api/projects/${project._id}/activity`)])
      .then(([taskData, teamData, activityData]) => { setTasks(taskData.tasks); setTeam(teamData); setActivity(activityData.activity); })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [project._id]);

  useEffect(() => {
    if (panelRequest === "activity") { setShowActivity(true); setShowTeam(false); setUnreadActivity(0); }
    else if (panelRequest === "team") { setShowTeam(true); setShowActivity(false); }
    else if (panelRequest === "settings") { setShowTeam(true); setShowActivity(false); }
    else { setShowTeam(false); setShowActivity(false); }
  }, [panelRequest]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: `${API_URL}/socket.io`,
      auth: { token: localStorage.getItem("taskflow_token") },
      transports: ["websocket", "polling"],
    });

    const upsertTask = (incomingTask) => setTasks((current) => {
      const exists = current.some((task) => task._id === incomingTask._id);
      return exists ? current.map((task) => task._id === incomingTask._id ? incomingTask : task) : [incomingTask, ...current];
    });

    socket.on("connect", () => socket.emit("join-project", project._id, (result) => setLiveStatus(result?.success ? "live" : "denied")));
    socket.on("connect_error", () => setLiveStatus("offline"));
    socket.on("disconnect", () => setLiveStatus("offline"));
    socket.on("task:created", ({ task }) => upsertTask(task));
    socket.on("task:updated", ({ task }) => upsertTask(task));
    socket.on("task:deleted", ({ taskId }) => setTasks((current) => current.filter((task) => task._id !== taskId)));
    socket.on("member:added", ({ member }) => setTeam((current) => current.members.some((item) => memberUserId(item) === memberUserId(member)) ? current : { ...current, members: [...current.members, member] }));
    socket.on("member:removed", ({ userId }) => {
      setTeam((current) => ({ ...current, members: current.members.filter((member) => memberUserId(member) !== userId) }));
      setTasks((current) => current.map((task) => task.assignee?._id === userId ? { ...task, assignee: null } : task));
    });
    socket.on("project:access-revoked", () => {
      setLiveStatus("denied");
      setMessage("Your access to this project was removed by the project owner.");
    });
    socket.on("activity:created", ({ activity: incomingActivity }) => {
      setActivity((current) => current.some((item) => item._id === incomingActivity._id) ? current : [incomingActivity, ...current].slice(0, 50));
      setUnreadActivity((current) => current + 1);
    });

    return () => {
      socket.emit("leave-project", project._id);
      socket.disconnect();
    };
  }, [project._id]);

  const openCreateForm = () => {
    setEditingTask(null);
    setForm(emptyTask);
    setTaskImageFiles([]);
    setShowForm(true);
  };

  const openEditForm = (task) => {
    setEditingTask(task);
    setTaskImageFiles([]);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      dueDate: toDateInput(task.dueDate),
      status: task.status,
      assignee: task.assignee?._id || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addMember = async (event) => {
    event.preventDefault();
    setInviting(true);
    setMessage("");
    try {
      const data = await request(`/api/projects/${project._id}/members`, { method: "POST", body: JSON.stringify({ email: inviteEmail }) });
      setTeam((current) => ({ ...current, pendingInvitations: (current.pendingInvitations || []).some((item) => item._id === data.invitation._id) ? current.pendingInvitations : [...(current.pendingInvitations || []), data.invitation] }));
      setInviteEmail("");
      setMessage(data.message);
    } catch (error) { setMessage(error.message); }
    finally { setInviting(false); }
  };

  const removeMember = async (member) => {
    const memberUser = member.user;
    const memberId = memberUser._id || memberUser.id;
    if (!window.confirm(`Remove ${memberUser.name} from this project?`)) return;
    try {
      await request(`/api/projects/${project._id}/members/${memberId}`, { method: "DELETE" });
      setTeam((current) => ({ ...current, members: current.members.filter((item) => (item.user._id || item.user.id) !== memberId) }));
      setTasks((current) => current.map((task) => task.assignee?._id === memberId ? { ...task, assignee: null } : task));
    } catch (error) { setMessage(error.message); }
  };

  const people = [
    ...(team.owner ? [{ id: team.owner._id || team.owner.id, name: team.owner.name, role: "Owner" }] : []),
    ...team.members.map((member) => ({ id: member.user._id || member.user.id, name: member.user.name, role: "Member" })),
  ];
  const visibleTasks = tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.description || ""}`.toLowerCase().includes(taskSearch.toLowerCase());
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const taskAssignee = task.assignee?._id || "unassigned";
    const matchesAssignee = assigneeFilter === "all" || taskAssignee === assigneeFilter;
    return matchesSearch && matchesPriority && matchesAssignee;
  });

  const saveTask = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      let savedTask;
      if (editingTask) {
        const data = await request(`/api/tasks/${editingTask._id}`, { method: "PATCH", body: JSON.stringify(form) });
        savedTask = data.task;
      } else {
        const data = await request(`/api/projects/${project._id}/tasks`, { method: "POST", body: JSON.stringify(form) });
        savedTask = data.task;
      }
      for (const file of taskImageFiles) {
        const imageData = new FormData(); imageData.append("image", file);
        const upload = await request(`/api/tasks/${savedTask._id}/attachments`, { method: "POST", body: imageData });
        savedTask = upload.task;
      }
      setTasks((current) => current.some((task) => task._id === savedTask._id) ? current.map((task) => task._id === savedTask._id ? savedTask : task) : [savedTask, ...current]);
      setForm(emptyTask);
      setTaskImageFiles([]);
      setEditingTask(null);
      setShowForm(false);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const addProjectImages = async (event) => {
    const files = [...event.target.files];
    if (!files.length) return;
    setUploadingImages(true); setMessage("");
    try {
      for (const file of files) {
        const imageData = new FormData(); imageData.append("image", file);
        const data = await request(`/api/projects/${project._id}/attachments`, { method: "POST", body: imageData });
        setProjectAttachments((current) => [...current, data.attachment]);
      }
    } catch (error) { setMessage(error.message); }
    finally { setUploadingImages(false); event.target.value = ""; }
  };

  const createQuickTask = async (event, status) => {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    setSaving(true); setMessage("");
    try {
      const data = await request(`/api/projects/${project._id}/tasks`, { method: "POST", body: JSON.stringify({ ...emptyTask, title, status }) });
      setTasks((current) => current.some((task) => task._id === data.task._id) ? current : [data.task, ...current]);
      setQuickTitle(""); setQuickAddStatus(null);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const removeProjectImage = async (attachment) => {
    if (!window.confirm("Remove this project image?")) return;
    try {
      await request(`/api/projects/${project._id}/attachments/${attachment._id}`, { method: "DELETE" });
      setProjectAttachments((current) => current.filter((item) => item._id !== attachment._id));
    } catch (error) { setMessage(error.message); }
  };

  const removeTaskImage = async (attachment) => {
    const data = await request(`/api/tasks/${editingTask._id}/attachments/${attachment._id}`, { method: "DELETE" });
    setEditingTask(data.task);
    setTasks((current) => current.map((item) => item._id === data.task._id ? data.task : item));
  };

  const moveTask = async (taskId, status) => {
    const task = tasks.find((item) => item._id === taskId);
    if (!task || task.status === status) return;
    setTasks((current) => current.map((item) => item._id === taskId ? { ...item, status } : item));
    try {
      const data = await request(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setTasks((current) => current.map((item) => item._id === taskId ? data.task : item));
    } catch (error) {
      setTasks((current) => current.map((item) => item._id === taskId ? task : item));
      setMessage(error.message);
    }
  };

  const deleteTask = async (task) => {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    try {
      await request(`/api/tasks/${task._id}`, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item._id !== task._id));
    } catch (error) { setMessage(error.message); }
  };

  return (
    <section className="task-board-view task-board-view--trello" id="project-board">
      <header className="board-header">
        <div><button className="back-button" type="button" onClick={onBack}><ArrowLeft size={15} /> All projects</button><p className="eyebrow">Project board</p><h1>{project.name}</h1><p>{project.description || "Organize the work that moves this project forward."}</p></div>
        <div className="board-actions"><span className={`live-status live-status--${liveStatus}`}><span />{liveStatus === "live" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Offline"}</span><button className="icon-action" type="button" onClick={() => { setShowActivity((current) => !current); setUnreadActivity(0); }} aria-label="Show project activity"><Bell size={17} />{unreadActivity > 0 && <span>{Math.min(unreadActivity, 9)}</span>}</button><button className="button button--secondary" type="button" onClick={() => setShowTeam((current) => !current)}><Users size={16} /> Team ({people.length})</button><button className="button" type="button" onClick={openCreateForm}><Plus size={16} /> Add task</button></div>
      </header>
      <section className="board-summary" aria-label="Task summary"><div><Circle size={17} /><strong>{tasks.filter((task) => task.status === "todo").length}</strong><span>To do</span></div><div><Clock3 size={17} /><strong>{tasks.filter((task) => task.status === "in-progress").length}</strong><span>In progress</span></div><div><CheckCircle2 size={17} /><strong>{tasks.filter((task) => task.status === "done").length}</strong><span>Completed</span></div></section>
      {message && <p className="dashboard-message" role="alert">{message}</p>}
      <section className="project-media-panel">
        <div><span className="preview-card__label">PROJECT PHOTOS</span><h2>Visual workspace</h2><p>Add reference images, designs, screenshots, or inspiration.</p></div>
        <label className="media-upload"><Plus size={16} />{uploadingImages ? "Uploading…" : "Add photos"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={uploadingImages} onChange={addProjectImages} /></label>
        {projectAttachments.length > 0 && <div className="media-grid">{projectAttachments.map((attachment) => <figure key={attachment._id}><img src={assetUrl(attachment.url)} alt={attachment.name} /><button type="button" onClick={() => removeProjectImage(attachment)} aria-label={`Remove ${attachment.name}`}><Trash2 size={14} /></button><figcaption>{attachment.name}</figcaption></figure>)}</div>}
      </section>
      {showActivity && (
        <section className="activity-panel" id="activity">
          <div className="activity-heading"><div><span className="preview-card__label">LIVE HISTORY</span><h2>Project activity</h2></div><button type="button" onClick={() => setShowActivity(false)} aria-label="Close activity">×</button></div>
          {activity.length === 0 ? <div className="activity-empty"><Activity size={24} /><p>Actions from this project will appear here.</p></div> : <div className="activity-list">{activity.map((item) => <article key={item._id}><span className="avatar avatar--tiny">{item.actor?.name?.slice(0, 2).toUpperCase() || "TF"}</span><div><p><strong>{item.actor?.name || "TaskFlow user"}</strong> {item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div></article>)}</div>}
        </section>
      )}
      {showTeam && (
        <section className="team-panel" id="team">
          <div><span className="preview-card__label">PROJECT TEAM</span><h2>People collaborating</h2><p>Invite an existing TaskFlow user by their account email.</p></div>
          {team.canManage && <form onSubmit={addMember}><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@example.com" required /><button className="button button--small" type="submit" disabled={inviting}><UserPlus size={15} />{inviting ? "Adding…" : "Add member"}</button></form>}
          <div className="team-list">{people.map((person) => <div key={person.id}><span className="avatar avatar--small">{person.name.slice(0, 2).toUpperCase()}</span><div><strong>{person.name}</strong><small>{person.role}</small></div>{team.canManage && person.role !== "Owner" && <button type="button" onClick={() => removeMember(team.members.find((member) => (member.user._id || member.user.id) === person.id))}>Remove</button>}</div>)}</div>
          {team.canManage && team.pendingInvitations?.length > 0 && <div className="pending-invitations"><strong>Pending invitations</strong>{team.pendingInvitations.map((invitation) => <div key={invitation._id}><span className="avatar avatar--small">✉</span><div><strong>{invitation.email}</strong><small>Waiting for response</small></div><span className="pending-pill">Pending</span></div>)}</div>}
        </section>
      )}
      {showForm && (
        <form className="task-form" onSubmit={saveTask}>
          <div className="project-form__heading"><h2>{editingTask ? "Edit task" : "Create a task"}</h2><button type="button" onClick={() => { setShowForm(false); setEditingTask(null); }} aria-label="Close">×</button></div>
          <label>Task title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} minLength="2" maxLength="120" required autoFocus /></label>
          <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength="500" rows="2" /></label>
          <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <label>Due date<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
          <label>Assignee<select value={form.assignee} onChange={(event) => setForm({ ...form, assignee: event.target.value })}><option value="">Unassigned</option>{people.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
          {editingTask && <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{columns.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
          <label className="task-image-input">Task photos<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => setTaskImageFiles([...event.target.files])} /><span>{taskImageFiles.length ? `${taskImageFiles.length} photo${taskImageFiles.length === 1 ? "" : "s"} selected` : "Add screenshots or reference images · max 5 MB each"}</span></label>
          {editingTask?.attachments?.length > 0 && <div className="task-photo-editor">{editingTask.attachments.map((attachment) => <div key={attachment._id}><img src={assetUrl(attachment.url)} alt={attachment.name} /><button type="button" onClick={() => removeTaskImage(attachment)} aria-label={`Remove ${attachment.name}`}>×</button></div>)}</div>}
          <button className="button" type="submit" disabled={saving}>{saving ? "Saving…" : editingTask ? "Save changes" : "Create task"}</button>
        </form>
      )}
      <div className="board-toolbar"><label className="search-box"><Search size={16} /><input value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="Search tasks" aria-label="Search tasks" /></label><div className="board-filters"><Filter size={15} /><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Filter by priority"><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} aria-label="Filter by assignee"><option value="all">All assignees</option><option value="unassigned">Unassigned</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div><span>{visibleTasks.length} tasks</span></div>
      {loading ? <p className="empty-state">Loading tasks…</p> : (
        <div className="kanban-board" id="tasks">
          {columns.map(([status, label]) => {
            const columnTasks = visibleTasks.filter((task) => task.status === status);
            return (
              <section className={`kanban-column kanban-column--${status}`} key={status} onDragOver={(event) => event.preventDefault()} onDrop={() => { moveTask(draggedId, status); setDraggedId(null); }}>
                <header><h2>{label}</h2><span>{columnTasks.length}</span></header>
                <div className="kanban-list">
                  {columnTasks.map((task) => (
                    <article className="kanban-task" key={task._id} draggable onDragStart={() => setDraggedId(task._id)} onDragEnd={() => setDraggedId(null)}>
                      <div><span className={`priority priority--${task.priority}`}>{task.priority}</span><div className="card-actions"><button type="button" onClick={() => openEditForm(task)} aria-label={`Edit ${task.title}`}><Pencil size={13} /></button><button type="button" onClick={() => deleteTask(task)} aria-label={`Delete ${task.title}`}><Trash2 size={13} /></button></div></div>
                      <h3>{task.title}</h3>{task.description && <p>{task.description}</p>}{task.attachments?.length > 0 && <div className="task-photo-grid">{task.attachments.slice(0, 3).map((attachment) => <img key={attachment._id} src={assetUrl(attachment.url)} alt={attachment.name} />)}{task.attachments.length > 3 && <span>+{task.attachments.length - 3}</span>}</div>}{task.assignee && <div className="task-assignee"><span className="avatar avatar--tiny">{task.assignee.name.slice(0, 2).toUpperCase()}</span><span>{task.assignee.name}</span></div>}
                      <footer><span><CalendarDays size={12} />{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}</span><select aria-label={`Move ${task.title}`} value={task.status} onChange={(event) => moveTask(task._id, event.target.value)}>{columns.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></footer>
                    </article>
                  ))}
                  {columnTasks.length === 0 && <p className="column-empty">Drop tasks here</p>}
                  {quickAddStatus === status ? <form className="quick-card-form" onSubmit={(event) => createQuickTask(event, status)}><textarea value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="Enter a title for this card…" autoFocus maxLength="120" /><div><button className="button button--small" type="submit" disabled={saving}>Add card</button><button type="button" onClick={() => { setQuickAddStatus(null); setQuickTitle(""); }} aria-label="Cancel">×</button></div></form> : <button className="add-card-button" type="button" onClick={() => { setQuickAddStatus(status); setQuickTitle(""); }}><Plus size={16} /> Add a card</button>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default TaskBoard;
