import assert from "node:assert/strict";
import { daysLeft, fmtMetric, missionMembers, missionProgress, missionStatus, suggestWeeklyMission, type DailyStat } from "./missions";

const ws = "2026-10-04"; // domingo
const everyone = ["ana", "bia", "nico"];
const stats: DailyStat[] = [
  { userId: "ana", day: "2026-10-04", minutes: 90, questions: 20, sessions: 2 },
  { userId: "ana", day: "2026-10-05", minutes: 30, questions: 0, sessions: 1 },
  { userId: "bia", day: "2026-10-05", minutes: 60, questions: 40, sessions: 1 },
  // fora do período: não conta
  { userId: "nico", day: "2026-10-03", minutes: 600, questions: 100, sessions: 5 },
  { userId: "nico", day: "2026-10-06", minutes: 0, questions: 10, sessions: 0 },
];
const base = { startDay: ws, endDay: "2026-10-10", memberIds: [] as string[] };

// horas: soma do grupo e contribuição de cada um
const h = missionProgress({ ...base, metric: "hours", target: 6 }, stats, everyone);
assert.equal(h.total, 3);
assert.equal(h.pct, 50);
assert.equal(h.done, false);
assert.deepEqual(h.contributions, [
  { userId: "ana", value: 2 },
  { userId: "bia", value: 1 },
  { userId: "nico", value: 0 },
]);

// questões e sessões
assert.equal(missionProgress({ ...base, metric: "questions", target: 70 }, stats, everyone).total, 70);
assert.equal(missionProgress({ ...base, metric: "questions", target: 70 }, stats, everyone).done, true);
assert.equal(missionProgress({ ...base, metric: "sessions", target: 10 }, stats, everyone).total, 4);
// dias: só dias com foco contam (nico só fez questões no dia 6)
assert.equal(missionProgress({ ...base, metric: "days", target: 3 }, stats, everyone).total, 3);

// dupla: só os membros escolhidos (e só se ainda estiverem no grupo)
const duo = missionProgress({ ...base, memberIds: ["bia", "nico", "fantasma"], metric: "hours", target: 1 }, stats, everyone);
assert.deepEqual(duo.contributions.map((c) => c.userId), ["bia", "nico"]);
assert.equal(duo.done, true);
assert.equal(duo.pct, 100);
assert.deepEqual(missionMembers({ memberIds: [] }, everyone), everyone);

// status e dias restantes
assert.equal(missionStatus(base, "2026-10-03"), "upcoming");
assert.equal(missionStatus(base, "2026-10-04"), "active");
assert.equal(missionStatus(base, "2026-10-10"), "active");
assert.equal(missionStatus(base, "2026-10-11"), "ended");
assert.equal(daysLeft(base, "2026-10-10"), 1);
assert.equal(daysLeft(base, "2026-10-04"), 7);

// missão da semana: semana inteira, grupo todo, alvo cresce com o grupo
const s3 = suggestWeeklyMission(ws, 3);
assert.equal(s3.startDay, ws);
assert.equal(s3.endDay, "2026-10-10");
assert.deepEqual(s3.memberIds, []);
assert.ok(s3.target > suggestWeeklyMission(ws, 1).target);
// alterna a métrica de uma semana para outra
assert.notEqual(suggestWeeklyMission(ws, 3).metric, suggestWeeklyMission("2026-10-11", 3).metric);

assert.equal(fmtMetric("hours", 2.5), "2,5h");
assert.equal(fmtMetric("questions", 70), "70 questões");

console.log("missions ok");
