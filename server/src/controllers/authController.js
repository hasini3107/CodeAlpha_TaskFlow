const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const User = require("../models/User");
const { sendPasswordResetEmail } = require("../services/emailService");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});

const assertJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is missing from the .env file");
    error.statusCode = 500;
    throw error;
  }
};

const createToken = (userId, tokenVersion = 0) => {
  assertJwtSecret();
  return jwt.sign({ sub: userId.toString(), ver: tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const register = async (req, res, next) => {
  try {
    assertJwtSecret();
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ success: false, message: "Name must be between 2 and 60 characters" });
    }
    if (!emailPattern.test(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ success: false, message: "Password must be between 8 and 72 characters" });
    }

    if (await User.exists({ email })) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    const user = await User.create({ name, email, password });
    return res.status(201).json({ success: true, token: createToken(user._id, user.tokenVersion), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchesPassword(password))) {
      return res.status(401).json({ success: false, message: "Email or password is incorrect" });
    }

    return res.json({ success: true, token: createToken(user._id, user.tokenVersion), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
};

const getMe = (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
};

const forgotPassword = async (req, res, next) => {
  const genericMessage = "If an account exists for that email, TaskFlow has sent a password-reset link.";
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!emailPattern.test(email)) return res.status(400).json({ success: false, message: "Enter a valid email address" });
    const user = await User.findOne({ email }).select("+passwordResetToken +passwordResetExpires");
    if (!user) return res.json({ success: true, message: genericMessage });

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    const result = await sendPasswordResetEmail({ to: user.email, name: user.name, resetToken }).catch((error) => {
      console.error(`Password reset email failed: ${error.message}`);
      return { sent: false };
    });
    if (!result.sent) {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save({ validateBeforeSave: false });
      return res.status(503).json({ success: false, message: "Password email is unavailable. Check the server email configuration." });
    }
    return res.json({ success: true, message: genericMessage });
  } catch (error) { return next(error); }
};

const resetPassword = async (req, res, next) => {
  try {
    const resetToken = typeof req.body.token === "string" ? req.body.token : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (password.length < 8 || password.length > 72) return res.status(400).json({ success: false, message: "Password must be between 8 and 72 characters" });
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } }).select("+passwordResetToken +passwordResetExpires");
    if (!user) return res.status(400).json({ success: false, message: "This password-reset link is invalid or has expired" });
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    await user.save();
    return res.json({ success: true, token: createToken(user._id, user.tokenVersion), user: publicUser(user), message: "Your password has been changed" });
  } catch (error) { return next(error); }
};

module.exports = { register, login, getMe, forgotPassword, resetPassword };
