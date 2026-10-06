import assert from "node:assert/strict";
import { clampBase, clampMinutes, earnedTokens, gateText, TOKENS, tokenBudget, tokensLabel, xpToNextToken } from "./tokens";

// 1 token extra a cada 100 XP do dia, com teto de 5
assert.equal(earnedTokens(0), 0);
assert.equal(earnedTokens(99), 0);
assert.equal(earnedTokens(100), 1);
assert.equal(earnedTokens(250), 2);
assert.equal(earnedTokens(10_000), TOKENS.maxEarned);
assert.equal(earnedTokens(-5), 0);
assert.equal(earnedTokens(Number.NaN), 0);

assert.equal(xpToNextToken(0), 100);
assert.equal(xpToNextToken(40), 60);
assert.equal(xpToNextToken(100), 100);
assert.equal(xpToNextToken(160), 40);
assert.equal(xpToNextToken(TOKENS.maxEarned * TOKENS.xpPerToken), null);

// dia sem estudo: só a base
const zero = tokenBudget({ xpToday: 0 });
assert.deepEqual([zero.base, zero.earned, zero.total, zero.left], [TOKENS.base, 0, TOKENS.base, TOKENS.base]);

// estudou 320 XP e gastou 2 tokens
const b = tokenBudget({ baseTokens: 3, xpToday: 320, spent: 2 });
assert.deepEqual([b.base, b.earned, b.total, b.spent, b.left], [3, 3, 6, 2, 4]);

// nunca fica negativo, mesmo gastando mais do que tinha (fila do celular fora de sincronia)
assert.equal(tokenBudget({ baseTokens: 1, xpToday: 0, spent: 9 }).left, 0);

// base fora do intervalo é cortada
assert.equal(tokenBudget({ baseTokens: 99, xpToday: 0 }).base, TOKENS.baseMax);
assert.equal(tokenBudget({ baseTokens: -4, xpToday: 0 }).base, TOKENS.baseMin);

// base 0 é válida: todo token precisa ser ganho estudando
assert.equal(tokenBudget({ baseTokens: 0, xpToday: 150 }).total, 1);

assert.equal(clampBase(4), 4);
assert.equal(clampBase(1000), TOKENS.baseMax);
assert.equal(clampMinutes(1), TOKENS.minutesMin);
assert.equal(clampMinutes(600), TOKENS.minutesMax);
assert.equal(clampMinutes(Number.NaN), TOKENS.minutesMin);

assert.equal(tokensLabel(0), "Sem tokens hoje");
assert.equal(tokensLabel(1), "Resta 1 token");
assert.equal(tokensLabel(3), "Restam 3 tokens");

assert.match(gateText({ left: 2, minutes: 10, app: "Instagram" }), /gastar 1 token\. Restam 2\. É realmente necessário\?/);
assert.match(gateText({ left: 0, minutes: 10, app: "Instagram" }), /acabaram/);

console.log("tokens.test.ts ok");
