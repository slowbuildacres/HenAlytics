// ============================================================================
// Is this the same customer? One answer for orders, sign-ups and the list
// ----------------------------------------------------------------------------
// People get into data.customers several ways: added by hand (often just a
// name and a phone), named as a buyer in Sales or a hobby, pasted in, or
// saved from an order or a sign-up (always with an email). Matching only on
// email made a second copy whenever someone added by hand later ordered.
//
// A person is the same customer when, in this order:
//   1. the email matches (any case, spaces trimmed), or
//   2. the phone matches (last 10 digits, at least 7), or
//   3. the name matches (any case, extra spaces ignored) and the saved one
//      has no email yet, or the same one.
// Two saved customers with the same name and different emails stay two.
//
// mergeCustomers() folds copies into one: the first keeps its id, gains the
// others' email, phone, lists and notes, and their sales and log entries
// point at it (buyerId).
// Pure functions; mergeCustomers() changes an update() draft.
// ============================================================================

const cleanEmail = (e) => String(e || "").trim().toLowerCase();
const cleanName = (n) => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();
const phoneKey = (p) => { const d = String(p || "").replace(/[^0-9]/g, ""); return d.length >= 7 ? d.slice(-10) : ""; };

// who: { email, phone, name } (an order uses customer_name).
export function matchCustomer(customers, who) {
  const list = (Array.isArray(customers) ? customers : []).filter((c) => c && typeof c === "object");
  const em = cleanEmail(who && who.email);
  const ph = phoneKey(who && who.phone);
  const nm = cleanName(who && (who.name != null ? who.name : who.customer_name));
  return (em && list.find((c) => cleanEmail(c.email) === em))
    || (ph && list.find((c) => phoneKey(c.phone) === ph && (!em || !cleanEmail(c.email) || cleanEmail(c.email) === em)))
    || (nm && list.find((c) => cleanName(c.name) === nm && (!cleanEmail(c.email) || !em || cleanEmail(c.email) === em)))
    || null;
}

// Sets of saved customers that look like one person: [[keep, ...copies]].
// Same rules as matchCustomer, oldest first (the one already in Sales wins).
export function findDuplicates(customers) {
  const list = (Array.isArray(customers) ? customers : []).filter((c) => c && c.id);
  const parent = new Map(list.map((c) => [c.id, c.id]));
  const root = (id) => { let r = id; while (parent.get(r) !== r) r = parent.get(r); return r; };
  const join = (a, b) => { const ra = root(a.id); const rb = root(b.id); if (ra !== rb) parent.set(rb, ra); };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]; const b = list[j];
      const ea = cleanEmail(a.email); const eb = cleanEmail(b.email);
      const emailsAgree = !ea || !eb || ea === eb;
      if ((ea && ea === eb)
        || (phoneKey(a.phone) && phoneKey(a.phone) === phoneKey(b.phone) && emailsAgree)
        || (cleanName(a.name) && cleanName(a.name) === cleanName(b.name) && emailsAgree)) join(a, b);
    }
  }
  const groups = new Map();
  list.forEach((c) => { const r = root(c.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
  // A set only counts if it can be one person: at most one email in it.
  return [...groups.values()].filter((g) => g.length > 1 && new Set(g.map((c) => cleanEmail(c.email)).filter(Boolean)).size <= 1);
}

// Folds the copies into keepId, in place on the draft. Returns the kept one.
export function mergeCustomers(d, keepId, copyIds) {
  if (!Array.isArray(d.customers)) return null;
  const keep = d.customers.find((c) => c && c.id === keepId);
  const ids = new Set((copyIds || []).filter((id) => id && id !== keepId));
  if (!keep || !ids.size) return keep || null;
  d.customers.filter((c) => c && ids.has(c.id)).forEach((c) => {
    if (!cleanEmail(keep.email) && cleanEmail(c.email)) keep.email = cleanEmail(c.email);
    if (!phoneKey(keep.phone) && phoneKey(c.phone)) keep.phone = c.phone;
    if (c.textOk === true && phoneKey(keep.phone)) keep.textOk = true;
    if (c.emailOk === false) keep.emailOk = false;
    keep.groups = Array.from(new Set([...(Array.isArray(keep.groups) ? keep.groups : []), ...(Array.isArray(c.groups) ? c.groups : [])]));
    const note = String(c.note || "").trim();
    // "From an order" and the like say nothing the kept one needs.
    if (note && !/^(from an order|joined from your order page)$/i.test(note) && !String(keep.note || "").includes(note)) keep.note = [String(keep.note || "").trim(), note].filter(Boolean).join(" · ").slice(0, 300);
  });
  d.customers = d.customers.filter((c) => !(c && ids.has(c.id)));
  const repoint = (x) => { if (x && ids.has(x.buyerId)) x.buyerId = keepId; };
  (Array.isArray(d.sales) ? d.sales : []).forEach(repoint);
  Object.values(d.entries && typeof d.entries === "object" ? d.entries : {}).forEach((list) => { if (Array.isArray(list)) list.forEach(repoint); });
  return keep;
}
