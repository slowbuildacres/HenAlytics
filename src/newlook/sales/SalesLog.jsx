// ============================================================================
// New look (3.0) — Every sale and expense
// ----------------------------------------------------------------------------
// One timeline, newest first, grouped by month with the month's totals.
// Tap a sale or expense to edit it (the same forms as everywhere else);
// the trash button deletes it with Undo. Costs logged on a hobby's page
// (feed, bedding, bought birds…) show too, so the log adds up to the totals,
// but they're edited on that hobby, so here they only open the hobby.
// ============================================================================

import React, { useMemo, useState } from "react";
import { Trash2, Search, Repeat, DollarSign } from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, Chip, Button } from "../ui.jsx";
import HobbyGlyph from "../HobbyGlyph.jsx";
import { showUndo, undoable } from "../UndoBar.jsx";
import { AddSaleModal, AddExpenseModal, collectAllSales, computeRevenue, removeSale, saleKind, expandRecurringExpenses } from "../../Sales.jsx";
import { extractHobbyExpenses, extractBuildCosts } from "../../expenseFifo.js";
import { fmtMoney } from "../../units.js";
import { cleanName } from "../hobbies.js";
import { isoDay, prettyDay } from "../eggs/eggFacts.js";

const SALE_HOBBY = { eggs: "egg_layers", honey: "bees", horse: "horses", cow: "cows", goat: "goats", pig: "pigs", dog: "dogs", cat: "cats", rabbit: "rabbits" };
const ENTRY_LABEL = { fed: "Feed", bedding: "Bedding", fertilized: "Fertilizer", supplies: "Supplies", restock: "Restock", flock_purchase: "Birds", chick_purchase: "Chicks", hive_purchase: "Hive", animal_purchase: "Animal", infrastructure: "Building and equipment" };
const money2 = (v) => fmtMoney(Number(v) || 0);
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }); };

export default function SalesLog({ data, update, onOpenHobby }) {
  const today = isoDay();
  const [show, setShow] = useState("all"); // all | sales | expenses
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(6);   // months shown
  const [editing, setEditing] = useState(null); // { kind:"sale", sale } | { kind:"expense", expense, occurrenceDate }
  const customers = data.customers || [];
  const hobbyById = (id) => (data.hobbies || []).find((h) => h && h.id === id);
  const hobbyForSale = (s) => (s.hobbyId && hobbyById(s.hobbyId)) || (data.hobbies || []).find((h) => h && h.type === (SALE_HOBBY[s.hobbyType] || s.hobbyType));

  const rows = useMemo(() => {
    const out = [];
    for (const s of collectAllSales(data)) {
      if (!s || !s.date) continue;
      const cust = customers.find((c) => c.id === s.buyerId);
      const h = hobbyForSale(s);
      out.push({ key: `s:${s.id}`, kind: "sale", date: s.date, amount: computeRevenue(s) + (Number(s.tip) || 0), title: saleKind(s), sub: [cust ? cust.name : s.customerName, s.note].filter(Boolean).join(" · "), glyph: h ? h.type : null, hobby: h ? cleanName(h.name) : "", sale: s });
    }
    for (const e of expandRecurringExpenses(data.expenses || [])) {
      if (!e || !e.date || e.date > today) continue;
      const h = hobbyById(e.hobbyId);
      out.push({ key: `e:${e._occKey || e.id}`, kind: "expense", date: e.date, amount: Number(e.amount) || 0, title: e.description || e.note || e.category || "Expense", sub: [e.category && (e.description || e.note) ? e.category : null, h ? cleanName(h.name) : null].filter(Boolean).join(" · "), glyph: h ? h.type : null, hobby: h ? cleanName(h.name) : "", recurring: !!e._parentId, expense: e });
    }
    for (const h of data.hobbies || []) {
      if (!h) continue;
      [...extractHobbyExpenses(data, h.id), ...extractBuildCosts(data, h.id)].forEach((r, i) => {
        if (!r || r.source === "logged_expense" || !r.date || r.date > today || !(Number(r.cost) > 0)) return;
        out.push({ key: `x:${h.id}:${r.date}:${r.source}:${i}`, kind: "expense", date: r.date, amount: Number(r.cost) || 0, title: ENTRY_LABEL[r.source] || "Expense", sub: [r.note, cleanName(h.name)].filter(Boolean).join(" · "), glyph: h.type, hobby: cleanName(h.name), fromHobby: h });
      });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [data, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => (show === "all" || (show === "sales" ? r.kind === "sale" : r.kind === "expense"))
    && (!needle || `${r.title} ${r.sub} ${r.hobby}`.toLowerCase().includes(needle)));
  const months = [];
  for (const r of shown) {
    const k = r.date.slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.key !== k) { m = { key: k, rows: [], sold: 0, spent: 0 }; months.push(m); }
    m.rows.push(r);
    if (r.kind === "sale") m.sold += r.amount; else m.spent += r.amount;
  }

  const del = (r) => {
    if (r.kind === "sale") {
      // Deleting a sale can also bring back a sold animal or put jars and
      // tins back on their batch, so Undo puts back everything it changed.
      undoable(update, `Deleted ${fmtMoney(r.amount)} sale`)((d) => removeSale(d, r.sale.id));
    } else if (r.expense && !r.recurring) {
      const ex = r.expense;
      update((d) => { d.expenses = (d.expenses || []).filter((x) => x.id !== ex.id); return d; });
      showUndo(`Deleted ${fmtMoney(r.amount)} expense`, () => update((d) => { d.expenses = [...(d.expenses || []), ex]; return d; }));
    }
  };
  const openRow = (r) => {
    if (r.fromHobby) { onOpenHobby && onOpenHobby(r.fromHobby); return; }
    if (r.kind === "sale") setEditing({ kind: "sale", sale: r.sale });
    else if (r.recurring) setEditing({ kind: "expense", expense: (data.expenses || []).find((x) => x.id === r.expense._parentId), occurrenceDate: r.date });
    else setEditing({ kind: "expense", expense: (data.expenses || []).find((x) => x.id === r.expense.id) || r.expense });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {editing && editing.kind === "sale" && <AddSaleModal data={data} update={update} existingSale={editing.sale} onClose={() => setEditing(null)} />}
      {editing && editing.kind === "expense" && editing.expense && <AddExpenseModal data={data} update={update} existingExpense={editing.expense} occurrenceDate={editing.occurrenceDate} onClose={() => setEditing(null)} />}

      <div role="radiogroup" aria-label="Show" style={{ display: "flex", gap: 8 }}>
        {[["all", "Everything"], ["sales", "Sales"], ["expenses", "Expenses"]].map(([k, l]) => <Chip key={k} selected={show === k} onClick={() => setShow(k)}>{l}</Chip>)}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 12px", borderRadius: 14, border: `1.5px solid ${nl.field}`, background: nl.card }}>
        <Search size={18} color={nl.soft} strokeWidth={2} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by item, customer or hobby" aria-label="Search sales and expenses"
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: nl.ink, font: `500 15px ${font.body}`, minHeight: 40 }} />
      </label>

      {!months.length && <Card padded style={{ fontSize: 14, color: nl.soft }}>{rows.length ? "Nothing matches that." : "Nothing logged yet."}</Card>}
      {months.slice(0, limit).map((m) => (
        <Card key={m.key}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "14px 14px 8px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: font.display, fontSize: type.section }}>{monthLabel(m.key)}</span>
            <span style={{ fontSize: 13, color: nl.soft }}>
              {m.sold > 0 && <span style={{ color: nl.good, fontWeight: 600 }}>+{money2(m.sold)}</span>}
              {m.sold > 0 && m.spent > 0 && " · "}
              {m.spent > 0 && <span>−{money2(m.spent)}</span>}
            </span>
          </div>
          {m.rows.map((r) => (
            <div key={r.key} style={{ display: "flex", alignItems: "center", borderTop: `1px solid ${nl.rule}` }}>
              <button type="button" onClick={() => openRow(r)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "10px 4px 10px 14px", minHeight: 56, border: "none", background: "none", color: nl.ink, textAlign: "left", font: "inherit", cursor: "pointer" }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: r.kind === "sale" ? nl.goodTint : nl.chip, color: r.kind === "sale" ? nl.goodInk : nl.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {r.glyph ? <HobbyGlyph type={r.glyph} size={18} strokeWidth={1.9} /> : <DollarSign size={18} strokeWidth={1.9} aria-hidden="true" />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 15, fontWeight: 600, overflowWrap: "anywhere" }}>
                    {r.title}{r.recurring && <Repeat size={13} color={nl.soft} strokeWidth={2.2} aria-label="repeats" />}
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: nl.soft, overflowWrap: "anywhere" }}>{[prettyDay(r.date), r.sub].filter(Boolean).join(" · ")}</span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", color: r.kind === "sale" ? nl.good : nl.ink }}>{r.kind === "sale" ? "+" : "−"}{money2(r.amount)}</span>
              </button>
              {(r.kind === "sale" || (r.expense && !r.recurring)) ? (
                <button type="button" aria-label={`Delete ${r.title}`} onClick={() => del(r)} style={{ width: 44, height: 44, marginRight: 4, border: "none", background: "none", color: nl.soft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Trash2 size={17} strokeWidth={1.8} />
                </button>
              ) : <span style={{ width: 48, flexShrink: 0 }} />}
            </div>
          ))}
        </Card>
      ))}
      {months.length > limit && <Button kind="quiet" onClick={() => setLimit((n) => n + 6)}>Show older months</Button>}
      <div style={{ fontSize: 12.5, color: nl.soft, padding: "0 4px" }}>Costs like feed, bought birds and building or equipment that you logged on a hobby's page show here too. Tap one to open that hobby and change it.</div>
    </div>
  );
}
