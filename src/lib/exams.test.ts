import assert from "node:assert/strict";
import { ENEM_LIST, enemByKey } from "./enem-list";
import { avoidedAxes, cycleStart, drawDue, essayBandBonus, nextDrawDay, pickTheme } from "./essay";
import { examAwards, objectiveTotal, summarizeExams, type ExamRow, type PartRow } from "./exams";

/* ---------- ENEMs ---------- */
assert.equal(ENEM_LIST[0].year, 2025);
assert.equal(ENEM_LIST.at(-1)!.key, "2009-regular");
assert.ok(enemByKey("2020-digital"));
assert.ok(enemByKey("2010-ppl"));
assert.equal(enemByKey("2009-ppl"), undefined);
assert.equal(new Set(ENEM_LIST.map((e) => e.key)).size, ENEM_LIST.length);

/* ---------- Simulados ---------- */
const part = (p: PartRow["part"], correct: number | null, day = "2026-10-01", essayScore: number | null = null): PartRow => ({
  part: p,
  day,
  correct,
  minutes: null,
  essayScore,
  competencies: null,
});
const four = (n: number, day?: string) => (["natureza", "matematica", "linguagens", "humanas"] as const).map((k) => part(k, n, day));
const exam = (id: string, parts: PartRow[], kind: "simulado" | "enem" = "simulado"): ExamRow => ({
  id,
  kind,
  name: id,
  source: null,
  enemKey: null,
  url: null,
  createdAt: 0,
  parts,
});

assert.equal(objectiveTotal(four(30)), 120);
assert.equal(objectiveTotal(four(30).slice(1)), null);

// uma parte só: +40
assert.deepEqual(
  examAwards({ id: "a", kind: "simulado" }, ["natureza"], [part("natureza", 30)], null).map((a) => a.amount),
  [40],
);
// prova completa de ENEM: 300 no lugar de 250, e recorde (+100) por superar a anterior
const full = [...four(35), part("redacao", null, "2026-10-01", 800)];
const aw = examAwards({ id: "b", kind: "enem" }, ["redacao"], full, 130);
assert.deepEqual(aw.map((a) => a.amount), [40, 300, 100]);
assert.deepEqual(aw.map((a) => a.dedupe), ["exampart:b:redacao", "examfull:b", "examrecord:b"]);
// simulado completo sem superar o recorde
assert.deepEqual(examAwards({ id: "c", kind: "simulado" }, [], full, 150).map((a) => a.amount), [250]);
// primeira prova completa não conta como recorde
assert.equal(examAwards({ id: "d", kind: "simulado" }, [], full, null).length, 1);

const s = summarizeExams([
  exam("x", [...four(30, "2026-09-01"), part("redacao", null, "2026-09-01", 700)]),
  exam("y", four(36, "2026-09-20")),
  exam("z", four(20).slice(0, 2)),
]);
assert.equal(s.timeline.length, 2);
assert.equal(s.record!.examId, "y");
assert.equal(s.last!.total, 144);
assert.equal(s.delta, 24);
assert.equal(s.completeCount, 1);
assert.equal(s.essays[0].score, 700);

/* ---------- Redação ---------- */
assert.equal(essayBandBonus(null), 0);
assert.equal(essayBandBonus(580), 0);
assert.equal(essayBandBonus(600), 10);
assert.equal(essayBandBonus(820), 30);
assert.equal(essayBandBonus(960), 50);

// 2026-10-07 é quarta: a semana começou na segunda 05/10
assert.equal(cycleStart("semana", 6, "2026-10-07"), "2026-10-05");
assert.equal(cycleStart("semana", 6, "2026-10-04"), "2026-09-28"); // domingo
assert.equal(cycleStart("fixo", 6, "2026-10-07"), "2026-10-03"); // último sábado
assert.equal(cycleStart("fixo", 3, "2026-10-07"), "2026-10-07");
assert.equal(drawDue("semana", 6, "2026-10-07", null), true);
assert.equal(drawDue("semana", 6, "2026-10-07", "2026-10-05"), false);
assert.equal(drawDue("semana", 6, "2026-10-07", "2026-10-04"), true);
assert.equal(nextDrawDay("fixo", 6, "2026-10-07"), "2026-10-10");

const stock = [
  { id: "1", axis: "economia" },
  { id: "2", axis: "saúde" },
];
// eixo nunca praticado ganha quase sempre
const counts = { economia: 0, saúde: 0 } as Record<string, number>;
for (let i = 0; i < 200; i++) counts[pickTheme(stock, { saúde: 4 }, () => i / 200)!.axis]++;
assert.ok(counts.economia > 180, JSON.stringify(counts));
assert.equal(pickTheme(stock, {}, () => 0, "1")!.id, "2"); // não repete o que acabou de passar
assert.equal(pickTheme([stock[0]], {}, () => 0, "1")!.id, "1"); // a não ser que seja o único
assert.equal(pickTheme([], {}), null);

assert.deepEqual(
  avoidedAxes([
    { axis: "economia", passCount: 3 },
    { axis: "economia", passCount: 1 },
    { axis: "saúde", passCount: 2 },
  ]),
  [{ axis: "economia", passes: 4 }],
);

console.log("exams/essay: ok");
