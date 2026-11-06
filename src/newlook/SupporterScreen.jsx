// ============================================================================
// New look (3.0) — Become a Supporter
// ----------------------------------------------------------------------------
// Replaces the old Support popup in the new look. Same purchase paths
// (startCheckout → App Store / Play through RevenueCat, Stripe on the web),
// same tiers, and everything App Review asks for on the purchase screen:
// what the membership includes, auto-renew terms, Restore Purchases,
// Manage Subscription, and the Privacy Policy and Terms of Use links.
// ============================================================================

import React, { useState } from "react";
import { ChevronLeft, Palette, Zap, Trophy, Award, Heart, Check, ChevronRight } from "lucide-react";
import { nl, font, type } from "./theme.js";
import { Card, Badge, Button } from "./ui.jsx";
import { monthName, seasonOf } from "./MonthlyRecap.jsx";
import { progressMonthName } from "./supportProgress.js";

const TIERS = [
  { tier: "monthly_1", amount: 1, label: "Seedling" },
  { tier: "monthly_3", amount: 3, label: "Coffee" },
  { tier: "monthly_5", amount: 5, label: "Sustaining", popular: true },
  { tier: "monthly_10", amount: 10, label: "Generous" },
];

// This month's running costs and how much supporters cover (after store and
// card fees), from /api/support-progress.
function CostsCard({ support }) {
  const month = progressMonthName(support);
  if (!month) return null;
  const { goal, covered, percent, supporters } = support;
  const done = covered >= goal;
  return (
    <Card padded>
      <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: nl.soft, fontWeight: 700 }}>{month} running costs</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        <span style={{ fontFamily: font.display, fontSize: 26, lineHeight: 1.15 }}>{done ? "Covered. Thank you!" : `$${covered.toLocaleString("en-US")} of $${goal.toLocaleString("en-US")}`}</span>
        <span style={{ fontWeight: 700, color: nl.goodInk || nl.good, whiteSpace: "nowrap" }}>{percent}%</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)} aria-label={`${percent}% of ${month}'s running costs covered`}
        style={{ height: 10, borderRadius: 5, background: nl.chip, overflow: "hidden", marginTop: 10 }}>
        <div style={{ width: `${Math.min(100, Math.max(percent > 0 ? 2 : 0, percent))}%`, height: "100%", borderRadius: 5, background: nl.good }} />
      </div>
      <div style={{ fontSize: 14, marginTop: 10, lineHeight: 1.45 }}>
        {supporters > 0
          ? `${done ? `$${covered.toLocaleString("en-US")} of $${goal.toLocaleString("en-US")}, covered` : "Covered"} by ${supporters.toLocaleString("en-US")} supporter${supporters === 1 ? "" : "s"}.`
          : "Nobody has chipped in yet this month. You could be the first."}
      </div>
      <div style={{ fontSize: 12, color: nl.soft, marginTop: 6, lineHeight: 1.45 }}>
        Servers, the plant scanner, email and app store fees, after Apple, Google and card fees. It doesn't count the time that goes into building Henalytics.
      </div>
    </Card>
  );
}

function Perk({ icon: I, title, sub, isNew, onClick, first }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} style={{
      display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", width: "100%", boxSizing: "border-box", textAlign: "left",
      border: "none", borderTop: first ? "none" : `1px solid ${nl.rule}`, background: "transparent", color: nl.ink, font: "inherit", cursor: onClick ? "pointer" : undefined,
    }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: nl.chip, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <I size={18} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: type.body, fontWeight: 600 }}>
          {title}
          {isNew && <span style={{ fontSize: 10, letterSpacing: 1, fontWeight: 700, padding: "3px 7px", borderRadius: 999, background: nl.yolk, color: nl.onYolk, marginLeft: 6, verticalAlign: 2 }}>NEW</span>}
        </span>
        <span style={{ display: "block", fontSize: type.small, color: nl.soft }}>{sub}</span>
      </span>
      {onClick && <ChevronRight size={18} color={nl.soft} strokeWidth={2} style={{ alignSelf: "center" }} aria-hidden="true" />}
    </Tag>
  );
}

const linkStyle = () => ({ background: "none", border: "none", padding: 0, color: nl.good, font: `600 13px ${font.body}`, textDecoration: "underline", cursor: "pointer" });

export default function SupporterScreen({
  isSupporter, recapKey, recapTeaser, recapReady, onBack, onOpenRecap, onLook,
  onCheckout, isIap, onRestore, onManage, onClaim, onContact, onOpenUrl, support = null,
}) {
  const [claimOpen, setClaimOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [claimErr, setClaimErr] = useState("");
  const [busy, setBusy] = useState("");
  const season = seasonOf(recapKey);
  const month = monthName(recapKey);

  const restore = async () => {
    setBusy("restore");
    const r = await onRestore();
    setBusy("");
    if (r === "none") { setClaimOpen(true); setClaimErr(""); }
  };
  const claim = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setClaimErr("Enter the email address from your receipt."); return; }
    setBusy("claim"); setClaimErr("");
    const r = await onClaim(e);
    setBusy("");
    if (r && r.error) setClaimErr(r.error);
    else setClaimOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -10 }}>
        <button type="button" onClick={onBack} aria-label="Back to More" style={{ width: 44, height: 44, border: "none", background: "none", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title, lineHeight: 1.1 }}>{isSupporter ? "You're a Supporter" : "Become a Supporter"}</h1>
      </div>
      <p style={{ margin: "-6px 0 0", fontSize: 14, lineHeight: 1.45, color: nl.soft }}>
        {isSupporter
          ? "Thank you. You're the reason Henalytics stays free for every homestead, including the ones that can't chip in."
          : "Henalytics is free for every homestead. It's built by one homesteader in Kansas, and supporters cover what it costs to run."}
      </p>

      <CostsCard support={support} />

      <button type="button" onClick={onOpenRecap} disabled={!recapReady} style={{
        display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, border: "none", textAlign: "left",
        background: season.b, color: season.text, cursor: recapReady ? "pointer" : "default", font: "inherit",
      }}>
        <span style={{ width: 64, height: 84, borderRadius: 12, background: `linear-gradient(160deg, ${season.a}, ${season.c})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 6px 16px rgba(0,0,0,0.25)", padding: "0 4px", boxSizing: "border-box" }}>
          {recapTeaser ? (
            <>
              <span style={{ fontFamily: font.display, fontSize: recapTeaser.big.length > 4 ? 18 : 24, color: season.accent, lineHeight: 1 }}>{recapTeaser.big}</span>
              <span style={{ fontSize: 8.5, letterSpacing: 0.4, textAlign: "center", marginTop: 3 }}>{recapTeaser.small}</span>
            </>
          ) : <Heart size={26} color={season.accent} strokeWidth={1.8} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 11, letterSpacing: 1.4, fontWeight: 700, color: season.kicker }}>{isSupporter ? "YOUR MONTHLY WRAPPED" : "NEW FOR SUPPORTERS"}</span>
          <span style={{ display: "block", fontFamily: font.display, fontSize: 21, lineHeight: 1.15, marginTop: 2 }}>{isSupporter && recapReady ? `${month} is ready` : "A Wrapped every month"}</span>
          <span style={{ display: "block", fontSize: 13, color: season.soft, marginTop: 2 }}>
            {recapReady
              ? (isSupporter ? "Your month as a story. Tap to watch and share it." : `Your month as a story on the 1st. Tap to see ${month}.`)
              : "Your month as a story on the 1st. Log a few things this month and it shows up here."}
          </span>
        </span>
      </button>

      <Card>
        <Perk first icon={Palette} title="Colors and app icons" isNew sub="Meadow and Barn looks, seasonal app icons" onClick={onLook} />
        <Perk icon={Zap} title="Early access" sub="New hobbies and features about a week early" />
        <Perk icon={Trophy} title="Homestead Standings" sub="Badges and how you compare, in Year in review" />
        <Perk icon={Award} title="Supporter badge and wall" sub="Next to your name, and in the monthly thank-you if you'd like" />
      </Card>
      <div style={{ fontSize: 12.5, color: nl.soft, padding: "0 4px", marginTop: -4 }}>The year-end Homestead Wrapped in December stays free for everyone.</div>

      {isSupporter ? (
        <Card padded style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 20, background: nl.goodTint, color: nl.goodInk, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check size={20} strokeWidth={2.4} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontWeight: 600 }}>Your membership is active</span>
            <span style={{ display: "block", fontSize: 13, color: nl.soft }}>Every perk above is turned on.</span>
          </span>
          <Badge tone="good">Supporter</Badge>
        </Card>
      ) : (
        <>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: nl.soft, fontWeight: 600, margin: "4px 4px 12px" }}>Monthly · same perks at every amount</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {TIERS.map((t) => (
                <button key={t.tier} type="button" onClick={() => onCheckout(t.tier)} aria-label={`$${t.amount} a month, ${t.label}`} style={{
                  position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minHeight: 80, borderRadius: 14, cursor: "pointer",
                  border: t.popular ? `2px solid ${nl.ink}` : `1.5px solid ${nl.field}`, background: t.popular ? nl.yolkTint : nl.card,
                  color: t.popular ? nl.yolkInk : nl.soft, font: `600 12px ${font.body}`, padding: "6px 2px",
                }}>
                  {t.popular && <span style={{ position: "absolute", top: -9, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: nl.ink, color: nl.paper }}>POPULAR</span>}
                  <span style={{ fontFamily: font.display, fontSize: 22, color: t.popular ? nl.yolkInk : nl.ink, lineHeight: 1 }}>${t.amount}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 500 }}>a month</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <Button kind="link" onClick={() => onCheckout("one_time")}>Or leave a one-time $5 tip</Button>
            <div style={{ fontSize: 12, color: nl.soft, lineHeight: 1.45, marginTop: 2 }}>A tip helps just as much. The perks come with the monthly membership.</div>
          </div>
        </>
      )}

      {isIap && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <Button small kind="quiet" onClick={restore} disabled={busy === "restore"}>{busy === "restore" ? "Restoring…" : "Restore purchases"}</Button>
            <Button small kind="quiet" onClick={onManage}>Manage subscription</Button>
          </div>
          <button type="button" onClick={() => { setClaimOpen((o) => !o); setClaimErr(""); }} style={{ ...linkStyle(), color: nl.soft, fontWeight: 500, minHeight: 36 }}>Joined on the website? Link it here</button>
          {claimOpen && (
            <Card padded style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label htmlFor="nl-claim" style={{ fontSize: 13, color: nl.soft, lineHeight: 1.45 }}>Enter the email from your receipt and we'll link that membership to this account.</label>
              <input id="nl-claim" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={email} placeholder="you@example.com"
                onChange={(e) => { setEmail(e.target.value); if (claimErr) setClaimErr(""); }}
                style={{ minHeight: 48, borderRadius: 12, border: `1.5px solid ${nl.field}`, background: nl.card, color: nl.ink, padding: "0 12px", font: `500 16px ${font.body}` }} />
              {claimErr && <div role="alert" style={{ fontSize: 13, color: nl.alertInk }}>{claimErr}</div>}
              <Button kind="dark" small onClick={claim} disabled={busy === "claim"}>{busy === "claim" ? "Linking…" : "Link membership"}</Button>
            </Card>
          )}
        </div>
      )}
      {!isIap && <div style={{ fontSize: 12, color: nl.soft, textAlign: "center" }}>Secure checkout with Stripe. Apple Pay and Google Pay work too.</div>}

      <div style={{ fontSize: 11.5, lineHeight: 1.5, color: nl.soft, padding: "12px 14px", borderRadius: 14, border: `1px solid ${nl.line}`, background: nl.card }}>
        Memberships renew every month at the price you pick until you cancel. You can cancel anytime in your device's subscription settings, at least 24 hours before the renewal date.
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
          <button type="button" style={linkStyle()} onClick={() => onOpenUrl("https://henalytics.com/privacy")}>Privacy Policy</button>
          <button type="button" style={linkStyle()} onClick={() => onOpenUrl("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")}>Terms of Use (EULA)</button>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: nl.soft, textAlign: "center", lineHeight: 1.5, paddingBottom: 8 }}>
        Henalytics has no paywall, and never will. Want to sponsor the app or set up something else?{" "}
        <button type="button" style={{ ...linkStyle(), fontSize: 12.5 }} onClick={onContact}>Get in touch</button>
      </div>
    </div>
  );
}
