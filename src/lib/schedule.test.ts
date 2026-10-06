import assert from "node:assert/strict";
import { addDays, weekdayOf } from "./day";
import {
  areaSequence,
  capacityOf,
  fillBlocks,
  firstReview,
  nextFreeDay,
  nextReview,
  restDaysBetween,
  reviewXp,
  splitMinutes,
  suggestWeek,
  type TopicInfo,
} from "./schedule";

const today = "2026-10-06"; // terça
const ws = "2026-10-04"; // domingo

/* ---------- Revisões ---------- */
assert.deepEqual(firstReview(today), { step: 0, intervalDays: 1, dueDay: "2026-10-07" });
// 1 → 7 → 30 → manutenção ×2,5
let r = nextReview({ step: 0, intervalDays: 1, day: today });
assert.deepEqual([r.step, r.intervalDays, r.dueDay], [1, 7, addDays(today, 7)]);
r = nextReview({ step: r.step, intervalDays: r.intervalDays, day: today, accuracy: 70 });
assert.deepEqual([r.step, r.intervalDays], [2, 30]);
r = nextReview({ step: r.step, intervalDays: r.intervalDays, day: today });
assert.deepEqual([r.step, r.intervalDays], [3, 75]);
r = nextReview({ step: r.step, intervalDays: r.intervalDays, day: today });
assert.deepEqual([r.step, r.intervalDays], [4, 188]);
// acerto < 60% volta um passo (não avança)
assert.deepEqual(nextReview({ step: 1, intervalDays: 7, day: today, accuracy: 50 }).intervalDays, 7);
assert.deepEqual(nextReview({ step: 0, intervalDays: 1, day: today, accuracy: 40 }).intervalDays, 1);
assert.deepEqual(nextReview({ step: 4, intervalDays: 75, day: today, accuracy: 40 }).intervalDays, 75);
// acerto > 85% estica ×1,5
assert.equal(nextReview({ step: 0, intervalDays: 1, day: today, accuracy: 90 }).intervalDays, 11);
assert.equal(nextReview({ step: 1, intervalDays: 7, day: today, accuracy: 100 }).intervalDays, 45);
// perto do ENEM (< 60 dias) o intervalo é no máx. metade do tempo restante
assert.equal(nextReview({ step: 1, intervalDays: 7, day: today, enemDate: addDays(today, 40) }).intervalDays, 20);
assert.equal(nextReview({ step: 0, intervalDays: 1, day: today, enemDate: addDays(today, 40) }).intervalDays, 7);
assert.equal(nextReview({ step: 1, intervalDays: 7, day: today, enemDate: addDays(today, 100) }).intervalDays, 30);
assert.equal(nextReview({ step: 1, intervalDays: 7, day: today, enemDate: addDays(today, 1) }).intervalDays, 1);
assert.equal(firstReview(today, addDays(today, 1)).intervalDays, 1);
// XP: +15, +5 no dia certo ou antes
assert.equal(reviewXp(today, today), 20);
assert.equal(reviewXp(today, addDays(today, 3)), 20);
assert.equal(reviewXp(today, addDays(today, -1)), 15);

/* ---------- Dias de descanso ---------- */
assert.deepEqual(restDaysBetween("2026-09-30", today, 0), ["2026-10-04"]);
assert.deepEqual(restDaysBetween("2026-09-20", "2026-10-04", 0), ["2026-09-20", "2026-09-27", "2026-10-04"]);
assert.deepEqual(restDaysBetween("2026-09-20", today, null), []);
assert.equal(capacityOf(ws, [60, 180, 180, 180, 180, 180, 120], 0), 0);
assert.equal(capacityOf(today, [60, 180, 180, 180, 180, 180, 120], 0), 180);

/* ---------- Blocos ---------- */
assert.deepEqual(splitMinutes(180), [60, 60, 60]);
assert.deepEqual(splitMinutes(150), [60, 90]);
assert.deepEqual(splitMinutes(100), [60, 40]);
assert.deepEqual(splitMinutes(80), [80]);
assert.deepEqual(splitMinutes(25), []);
for (const m of [30, 45, 95, 120, 135, 240, 305]) {
  const parts = splitMinutes(m);
  assert.ok(parts.every((p) => p >= 30 && p <= 90), `blocos 30–90 para ${m}: ${parts}`);
}

// Intercalação com ênfase: Natureza e Matemática aparecem 2× mais
const seq = areaSequence(["Matemática", "Natureza", "Linguagens", "Humanas"], 12);
const count = (a: string) => seq.filter((x) => x === a).length;
assert.equal(count("Matemática"), 4);
assert.equal(count("Natureza"), 4);
assert.equal(count("Linguagens"), 2);
assert.ok(seq.every((a, i) => i === 0 || a !== seq[i - 1] || a === "Matemática" || a === "Natureza"));

/* ---------- Sugerir minha semana ---------- */
const mk = (area: string, subject: string, n: number, extra: Partial<TopicInfo> = {}): TopicInfo[] =>
  Array.from({ length: n }, (_, i) => ({ nodeId: `${subject}${i}`, area, subject, topic: `${subject} ${i + 1}`, mastery: false, minutes: 0, ...extra }));
const topics = [
  ...mk("Matemática", "Mat", 20),
  ...mk("Natureza", "Fis", 20),
  ...mk("Linguagens", "Port", 20),
  ...mk("Humanas", "Hist", 20),
];
topics[0].mastery = true; // dominado: não entra
topics[1].minutes = 50; // já tem horas: vai pro fim da fila
const week = [0, 180, 180, 180, 180, 180, 120];
const plan = suggestWeek({
  weekStart: ws,
  today,
  weekMinutes: week,
  restDay: 0,
  topics,
  reviews: [
    { id: "r-late", nodeId: null, area: "Natureza", subject: "Fis", topic: "Fis 9", dueDay: "2026-10-01" },
    { id: "r-fri", nodeId: null, area: "Humanas", subject: "Hist", topic: "Hist 9", dueDay: "2026-10-09" },
    { id: "r-next", nodeId: null, area: "Humanas", subject: "Hist", topic: "Hist 8", dueDay: "2026-10-20" },
  ],
  kept: [{ day: "2026-10-07", topic: "Port 1", plannedMin: 60, reviewId: null }],
});
// nada antes de hoje nem no descanso
assert.ok(plan.every((b) => b.day >= today && weekdayOf(b.day) !== 0));
// respeita os minutos de cada dia (com o bloco mantido)
for (let i = 2; i < 7; i++) {
  const d = addDays(ws, i);
  const used = plan.filter((b) => b.day === d).reduce((s, b) => s + b.plannedMin, 0) + (d === "2026-10-07" ? 60 : 0);
  assert.ok(used <= week[i], `dia ${d}: ${used}`);
  assert.ok(used >= week[i] - 25, `dia ${d} quase cheio: ${used}`);
}
// revisões: atrasada vai hoje, a de sexta na sexta, a da outra semana não entra
const revs = plan.filter((b) => b.kind === "review");
assert.deepEqual(revs.map((b) => [b.reviewId, b.day]), [["r-late", today], ["r-fri", "2026-10-09"]]);
// blocos de 30–90
assert.ok(plan.every((b) => b.plannedMin >= 30 && b.plannedMin <= 90));
const study = plan.filter((b) => b.kind === "study");
// sem tópico dominado, sem repetir o bloco mantido, e na ordem da árvore dentro da área
assert.ok(!study.some((b) => b.topic === "Mat 1" || b.topic === "Port 1"));
assert.equal(study.find((b) => b.area === "Matemática")!.topic, "Mat 3");
assert.ok(!study.some((b) => b.topic === "Mat 2"), "tópico com horas fica para depois");
// ênfase: Natureza + Matemática ≥ metade
const nm = study.filter((b) => b.area === "Natureza" || b.area === "Matemática").length;
assert.ok(nm * 2 >= study.length, `ênfase ${nm}/${study.length}`);
// intercalação: nunca duas vezes a mesma área seguida no mesmo dia
for (let i = 1; i < study.length; i++)
  if (study[i].day === study[i - 1].day) assert.notEqual(study[i].area, study[i - 1].area);
// tópicos não se repetem
assert.equal(new Set(study.map((b) => b.topic)).size, study.length);
// semana passada: nada
assert.deepEqual(suggestWeek({ weekStart: addDays(ws, -7), today, weekMinutes: week, restDay: 0, topics, reviews: [], kept: [] }), []);

/* ---------- Pendentes ---------- */
const planned = new Map([[today, 180], ["2026-10-07", 120]]);
assert.equal(nextFreeDay({ from: today, min: 60, weekMinutes: week, restDay: 0, plannedByDay: planned }), "2026-10-07");
assert.equal(nextFreeDay({ from: today, min: 30, weekMinutes: week, restDay: 0, plannedByDay: new Map() }), today);
assert.equal(nextFreeDay({ from: "2026-10-11", min: 30, weekMinutes: week, restDay: 0, plannedByDay: new Map() }), "2026-10-12");

/* ---------- Foco preenche o bloco ---------- */
const blocks = [
  { id: "a", kind: "study" as const, plannedMin: 60, doneMin: 20 },
  { id: "b", kind: "review" as const, plannedMin: 30, doneMin: 0 },
];
assert.deepEqual(fillBlocks(blocks, 30, "study"), [{ id: "a", doneMin: 50, completed: false }]);
assert.deepEqual(fillBlocks(blocks, 59.5, "study"), [
  { id: "a", doneMin: 60, completed: true },
  { id: "b", doneMin: 19.5, completed: false },
]);
assert.deepEqual(fillBlocks(blocks, 30, "review"), [{ id: "b", doneMin: 30, completed: true }]);
assert.deepEqual(fillBlocks([], 30, "review"), []);

console.log("schedule ok");
