import React, { useState, useEffect } from 'react';
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

// Supabase throttles auth emails two ways: a project-wide hourly cap, and a
// per-address cooldown (default 60s). Both come back as HTTP 429 with a raw
// message like "email rate limit exceeded" or "For security purposes, you can
// only request this after 47 seconds" — neither of which means anything to a
// locked-out user. Translate them, and pull the wait time out when it's there
// so we can count it down instead of letting people hammer the button.
function readAuthError(err, context) {
  const status = err?.status ?? err?.statusCode;
  const code = err?.code || "";
  const msg = err?.message || "";

  const isRateLimit =
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    /rate limit|limit exceeded|only request this (after|once)/i.test(msg);

  if (!isRateLimit) {
    return { message: msg || "Something went wrong. Please try again.", cooldown: 0 };
  }

  const found = msg.match(/(\d+)\s*seconds?/i);
  const seconds = found ? Math.min(parseInt(found[1], 10), 300) : 60;
  const wait = seconds === 1 ? "1 second" : `${seconds} seconds`;

  return {
    message:
      context === "reset"
        ? `Too many reset requests right now — please wait ${wait} and try again. If a reset email already arrived, use that link instead.`
        : `Too many requests right now — please wait ${wait} and try again.`,
    cooldown: seconds,
  };
}

export default function AuthModal({ onClose, initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode); // "signin" | "signup" | "reset" | "setNewPassword"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Tick the cooldown down once a second. Deliberately NOT cleared by
  // switchMode — the server-side limit doesn't care which tab you're on.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Modes that actually cause Supabase to send an email.
  const sendsEmail = mode === "reset" || mode === "signup";
  const throttled = sendsEmail && cooldown > 0;

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
      if (cooldown > 0) {
        setError(`Please wait ${cooldown} more second${cooldown === 1 ? "" : "s"} before requesting another reset email.`);
        return;
      }
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
        setCooldown(60); // matches Supabase's default per-address interval
      } catch (err) {
        const parsed = readAuthError(err, "reset");
        setError(parsed.message);
        if (parsed.cooldown) setCooldown(parsed.cooldown);
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
          setCooldown(60);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        onClose();
      }
    } catch (err) {
      const parsed = readAuthError(err, mode);
      setError(parsed.message);
      if (parsed.cooldown && mode === "signup") setCooldown(parsed.cooldown);
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
                disabled={loading || throttled}
                style={{
                  width: "100%", padding: "12px 18px", borderRadius: 8,
                  background: palette.ink, color: palette.bg,
                  border: `1.5px solid ${palette.ink}`,
                  cursor: loading ? "wait" : throttled ? "not-allowed" : "pointer",
                  fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14,
                  boxShadow: "2px 2px 0 " + palette.line,
                  opacity: (loading || throttled) ? 0.7 : 1,
                }}
              >
                {loading ? "Working..." : throttled ? `Try again in ${cooldown}s` : mode === "reset" ? "Send reset email" : mode === "signup" ? "Create account" : mode === "setNewPassword" ? "Update password" : "Sign in"}
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
