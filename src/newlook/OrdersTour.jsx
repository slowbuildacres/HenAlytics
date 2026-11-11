// ============================================================================
// Orders tour — "Your farm can take orders now" (shown once after the update)
// ----------------------------------------------------------------------------
// Most people would never think to open Orders, so after the update this
// walks through what it does in five swipeable cards, each with a small
// picture of the real thing filled in with the homestead's own name and farm
// stand items. Ends on "Set up my order page".
//
// Shown once (data.tours.orders) to people who haven't turned on an order
// page yet; replayable from the Orders screen.
// ============================================================================

import React, { useRef, useState } from "react";
import { ChevronLeft, ShoppingBag, QrCode, Link2, MessageSquare, Receipt, Check, Lock, Bell, Users } from "lucide-react";
import { nl, font } from "./theme.js";

// Styles are built at render time so they follow the current theme (light/dark).
const h1 = () => ({ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: 32, lineHeight: 1.1, color: nl.ink });
const lead = () => ({ fontSize: 16, lineHeight: 1.5, color: nl.ink, margin: 0 });
const soft = () => ({ fontSize: 15, lineHeight: 1.5, color: nl.soft, margin: 0 });
const cta = () => ({ width: "100%", minHeight: 54, borderRadius: 16, border: "none", background: nl.yolk, color: nl.onYolk, font: `700 16px ${font.body}`, cursor: "pointer" });
const card = () => ({ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 20, padding: 14, boxShadow: "0 6px 20px rgba(0,0,0,0.06)" });
const pill = (bg, fg) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, background: bg, color: fg, fontSize: 13, fontWeight: 600 });
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

function Perk({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.chip, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={19} strokeWidth={2} aria-hidden="true" /></span>
      <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{children}</span>
    </div>
  );
}

// The customer's view of the order page, with this homestead's items.
function OrderPagePic({ farm, items }) {
  return (
    <div style={{ ...card(), padding: 0, overflow: "hidden" }} aria-hidden="true">
      <div style={{ padding: "8px 14px", background: nl.chip, fontSize: 12, color: nl.soft, display: "flex", alignItems: "center", gap: 6 }}><Lock size={12} />henalytics.com/o/…</div>
      <div style={{ padding: 14 }}>
        <div style={{ fontFamily: font.display, fontSize: 22 }}>{farm}</div>
        <div style={{ fontSize: 13, color: nl.soft, marginBottom: 8 }}>Request an order · pick up Saturday</div>
        {items.map((it, i) => (
          <div key={it.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? `1px solid ${nl.rule}` : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
              <div style={{ fontSize: 13, color: nl.soft }}>{money(it.price)}{it.unit ? ` a ${it.unit}` : ""}</div>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${nl.line}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>−</span>
              <b style={{ width: 14, textAlign: "center" }}>{i === 0 ? 2 : 0}</b>
              <span style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${nl.line}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>+</span>
            </span>
          </div>
        ))}
        <div style={{ marginTop: 10, minHeight: 42, borderRadius: 12, background: nl.yolk, color: nl.onYolk, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>Send my request</div>
      </div>
    </div>
  );
}

function QrPic({ farm }) {
  // A simple stand-in QR pattern (decorative)
  const cells = [];
  let s = 7;
  for (let i = 0; i < 81; i++) { s = (s * 31 + 17) % 101; cells.push(s % 3 === 0); }
  const finder = (r, c) => (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }} aria-hidden="true">
      <div style={{ ...card(), flex: 1, textAlign: "center", background: "#FAF5EA", color: "#2C1810", border: "1px solid #2C181022" }}>
        <div style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.15 }}>Order from<br />{farm}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 2, width: 108, margin: "10px auto" }}>
          {cells.map((on, i) => {
            const r = Math.floor(i / 9), c = i % 9;
            return <span key={i} style={{ aspectRatio: "1", borderRadius: 2, background: finder(r, c) || on ? "#2C1810" : "transparent" }} />;
          })}
        </div>
        <div style={{ fontSize: 12, color: "#5C4530" }}>Scan with your phone camera</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
        <span style={pill(nl.chip, nl.ink)}><QrCode size={15} />Print a sign</span>
        <span style={pill(nl.chip, nl.ink)}><Link2 size={15} />Share the link</span>
        <span style={pill(nl.chip, nl.ink)}><MessageSquare size={15} />Post it anywhere</span>
      </div>
    </div>
  );
}

function PayPic({ total }) {
  return (
    <div style={{ ...card(), display: "flex", flexDirection: "column", gap: 10 }} aria-hidden="true">
      <div style={{ fontSize: 13, fontWeight: 600, color: nl.soft }}>How will you pay?</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["Venmo", "Cash App", "PayPal", "Zelle", "Cash"].map((m, i) => (
          <span key={m} style={pill(i === 0 ? nl.goodTint : nl.chip, i === 0 ? nl.goodInk : nl.ink)}>{i === 0 && <Check size={14} />}{m}</span>
        ))}
      </div>
      <div style={{ minHeight: 44, borderRadius: 12, background: nl.yolk, color: nl.onYolk, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>Pay {money(total)} on Venmo</div>
      <div style={{ fontSize: 13, color: nl.soft }}>Opens their app with your name and the amount filled in.</div>
    </div>
  );
}

function TextPic({ farm }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-hidden="true">
      <div style={{ ...card(), padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <b style={{ fontSize: 15 }}>Ann</b>
          <span style={pill(nl.goodTint, nl.goodInk)}>Customer</span>
          <span style={{ marginLeft: "auto", ...pill(nl.yolkTint, nl.yolkInk) }}>New</span>
        </div>
        <div style={{ fontSize: 14, margin: "6px 0 10px" }}>2 dozen eggs · wants it Sat</div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ ...pill(nl.ink, nl.paper), padding: "8px 14px" }}>Accept</span>
          <span style={{ ...pill("transparent", nl.ink), border: `1.5px solid ${nl.field}`, padding: "7px 13px" }}>It's ready</span>
        </div>
      </div>
      <div style={{ alignSelf: "flex-end", maxWidth: "82%", background: "#2F7CF6", color: "#fff", borderRadius: "18px 18px 4px 18px", padding: "9px 13px", fontSize: 14, lineHeight: 1.35 }}>
        Hi Ann, your order from {farm} is ready to pick up!
      </div>
      <div style={{ fontSize: 13, color: nl.soft, textAlign: "right" }}>Sent from your own phone</div>
    </div>
  );
}

function SalesPic({ total, cost }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-hidden="true">
      <div style={{ ...card(), display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, background: nl.goodTint, color: nl.goodInk, display: "flex", alignItems: "center", justifyContent: "center" }}><Receipt size={20} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Picked up. {money(total)} added to Sales</div>
          <div style={{ fontSize: 13, color: nl.soft }}>Cost {money(cost)} · about {money(total - cost)} profit</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={pill(nl.chip, nl.ink)}><Bell size={14} />Today's pickups on Home</span>
        <span style={pill(nl.chip, nl.ink)}>Sold out shows itself</span>
        <span style={pill(nl.chip, nl.ink)}><Users size={14} />Customers in one place</span>
      </div>
    </div>
  );
}

export default function OrdersTour({ data, onSetUp, onDone }) {
  const [step, setStep] = useState(0);
  const farm = String(((data && data.stockEmailSettings) || {}).fromName || (data && data.homesteadName) || "").trim() || "Your farm";
  const stand = (((data && data.hobbies) || []).find((h) => h && h.id === "farmstand") || {}).items || [];
  const fromStand = stand.filter((i) => i && i.name && !i.archived && Number(i.pricePerUnit) > 0).slice(0, 2)
    .map((i) => ({ name: String(i.name).slice(0, 28), price: Number(i.pricePerUnit), unit: String(i.unit || "").slice(0, 12) }));
  const items = fromStand.length >= 2 ? fromStand : [{ name: "Farm fresh eggs", price: 6, unit: "dozen" }, { name: "Sourdough loaf", price: 10, unit: "loaf" }];
  const total = items[0].price * 2;
  const cost = Math.round(total * 0.35 * 100) / 100;
  const startX = useRef(null);
  const STEPS = 5;
  const last = step === STEPS - 1;
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (dx < -50) next(); else if (dx > 50) back();
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Take orders from your customers" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{
      position: "fixed", inset: 0, zIndex: 300, background: nl.paper, color: nl.ink, fontFamily: font.body,
      overflowY: "auto", paddingTop: "env(safe-area-inset-top)",
    }}>
      <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100%", boxSizing: "border-box", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", minHeight: 44 }}>
          {step > 0 && (
            <button type="button" aria-label="Back" onClick={back} style={{ width: 44, height: 44, marginLeft: -12, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={24} strokeWidth={2} />
            </button>
          )}
          {!last && <button type="button" onClick={onDone} style={{ marginLeft: "auto", background: "none", border: "none", minHeight: 44, padding: "0 4px", cursor: "pointer", color: nl.soft, font: `600 15px ${font.body}` }}>Skip</button>}
        </div>

        {step === 0 && (
          <>
            <span style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 700, letterSpacing: 1, padding: "5px 10px", borderRadius: 999, background: nl.yolkTint, color: nl.yolkInk }}>NEW · ORDERS</span>
            <h1 style={h1()}>{farm === "Your farm" ? "Your farm" : farm} can take orders now</h1>
            <p style={lead()}>Customers pick what they want from your own order page. You see every request in Henalytics, and nobody has to chase you down by text again.</p>
            <OrderPagePic farm={farm} items={items} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 18, background: nl.ink, color: nl.paper, display: "flex", alignItems: "center", justifyContent: "center", font: `700 13px ${font.body}`, flexShrink: 0 }}>RL</span>
              <div style={{ fontSize: 14, color: nl.soft, lineHeight: 1.4 }}>"This is the update I'm most excited about. It's built for how we actually sell: at the stand, on the porch, to neighbors." · Riley</div>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h1 style={h1()}>Share a link or tape up a sign</h1>
            <p style={soft()}>Henalytics makes a printable QR sign for your stand. Customers scan it and order from their phone, even when you're not there. No app or account needed on their end.</p>
            <QrPic farm={farm} />
          </>
        )}
        {step === 2 && (
          <>
            <h1 style={h1()}>Get paid your way</h1>
            <p style={soft()}>Add your Venmo, Cash App, PayPal or Zelle, or take cash and checks. Customers get a pay button with the amount already filled in. The money goes straight to you. Henalytics never touches it.</p>
            <PayPic total={total} />
          </>
        )}
        {step === 3 && (
          <>
            <h1 style={h1()}>Accept, mark ready, text them</h1>
            <p style={soft()}>One tap accepts an order or marks it ready, and they get an email. Want to text instead? Your phone opens with the message already written. Text a whole list about what's fresh, too.</p>
            <TextPic farm={farm} />
          </>
        )}
        {step === 4 && (
          <>
            <h1 style={h1()}>Picked up? It's already in Sales</h1>
            <p style={soft()}>Mark an order picked up and the sale is logged for you, with your private cost so you see real profit. Farm stand stock goes down, and "Sold out" shows on your page by itself.</p>
            <SalesPic total={total} cost={cost} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              <Perk icon={ShoppingBag}>Free, no fees, nothing to install for customers</Perk>
              <Perk icon={Lock}>Your costs stay private. Customers only see prices.</Perk>
            </div>
          </>
        )}

        <div style={{ marginTop: "auto", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12, paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div aria-label={`Step ${step + 1} of ${STEPS}`} style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {Array.from({ length: STEPS }, (_, i) => (
              <button key={i} type="button" aria-label={`Go to step ${i + 1}`} onClick={() => setStep(i)} style={{ width: i === step ? 22 : 8, height: 8, padding: 0, borderRadius: 4, border: "none", cursor: "pointer", background: i === step ? nl.ink : nl.field }} />
            ))}
          </div>
          {last
            ? <>
                <button type="button" style={cta()} onClick={onSetUp}>Set up my order page</button>
                <button type="button" onClick={onDone} style={{ background: "none", border: "none", minHeight: 40, cursor: "pointer", color: nl.soft, font: `600 15px ${font.body}` }}>Maybe later</button>
                <span style={{ textAlign: "center", fontSize: 13, color: nl.soft }}>It's in More › Orders &amp; customers whenever you're ready</span>
              </>
            : <button type="button" style={cta()} onClick={next}>{step === 0 ? "Show me how it works" : "Next"}</button>}
        </div>
      </div>
    </div>
  );
}
