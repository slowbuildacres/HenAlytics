// ============================================================================
// New look (3.0) — "Add your first goat"
// ----------------------------------------------------------------------------
// Milk, weights, health, breeding and the rest are kept per animal, so with an
// empty herd those forms can't be saved. Instead of opening a form with an
// empty picker, the animal pages show this and offer to add the first one.
// noAnimals(hobby) says when the herd is empty.
// ============================================================================

import React from "react";
import { nl, font } from "./theme.js";
import { Sheet, Button } from "./ui.jsx";

// True when the herd has no animals yet (archived ones don't count). Each
// page decides which of its forms need one.
export function noAnimals(hobby) {
  return !((hobby && hobby.animals) || []).some((a) => a && !a.archived);
}

export default function NeedAnimal({ noun = "animal", what, onAdd, onClose }) {
  const a = /^[aeiou]/i.test(noun) ? "an" : "a";
  return (
    <Sheet open onClose={onClose} label={`Add ${a} ${noun} first`} showClose>
      <div style={{ padding: "4px 4px 4px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: font.display, fontSize: 22, color: nl.ink }}>Add your first {noun}</div>
        <div style={{ fontSize: 15, color: nl.soft, lineHeight: 1.5 }}>
          {what ? `${what} is` : "This is"} kept for each {noun}, so add {a} {noun} first. It only takes a name.
        </div>
        <Button onClick={onAdd}>Add {a} {noun}</Button>
        <Button kind="quiet" onClick={onClose}>Not now</Button>
      </div>
    </Sheet>
  );
}
