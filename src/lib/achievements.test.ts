import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  ACHIEVEMENT_BY_KEY,
  ACHIEVEMENTS,
  EMPTY_METRICS,
  longestRun,
  newUnlocks,
  tierFor,
  unlockText,
  viewOf,
  xpForTier,
  type Metrics,
} from "./achievements";

const m = (o: Partial<Metrics>): Metrics => ({ ...EMPTY_METRICS, ...o });
const get = (k: string) => ACHIEVEMENT_BY_KEY.get(k)!;

// catálogo: ~30, chaves únicas, limiares crescentes, 1–3 estrelas, várias com 3 e algumas secretas
assert.ok(ACHIEVEMENTS.length >= 28 && ACHIEVEMENTS.length <= 36, `catálogo com ${ACHIEVEMENTS.length}`);
assert.equal(new Set(ACHIEVEMENTS.map((a) => a.key)).size, ACHIEVEMENTS.length);
for (const a of ACHIEVEMENTS) {
  assert.ok(a.tiers.length >= 1 && a.tiers.length <= 3, a.key);
  for (let i = 1; i < a.tiers.length; i++) assert.ok(a.tiers[i] > a.tiers[i - 1], `${a.key} crescente`);
  assert.ok(a.goal(a.tiers[0]).length > 0);
  assert.equal(a.value(EMPTY_METRICS) >= 0, true);
  // ícone: emoji ou arquivo que existe em /public/img
  if (a.icon.includes(".")) assert.ok(existsSync(`public/img/${a.icon}`), `ícone ${a.icon}`);
}
assert.ok(ACHIEVEMENTS.filter((a) => a.tiers.length === 3).length >= 15);
assert.ok(ACHIEVEMENTS.filter((a) => a.secret).length >= 3);

// XP por estrela
assert.deepEqual([1, 2, 3].map(xpForTier), [50, 100, 200]);

// estrelas
assert.equal(tierFor(get("em-chamas"), 6), 0);
assert.equal(tierFor(get("em-chamas"), 7), 1);
assert.equal(tierFor(get("em-chamas"), 45), 2);
assert.equal(tierFor(get("em-chamas"), 100), 3);
assert.equal(tierFor(get("maratonista"), get("maratonista").value(m({ focusMin: 50 * 60 }))), 2);
assert.equal(tierFor(get("matematico"), get("matematico").value(m({ questionsByArea: { Matemática: 520, Natureza: 90 } }))), 2);
assert.equal(get("naturalista").value(m({ questionsByArea: { Matemática: 520, Natureza: 90 } })), 90);

// nada novo com métricas vazias
assert.deepEqual(newUnlocks(EMPTY_METRICS, []), []);
// cada estrela vira um desbloqueio; as já gravadas não se repetem
const lots = m({ streak: 31, sessions: 1, essays: 6, essayBest: 920, examBest: 155, examsFull: 1, phasesDone: 1, level: 5 });
const u = newUnlocks(lots, ["em-chamas:1"]);
const ids = u.map((x) => `${x.key}:${x.tier}`);
assert.ok(ids.includes("em-chamas:2") && !ids.includes("em-chamas:1") && !ids.includes("em-chamas:3"));
assert.ok(ids.includes("escritor:1") && ids.includes("escritor:2") && !ids.includes("escritor:3"));
assert.ok(ids.includes("nota-900:1") && !ids.includes("nota-mil:1"));
assert.ok(ids.includes("rumo-150:1") && !ids.includes("elite-160:1"));
assert.ok(ids.includes("desbravador:1") && ids.includes("escalada:1") && ids.includes("primeiro-foco:1"));
assert.deepEqual(newUnlocks(lots, ids.concat("em-chamas:1")), []);

// secretas aparecem como ??? até desbloquear
const coruja = get("coruja");
assert.equal(coruja.secret, true);
const hidden = viewOf(coruja, EMPTY_METRICS);
assert.equal(hidden.name, "???");
assert.equal(hidden.hidden, true);
const shown = viewOf(coruja, m({ lateSessions: 3 }));
assert.equal(shown.name, "Coruja");
assert.equal(shown.tier, 1);
assert.equal(shown.targetLabel, "10");

// progresso até a próxima estrela
const v = viewOf(get("maratonista"), m({ focusMin: 30 * 60 }));
assert.equal(v.tier, 1);
assert.equal(v.pct, 50); // 10 h → 50 h, está em 30 h
assert.equal(v.targetLabel, "50 h");
const full = viewOf(get("nota-900"), m({ essayBest: 980 }));
assert.equal(full.pct, 100);
assert.equal(full.targetLabel, null);
// estrela gravada vale mesmo se a métrica cair (ex.: sequência quebrada)
assert.equal(viewOf(get("em-chamas"), m({ streak: 2 }), 2).tier, 2);

// texto de desbloqueio
const t = unlockText({ key: "escritor", tier: 2 })!;
assert.equal(t.name, "Escritor");
assert.equal(t.stars, 2);
assert.equal(t.xp, 100);
assert.equal(unlockText({ key: "nao-existe", tier: 1 }), null);

// sequência mais longa
assert.equal(longestRun([]), 0);
assert.equal(longestRun(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05"]), 3);
assert.equal(longestRun(["2026-10-05", "2026-10-04", "2026-10-04"]), 2);

console.log("achievements ok");
