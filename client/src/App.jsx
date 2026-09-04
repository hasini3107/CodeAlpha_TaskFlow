import { useEffect, useState } from "react";
import AuthPanel from "./components/AuthPanel";
import Dashboard from "./components/Dashboard";
import { apiUrl } from "./config";

const features = [
  ["01", "Plan with clarity", "Turn ideas into focused projects, milestones, and tasks your team can act on."],
  ["02", "Move work forward", "Keep priorities visible and give every task a clear owner and status."],
  ["03", "Stay in sync", "Create one shared view of progress so everyone knows what comes next."],
];

function ApiStatus() {
  const [status, setStatus] = useState({ state: "loading", message: "Connecting to API…" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiUrl("/api/health"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("The API returned an error");
        return response.json();
      })
      .then((data) => setStatus({ state: "online", message: data.message }))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setStatus({ state: "offline", message: "API is offline — start the server on port 5000" });
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <div className={`api-status api-status--${status.state}`} role="status">
      <span className="api-status__dot" aria-hidden="true" />
      <span>{status.message}</span>
    </div>
  );
}

function App() {
  const [authOpen, setAuthOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("invitation") || params.has("reset");
  });
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("taskflow_token");
    if (!token) { setCheckingSession(false); return; }

    fetch(apiUrl("/api/auth/me"), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired");
        return response.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem("taskflow_token"))
      .finally(() => setCheckingSession(false));
  }, []);

  const logout = () => {
    localStorage.removeItem("taskflow_token");
    setUser(null);
  };

  if (checkingSession) return <div className="session-loader"><span className="brand__mark">T</span><p>Opening TaskFlow…</p></div>;
  if (user) return <Dashboard user={user} onLogout={logout} />;

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="TaskFlow home">
          <span className="brand__mark">T</span><span>TaskFlow</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#features">How it works</a>
          {user ? (
            <div className="user-menu"><span className="avatar avatar--small">{user.name.slice(0, 2).toUpperCase()}</span><span>{user.name}</span><button type="button" onClick={logout}>Sign out</button></div>
          ) : (
            <button type="button" className="button button--small" onClick={() => setAuthOpen(true)}>Get started</button>
          )}
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero__content">
            <p className="eyebrow">A calmer way to get things done</p>
            <h1>Make progress<br /><em>feel effortless.</em></h1>
            <p className="hero__copy">TaskFlow brings projects, priorities, and people together in one focused workspace.</p>
            <div className="hero__actions">
              <button type="button" className="button" onClick={() => setAuthOpen(true)}>Create your workspace <span>→</span></button>
              <a href="#features">Explore TaskFlow</a>
            </div>
          </div>

          <div className="preview-card" aria-label="TaskFlow project preview">
            <div className="preview-card__top">
              <div><span className="preview-card__label">PROJECT</span><h2>Website launch</h2></div>
              <span className="avatar">AK</span>
            </div>
            <div className="progress-row"><span>Overall progress</span><strong>68%</strong></div>
            <div className="progress"><span /></div>
            <div className="task-list">
              <div className="task task--complete"><span className="check">✓</span><span>Define project scope</span><small>Done</small></div>
              <div className="task"><span className="check" /><span>Build design system</span><small>In progress</small></div>
              <div className="task"><span className="check" /><span>Prepare launch plan</span><small>Next</small></div>
            </div>
            <ApiStatus />
          </div>
        </section>

        <section className="features" id="features">
          {features.map(([number, title, description]) => (
            <article key={number}><span>{number}</span><h2>{title}</h2><p>{description}</p></article>
          ))}
        </section>
      </main>
      {authOpen && <AuthPanel initialMode={new URLSearchParams(window.location.search).has("reset") ? "reset" : "register"} onClose={() => setAuthOpen(false)} onAuthenticated={(authenticatedUser) => { setUser(authenticatedUser); setAuthOpen(false); }} />}
    </div>
  );
}

export default App;
