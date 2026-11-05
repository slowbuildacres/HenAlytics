// ============================================================================
// Dogs and cats (3.0) — Stats numbers
// ----------------------------------------------------------------------------
// Same records as the old pet pages: hobby.animals, hobby.litters
// (totalBorn or puppies / kittens), hobby.attacks (guardian dog or barn cat
// work), entries (fed with cost, health with cost) and hobby expenses.
// ============================================================================

const money = (v) => `$${(Number(v) || 0).toFixed(2)}`;

export function petStats(hobby, data, range = "year") {
  const year = String(new Date().getFullYear());
  const inR = (d) => range === "all" || String(d || "").startsWith(year);
  const isDog = hobby && hobby.type === "dogs";
  const live = ((hobby && hobby.animals) || []).filter((a) => a && !a.archived);
  const litters = ((hobby && hobby.litters) || []).filter((l) => inR(l.whelpDate || l.birthDate));
  const young = litters.reduce((t, l) => t + (Number(l.totalBorn) || ((l.puppies || l.kittens || []).length) || 0), 0);
  const attacks = ((hobby && hobby.attacks) || []).filter((a) => inR(a.date));
  const ents = ((data.entries && data.entries[hobby.id]) || []).filter((e) => e && inR(e.date));
  const spent = ents.reduce((t, e) => t + (Number(e.cost) || 0), 0)
    + ((data.expenses || []).filter((x) => x && x.hobbyId === hobby.id && inR(x.date)).reduce((t, x) => t + (Number(x.amount) || 0), 0));
  const vet = ents.filter((e) => e.action === "health").length;
  const byGuard = new Map();
  for (const a of attacks) { const d = live.find((x) => x.id === a.dogId); const k = d ? d.name : "Unknown"; byGuard.set(k, (byGuard.get(k) || 0) + 1); }
  const rows = [...byGuard.entries()].sort((a, b) => b[1] - a[1]).map(([name, v]) => ({ key: name, name, value: v, label: `${v} ${isDog ? "run off" : "caught"}` }));
  const facts = [];
  if (attacks.length >= 1) facts.push({ key: "guard", icon: "trophy", big: String(attacks.length), line: isDog ? "predators our dogs ran off" : "pests our barn cats caught", title: isDog ? `${attacks.length} predators run off` : `${attacks.length} pests caught`, sub: isDog ? "Your guardians earn their keep." : "Your barn cats earn their keep." });
  if (young >= 2) facts.push({ key: "young", icon: "spark", big: String(young), line: isDog ? "puppies born here" : "kittens born here", title: `${young} ${isDog ? "puppies" : "kittens"} born`, sub: `In ${litters.length} litter${litters.length === 1 ? "" : "s"}.` });
  if (spent > 0 && live.length) facts.push({ key: "cost", icon: "money", big: money(spent / live.length), line: isDog ? "a dog this year" : "a cat this year", title: `About ${money(spent / live.length)} per ${isDog ? "dog" : "cat"}`, sub: "Food, vet visits and supplies." });
  return {
    cards: [
      { label: isDog ? "Dogs" : "Cats", value: live.length, sub: `${live.filter((a) => a.isLGD || a.isBarnCat).length} ${isDog ? "guardians" : "barn cats"}` },
      { label: "Spent", value: money(spent), sub: `${vet} vet or med log${vet === 1 ? "" : "s"}` },
      ...(young ? [{ label: isDog ? "Puppies" : "Kittens", value: young, sub: `${litters.length} litter${litters.length === 1 ? "" : "s"}` }] : []),
      ...(attacks.length ? [{ label: isDog ? "Predators run off" : "Pests caught", value: attacks.length, sub: "" }] : []),
    ],
    bars: rows.length ? { title: isDog ? "Guardian work" : "Barn cat work", right: range === "all" ? "All time" : year, rows } : null,
    facts, emoji: isDog ? "🐕" : "🐈", kicker: isDog ? "Our dogs" : "Our cats",
  };
}
