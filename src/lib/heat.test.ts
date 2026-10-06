import assert from "node:assert/strict";
import { addDays } from "./day";
import { computeStreak } from "./game";
import { accessoryProgress, emptyDay, HEAT, HEAT_PER_DAY_REF, heatHistory, heatOfDay, petMood, spHour, STAGES, stageOf, streakTimeline, studyHeat, type DayInput } from "./heat";

const today = "2026-10-06";
const goals = { water: 8, reading: 30 };
const day = (d: string, p: Partial<DayInput> = {}): DayInput => ({ ...emptyDay(d), ...p });

// degraus de estudo
assert.equal(studyHeat(0), 0);
assert.equal(studyHeat(24), 0);
assert.equal(studyHeat(25), 3);
assert.equal(studyHeat(60), 5);
assert.equal(studyHeat(150), 8);
assert.equal(studyHeat(400), 10);

// um dia completo dá o máximo
const full = heatOfDay(
  day(today, { focusMin: 200, water: 8, readingMin: 30, mood: true, exercise: true, journal: true, tasksDone: 3, tasksTotal: 3, events: { breath: 2, stretch: 2 } }),
  goals,
);
assert.equal(full.heat, 10 + 2 + 2 + 3 + 1 + 2 + 1 + 2 + 2);
assert.ok(full.items.every((i) => i.done));
// meta não batida não conta; sem tarefas não conta "todas as tarefas"
const partial = heatOfDay(day(today, { focusMin: 30, water: 7, readingMin: 29, tasksDone: 0, tasksTotal: 0 }), goals);
assert.equal(partial.heat, 3);
assert.equal(partial.items.find((i) => i.key === "tasks")!.done, false);
// respiração/alongar não passam do teto (uma vez por dia)
assert.equal(heatOfDay(day(today, { events: { breath: 6 } }), goals).heat, HEAT.breath);

// estágios e calibração: limiares crescentes, cada degrau maior
assert.deepEqual(
  STAGES.map((s) => s.at),
  [0, 14, 60, 150, 270].map((d) => d * HEAT_PER_DAY_REF),
);
for (let i = 2; i < STAGES.length; i++) assert.ok(STAGES[i].at - STAGES[i - 1].at > STAGES[i - 1].at - (STAGES[i - 2]?.at ?? 0));
assert.equal(stageOf(0), 0);
assert.equal(stageOf(STAGES[1].at - 1), 0);
assert.equal(stageOf(STAGES[1].at), 1);
assert.equal(stageOf(99999), 4);

// quem é constante (6 dias de estudo + 1 de descanso) evolui em ~2 semanas, ~2 meses, ~5 meses, ~9 meses
function constant(nDays: number) {
  const end = today;
  const start = addDays(end, -(nDays - 1));
  const days: DayInput[] = [];
  const rest: string[] = [];
  for (let i = 0; i < nDays; i++) {
    const d = addDays(start, i);
    if (i % 7 === 6) {
      rest.push(d);
      days.push(day(d, { water: 8, mood: true, exercise: i % 14 === 6 }));
    } else
      days.push(
        day(d, { focusMin: i % 2 ? 90 : 150, water: 8, mood: true, tasksDone: 2, tasksTotal: 2, readingMin: i % 2 ? 30 : 0, exercise: i % 3 === 0, journal: i % 2 === 0 }),
      );
  }
  return heatHistory({ days, today: end, goals, restDays: rest });
}
const firstDayAt = (stage: number) => {
  for (let n = 1; n < 400; n++) if (constant(n).stage >= stage) return n;
  return Infinity;
};
const reach = [1, 2, 3, 4].map(firstDayAt);
assert.ok(reach[0] >= 10 && reach[0] <= 20, `Chama em ${reach[0]} dias`);
assert.ok(reach[1] >= 45 && reach[1] <= 75, `Labareda em ${reach[1]} dias`);
assert.ok(reach[2] >= 120 && reach[2] <= 180, `Fogo-fátuo em ${reach[2]} dias`);
assert.ok(reach[3] >= 230 && reach[3] <= 310, `Chama Azul em ${reach[3]} dias`);

// sequência dia a dia bate com computeStreak (histórias aleatórias, com descanso)
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let t = 0; t < 300; t++) {
  const studied: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < 60; i++) {
    const d = addDays(today, -i);
    const r = rnd();
    if (r < 0.65) studied.push(d);
    else if (r < 0.75) rest.push(d);
  }
  const a = computeStreak(studied, today, rest);
  const b = streakTimeline(studied, today, rest);
  assert.equal(b.streak, a.streak);
}
// quebra: 3 dias, 1 em branco, 2 dias → quebrou no dia em branco
const brk = streakTimeline([addDays(today, -5), addDays(today, -4), addDays(today, -3), addDays(today, -1), today], today);
assert.deepEqual(brk.breaks, [addDays(today, -2)]);
assert.equal(brk.best, 3);
// hoje em branco não quebra
assert.deepEqual(streakTimeline([addDays(today, -1)], today).breaks, []);

// penalidade: 20% do calor do estágio atual, sem regredir de estágio
{
  // 20 dias de estudo forte (estágio Chama, 2 lenhas), depois 3 dias em branco: 2 queimam lenha, o 3º quebra
  const days: DayInput[] = [];
  for (let i = 0; i < 20; i++) days.push(day(addDays(today, -25 + i), { focusMin: 200, water: 8, mood: true }));
  const before = heatHistory({ days, today: addDays(today, -6), goals });
  assert.equal(before.stage, 1);
  assert.equal(before.total, 20 * 13);
  assert.equal(before.streak.firewood, 2);
  const burning = heatHistory({ days, today: addDays(today, -3), goals });
  assert.equal(burning.penalties.length, 0);
  assert.equal(burning.streak.streak, 20);
  const after = heatHistory({ days, today: addDays(today, -2), goals });
  const into = before.total - STAGES[1].at;
  assert.deepEqual(after.penalties, [{ day: addDays(today, -3), lost: Math.round(into * 0.2) }]);
  assert.equal(after.total, before.total - Math.round(into * 0.2));
  assert.equal(after.stage, 1);
  assert.equal(after.streak.streak, 0);
  assert.equal(after.bestStreak, 20);
}
{
  // com lenha guardada o buraco não penaliza
  const days: DayInput[] = [];
  for (let i = 0; i < 10; i++) days.push(day(addDays(today, -12 + i), { focusMin: 60 }));
  const h = heatHistory({ days: [...days, day(addDays(today, -1), { focusMin: 60 })], today, goals });
  assert.equal(h.penalties.length, 0);
  assert.deepEqual(h.streak.burned, [addDays(today, -2)]);
  // descanso planejado também não
  const r = heatHistory({ days: [...days, day(addDays(today, -1), { focusMin: 60 })], today, goals, restDays: [addDays(today, -2)] });
  assert.equal(r.penalties.length, 0);
}
{
  // quebra na Faísca: perde 20% do que juntou (o estágio começa no 0)
  const days = [day(addDays(today, -3), { focusMin: 60 }), day(addDays(today, -2), { focusMin: 60 })];
  const h = heatHistory({ days, today, goals });
  assert.equal(h.total, 10 - 2);
  assert.equal(h.stage, 0);
  // um segundo dia em branco seguido não penaliza de novo (a sequência já estava zerada)
  assert.equal(h.penalties.length, 1);
  assert.equal(h.intoStage, 8);
  assert.equal(h.stageSpan, STAGES[1].at);
}

// humor
const st = (o: Partial<ReturnType<typeof computeStreak>>) => ({ streak: 3, firewood: 0, burned: [], studiedToday: false, ...o });
assert.equal(petMood({ today, hour: 20, streak: st({ studiedToday: true }), penalties: [] }), "happy");
assert.equal(petMood({ today, hour: 10, streak: st({}), penalties: [] }), "calm");
assert.equal(petMood({ today, hour: 19, streak: st({}), penalties: [] }), "sleepy");
assert.equal(petMood({ today, hour: 10, streak: st({ burned: [addDays(today, -1)] }), penalties: [] }), "sad");
assert.equal(petMood({ today, hour: 10, streak: st({ streak: 0 }), penalties: [{ day: addDays(today, -1) }] }), "sad");
// sequência zerada por uma quebra antiga: segue tristinho até reacender
assert.equal(petMood({ today, hour: 10, streak: st({ streak: 0 }), penalties: [{ day: addDays(today, -5) }] }), "sad");
// usuário novo (nunca quebrou) não fica triste à toa
assert.equal(petMood({ today, hour: 10, streak: st({ streak: 0 }), penalties: [] }), "calm");
assert.equal(spHour(new Date("2026-10-06T21:30:00Z")), 18);
assert.equal(spHour(new Date("2026-10-06T03:00:00Z")), 0);

// acessórios
const acc = accessoryProgress({ bestStreak: 7, studiedDays: 29, focusHours: 50, stage: 3, examParts: 12 });
assert.deepEqual(
  acc.map((a) => [a.id, a.unlocked]),
  [
    ["oculos", true],
    ["bone", false],
    ["fone", true],
    ["coroa", false],
    ["cachecol", true],
  ],
);
assert.equal(acc[1].value, 29);

console.log("heat ok", { chama: reach[0], labareda: reach[1], fatuo: reach[2], azul: reach[3] });
