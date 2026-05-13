import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Mail, AlertCircle, CheckCircle, MailCheck, MailX } from 'lucide-react';
import {
  listMembers, listPendingInvites, createInvite, cancelInvite,
  removeMember, sendFarmhandInvite, getActiveHomesteadId,
  updateMemberChoreEmails,
} from './sync.js';

const palette = {
  bg: '#F4EDE0', bgAlt: '#EBE0CC', ink: '#2C1810', inkSoft: '#5C4530',
  accent: '#C84B31', leaf: '#5A7A3C', leafSoft: '#A8C078',
  yolk: '#E8B547', yolkSoft: '#F2D58A', feather: '#8B6F47',
  line: '#2C181030', card: '#FAF5EA',
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: 'border-box',
};

export default function FarmhandModal({ user, homesteadName, role, onClose }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [m, i] = await Promise.all([listMembers(user), listPendingInvites(user)]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      setError(e.message || 'Could not load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [user]);

  const sendInvite = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!inviteEmail.trim()) return;
    setBusy(true);
    try {
      const invite = await createInvite(user, inviteEmail);
      try {
        await sendFarmhandInvite({
          inviteEmail: inviteEmail.trim().toLowerCase(),
          inviterEmail: user.email,
          homesteadName: homesteadName || 'a homestead',
          inviteCode: invite.invite_code,
          baseUrl: window.location.origin,
        });
        setSuccess(`Invitation sent to ${inviteEmail}`);
      } catch (emailErr) {
        const link = `${window.location.origin}/?invite=${invite.invite_code}`;
        setError(`Invite created but email failed to send. Share this link: ${link}`);
      }
      setInviteEmail('');
      refresh();
    } catch (e) {
      setError(e.message || 'Could not send invite');
    } finally {
      setBusy(false);
    }
  };

  const removeFarmhand = async (member) => {
    if (!confirm(`Remove this farmhand from your homestead?`)) return;
    setBusy(true);
    try {
      await removeMember(getActiveHomesteadId(), member.user_id);
      refresh();
    } catch (e) {
      setError(e.message || 'Could not remove member');
    } finally {
      setBusy(false);
    }
  };

  const cancelPending = async (invite) => {
    setBusy(true);
    try {
      await cancelInvite(invite.id);
      refresh();
    } catch (e) {
      setError(e.message || 'Could not cancel invite');
    } finally {
      setBusy(false);
    }
  };

  // ---- Toggle chore-email opt-in for a member ----
  // Permissions:
  //   - Owner can toggle anyone's
  //   - Farmhand can toggle only their own
  const toggleChoreEmails = async (member) => {
    setBusy(true);
    setError(''); setSuccess('');
    try {
      const newValue = !member.chore_emails_opt_in;
      await updateMemberChoreEmails(member.user_id, newValue);
      // Optimistically update local state
      setMembers(prev => prev.map(m =>
        m.user_id === member.user_id ? { ...m, chore_emails_opt_in: newValue } : m
      ));
      setSuccess(newValue
        ? "Chore emails turned ON for this member"
        : "Chore emails turned OFF for this member");
    } catch (e) {
      setError(e.message || 'Could not update preference');
    } finally {
      setBusy(false);
    }
  };

  const isOwner = role === 'owner';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(44,24,16,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.bg, borderRadius: 16, maxWidth: 460, width: '100%',
          maxHeight: '90vh', overflow: 'auto',
          border: `2px solid ${palette.ink}`,
          boxShadow: '6px 8px 0 ' + palette.line,
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: `1.5px solid ${palette.line}`,
        }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>
            Farmhands
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette.ink, padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {!isOwner && (
            <div style={{
              padding: 12, background: palette.bgAlt, borderRadius: 8,
              fontSize: 13, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
              border: `1.5px solid ${palette.line}`,
            }}>
              You're a farmhand on this homestead. You can view and edit data, but only the owner can invite or remove others.
            </div>
          )}

          {/* Invite form (owner only) */}
          {isOwner && (
            <form onSubmit={sendInvite} style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 11, color: palette.inkSoft, marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, fontFamily: FONT_BODY,
              }}>
                Invite a farmhand
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  style={inputStyle}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="farmhand@example.com"
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || !inviteEmail.trim()}
                  style={{
                    padding: '10px 16px', borderRadius: 8,
                    background: palette.ink, color: palette.bg,
                    border: `1.5px solid ${palette.ink}`,
                    cursor: busy ? 'wait' : 'pointer',
                    fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
                    boxShadow: '2px 2px 0 ' + palette.line,
                    opacity: busy || !inviteEmail.trim() ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <UserPlus size={14} /> Invite
                </button>
              </div>
              <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 6 }}>
                They'll get an email with a link to accept. Invites expire in 14 days.
              </div>
            </form>
          )}

          {error && (
            <div style={{
              padding: 10, background: '#FBE5DE', border: `1.5px solid ${palette.accent}`,
              borderRadius: 8, fontSize: 12, color: palette.accent, marginBottom: 14,
              display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ wordBreak: 'break-all' }}>{error}</span>
            </div>
          )}

          {success && (
            <div style={{
              padding: 10, background: palette.leafSoft, borderRadius: 8,
              fontSize: 13, color: palette.ink, marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <CheckCircle size={16} /> {success}
            </div>
          )}

          {/* Members list */}
          <div style={{
            fontSize: 11, color: palette.inkSoft, marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600,
          }}>
            Members ({members.length})
          </div>
          {loading ? (
            <div style={{ padding: 12, color: palette.inkSoft, fontSize: 13 }}>Loading…</div>
          ) : members.length === 0 ? (
            <div style={{ padding: 12, color: palette.inkSoft, fontSize: 13 }}>No members yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {members.map((m) => {
                // Show the chore-emails toggle for:
                //   - Owner can toggle anyone
                //   - Non-owner can only toggle themselves
                const canToggleChores = isOwner || m.isYou;
                const choresOn = !!m.chore_emails_opt_in;
                return (
                  <div key={m.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: palette.card,
                    border: `1.5px solid ${palette.line}`, borderRadius: 8,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: palette.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.email || (m.isYou ? 'You' : 'Farmhand')}{m.isYou && m.email ? ' (you)' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: 'capitalize' }}>
                        {m.role}
                      </div>
                    </div>

                    {/* Chore email toggle — clickable for owner or self */}
                    {canToggleChores && (
                      <button
                        onClick={() => toggleChoreEmails(m)}
                        disabled={busy}
                        title={choresOn ? "Chore emails ON — click to turn off" : "Chore emails off — click to turn on"}
                        style={{
                          background: choresOn ? palette.leafSoft : 'transparent',
                          border: `1.5px solid ${choresOn ? palette.leaf : palette.line}`,
                          borderRadius: 6, padding: '4px 8px',
                          cursor: busy ? 'wait' : 'pointer',
                          color: choresOn ? palette.ink : palette.inkSoft,
                          fontSize: 11, fontFamily: FONT_BODY, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        {choresOn ? <MailCheck size={12} /> : <MailX size={12} />}
                        {choresOn ? 'On' : 'Off'}
                      </button>
                    )}

                    {/* Show non-clickable indicator if not toggleable (farmhand viewing other farmhands) */}
                    {!canToggleChores && (
                      <div
                        title={choresOn ? "Chore emails on" : "Chore emails off"}
                        style={{
                          fontSize: 11, color: palette.inkSoft, flexShrink: 0,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {choresOn ? <MailCheck size={12} /> : <MailX size={12} />}
                      </div>
                    )}

                    {/* Allow removing (owner can remove anyone but themselves; non-owner can leave themselves) */}
                    {((isOwner && !m.isYou) || (!isOwner && m.isYou)) && (
                      <button
                        onClick={() => removeFarmhand(m)}
                        disabled={busy}
                        title={m.isYou ? 'Leave homestead' : 'Remove farmhand'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette.accent, padding: 4 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending invites (owner only) */}
          {isOwner && invites.length > 0 && (
            <>
              <div style={{
                fontSize: 11, color: palette.inkSoft, marginBottom: 8,
                textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600,
              }}>
                Pending invites ({invites.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {invites.map((inv) => (
                  <div key={inv.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: palette.bgAlt,
                    border: `1.5px solid ${palette.line}`, borderRadius: 8,
                  }}>
                    <Mail size={14} color={palette.inkSoft} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: palette.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.invited_email}
                      </div>
                      <div style={{ fontSize: 11, color: palette.inkSoft }}>
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => cancelPending(inv)}
                      disabled={busy}
                      title="Cancel invite"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette.inkSoft, padding: 4 }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
