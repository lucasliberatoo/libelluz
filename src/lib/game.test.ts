import assert from "node:assert/strict";
import { computeStreak, computeStudyMode, sessionXp } from "./game";
import { addDays } from "./day";

const today = "2026-10-06";
const days = (n: number, end = today) => Array.from({ length: n }, (_, i) => addDays(end, -i));

assert.equal(computeStreak([], today).streak, 0);
assert.equal(computeStreak(days(3), today).streak, 3);
// hoje ainda não estudado mantém a sequência de ontem
assert.equal(computeStreak(days(3, addDays(today, -1)), today).streak, 3);
// buraco sem lenha zera
assert.equal(computeStreak([...days(2), ...days(3, addDays(today, -4))], today).streak, 2);
// 7 dias dão 1 lenha que protege 1 buraco
const s = computeStreak([...days(2), ...days(7, addDays(today, -3))], today);
assert.equal(s.streak, 9);
assert.equal(s.firewood, 0);
assert.deepEqual(s.burned, [addDays(today, -2)]);
assert.equal(sessionXp({ minutes: 50, area: "Humanas" }), 20);
assert.equal(sessionXp({ minutes: 50, area: "Matemática", done: 10, correct: 8 }), Math.round((20 + 24 + 2) * 1.2));
const mins = new Map(days(14).map((d) => [d, 200]));
assert.equal(computeStudyMode(mins, today, 180), "Avançado");
assert.equal(computeStudyMode(new Map(days(6).map((d) => [d, 30])), today, 180), "Regular");
assert.equal(computeStudyMode(new Map(), today, 180), "Baixo");
console.log("game ok");
