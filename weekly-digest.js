// Vercel serverless function: GET /api/weekly-digest
//
// Triggered by a Vercel cron job every Sunday at 8 AM UTC. Walks every
// homestead in the database where the owner has opted in to weekly summaries,
// computes the past 7 days of stats, and sends each owner a personalized email.
//
// Authentication: this endpoint must only be callable by Vercel's cron system
// (not by random visitors). We check the `Authorization` header against the
// CRON_SECRET environment variable.
//
// Required env vars:
//   - SUPABASE_URL          : your project's URL
//   - SUPABASE_SERVICE_ROLE : the service-role key (NOT the anon key — needs
//                              full read access to query owner emails)
//   - RESEND_API_KEY        : Resend API key
//   - CRON_SECRET           : a random string, also configured in vercel.json
//   - EMAIL_FROM            : (optional) sender address for digest emails

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Henalytics <hello@henalytics.com>';

export default async function handler(req, res) {
  // ---- Auth check: only Vercel cron should be calling this ----
  const auth = req.headers.authorization || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Required env
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend not configured' });
  }

  const SUPABASE = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;

  try {
    // ---- 1. Fetch all homesteads (we'll filter for opt-ins in JS) ----
    const homesteadsRes = await fetch(`${SUPABASE}/rest/v1/homesteads?select=id,data,updated_at`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (!homesteadsRes.ok) {
      const errText = await homesteadsRes.text();
      console.error('Failed to fetch homesteads', errText);
      return res.status(502).json({ error: 'Failed to fetch homesteads', detail: errText });
    }
    const homesteads = await homesteadsRes.json();

    // ---- 2. Fetch homestead_members (owners only) so we can find each homestead's owner ----
    const membersRes = await fetch(
      `${SUPABASE}/rest/v1/homestead_members?select=homestead_id,user_id,role&role=eq.owner`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!membersRes.ok) {
      const errText = await membersRes.text();
      console.error('Failed to fetch members', errText);
      return res.status(502).json({ error: 'Failed to fetch members', detail: errText });
    }
    const owners = await membersRes.json();
    const ownerByHomestead = {};
    owners.forEach((m) => { ownerByHomestead[m.homestead_id] = m.user_id; });

    // ---- 3. Resolve user_ids to emails via the auth admin endpoint ----
    // We fetch all users in one go, then map by id.
    const usersRes = await fetch(`${SUPABASE}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (!usersRes.ok) {
      const errText = await usersRes.text();
      console.error('Failed to fetch users', errText);
      return res.status(502).json({ error: 'Failed to fetch users', detail: errText });
    }
    const usersJson = await usersRes.json();
    const userList = Array.isArray(usersJson) ? usersJson : (usersJson.users || []);
    const emailByUser = {};
    userList.forEach((u) => { emailByUser[u.id] = u.email; });

    // ---- 4. For each opted-in homestead, compute weekly stats and send email ----
    const sent = [];
    const skipped = [];
    const failed = [];

    for (const h of homesteads) {
      const data = h.data || {};
      if (!data.weeklyDigestOptIn) {
        skipped.push({ id: h.id, reason: 'not opted in' });
        continue;
      }
      const ownerId = ownerByHomestead[h.id];
      if (!ownerId) {
        skipped.push({ id: h.id, reason: 'no owner found' });
        continue;
      }
      const email = emailByUser[ownerId];
      if (!email) {
        skipped.push({ id: h.id, reason: 'no email for owner' });
        continue;
      }

      // Compute the past 7 days of stats
      const stats = computeWeeklyStats(data);

      // Skip sending entirely if there was zero activity AND nothing tracked.
      // Avoid spamming dormant accounts with empty digests.
      if (stats.totalEntries === 0) {
        skipped.push({ id: h.id, reason: 'no activity this week' });
        continue;
      }

      const payload = buildDigestEmail(email, data, stats);

      try {
        const send = await fetch(RESEND_API, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!send.ok) {
          const t = await send.text();
          failed.push({ id: h.id, email, error: t });
        } else {
          sent.push({ id: h.id, email });
        }
      } catch (e) {
        failed.push({ id: h.id, email, error: String(e) });
      }
    }

    return res.status(200).json({
      ok: true,
      sent: sent.length,
      skipped: skipped.length,
      failed: failed.length,
      details: { sent, skipped, failed },
    });
  } catch (err) {
    console.error('Weekly digest error', err);
    return res.status(500).json({ error: 'Internal error', detail: String(err) });
  }
}

// ============================================================================
// STATS COMPUTATION (server-side mirror of client-side logic)
// ============================================================================

function computeWeeklyStats(data) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString().slice(0, 10);

  const hobbies = data.hobbies || [];
  const allEntries = [];
  hobbies.forEach((h) => {
    const live = (data.entries[h.id] || []);
    live.forEach((e) => {
      if (e.date >= sevenDaysAgoIso) {
        allEntries.push({ ...e, hobbyType: h.type, hobbyName: h.name });
      }
    });
  });

  const eggsCollected = allEntries
    .filter((e) => e.action === 'eggs' || e.action === 'eggs_laid')
    .reduce((s, e) => s + (Number(e.count) || 0), 0);

  const eggsSold = allEntries
    .filter((e) => e.action === 'sold_eggs')
    .reduce((s, e) => s + (Number(e.count) || 0), 0);

  const harvestLbs = allEntries
    .filter((e) => e.action === 'harvested')
    .reduce((s, e) => s + (Number(e.quantity) || 0), 0);

  const totalSpent = allEntries
    .filter((e) => e.action === 'fed' || e.action === 'infrastructure')
    .reduce((s, e) => s + (Number(e.cost) || 0), 0);

  const watered = allEntries.filter((e) => e.action === 'watered').length;
  const planted = allEntries.filter((e) => e.action === 'planted').length;
  const issues = allEntries.filter((e) => e.action === 'issue').length;
  const deaths = allEntries.filter((e) => e.action === 'death').reduce((s, e) => s + (Number(e.count) || 1), 0);
  const photoCount = allEntries.filter((e) => {
    if (Array.isArray(e.photoPaths) && e.photoPaths.length > 0) return true;
    if (e.photoPath) return true;
    return false;
  }).length;

  // Top harvested plant
  const harvestEntries = allEntries.filter((e) => e.action === 'harvested');
  const plantTotals = {};
  harvestEntries.forEach((e) => {
    const name = (e.plant || '').trim();
    if (!name) return;
    plantTotals[name] = (plantTotals[name] || 0) + (Number(e.quantity) || 0);
  });
  const topPlant = Object.entries(plantTotals).sort((a, b) => b[1] - a[1])[0];

  return {
    totalEntries: allEntries.length,
    eggsCollected,
    eggsSold,
    harvestLbs,
    totalSpent,
    watered,
    planted,
    issues,
    deaths,
    photoCount,
    topPlant: topPlant ? { name: topPlant[0], lbs: topPlant[1] } : null,
  };
}

// ============================================================================
// EMAIL BUILDER
// ============================================================================

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtMoney(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

function buildDigestEmail(email, data, stats) {
  const homesteadName = data.homesteadName || 'your homestead';
  const safeName = escape(homesteadName);

  const lines = [];
  if (stats.eggsCollected > 0) lines.push(`🥚 <strong>${stats.eggsCollected}</strong> egg${stats.eggsCollected === 1 ? '' : 's'} collected`);
  if (stats.eggsSold > 0) lines.push(`💰 <strong>${stats.eggsSold}</strong> egg${stats.eggsSold === 1 ? '' : 's'} sold`);
  if (stats.harvestLbs > 0) lines.push(`🌱 <strong>${stats.harvestLbs.toFixed(1)} lbs</strong> harvested`);
  if (stats.topPlant) lines.push(`🥇 Top harvest: <strong>${escape(stats.topPlant.name)}</strong> (${stats.topPlant.lbs.toFixed(1)} lbs)`);
  if (stats.watered > 0) lines.push(`💧 Garden watered <strong>${stats.watered}</strong> time${stats.watered === 1 ? '' : 's'}`);
  if (stats.planted > 0) lines.push(`🌱 <strong>${stats.planted}</strong> new planting${stats.planted === 1 ? '' : 's'}`);
  if (stats.totalSpent > 0) lines.push(`💸 <strong>${fmtMoney(stats.totalSpent)}</strong> spent on feed & supplies`);
  if (stats.deaths > 0) lines.push(`💔 <strong>${stats.deaths}</strong> bird${stats.deaths === 1 ? '' : 's'} lost`);
  if (stats.issues > 0) lines.push(`⚠️ <strong>${stats.issues}</strong> issue${stats.issues === 1 ? '' : 's'} reported`);
  if (stats.photoCount > 0) lines.push(`📷 <strong>${stats.photoCount}</strong> photo${stats.photoCount === 1 ? '' : 's'} captured`);

  const totalEntries = stats.totalEntries;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;color:#2C1810">
      <div style="background:#F4EDE0;padding:24px;border-radius:12px;border:1.5px solid #2C181030">
        <div style="font-size:11px;letter-spacing:2px;color:#5C4530;text-transform:uppercase;margin-bottom:8px">
          This week at
        </div>
        <h1 style="font-family:Georgia,serif;font-size:30px;margin:0 0 18px;color:#2C1810">
          🐔 ${safeName}
        </h1>

        <div style="background:#FAF5EA;padding:16px 20px;border-radius:10px;border-left:4px solid #E8B547;margin-bottom:16px">
          <div style="font-size:13px;color:#5C4530;margin-bottom:8px">You logged <strong style="color:#2C1810">${totalEntries}</strong> ${totalEntries === 1 ? 'entry' : 'entries'} this week.</div>
          <div style="font-size:14px;line-height:1.8;color:#2C1810">
            ${lines.map((l) => `<div>${l}</div>`).join('')}
          </div>
        </div>

        <p style="font-size:13px;color:#5C4530;line-height:1.6">
          Tap below to log this week's eggs, log your harvest, or just look at your photos.
        </p>

        <p style="margin:20px 0">
          <a href="https://henalytics.com" style="background:#2C1810;color:#F4EDE0;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600">
            Open Henalytics →
          </a>
        </p>

        <hr style="border:none;border-top:1px solid #2C181020;margin:24px 0">

        <p style="font-size:11px;color:#888;line-height:1.5">
          You're receiving this because you turned on weekly summaries in Henalytics.
          To stop, open the app, go to Settings, and tap "Weekly summary email" to turn it off.
        </p>
      </div>
    </div>
  `;

  const text = `
This week at ${homesteadName}

You logged ${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'} this week.

${lines.map((l) => '- ' + l.replace(/<[^>]+>/g, '')).join('\n')}

Open Henalytics: https://henalytics.com

To stop these emails, open Henalytics > Settings > Weekly summary email.
  `.trim();

  return {
    from: FROM_ADDRESS,
    to: [email],
    subject: `🐔 This week at ${homesteadName}`,
    html,
    text,
  };
}
