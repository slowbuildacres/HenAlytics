// Vercel serverless function: POST /api/delete-account
//
// Deletes the authenticated user's account and all associated data.
// App Store Guideline 5.1.1(v) compliance: users must be able to delete
// their account from within the app.
//
// Flow:
//   1. Verify JWT (user must be signed in)
//   2. Require body { confirmation: "DELETE" } as additional safeguard
//      (defense-in-depth — the client UI also requires typing DELETE)
//   3. For each homestead the user owns:
//        - If they're the only member, delete the homestead and its data
//        - If there are other members, transfer ownership to the oldest
//          remaining member (so a farmhand doesn't lose access)
//   4. Delete the user's membership rows for any homesteads they don't own
//   5. Delete all photos in storage under {userId}/* prefix
//   6. Delete the user from Supabase Auth (this also handles auth.users)
//   7. Send a notification email to slowbuildacres@gmail.com
//
// Errors at any step are surfaced clearly; partial deletions return 207
// with details so the operator can clean up manually if needed.
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY (for owner notification — optional, won't block deletion)
//   EMAIL_FROM, OWNER_EMAIL (optional, with sensible defaults)

import { createClient } from '@supabase/supabase-js';

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Henalytics <onboarding@resend.dev>';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'slowbuildacres@gmail.com';

const ALLOWED_ORIGINS = new Set([
  'https://henalytics.com',
  'https://www.henalytics.com',
]);

let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  _supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabaseAdmin;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://henalytics.com';

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ---- Verify JWT ----
  let user;
  try {
    user = await verifyAuth(req);
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Authentication required' });
  }

  // ---- Parse and validate body ----
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  // The client UI requires typing "DELETE" — we enforce it server-side too
  // as defense-in-depth. Someone who scripted a direct call to this endpoint
  // would still need to know about this requirement.
  if (body.confirmation !== 'DELETE') {
    return res.status(400).json({
      error: 'Must include confirmation: "DELETE" in request body',
    });
  }

  // ---- Begin deletion ----
  // We collect results per-step so the client can see exactly what succeeded
  // and what failed. If anything fails mid-way, we return 207 (Multi-Status)
  // with the details so the operator can manually clean up.
  const supabase = getSupabaseAdmin();
  const errors = [];
  const summary = {
    userId: user.id,
    email: user.email,
    homesteadsDeleted: 0,
    homesteadsTransferred: 0,
    membershipsRemoved: 0,
    photosDeleted: 0,
  };

  try {
    // Step 1: Find all homesteads where this user is the owner
    const { data: ownedMemberships, error: ownedErr } = await supabase
      .from('homestead_members')
      .select('homestead_id')
      .eq('user_id', user.id)
      .eq('role', 'owner');
    if (ownedErr) throw new Error(`Failed to list owned homesteads: ${ownedErr.message}`);

    for (const m of (ownedMemberships || [])) {
      const homesteadId = m.homestead_id;

      // Check if anyone else is a member
      const { data: otherMembers, error: omErr } = await supabase
        .from('homestead_members')
        .select('user_id, role, joined_at')
        .eq('homestead_id', homesteadId)
        .neq('user_id', user.id)
        .order('joined_at', { ascending: true });
      if (omErr) {
        errors.push({ step: 'list_members', homesteadId, error: omErr.message });
        continue;
      }

      if (otherMembers && otherMembers.length > 0) {
        // Someone else is sharing this homestead — promote the oldest non-owner
        // to owner so they don't lose access. This preserves the spouse/farmhand
        // relationship even when the original creator leaves.
        const newOwnerId = otherMembers[0].user_id;
        const { error: promoteErr } = await supabase
          .from('homestead_members')
          .update({ role: 'owner' })
          .eq('homestead_id', homesteadId)
          .eq('user_id', newOwnerId);
        if (promoteErr) {
          errors.push({ step: 'promote_owner', homesteadId, error: promoteErr.message });
          continue;
        }
        summary.homesteadsTransferred++;
      } else {
        // No other members — delete the homestead and all its data.
        // pending_invites are tied to homestead_id with cascade; if not,
        // we clean them up first to be safe.
        const { error: invErr } = await supabase
          .from('pending_invites')
          .delete()
          .eq('homestead_id', homesteadId);
        if (invErr) {
          // Non-fatal; some homesteads may have no invites and the table
          // may or may not have ON DELETE CASCADE set up.
          errors.push({ step: 'delete_invites', homesteadId, error: invErr.message });
        }

        const { error: hsErr } = await supabase
          .from('homesteads')
          .delete()
          .eq('id', homesteadId);
        if (hsErr) {
          errors.push({ step: 'delete_homestead', homesteadId, error: hsErr.message });
          continue;
        }
        summary.homesteadsDeleted++;
      }
    }

    // Step 2: Remove the user's membership rows for any homestead (owned or not).
    // For homesteads where ownership was transferred above, this leaves the
    // homestead intact but removes this user's access.
    const { error: memErr, count: memCount } = await supabase
      .from('homestead_members')
      .delete({ count: 'exact' })
      .eq('user_id', user.id);
    if (memErr) {
      errors.push({ step: 'delete_memberships', error: memErr.message });
    } else {
      summary.membershipsRemoved = memCount || 0;
    }

    // Step 3: Delete all the user's photos from storage. Photos are namespaced
    // as `${userId}/...` so we can list & delete the whole prefix.
    try {
      const { data: files, error: listErr } = await supabase.storage
        .from('photos')
        .list(user.id, { limit: 1000 });
      if (!listErr && Array.isArray(files) && files.length > 0) {
        const paths = files.map(f => `${user.id}/${f.name}`);
        const { error: rmErr } = await supabase.storage.from('photos').remove(paths);
        if (rmErr) {
          errors.push({ step: 'delete_photos', error: rmErr.message });
        } else {
          summary.photosDeleted = paths.length;
        }
      }
    } catch (e) {
      errors.push({ step: 'delete_photos', error: String(e.message || e) });
    }

    // Step 4: Delete the auth.users row. This is the irreversible step —
    // once this completes, the user can never sign in with this email again
    // (until they re-sign-up, which would create a fresh empty account).
    const { error: authErr } = await supabase.auth.admin.deleteUser(user.id);
    if (authErr) {
      // This is the only step we treat as fatal. If everything else succeeded
      // but the auth deletion failed, we have a zombie account that can still
      // sign in — that's worse than the partial state above.
      errors.push({ step: 'delete_auth', error: authErr.message, fatal: true });
      return res.status(500).json({
        error: 'Auth deletion failed — your data was partially deleted but your account remains. Email slowbuildacres@gmail.com for manual completion.',
        summary, errors,
      });
    }

    // Step 5: Best-effort owner notification email. Failure here doesn't
    // affect the deletion — by this point everything is already gone.
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch(RESEND_API, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_ADDRESS,
            to: [OWNER_EMAIL],
            subject: `Account deleted: ${user.email}`,
            html: `
              <h2>A Henalytics account was deleted</h2>
              <p><strong>Email:</strong> ${escape(user.email)}</p>
              <p><strong>When:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} (Central)</p>
              <hr>
              <p><strong>Summary:</strong></p>
              <ul>
                <li>Homesteads deleted: ${summary.homesteadsDeleted}</li>
                <li>Homesteads transferred to other owners: ${summary.homesteadsTransferred}</li>
                <li>Membership rows removed: ${summary.membershipsRemoved}</li>
                <li>Photos removed: ${summary.photosDeleted}</li>
              </ul>
              ${errors.length > 0 ? `<p><strong>⚠️ Non-fatal errors during deletion:</strong></p><pre>${escape(JSON.stringify(errors, null, 2))}</pre>` : ''}
              <p style="color:#888;font-size:12px">User-initiated deletion via in-app Settings.</p>
            `,
            text: `Account deleted: ${user.email}\nHomesteads deleted: ${summary.homesteadsDeleted}\nTransferred: ${summary.homesteadsTransferred}\nMemberships removed: ${summary.membershipsRemoved}\nPhotos removed: ${summary.photosDeleted}`,
          }),
        });
      } catch (e) {
        console.error('Owner notification email failed (non-fatal):', e);
      }
    }

    // Return success even if there were non-fatal cleanup errors
    if (errors.length > 0) {
      return res.status(207).json({ ok: true, summary, errors, message: 'Account deleted with some non-fatal cleanup errors' });
    }
    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    console.error('Account deletion error:', err);
    return res.status(500).json({
      error: 'Internal error during deletion',
      detail: String(err.message || err),
      summary,
      errors,
    });
  }
}

async function verifyAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) throw new Error('Authentication required');

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) {
    throw new Error('Invalid or expired session');
  }
  if (!data.user.email) {
    throw new Error('Account missing email');
  }
  return data.user;
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
