import { useState } from "react";
import { apiUrl } from "../config";

const resetTokenFromUrl = () => new URLSearchParams(window.location.search).get("reset") || "";

function AuthPanel({ initialMode = "register", onClose, onAuthenticated }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const changeMode = (nextMode) => { setMode(nextMode); setFeedback({ type: "", message: "" }); };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      if (mode === "reset" && form.password !== form.confirmPassword) throw new Error("The passwords do not match");
      const endpoint = mode === "forgot" ? "forgot-password" : mode === "reset" ? "reset-password" : mode;
      const payload = mode === "register" ? { name: form.name, email: form.email, password: form.password }
        : mode === "login" ? { email: form.email, password: form.password }
        : mode === "forgot" ? { email: form.email }
        : { token: resetTokenFromUrl(), password: form.password };
      const response = await fetch(apiUrl(`/api/auth/${endpoint}`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const responseText = await response.text();
      let data = {};
      try { data = responseText ? JSON.parse(responseText) : {}; } catch { data = {}; }
      if (!response.ok) throw new Error(data.message || "Cannot reach the TaskFlow server. Start the backend and try again.");
      if (mode === "forgot") { setFeedback({ type: "success", message: data.message }); return; }
      if (!data.token || !data.user) throw new Error("The server returned an incomplete authentication response.");
      localStorage.setItem("taskflow_token", data.token);
      if (mode === "reset") window.history.replaceState({}, "", window.location.pathname);
      onAuthenticated(data.user);
    } catch (error) { setFeedback({ type: "error", message: error.message }); }
    finally { setSubmitting(false); }
  };

  const titles = {
    register: ["Create your workspace", "Start organizing meaningful work in a few seconds."],
    login: ["Welcome back", "Sign in to continue where you left off."],
    forgot: ["Reset your password", "Enter your TaskFlow email and we’ll send you a secure reset link."],
    reset: ["Choose a new password", "Use at least 8 characters. This reset link can only be used once."],
  };

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="auth-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">Welcome to TaskFlow</p>
        <h2 id="auth-title">{titles[mode][0]}</h2>
        <p className="auth-intro">{titles[mode][1]}</p>
        <form onSubmit={submit}>
          {mode === "register" && <label>Full name<input name="name" value={form.name} onChange={updateField} minLength="2" maxLength="60" autoComplete="name" required /></label>}
          {["register", "login", "forgot"].includes(mode) && <label>Email address<input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" required autoFocus={mode === "forgot"} /></label>}
          {["register", "login", "reset"].includes(mode) && <label>Password<input name="password" type="password" value={form.password} onChange={updateField} minLength="8" maxLength="72" autoComplete={mode === "login" ? "current-password" : "new-password"} required autoFocus={mode === "reset"} /></label>}
          {mode === "reset" && <label>Confirm new password<input name="confirmPassword" type="password" value={form.confirmPassword} onChange={updateField} minLength="8" maxLength="72" autoComplete="new-password" required /></label>}
          {mode === "login" && <button className="forgot-password-link" type="button" onClick={() => changeMode("forgot")}>Forgot password?</button>}
          {feedback.message && <p className={`form-feedback form-feedback--${feedback.type}`} role="alert">{feedback.message}</p>}
          <button className="button auth-submit" type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "register" ? "Create account" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Change password"}</button>
        </form>
        {mode === "register" || mode === "login" ? <p className="auth-switch">{mode === "register" ? "Already have an account?" : "New to TaskFlow?"} <button type="button" onClick={() => changeMode(mode === "register" ? "login" : "register")}>{mode === "register" ? "Sign in" : "Create an account"}</button></p> : <p className="auth-switch">Remember your password? <button type="button" onClick={() => changeMode("login")}>Return to sign in</button></p>}
      </section>
    </div>
  );
}

export default AuthPanel;
