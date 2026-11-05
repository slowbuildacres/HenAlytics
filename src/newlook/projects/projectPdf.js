// ============================================================================
// 4-H & FFA record book PDF (3.0)
// ----------------------------------------------------------------------------
// A clean, general record book that works for most county 4-H offices: the
// numbered sections match the "Where your PDF comes from" guide, then
// signature lines for the member, a parent and the leader. FFA projects add
// an AET page: the same numbers in the order The AET's forms ask for them,
// so they're quick to type in. jsPDF loads only when someone taps Download.
// ============================================================================

import { kindOf, projectRecord } from "./projectData.js";
import { getPhotoUrl } from "../../sync.js";

const money = (n) => `${n < 0 ? "-" : ""}$${Math.abs(Number(n) || 0).toFixed(2)}`;
const longDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

async function photoData(path) {
  try {
    const url = await getPhotoUrl(path);
    if (!url) return null;
    const blob = await (await fetch(url)).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(blob); });
  } catch (_) { return null; }
}

export async function buildProjectPdf(data, p) {
  const rec = projectRecord(data, p);
  const k = kindOf(p.kind);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 50, CW = W - 2 * M;
  let y = M;
  const ensure = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const rule = (c = 200) => { doc.setDrawColor(c); doc.line(M, y, W - M, y); };
  const para = (t, size = 10.5) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(0);
    for (const ln of doc.splitTextToSize(String(t || ""), CW)) { ensure(15); doc.text(ln, M, y); y += 14; }
    y += 12;
  };
  const blank = (n = 3) => { for (let i = 0; i < n; i++) { ensure(22); y += 18; rule(170); } y += 8; };
  let num = 0;
  const section = (title) => {
    ensure(46); num += 1;
    doc.setFillColor(227, 169, 43); doc.circle(M + 9, y - 4, 9, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(42, 26, 18); doc.text(String(num), M + 9, y - 0.5, { align: "center" });
    doc.setFontSize(13); doc.text(title.toUpperCase(), M + 26, y); y += 8; rule(42); y += 16;
    doc.setTextColor(0);
  };
  const table = (head, rows, widths, right = [], total = null) => {
    const ws = widths.map((w) => w * CW);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(100);
    let x = M;
    head.forEach((h, i) => { doc.text(h.toUpperCase(), right.includes(i) ? x + ws[i] - 4 : x, y, { align: right.includes(i) ? "right" : "left" }); x += ws[i]; });
    y += 5; rule(); y += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(0);
    for (const row of rows) {
      const cells = row.map((c, i) => doc.splitTextToSize(String(c == null ? "" : c), ws[i] - 6));
      const lines = Math.max(...cells.map((c) => c.length || 1));
      ensure(lines * 12 + 4);
      x = M;
      cells.forEach((c, i) => { doc.text(c, right.includes(i) ? x + ws[i] - 4 : x, y, { align: right.includes(i) ? "right" : "left" }); x += ws[i]; });
      y += lines * 12 + 2;
    }
    if (total) { ensure(18); y += 2; rule(160); y += 12; doc.setFont("helvetica", "bold"); doc.text(total[0], M, y); doc.text(total[1], W - M - 4, y, { align: "right" }); doc.setFont("helvetica", "normal"); y += 6; }
    y += 14;
  };
  const none = (t) => { doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(120); ensure(16); doc.text(t, M, y); y += 22; doc.setTextColor(0); doc.setFont("helvetica", "normal"); };

  // Cover block
  doc.setFont("times", "normal"); doc.setFontSize(26); doc.setTextColor(42, 26, 18);
  doc.text(`${p.title || k.label} Project Record`, M, y + 8); y += 30;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(90);
  const who = [p.member, p.age ? `age ${p.age}` : null].filter(Boolean).join(", ");
  const club = [p.club, p.clubName].filter(Boolean).join(" · ");
  doc.text([who, club, `${longDate(p.start)} to ${longDate(p.end)}`, p.club === "FFA" && p.saeType ? `SAE: ${p.saeType}` : null].filter(Boolean).join("   |   "), M, y); y += 22;
  // Summary boxes
  const boxes = [["Income", money(rec.money.income)], ["Expenses", money(rec.money.spent)], ["Net", money(rec.money.net)], ["Hours", String(rec.hours)]];
  const bw = (CW - 30) / 4;
  boxes.forEach(([l, v], i) => {
    const x = M + i * (bw + 10);
    doc.setDrawColor(190); doc.roundedRect(x, y, bw, 50, 6, 6);
    doc.setFontSize(8); doc.setTextColor(110); doc.text(l.toUpperCase(), x + 10, y + 16);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(0); doc.text(v, x + 10, y + 37); doc.setFont("helvetica", "normal");
  });
  y += 74;

  section("Project goals");
  if ((p.goals || "").trim()) para(p.goals); else blank(3);

  section("Animal inventory");
  if (rec.inv.rows.length) table(["Name", "Details"], rec.inv.rows.map((r) => [r.name, r.detail]), [0.35, 0.65], [], [`Total`, `${rec.inv.count} ${rec.inv.word}`]);
  else none("Nothing listed yet.");

  section("Production");
  if (rec.prod.length) table(["What", "Amount"], rec.prod.map((x) => [x.label, x.text]), [0.6, 0.4], [1]);
  else none("Nothing logged yet.");

  section("Expenses");
  if (rec.money.expenses.length) table(["Date", "Item", "Category", "Amount"], rec.money.expenses.map((e) => [longDate(e.date), e.what, e.category, money(e.amount)]), [0.18, 0.42, 0.22, 0.18], [3], ["Total expenses", money(rec.money.spent)]);
  else none("No expenses yet.");

  section("Income");
  if (rec.money.sales.length) table(["Date", "Item", "Buyer", "Amount"], rec.money.sales.map((s) => [longDate(s.date), s.what, s.buyer, money(s.amount)]), [0.18, 0.42, 0.22, 0.18], [3], ["Total income", money(rec.money.income)]);
  else none("No income yet.");
  ensure(20); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(`Net ${rec.money.net >= 0 ? "profit" : "loss"}: ${money(rec.money.net)}`, M, y); y += 24; doc.setFont("helvetica", "normal");

  section("Hours and activities");
  const hrs = rec.logs.filter((l) => l.kind === "hours");
  if (hrs.length) table(["Date", "Activity", "Hours", "Notes"], hrs.map((l) => [longDate(l.date), l.activity || "", String(l.hours || 0), l.note || ""]), [0.18, 0.27, 0.12, 0.43], [], ["Total hours", String(rec.hours)]);
  else none("No hours logged yet.");

  section("Health records");
  if (rec.health.length) table(["Date", "What happened"], rec.health.map((h) => [longDate(h.date), h.what]), [0.2, 0.8]);
  else none("No health logs this year.");

  section("Shows and awards");
  if (rec.shows.length) table(["Date", "Show or fair", "Class", "Placing / award"], rec.shows.map((s) => [longDate(s.date), s.showName || "", s.cls || "", [s.placing, s.award].filter(Boolean).join(" · ")]), [0.18, 0.34, 0.2, 0.28]);
  else none("No shows yet.");

  section("Photos");
  const pics = [];
  for (const ph of rec.photos.slice(0, 6)) { const d = await photoData(ph.path); if (d) pics.push({ ...ph, d }); }
  if (pics.length) {
    const pw = (CW - 20) / 3, ph = pw * 0.75;
    for (let i = 0; i < pics.length; i += 3) {
      ensure(ph + 30);
      pics.slice(i, i + 3).forEach((pic, j) => {
        const x = M + j * (pw + 10);
        try { doc.addImage(pic.d, x, y, pw, ph, undefined, "FAST"); } catch (_) { doc.rect(x, y, pw, ph); }
        doc.setFontSize(8); doc.setTextColor(100); doc.text(doc.splitTextToSize(`${longDate(pic.date)}${pic.caption ? ` · ${pic.caption}` : ""}`, pw)[0] || "", x, y + ph + 11);
      });
      doc.setTextColor(0); y += ph + 26;
    }
  } else none(rec.photos.length ? "Photos are on your logs; sign in to add them here." : "Add photos to your logs and they show up here.");

  section("Project story");
  if ((p.story || "").trim()) para(p.story); else blank(6);

  // Signatures
  ensure(130); y += 10;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Signatures", M, y); y += 26;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90);
  for (const who2 of ["Member", "Parent or guardian", p.club === "FFA" ? "FFA advisor" : "4-H leader"]) {
    doc.setDrawColor(120); doc.line(M, y, M + CW * 0.62, y); doc.line(M + CW * 0.7, y, W - M, y);
    doc.text(who2, M, y + 11); doc.text("Date", M + CW * 0.7, y + 11); y += 36;
  }
  doc.setTextColor(0);

  if (p.club === "FFA") aetPages(doc, p, rec, { M, W, H, CW });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`${p.member ? `${p.member} · ` : ""}${p.title || k.label} · made with Henalytics · page ${i} of ${pages}`, W - M, H - 24, { align: "right" });
  }
  return doc.output("blob");
}

// The AET page: rows in the order AET's journal and financial forms ask.
function aetPages(doc, p, rec, { M, W, H, CW }) {
  doc.addPage();
  let y = M;
  const ensure = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  doc.setFont("times", "normal"); doc.setFontSize(22); doc.text("AET summary", M, y + 6); y += 24;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90);
  doc.text(doc.splitTextToSize("Everything below is in the order The AET asks for it. Work down each list and type the rows in as you go.", CW), M, y); y += 28; doc.setTextColor(0);
  const block = (title, head, rows, widths, right = []) => {
    ensure(40);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(title, M, y); y += 14;
    const ws = widths.map((w) => w * CW);
    doc.setFontSize(8.5); doc.setTextColor(100);
    let x = M; head.forEach((h, i) => { doc.text(h.toUpperCase(), right.includes(i) ? x + ws[i] - 4 : x, y, { align: right.includes(i) ? "right" : "left" }); x += ws[i]; });
    y += 5; doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(0);
    if (!rows.length) { doc.setTextColor(120); doc.text("Nothing yet.", M, y); doc.setTextColor(0); y += 20; return; }
    for (const row of rows) {
      const cells = row.map((c, i) => doc.splitTextToSize(String(c == null ? "" : c), ws[i] - 6));
      const lines = Math.max(...cells.map((c) => c.length || 1));
      ensure(lines * 12 + 4);
      x = M; cells.forEach((c, i) => { doc.text(c, right.includes(i) ? x + ws[i] - 4 : x, y, { align: right.includes(i) ? "right" : "left" }); x += ws[i]; });
      y += lines * 12 + 2;
    }
    y += 16;
  };
  const rows = aetRows(p, rec);
  block("Journal (experiences)", ["Date", "Hours", "Category", "Description"], rows.journal.map((r) => [r.date, r.hours, r.category, r.description]), [0.16, 0.1, 0.24, 0.5], [1]);
  block("Financial: expenses", ["Date", "Description", "Category", "Amount"], rows.expenses.map((r) => [r.date, r.description, r.category, r.amount]), [0.16, 0.44, 0.22, 0.18], [3]);
  block("Financial: income", ["Date", "Description", "Qty", "Amount"], rows.income.map((r) => [r.date, r.description, r.qty, r.amount]), [0.16, 0.5, 0.16, 0.18], [3]);
  block("Inventory (livestock)", ["Item", "Details"], rows.inventory.map((r) => [r.item, r.details]), [0.35, 0.65]);
}

// Shared by the PDF and the in-app AET screen. Dates as MM/DD/YYYY, the way
// AET's date fields take them.
export function aetRows(p, rec) {
  const us = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };
  const amt = (n) => (Number(n) || 0).toFixed(2);
  return {
    journal: rec.logs.filter((l) => l.kind === "hours").map((l) => ({ date: us(l.date), hours: String(l.hours || 0), category: l.activity || "Other", description: l.note || l.activity || "" }))
      .concat(rec.shows.map((s) => ({ date: us(s.date), hours: "", category: "Show or fair", description: [s.showName, s.cls, s.placing, s.award].filter(Boolean).join(", ") }))),
    expenses: rec.money.expenses.map((e) => ({ date: us(e.date), description: e.what, category: e.category, amount: amt(e.amount) })),
    income: rec.money.sales.map((s) => {
      const qty = s.qty != null ? `${s.qty}${s.unit ? ` ${s.unit}` : ""}` : "";
      return { date: us(s.date), description: s.what, qty: qty && !String(s.what).includes(String(s.qty)) ? qty : "", amount: amt(s.amount) };
    }),
    inventory: rec.inv.rows.map((r) => ({ item: r.name, details: r.detail })),
  };
}
