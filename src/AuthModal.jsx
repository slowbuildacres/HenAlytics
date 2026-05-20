import React, { useState } from 'react';
import { Mail, Lock, X, UserCircle, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabase.js';
import { apiUrl } from './apiBase.js';

const palette = {
  bg: "#F4EDE0",
  bgAlt: "#EBE0CC",
  ink: "#2C1810",
  inkSoft: "#5C4530",
  accent: "#C84B31",
  leaf: "#5A7A3C",
  yolk: "#E8B547",
  yolkSoft: "#F2D58A",
  feather: "#8B6F47",
  line: "#2C181030",
  card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

export default function AuthModal({ onClose, initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode); // "signin" | "signup" | "reset" | "setNewPassword"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  const switchMode = (m) => { setMode(m); setError(""); setInfo(""); setResetSent(false); setPasswordUpdated(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!isSupabaseConfigured) {
      setError("Sign-in isn't configured on this site yet. Check back soon!");
      return;
    }

    // Set-new-password mode: only password needed, calls updateUser
    if (mode === "setNewPassword") {
      if (!password) { setError("Please enter a new password."); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      setLoading(true);
      try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPasswordUpdated(true);
        setTimeout(() => { onClose(); }, 1200);
      } catch (err) {
        setError(err.message || "Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Reset mode only needs email
    if (mode === "reset") {
      if (!email.trim()) { setError("Please enter your email address."); return; }
      setLoading(true);
      try {
        // Password reset always routes through the web (henalytics.com).
        // Native users tapping the email link open it in their browser,
        // reset there using the working web recovery flow, then return to
        // the app and sign in with the new password. This deliberately
        // avoids the henalytics:// custom-scheme deep link — that hand-off
        // proved unreliable (the recovery token was lost between the email
        // link, the browser, and the app). The web origin handles the
        // recovery hash fragment directly and reliably on every platform.
        const redirectTo = window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        });
        if (error) throw error;
        setResetSent(true);
      } catch (err) {
        setError(err.message || "Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        try {
          await fetch(apiUrl('/api/send-email'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'signup_notify', newUserEmail: email.trim() }),
          });
        } catch (e) {
          console.warn('Signup notification failed', e);
        }
        if (data.session) {
          onClose();
        } else {
          setInfo("Account created! Check your email to confirm before signing in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        onClose();
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.bg, borderRadius: 16, maxWidth: 460, width: "100%",
          maxHeight: "90vh", overflow: "auto",
          border: `2px solid ${palette.ink}`,
          boxShadow: "6px 8px 0 " + palette.line,
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}`,
        }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>
            {mode === "signup" ? "Create account" : mode === "reset" ? "Reset password" : mode === "setNewPassword" ? "Set new password" : "Sign in"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink, padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Sign in / Create account tabs — hidden on reset / setNewPassword modes */}
          {mode !== "reset" && mode !== "setNewPassword" && (
            <div style={{
              display: "flex", gap: 4, padding: 4, marginBottom: 18,
              background: palette.bgAlt, borderRadius: 10,
            }}>
              <button
                onClick={() => switchMode("signin")}
                style={{
                  flex: 1, padding: "8px 12px", border: "none",
                  background: mode === "signin" ? palette.card : "transparent",
                  borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
                  fontFamily: FONT_BODY, color: palette.ink,
                  boxShadow: mode === "signin" ? "1px 1px 0 " + palette.line : "none",
                }}
              >
                Sign in
              </button>
              <button
                onClick={() => switchMode("signup")}
                style={{
                  flex: 1, padding: "8px 12px", border: "none",
                  background: mode === "signup" ? palette.card : "transparent",
                  borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
                  fontFamily: FONT_BODY, color: palette.ink,
                  boxShadow: mode === "signup" ? "1px 1px 0 " + palette.line : "none",
                }}
              >
                Create account
              </button>
            </div>
          )}

          <div style={{
            padding: 12, background: palette.yolkSoft, borderRadius: 8,
            fontSize: 12, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
            border: `1.5px solid ${palette.line}`,
          }}>
            {mode === "setNewPassword" ? (
              <span>You clicked a password reset link. Enter a new password below.</span>
            ) : (
              <span><strong>Privacy:</strong> Your email is used only for support and account recovery — never sold or shared.</span>
            )}
          </div>

          {passwordUpdated ? (
            <div style={{
              padding: 16, background: palette.yolkSoft, border: `1.5px solid ${palette.line}`,
              borderRadius: 8, fontSize: 14, color: palette.ink, textAlign: "center", lineHeight: 1.6,
            }}>
              ✅ Password updated! Signing you in…
            </div>
          ) : resetSent ? (
            <div style={{
              padding: 16, background: palette.yolkSoft, border: `1.5px solid ${palette.line}`,
              borderRadius: 8, fontSize: 14, color: palette.ink, textAlign: "center", lineHeight: 1.6,
            }}>
              ✅ Check your email for a password reset link!
              <br />
              <button
                onClick={() => switchMode("signin")}
                style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, fontFamily: FONT_BODY, fontSize: 12, textDecoration: "underline" }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {mode !== "setNewPassword" && (
                <label style={{ display: "block", marginBottom: 14 }}>
                  <div style={{
                    fontSize: 11, color: palette.inkSoft, marginBottom: 6,
                    textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600,
                    fontFamily: FONT_BODY,
                  }}>
                    Email
                  </div>
                  <input
                    type="email"
                    style={inputStyle}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                    autoFocus
                  />
                </label>
              )}

              {mode !== "reset" && (
                <label style={{ display: "block", marginBottom: 6 }}>
                  <div style={{
                    fontSize: 11, color: palette.inkSoft, marginBottom: 6,
                    textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600,
                    fontFamily: FONT_BODY,
                  }}>
                    {mode === "setNewPassword" ? "New password" : "Password"} {(mode === "signup" || mode === "setNewPassword") && <span style={{ textTransform: "none", letterSpacing: 0, color: palette.inkSoft, fontWeight: 400 }}>(min 6 characters)</span>}
                  </div>
                  <input
                    type="password"
                    style={inputStyle}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={(mode === "signup" || mode === "setNewPassword") ? "new-password" : "current-password"}
                    disabled={loading}
                    autoFocus={mode === "setNewPassword"}
                  />
                </label>
              )}

              {/* Forgot password link — only on signin */}
              {mode === "signin" && (
                <div style={{ textAlign: "right", marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={() => switchMode("reset")}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 12, color: palette.inkSoft,
                      fontFamily: FONT_BODY, textDecoration: "underline",
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {error && (
                <div style={{
                  padding: 10, background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
                  borderRadius: 8, fontSize: 13, color: palette.accent, marginBottom: 14,
                  display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div style={{
                  padding: 10, background: palette.yolkSoft, border: `1.5px solid ${palette.line}`,
                  borderRadius: 8, fontSize: 13, color: palette.ink, marginBottom: 14,
                }}>
                  {info}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "12px 18px", borderRadius: 8,
                  background: palette.ink, color: palette.bg,
                  border: `1.5px solid ${palette.ink}`, cursor: loading ? "wait" : "pointer",
                  fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14,
                  boxShadow: "2px 2px 0 " + palette.line,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Working..." : mode === "reset" ? "Send reset email" : mode === "signup" ? "Create account" : mode === "setNewPassword" ? "Update password" : "Sign in"}
              </button>

              {mode === "reset" && (
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  style={{
                    width: "100%", marginTop: 10, padding: "10px",
                    background: "none", border: `1.5px solid ${palette.line}`,
                    borderRadius: 8, cursor: "pointer", fontFamily: FONT_BODY,
                    fontSize: 13, color: palette.inkSoft,
                  }}
                >
                  Back to sign in
                </button>
              )}
            </form>
          )}

          {mode !== "reset" && mode !== "setNewPassword" && (
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 14, textAlign: "center", lineHeight: 1.5 }}>
              By {mode === "signup" ? "creating an account" : "signing in"}, you agree that your email is stored privately for support purposes only. You can delete your account anytime by emailing slowbuildacres@gmail.com.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
