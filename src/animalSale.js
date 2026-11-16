// ============================================================================
// An animal's sale, kept in step in all three places it lives
// ----------------------------------------------------------------------------
// Selling a goat, cow, pig, rabbit or horse (from its own page or from Sales)
// writes the same id to:
//   • the Sales row (d.sales[].id)
//   • the hobby's "sale" log entry (d.entries[hobbyId][].id, action "sale")
//   • the animal itself (archived, archivedReason "Sold…", saleId)
// Deleting the sale in Sales used to leave the animal archived as sold, and
// restoring the animal left the money in Sales. These undo all of it.
// Pure functions on an update() draft.
// ============================================================================

// Brings back any animal archived by this sale and drops the sale log entry.
export function unwindAnimalSale(d, saleId) {
  if (!d || !saleId) return;
  (Array.isArray(d.hobbies) ? d.hobbies : []).forEach((h) => {
    (h && Array.isArray(h.animals) ? h.animals : []).forEach((a) => {
      if (a && a.saleId === saleId) {
        // Only if it's still archived because of this sale (not since died).
        if (a.archived && /^(sold|leased|rehomed|given away)\b/i.test(String(a.archivedReason || ""))) { a.archived = false; delete a.archivedReason; delete a.archivedDate; }
        delete a.saleId;
      }
    });
  });
  const entries = d.entries && typeof d.entries === "object" ? d.entries : {};
  Object.keys(entries).forEach((k) => {
    if (Array.isArray(entries[k])) entries[k] = entries[k].filter((e) => !(e && e.id === saleId && e.action === "sale"));
  });
}

// Undoes the whole sale: the Sales row too.
export function undoAnimalSale(d, saleId) {
  if (!d || !saleId) return;
  d.sales = (Array.isArray(d.sales) ? d.sales : []).filter((s) => !(s && s.id === saleId));
  unwindAnimalSale(d, saleId);
}

// Links a sale's typed buyer name to a saved customer (same name, any case
// or spacing), adding one if there's none, so it shows in their history.
export function linkSaleBuyer(d, sale, makeId) {
  if (!sale || sale.buyerId) return;
  const name = String(sale.buyer || "").trim().replace(/\s+/g, " ");
  if (!name) return;
  d.customers = Array.isArray(d.customers) ? d.customers : [];
  let c = d.customers.find((x) => x && String(x.name || "").trim().replace(/\s+/g, " ").toLowerCase() === name.toLowerCase());
  if (!c) { c = { id: makeId(), name, note: "" }; d.customers.push(c); }
  sale.buyerId = c.id;
}
