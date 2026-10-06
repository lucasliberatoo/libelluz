import assert from "node:assert/strict";
import { addDays } from "./day";
import { computeAlerts, computeSuggestions, phaseProgress, topicComplete, topicShare, type MapSession, type MapTopic } from "./mapa";
import { TEMPLATE_TREE, topicRelevance } from "./template-tree";

const today = "2026-10-06";
const topic = (o: Partial<MapTopic> & { id: string; name: string }): MapTopic => ({
  phase: "Básico I",
  relevance: null,
  theory: false,
  practice: false,
  mastery: false,
  subjectId: "s1",
  subject: "Matemática Básica",
  area: "Matemática",
  skills: [],
  minutes: 0,
  questions: 0,
  correct: 0,
  lastDay: null,
  ...o,
});
const sk = (id: string, mastery = false, phase: string | null = null) => ({ id, name: id, phase, relevance: null, theory: false, practice: false, mastery });

// progresso: habilidades contam como unidades; tópico sem habilidades conta ele mesmo
const pct = topic({ id: "p", name: "Porcentagem", skills: [sk("a", true), sk("b"), sk("c", false, "Ataque")] });
const vaz = topic({ id: "v", name: "Vazão", mastery: true });
assert.equal(topicShare(pct, "mastery"), 1 / 3);
assert.equal(topicShare(pct, "mastery", "Básico I"), 1 / 2);
assert.equal(topicComplete(vaz), true);
const ph = phaseProgress([pct, vaz]);
assert.deepEqual(ph.find((p) => p.phase === "Básico I"), { phase: "Básico I", total: 3, mastered: 2, theory: 0, practice: 0 });
assert.equal(ph.find((p) => p.phase === "Ataque")!.total, 1);

// alertas
const prob = topic({ id: "pr", name: "Probabilidade", lastDay: addDays(today, -17) });
const comb = topic({ id: "co", name: "Análise Combinatória", lastDay: addDays(today, -2), subjectId: "s2", subject: "Estatística e Probabilidade" });
const fun = topic({ id: "fu", name: "Função do 1º grau", lastDay: addDays(today, -1), subjectId: "s3", subject: "Funções" });
const sessions: MapSession[] = [
  { topicId: "pr", day: addDays(today, -17), kind: "Teoria", minutes: 50, done: 0, correct: 0 },
  { topicId: "co", day: addDays(today, -2), kind: "Questões", minutes: 40, done: 20, correct: 10 },
  { topicId: "fu", day: addDays(today, -30), kind: "Questões", minutes: 40, done: 10, correct: 5 },
  { topicId: "fu", day: addDays(today, -1), kind: "Questões", minutes: 40, done: 10, correct: 9 },
];
const alerts = computeAlerts([prob, comb, fun], sessions, today);
assert.deepEqual(alerts.map((a) => a.tone), ["red", "yellow", "green"]);
assert.match(alerts[0].text, /Probabilidade há 17 dias/);
assert.match(alerts[1].text, /Análise Combinatória \(50%/);
assert.match(alerts[2].text, /Funções evoluindo \(50% → 90%\)/);

// sugestões
const q = (n: number): MapSession[] => Array.from({ length: n }, (_, i) => ({ topicId: "p", day: addDays(today, -i), kind: "Questões", minutes: 30, done: 10, correct: 9 }));
let sug = computeSuggestions([pct], q(3));
assert.equal(sug[0].flag, "mastery");
assert.match(sug[0].text, /3 sessões de questões em Porcentagem com 90%/);
sug = computeSuggestions([pct], q(2));
assert.equal(sug[0].flag, "practice");
sug = computeSuggestions([prob], sessions);
assert.equal(sug[0].flag, "theory");
assert.equal(computeSuggestions([vaz], [{ topicId: "v", day: today, kind: "Questões", minutes: 30, done: 30, correct: 30 }]).length, 1); // prática ainda não marcada

// modelo: nomes únicos, fases e relevância em tudo
for (const a of TEMPLATE_TREE)
  for (const s of a.subjects) {
    assert.equal(new Set(s.topics.map((t) => t.name)).size, s.topics.length, s.name);
    for (const t of s.topics) {
      assert.ok(t.phase && t.relevance, t.name);
      assert.ok(t.skills.every((k) => k.phase && k.relevance), t.name);
    }
  }
assert.equal(topicRelevance([{ relevance: "Média incidência · Alta complexidade" }, { relevance: "Alta incidência · Baixa complexidade" }]), "Alta incidência");

console.log("mapa ok");
