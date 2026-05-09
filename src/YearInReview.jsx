// ============================================================================
// YEAR IN REVIEW — updated to respect hidden hobbies + rabbits support
// ============================================================================

import React, { useState, useMemo, useEffect } from "react";
import { Egg, Drumstick, Sprout, Calendar as CalendarIcon, Camera, Sun, CloudRain, Heart } from "lucide-react";
import { getPhotoUrl } from "./sync.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47",
  line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

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
  const farmstandEnabled = hobbies.some(h => h.type === "farmstand" && !h.hidden);

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
          <HeadlinesCard stats={stats} eggLayersEnabled={eggLayersEnabled} gardenEnabled={gardenEnabled} meatChickensEnabled={meatChickensEnabled} rabbitsEnabled={rabbitsEnabled} beesEnabled={beesEnabled} goatsEnabled={goatsEnabled} cowsEnabled={cowsEnabled} pigsEnabled={pigsEnabled} farmstandEnabled={farmstandEnabled} />
          {eggLayersEnabled && <EggsCard stats={stats} />}
          {gardenEnabled && <GardenCard stats={stats} />}
          {meatChickensEnabled && <MeatChickensCard stats={stats} />}
          {rabbitsEnabled && <RabbitsCard stats={stats} />}
          {beesEnabled && <BeesCard stats={stats} />}
          {incubatorEnabled && <IncubatorCard stats={stats} />}
          {goatsEnabled && <GoatsCard stats={stats} />}
          {cowsEnabled && <CowsCard stats={stats} />}
          {pigsEnabled && <PigsCard stats={stats} />}
          {farmstandEnabled && <FarmstandCard stats={stats} />}
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

function HeadlinesCard({ stats, eggLayersEnabled, gardenEnabled, meatChickensEnabled, rabbitsEnabled, beesEnabled, goatsEnabled, cowsEnabled, pigsEnabled, farmstandEnabled }) {
  const items = [];
  if (eggLayersEnabled) items.push({ icon: "🥚", number: stats.eggsCollected, label: `egg${stats.eggsCollected === 1 ? "" : "s"} laid`, accent: palette.yolk });
  if (meatChickensEnabled) items.push({ icon: "🍗", number: Math.max(stats.birdsSurvived, stats.birdsButchered), label: `meat bird${stats.birdsSurvived === 1 ? "" : "s"} raised`, accent: palette.feather });
  if (gardenEnabled) items.push({ icon: "🌱", number: Math.round(stats.totalHarvestLbs), label: `lb${Math.round(stats.totalHarvestLbs) === 1 ? "" : "s"} harvested`, accent: palette.leaf });
  if (rabbitsEnabled) items.push({ icon: "🐇", number: stats.totalKitsAlive || 0, label: `kits born`, accent: palette.leaf });
  if (beesEnabled && stats.honeyHarvestedLbs > 0) items.push({ icon: "🍯", number: Math.round(stats.honeyHarvestedLbs), label: `lbs honey harvested`, accent: palette.yolk });
  if (goatsEnabled && stats.goatMilkOz > 0) items.push({ icon: "🐐", number: Math.round(stats.goatMilkOz / 128), label: `gal goat milk`, accent: palette.leaf });
  if (cowsEnabled && stats.cowMilkGal > 0) items.push({ icon: "🐄", number: Math.round(stats.cowMilkGal), label: `gal cow milk`, accent: palette.leaf });
  if (pigsEnabled && stats.pigsButchered > 0) items.push({ icon: "🐷", number: stats.pigMeatLbs, label: `lbs pork`, accent: palette.feather });
  if (farmstandEnabled && stats.farmstandRevenue > 0) items.push({ icon: "🧾", number: `$${Math.round(stats.farmstandRevenue)}`, label: `farmstand revenue`, accent: palette.leaf });

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
  const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

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
              label={`saved vs. buying pasture-raised at $${benchmarkPricePerDozen.toFixed(2)}/doz`}
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
  const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

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

// ============ NEW: RABBITS CARD ============
function RabbitsCard({ stats }) {
  const { totalLitters, totalKitsAlive, totalKitsStillborn, totalRabbitsButchered, rabbitTotalCost, rabbitCostPerRabbit, rabbitTotalMeatLbs } = stats;
  if (!totalLitters && !totalRabbitsButchered && !rabbitTotalCost) return null;
  const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

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
  const fmtMoney = (n) => `$${(Number(n)||0).toFixed(2)}`;
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
  const fmtMoney = (n) => `$${(Number(n)||0).toFixed(2)}`;
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
  const fmtMoney = (n) => `$${(Number(n)||0).toFixed(2)}`;
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

function FarmstandCard({ stats }) {
  const { farmstandRevenue, farmstandCost, farmstandProfit, farmstandSaleCount, farmstandTopItem, farmstandItemCount } = stats;
  if (!farmstandSaleCount && !farmstandItemCount) return null;
  const fmtMoney = (n) => `$${(Number(n)||0).toFixed(2)}`;
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
        {weatherStats.hottestDay && <Stat big={`${weatherStats.hottestDay.highF}°`} label={`hottest · ${shortDate(weatherStats.hottestDay.date)}`} accent={palette.accent} />}
        {weatherStats.coldestDay && <Stat big={`${weatherStats.coldestDay.lowF}°`} label={`coldest · ${shortDate(weatherStats.coldestDay.date)}`} accent="#7AA8B8" />}
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
  if (stats.totalFeedCost > 0) facts.push({ emoji: "💸", label: "Spent on feed", value: `$${stats.totalFeedCost.toFixed(2)}` });
  if (stats.freeRangeCount > 0) facts.push({ emoji: "🌳", label: "Free-range days", value: stats.freeRangeCount });
  if (stats.photosCount > 0) facts.push({ emoji: "📷", label: "Photos taken", value: stats.photosCount });
  if (stats.issueCount > 0) facts.push({ emoji: "⚠️", label: "Issues logged", value: stats.issueCount });
  if (stats.plantingsCount > 0) facts.push({ emoji: "🌱", label: "Plantings", value: stats.plantingsCount });
  if (stats.harvestsCount > 0) facts.push({ emoji: "🧺", label: "Harvest trips", value: stats.harvestsCount });
  if (stats.entryCountByHobby) {
    const top = Object.entries(stats.entryCountByHobby).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 0) {
      const hobbyLabels = { garden: "Garden", egg_layers: "Egg Layers", meat_chickens: "Meat Birds", rabbits: "Rabbits", bees: "Bees", incubator: "Incubator", goats: "Goats", cows: "Cows", pigs: "Pigs" };
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
  const d = new Date(dateStr);
  return `${monthLabels[d.getMonth()]} ${d.getDate()}`;
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
  const soldEggsEntries = allEntries.filter((e) => e.action === "sold_eggs");
  const eggsSold = soldEggsEntries.reduce((s, e) => s + (Number(e.count) || 0), 0);
  const eggRevenue = soldEggsEntries.reduce((s, e) => {
    const dozens = (Number(e.count) || 0) / 12;
    return s + dozens * (Number(e.pricePerDozen) || 0);
  }, 0);
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
  eggLaidEntries.forEach((e) => { const m = new Date(e.date).getMonth(); eggRevenueByMonth[m].collected += Number(e.count) || 0; });
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
  allEntries.forEach((e) => { if (e.date) monthCounts[new Date(e.date).getMonth()]++; });
  let busiestMonthIdx = -1, busiestCount = 0;
  monthCounts.forEach((c, i) => { if (c > busiestCount) { busiestCount = c; busiestMonthIdx = i; } });
  const busiestMonth = busiestMonthIdx >= 0 ? monthLabels[busiestMonthIdx] : null;

  const sortedDays = Array.from(datesSet).sort();
  let longestStreak = 0, currentStreak = 0, prevDate = null;
  sortedDays.forEach((d) => {
    if (prevDate) { const diff = (new Date(d) - new Date(prevDate)) / (1000 * 60 * 60 * 24); if (diff === 1) currentStreak++; else currentStreak = 1; }
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
    // Farmstand
    farmstandRevenue, farmstandCost, farmstandProfit, farmstandSaleCount, farmstandTopItem, farmstandItemCount,
    // Freezer log (universal butcher records — any flock, any bird type)
    freezerBirds, freezerLbs,
    // Activity
    busiestMonth, longestStreak, weatherStats, photos,
    firstEntryDate, lastEntryDate, entryCountByHobby, gardenWaterCount, freeRangeCount,
    totalFeedLbs, totalFeedCost, photosCount, issueCount, heaviestDay, heaviestDayCount,
  };
}
