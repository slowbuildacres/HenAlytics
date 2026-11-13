// ============================================================================
// Sales that took something off a shelf, kept in step when they change
// ----------------------------------------------------------------------------
// Selling from a batch lowers what's left on it:
//   salve      batch.tinsRemaining
//   tincture   batch.bottlesRemaining      (oil_infusion the same)
//   tea        batch.sachetsRemaining, or bulkRemainingOz when sold by the oz
//   canning    batch.jarsRemaining (sale.fromCanningBatchId), plus a "sale"
//              log in entries.canning
//   farmstand  item.stock, for a sale rung up on the stand (fromFarmstandItem;
//              not an order's sale, which takes stock its own way)
// (Soap works out its bars from the sales themselves, so it needs nothing.)
// Deleting such a sale in Sales, or changing how many, used to leave the
// shelf count as it was. Deleting the log from the Journal left the money in
// Sales. These put things back. Pure functions on an update() draft.
// ============================================================================

import { undoAnimalSale } from "./animalSale.js";

const FIELD = { salve: "tinsRemaining", tincture: "bottlesRemaining", oil_infusion: "bottlesRemaining" };

function hobbyFor(d, sale, type) {
  const list = Array.isArray(d.hobbies) ? d.hobbies : [];
  return (sale.hobbyId && list.find((h) => h && h.id === sale.hobbyId)) || list.find((h) => h && h.type === type) || null;
}

// Puts qty back on the batch the sale came from (a negative qty takes more).
export function restockForSale(d, sale, qty) {
  const n = Number(qty) || 0;
  if (!d || !sale || !n) return;
  if (sale.hobbyType === "canning" && sale.fromCanningBatchId) {
    const h = hobbyFor(d, sale, "canning");
    const b = h && Array.isArray(h.batches) ? h.batches.find((x) => x && x.id === sale.fromCanningBatchId) : null;
    if (b) b.jarsRemaining = Math.max(0, (Number(b.jarsRemaining) || 0) + n);
    return;
  }
  // A sale rung up on the farm stand took its stock (an order's sale didn't:
  // the order handles stock itself, so leave those alone).
  if (sale.hobbyType === "farmstand" && sale.fromFarmstandItem && !sale.fromOrder) {
    const h = (Array.isArray(d.hobbies) ? d.hobbies : []).find((x) => x && x.type === "farmstand");
    const it = h && Array.isArray(h.items) ? h.items.find((x) => x && x.id === sale.fromFarmstandItem) : null;
    // Not floored: the stand lets stock go below zero on purpose.
    if (it && it.trackStock) it.stock = Math.round(((Number(it.stock) || 0) + n) * 100) / 100;
    return;
  }
  if (!sale.batchId) return;
  const field = sale.hobbyType === "tea" ? (sale.gardenUnit === "oz" ? "bulkRemainingOz" : "sachetsRemaining") : FIELD[sale.hobbyType];
  if (!field) return;
  const h = hobbyFor(d, sale, sale.hobbyType);
  const b = h && Array.isArray(h.batches) ? h.batches.find((x) => x && x.id === sale.batchId) : null;
  if (b) b[field] = Math.max(0, (Number(b[field]) || 0) + n);
}

// The canning "sale" log that goes with a canning sale.
function canningLogIndex(list, sale) {
  let i = sale.fromCanningEntryId ? list.findIndex((e) => e && e.id === sale.fromCanningEntryId) : -1;
  if (i < 0) i = list.findIndex((e) => e && e.action === "sale" && e.batchId === sale.fromCanningBatchId && e.date === sale.date && Number(e.qty) === Number(sale.qty));
  return i;
}

// A sale is being deleted from Sales: shelf back, and its canning log goes.
export function unwindShelfSale(d, sale) {
  if (!d || !sale) return;
  restockForSale(d, sale, sale.qty);
  if (sale.hobbyType === "canning" && sale.fromCanningBatchId && d.entries && Array.isArray(d.entries.canning)) {
    const i = canningLogIndex(d.entries.canning, sale);
    if (i >= 0) d.entries.canning.splice(i, 1);
  }
}

// A log was deleted (Journal, recent activity). Undo what it did elsewhere.
export function unlinkDeletedEntry(d, hobby, entry) {
  if (!d || !entry) return;
  const sales = Array.isArray(d.sales) ? d.sales : [];
  if (entry.action === "sold_eggs") {
    // The Sales row is a copy of the log, same id.
    d.sales = sales.filter((s) => !(s && s.id === entry.id));
    return;
  }
  if (hobby && hobby.type === "canning" && (entry.action === "sale" || entry.action === "use") && entry.batchId) {
    const h = (d.hobbies || []).find((x) => x && x.id === hobby.id);
    const b = h && Array.isArray(h.batches) ? h.batches.find((x) => x && x.id === entry.batchId) : null;
    if (b) b.jarsRemaining = Math.max(0, (Number(b.jarsRemaining) || 0) + (Number(entry.qty) || 0));
    if (entry.action === "sale") {
      let i = sales.findIndex((s) => s && s.fromCanningEntryId === entry.id);
      if (i < 0) i = sales.findIndex((s) => s && s.hobbyType === "canning" && s.fromCanningBatchId === entry.batchId && s.date === entry.date && Number(s.qty) === Number(entry.qty));
      if (i >= 0) d.sales = sales.filter((_, k) => k !== i);
    }
    return;
  }
  // An animal's sale log: the Sales row has the same id; the animal comes back.
  if (entry.action === "sale") undoAnimalSale(d, entry.id);
}
