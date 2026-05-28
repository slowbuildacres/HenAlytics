// =====================================================================
// generate-data-pages.mjs
// Reads public.public_stats from Supabase and writes static HTML data
// pages into public/data/ in the Henalytics blog template:
//   /data/                  -> master hub (links every category)
//   /data/birds/            -> species hub
//   /data/birds/<species>   -> per-species egg page
//   /data/garden/           -> most popular vegetables to grow
// Plus public/data-sitemap.xml. Runs as `prebuild` on every vite build.
//
//   env required: SUPABASE_URL, SUPABASE_ANON_KEY (or VITE_-prefixed)
//
// Pages auto-appear as the SQL job writes rows that clear the 25-homestead
// gate. Nothing empty is ever generated.
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[data-pages] Missing SUPABASE_URL / SUPABASE_ANON_KEY — skipping generation.");
  process.exit(0);
}

const DATA_ROOT  = path.resolve("public/data");
const BIRDS_DIR  = path.resolve("public/data/birds");
const GARDEN_DIR = path.resolve("public/data/garden");
const SITEMAP    = path.resolve("public/data-sitemap.xml");
const BASE  = "https://henalytics.com";
const TODAY = new Date().toISOString().slice(0, 10);
const TODAY_NICE = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

// --- display helpers ---------------------------------------------------
const PLURAL = {
  quail: "Quail", peafowl: "Peafowl", chicken: "Chickens", duck: "Ducks",
  goose: "Geese", turkey: "Turkeys", guinea: "Guinea Fowl", pheasant: "Pheasants",
};
const plural = (s) => PLURAL[s] || s.charAt(0).toUpperCase() + s.slice(1) + "s";
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const displayCrop = (s) => titleCase(s); // crops shown singular + title-cased
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// --- shared page shell (matches the blog template) --------------------
function shell({ title, description, keywords, canonical, jsonLd, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Henalytics</title>
<meta name="description" content="${esc(description)}">
<meta name="keywords" content="${esc(keywords)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE}/icon-512.png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600&family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>
  body { margin:0; font-family:'Be Vietnam Pro',-apple-system,BlinkMacSystemFont,sans-serif; background:#F4EDE0; color:#2C1810; line-height:1.7; }
  .container { max-width:720px; margin:0 auto; padding:40px 24px 80px; }
  header { padding:16px 24px; border-bottom:1.5px solid #2C181030; background:#FAF5EA; }
  header a { color:#2C1810; text-decoration:none; font-family:'DM Serif Display',Georgia,serif; font-size:22px; }
  header nav a { font-family:'Be Vietnam Pro',sans-serif; font-size:14px; margin-left:16px; color:#5C4530; }
  h1 { font-family:'DM Serif Display',Georgia,serif; font-size:38px; line-height:1.2; margin:0 0 12px; }
  h2 { font-family:'DM Serif Display',Georgia,serif; font-size:26px; margin:36px 0 12px; }
  .meta { color:#5C4530; font-size:14px; margin-bottom:28px; }
  p { margin:0 0 16px; }
  a { color:#C84B31; }
  table { border-collapse:collapse; width:100%; margin:16px 0; font-size:14px; }
  th,td { padding:8px 12px; text-align:left; border-bottom:1px solid #2C181030; }
  th { background:#EBE0CC; font-weight:600; }
  .cta { background:#FAF5EA; border:1.5px solid #2C181030; border-left:4px solid #E8B547; border-radius:12px; padding:20px; margin:36px 0; }
  .cta h3 { margin:0 0 8px; font-family:'DM Serif Display',Georgia,serif; font-size:20px; }
  .cta a { display:inline-block; margin-top:8px; padding:10px 18px; background:#2C1810; color:#F4EDE0; border-radius:8px; text-decoration:none; font-weight:600; box-shadow:2px 2px 0 #2C181030; }
  footer { padding:24px; text-align:center; color:#5C4530; font-size:13px; border-top:1.5px solid #2C181030; }
  .stat-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin:24px 0 8px; }
  .stat { background:#FAF5EA; border:1.5px solid #2C181030; border-radius:12px; padding:18px 16px; box-shadow:2px 2px 0 #2C181030; }
  .stat .num { font-family:'DM Serif Display',Georgia,serif; font-size:30px; line-height:1.05; }
  .stat .lbl { font-size:13px; color:#5C4530; margin-top:6px; }
  .stat .num small { font-size:15px; color:#5C4530; }
  .chartwrap { background:#FAF5EA; border:1.5px solid #2C181030; border-radius:12px; padding:20px 18px; margin:16px 0; }
  .hubcard { display:block; background:#FAF5EA; border:1.5px solid #2C181030; border-radius:12px; padding:20px; margin:14px 0; box-shadow:2px 2px 0 #2C181030; text-decoration:none; color:#2C1810; }
  .hubcard h3 { margin:0 0 6px; font-family:'DM Serif Display',Georgia,serif; font-size:21px; }
  .hubcard span { color:#5C4530; font-size:14px; }
  .sources { font-size:12.5px; color:#5C4530; border-top:1px dashed #2C181030; padding-top:14px; margin-top:32px; }
  @media (max-width:480px){ h1{font-size:30px;} }
</style>
</head>
<body>
<header>
  <div style="display:flex;align-items:center;justify-content:space-between;max-width:720px;margin:0 auto;">
    <a href="/">🐔 Henalytics</a>
    <nav><a href="/data/">Data</a><a href="/blog/">Blog</a><a href="/">App</a></nav>
  </div>
</header>
<div class="container">
${body}
</div>
<footer>Henalytics · Built solo by one homesteader · <a href="/">henalytics.com</a></footer>
</body>
</html>`;
}

const LAUNCH_NOTE = `<p class="sources" style="border-top:none;padding-top:0;margin-top:8px;">Henalytics launched in May 2026, so these figures are early — many homesteads have only been tracked for a short time, and not everyone has backfilled their history. Expect the numbers to grow and sharpen as logging accumulates.</p>`;

const methodologyEggs = (n) =>
  `<p class="sources"><strong>How this is calculated.</strong> Figures are the median across ${n} anonymized Henalytics homesteads keeping this species, recomputed nightly from self-reported logs (including estimated historical entries). A species is only published once at least 25 homesteads keep it, so no individual flock can be identified, and we never publish locations, names, or raw records — only aggregate statistics. Individual flocks vary widely with feed, climate, age, and care.</p>` + LAUNCH_NOTE;

const methodologyCrop = () =>
  `<p class="sources"><strong>How this is calculated.</strong> Each number counts the distinct anonymized Henalytics gardens that planted that crop, recomputed nightly from self-reported planting logs. A crop is only shown once at least 25 separate gardens have planted it, so no individual garden can be identified, and we never publish locations, names, or raw records — only aggregate counts. Crop names are normalized (so "tomato" and "tomatoes" count together).</p>` + LAUNCH_NOTE;

const ctaEggs = `<div class="cta">
  <h3>Track your own flock, free</h3>
  <p>Henalytics logs eggs collected, feed cost, and your true cost per dozen — free, in any browser. Your records stay private; only anonymized aggregates like these are ever shown publicly, and contributing is what makes pages like this real.</p>
  <a href="/">Open Henalytics →</a></div>`;

const ctaGarden = `<div class="cta">
  <h3>Plan and track your garden, free</h3>
  <p>Henalytics tracks what you plant, when you water, and what you harvest — free, in any browser. Your garden stays private; only anonymized totals like these are ever shown publicly, and logging is what makes pages like this real.</p>
  <a href="/">Open Henalytics →</a></div>`;

// horizontal bar chart of a metric across items (real data)
function barChart(rows, label, labelFn) {
  if (rows.length < 2) return "";
  const max = Math.max(...rows.map((r) => Number(r.metric)));
  const rowH = 30, top = 10, w = 640;
  const bars = rows.map((r, i) => {
    const y = top + i * rowH;
    const bw = max ? (Number(r.metric) / max) * 360 : 0;
    return `<g font-family="'Be Vietnam Pro',sans-serif">
      <text x="0" y="${y + 15}" font-size="13" fill="#2C1810">${esc(labelFn(r.dimension_value))}</text>
      <rect x="150" y="${y + 3}" width="${bw.toFixed(1)}" height="17" rx="3" fill="#5A7A3C"/>
      <text x="${(158 + bw).toFixed(1)}" y="${y + 16}" font-size="12" fill="#5C4530">${Number(r.metric)}</text>
    </g>`;
  }).join("");
  return `<div class="chartwrap">
    <svg viewBox="0 0 ${w} ${top + rows.length * rowH + 6}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}" style="width:100%;height:auto;">${bars}</svg>
  </div>`;
}

// --- main --------------------------------------------------------------
async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: rows, error } = await supabase.from("public_stats").select("*");
  if (error) { console.error("[data-pages]", error.message); process.exit(0); }
  if (!rows || rows.length === 0) {
    console.log("[data-pages] No qualifying data yet — nothing to generate.");
    process.exit(0);
  }

  const byKey = (k) => rows.filter((r) => r.stat_key === k);
  const eggsYear = byKey("eggs_per_bird_year");
  const hatch = Object.fromEntries(byKey("hatch_rate").map((r) => [r.dimension_value, r]));
  const top = byKey("top_species").sort((a, b) => b.metric - a.metric);
  const rank = Object.fromEntries(top.map((r, i) => [r.dimension_value, i + 1]));
  const crops = byKey("top_crop").sort((a, b) => b.metric - a.metric);

  const urls = [];
  const categories = []; // for the master hub

  // ============ BIRD / EGG PAGES ============
  if (eggsYear.length) {
    fs.mkdirSync(BIRDS_DIR, { recursive: true });

    for (const r of eggsYear) {
      const sp = r.dimension_value, name = plural(sp);
      const perWeek = r.extra && r.extra.per_week;
      const h = hatch[sp];
      const slug = sp.replace(/[^a-z0-9]+/g, "-");
      const url = `${BASE}/data/birds/${slug}`;
      const cards = [
        `<div class="stat"><div class="num">${r.metric}<small> /yr</small></div><div class="lbl">Avg eggs per bird, per year</div></div>`,
        perWeek != null ? `<div class="stat"><div class="num">${perWeek}<small> /wk</small></div><div class="lbl">Avg eggs per bird, per week</div></div>` : "",
        rank[sp] ? `<div class="stat"><div class="num">#${rank[sp]}</div><div class="lbl">Most-kept laying species on Henalytics</div></div>` : "",
        h ? `<div class="stat"><div class="num">${h.metric}<small>%</small></div><div class="lbl">Avg incubation hatch rate</div></div>` : "",
      ].filter(Boolean).join("");
      const body = `
<h1>How Many Eggs Do ${esc(name)} Lay?</h1>
<div class="meta">Aggregated from <strong>${r.sample_n} anonymized Henalytics homesteads</strong> · Updated ${TODAY_NICE}</div>
<p>This is what real backyard flocks tracking their birds in Henalytics actually produce — not catalog estimates. Each figure is a median across homesteads, so one outlier flock can't skew it.</p>
<div class="stat-grid">${cards}</div>
${eggsYear.length > 1 ? `<h2>How ${esc(name)} compare</h2>
<p>Average eggs per bird per year, by species, across all tracked Henalytics flocks:</p>
${barChart(eggsYear, "Average eggs per bird per year by species", plural)}` : ""}
${ctaEggs}
${methodologyEggs(r.sample_n)}`;
      const jsonLd = {
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: [{
          "@type": "Question",
          name: `How many eggs do ${name.toLowerCase()} lay per year?`,
          acceptedAnswer: { "@type": "Answer",
            text: `Across ${r.sample_n} anonymized Henalytics homesteads, ${name.toLowerCase()} lay a median of about ${r.metric} eggs per bird per year${perWeek != null ? ` (about ${perWeek} per week)` : ""}.` },
        }],
      };
      fs.writeFileSync(path.join(BIRDS_DIR, `${slug}.html`), shell({
        title: `How Many Eggs Do ${name} Lay? (${r.metric}/yr)`,
        description: `${name} lay a median of about ${r.metric} eggs per bird per year, based on real anonymized data from ${r.sample_n} Henalytics flocks.`,
        keywords: `how many eggs do ${sp} lay, ${sp} egg production, ${sp} eggs per year`,
        canonical: url, jsonLd, body,
      }));
      urls.push(url);
      console.log(`[data-pages] wrote birds/${slug}.html (n=${r.sample_n})`);
    }

    // birds hub
    const hubRows = top.length ? top : eggsYear;
    const list = hubRows.map((r) => {
      const sp = r.dimension_value;
      const ey = eggsYear.find((x) => x.dimension_value === sp);
      const slug = sp.replace(/[^a-z0-9]+/g, "-");
      return `<tr><td><a href="/data/birds/${slug}">${esc(plural(sp))}</a></td><td>${r.metric}${r.metric_unit === "homesteads" ? " homesteads" : ""}</td><td>${ey ? ey.metric + " eggs/yr" : "—"}</td></tr>`;
    }).join("");
    fs.writeFileSync(path.join(BIRDS_DIR, "index.html"), shell({
      title: "Backyard Egg Data by Species",
      description: "Real aggregate egg-production data for backyard poultry — eggs per bird per year by species, from anonymized Henalytics flocks.",
      keywords: "backyard egg production data, how many eggs do birds lay, poultry laying rates",
      canonical: `${BASE}/data/birds/`,
      jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Backyard Egg Data by Species" },
      body: `
<h1>Backyard Egg Data by Species</h1>
<div class="meta">Real aggregate data from anonymized Henalytics homesteads · Updated ${TODAY_NICE}</div>
<p>How much do different backyard poultry actually lay? These figures come from real flocks tracking their birds in Henalytics, updated nightly.</p>
<table><tr><th>Species</th><th>Homesteads</th><th>Eggs / bird / year</th></tr>${list}</table>
${ctaEggs}
${methodologyEggs(Math.max(...hubRows.map((r) => r.sample_n)))}`,
    }));
    urls.push(`${BASE}/data/birds/`);
    categories.push({ href: "/data/birds/", title: "Backyard Egg Data by Species",
      blurb: `Eggs per bird per year for ${eggsYear.map((r) => plural(r.dimension_value)).join(", ")} — from real flocks.` });
  }

  // ============ GARDEN PAGE ============
  if (crops.length) {
    fs.mkdirSync(GARDEN_DIR, { recursive: true });
    const url = `${BASE}/data/garden/`;
    const chartRows = crops.slice(0, 15);
    const tableRows = crops.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${esc(displayCrop(r.dimension_value))}</td><td>${r.metric} gardens</td></tr>`).join("");
    const topThree = crops.slice(0, 3).map((r) => displayCrop(r.dimension_value));
    const body = `
<h1>The Most Popular Vegetables to Grow</h1>
<div class="meta">Based on what real Henalytics gardens actually plant · Updated ${TODAY_NICE}</div>
<p>What do backyard gardeners actually grow? This ranks the crops most commonly planted across anonymized Henalytics gardens — ${topThree[0]}, ${topThree[1]}, and ${topThree[2]} lead the list. Each number is how many separate gardens planted that crop.</p>
<h2>Most-planted crops</h2>
${barChart(chartRows, "Most popular vegetables to grow by number of gardens", displayCrop)}
<h2>Full ranking</h2>
<table><tr><th>#</th><th>Crop</th><th>Gardens growing it</th></tr>${tableRows}</table>
${ctaGarden}
${methodologyCrop()}`;
    const jsonLd = {
      "@context": "https://schema.org", "@type": "ItemList",
      name: "The Most Popular Vegetables to Grow",
      itemListElement: crops.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: displayCrop(r.dimension_value) })),
    };
    fs.writeFileSync(path.join(GARDEN_DIR, "index.html"), shell({
      title: "The Most Popular Vegetables to Grow",
      description: `The vegetables backyard gardeners most commonly plant, ranked from real anonymized Henalytics garden data. ${topThree.join(", ")} top the list.`,
      keywords: "most popular vegetables to grow, best vegetables to plant, what to grow in a garden",
      canonical: url, jsonLd, body,
    }));
    urls.push(url);
    console.log(`[data-pages] wrote garden/index.html (${crops.length} crops)`);
    categories.push({ href: "/data/garden/", title: "The Most Popular Vegetables to Grow",
      blurb: `The ${crops.length} most-planted crops across Henalytics gardens, led by ${topThree[0]}.` });
  }

  // ============ MASTER /data/ HUB ============
  if (categories.length) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
    const cards = categories.map((c) =>
      `<a class="hubcard" href="${c.href}"><h3>${esc(c.title)} →</h3><span>${esc(c.blurb)}</span></a>`).join("");
    fs.writeFileSync(path.join(DATA_ROOT, "index.html"), shell({
      title: "Homestead Data from Real Henalytics Users",
      description: "Real aggregate data from thousands of anonymized homesteads and gardens — egg production, popular crops, and more. Updated nightly.",
      keywords: "homestead data, backyard egg data, gardening statistics, homesteading statistics",
      canonical: `${BASE}/data/`,
      jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Homestead Data from Real Henalytics Users" },
      body: `
<h1>Homestead Data, From Real Homesteads</h1>
<div class="meta">Aggregated from thousands of anonymized Henalytics users · Updated ${TODAY_NICE}</div>
<p>Henalytics users track their flocks, gardens, and more every day. These pages turn that into honest, anonymized answers to the questions homesteaders actually search for — updated nightly as the data grows.</p>
${cards}`,
    }));
    urls.push(`${BASE}/data/`);
  }

  // ============ SITEMAP ============
  const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}
</urlset>`;
  fs.writeFileSync(SITEMAP, sm);
  console.log(`[data-pages] wrote ${urls.length} URLs + data-sitemap.xml`);
}

main().catch((e) => { console.error("[data-pages]", e); process.exit(0); });
