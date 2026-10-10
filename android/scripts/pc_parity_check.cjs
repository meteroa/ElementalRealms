#!/usr/bin/env node
/**
 * PC 对齐校验工具 (Spectromancer PC parity checker)
 *
 *   node scripts/pc_parity_check.cjs            # 全量报告
 *   node scripts/pc_parity_check.cjs --missing  # 只列未实装卡牌
 *
 * 数据来源（唯一权威）：pc/Inf/Gd.spe
 *   - 前 3366 行是数值表：305 条记录 x 11 个整数，与后面的文本卡表「按顺序一一对应」
 *       [ groupId, cost, attack, life, p1, p2, p3, p4, x, y, z ]
 *     注意：数值表与文本表在文本第 99 张（Sleeping Giant）之后错位一条，
 *     所以 **费用/攻血一律以文本描述为准**，数值表只作旁证。
 *   - 余下部分是文本卡表：奇数行 ^卡名^，偶数行 ^描述^（描述里 ~ 是换行）
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const GD = path.join(root, 'pc/Inf/Gd.spe');
const CARDS = path.join(root, 'android/src/data/cards.json');
const GAME = path.join(root, 'android/src/engine/game.ts');
const MAIN = path.join(root, 'android/src/main.ts');

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- PC 侧 ----------
const lines = fs.readFileSync(GD, 'latin1').split(/\r?\n/).map((l) => l.replace(/\r$/, ''));
const numericRows = lines.findIndex((l) => !/^-?\d+$/.test(l));
const nums = lines.slice(0, numericRows).map(Number);
const text = lines.slice(numericRows);
const pcCards = [];
for (let i = 0; i < text.length - 1; i++) {
  const m = /^\^([^^]+)\^$/.exec(text[i]);
  if (m && text[i + 1].startsWith('^')) {
    pcCards.push({ name: m[1].trim(), desc: text[i + 1].replace(/\^/g, '').trim() });
  }
}
function pcStats(desc) {
  // Gd.spe descriptions are hard-wrapped with ~, which can split a phrase across lines
  // ("attack is~equal to …"), so every pattern is matched against a flattened copy.
  const flat = desc.replace(/~/g, ' ');
  const cost = /cost\^?\s*([0-9]+)/i.exec(flat);
  const atk = /Attack\^?\s*(-?[0-9]+)/i.exec(flat);
  const life = /life\^?\s*:?\s*([0-9]+)/i.exec(flat);
  return {
    kind: desc.split(',')[0].trim(),
    isSpell: /spell$/i.test(desc.split(',')[0].trim()),
    // "attack is equal to …" (Elementals / Air Spirit / Megacolossus) and
    // "The attack of X is equal to …" (Forest Wolf inherits the killed Magic Rabbit's attack).
    variableAtk: /attack is equal/i.test(flat) || /attack of [^.]{0,60}?\bis equal\b/i.test(flat),
    cost: cost ? +cost[1] : null,
    attack: atk ? +atk[1] : null,
    life: life ? +life[1] : null,
  };
}

// 引擎内部生成的衍生卡/随从（不对应 Gd.spe 条目）
const DERIVED = new Set([
  'scrambledlemure', 'enragedquartermaster', 'demonapostate', 'forestspider',
  'rageofsouls', 'naturalhealing', 'poison', 'enrage',
  'pumpenergy', 'movefalcon', 'trumpet', 'gaze', 'breathefire', 'suddenstrike',
]);

// ---------- 安卓侧 ----------
const cards = JSON.parse(fs.readFileSync(CARDS, 'utf8'));
const byName = new Map();
pcCards.forEach((c) => {
  const k = norm(c.name);
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(c);
});

const problems = [];
const missing = [];
const seen = new Set();
pcCards.forEach((c) => {
  const k = norm(c.name);
  if (seen.has(k)) return;
  seen.add(k);
  if (!cards.some((a) => norm(a.name) === k) && !DERIVED.has(k)) missing.push(c);
});

cards.forEach((a) => {
  const list = byName.get(norm(a.name));
  if (!list) return; // 衍生卡
  let best = null;
  let bestScore = -1;
  list.forEach((p) => {
    const q = pcStats(p.desc);
    let s = 0;
    if (q.cost === a.cost) s++;
    if (q.life === a.life) s++;
    if (s > bestScore) { bestScore = s; best = p; }
  });
  const q = pcStats(best.desc);
  const issues = [];
  // Gd.spe leaves the cost out of token entries (Bee Soldier); tokens are free and spawned by
  // the engine, so 0 is the only acceptable android cost for them.
  if (q.cost === null ? a.cost !== 0 : q.cost !== a.cost) {
    issues.push(`cost PC=${q.cost} AND=${a.cost}`);
  }
  if (q.isSpell !== (a.type === 'spell')) issues.push(`type PC="${q.kind}" AND=${a.type}`);
  if (a.type !== 'spell') {
    // A description that states no attack at all (Solid Echo: "Cost 1, Life 1") leaves nothing to
    // compare against — the text is authoritative, so the field is simply unverifiable.
    if (!q.variableAtk && q.attack !== null && q.attack !== a.attack) issues.push(`attack PC=${q.attack} AND=${a.attack}`);
    if (q.life !== a.life) issues.push(`life PC=${q.life} AND=${a.life}`);
  }
  if (issues.length) problems.push(`${a.id} "${a.name}"\n    ${issues.join('; ')}\n    PC: ${best.desc.replace(/~/g, ' ')}`);
});

// ---------- 引用了但引擎没实现的 handler ----------
const game = fs.readFileSync(GAME, 'utf8');
const main = fs.readFileSync(MAIN, 'utf8');
const engine = game + main;
const implemented = new Set([
  ...[...game.matchAll(/^\s*case '([a-z0-9_]+)':/gm)].map((m) => m[1]),
  ...[...game.matchAll(/ability === '([a-z0-9_]+)'/g)].map((m) => m[1]),
  ...[...game.matchAll(/ability = '([a-z0-9_]+)'/g)].map((m) => m[1]),
  ...[...game.matchAll(/onSummon === '([a-z0-9_]+)'/g)].map((m) => m[1]),
]);
const unhandled = [];
cards.forEach((c) => {
  ['ability', 'onSummon', 'spellEffect'].forEach((f) => {
    const v = c[f];
    if (v && !implemented.has(v) && !String(v).startsWith('beast_ability_')) {
      unhandled.push(`${c.id}.${f} = '${v}'`);
    }
  });
});

// ---------- 报告 ----------
const onlyMissing = process.argv.includes('--missing');

if (!onlyMissing) {
  console.log(`PC 卡牌条目(含重复): ${pcCards.length}   唯一未实装: ${missing.length}   android 卡牌: ${cards.length}`);
  console.log('\n=== 数值/类型与 Gd.spe 描述不一致 ===');
  console.log(problems.length ? problems.join('\n') : '(无)');
  console.log('\n=== 卡牌引用了但引擎无对应分支 ===');
  console.log(unhandled.length ? unhandled.join('\n') : '(无)');
}

const group = (c) => {
  const d = c.desc;
  if (/^Blood/.test(d)) return 'Blood 血族';
  if (/^Cult/.test(d)) return 'Cult 邪教';
  if (/^Golem |^Creature,/.test(d)) return 'Golem 魔像';
  if (/^Holy/.test(d)) return 'Holy 初版圣职';
  if (/^Forest/.test(d)) return 'Forest 森林';
  if (/^Special creature|^Tamed|^Pet/.test(d)) return 'GoP 中立造物';
  return '其它';
};
const groups = {};
missing.forEach((c) => {
  const g = group(c);
  (groups[g] = groups[g] || []).push(c);
});
console.log('\n=== 尚未实装的卡牌（按原版流派分组）===');
Object.keys(groups).sort().forEach((g) => {
  console.log(`\n-- ${g} (${groups[g].length}) --`);
  groups[g].forEach((c) => console.log(`  ${c.name} :: ${c.desc.replace(/~/g, ' ')}`));
});

process.exit(problems.length || unhandled.length ? 1 : 0);
