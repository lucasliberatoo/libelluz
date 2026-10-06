import assert from "node:assert/strict";
import {
  enemMilestone,
  isQuiet,
  kindEnabled,
  localClock,
  planLocalReminders,
  planNotifications,
  type RuleInput,
} from "./notification-rules";

const baseUser = (): RuleInput["user"] => ({ id: "u1", firstName: "Lucas", petName: "Brasa", enemDate: null, waterGoal: 8, prefs: {} });
const base = (o: Partial<RuleInput> = {}, now: Partial<RuleInput["now"]> = {}): RuleInput => ({
  now: { day: "2026-10-06", hour: 10, minute: 0, ...now },
  mode: "Regular",
  streak: { streak: 17, burned: [], studiedToday: false },
  studiedYesterday: true,
  everStudied: true,
  waterCups: 8,
  overdueReview: null,
  todayBlock: null,
  favoriteSubject: null,
  friend: null,
  ...o,
  user: { ...baseUser(), ...(o.user ?? {}) },
});
const kinds = (l: { dedupe: string }[]) => l.map((n) => n.dedupe.split(":")[0]);

// horário de silêncio
assert.equal(isQuiet(23, {}), true);
assert.equal(isQuiet(7, {}), true);
assert.equal(isQuiet(8, {}), false);
assert.equal(isQuiet(21, {}), false);
assert.equal(isQuiet(13, { quietStart: 12, quietEnd: 14 }), true);
assert.equal(isQuiet(3, { quietStart: 0, quietEnd: 0 }), false);
assert.equal(kindEnabled("comment", { off: ["reaction"] }), false);

// marcos do ENEM
assert.equal(enemMilestone("2026-10-06", "2026-11-05"), 30);
assert.equal(enemMilestone("2026-10-06", "2026-11-06"), null);
assert.equal(enemMilestone("2026-11-07", "2026-11-08"), 1);
assert.equal(enemMilestone("2026-10-06", null), null);

// fuso de Brasília
assert.deepEqual(localClock(new Date("2026-10-06T22:30:00Z")), { day: "2026-10-06", hour: 19, minute: 30 });
assert.deepEqual(localClock(new Date("2026-10-07T02:10:00Z")), { day: "2026-10-06", hour: 23, minute: 10 });

// sequência em risco só a partir das 19h
assert.deepEqual(kinds(planNotifications(base({}, { hour: 18 }))), []);
const risk = planNotifications(base({}, { hour: 19 }));
assert.deepEqual(kinds(risk), ["streak"]);
assert.match(risk[0].body, /17 dias/);
assert.equal(risk[0].dedupe, "streak:2026-10-06");
// já estudou: nada de sequência
assert.deepEqual(kinds(planNotifications(base({ streak: { streak: 17, burned: [], studiedToday: true } }, { hour: 20 }))), []);
// modo Baixo insiste de novo às 21h; os outros não
assert.deepEqual(kinds(planNotifications(base({ mode: "Baixo" }, { hour: 21 }))), ["streak2", "streak"]);
assert.deepEqual(kinds(planNotifications(base({ mode: "Avançado" }, { hour: 21 }))), ["streak"]);
assert.deepEqual(kinds(planNotifications(base({ mode: "Regular" }, { hour: 21 }))), ["streak"]);
// silêncio às 22h (padrão) e horário personalizado
assert.deepEqual(planNotifications(base({}, { hour: 22 })), []);
assert.deepEqual(kinds(planNotifications(base({ user: { prefs: { quietStart: 23, quietEnd: 7 } } as RuleInput["user"] }, { hour: 22 }))), ["streak"]);
// tipo desligado
assert.deepEqual(planNotifications(base({ user: { prefs: { off: ["streak"] } } as RuleInput["user"] }, { hour: 20 })), []);

// tom muda com o modo e usa o nome do foguinho
const tones = (mode: RuleInput["mode"]) =>
  new Set(Array.from({ length: 30 }, (_, i) => planNotifications(base({ mode, user: { id: `u${i}`, petName: "Faísca" } as RuleInput["user"] }, { hour: 19 }))[0].body));
const low = tones("Baixo");
const high = tones("Avançado");
assert.ok(low.size >= 2, "varia as frases");
assert.ok([...low].some((b) => b.includes("Faísca")));
assert.ok([...high].every((b) => !low.has(b)), "Avançado é comemorativo, diferente do Baixo");
// frase estável no mesmo dia
assert.equal(planNotifications(base({}, { hour: 19 }))[0].body, planNotifications(base({}, { hour: 20 }))[0].body);

// revisão vencida
const rev = planNotifications(
  base({ streak: { streak: 3, burned: [], studiedToday: true }, overdueReview: { subject: "Probabilidade", topic: "Eventos", days: 12 }, favoriteSubject: "Biologia" }, { hour: 16 }),
);
assert.deepEqual(kinds(rev), ["review"]);
assert.equal(rev[0].url, "/cronograma");
assert.ok(rev[0].body.includes("Probabilidade") || rev[0].body.includes("Eventos"));

// amigo estudou e você não
const fr = planNotifications(base({ friend: { name: "Nico", minutes: 120 } }, { hour: 15 }));
assert.deepEqual(kinds(fr), ["friend"]);
assert.match(fr[0].body, /Nico/);
assert.match(fr[0].body, /2h/);
assert.deepEqual(kinds(planNotifications(base({ friend: { name: "Nico", minutes: 10 } }, { hour: 15 }))), []);

// água no meio da tarde, só se faltar
assert.deepEqual(kinds(planNotifications(base({ waterCups: 2, streak: { streak: 0, burned: [], studiedToday: true } }, { hour: 15, minute: 30 }))), ["water"]);
assert.deepEqual(kinds(planNotifications(base({ waterCups: 2, streak: { streak: 0, burned: [], studiedToday: true } }, { hour: 17 }))), []);

// ENEM
const en = planNotifications(base({ user: { enemDate: "2026-10-13" } as RuleInput["user"], streak: { streak: 0, burned: [], studiedToday: true } }, { hour: 9 }));
assert.deepEqual(kinds(en), ["enem"]);
assert.match(en[0].body, /7 dias/);

// lenha queimada ontem
const fw = planNotifications(base({ streak: { streak: 9, burned: ["2026-10-05"], studiedToday: false }, studiedYesterday: false }, { hour: 9 }));
assert.deepEqual(kinds(fw), ["firewood"]);
assert.equal(fw[0].dedupe, "firewood:2026-10-05");

// foguinho esfriando, com prioridade abaixo da sequência
const cold = planNotifications(base({ studiedYesterday: false, streak: { streak: 0, burned: [], studiedToday: false } }, { hour: 12 }));
assert.deepEqual(kinds(cold), ["cold"]);
assert.match(cold[0].body, /Brasa/);
assert.deepEqual(kinds(planNotifications(base({ studiedYesterday: false, everStudied: false, streak: { streak: 0, burned: [], studiedToday: false } }, { hour: 12 }))), []);
const many = planNotifications(base({ studiedYesterday: false, waterCups: 0, friend: { name: "Nico", minutes: 60 }, streak: { streak: 4, burned: ["2026-10-05"], studiedToday: false } }, { hour: 19 }));
assert.deepEqual(kinds(many), ["streak", "firewood", "friend", "cold"]);

// plano do dia: só de manhã e só se ainda não estudou
const bloco = { subject: "Matemática", topic: "Funções", kind: "study" as const, min: 50, left: 3 };
const plan = planNotifications(base({ todayBlock: bloco, streak: { streak: 0, burned: [], studiedToday: false } }, { hour: 9 }));
assert.deepEqual(kinds(plan), ["plan"]);
assert.equal(plan[0].url, "/cronograma");
assert.match(plan[0].body, /Funções|Matemática/);
assert.equal(plan[0].dedupe, "plan:2026-10-06");
assert.deepEqual(kinds(planNotifications(base({ todayBlock: bloco }, { hour: 13 }))), []);
assert.deepEqual(kinds(planNotifications(base({ todayBlock: bloco, streak: { streak: 3, burned: [], studiedToday: true } }, { hour: 9 }))), []);
assert.deepEqual(planNotifications(base({ todayBlock: bloco, user: { prefs: { off: ["plan"] } } as RuleInput["user"] }, { hour: 9 })), []);
// revisão do dia aparece como "revisão", não "estudo"
assert.match(
  planNotifications(base({ todayBlock: { ...bloco, kind: "review" }, mode: "Regular" }, { hour: 9 }))[0].body,
  /revisão|Matemática|Funções/,
);

// lembretes locais do APK (Brasília = UTC−3)
const now = Date.parse("2026-10-06T13:00:00Z"); // 10h em Brasília
const loc = planLocalReminders(base({ waterCups: 1, todayBlock: bloco, overdueReview: { subject: "Química", topic: "pH", days: 5 } }), now);
assert.deepEqual(loc.map((r) => [r.kind, r.at]), [
  ["water", "2026-10-06T18:30:00.000Z"],
  ["review", "2026-10-06T20:00:00.000Z"],
  ["streak", "2026-10-06T23:00:00.000Z"],
]);
assert.ok(loc.every((r) => Number.isInteger(r.id) && r.id < 2 ** 31));
// de madrugada o plano do dia (9h) também entra
assert.deepEqual(
  planLocalReminders(base({ waterCups: 1, todayBlock: bloco }), Date.parse("2026-10-06T10:00:00Z")).map((r) => [r.kind, r.at]),
  [
    ["plan", "2026-10-06T12:00:00.000Z"],
    ["water", "2026-10-06T18:30:00.000Z"],
    ["streak", "2026-10-06T23:00:00.000Z"],
  ],
);
// já passou das 18h: só a sequência
assert.deepEqual(planLocalReminders(base({ waterCups: 1 }), Date.parse("2026-10-06T21:30:00Z")).map((r) => r.kind), ["streak"]);
// silêncio cobre as 20h: nada de sequência
assert.deepEqual(planLocalReminders(base({ user: { prefs: { quietStart: 19, quietEnd: 8 } } as RuleInput["user"] }), now), []);

console.log("notification-rules ok");
