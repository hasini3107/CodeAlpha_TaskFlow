const nodemailer = require("nodemailer");

let transporter;

const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);

const sendProjectInvitationEmail = async ({ to, inviterName, projectName, invitationId }) => {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: "SMTP is not configured" };
  const clientUrl = process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173";
  const invitationUrl = new URL(clientUrl);
  invitationUrl.searchParams.set("invitation", invitationId.toString());
  const safeInviter = escapeHtml(inviterName);
  const safeProject = escapeHtml(projectName);
  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `${inviterName} invited you to ${projectName} on TaskFlow`,
    text: `${inviterName} invited you to collaborate on “${projectName}” in TaskFlow. Open the invitation: ${invitationUrl.toString()}`,
    html: `<div style="max-width:560px;margin:auto;padding:32px;font-family:Arial,sans-serif;color:#172033"><div style="font-size:22px;font-weight:800;color:#2867f0">TaskFlow</div><h1 style="font-size:25px;margin:28px 0 10px">You’re invited to collaborate</h1><p style="line-height:1.6;color:#566277"><strong>${safeInviter}</strong> invited you to join <strong>${safeProject}</strong>.</p><a href="${escapeHtml(invitationUrl.toString())}" style="display:inline-block;margin:18px 0;padding:13px 22px;border-radius:9px;background:#2867f0;color:#fff;text-decoration:none;font-weight:700">View invitation</a><p style="font-size:12px;line-height:1.5;color:#8a94a6">Sign in with the email address that received this invitation, then accept or decline it from your TaskFlow notifications.</p></div>`,
  });
  return { sent: true };
};

const sendPasswordResetEmail = async ({ to, name, resetToken }) => {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: "SMTP is not configured" };
  const resetUrl = new URL(process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173");
  resetUrl.searchParams.set("reset", resetToken);
  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Reset your TaskFlow password",
    text: `Hello ${name}, use this link to reset your TaskFlow password within one hour: ${resetUrl.toString()} If you did not request this, ignore this email.`,
    html: `<div style="max-width:560px;margin:auto;padding:32px;font-family:Arial,sans-serif;color:#172033"><div style="font-size:22px;font-weight:800;color:#2867f0">TaskFlow</div><h1 style="font-size:25px;margin:28px 0 10px">Reset your password</h1><p style="line-height:1.6;color:#566277">Hello ${escapeHtml(name)}, we received a request to reset your TaskFlow password.</p><a href="${escapeHtml(resetUrl.toString())}" style="display:inline-block;margin:18px 0;padding:13px 22px;border-radius:9px;background:#2867f0;color:#fff;text-decoration:none;font-weight:700">Choose a new password</a><p style="font-size:12px;line-height:1.5;color:#8a94a6">This link expires in one hour and can only be used once. If you did not request a reset, you can safely ignore this email.</p></div>`,
  });
  return { sent: true };
};

module.exports = { sendProjectInvitationEmail, sendPasswordResetEmail };
