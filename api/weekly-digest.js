// Vercel serverless function: GET /api/weekly-digest
//
// Triggered by a Vercel cron job every Sunday at 8 AM UTC. Walks every
// homestead in the database where the owner has opted in to weekly summaries,
// computes the past 7 days of stats, and sends each owner a personalized email.

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Henalytics <hello@henalytics.com>';

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend not configured' });
  }

  const SUPABASE = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // WEEKLY_DIGEST_PAGINATION: Supabase caps a single response at db-max-rows
    // (1000 by default). An unpaginated fetch silently dropped every homestead
    // past the first 1000 — owners beyond that never got a digest. Filter to
    // opted-in homesteads server-side (also avoids loading every data blob into
    // memory) and page through in case opt-ins ever exceed the cap.
    let homesteads;
    try {
      homesteads = await fetchAllRows(
        `${SUPABASE}/rest/v1/homesteads?select=id,data,updated_at&data->>weeklyDigestOptIn=eq.true`,
        SERVICE_KEY,
        'id.asc'
      );
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch homesteads', detail: e.detail || e.message });
    }

    let owners;
    try {
      owners = await fetchAllRows(
        `${SUPABASE}/rest/v1/homestead_members?select=homestead_id,user_id,role&role=eq.owner`,
        SERVICE_KEY,
        'homestead_id.asc'
      );
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch members', detail: e.detail || e.message });
    }
    const ownerByHomestead = {};
    owners.forEach((m) => { ownerByHomestead[m.homestead_id] = m.user_id; });

    // WEEKLY_DIGEST_USER_PAGINATION: Supabase's admin users endpoint paginates. A single
    // per_page=1000 fetch silently caps the digest at the first 1000
    // users — every owner past that gets "no email for owner" and never
    // receives a digest. Page through all users (mirrors the loop in
    // send-chore-emails.js). MAX_PAGES is a 50,000-user safety brake.
    const emailByUser = {};
    const USERS_PER_PAGE = 1000;
    const MAX_PAGES = 50;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const usersRes = await fetch(
        `${SUPABASE}/auth/v1/admin/users?page=${page}&per_page=${USERS_PER_PAGE}`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      if (!usersRes.ok) {
        const errText = await usersRes.text();
        return res.status(502).json({ error: 'Failed to fetch users', detail: errText, page });
      }
      const usersJson = await usersRes.json();
      const list = Array.isArray(usersJson) ? usersJson : (usersJson.users || []);
      list.forEach((u) => { if (u.id && u.email) emailByUser[u.id] = u.email; });
      // A short page means we have reached the end.
      if (list.length < USERS_PER_PAGE) break;
      if (page === MAX_PAGES) {
        console.warn('[weekly-digest] hit MAX_PAGES users cap; some users may be missing');
      }
    }

    const sent = [], skipped = [], failed = [];

    for (const h of homesteads) {
     // WEEKLY_DIGEST_FIX: isolate each homestead. A throw here (e.g. malformed
     // data) must not abort the digest for every homestead after it.
     try {
      const data = h.data || {};
      if (!data.weeklyDigestOptIn) { skipped.push({ id: h.id, reason: 'not opted in' }); continue; }
      const ownerId = ownerByHomestead[h.id];
      if (!ownerId) { skipped.push({ id: h.id, reason: 'no owner found' }); continue; }
      const email = emailByUser[ownerId];
      if (!email) { skipped.push({ id: h.id, reason: 'no email for owner' }); continue; }

      const stats = computeWeeklyStats(data);

      // Quiet weeks still get a digest (a warm "all quiet" note), matching the
      // chore email's behavior. buildDigestEmail renders the empty-state body
      // when there's nothing to report.
      const payload = buildDigestEmail(email, data, stats);

      // Resend caps at 5 requests/sec. 250ms between sends keeps us at 4/sec
      // with comfortable headroom. For larger user bases this could be
      // parallelized in batches of 5 with a 1-second wait between batches,
      // but at <50 opted-in users the simple sequential approach is fine.
      let attempts = 0;
      let delivered = false;
      let lastError = null;
      while (attempts < 3 && !delivered) {
        attempts++;
        try {
          const send = await fetch(RESEND_API, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (send.ok) {
            delivered = true;
            sent.push({ id: h.id, email });
          } else if (send.status === 429) {
            // Hit Resend rate limit — back off and retry
            lastError = await send.text();
            await new Promise(r => setTimeout(r, 1500));
          } else {
            lastError = await send.text();
            break; // non-retryable error, give up immediately
          }
        } catch (e) {
          lastError = String(e);
          break;
        }
      }
      if (!delivered) failed.push({ id: h.id, email, error: lastError });

      // Pace ourselves between recipients — keeps us safely under 5/sec
      await new Promise(r => setTimeout(r, 250));
     } catch (perHomesteadErr) {
       // WEEKLY_DIGEST_FIX: one homestead failing must not sink the rest.
       console.error("Weekly digest: homestead", h.id, "failed:", perHomesteadErr);
       failed.push({ id: h.id, error: String(perHomesteadErr) });
     }
    }

    return res.status(200).json({ ok: true, sent: sent.length, skipped: skipped.length, failed: failed.length, details: { sent, skipped, failed } });
  } catch (err) {
    console.error('Weekly digest error', err);
    return res.status(500).json({ error: 'Internal error', detail: String(err) });
  }
}

// ============================================================================
// PAGINATED POSTGREST FETCH
// ============================================================================
// Supabase caps a single REST response at db-max-rows (1000 by default), so an
// unpaginated list fetch silently truncates once a table grows past it. Page
// through with limit/offset plus a stable order until a short page signals the
// end. `urlBase` should already include any select/filter; `order` is the
// column(s) that make offset paging deterministic (e.g. 'id.asc').
async function fetchAllRows(urlBase, serviceKey, order, pageSize = 1000) {
  const all = [];
  const MAX_PAGES = 200; // 200k-row safety brake
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * pageSize;
    const sep = urlBase.includes('?') ? '&' : '?';
    const url = `${urlBase}${sep}order=${order}&limit=${pageSize}&offset=${offset}`;
    const r = await fetch(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!r.ok) {
      const detail = await r.text();
      const err = new Error(`Paginated fetch failed (${r.status})`);
      err.status = r.status;
      err.detail = detail;
      throw err;
    }
    const rows = await r.json();
    const list = Array.isArray(rows) ? rows : [];
    all.push(...list);
    if (list.length < pageSize) break;
  }
  return all;
}

// ============================================================================
// STATS COMPUTATION
// ============================================================================

function computeWeeklyStats(data) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString().slice(0, 10);

  const hobbies = data.hobbies || [];
  const allEntries = [];
  // WEEKLY_DIGEST_FIX: data.entries can be missing entirely on some
  // homesteads. Without this guard, data.entries[h.id] throws TypeError.
  const entriesMap = data.entries || {};
  hobbies.forEach((h) => {
    const live = (entriesMap[h.id] || []);
    live.forEach((e) => {
      if (e.date >= sevenDaysAgoIso) {
        allEntries.push({ ...e, hobbyType: h.type, hobbyName: h.name, hobbyHidden: h.hidden });
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
  const deaths = allEntries.filter((e) => e.action === 'death' && e.hobbyType !== 'rabbits').reduce((s, e) => s + (Number(e.count) || 1), 0);

  const photoCount = allEntries.filter((e) => {
    if (Array.isArray(e.photoPaths) && e.photoPaths.length > 0) return true;
    if (e.photoPath) return true;
    return false;
  }).length;

  const harvestEntries = allEntries.filter((e) => e.action === 'harvested');
  const plantTotals = {};
  harvestEntries.forEach((e) => {
    const name = (e.plant || '').trim();
    if (!name) return;
    plantTotals[name] = (plantTotals[name] || 0) + (Number(e.quantity) || 0);
  });
  const topPlant = Object.entries(plantTotals).sort((a, b) => b[1] - a[1])[0];

  // Rabbit stats — only if rabbits hobby is visible
  const rabbitsHobby = hobbies.find(h => h.type === 'rabbits' && !h.hidden);
  let rabbitLitters = 0, rabbitKits = 0, rabbitDeaths = 0;
  if (rabbitsHobby) {
    const rabbitEntries = allEntries.filter((e) => e.hobbyType === 'rabbits');
    rabbitLitters = rabbitEntries.filter((e) => e.action === 'litter').length;
    rabbitKits = rabbitEntries.filter((e) => e.action === 'litter').reduce((s, e) => s + (Number(e.kitsAlive) || 0), 0);
    rabbitDeaths = rabbitEntries.filter((e) => e.action === 'death').reduce((s, e) => s + (Number(e.count) || 1), 0);
  }

  // Bees stats — only if bees hobby is visible
  const beesHobby = hobbies.find(h => h.type === 'bees' && !h.hidden);
  let honeyHarvested = 0, hiveInspections = 0;
  if (beesHobby) {
    const beeEntries = allEntries.filter((e) => e.hobbyType === 'bees');
    honeyHarvested = beeEntries.filter((e) => e.action === 'harvest').reduce((s, e) => s + (Number(e.lbs) || 0), 0);
    hiveInspections = beeEntries.filter((e) => e.action === 'inspect').length;
  }

  // Incubator stats — only if incubator hobby is visible
  const incubatorHobby = hobbies.find(h => h.type === 'incubator' && !h.hidden);
  let eggsSet = 0, eggsHatched = 0;
  if (incubatorHobby) {
    const runs = incubatorHobby.runs || [];
    const recentRuns = runs.filter(r => r.dateSet >= sevenDaysAgoIso);
    eggsSet = recentRuns.reduce((s, r) => s + (Number(r.eggsSet) || 0), 0);
    const recentHatched = runs.filter(r => r.hatchedDate >= sevenDaysAgoIso && r.eggsHatched != null);
    eggsHatched = recentHatched.reduce((s, r) => s + (Number(r.eggsHatched) || 0), 0);
  }

  // Goats stats
  const goatsHobby = hobbies.find(h => h.type === 'goats' && !h.hidden);
  let goatMilkOz = 0, goatKids = 0;
  if (goatsHobby) {
    const goatEntries = allEntries.filter(e => e.hobbyType === 'goats');
    goatMilkOz = goatEntries.filter(e => e.action === 'milk').reduce((s,e) => s+(Number(e.oz)||0), 0);
    goatKids = goatEntries.filter(e => e.action === 'kid').reduce((s,e) => s+(Number(e.count)||1), 0);
  }

  // Cows stats
  const cowsHobby = hobbies.find(h => h.type === 'cows' && !h.hidden);
  let cowMilkGal = 0, cowCalves = 0;
  if (cowsHobby) {
    const cowEntries = allEntries.filter(e => e.hobbyType === 'cows');
    cowMilkGal = cowEntries.filter(e => e.action === 'milk').reduce((s,e) => s+(Number(e.gallons)||0), 0);
    cowCalves = cowEntries.filter(e => e.action === 'calf').reduce((s,e) => s+(Number(e.count)||1), 0);
  }

  // Pigs stats
  const pigsHobby = hobbies.find(h => h.type === 'pigs' && !h.hidden);
  let pigLitters = 0, pigButchered = 0, pigMeatLbs = 0;
  if (pigsHobby) {
    const pigEntries = allEntries.filter(e => e.hobbyType === 'pigs');
    pigLitters = pigEntries.filter(e => e.action === 'litter').reduce((s,e) => s+(Number(e.count)||1), 0);
    const butchered = pigEntries.filter(e => e.action === 'butcher');
    pigButchered = butchered.length;
    pigMeatLbs = butchered.reduce((s,e) => s+(Number(e.weight)||0), 0);
  }

  // Sheep stats
  const sheepHobby = hobbies.find(h => h.type === 'sheep' && !h.hidden);
  let sheepMilkGal = 0, sheepLambsBorn = 0, sheepWoolLbs = 0, sheepButchered = 0;
  if (sheepHobby) {
    const sheepEntries = allEntries.filter(e => e.hobbyType === 'sheep');
    sheepMilkGal = sheepEntries.filter(e => e.action === 'milk').reduce((s,e) => s+(Number(e.oz)||0), 0) / 128;
    sheepButchered = sheepEntries.filter(e => e.action === 'butcher').length;
    // Lambings completed this week
    const weekLambings = (sheepHobby.breedings || []).filter(b => b.lambedDate && b.lambedDate >= sevenDaysAgoIso);
    sheepLambsBorn = weekLambings.reduce((s,b) => s+(Number(b.lambsBorn)||0), 0);
    // Shearings this week
    const weekShearings = (sheepHobby.shearings || []).filter(sh => sh.date >= sevenDaysAgoIso);
    sheepWoolLbs = weekShearings.reduce((s,sh) => s+(Number(sh.woolLbs)||0), 0);
  }

  // Sourdough stats
  const sourdoughHobby = hobbies.find(h => h.type === 'sourdough' && !h.hidden);
  let sourdoughBakes = 0, sourdoughLoaves = 0, sourdoughLoavesSold = 0, sourdoughRevenue = 0;
  if (sourdoughHobby) {
    const weekBakes = (sourdoughHobby.bakes || []).filter(b => b.date && b.date >= sevenDaysAgoIso);
    sourdoughBakes = weekBakes.length;
    sourdoughLoaves = weekBakes.reduce((s,b) => s+(Number(b.loafCount)||0), 0);
    const weekSourdoughSales = (data.sales || []).filter(s => s.hobbyType === 'sourdough' && s.date >= sevenDaysAgoIso);
    sourdoughLoavesSold = weekSourdoughSales.reduce((s,x) => s+(Number(x.qty)||0), 0);
    sourdoughRevenue = weekSourdoughSales.reduce((s,x) => s+(Number(x.totalRevenue)||0), 0);
  }

  // Horse stats
  const horsesHobby = hobbies.find(h => h.type === 'horses' && !h.hidden);
  let horseRides = 0, horseRideMinutes = 0, horseFoalsBorn = 0, horseVetVisits = 0, horseFarrierVisits = 0;
  if (horsesHobby) {
    const weekRides = (horsesHobby.rides || []).filter(r => r.date && r.date >= sevenDaysAgoIso);
    horseRides = weekRides.length;
    horseRideMinutes = weekRides.reduce((s,r) => s+(Number(r.durationMinutes)||0), 0);
    const weekFoalings = (horsesHobby.breedings || []).filter(b => b.foaledDate && b.foaledDate >= sevenDaysAgoIso);
    horseFoalsBorn = weekFoalings.reduce((s,b) => s+(Number(b.foalsBorn)||0), 0);
    horseVetVisits = (horsesHobby.vet || []).filter(r => r.date && r.date >= sevenDaysAgoIso).length;
    horseFarrierVisits = (horsesHobby.farrier || []).filter(r => r.date && r.date >= sevenDaysAgoIso).length;
  }

  // Farm stand sales stats
  const farmstandSales = (data.sales || []).filter(s => s.hobbyType === 'farmstand' && s.date >= sevenDaysAgoIso);
  const farmstandRevenue = farmstandSales.reduce((s, x) => s + (Number(x.totalRevenue) || 0), 0);
  const farmstandProfit = farmstandSales.reduce((s, x) => s + (Number(x.totalRevenue) || 0) - (Number(x.totalCost) || 0), 0);

  // Freezer log — universal butcher records (any bird from any flock)
  const freezerLogWeek = (data.freezerLog || []).filter(r => r.date >= sevenDaysAgoIso);
  const freezerBirds = freezerLogWeek.reduce((s, r) => s + (Number(r.count) || 0), 0);
  const freezerLbs = freezerLogWeek.reduce((s, r) => s + ((Number(r.count) || 0) * (Number(r.avgWeight) || 0)), 0);

  return {
    totalEntries: allEntries.length,
    eggsCollected, eggsSold, harvestLbs, totalSpent,
    watered, planted, issues, deaths, photoCount,
    topPlant: topPlant ? { name: topPlant[0], lbs: topPlant[1] } : null,
    rabbitLitters, rabbitKits, rabbitDeaths, hasRabbits: !!rabbitsHobby,
    honeyHarvested, hiveInspections, hasBees: !!beesHobby,
    eggsSet, eggsHatched, hasIncubator: !!incubatorHobby,
    farmstandRevenue, farmstandProfit, hasFarmstand: farmstandSales.length > 0,
    goatMilkOz, goatKids, hasGoats: !!goatsHobby,
    cowMilkGal, cowCalves, hasCows: !!cowsHobby,
    pigLitters, pigButchered, pigMeatLbs, hasPigs: !!pigsHobby,
    sheepMilkGal, sheepLambsBorn, sheepWoolLbs, sheepButchered, hasSheep: !!sheepHobby,
    sourdoughBakes, sourdoughLoaves, sourdoughLoavesSold, sourdoughRevenue, hasSourdough: !!sourdoughHobby,
    horseRides, horseRideMinutes, horseFoalsBorn, horseVetVisits, horseFarrierVisits, hasHorses: !!horsesHobby,
    freezerBirds, freezerLbs,
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

  // Rabbit lines
  if (stats.hasRabbits) {
    if (stats.rabbitLitters > 0) lines.push(`🐇 <strong>${stats.rabbitLitters}</strong> litter${stats.rabbitLitters === 1 ? '' : 's'} born · <strong>${stats.rabbitKits}</strong> kits alive`);
    if (stats.rabbitDeaths > 0) lines.push(`💔 <strong>${stats.rabbitDeaths}</strong> rabbit${stats.rabbitDeaths === 1 ? '' : 's'} lost`);
  }

  // Bees lines
  if (stats.hasBees) {
    if (stats.honeyHarvested > 0) lines.push(`🍯 <strong>${stats.honeyHarvested.toFixed(1)} lbs</strong> of honey harvested`);
    if (stats.hiveInspections > 0) lines.push(`🐝 <strong>${stats.hiveInspections}</strong> hive inspection${stats.hiveInspections === 1 ? '' : 's'} logged`);
  }

  // Incubator lines
  if (stats.hasIncubator) {
    if (stats.eggsSet > 0) lines.push(`🥚 <strong>${stats.eggsSet}</strong> egg${stats.eggsSet === 1 ? '' : 's'} set in incubator`);
    if (stats.eggsHatched > 0) lines.push(`🐣 <strong>${stats.eggsHatched}</strong> egg${stats.eggsHatched === 1 ? '' : 's'} hatched this week`);
  }

  // Goats lines
  if (stats.hasGoats) {
    if (stats.goatMilkOz > 0) lines.push(`🐐 <strong>${(stats.goatMilkOz/128).toFixed(1)} gallons</strong> of goat milk collected`);
    if (stats.goatKids > 0) lines.push(`🍼 <strong>${stats.goatKids}</strong> goat kid${stats.goatKids===1?'':'s'} born`);
  }

  // Cows lines
  if (stats.hasCows) {
    if (stats.cowMilkGal > 0) lines.push(`🐄 <strong>${stats.cowMilkGal.toFixed(1)} gallons</strong> of cow milk collected`);
    if (stats.cowCalves > 0) lines.push(`🍼 <strong>${stats.cowCalves}</strong> calf${stats.cowCalves===1?'':'s'} born`);
  }

  // Pigs lines
  if (stats.hasPigs) {
    if (stats.pigLitters > 0) lines.push(`🐷 <strong>${stats.pigLitters}</strong> piglet${stats.pigLitters===1?'':'s'} born`);
    if (stats.pigButchered > 0) lines.push(`🔪 <strong>${stats.pigButchered}</strong> pig${stats.pigButchered===1?'':'s'} butchered · <strong>${stats.pigMeatLbs.toFixed(0)} lbs</strong> meat`);
  }

  // Sheep lines
  if (stats.hasSheep) {
    if (stats.sheepLambsBorn > 0) lines.push(`🐑 <strong>${stats.sheepLambsBorn}</strong> lamb${stats.sheepLambsBorn===1?'':'s'} born`);
    if (stats.sheepMilkGal > 0) lines.push(`🥛 <strong>${stats.sheepMilkGal.toFixed(1)} gal</strong> sheep milk`);
    if (stats.sheepWoolLbs > 0) lines.push(`✂️ <strong>${stats.sheepWoolLbs.toFixed(1)} lbs</strong> wool sheared`);
    if (stats.sheepButchered > 0) lines.push(`🥩 <strong>${stats.sheepButchered}</strong> sheep butchered`);
  }

  // Sourdough lines
  if (stats.hasSourdough) {
    if (stats.sourdoughLoaves > 0) lines.push(`🍞 <strong>${stats.sourdoughLoaves}</strong> loa${stats.sourdoughLoaves===1?'f':'ves'} baked across <strong>${stats.sourdoughBakes}</strong> session${stats.sourdoughBakes===1?'':'s'}`);
    if (stats.sourdoughLoavesSold > 0) lines.push(`💰 <strong>${stats.sourdoughLoavesSold}</strong> loa${stats.sourdoughLoavesSold===1?'f':'ves'} sold · <strong>${fmtMoney(stats.sourdoughRevenue)}</strong> revenue`);
  }

  // Horse lines
  if (stats.hasHorses) {
    if (stats.horseRides > 0) {
      const hrs = (stats.horseRideMinutes / 60).toFixed(1);
      lines.push(`🐴 <strong>${stats.horseRides}</strong> ride${stats.horseRides===1?'':'s'} · <strong>${hrs} hr${hrs==='1.0'?'':'s'}</strong> in the saddle`);
    }
    if (stats.horseFoalsBorn > 0) lines.push(`🍼 <strong>${stats.horseFoalsBorn}</strong> foal${stats.horseFoalsBorn===1?'':'s'} born this week`);
    if (stats.horseVetVisits > 0) lines.push(`🩺 <strong>${stats.horseVetVisits}</strong> vet visit${stats.horseVetVisits===1?'':'s'} logged`);
    if (stats.horseFarrierVisits > 0) lines.push(`🔨 <strong>${stats.horseFarrierVisits}</strong> farrier visit${stats.horseFarrierVisits===1?'':'s'} logged`);
  }

  // Farm stand lines
  if (stats.hasFarmstand) {
    if (stats.farmstandRevenue > 0) lines.push(`🧾 Farm stand: <strong>${fmtMoney(stats.farmstandRevenue)}</strong> revenue · <strong>${fmtMoney(stats.farmstandProfit)}</strong> profit`);
  }

  // Freezer log — universal butcher records (any bird, any flock)
  if (stats.freezerBirds > 0) {
    lines.push(`❄️ <strong>${stats.freezerBirds}</strong> bird${stats.freezerBirds === 1 ? '' : 's'} to the freezer · <strong>${stats.freezerLbs.toFixed(1)} lbs</strong> total`);
  }

  const totalEntries = stats.totalEntries;
  const quiet = lines.length === 0;

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
          ${quiet ? `
            <div style="font-family:Georgia,serif;font-size:18px;color:#2C1810;margin-bottom:6px">☕ A quiet week</div>
            <div style="font-size:14px;line-height:1.6;color:#5C4530">
              Nothing logged in the last seven days — and that's perfectly alright. Some weeks the homestead just hums along on its own. Pour a cup of coffee, watch the birds, and we'll see you next Sunday.
            </div>
          ` : `
            <div style="font-size:13px;color:#5C4530;margin-bottom:8px">You logged <strong style="color:#2C1810">${totalEntries}</strong> ${totalEntries === 1 ? 'entry' : 'entries'} this week.</div>
            <div style="font-size:14px;line-height:1.8;color:#2C1810">
              ${lines.map((l) => `<div>${l}</div>`).join('')}
            </div>
          `}
        </div>

        <p style="font-size:13px;color:#5C4530;line-height:1.6">
          Tap below to log this week's entries or check your stats.
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

${quiet
  ? "A quiet week — nothing logged in the last seven days, and that's perfectly alright. Some weeks the homestead just hums along on its own. We'll see you next Sunday."
  : `You logged ${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'} this week.\n\n${lines.map((l) => '- ' + l.replace(/<[^>]+>/g, '')).join('\n')}`}

Open Henalytics: https://henalytics.com

To stop these emails, open Henalytics > Settings > Weekly summary email.
  `.trim();

  return {
    from: FROM_ADDRESS,
    to: [email],
    subject: quiet ? `🐔 A quiet week at ${homesteadName}` : `🐔 This week at ${homesteadName}`,
    html,
    text,
  };
}
