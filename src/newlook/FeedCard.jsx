// ============================================================================
// New look (3.0) — feed supply card (any animal hobby with a feed tracker)
// ----------------------------------------------------------------------------
// "About 9 days of feed left" from the same computeFeedStatus the old
// FeedTrackerCard used, a link to the purchase history, or (before it is set
// up) a dismissible "Track your feed supply" row.
// ============================================================================

import React from "react";
import { Wheat, History, X } from "lucide-react";
import { nl } from "./theme.js";
import { Card, Row, Button } from "./ui.jsx";
import { computeFeedStatus } from "../feedSupply.js";
import { prettyDay } from "./eggs/eggFacts.js";

export default function FeedCard({ hobby, entries, update, setModal, eatWord = "they eat" }) {
  const feed = computeFeedStatus(hobby, entries || []);
  const ft = hobby.feedTracker || {};
  if (feed) {
    const low = feed.state === "low" || feed.state === "out";
    return (
      <Card>
        <Row first tint={low ? nl.alertTint : undefined}
          icon={<Wheat size={20} strokeWidth={1.8} />} iconBg={low ? nl.alertChip : undefined}
          title={feed.state === "learning" ? `Learning how fast ${eatWord}` : feed.state === "out" ? "Out of feed" : `About ${Math.max(1, Math.round(feed.daysLeft))} days of feed left`}
          sub={feed.state === "learning"
            ? `${Math.max(0, Math.round(feed.remainingLbs))} lbs on hand · a few more feedings to estimate`
            : `${Math.max(0, Math.round(feed.remainingLbs))} lbs on hand${feed.runOutDate ? ` · runs out around ${prettyDay(feed.runOutDate)}` : ""}`}
          trailing={<Button kind="link" onClick={() => setModal({ type: "feedTracker", hobbyId: hobby.id })}>Update</Button>} />
        <Row icon={<History size={20} strokeWidth={1.8} />} title="When did I last buy feed?" onClick={() => setModal({ type: "purchases" })} chevron />
      </Card>
    );
  }
  if (ft.promptDismissed) return null;
  return (
    <Card>
      <Row first icon={<Wheat size={20} strokeWidth={1.8} />} title="Track your feed supply" sub="Get a heads-up before you run out"
        trailing={<span style={{ display: "flex", alignItems: "center", gap: 2 }}><Button kind="link" onClick={() => setModal({ type: "feedTracker", hobbyId: hobby.id })}>Set up</Button><button type="button" aria-label="Dismiss feed tracking" onClick={(e) => { e.stopPropagation(); update((d) => { const h = d.hobbies.find((x) => x.id === hobby.id); if (h) h.feedTracker = { ...(h.feedTracker || {}), enabled: false, promptDismissed: true }; return d; }); }}
          style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer", color: nl.soft, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button></span>} />
    </Card>
  );
}
