// ============================================================================
// YEAR IN REVIEW — updated to respect hidden hobbies + rabbits support
// ============================================================================

import React, { useState, useMemo, useEffect } from "react";
import { Egg, Drumstick, Sprout, Calendar as CalendarIcon, Camera, Sun, CloudRain, Heart } from "lucide-react";
import { getPhotoUrl } from "./sync.js";
import { fmtMoney, fmtTemp } from "./units.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47",
  line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

// ============================================================================
// CHICKEN TRACTOR DISTANCE — fun-fact comparisons (ported from HomesteadApp.jsx)
// ----------------------------------------------------------------------------
// Same tiered comparison logic as the Stats tab — but we pass a different
// seed string here ("yearInReview") so Year in Review shows a different
// equivalent than the Stats tab even for the same total distance. Keeps
// the surfaces feeling distinct without duplicating data.
// ============================================================================
const FEET_PER_MILE = 5280;
const tractorFunFact = (totalFeet, seed = "") => {
  const ft = Number(totalFeet) || 0;
  if (ft < 25) return null;
  const seedHash = String(seed).split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const tiers = [
    {
      test: (f) => f < 300,
      variants: [
        (f) => `That's about ${Math.round(f / 6)} of your own steps 👣`,
        (f) => `Roughly the height of ${(f / 152).toFixed(1)} blue whales 🐋`,
        (f) => `${Math.round(f / 60)} school buses end-to-end 🚌`,
      ],
    },
    {
      test: (f) => f < 3000,
      variants: [
        (f) => `That's ${(f / 300).toFixed(1)} football fields end-to-end 🏈`,
        (f) => `${Math.round(f / 305)} Statues of Liberty laid end-to-end 🗽`,
        (f) => `${Math.round(f / 555)} Washington Monuments stacked 🏛️`,
      ],
    },
    {
      test: (f) => f < FEET_PER_MILE,
      variants: [
        (f) => `That's ${(f / 300).toFixed(0)} football fields end-to-end 🏈`,
        (f) => `Almost a mile — you've moved ${(f / FEET_PER_MILE).toFixed(2)} miles 🚜`,
        (f) => `${Math.round(f / 264)} city blocks 🏙️`,
      ],
    },
    {
      test: (f) => f < 5 * FEET_PER_MILE,
      variants: [
        (f) => `That's ${(f / FEET_PER_MILE).toFixed(1)} miles — a solid walk 🚶`,
        (f) => `${(f / FEET_PER_MILE).toFixed(1)} miles, or ${Math.round(f / 300)} football fields 🏈`,
        (f) => `${(f / FEET_PER_MILE / 0.8).toFixed(1)} laps around Central Park 🌳`,
      ],
    },
    {
      test: (f) => f < 30 * FEET_PER_MILE,
      variants: [
        (f) => `${(f / FEET_PER_MILE).toFixed(1)} miles — ${(f / FEET_PER_MILE / 26.2 * 100).toFixed(0)}% of a marathon 🏃`,
        (f) => `${(f / FEET_PER_MILE).toFixed(1)} miles — about the width of Manhattan ${Math.round(f / FEET_PER_MILE / 2.3)} times over 🗽`,
        (f) => `That's ${(f / FEET_PER_MILE).toFixed(1)} miles, or roughly ${Math.round(f / FEET_PER_MILE / 3.1)} 5Ks 👟`,
      ],
    },
    {
      test: (f) => f < 50 * FEET_PER_MILE,
      variants: [
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles — about the length of Rhode Island 🌊`,
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles, or ${(f / FEET_PER_MILE / 26.2).toFixed(1)} marathons 🏃`,
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles — like walking from one coast of Rhode Island to the other 🦞`,
      ],
    },
    {
      test: (f) => f < 200 * FEET_PER_MILE,
      variants: [
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles — that's like crossing Connecticut end-to-end 🍃`,
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles, or ${(f / FEET_PER_MILE / 26.2).toFixed(1)} marathons 🏃`,
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles — ${(f / FEET_PER_MILE / 50).toFixed(1)}× the length of Rhode Island 🌊`,
      ],
    },
    {
      test: () => true,
      variants: [
        (f) => `${(f / FEET_PER_MILE).toLocaleString(undefined, {maximumFractionDigits:0})} miles — that's a road trip distance 🛻`,
        (f) => `${(f / FEET_PER_MILE).toLocaleString(undefined, {maximumFractionDigits:0})} miles, or ${(f / FEET_PER_MILE / 26.2).toFixed(0)} marathons 🏃`,
        (f) => `${(f / FEET_PER_MILE).toLocaleString(undefined, {maximumFractionDigits:0})} miles — your chickens have seen things 👀`,
      ],
    },
  ];
  const tier = tiers.find(t => t.test(ft));
  const idx = Math.abs(seedHash) % tier.variants.length;
  return tier.variants[idx](ft);
};

const fmtTractorDistance = (totalFeet) => {
  const ft = Number(totalFeet) || 0;
  if (ft < 1000) return `${ft.toLocaleString()} ft`;
  const miles = ft / FEET_PER_MILE;
  return miles < 10
    ? `${miles.toFixed(2)} mi`
    : `${miles.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi`;
};

export default function YearInReviewPage({ data }) {
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => collectYears(data), [data]);
  const [year, setYear] = useState(() => {
    if (availableYears.includes(currentYear)) return currentYear;
    if (availableYears.length > 0) return availableYears[0];
    return currentYear;
  });

  const stats = useMemo(() => computeStats(data, year), [data, year]);
  const hasAnyData = stats.totalEntries > 0;

  // Check which hobbies are enabled
  const hobbies = data.hobbies || [];
  const eggLayersEnabled = hobbies.some(h => h.type === "egg_layers" && !h.hidden);
  const gardenEnabled = hobbies.some(h => h.type === "garden" && !h.hidden);
  const meatChickensEnabled = hobbies.some(h => h.type === "meat_chickens" && !h.hidden);
  const rabbitsEnabled = hobbies.some(h => h.type === "rabbits" && !h.hidden);
  const beesEnabled = hobbies.some(h => h.type === "bees" && !h.hidden);
  const incubatorEnabled = hobbies.some(h => h.type === "incubator" && !h.hidden);
  const goatsEnabled = hobbies.some(h => h.type === "goats" && !h.hidden);
  const cowsEnabled = hobbies.some(h => h.type === "cows" && !h.hidden);
  const pigsEnabled = hobbies.some(h => h.type === "pigs" && !h.hidden);
  const sheepEnabled = hobbies.some(h => h.type === "sheep" && !h.hidden);
  const sourdoughEnabled = hobbies.some(h => h.type === "sourdough" && !h.hidden);
  const horsesEnabled = hobbies.some(h => h.type === "horses" && !h.hidden);
  const farmstandEnabled = hobbies.some(h => h.type === "farmstand" && !h.hidden);
  const bakingEnabled = hobbies.some(h => h.type === "baking" && !h.hidden);
  const canningEnabled = hobbies.some(h => h.type === "canning" && !h.hidden);
  const dogsEnabled = hobbies.some(h => h.type === "dogs" && !h.hidden);
  const catsEnabled = hobbies.some(h => h.type === "cats" && !h.hidden);
  const mapleSyrupEnabled = hobbies.some(h => h.type === "maple_syrup" && !h.hidden);
  const dehydratingEnabled = hobbies.some(h => h.type === "dehydrating" && !h.hidden);
  const fermentationEnabled = hobbies.some(h => h.type === "fermentation" && !h.hidden);
  const freezeDryingEnabled = hobbies.some(h => h.type === "freeze_drying" && !h.hidden);

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 18, flexWrap: "wrap", gap: 10,
      }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: 0, color: palette.ink }}>
          year in review
        </h2>
        {availableYears.length > 0 && (
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: `1.5px solid ${palette.line}`,
              background: palette.card, fontFamily: FONT_BODY, fontSize: 14,
              color: palette.ink, cursor: "pointer",
            }}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

      {!hasAnyData ? (
        <EmptyYear year={year} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <CoverCard year={year} stats={stats} />
          <HeadlinesCard stats={stats} eggLayersEnabled={eggLayersEnabled} gardenEnabled={gardenEnabled} meatChickensEnabled={meatChickensEnabled} rabbitsEnabled={rabbitsEnabled} beesEnabled={beesEnabled} goatsEnabled={goatsEnabled} cowsEnabled={cowsEnabled} pigsEnabled={pigsEnabled} sheepEnabled={sheepEnabled} sourdoughEnabled={sourdoughEnabled} horsesEnabled={horsesEnabled} farmstandEnabled={farmstandEnabled} bakingEnabled={bakingEnabled} canningEnabled={canningEnabled} />
          {eggLayersEnabled && <EggsCard stats={stats} />}
          {gardenEnabled && <GardenCard stats={stats} />}
          {meatChickensEnabled && <MeatChickensCard stats={stats} />}
          {stats.tractorFeet > 0 && <TractorCard stats={stats} />}
          {rabbitsEnabled && <RabbitsCard stats={stats} />}
          {beesEnabled && <BeesCard stats={stats} />}
          {incubatorEnabled && <IncubatorCard stats={stats} />}
          {goatsEnabled && <GoatsCard stats={stats} />}
          {cowsEnabled && <CowsCard stats={stats} />}
          {pigsEnabled && <PigsCard stats={stats} />}
          {sheepEnabled && <SheepCard stats={stats} />}
          {sourdoughEnabled && <SourdoughCard stats={stats} />}
          {horsesEnabled && <HorsesCard stats={stats} />}
          {farmstandEnabled && <FarmstandCard stats={stats} />}
          {bakingEnabled && <BakingCard stats={stats} />}
          {canningEnabled && <CanningCard stats={stats} />}
          {dehydratingEnabled && <DehydratingCard stats={stats} />}
          {fermentationEnabled && <FermentationCard stats={stats} />}
          {freezeDryingEnabled && <FreezeDryingCard stats={stats} />}
          {dogsEnabled && <DogsCard stats={stats} />}
          {catsEnabled && <CatsCard stats={stats} />}
          {mapleSyrupEnabled && <MapleSyrupCard stats={stats} />}
          {stats.freezerBirds > 0 && <FreezerCard stats={stats} />}
          <ActivityCard stats={stats} />
          {stats.weatherStats && <WeatherCard stats={stats} />}
          {stats.photos.length > 0 && <PhotosCard stats={stats} />}
          <FunFactsCard stats={stats} />
          <FooterCard year={year} />
        </div>
      )}
    </div>
  );
}

function EmptyYear({ year }) {
  return (
    <div style={{
      padding: 32, background: palette.card, border: `1.5px dashed ${palette.line}`,
      borderRadius: 12, textAlign: "center", color: palette.inkSoft,
    }}>
      <Sprout size={32} strokeWidth={1.5} style={{ marginBottom: 10 }} />
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink, marginBottom: 4 }}>
        Nothing logged in {year} yet
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
        Once you've logged some entries this year, your review will fill in here.
      </div>
    </div>
  );
}

function Card({ children, accent = palette.card, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        background: accent,
        border: `1.5px solid ${palette.line}`,
        borderRadius: 14,
        padding: 22,
        boxShadow: "3px 3px 0 " + palette.line,
        ...(rest.style || {}),
      }}
    >
      {children}
    </div>
  );
}

function CoverCard({ year, stats }) {
  return (
    <Card accent={palette.yolkSoft} style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 8 }}>
        Your homestead in
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 64, color: palette.ink, lineHeight: 1, marginBottom: 12 }}>
        {year}
      </div>
      <div style={{ fontSize: 14, color: palette.inkSoft, fontStyle: "italic" }}>
        {stats.totalEntries} {stats.totalEntries === 1 ? "entry" : "entries"} logged · {stats.activeDays} active {stats.activeDays === 1 ? "day" : "days"}
      </div>
    </Card>
  );
}

function HeadlinesCard({ stats, eggLayersEnabled, gardenEnabled, meatChickensEnabled, rabbitsEnabled, beesEnabled, goatsEnabled, cowsEnabled, pigsEnabled, sheepEnabled, sourdoughEnabled, horsesEnabled, farmstandEnabled, bakingEnabled, canningEnabled }) {
  const items = [];
  if (eggLayersEnabled) items.push({ icon: "🥚", number: stats.eggsCollected, label: `egg${stats.eggsCollected === 1 ? "" : "s"} laid`, accent: palette.yolk });
  if (meatChickensEnabled) items.push({ icon: "🍗", number: Math.max(stats.birdsSurvived, stats.birdsButchered), label: `meat bird${stats.birdsSurvived === 1 ? "" : "s"} raised`, accent: palette.feather });
  if (gardenEnabled) items.push({ icon: "🌱", number: Math.round(stats.totalHarvestLbs), label: `lb${Math.round(stats.totalHarvestLbs) === 1 ? "" : "s"} harvested`, accent: palette.leaf });
  if (rabbitsEnabled) items.push({ icon: "🐇", number: stats.totalKitsAlive || 0, label: `kits born`, accent: palette.leaf });
  if (beesEnabled && stats.honeyHarvestedLbs > 0) items.push({ icon: "🍯", number: Math.round(stats.honeyHarvestedLbs), label: `lbs honey harvested`, accent: palette.yolk });
  if (goatsEnabled && stats.goatMilkOz > 0) items.push({ icon: "🐐", number: Math.round(stats.goatMilkOz / 128), label: `gal goat milk`, accent: palette.leaf });
  if (cowsEnabled && stats.cowMilkGal > 0) items.push({ icon: "🐄", number: Math.round(stats.cowMilkGal), label: `gal cow milk`, accent: palette.leaf });
  if (pigsEnabled && stats.pigsButchered > 0) items.push({ icon: "🐷", number: stats.pigMeatLbs, label: `lbs pork`, accent: palette.feather });
  if (sheepEnabled && stats.sheepLambsBorn > 0) items.push({ icon: "🐑", number: stats.sheepLambsBorn, label: `lamb${stats.sheepLambsBorn === 1 ? "" : "s"} born`, accent: palette.leafSoft });
  if (sourdoughEnabled && stats.sourdoughLoaves > 0) items.push({ icon: "🍞", number: stats.sourdoughLoaves, label: `loa${stats.sourdoughLoaves === 1 ? "f" : "ves"} baked`, accent: palette.yolk });
  if (horsesEnabled && stats.horseRides > 0) items.push({ icon: "🐴", number: stats.horseRides, label: `ride${stats.horseRides === 1 ? "" : "s"}`, accent: palette.feather });
  if (farmstandEnabled && stats.farmstandRevenue > 0) items.push({ icon: "🧾", number: fmtMoney(stats.farmstandRevenue).replace(/\.\d\d$/, ""), label: `farmstand revenue`, accent: palette.leaf });
  if (bakingEnabled && stats.bakingItems > 0) items.push({ icon: "🥧", number: stats.bakingItems, label: `item${stats.bakingItems === 1 ? "" : "s"} baked`, accent: palette.yolk });
  if (canningEnabled && stats.canningJarsMade > 0) items.push({ icon: "🫙", number: stats.canningJarsMade, label: `jar${stats.canningJarsMade === 1 ? "" : "s"} canned`, accent: palette.leafSoft });

  if (items.length === 0) return null;

  return (
    <Card accent={palette.bgAlt}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 12 }}>
        ✨ Your year at a glance
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {items.map((item, i) => (
          <BigStat key={i} icon={item.icon} number={item.number} label={item.label} accent={item.accent} />
        ))}
      </div>
    </Card>
  );
}

function BigStat({ icon, number, label, accent }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(number)) return;
    const duration = 800;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(number * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [number]);

  return (
    <div style={{
      flex: "1 1 110px", padding: "16px 12px",
      background: palette.card, borderRadius: 12,
      border: `1.5px solid ${palette.line}`,
      borderTop: `4px solid ${accent}`,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 26, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: palette.ink, lineHeight: 1, marginBottom: 4 }}>
        {shown.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: palette.inkSoft }}>{label}</div>
    </div>
  );
}

function EggsCard({ stats }) {
  if (!stats.eggsCollected && !stats.eggsSold && !stats.eggLayerTotalCost) return null;
  const {
    eggsCollected, dozensCollected, eggsSold, eggRevenue,
    eggLayerFeedCost, eggLayerInfraCost, eggLayerBirdCost,
    eggLayerTotalCost, eggLayerCostPerDozen,
    benchmarkPricePerDozen, groceryStoreEquivalent, moneySavedVsBuying,
    eggRevenueByMonth, peakEggMonth,
  } = stats;
  const maxBar = Math.max(...Object.values(eggRevenueByMonth || {}).map((m) => m.collected || 0), 1);

  return (
    <Card accent={palette.card}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 6 }}>
        🥚 Eggs
      </div>
      <CountUp number={eggsCollected} suffix="eggs collected" big />
      <div style={{ fontSize: 14, color: palette.inkSoft, marginBottom: 12 }}>
        That's <strong style={{ color: palette.ink }}>{dozensCollected.toFixed(1)} dozen</strong>
        {eggsSold > 0 && <> · You sold <strong style={{ color: palette.ink }}>{(eggsSold / 12).toFixed(1)} dozen</strong></>}
      </div>

      {(eggLayerTotalCost > 0 && dozensCollected > 0) && (
        <div style={{ marginTop: 4, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            The numbers
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {eggRevenue > 0 && <Stat big={fmtMoney(eggRevenue)} label="revenue from sold eggs" accent={palette.leaf} />}
            <Stat big={fmtMoney(eggLayerCostPerDozen)} label="cost per dozen produced" accent={palette.feather} />
            <Stat
              big={fmtMoney(moneySavedVsBuying)}
              label={`saved vs. buying pasture-raised at ${fmtMoney(benchmarkPricePerDozen)}/doz`}
              accent={moneySavedVsBuying >= 0 ? palette.leaf : palette.accent}
            />
          </div>
          <div style={{ marginTop: 12, padding: 10, background: palette.bgAlt, borderRadius: 8, fontSize: 12, color: palette.inkSoft, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: palette.ink, marginBottom: 4 }}>Costs broken down:</div>
            {eggLayerFeedCost > 0 && <div>🌾 Feed · <strong style={{ color: palette.ink }}>{fmtMoney(eggLayerFeedCost)}</strong></div>}
            {eggLayerInfraCost > 0 && <div>🔨 Infrastructure · <strong style={{ color: palette.ink }}>{fmtMoney(eggLayerInfraCost)}</strong></div>}
            {eggLayerBirdCost > 0 && <div>🐔 Bird purchases · <strong style={{ color: palette.ink }}>{fmtMoney(eggLayerBirdCost)}</strong></div>}
            <div style={{ marginTop: 6, fontSize: 11, fontStyle: "italic" }}>
              Buying {dozensCollected.toFixed(1)} dozen pasture-raised at the grocery store would have cost {fmtMoney(groceryStoreEquivalent)}.
            </div>
          </div>
        </div>
      )}

      {eggLayerTotalCost === 0 && dozensCollected > 0 && (
        <div style={{ padding: 10, background: palette.bgAlt, borderRadius: 8, marginBottom: 14, fontSize: 12, color: palette.inkSoft, fontStyle: "italic", lineHeight: 1.5 }}>
          💡 Add costs (feed, infrastructure, birds) to your egg layer entries and we'll show you how much you saved vs. buying pasture-raised eggs at the store.
        </div>
      )}

      {peakEggMonth && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6 }}>
            Best month: <strong style={{ color: palette.ink }}>{peakEggMonth}</strong>
          </div>
          <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 60 }}>
            {monthLabels.map((label, i) => {
              const collected = (eggRevenueByMonth[i] && eggRevenueByMonth[i].collected) || 0;
              const h = (collected / maxBar) * 60;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} title={`${label}: ${collected} eggs`}>
                  <div style={{ width: "100%", height: `${h}px`, minHeight: 2, background: palette.yolk, borderRadius: "3px 3px 0 0" }} />
                  <div style={{ fontSize: 9, color: palette.inkSoft }}>{label[0]}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function GardenCard({ stats }) {
  if (!stats.totalHarvestLbs && stats.topPlants.length === 0) return null;
  const { totalHarvestLbs, topPlants, plantingsCount, harvestsCount } = stats;
  const maxLbs = Math.max(...topPlants.map((p) => p.lbs), 1);

  return (
    <Card accent={palette.card}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 6 }}>
        🌱 Garden
      </div>
      <CountUp number={Math.round(totalHarvestLbs)} suffix="lbs harvested" big />
      <div style={{ fontSize: 14, color: palette.inkSoft, marginBottom: 14 }}>
        From <strong style={{ color: palette.ink }}>{harvestsCount}</strong> harvest{harvestsCount === 1 ? "" : "s"}
        {plantingsCount > 0 && <> · {plantingsCount} planting{plantingsCount === 1 ? "" : "s"}</>}
      </div>

      {topPlants.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Top crops</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topPlants.slice(0, 5).map((p) => (
              <div key={p.plant} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 90, fontSize: 13, color: palette.ink, fontWeight: 500 }}>{p.plant}</div>
                <div style={{ flex: 1, height: 14, background: palette.bgAlt, borderRadius: 7, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(p.lbs / maxLbs) * 100}%`, background: palette.leaf, borderRadius: 7 }} />
                </div>
                <div style={{ minWidth: 50, textAlign: "right", fontSize: 12, color: palette.inkSoft }}>{p.lbs.toFixed(1)} lbs</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function MeatChickensCard({ stats }) {
  if (!stats.birdsRaised && !stats.birdsButchered) return null;
  const {
    birdsRaised, birdsSurvived, birdsButchered, totalMeatLbs, birdDeaths, mortalityRate,
    meatChickenFeedCost, meatChickenInfraCost, meatChickenChickCost,
    meatChickenTotalCost, meatCostPerLb,
  } = stats;

  return (
    <Card accent={palette.card}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 6 }}>
        🍗 Meat birds
      </div>
      {birdsButchered > 0 ? (
        <>
          <CountUp number={Math.round(totalMeatLbs)} suffix="lbs in the freezer" big />
          <div style={{ fontSize: 14, color: palette.inkSoft, marginBottom: 14 }}>
            From <strong style={{ color: palette.ink }}>{birdsButchered}</strong> bird{birdsButchered === 1 ? "" : "s"} butchered
            {birdsRaised > 0 && <> · started with <strong style={{ color: palette.ink }}>{birdsRaised}</strong></>}
          </div>
        </>
      ) : (
        <>
          <CountUp number={birdsSurvived} suffix="birds raised" big />
          {birdsRaised !== birdsSurvived && (
            <div style={{ fontSize: 14, color: palette.inkSoft, marginBottom: 14 }}>
              From <strong style={{ color: palette.ink }}>{birdsRaised}</strong> started · {birdDeaths} lost
            </div>
          )}
        </>
      )}

      {meatChickenTotalCost > 0 && (
        <div style={{ marginTop: 4, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>The numbers</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {meatCostPerLb > 0 && <Stat big={fmtMoney(meatCostPerLb)} label="cost per lb of meat" accent={palette.feather} />}
            <Stat big={fmtMoney(meatChickenTotalCost)} label="total spent on meat birds" accent={palette.feather} />
          </div>
          <div style={{ marginTop: 12, padding: 10, background: palette.bgAlt, borderRadius: 8, fontSize: 12, color: palette.inkSoft, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: palette.ink, marginBottom: 4 }}>Costs broken down:</div>
            {meatChickenFeedCost > 0 && <div>🌾 Feed · <strong style={{ color: palette.ink }}>{fmtMoney(meatChickenFeedCost)}</strong></div>}
            {meatChickenInfraCost > 0 && <div>🔨 Infrastructure · <strong style={{ color: palette.ink }}>{fmtMoney(meatChickenInfraCost)}</strong></div>}
            {meatChickenChickCost > 0 && <div>🐣 Chick purchases · <strong style={{ color: palette.ink }}>{fmtMoney(meatChickenChickCost)}</strong></div>}
          </div>
        </div>
      )}

      {birdDeaths > 0 && (
        <div style={{ padding: 10, background: palette.bgAlt, borderRadius: 8, fontSize: 12, color: palette.inkSoft, lineHeight: 1.5 }}>
          <Heart size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
          You lost {birdDeaths} bird{birdDeaths === 1 ? "" : "s"} this year
          {mortalityRate > 0 && ` (${mortalityRate.toFixed(0)}% mortality)`}.
        </div>
      )}
    </Card>
  );
}

// ============ CHICKEN TRACTOR CARD ============
// Only renders when the user has actually logged tractor moves (filtered
// upstream by the parent — see `stats.tractorFeet > 0` gate). The fun-fact
// equivalent uses the "yearInReview" seed so it picks a different equivalent
// than the Stats tab (which seeds with "eggLayersStats" / "meatChickensStats").
function TractorCard({ stats }) {
  const { tractorFeet, tractorMoveCount } = stats;
  const funFact = tractorFunFact(tractorFeet, "yearInReview");
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 6 }}>
        🚜 Chicken tractor
      </div>
      <CountUp number={tractorFeet} suffix="feet moved" big />
      <div style={{ fontSize: 14, color: palette.inkSoft, marginBottom: 12 }}>
        Across <strong style={{ color: palette.ink }}>{tractorMoveCount}</strong> move{tractorMoveCount === 1 ? "" : "s"}
        {tractorMoveCount > 0 && tractorFeet > 0 && (
          <> · about <strong style={{ color: palette.ink }}>{(tractorFeet / tractorMoveCount).toFixed(0)} ft</strong> per move</>
        )}
      </div>
      {funFact && (
        <div style={{
          padding: "12px 14px",
          background: palette.bgAlt,
          borderRadius: 10,
          border: `1px solid ${palette.line}`,
          fontSize: 14,
          color: palette.ink,
          lineHeight: 1.5,
        }}>
          {funFact}
        </div>
      )}
      {tractorFeet >= FEET_PER_MILE && (
        <div style={{
          marginTop: 10,
          fontSize: 12,
          color: palette.inkSoft,
          fontStyle: "italic",
          lineHeight: 1.5,
        }}>
          That's {fmtTractorDistance(tractorFeet)} of fresh pasture and bug-eating opportunities for your flock. 🐔
        </div>
      )}
    </Card>
  );
}

// ============ NEW: RABBITS CARD ============
function RabbitsCard({ stats }) {
  const { totalLitters, totalKitsAlive, totalKitsStillborn, totalRabbitsButchered, rabbitTotalCost, rabbitCostPerRabbit, rabbitTotalMeatLbs } = stats;
  if (!totalLitters && !totalRabbitsButchered && !rabbitTotalCost) return null;

  return (
    <Card accent={palette.card}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 6 }}>
        🐇 Rabbits (Beta)
      </div>

      {totalLitters > 0 && (
        <>
          <CountUp number={totalKitsAlive} suffix="kits born alive" big />
          <div style={{ fontSize: 14, color: palette.inkSoft, marginBottom: 12 }}>
            From <strong style={{ color: palette.ink }}>{totalLitters}</strong> litter{totalLitters === 1 ? "" : "s"}
            {totalKitsStillborn > 0 && <> · {totalKitsStillborn} stillborn</>}
          </div>
        </>
      )}

      {totalRabbitsButchered > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Stat big={totalRabbitsButchered} label="rabbits butchered" accent={palette.feather} />
          {rabbitTotalMeatLbs > 0 && <Stat big={`${rabbitTotalMeatLbs.toFixed(1)} lbs`} label="in the freezer" accent={palette.leaf} />}
          {rabbitCostPerRabbit > 0 && <Stat big={fmtMoney(rabbitCostPerRabbit)} label="cost per rabbit" accent={palette.yolk} />}
        </div>
      )}

      {rabbitTotalCost > 0 && (
        <div style={{ padding: 10, background: palette.bgAlt, borderRadius: 8, fontSize: 12, color: palette.inkSoft, lineHeight: 1.6 }}>
          <strong style={{ color: palette.ink }}>Total spent on rabbits:</strong> {fmtMoney(rabbitTotalCost)}
        </div>
      )}
    </Card>
  );
}


function BeesCard({ stats }) {
  const { honeyHarvestedLbs, hiveInspections, hiveTreatments } = stats;
  if (!honeyHarvestedLbs && !hiveInspections) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🍯 Bees</div>
      {honeyHarvestedLbs > 0 && <CountUp number={Math.round(honeyHarvestedLbs)} suffix="lbs of honey harvested" big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {hiveInspections > 0 && <Stat big={hiveInspections} label="hive inspections" accent={palette.yolk}/>}
        {hiveTreatments > 0 && <Stat big={hiveTreatments} label="treatments" accent={palette.feather}/>}
      </div>
    </Card>
  );
}

function IncubatorCard({ stats }) {
  const { incubatorEggsSet, incubatorEggsHatched, avgHatchRate } = stats;
  if (!incubatorEggsSet) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🥚 Incubator</div>
      <CountUp number={incubatorEggsHatched} suffix="eggs hatched" big />
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        <Stat big={incubatorEggsSet} label="eggs set" accent={palette.yolk}/>
        {avgHatchRate && <Stat big={`${avgHatchRate}%`} label="avg hatch rate" accent={palette.leaf}/>}
      </div>
    </Card>
  );
}

function GoatsCard({ stats }) {
  const { goatMilkOz, goatKids, goatFeedCost, goatButchered, goatMeatLbs, goatCount } = stats;
  if (!goatMilkOz && !goatKids && !goatFeedCost) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🐐 Goats</div>
      {goatMilkOz > 0 && <CountUp number={Math.round(goatMilkOz/128)} suffix={`gallons of milk (${goatMilkOz.toFixed(0)} oz)`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {goatCount > 0 && <Stat big={goatCount} label="goats in herd" accent={palette.leaf}/>}
        {goatKids > 0 && <Stat big={goatKids} label="kids born" accent={palette.yolk}/>}
        {goatFeedCost > 0 && <Stat big={fmtMoney(goatFeedCost)} label="feed cost" accent={palette.feather}/>}
        {goatButchered > 0 && <Stat big={goatButchered} label="butchered" accent={palette.accent}/>}
        {goatMeatLbs > 0 && <Stat big={`${goatMeatLbs.toFixed(0)} lbs`} label="in the freezer" accent={palette.leaf}/>}
      </div>
    </Card>
  );
}

function CowsCard({ stats }) {
  const { cowMilkGal, cowCalves, cowFeedCost, cowButchered, cowMeatLbs, cowCount } = stats;
  if (!cowMilkGal && !cowCalves && !cowFeedCost) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🐄 Cows</div>
      {cowMilkGal > 0 && <CountUp number={Math.round(cowMilkGal)} suffix="gallons of milk" big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {cowCount > 0 && <Stat big={cowCount} label="cattle" accent={palette.leaf}/>}
        {cowCalves > 0 && <Stat big={cowCalves} label="calves born" accent={palette.yolk}/>}
        {cowFeedCost > 0 && <Stat big={fmtMoney(cowFeedCost)} label="feed cost" accent={palette.feather}/>}
        {cowButchered > 0 && <Stat big={cowButchered} label="butchered" accent={palette.accent}/>}
        {cowMeatLbs > 0 && <Stat big={`${cowMeatLbs.toFixed(0)} lbs`} label="in the freezer" accent={palette.leaf}/>}
      </div>
    </Card>
  );
}

function PigsCard({ stats }) {
  const { pigLitters, pigsButchered, pigMeatLbs, pigFeedCost, pigFCR, pigCount } = stats;
  if (!pigsButchered && !pigLitters && !pigFeedCost) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🐷 Pigs</div>
      {pigMeatLbs > 0 && <CountUp number={Math.round(pigMeatLbs)} suffix="lbs pork in the freezer" big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {pigCount > 0 && <Stat big={pigCount} label="pigs" accent={palette.leaf}/>}
        {pigsButchered > 0 && <Stat big={pigsButchered} label="butchered" accent={palette.accent}/>}
        {pigLitters > 0 && <Stat big={pigLitters} label="piglets born" accent={palette.yolk}/>}
        {pigFeedCost > 0 && <Stat big={fmtMoney(pigFeedCost)} label="feed cost" accent={palette.feather}/>}
        {pigFCR && <Stat big={pigFCR} label="feed conversion ratio" accent={palette.feather}/>}
      </div>
    </Card>
  );
}

function SheepCard({ stats }) {
  const { sheepCount, sheepLambsBorn, sheepLambsAlive, sheepMilkGal, sheepWoolLbs, sheepMeatLbs, sheepButchered } = stats;
  if (!sheepCount && !sheepLambsBorn && !sheepWoolLbs && !sheepMilkGal && !sheepButchered) return null;
  const lambSurvival = sheepLambsBorn > 0 ? Math.round((sheepLambsAlive / sheepLambsBorn) * 100) : null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🐑 Sheep</div>
      {sheepLambsBorn > 0 && <CountUp number={sheepLambsBorn} suffix={`lamb${sheepLambsBorn === 1 ? "" : "s"} born`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {sheepCount > 0 && <Stat big={sheepCount} label="live sheep" accent={palette.leaf}/>}
        {lambSurvival !== null && <Stat big={`${lambSurvival}%`} label="lamb survival" accent={lambSurvival >= 80 ? palette.leaf : palette.accent}/>}
        {sheepMilkGal > 0 && <Stat big={sheepMilkGal.toFixed(1)} label="gal milk" accent={palette.leafSoft}/>}
        {sheepWoolLbs > 0 && <Stat big={sheepWoolLbs.toFixed(1)} label="lbs wool" accent={palette.yolk}/>}
        {sheepMeatLbs > 0 && <Stat big={Math.round(sheepMeatLbs)} label="lbs meat" accent={palette.feather}/>}
        {sheepButchered > 0 && <Stat big={sheepButchered} label="butchered" accent={palette.accent}/>}
      </div>
    </Card>
  );
}

function SourdoughCard({ stats }) {
  const { sourdoughBakes, sourdoughLoaves, sourdoughTotalCost, sourdoughTopRecipe, sourdoughLoavesSold, sourdoughRevenue, sourdoughProfit } = stats;
  if (!sourdoughBakes && !sourdoughLoaves) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🍞 Sourdough</div>
      {sourdoughLoaves > 0 && <CountUp number={sourdoughLoaves} suffix={`loa${sourdoughLoaves === 1 ? "f" : "ves"} baked`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {sourdoughBakes > 0 && <Stat big={sourdoughBakes} label={`bake session${sourdoughBakes === 1 ? "" : "s"}`} accent={palette.leaf}/>}
        {sourdoughTotalCost > 0 && <Stat big={fmtMoney(sourdoughTotalCost)} label="ingredient cost" accent={palette.feather}/>}
        {sourdoughLoavesSold > 0 && <Stat big={sourdoughLoavesSold} label={`loa${sourdoughLoavesSold === 1 ? "f" : "ves"} sold`} accent={palette.yolk}/>}
        {sourdoughRevenue > 0 && <Stat big={fmtMoney(sourdoughRevenue)} label="revenue" accent={palette.leaf}/>}
        {sourdoughProfit !== 0 && <Stat big={fmtMoney(sourdoughProfit)} label="profit" accent={sourdoughProfit >= 0 ? palette.leaf : palette.accent}/>}
      </div>
      {sourdoughTopRecipe && (
        <div style={{ marginTop:12,fontSize:13,color:palette.inkSoft }}>
          Top recipe: <strong style={{ color:palette.ink }}>{sourdoughTopRecipe.name}</strong> — {sourdoughTopRecipe.loaves} loa{sourdoughTopRecipe.loaves === 1 ? "f" : "ves"}
        </div>
      )}
    </Card>
  );
}

function HorsesCard({ stats }) {
  const { horseCount, horseRides, horseRideHours, horseFoalsBorn, horseFoalsAlive, horseFarrierCount, horseVetCount, horseDewormCount, horseTotalCareCost, horseTopRider } = stats;
  if (!horseCount && !horseRides) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🐴 Horses</div>
      {horseRides > 0 && <CountUp number={horseRides} suffix={`ride${horseRides === 1 ? "" : "s"}`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {horseCount > 0 && <Stat big={horseCount} label="horses" accent={palette.feather}/>}
        {horseRideHours > 0 && <Stat big={horseRideHours.toFixed(1)} label="hours in saddle" accent={palette.yolk}/>}
        {horseFoalsBorn > 0 && <Stat big={horseFoalsBorn} label={`foal${horseFoalsBorn === 1 ? "" : "s"} born`} accent={palette.leaf}/>}
        {horseFarrierCount > 0 && <Stat big={horseFarrierCount} label={`farrier${horseFarrierCount === 1 ? "" : " visits"}`} accent={palette.feather}/>}
        {horseVetCount > 0 && <Stat big={horseVetCount} label={`vet${horseVetCount === 1 ? "" : " visits"}`} accent={palette.accent}/>}
        {horseDewormCount > 0 && <Stat big={horseDewormCount} label="dewormings" accent={palette.leafSoft}/>}
        {horseTotalCareCost > 0 && <Stat big={fmtMoney(horseTotalCareCost)} label="care cost" accent={palette.feather}/>}
      </div>
      {horseTopRider && (
        <div style={{ marginTop:12,fontSize:13,color:palette.inkSoft }}>
          Most-ridden horse: <strong style={{ color:palette.ink }}>{horseTopRider.name}</strong> — {horseTopRider.rides} ride{horseTopRider.rides === 1 ? "" : "s"}
        </div>
      )}
    </Card>
  );
}

function FarmstandCard({ stats }) {
  const { farmstandRevenue, farmstandCost, farmstandProfit, farmstandSaleCount, farmstandTopItem, farmstandItemCount } = stats;
  if (!farmstandSaleCount && !farmstandItemCount) return null;
  const margin = farmstandRevenue > 0 ? ((farmstandProfit / farmstandRevenue) * 100).toFixed(0) : null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🧾 Farmstand</div>
      {farmstandRevenue > 0 && (
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 48, color: palette.ink, lineHeight: 1, marginBottom: 4 }}>
          {fmtMoney(farmstandRevenue)} <span style={{ fontSize: 16, color: palette.inkSoft, fontFamily: FONT_BODY, fontWeight: 500 }}>in farmstand revenue</span>
        </div>
      )}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {farmstandSaleCount > 0 && <Stat big={farmstandSaleCount} label={`sale${farmstandSaleCount===1?"":"s"} this year`} accent={palette.leaf} />}
        {farmstandProfit !== 0 && <Stat big={fmtMoney(farmstandProfit)} label="total profit" accent={farmstandProfit >= 0 ? palette.leaf : palette.accent} />}
        {margin !== null && <Stat big={`${margin}%`} label="profit margin" accent={palette.feather} />}
        {farmstandItemCount > 0 && <Stat big={farmstandItemCount} label={`item${farmstandItemCount===1?"":"s"} on the stand`} accent={palette.yolk} />}
      </div>
      {farmstandTopItem && (
        <div style={{ marginTop:12,fontSize:13,color:palette.inkSoft }}>
          Top seller: <strong style={{ color:palette.ink }}>{farmstandTopItem.name}</strong> — {fmtMoney(farmstandTopItem.revenue)}
        </div>
      )}
    </Card>
  );
}

function BakingCard({ stats }) {
  const { bakingBakes, bakingItems, bakingTotalCost, bakingTopRecipe, bakingItemsSold, bakingRevenue, bakingProfit } = stats;
  if (!bakingBakes && !bakingItems) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🥧 Baking</div>
      {bakingItems > 0 && <CountUp number={bakingItems} suffix={`item${bakingItems === 1 ? "" : "s"} baked`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {bakingBakes > 0 && <Stat big={bakingBakes} label={`bake${bakingBakes === 1 ? "" : "s"} logged`} accent={palette.leaf}/>}
        {bakingTotalCost > 0 && <Stat big={fmtMoney(bakingTotalCost)} label="ingredient cost" accent={palette.feather}/>}
        {bakingItemsSold > 0 && <Stat big={bakingItemsSold} label={`item${bakingItemsSold === 1 ? "" : "s"} sold`} accent={palette.yolk}/>}
        {bakingRevenue > 0 && <Stat big={fmtMoney(bakingRevenue)} label="revenue" accent={palette.leaf}/>}
        {bakingProfit !== 0 && <Stat big={fmtMoney(bakingProfit)} label="profit" accent={bakingProfit >= 0 ? palette.leaf : palette.accent}/>}
      </div>
      {bakingTopRecipe && (
        <div style={{ marginTop:12,fontSize:13,color:palette.inkSoft }}>
          Top recipe: <strong style={{ color:palette.ink }}>{bakingTopRecipe.name}</strong> — {bakingTopRecipe.qty} item{bakingTopRecipe.qty === 1 ? "" : "s"}
        </div>
      )}
    </Card>
  );
}

function CanningCard({ stats }) {
  const { canningBatches, canningJarsMade, canningJarsInPantry, canningIngredientsCost, canningTopItem, canningJarsSold, canningRevenue, canningProfit } = stats;
  if (!canningBatches && !canningJarsMade) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🫙 Canning</div>
      {canningJarsMade > 0 && <CountUp number={canningJarsMade} suffix={`jar${canningJarsMade === 1 ? "" : "s"} canned`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {canningBatches > 0 && <Stat big={canningBatches} label={`batch${canningBatches === 1 ? "" : "es"}`} accent={palette.leaf}/>}
        {canningJarsInPantry > 0 && <Stat big={canningJarsInPantry} label="in pantry" accent={palette.leafSoft}/>}
        {canningIngredientsCost > 0 && <Stat big={fmtMoney(canningIngredientsCost)} label="ingredient cost" accent={palette.feather}/>}
        {canningJarsSold > 0 && <Stat big={canningJarsSold} label={`jar${canningJarsSold === 1 ? "" : "s"} sold`} accent={palette.yolk}/>}
        {canningRevenue > 0 && <Stat big={fmtMoney(canningRevenue)} label="revenue" accent={palette.leaf}/>}
        {canningProfit !== 0 && <Stat big={fmtMoney(canningProfit)} label="profit" accent={canningProfit >= 0 ? palette.leaf : palette.accent}/>}
      </div>
      {canningTopItem && (
        <div style={{ marginTop:12,fontSize:13,color:palette.inkSoft }}>
          Top batch: <strong style={{ color:palette.ink }}>{canningTopItem.name}</strong> — {canningTopItem.jars} jar{canningTopItem.jars === 1 ? "" : "s"}
        </div>
      )}
    </Card>
  );
}

function FreezerCard({ stats }) {
  const { freezerBirds, freezerLbs } = stats;
  if (!freezerBirds) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>❄️ Freezer log</div>
      <CountUp number={freezerBirds} suffix={`bird${freezerBirds===1?"":"s"} to the freezer`} big />
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {freezerLbs > 0 && <Stat big={freezerLbs.toFixed(1)} label="lbs total" accent={palette.feather} />}
      </div>
      <div style={{ marginTop:10,fontSize:12,color:palette.inkSoft,fontStyle:"italic" }}>
        Includes any bird butchered from your flocks — chickens, ducks, quail, geese, and more.
      </div>
    </Card>
  );
}

function DogsCard({ stats }) {
  const { dogCount, dogVetVisits, dogLitters, dogPuppiesBorn, dogAttacks } = stats;
  if (!dogCount && !dogVetVisits && !dogLitters && !dogAttacks) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🐕 Dogs</div>
      {dogCount > 0 && <CountUp number={dogCount} suffix={`dog${dogCount===1?"":"s"} in the pack`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {dogLitters > 0 && <Stat big={dogLitters} label={`litter${dogLitters===1?"":"s"}`} accent={palette.yolk}/>}
        {dogPuppiesBorn > 0 && <Stat big={dogPuppiesBorn} label="puppies born" accent={palette.leaf}/>}
        {dogVetVisits > 0 && <Stat big={dogVetVisits} label="vet/health visits" accent={palette.feather}/>}
        {dogAttacks > 0 && <Stat big={dogAttacks} label="attacks deterred" accent={palette.accent}/>}
      </div>
    </Card>
  );
}

function CatsCard({ stats }) {
  const { catCount, catVetVisits, catLitters, catKittensBorn, catKills } = stats;
  if (!catCount && !catVetVisits && !catLitters && !catKills) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🐈 Cats</div>
      {catCount > 0 && <CountUp number={catCount} suffix={`cat${catCount===1?"":"s"} on the homestead`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {catLitters > 0 && <Stat big={catLitters} label={`litter${catLitters===1?"":"s"}`} accent={palette.yolk}/>}
        {catKittensBorn > 0 && <Stat big={catKittensBorn} label="kittens born" accent={palette.leaf}/>}
        {catVetVisits > 0 && <Stat big={catVetVisits} label="vet/health visits" accent={palette.feather}/>}
        {catKills > 0 && <Stat big={catKills} label="pests caught" accent={palette.accent}/>}
      </div>
    </Card>
  );
}

function MapleSyrupCard({ stats }) {
  const { mapleSapGal, mapleSyrupGal, mapleTapsSet, mapleTotalCost } = stats;
  if (!mapleSapGal && !mapleSyrupGal && !mapleTapsSet) return null;
  const ratio = mapleSyrupGal > 0 && mapleSapGal > 0 ? (mapleSapGal / mapleSyrupGal).toFixed(1) : null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🍁 Maple Syrup</div>
      {mapleSyrupGal > 0 && <CountUp number={Number(mapleSyrupGal.toFixed(2))} suffix="gallons of syrup made" big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {mapleTapsSet > 0 && <Stat big={mapleTapsSet} label="taps set" accent={palette.feather}/>}
        {mapleSapGal > 0 && <Stat big={`${mapleSapGal.toFixed(0)} gal`} label="sap collected" accent={palette.leaf}/>}
        {ratio && <Stat big={`${ratio}:1`} label="sap to syrup" accent={palette.yolk}/>}
        {mapleTotalCost > 0 && <Stat big={fmtMoney(mapleTotalCost)} label="invested" accent={palette.accent}/>}
      </div>
    </Card>
  );
}

function DehydratingCard({ stats }) {
  const { dehyBatches, dehyOutputOz, dehyHours, dehyCost } = stats;
  if (!dehyBatches && !dehyOutputOz) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🌬️ Dehydrating</div>
      {dehyBatches > 0 && <CountUp number={dehyBatches} suffix={`batch${dehyBatches===1?"":"es"} dried`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {dehyOutputOz > 0 && <Stat big={`${dehyOutputOz.toFixed(0)} oz`} label="output total" accent={palette.leaf}/>}
        {dehyHours > 0 && <Stat big={`${dehyHours.toFixed(0)} hrs`} label="dryer running" accent={palette.feather}/>}
        {dehyCost > 0 && <Stat big={fmtMoney(dehyCost)} label="ingredients" accent={palette.accent}/>}
      </div>
    </Card>
  );
}

function FermentationCard({ stats }) {
  const { fermStartedCount, fermFinishedCount, fermStageLogs } = stats;
  if (!fermStartedCount && !fermStageLogs) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>🫧 Fermentation</div>
      {fermStartedCount > 0 && <CountUp number={fermStartedCount} suffix={`ferment${fermStartedCount===1?"":"s"} started`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {fermFinishedCount > 0 && <Stat big={fermFinishedCount} label="finished" accent={palette.leaf}/>}
        {fermStageLogs > 0 && <Stat big={fermStageLogs} label="stage logs" accent={palette.feather}/>}
      </div>
    </Card>
  );
}

function FreezeDryingCard({ stats }) {
  const { fdBatches, fdOutputOz, fdCycleHours, fdCost } = stats;
  if (!fdBatches && !fdOutputOz) return null;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize:11,letterSpacing:2,color:palette.inkSoft,textTransform:"uppercase",marginBottom:6 }}>❄️ Freeze Drying</div>
      {fdBatches > 0 && <CountUp number={fdBatches} suffix={`batch${fdBatches===1?"":"es"} freeze-dried`} big />}
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:8 }}>
        {fdOutputOz > 0 && <Stat big={`${fdOutputOz.toFixed(0)} oz`} label="output total" accent={palette.leaf}/>}
        {fdCycleHours > 0 && <Stat big={`${fdCycleHours.toFixed(0)} hrs`} label="cycle time" accent={palette.feather}/>}
        {fdCost > 0 && <Stat big={fmtMoney(fdCost)} label="ingredients" accent={palette.accent}/>}
      </div>
    </Card>
  );
}

function ActivityCard({ stats }) {
  const { totalEntries, busiestMonth, longestStreak, activeDays } = stats;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 6 }}>
        📔 Activity
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Stat big={totalEntries} label="entries logged" accent={palette.feather} />
        <Stat big={activeDays} label="active days" accent={palette.leaf} />
        {longestStreak > 1 && <Stat big={longestStreak} label="day longest streak" accent={palette.yolk} />}
      </div>
      {busiestMonth && (
        <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 12 }}>
          Busiest month: <strong style={{ color: palette.ink }}>{busiestMonth}</strong>
        </div>
      )}
    </Card>
  );
}

function WeatherCard({ stats }) {
  const { weatherStats } = stats;
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 10 }}>
        🌦️ Weather
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {/* fmtTemp() reads the user's temperature preference (F/C) from the
            shared units module and formats with the right unit symbol. Stored
            values in weather are always in Fahrenheit (highF/lowF field names
            from the weather API) — fmtTemp handles the conversion. */}
        {weatherStats.hottestDay && <Stat big={fmtTemp(weatherStats.hottestDay.highF)} label={`hottest · ${shortDate(weatherStats.hottestDay.date)}`} accent={palette.accent} />}
        {weatherStats.coldestDay && <Stat big={fmtTemp(weatherStats.coldestDay.lowF)} label={`coldest · ${shortDate(weatherStats.coldestDay.date)}`} accent="#7AA8B8" />}
        {weatherStats.totalRainIn > 0 && <Stat big={`${weatherStats.totalRainIn.toFixed(1)}"`} label="rain logged" accent={palette.leaf} />}
      </div>
    </Card>
  );
}

function PhotosCard({ stats }) {
  return (
    <Card accent={palette.card}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 10 }}>
        📷 Best moments
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {stats.photos.slice(0, 6).map((photoPath, i) => (
          <YearPhotoTile key={i} path={photoPath} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 10, textAlign: "center" }}>
        {stats.photos.length} photo{stats.photos.length === 1 ? "" : "s"} this year
      </div>
    </Card>
  );
}

function YearPhotoTile({ path }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let c = false;
    getPhotoUrl(path).then((u) => { if (!c) setUrl(u); });
    return () => { c = true; };
  }, [path]);
  return (
    <div style={{
      width: "100%", aspectRatio: "1 / 1", borderRadius: 6, overflow: "hidden",
      background: url ? `url(${url}) center/cover` : palette.bgAlt,
      border: `1px solid ${palette.line}`,
    }} />
  );
}

function FunFactsCard({ stats }) {
  const facts = [];
  if (stats.firstEntryDate) facts.push({ emoji: "🚀", label: "First entry", value: shortDate(stats.firstEntryDate) });
  if (stats.lastEntryDate && stats.lastEntryDate !== stats.firstEntryDate) facts.push({ emoji: "📅", label: "Most recent entry", value: shortDate(stats.lastEntryDate) });
  if (stats.heaviestDayCount > 1) facts.push({ emoji: "🔥", label: "Most active day", value: `${shortDate(stats.heaviestDay)} · ${stats.heaviestDayCount} entries` });
  if (stats.gardenWaterCount > 0) facts.push({ emoji: "💧", label: "Garden waterings", value: stats.gardenWaterCount });
  if (stats.totalFeedLbs > 0) facts.push({ emoji: "🌾", label: "Feed bought", value: `${Math.round(stats.totalFeedLbs)} lbs` });
  if (stats.totalFeedCost > 0) facts.push({ emoji: "💸", label: "Spent on feed", value: fmtMoney(stats.totalFeedCost) });
  if (stats.freeRangeCount > 0) facts.push({ emoji: "🌳", label: "Free-range days", value: stats.freeRangeCount });
  if (stats.photosCount > 0) facts.push({ emoji: "📷", label: "Photos taken", value: stats.photosCount });
  if (stats.issueCount > 0) facts.push({ emoji: "⚠️", label: "Issues logged", value: stats.issueCount });
  if (stats.plantingsCount > 0) facts.push({ emoji: "🌱", label: "Plantings", value: stats.plantingsCount });
  if (stats.harvestsCount > 0) facts.push({ emoji: "🧺", label: "Harvest trips", value: stats.harvestsCount });
  if (stats.entryCountByHobby) {
    const top = Object.entries(stats.entryCountByHobby).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 0) {
      const hobbyLabels = { garden: "Garden", egg_layers: "Egg Layers", meat_chickens: "Meat Birds", rabbits: "Rabbits", bees: "Bees", incubator: "Incubator", goats: "Goats", cows: "Cows", pigs: "Pigs", baking: "Baking", canning: "Canning" };
      facts.push({ emoji: "⭐", label: "Most-tracked hobby", value: `${hobbyLabels[top[0]] || top[0]} (${top[1]})` });
    }
  }
  if (facts.length === 0) return null;

  return (
    <Card accent={palette.card}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 12 }}>
        🎉 Fun facts
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
        {facts.map((f, i) => (
          <div key={i} style={{ padding: "10px 12px", background: palette.bgAlt, borderRadius: 8, border: `1px solid ${palette.line}` }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{f.emoji}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, lineHeight: 1.1, marginBottom: 2 }}>{f.value}</div>
            <div style={{ fontSize: 10, color: palette.inkSoft }}>{f.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FooterCard({ year }) {
  return (
    <Card accent={palette.bgAlt} style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>🌱</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 4 }}>Thanks for slow-building.</div>
      <div style={{ fontSize: 13, color: palette.inkSoft }}>See you in {year + 1}.</div>
    </Card>
  );
}

function CountUp({ number, suffix, big }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(number)) return;
    const duration = 800;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(number * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [number]);

  return (
    <div style={{ fontFamily: FONT_DISPLAY, fontSize: big ? 56 : 36, color: palette.ink, lineHeight: 1, marginBottom: 4 }}>
      {shown.toLocaleString()} <span style={{ fontSize: big ? 16 : 14, color: palette.inkSoft, fontFamily: FONT_BODY, fontWeight: 500 }}>{suffix}</span>
    </div>
  );
}

function Stat({ big, label, accent = palette.ink }) {
  return (
    <div style={{ flex: "1 1 110px", padding: 14, borderRadius: 10, background: palette.bgAlt, border: `1.5px solid ${palette.line}`, borderLeft: `4px solid ${accent}` }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: palette.ink, lineHeight: 1 }}>{big}</div>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4 }}>{label}</div>
    </div>
  );
}

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PASTURE_PRICES_BY_STATE = {
  "Hawaii": 11.00, "California": 9.50, "Alaska": 9.00, "New York": 8.50,
  "Massachusetts": 8.50, "Connecticut": 8.50, "New Jersey": 8.50, "Washington": 8.25,
  "Oregon": 8.00, "Vermont": 8.00, "Maine": 7.99, "New Hampshire": 7.99,
  "Rhode Island": 7.99, "Maryland": 7.75, "District of Columbia": 8.00,
  "Virginia": 7.50, "Pennsylvania": 7.50, "Florida": 7.50, "Colorado": 7.50,
  "Illinois": 7.25, "Texas": 7.00, "Arizona": 7.00, "Nevada": 7.50,
  "Michigan": 7.00, "Ohio": 6.99, "Indiana": 6.75, "Wisconsin": 6.99,
  "Minnesota": 6.99, "North Carolina": 6.50, "South Carolina": 6.50,
  "Georgia": 6.50, "Tennessee": 6.25, "New Mexico": 6.50, "Utah": 6.75,
  "Idaho": 6.50, "Montana": 6.50, "Wyoming": 6.50, "North Dakota": 6.25,
  "South Dakota": 6.25, "Nebraska": 6.00, "Kansas": 5.99, "Iowa": 5.99,
  "Missouri": 5.99, "Kentucky": 5.75, "West Virginia": 5.75, "Oklahoma": 5.75,
  "Arkansas": 5.50, "Alabama": 5.50, "Louisiana": 5.50, "Mississippi": 5.25,
  "Delaware": 6.99,
};
const PASTURE_PRICE_DEFAULT = 7.99;

function pickRegionalEggPrice(location) {
  if (!location || !location.label) return PASTURE_PRICE_DEFAULT;
  const parts = location.label.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (PASTURE_PRICES_BY_STATE[part] != null) return PASTURE_PRICES_BY_STATE[part];
  }
  return PASTURE_PRICE_DEFAULT;
}

function shortDate(dateStr) {
  if (!dateStr) return "";
  // Parse "YYYY-MM-DD" as local time, not UTC. `new Date("2026-05-10")` is
  // UTC midnight which, for west-coast users, displays as May 9th. We
  // explicitly construct from year/month/day to stay in local time.
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return `${monthLabels[dt.getMonth()]} ${dt.getDate()}`;
  }
  const d = new Date(dateStr);
  return `${monthLabels[d.getMonth()]} ${d.getDate()}`;
}

// Helper for the other two places that need local-time parsing of YYYY-MM-DD
function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  return new Date(dateStr);
}

function collectYears(data) {
  const years = new Set();
  Object.values(data.entries || {}).forEach((arr) => {
    (arr || []).forEach((e) => { if (e.date) years.add(parseInt(e.date.slice(0, 4))); });
  });
  (data.hobbies || []).forEach((h) => {
    (h.archivedSeasons || []).forEach((s) => {
      (s.finalEntries || []).forEach((e) => { if (e.date) years.add(parseInt(e.date.slice(0, 4))); });
    });
    (h.archivedBatches || []).forEach((b) => {
      (b.finalEntries || []).forEach((e) => { if (e.date) years.add(parseInt(e.date.slice(0, 4))); });
    });
  });
  return Array.from(years).filter((y) => !isNaN(y)).sort((a, b) => b - a);
}

function computeStats(data, year) {
  const yearStr = String(year);
  const inYear = (e) => e.date && e.date.startsWith(yearStr);

  const allEntries = [];
  (data.hobbies || []).forEach((h) => {
    const live = (data.entries[h.id] || []).filter(inYear);
    allEntries.push(...live.map((e) => ({ ...e, hobbyType: h.type })));
    (h.archivedSeasons || []).forEach((s) => {
      const fe = (s.finalEntries || []).filter(inYear);
      allEntries.push(...fe.map((e) => ({ ...e, hobbyType: h.type })));
    });
    (h.archivedBatches || []).forEach((b) => {
      const fe = (b.finalEntries || []).filter(inYear);
      allEntries.push(...fe.map((e) => ({ ...e, hobbyType: h.type })));
    });
  });

  // Eggs
  const eggLaidEntries = allEntries.filter((e) => e.action === "eggs_laid" || e.action === "eggs");
  const eggsCollected = eggLaidEntries.reduce((s, e) => s + (Number(e.count) || 0), 0);
  const dozensCollected = eggsCollected / 12;
  // Eggs sold revenue + count. Pulls from BOTH data.entries (legacy
  // sold_eggs action) AND data.sales (new sales flow writes here with
  // hobbyType="eggs"). Dedupes by id so a migrated entry that appears
  // in both places only counts once. Uses a shape-tolerant derivation
  // for unit-based entries (e.g. "2 dozen at $5/dz" with count=0).
  // The derivation logic mirrors deriveSoldEggsRevenue in Sales.jsx.
  const deriveSoldEggsRevenue = (e) => {
    let qty = Number(e.count ?? e.qty) || 0;
    let pricePerDozen = Number(e.pricePerDozen) || 0;
    let revenue = 0;
    if (pricePerDozen > 0 && qty > 0) {
      revenue = (qty / 12) * pricePerDozen;
    } else if (Number(e.unitQty) > 0 && Number(e.pricePerUnit) > 0) {
      const unitToCount = {
        single: 1, half_dozen: 6, dozen: 12, eighteen: 18, flat: 30,
        custom: Number(e.customEggsPerUnit) || 0,
      };
      const eggsPerUnit = unitToCount[e.unit] || 12;
      const totalEggs = Number(e.unitQty) * eggsPerUnit;
      revenue = Number(e.unitQty) * Number(e.pricePerUnit);
      if (totalEggs > 0) {
        pricePerDozen = revenue / (totalEggs / 12);
        if (qty === 0) qty = totalEggs;
      }
    } else if (Number(e.pricePerUnit) > 0 && qty > 0) {
      // Old shape — pricePerUnit was stored as $/dozen with eggs in count
      pricePerDozen = Number(e.pricePerUnit);
      revenue = (qty / 12) * pricePerDozen;
    } else if (Number(e.totalRevenue) > 0) {
      revenue = Number(e.totalRevenue);
      if (qty > 0) pricePerDozen = revenue / (qty / 12);
    }
    return { qty, revenue };
  };

  // Source 1: legacy sold_eggs entries on data.entries[egg_layers_id]
  const legacySoldEggsEntries = allEntries.filter((e) => e.action === "sold_eggs");
  // Source 2: new sales rows with hobbyType="eggs" (the canonical home for eggs sales now)
  const salesSourcedEggs = (data.sales || [])
    .filter((s) => s && s.hobbyType === "eggs" && inYear(s));
  // Dedupe by id — migrations sometimes copy a record from entries → sales.
  const seenIds = new Set(legacySoldEggsEntries.map((e) => e.id));
  const soldEggsEntries = [
    ...legacySoldEggsEntries,
    ...salesSourcedEggs.filter((s) => !seenIds.has(s.id)),
  ];
  let eggsSold = 0;
  let eggRevenue = 0;
  soldEggsEntries.forEach((e) => {
    const d = deriveSoldEggsRevenue(e);
    eggsSold += d.qty;
    eggRevenue += d.revenue;
  });
  const eggLayerFeedCost = allEntries.filter((e) => e.action === "fed" && e.hobbyType === "egg_layers").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const eggLayerInfraCost = allEntries.filter((e) => e.action === "infrastructure" && e.hobbyType === "egg_layers").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  let eggLayerBirdCost = 0;
  (data.hobbies || []).forEach((h) => {
    if (h.type !== "egg_layers") return;
    (h.flockHistory || []).forEach((fh) => {
      if (fh.date && fh.date.startsWith(yearStr)) eggLayerBirdCost += Number(fh.cost) || 0;
    });
  });
  const eggLayerTotalCost = eggLayerFeedCost + eggLayerInfraCost + eggLayerBirdCost;
  const eggLayerCostPerDozen = dozensCollected > 0 ? eggLayerTotalCost / dozensCollected : 0;
  const benchmarkPricePerDozen = (data.eggBenchmarkPricePerDozen != null && data.eggBenchmarkPricePerDozen > 0) ? Number(data.eggBenchmarkPricePerDozen) : pickRegionalEggPrice(data.homesteadLocation);
  const groceryStoreEquivalent = dozensCollected * benchmarkPricePerDozen;
  const moneySavedVsBuying = groceryStoreEquivalent - eggLayerTotalCost;

  const eggRevenueByMonth = {};
  for (let m = 0; m < 12; m++) eggRevenueByMonth[m] = { collected: 0 };
  eggLaidEntries.forEach((e) => { const m = parseLocalDate(e.date).getMonth(); eggRevenueByMonth[m].collected += Number(e.count) || 0; });
  let peakEggMonth = null, peakEggMonthCount = 0;
  for (let m = 0; m < 12; m++) {
    if (eggRevenueByMonth[m].collected > peakEggMonthCount) { peakEggMonthCount = eggRevenueByMonth[m].collected; peakEggMonth = monthLabels[m]; }
  }

  // Garden
  const harvestEntries = allEntries.filter((e) => e.action === "harvested");
  const totalHarvestLbs = harvestEntries.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
  const harvestsCount = harvestEntries.length;
  const plantingsCount = allEntries.filter((e) => e.action === "planted").length;
  const plantTotals = {};
  harvestEntries.forEach((e) => {
    const name = (e.plant || "Unknown").trim();
    if (!name) return;
    plantTotals[name] = (plantTotals[name] || 0) + (Number(e.quantity) || 0);
  });
  const topPlants = Object.entries(plantTotals).map(([plant, lbs]) => ({ plant, lbs })).sort((a, b) => b.lbs - a.lbs);

  // Meat chickens
  const meatChickenFeedCost = allEntries.filter((e) => e.action === "fed" && e.hobbyType === "meat_chickens").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const meatChickenInfraCost = allEntries.filter((e) => e.action === "infrastructure" && e.hobbyType === "meat_chickens").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  let meatChickenChickCost = 0;
  (data.hobbies || []).forEach((h) => {
    if (h.type !== "meat_chickens") return;
    if (h.currentBatch && h.currentBatch.startDate && h.currentBatch.startDate.startsWith(yearStr)) meatChickenChickCost += Number(h.currentBatch.chickCost) || 0;
    (h.archivedBatches || []).forEach((b) => { if (b.startDate && b.startDate.startsWith(yearStr)) meatChickenChickCost += Number(b.chickCost) || 0; });
  });
  const meatChickenTotalCost = meatChickenFeedCost + meatChickenInfraCost + meatChickenChickCost;
  const butcherEntries = allEntries.filter((e) => e.action === "butcher" && e.hobbyType === "meat_chickens");
  const birdsButchered = butcherEntries.reduce((s, e) => s + (Number(e.count) || 0), 0);
  const totalMeatLbs = butcherEntries.reduce((s, e) => s + (Number(e.count) || 0) * (Number(e.avgWeight) || 0), 0);
  const meatCostPerLb = totalMeatLbs > 0 ? meatChickenTotalCost / totalMeatLbs : 0;
  const birdDeaths = allEntries.filter((e) => e.action === "death" && e.hobbyType === "meat_chickens").reduce((s, e) => s + (Number(e.count) || 1), 0);
  let birdsRaised = 0;
  (data.hobbies || []).forEach((h) => {
    if (h.type !== "meat_chickens") return;
    if (h.currentBatch && h.currentBatch.startDate && h.currentBatch.startDate.startsWith(yearStr)) birdsRaised += Number(h.currentBatch.startCount) || 0;
    (h.archivedBatches || []).forEach((b) => { if (b.startDate && b.startDate.startsWith(yearStr)) birdsRaised += Number(b.startCount) || 0; });
  });
  const mortalityRate = birdsRaised > 0 ? (birdDeaths / birdsRaised) * 100 : 0;
  const birdsSurvived = Math.max(0, birdsRaised - birdDeaths);

  // Rabbits
  const rabbitEntries = allEntries.filter((e) => e.hobbyType === "rabbits");
  const litterEntries = rabbitEntries.filter((e) => e.action === "litter");
  const totalLitters = litterEntries.length;
  const totalKitsAlive = litterEntries.reduce((s, e) => s + (Number(e.kitsAlive) || 0), 0);
  const totalKitsStillborn = litterEntries.reduce((s, e) => s + (Number(e.kitsStillborn) || 0), 0);
  const rabbitButcherEntries = rabbitEntries.filter((e) => e.action === "butcher");
  const totalRabbitsButchered = rabbitButcherEntries.reduce((s, e) => s + (Number(e.count) || 0), 0);
  const rabbitTotalMeatLbs = rabbitButcherEntries.reduce((s, e) => s + (Number(e.count) || 0) * (Number(e.avgWeight) || 0), 0);
  const rabbitTotalCost = rabbitEntries.filter((e) => e.action === "fed" || e.action === "infrastructure").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const rabbitCostPerRabbit = totalRabbitsButchered > 0 ? rabbitTotalCost / totalRabbitsButchered : 0;

  // Bees
  const beeEntries = allEntries.filter(e => e.hobbyType === "bees");
  const honeyHarvestedLbs = beeEntries.filter(e => e.action === "harvest").reduce((s,e) => s+(Number(e.lbs)||0), 0);
  const hiveInspections = beeEntries.filter(e => e.action === "inspect").length;
  const hiveTreatments = beeEntries.filter(e => e.action === "treatment").length;

  // Incubator
  const incubatorHobby = (data.hobbies||[]).find(h => h.type === "incubator");
  const incubatorRuns = incubatorHobby?.runs || [];
  const yearRuns = incubatorRuns.filter(r => r.dateSet && r.dateSet.startsWith(yearStr));
  const incubatorEggsSet = yearRuns.reduce((s,r) => s+(Number(r.eggsSet)||0), 0);
  const completedRuns = yearRuns.filter(r => r.eggsHatched != null);
  const incubatorEggsHatched = completedRuns.reduce((s,r) => s+(Number(r.eggsHatched)||0), 0);
  const avgHatchRate = completedRuns.length > 0
    ? (completedRuns.reduce((s,r) => s+(r.eggsHatched/r.eggsSet)*100, 0) / completedRuns.length).toFixed(0)
    : null;

  // Goats
  const goatEntries = allEntries.filter(e => e.hobbyType === "goats");
  const goatMilkOz = goatEntries.filter(e => e.action === "milk").reduce((s,e) => s+(Number(e.oz)||0), 0);
  const goatKids = goatEntries.filter(e => e.action === "kid").reduce((s,e) => s+(Number(e.count)||1), 0);
  const goatFeedCost = goatEntries.filter(e => e.action === "fed").reduce((s,e) => s+(Number(e.cost)||0), 0);
  const goatButchered = goatEntries.filter(e => e.action === "butcher").length;
  const goatMeatLbs = goatEntries.filter(e => e.action === "butcher").reduce((s,e) => s+(Number(e.weight)||0), 0);
  const goatsHobby = (data.hobbies||[]).find(h => h.type === "goats");
  const goatCount = (goatsHobby?.animals||[]).length;

  // Cows
  const cowEntries = allEntries.filter(e => e.hobbyType === "cows");
  const cowMilkGal = cowEntries.filter(e => e.action === "milk").reduce((s,e) => s+(Number(e.gallons)||0), 0);
  const cowCalves = cowEntries.filter(e => e.action === "calf").reduce((s,e) => s+(Number(e.count)||1), 0);
  const cowFeedCost = cowEntries.filter(e => e.action === "fed").reduce((s,e) => s+(Number(e.cost)||0), 0);
  const cowButchered = cowEntries.filter(e => e.action === "butcher").length;
  const cowMeatLbs = cowEntries.filter(e => e.action === "butcher").reduce((s,e) => s+(Number(e.weight)||0), 0);
  const cowsHobby = (data.hobbies||[]).find(h => h.type === "cows");
  const cowCount = (cowsHobby?.animals||[]).length;

  // Pigs
  const pigEntries = allEntries.filter(e => e.hobbyType === "pigs");
  const pigLitters = pigEntries.filter(e => e.action === "litter").reduce((s,e) => s+(Number(e.count)||1), 0);
  const pigsButchered = pigEntries.filter(e => e.action === "butcher").length;
  const pigMeatLbs = pigEntries.filter(e => e.action === "butcher").reduce((s,e) => s+(Number(e.weight)||0), 0);
  const pigFeedCost = pigEntries.filter(e => e.action === "fed").reduce((s,e) => s+(Number(e.cost)||0), 0);
  const pigFeedLbs = pigEntries.filter(e => e.action === "fed").reduce((s,e) => s+(Number(e.lbs)||0), 0);
  const pigFCR = pigFeedLbs > 0 && pigMeatLbs > 0 ? (pigFeedLbs/pigMeatLbs).toFixed(2) : null;
  const pigsHobby = (data.hobbies||[]).find(h => h.type === "pigs");
  const pigCount = (pigsHobby?.animals||[]).length;

  // Farmstand — sales for this year tagged as farmstand
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const farmstandSales = (data.sales || []).filter(s =>
    s.hobbyType === "farmstand" && s.date >= yearStart && s.date <= yearEnd
  );
  const farmstandRevenue = farmstandSales.reduce((s, x) => s + (Number(x.totalRevenue) || 0), 0);
  const farmstandCost = farmstandSales.reduce((s, x) => s + (Number(x.totalCost) || 0), 0);
  const farmstandProfit = farmstandRevenue - farmstandCost;
  const farmstandSaleCount = farmstandSales.length;
  // Top item by revenue
  const farmstandByItem = {};
  farmstandSales.forEach(s => {
    const name = s.crop || "Other";
    farmstandByItem[name] = (farmstandByItem[name] || 0) + (Number(s.totalRevenue) || 0);
  });
  const farmstandTopItemEntry = Object.entries(farmstandByItem).sort((a,b) => b[1]-a[1])[0];
  const farmstandTopItem = farmstandTopItemEntry ? { name: farmstandTopItemEntry[0], revenue: farmstandTopItemEntry[1] } : null;
  const farmstandHobby = (data.hobbies||[]).find(h => h.type === "farmstand");
  const farmstandItemCount = (farmstandHobby?.items || []).filter(i => !i.archived).length;

  // Sheep stats
  const sheepHobby = (data.hobbies||[]).find(h => h.type === "sheep");
  const sheepCount = (sheepHobby?.animals || []).filter(a => !a.archived).length;
  const sheepEntries = (data.entries["sheep"] || []).filter(e => e.date >= yearStart && e.date <= yearEnd);
  const sheepMilkOz = sheepEntries.filter(e => e.action === "milk").reduce((s,e) => s + (Number(e.oz)||0), 0);
  const sheepMilkGal = sheepMilkOz / 128;
  const sheepButcherEntries = sheepEntries.filter(e => e.action === "butcher");
  const sheepButchered = sheepButcherEntries.length;
  const sheepMeatLbs = sheepButcherEntries.reduce((s,e) => s + (Number(e.weight)||0), 0);
  const yearLambings = (sheepHobby?.breedings || []).filter(b => b.lambedDate && b.lambedDate >= yearStart && b.lambedDate <= yearEnd);
  const sheepLambsBorn = yearLambings.reduce((s,b) => s + (Number(b.lambsBorn)||0), 0);
  const sheepLambsAlive = yearLambings.reduce((s,b) => s + (Number(b.lambsAlive)||0), 0);
  const yearShearings = (sheepHobby?.shearings || []).filter(sh => sh.date >= yearStart && sh.date <= yearEnd);
  const sheepWoolLbs = yearShearings.reduce((s,sh) => s + (Number(sh.woolLbs)||0), 0);

  // Sourdough stats
  const sourdoughHobby = (data.hobbies||[]).find(h => h.type === "sourdough");
  const yearBakes = (sourdoughHobby?.bakes || []).filter(b => b.date && b.date >= yearStart && b.date <= yearEnd);
  const sourdoughBakes = yearBakes.length;
  const sourdoughLoaves = yearBakes.reduce((s,b) => s + (Number(b.loafCount)||0), 0);
  const sourdoughTotalCost = yearBakes.reduce((s,b) => s + (Number(b.loafCount)||0) * (Number(b.costPerLoaf)||0), 0);
  // Top recipe
  const sourdoughByRecipe = {};
  yearBakes.forEach(b => {
    const r = b.recipe || "Other";
    sourdoughByRecipe[r] = (sourdoughByRecipe[r]||0) + (Number(b.loafCount)||0);
  });
  const sourdoughTopEntry = Object.entries(sourdoughByRecipe).sort((a,b)=>b[1]-a[1])[0];
  const sourdoughTopRecipe = sourdoughTopEntry ? { name: sourdoughTopEntry[0], loaves: sourdoughTopEntry[1] } : null;
  // Sales tagged sourdough this year
  const sourdoughSales = (data.sales || []).filter(s =>
    s.hobbyType === "sourdough" && s.date >= yearStart && s.date <= yearEnd
  );
  const sourdoughLoavesSold = sourdoughSales.reduce((s,x) => s + (Number(x.qty)||0), 0);
  const sourdoughRevenue = sourdoughSales.reduce((s,x) => s + (Number(x.totalRevenue)||0), 0);
  const sourdoughSaleCost = sourdoughSales.reduce((s,x) => s + (Number(x.totalCost)||0), 0);
  const sourdoughProfit = sourdoughRevenue - sourdoughSaleCost;

  // Baking stats — bakes live in data.entries["baking"]; sales tagged hobbyType="baking"
  const yearBakingEntries = ((data.entries || {})["baking"] || []).filter(b => b.date && b.date >= yearStart && b.date <= yearEnd);
  const bakingBakes = yearBakingEntries.length;
  const bakingItems = yearBakingEntries.reduce((s,b) => s + (Number(b.qty)||0), 0);
  const bakingTotalCost = yearBakingEntries.reduce((s,b) => s + (Number(b.cost)||0), 0);
  const bakingByRecipe = {};
  yearBakingEntries.forEach(b => {
    const r = b.recipeName || "Other";
    bakingByRecipe[r] = (bakingByRecipe[r]||0) + (Number(b.qty)||0);
  });
  const bakingTopEntry = Object.entries(bakingByRecipe).sort((a,b)=>b[1]-a[1])[0];
  const bakingTopRecipe = bakingTopEntry ? { name: bakingTopEntry[0], qty: bakingTopEntry[1] } : null;
  const bakingSales = (data.sales || []).filter(s =>
    s.hobbyType === "baking" && s.date >= yearStart && s.date <= yearEnd
  );
  const bakingItemsSold = bakingSales.reduce((s,x) => s + (Number(x.qty)||0), 0);
  const bakingRevenue = bakingSales.reduce((s,x) => s + (Number(x.totalRevenue)||0), 0);
  const bakingSaleCost = bakingSales.reduce((s,x) => s + (Number(x.totalCost)||0), 0);
  const bakingProfit = bakingRevenue - bakingSaleCost;

  // Canning stats — batches live on hobby.batches; pantry total uses all active
  // batches (not just this year's) since jars made earlier may still be eaten now
  const canningHobby = (data.hobbies||[]).find(h => h.type === "canning");
  const canningBatchesAll = Array.isArray(canningHobby?.batches) ? canningHobby.batches : [];
  const yearCanningBatches = canningBatchesAll.filter(b => b.date && b.date >= yearStart && b.date <= yearEnd);
  const canningBatches = yearCanningBatches.length;
  const canningJarsMade = yearCanningBatches.reduce((s,b) => s + (Number(b.jarsMade)||0), 0);
  const canningIngredientsCost = yearCanningBatches.reduce((s,b) => s + (Number(b.ingredientsCost)||0), 0);
  const canningJarsInPantry = canningBatchesAll
    .filter(b => !b.archived)
    .reduce((s,b) => s + (Number(b.jarsRemaining)||0), 0);
  const canningByItem = {};
  yearCanningBatches.forEach(b => {
    const k = b.item || "Other";
    canningByItem[k] = (canningByItem[k]||0) + (Number(b.jarsMade)||0);
  });
  const canningTopEntry = Object.entries(canningByItem).sort((a,b)=>b[1]-a[1])[0];
  const canningTopItem = canningTopEntry ? { name: canningTopEntry[0], jars: canningTopEntry[1] } : null;
  const canningSales = (data.sales || []).filter(s =>
    s.hobbyType === "canning" && s.date >= yearStart && s.date <= yearEnd
  );
  const canningJarsSold = canningSales.reduce((s,x) => s + (Number(x.qty)||0), 0);
  const canningRevenue = canningSales.reduce((s,x) => s + (Number(x.totalRevenue)||0), 0);
  const canningSaleCost = canningSales.reduce((s,x) => s + (Number(x.totalCost)||0), 0);
  const canningProfit = canningRevenue - canningSaleCost;

  // Horse stats
  const horsesHobby = (data.hobbies||[]).find(h => h.type === "horses");
  const horseCount = (horsesHobby?.animals || []).filter(h => !h.archived).length;
  const yearRides = (horsesHobby?.rides || []).filter(r => r.date && r.date >= yearStart && r.date <= yearEnd);
  const horseRides = yearRides.length;
  const horseRideMinutes = yearRides.reduce((s,r) => s + (Number(r.durationMinutes)||0), 0);
  const horseRideHours = horseRideMinutes / 60;
  // Most-ridden horse
  const ridesByHorse = {};
  yearRides.forEach(r => {
    if (!r.horseId) return;
    ridesByHorse[r.horseId] = (ridesByHorse[r.horseId]||0) + 1;
  });
  const topRiderEntry = Object.entries(ridesByHorse).sort((a,b)=>b[1]-a[1])[0];
  const horseTopRider = topRiderEntry ? (() => {
    const h = (horsesHobby?.animals || []).find(x => x.id === topRiderEntry[0]);
    return h ? { name: h.name, rides: topRiderEntry[1] } : null;
  })() : null;
  // Care logs in this year
  const yearFarrier = (horsesHobby?.farrier || []).filter(r => r.date && r.date >= yearStart && r.date <= yearEnd);
  const yearVet = (horsesHobby?.vet || []).filter(r => r.date && r.date >= yearStart && r.date <= yearEnd);
  const yearDeworm = (horsesHobby?.deworming || []).filter(r => r.date && r.date >= yearStart && r.date <= yearEnd);
  const horseFarrierCount = yearFarrier.length;
  const horseVetCount = yearVet.length;
  const horseDewormCount = yearDeworm.length;
  const horseTotalCareCost =
    yearFarrier.reduce((s,r) => s + (Number(r.cost)||0), 0) +
    yearVet.reduce((s,r) => s + (Number(r.cost)||0), 0) +
    yearDeworm.reduce((s,r) => s + (Number(r.cost)||0), 0);
  // Foaling in this year
  const yearFoalings = (horsesHobby?.breedings || []).filter(b => b.foaledDate && b.foaledDate >= yearStart && b.foaledDate <= yearEnd);
  const horseFoalsBorn = yearFoalings.reduce((s,b) => s + (Number(b.foalsBorn)||0), 0);
  const horseFoalsAlive = yearFoalings.reduce((s,b) => s + (Number(b.foalsAlive)||0), 0);

  // Freezer log — universal butcher records this year
  const freezerLogYear = (data.freezerLog || []).filter(r =>
    r.date >= yearStart && r.date <= yearEnd
  );
  const freezerBirds = freezerLogYear.reduce((s, r) => s + (Number(r.count) || 0), 0);
  const freezerLbs = freezerLogYear.reduce((s, r) => s + ((Number(r.count) || 0) * (Number(r.avgWeight) || 0)), 0);

  // Activity
  const datesSet = new Set(allEntries.map((e) => e.date));
  const activeDays = datesSet.size;
  const totalEntries = allEntries.length;
  const monthCounts = new Array(12).fill(0);
  allEntries.forEach((e) => { if (e.date) monthCounts[parseLocalDate(e.date).getMonth()]++; });
  let busiestMonthIdx = -1, busiestCount = 0;
  monthCounts.forEach((c, i) => { if (c > busiestCount) { busiestCount = c; busiestMonthIdx = i; } });
  const busiestMonth = busiestMonthIdx >= 0 ? monthLabels[busiestMonthIdx] : null;

  const sortedDays = Array.from(datesSet).sort();
  let longestStreak = 0, currentStreak = 0, prevDate = null;
  sortedDays.forEach((d) => {
    if (prevDate) { const diff = (parseLocalDate(d) - parseLocalDate(prevDate)) / (1000 * 60 * 60 * 24); if (diff === 1) currentStreak++; else currentStreak = 1; }
    else currentStreak = 1;
    if (currentStreak > longestStreak) longestStreak = currentStreak;
    prevDate = d;
  });

  const firstEntryDate = sortedDays[0] || null;
  const lastEntryDate = sortedDays[sortedDays.length - 1] || null;
  const entryCountByHobby = {};
  allEntries.forEach((e) => { const t = e.hobbyType || "other"; entryCountByHobby[t] = (entryCountByHobby[t] || 0) + 1; });
  const gardenWaterCount = allEntries.filter((e) => e.action === "watered" && e.hobbyType === "garden").length;
  const freeRangeCount = allEntries.filter((e) => e.action === "free_range").length;
  const totalFeedLbs = allEntries.filter((e) => e.action === "fed").reduce((s, e) => s + (Number(e.lbs) || 0), 0);
  // Chicken tractor: sum distanceFeet across all move_tractor entries in the
  // year. Egg layers and meat birds both use the same action. The per-entry
  // distanceFeet preserves history if the user later changes their default.
  const tractorEntries = allEntries.filter((e) => e.action === "move_tractor");
  const tractorFeet = tractorEntries.reduce((s, e) => s + (Number(e.distanceFeet) || 0), 0);
  const tractorMoveCount = tractorEntries.length;
  const totalFeedCost = allEntries.filter((e) => e.action === "fed").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const photosCount = allEntries.filter((e) => e.photoPath).length;
  const issueCount = allEntries.filter((e) => e.action === "issue").length;
  const entriesByDate = {};
  allEntries.forEach((e) => { if (!e.date) return; entriesByDate[e.date] = (entriesByDate[e.date] || 0) + 1; });
  const heaviestDayCount = Math.max(0, ...Object.values(entriesByDate));
  const heaviestDay = Object.entries(entriesByDate).find(([, c]) => c === heaviestDayCount)?.[0];

  const withWeather = allEntries.filter((e) => e.weather);
  let weatherStats = null;
  if (withWeather.length > 0) {
    let hottestDay = null, coldestDay = null, totalRainIn = 0;
    withWeather.forEach((e) => {
      const w = e.weather;
      if (w.highF != null && (!hottestDay || w.highF > hottestDay.highF)) hottestDay = { date: e.date, highF: w.highF };
      if (w.lowF != null && (!coldestDay || w.lowF < coldestDay.lowF)) coldestDay = { date: e.date, lowF: w.lowF };
    });
    const rainByDate = {};
    withWeather.forEach((e) => { if (e.weather.precipIn != null) rainByDate[e.date] = e.weather.precipIn; });
    totalRainIn = Object.values(rainByDate).reduce((s, p) => s + p, 0);
    weatherStats = { hottestDay, coldestDay, totalRainIn };
  }

  const photos = allEntries.filter((e) => e.photoPath).sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((e) => e.photoPath);

  // ---- Dogs ----
  const dogsHobby = (data.hobbies || []).find(h => h.type === "dogs");
  const dogEntries = allEntries.filter(e => e.hobbyType === "dogs");
  const dogCount = (dogsHobby?.animals || []).filter(a => !a.archived).length;
  const dogVetVisits = dogEntries.filter(e => e.action === "health").length;
  const dogLitters = (dogsHobby?.litters || []).filter(l => (l.whelpDate || "").startsWith(String(year))).length;
  const dogPuppiesBorn = (dogsHobby?.litters || []).filter(l => (l.whelpDate || "").startsWith(String(year))).reduce((s, l) => s + (Number(l.totalBorn) || (l.puppies || []).length), 0);
  // LGD attacks-prevented count this year
  const dogAttacks = (dogsHobby?.attacks || []).filter(a => (a.date || "").startsWith(String(year))).length;

  // ---- Cats ----
  const catsHobby = (data.hobbies || []).find(h => h.type === "cats");
  const catEntries = allEntries.filter(e => e.hobbyType === "cats");
  const catCount = (catsHobby?.animals || []).filter(a => !a.archived).length;
  const catVetVisits = catEntries.filter(e => e.action === "health").length;
  const catLitters = (catsHobby?.litters || []).filter(l => (l.whelpDate || l.birthDate || "").startsWith(String(year))).length;
  const catKittensBorn = (catsHobby?.litters || []).filter(l => (l.whelpDate || l.birthDate || "").startsWith(String(year))).reduce((s, l) => s + (Number(l.totalBorn) || (l.puppies || l.kittens || []).length), 0);
  // Barn cat pest catches this year (Cats reuses the attacks shape)
  const catKills = (catsHobby?.attacks || []).filter(a => (a.date || "").startsWith(String(year))).length;

  // ---- Maple Syrup ----
  // MapleSyrup is season-based; entries carry seasonId. For year-in-review we
  // sum across all entries that fall in this calendar year regardless of season.
  const mapleEntries = allEntries.filter(e => e.hobbyType === "maple_syrup");
  const mapleSapGal = mapleEntries.filter(e => e.action === "sap_collected").reduce((s, e) => s + (Number(e.gallons) || 0), 0);
  const mapleSyrupGal = mapleEntries.filter(e => e.action === "boil").reduce((s, e) => s + (Number(e.syrupGal) || 0), 0);
  const mapleTapsSet = mapleEntries.filter(e => e.action === "tap_set").reduce((s, e) => s + (Number(e.count) || 0), 0);
  const mapleSuppliesCost = mapleEntries.filter(e => e.action === "supplies").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const mapleInfraCost = mapleEntries.filter(e => e.action === "infrastructure").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const mapleTotalCost = mapleSuppliesCost + mapleInfraCost;

  // ---- Dehydrating ----
  const dehyHobby = (data.hobbies || []).find(h => h.type === "dehydrating");
  const dehyBatches = (dehyHobby?.batches || []).filter(b => (b.date || "").startsWith(String(year)));
  const dehyOutputOz = dehyBatches.reduce((s, b) => s + (Number(b.outputOz) || 0), 0);
  const dehyHours = dehyBatches.reduce((s, b) => s + (Number(b.dryerHours) || 0), 0);
  const dehyCost = dehyBatches.reduce((s, b) => s + (Number(b.ingredientsCost) || 0), 0);

  // ---- Fermentation ----
  const fermHobby = (data.hobbies || []).find(h => h.type === "fermentation");
  const fermStarted = (fermHobby?.ferments || []).filter(f => (f.startDate || "").startsWith(String(year)));
  const fermFinished = (fermHobby?.ferments || []).filter(f => (f.finishDate || "").startsWith(String(year)));
  const fermStartedCount = fermStarted.length;
  const fermFinishedCount = fermFinished.length;
  // Sum daily stage logs to give a "days of activity" feel
  const fermStageLogs = (fermHobby?.ferments || []).reduce((s, f) => {
    return s + ((f.stages || []).filter(st => (st.date || "").startsWith(String(year))).length);
  }, 0);

  // ---- Freeze Drying ----
  const fdHobby = (data.hobbies || []).find(h => h.type === "freeze_drying");
  const fdBatches = (fdHobby?.batches || []).filter(b => (b.date || "").startsWith(String(year)));
  const fdOutputOz = fdBatches.reduce((s, b) => s + (Number(b.outputOz) || 0), 0);
  const fdCycleHours = fdBatches.reduce((s, b) => s + (Number(b.cycleHours) || 0), 0);
  const fdCost = fdBatches.reduce((s, b) => s + (Number(b.ingredientsCost) || 0), 0);

  return {
    totalEntries, activeDays, eggsCollected, dozensCollected, eggsSold, eggRevenue,
    eggLayerFeedCost, eggLayerInfraCost, eggLayerBirdCost, eggLayerTotalCost,
    eggLayerCostPerDozen, benchmarkPricePerDozen, groceryStoreEquivalent, moneySavedVsBuying,
    eggRevenueByMonth, peakEggMonth, totalHarvestLbs, harvestsCount, plantingsCount, topPlants,
    birdsRaised, birdsSurvived, birdsButchered, totalMeatLbs, birdDeaths, mortalityRate,
    meatChickenFeedCost, meatChickenInfraCost, meatChickenChickCost, meatChickenTotalCost, meatCostPerLb,
    // Rabbits
    totalLitters, totalKitsAlive, totalKitsStillborn, totalRabbitsButchered, rabbitTotalMeatLbs, rabbitTotalCost, rabbitCostPerRabbit,
    // Bees
    honeyHarvestedLbs, hiveInspections, hiveTreatments,
    // Incubator
    incubatorEggsSet, incubatorEggsHatched, avgHatchRate,
    // Goats
    goatMilkOz, goatKids, goatFeedCost, goatButchered, goatMeatLbs, goatCount,
    // Cows
    cowMilkGal, cowCalves, cowFeedCost, cowButchered, cowMeatLbs, cowCount,
    // Pigs
    pigLitters, pigsButchered, pigMeatLbs, pigFeedCost, pigFCR, pigCount,
    // Sheep
    sheepCount, sheepLambsBorn, sheepLambsAlive, sheepMilkGal, sheepWoolLbs, sheepMeatLbs, sheepButchered,
    // Sourdough
    sourdoughBakes, sourdoughLoaves, sourdoughTotalCost, sourdoughTopRecipe,
    sourdoughLoavesSold, sourdoughRevenue, sourdoughProfit,
    // Horses
    horseCount, horseRides, horseRideHours, horseFoalsBorn, horseFoalsAlive,
    horseFarrierCount, horseVetCount, horseDewormCount, horseTotalCareCost, horseTopRider,
    // Farmstand
    farmstandRevenue, farmstandCost, farmstandProfit, farmstandSaleCount, farmstandTopItem, farmstandItemCount,
    // Baking
    bakingBakes, bakingItems, bakingTotalCost, bakingTopRecipe,
    bakingItemsSold, bakingRevenue, bakingProfit,
    // Canning
    canningBatches, canningJarsMade, canningJarsInPantry, canningIngredientsCost, canningTopItem,
    canningJarsSold, canningRevenue, canningProfit,
    // Freezer log (universal butcher records — any flock, any bird type)
    freezerBirds, freezerLbs,
    // Activity
    busiestMonth, longestStreak, weatherStats, photos,
    firstEntryDate, lastEntryDate, entryCountByHobby, gardenWaterCount, freeRangeCount,
    totalFeedLbs, totalFeedCost, photosCount, issueCount, heaviestDay, heaviestDayCount,
    // Chicken tractor
    tractorFeet, tractorMoveCount,
    // Dogs
    dogCount, dogVetVisits, dogLitters, dogPuppiesBorn, dogAttacks,
    // Cats
    catCount, catVetVisits, catLitters, catKittensBorn, catKills,
    // Maple Syrup
    mapleSapGal, mapleSyrupGal, mapleTapsSet, mapleSuppliesCost, mapleInfraCost, mapleTotalCost,
    // Dehydrating
    dehyBatches: dehyBatches.length, dehyOutputOz, dehyHours, dehyCost,
    // Fermentation
    fermStartedCount, fermFinishedCount, fermStageLogs,
    // Freeze Drying
    fdBatches: fdBatches.length, fdOutputOz, fdCycleHours, fdCost,
  };
}
