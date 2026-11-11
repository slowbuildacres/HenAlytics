// ============================================================================
// New look (3.0) — Sales & costs
// ----------------------------------------------------------------------------
// From More › Sales & costs. Sold / spent / profit for a period, profit by
// hobby, customers (and the "email your customers" list), then the records:
// every sale and expense, purchase history and the year-end report. The
// numbers come from the same profitStats() the full Sales page uses, and the
// full page (charts, FIFO, backlog, the log, customers) opens underneath via
// "Charts", "Customers" and "Every sale and expense".
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { DollarSign, Users, Mail, ListOrdered, History, FileText, ChevronLeft, Lightbulb } from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Button, Legacy } from "../ui.jsx";
import HobbyGlyph from "../HobbyGlyph.jsx";
import { RangeChips } from "../StatsParts.jsx";
import { showUndo } from "../UndoBar.jsx";
import SalesPage, { AddSaleModal, AddExpenseModal, collectAllSales, computeRevenue, profitStats, removeSale, saleKind } from "../../Sales.jsx";
import { fmtMoney } from "../../units.js";
import { cleanName } from "../hobbies.js";
import { isoDay, prettyDay, parseDay, DAY } from "../eggs/eggFacts.js";
import SalesLog from "./SalesLog.jsx";

const WINDOWS = [
  { key: "month", label: "This month" },
  { key: "year", label: String(new Date().getFullYear()) },
  { key: "twelve_months", label: "12 months" },
  { key: "all", label: "All time" },
];
const money = (v) => fmtMoney(Math.round(Number(v) || 0)).replace(/\.00$/, "");
const ic = (I) => <I size={20} strokeWidth={1.8} />;
const when = (date, today) => {
  if (!date) return "";
  if (date === today) return "today";
  const n = Math.round((parseDay(today) - parseDay(date)) / DAY);
  return n === 1 ? "yesterday" : prettyDay(date);
};

export default function SalesScreen({ data, update, setModal, onCustomers, onEmailCustomers, onPurchaseHistory, onOpenHobby, onBack }) {
  const today = isoDay();
  const [win, setWin] = useState("year");
  const [detail, setDetail] = useState(null);      // null | "charts" | "log" | "customers"
  const [form, setForm] = useState(null);          // "sale" | "expense"
  const [check, setCheck] = useState(null);
  const mode = data.profitMode || "simple";
  const st = useMemo(() => profitStats(data, win, mode), [data, win, mode]);
  const all = useMemo(() => collectAllSales(data), [data]);
  const customers = data.customers || [];
  const label = (WINDOWS.find((w) => w.key === win) || {}).label;

  // Top customer this window (by what they spent).
  const top = useMemo(() => {
    const start = st.window && st.window.start ? st.window.start : null;
    const acc = new Map();
    for (const s of all) {
      if (!s.buyerId || (start && s.date < start)) continue;
      acc.set(s.buyerId, (acc.get(s.buyerId) || 0) + computeRevenue(s));
    }
    const best = [...acc.entries()].sort((a, b) => b[1] - a[1])[0];
    const c = best && customers.find((x) => x.id === best[0]);
    return c ? { name: c.name, spent: best[1] } : null;
  }, [all, customers, st]);

  // Newest sale or expense, for "Last: …".
  const last = useMemo(() => {
    const s = all[0] ? { date: all[0].date, text: `${saleKind(all[0])}, ${fmtMoney(computeRevenue(all[0]))}` } : null;
    const ex = (data.expenses || []).filter((x) => x && x.date && x.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const e = ex ? { date: ex.date, text: `${ex.note || ex.category || "Expense"}, −${fmtMoney(ex.amount)}` } : null;
    return !s ? e : !e ? s : e.date > s.date ? e : s;
  }, [all, data.expenses, today]);

  // "Saved $15 sale · Undo" after either form saves something new.
  const open = (kind) => setForm({ kind, sales: new Set((data.sales || []).map((x) => x.id)), expenses: new Set((data.expenses || []).map((x) => x.id)) });
  const close = () => { if (form) setCheck(form); setForm(null); };
  useEffect(() => {
    if (!check) return;
    setCheck(null);
    const newSales = (data.sales || []).filter((x) => x && !check.sales.has(x.id));
    const newExp = (data.expenses || []).filter((x) => x && !check.expenses.has(x.id));
    if (newSales.length) {
      const ids = newSales.map((x) => x.id);
      showUndo(`Saved ${fmtMoney(computeRevenue(newSales[0]))} sale`, () => update((d) => { ids.forEach((id) => removeSale(d, id)); return d; }));
    } else if (newExp.length) {
      const ids = new Set(newExp.map((x) => x.id));
      showUndo(`Saved ${fmtMoney(newExp[0].amount)} expense`, () => update((d) => { d.expenses = (d.expenses || []).filter((x) => !ids.has(x.id)); return d; }));
    }
  }, [check]); // eslint-disable-line react-hooks/exhaustive-deps

  const forms = (
    <>
      {form && form.kind === "sale" && <AddSaleModal data={data} update={update} onClose={close} />}
      {form && form.kind === "expense" && <AddExpenseModal data={data} update={update} onClose={close} />}
    </>
  );

  if (detail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {forms}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: -10 }}>
          <button type="button" aria-label="Back to Sales & costs" onClick={() => setDetail(null)} style={{ width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
          <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title }}>
            {detail === "log" ? "Every sale and expense" : detail === "customers" ? "Customers" : "Sales charts"}
          </h1>
        </div>
        {detail === "log" ? <SalesLog data={data} update={update} onOpenHobby={onOpenHobby} /> : <Legacy><SalesPage data={data} update={update} embedded focus={detail} /></Legacy>}
      </div>
    );
  }

  const hobbyRows = (st.byHobby || []).filter((h) => h.revenue || h.profit).slice(0, 5);
  const maxAbs = Math.max(1, ...hobbyRows.map((h) => Math.abs(h.profit)));
  const hobbyOf = (h) => (data.hobbies || []).find((x) => x && (x.id === h.hobbyId || x.type === h.hobbyId));
  const empty = !all.length && !(data.expenses || []).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {forms}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: onBack ? -10 : 0 }}>
        {onBack && (
          <button type="button" aria-label="Back to More" onClick={onBack} style={{ width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
        )}
        <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title }}>Sales &amp; costs</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <Button icon={ic(DollarSign)} onClick={() => open("sale")}>Log a sale</Button>
        <Button kind="quiet" onClick={() => open("expense")}>Log an expense</Button>
      </div>

      {empty ? (
        <Card padded>
          <div style={{ fontFamily: font.display, fontSize: 22 }}>Nothing sold yet</div>
          <div style={{ fontSize: 14, color: nl.soft, marginTop: 4, lineHeight: 1.45 }}>
            Log a sale when you sell eggs, honey or produce, and an expense when you buy feed or supplies. Henalytics works out what each hobby makes.
          </div>
        </Card>
      ) : (
        <>
          <RangeChips options={WINDOWS} value={win} onPick={setWin} />
          <Card padded>
            {(() => {
              const cells = [["Sold", st.totalRevenue, nl.ink], ["Spent", st.totalExpenses, nl.ink], ["Profit", st.netProfit, st.netProfit >= 0 ? nl.good : nl.alert]]
                .map(([k, v, c]) => [k, `${v < 0 ? "−" : ""}${money(Math.abs(v))}`, c]);
              // Three across fits up to "$99,999"; bigger amounts get a row
              // each so a number never breaks in the middle.
              const stacked = cells.some(([, t]) => t.length > 8);
              return stacked ? (
                <div style={{ display: "grid", gap: 4 }}>
                  {cells.map(([k, t, c]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                      <span style={{ fontSize: type.small, color: nl.soft }}>{k}</span>
                      <span style={{ fontFamily: font.display, fontSize: 24, lineHeight: 1.2, color: c, whiteSpace: "nowrap" }}>{t}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {cells.map(([k, t, c]) => (
                    <div key={k}>
                      <div style={{ fontSize: type.small, color: nl.soft }}>{k}</div>
                      <div style={{ fontFamily: font.display, fontSize: 26, lineHeight: 1.1, color: c, overflowWrap: "anywhere" }}>{t}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ fontSize: 12, color: nl.soft, marginTop: 10, lineHeight: 1.4 }}>
              {mode === "fifo" ? "FIFO: oldest costs are paid off first by sales." : "Money in and out in this period."} One-time costs like coops and fencing aren't counted.{" "}
              <button type="button" onClick={() => update((d) => { d.profitMode = mode === "fifo" ? "simple" : "fifo"; return d; })}
                style={{ border: "none", background: "none", padding: 0, color: nl.good, font: `600 12px ${font.body}`, cursor: "pointer" }}>
                {mode === "fifo" ? "Use simple math" : "Use FIFO"}
              </button>
            </div>
          </Card>

          {st.totalRevenue > 0 && st.totalExpenses === 0 && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 18, background: nl.goodTint }}>
              <Lightbulb size={20} color={nl.goodInk} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
              <div style={{ fontSize: 13, lineHeight: 1.45 }}><b>Profit is the same as sales</b> because no costs are logged yet. Log feed and supplies to see what you really make.</div>
            </div>
          )}

          {hobbyRows.length > 0 && (
            <Card>
              <CardHeader title="Profit by hobby" right={<Button kind="link" onClick={() => setDetail("charts")}>Charts</Button>} />
              {hobbyRows.map((h) => {
                const hb = hobbyOf(h);
                return (
                  <div key={h.hobbyId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: `1px solid ${nl.rule}` }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.chip, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {hb ? <HobbyGlyph type={hb.type} size={20} /> : ic(DollarSign)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: type.body }}>
                        <span style={{ fontWeight: 600, minWidth: 0 }}>{hb ? cleanName(hb.name) : h.label}</span>
                        <span style={{ fontWeight: 600, color: h.profit >= 0 ? nl.ink : nl.alert, whiteSpace: "nowrap", flexShrink: 0 }}>{h.profit < 0 ? "−" : ""}{money(Math.abs(h.profit))}</span>
                      </span>
                      <span style={{ display: "block", height: 6, borderRadius: 3, background: nl.chip, marginTop: 6, overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${(Math.abs(h.profit) / maxAbs) * 100}%`, background: h.profit >= 0 ? nl.good : nl.alert }} />
                      </span>
                    </span>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}

      <Card>
        <Row first icon={ic(Users)} title={`Customers${customers.length ? ` · ${customers.length}` : ""}`}
          sub={top ? `Top: ${top.name}, ${money(top.spent)} ${win === "all" ? "all time" : label === "This month" ? "this month" : `in ${label === "12 months" ? "12 months" : label}`}` : "Emails, phone numbers and lists, in Orders"}
          onClick={() => (onCustomers ? onCustomers() : setDetail("customers"))} chevron />
        {onEmailCustomers && <Row icon={ic(Mail)} title="Email your customers" sub="Let them know what's in stock" onClick={onEmailCustomers} chevron />}
      </Card>

      <Card>
        <Row first icon={ic(ListOrdered)} title="Every sale and expense" sub={last ? `Last: ${last.text}, ${when(last.date, today)}` : "Nothing logged yet"} onClick={() => setDetail("log")} chevron />
        {onPurchaseHistory && <Row icon={ic(History)} title="Purchase history" sub="When you last bought each thing" onClick={onPurchaseHistory} chevron />}
        <Row icon={ic(FileText)} title="Year-end report" sub="PDF or spreadsheet for your records or taxes" onClick={() => setModal({ type: "yearEndReport" })} chevron />
      </Card>
    </div>
  );
}
