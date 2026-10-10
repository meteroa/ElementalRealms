# Spectromancer 安卓版 ↔ PC 原版对齐 —— 交接说明

> 这份文档写给「接手继续做的下一个 agent」。目标是把 `android/`（TypeScript + Vite + Capacitor 移植版）
> 与原版 PC 工程 `pc/` 在**卡牌技能、动画、音效**上做到一致。
> `pc/` 只读参考，**任何情况下不要修改 `pc/` 下的文件**（其中 `*.ctl / game.log / Steps.out / game.old`
> 是 `Spectromancer.exe` 的运行期状态文件，跑一次游戏就会变）。
> 最后更新：2026-10-09（第六批：虹光法师 / 《力量集结》中立造物 50 张，**原版 305 张卡牌全部实装完毕**，见 §1.9）

---

## 0. 五分钟上手

```bash
cd android
node_modules/.bin/tsc --noEmit      # 类型检查，必须零错误
npm run build                        # 产出 dist/，必须成功
node scripts/pc_parity_check.cjs     # 与 PC 数据对账：数值差异 / 未实装卡牌 / 缺失的引擎分支
```

`pc_parity_check.cjs` 是目前唯一的自动化对账工具，退出码非 0 表示有差异或缺失分支。
**每次改动卡牌数据或引擎后都要跑它**，期望输出：`数值/类型与 Gd.spe 描述不一致 (无)` 且 `卡牌引用了但引擎无对应分支 (无)`。

---

## 1. 已经做完的事（不要重做）

### 1.1 音效
* `android/src/engine/sound.ts` 的 `soundCatalog`（146 条）已按 `pc/Sounds.ctl` **逐条重算**：
  `volume = PC 的 vol / 100`（PC 缺省 vol 即 100）。>1 的值（Inferno/Armageddon 150、Stone Rain/Drain Souls 120、
  Nature's Fury 200、Blood Ritual 500）是原版的增益请求，播放时按原版引擎行为钳制。
* 每张有专属音效的卡牌现在的 key 与实际播放**已对齐**（tornado / naturalfury / armageddon / overtime /
  poisoncloud / hypnosys / sacrifice / sonic_boom / rage_of_souls / drainsouls，以及 5 个野兽主动技能
  Enrage / Pump_Energy / Trumpet / Gaze / Breathe_Fire）。
* **原版通用效果音层**已落地：没有专属音效的伤害/减益效果播 `negativeeffect`（NegativeEffect.ogg），
  增益播 `positiveeffect`，10~12 点治疗播 `healingmini`。
  → **新增卡牌时按此规则选音效，不要借用别的卡的专属音效。**
* `sound.has(name)` 用于「PC 表里没有就不播」，避免对不存在文件发请求。
* 音量与音高无关：原版对召唤/攻击按左右声道 pan（`SummonCreature\Player p=40` / `Opponent p=-60`），
  安卓**没有 pan**，这是已知未做的差距。

### 1.2 动画
* `android/src/main.ts` 的 `playSpellVFX()` 是法术特效总路由，按 `card.id` 走一串 `if` 分支，
  最后 fallback 到 `if (sound.has(card.id)) sound.play(card.id)`。
  **分支顺序有意义**（先匹配先生效），新增卡牌要放在合适位置，别被前面的宽条件吞掉
  （历史上就出过 `includes('time')` 吞掉 `mech_overtime`、`element === 'air'` 吞掉 Tornado 的事故）。
* 已修正：Tornado / Nature's Fury / Overtime 的错配特效；为 Armageddon、Hypnosis、Poisonous Cloud、
  Sacrifice、Sonic Boom、Rage of Souls 补了特效；`.spell-vfx-arcane` 补上定位规则（否则整类全屏特效不显示）。
* CSS 里 `vfx-wrath-burst`、`vfx-acid-drop`、`spell-vfx-flamewave`、`spell-vfx-acidic` 各有 **2~3 份重复定义**
  （后者覆盖前者），是历史遗留，尚未整理。
* 原版动画素材清单（`pc/Images/Combat/`，对应 `exe` 里的 `images\combat\*` 字符串）：
  `particles / stone / LBolt / LParts / wrath1 / wrath2 / spirits / rat / ritForest / TimeStop / rabbits /
  Vampire / Golem / magicwand / stunned`。安卓侧的对应类多数已存在；`vfx-golem-smash`、`vfx-vampire-drain`
  是为尚未实装的 Golem / Vampire 卡预留的，**不要当死代码删掉**。

### 1.3 技能
已按原版修正（详见 `CHANGELOG.md` 的 `[Unreleased] - 2026-10-09`）：
Rage of Souls 的行为、Insanian Lord 的行为、Faerie Apprentice 的 +1 固定加伤（不是百分比）、
Priestess of Moments 缺失的额外攻击、Merfolk Overlord 先攻光环只作用邻格、横扫类生物对敌方本体的伤害、
反射之墙反弹上限、巨型蜘蛛臆造的剧毒、虚弱/混沌死棘/音爆错误的「需要指定目标」、
救援行动可指定任意一方生物、Oracle 的伤害下限、Power Chains 只能指定火/水/气/土生物、
恶魔变节者数值与每回合回血。

**卡牌数值已 100% 对齐**：`cards.json` 中每一张（含新增）的费用/攻血/类型都与 `Gd.spe` 描述一致，
`pc_parity_check.cjs` 可复验。

### 1.4 死代码
已删除：重复且不可达的第二个 `case 'spawn_spiders'`；臆造的 `energy_beast_pulse`、`wolverine_berserk_regen`；
整套臆造的「剧毒持续伤害」机制（含 `types.ts` 的 `poison` 字段）；被 Canvas 闪电渲染取代的
`.spell-vfx-lightning` / `.spell-vfx-bolt`。
保留（属于未实装卡牌的预留实现）：`vampirism`（吸血鬼）、`water_growth_1`（人鱼革命者）、
`sorcery_growth_2`（巫师学徒）。

### 1.5 已实装的森林流派（10 张，本轮）
`cards.json` 追加 10 条 `forest_*` 条目；`game.ts` 新增森林机制；`main.ts` 新增 `HeroClass 'forest'`。
* **职业被动【魔法兔子】**：`executeCombat()` 末尾调用 `triggerClassEndOfTurn()` —— 森林法师回合结束时，
  若 `isMagicRabbitInPlay()` 为假，就在随机空格 `spawnToken('forest_magic_rabbit')`；
  `startTurn()` 里 `ability === 'rabbit_growth_1'` 负责每回合永久 +1 攻击。
* **以兔子攻击力为参数的卡**：`ownRabbitAttack(who)` 是唯一取值入口（暴怒海狸 / 森林仪式 / 森林饿狼 / 复仇浣熊）。
* **森林饿狼**的落位限制写在 `canPlayCard()` + `playCard()`（扣能量之前校验）+ `triggerAiTurn()` 的独立候选分支；
  客户端在 `main.ts` 的战斗槽位高亮与点击分支同步（判定条件 `onSummon === 'forest_wolf_devour'`）。
* **衍生单位**：【兵蜂】在 `cards.json` 里是真实条目但带 `token: true`，发牌池（`createPlayer`）与自组卡组池
  都会过滤掉它；`spawnToken()` 是引擎通用的衍生单位生成器。
* **统一伤害汇点**：`triggerDamage()` 现在串联两件事——`absorbSpellDamageAura()`（古木守护者 -3）与
  `onCreatureDamaged()`（暴怒熊 +1）。**新增「受到伤害时」类卡牌应挂在这里**，不要逐个伤害点去改；
  反过来说，**任何直接 `currentLife -=` 而不调用 `triggerDamage()` 的新代码都会漏掉这些被动**。
* 森林演出：`main.ts::playSpellVFX()` 的 `forest_ritual_of_the_forest` 分支（世界树 + 圣盾，专属音效
  `ritual_of_the_forest.ogg`）；被动兔子登场走新的引擎回调 `onCreatureAppear`，播 `.vfx-rabbits`（`Rabbits.tga`）。
* `HeroClass` 新增 `'forest'` 后，敌方流派池（`game.ts` 两处 `enemyClassPool`、`main.ts` 的
  `validClasses` / `availableClasses`）都同步成 12 种。

### 1.6 已实装的魔匠流派（9 张，本轮）
`cards.json` 追加 9 条 `golem_*` 条目；`game.ts` 新增冠军生物机制；`main.ts` 新增 `HeroClass 'golem'`。
* **职业被动 / 冠军生物**：`placeClassChampion(side)` 在构造函数与 `reset()` 里调用（在战场预置随从之后、
  `startTurn()` 之前），用通用的 `spawnToken()` 把 `golem_golem` 放进随机空格；双方都会判定。
* **【魔像】的身份就是 `card.id === 'golem_golem'`**（与森林的兔子一致）：`cleanupDead()` 里拦截它的死亡，
  换到另一个随机空格满血归位、拥有者扣 10 血（`otherSlots` 为空时回落自身格位，因此它总能归位）。
  若将来要让「消灭」类效果彻底终结它，只需在这里加判定。
* **玩家态强化**：`PlayerState.golemAttackBonus`（永久，军备升级 / 魔像操纵师写入，魔像死后仍在）与
  `PlayerState.golemTempAttackBonus`（本回合，魔像之忿 / 魔像引导者写入，在 `executeCombat()` 的
  「Revert temporary buffs」处清零）。两者都由 `recalculateBoardStats()` 加到**所有** `golem_golem` 身上。
  **这两个字段是 LAN 状态快照的一部分**（`NetworkGameStateSnapshot.player/enemyGolem*`），新增加成字段时
  记得同步 `exportStateSnapshot()` 与 `applyStateSnapshot()`（后者要做左右换位）。
* **动态攻击力新写法**：`ability: 'attack_equal_friendly_count'`（魔像操纵师）= 拥有者场上生物数量，
  在 `recalculateBoardStats()` 里与 `air_spirit_swarm` 并列，AI 的 `baseAttack` 估算也要同步加分支。
* **额外攻击**：`executeCombat()` 的 `attackQueue` 同时处理「瞬时祭司」与「魔像掌控者在场时的魔像」。
* **守护石像**：走 §1.5 提到的统一伤害汇点——`types.ts` 的 `BoardCreature.hasAttacked` 在
  `executeCombat()` 里攻击者真正出手前置位，`applyDamageModifiers()` 据它免疫全部伤害。
* **魔匠演出**：三张法术用原版专属音效（`GolemsFrenzy.ogg` / `GolemsJustice.ogg` / `ArmyUpgrade.ogg`），
  在 `main.ts::playSpellVFX()` 里以 `Golem.tga`（`.vfx-golem-smash`）为核心；魔像归位复用同一个
  `onCreatureAppear` 回调。

### 1.7 已实装的邪教流派（8 张，本轮）
`cards.json` 追加 8 条 `cult_*` 条目；`game.ts` 扩展伤害路由层与攻击结算钩子；`main.ts` 新增 `HeroClass 'cult'`。
* **伤害路由层 `applyDamageModifiers(side, slot, amount, depth, noRedirect)`** 现在同时处理五条规则，全部挂在
  唯一汇点 `triggerDamage()` 上（调用方已经扣过血，所以每条规则都表达为「把伤害加回去」）：
  1. 守护石像 —— 首次攻击前全额免疫；
  2. 邪恶独角兽 —— 对方魔法伤害转嫁给对格生物（需对格存在且非魔免）；
  3. 掠夺者 —— 己方其它生物受到的任何伤害改由它承受；
  4. 狂热信徒 —— 对方魔法伤害 ×2（再扣一次等量生命并回报 `amount * 2`）；
  5. 古木守护者 —— 对方魔法伤害 -3。
  `depth` 只在 0 层做转嫁，`noRedirect` 标记自伤反噬（见下），两者防止转嫁链与错误接管。
  **新增同类卡牌请在这里加分支，不要另开钩子。**
* **攻击结算钩子 `onAttackDamageDealt(side, dealer, amount)`**：在 `executeCombat()` 里攻击者真正造成伤害后调用
  （对格生物 / 直击本体 / 象牙替伤 / 地狱机兵三格 / 横扫合计共 5 处），供**狂热死士**（自损等量生命）与
  **狂怒纪念碑**（流失等量生命）结算。自伤一律带 `{ noRedirect: true }`，否则会被【掠夺者】接管。
  新增「造成伤害时」类卡牌也应挂在这里。
* **额外攻击**：`attackQueue` 现在同时处理「瞬时祭司」「魔像掌控者 + 魔像」「狂怒纪念碑 + 全军」。
* **禁止施法**：`canPlayCard()` 里在扣除能量前判定「己方场上有【掠夺者】且这是一张魔法卡」→ 直接 false；
  客户端在 `main.ts` 选中卡牌时给出原版提示语。
* **成长修正可为负**：`blind_prophet_growth` 把 `extraFireGrowth` 等 +1 的同时令 `extraSpecialGrowth -= 1`，
  `startTurn()` 的成长公式本身允许负值（最终 `g` 由 `actor.growth[elem] + extra` 相加）。
* **邪教演出**：灵魂之召用专属音效 `AncientSpirits.ogg`，以 `spirits` 精灵两段扫描（敌方重、己方淡）。

### 1.8 已实装的鲜血流派（9 张）
`cards.json` 追加 9 条 `blood_*` 条目；`game.ts` 新增双重付费与伤害放大；`main.ts` 新增 `HeroClass 'blood'`。
* **双重付费**：`CardDef.lifeCost`（生命那部分费用）+ `canPlayCard()` 的 `actor.hp > card.lifeCost` 判定 +
  `playCard()` 在扣能量后 `actor.hp -= lifeCost` 并 `triggerDamage(who,'hero',lifeCost,{selfInflicted:true})`。
  AI 在 `triggerAiTurn()` 的评分里按 `lifeCost` 扣分，并在生命低于 30/20 时追加惩罚；UI 用
  `main.ts::lifeCostBadge()` 出具角标（手牌 / 对方已明示手牌 / 图鉴 / 自组卡组池）。
* **`selfInflicted` 语义升级**（原 `noRedirect`，§1.7 里那几处已同步改名）：既不让【掠夺者】接管，
  也不让【审判者】放大；标记者为狂热死士 / 狂怒纪念碑 / 邪恶独角兽自身流失 / 血族生命付费 /
  魔像归位 10 血 / 霸古魔王反噬。
* **本体受伤汇点 `onHeroDamaged(side, amount)`**：在 `triggerDamage()` 里 `slot === 'hero'` 时调用，
  血之秘术师（对方本体受伤 → 本回合 +2，写入 `tempAttackBuff`）与惩戒者（自己本体受伤 → +2，
  写入 `pendingAttackBonus`，由 `executeCombat()` 在其攻击后清零）都挂在这里。
* **`recalculateBoardStats()` 现计入 `tempAttackBuff` 与 `pendingAttackBonus`**——新增「临时加攻」类效果
  请写这两个字段之一，**不要直接改 `currentAttack`**（否则一次重算就丢）。
* 其余机制：食尸鬼/血之从者在 `cleanupDead()` 的死亡钩子里（敌方生物死亡喂养 / 死亡返还鲜血能量）、
  血之从者在 `startTurn()`、审判者在 `applyDamageModifiers()`（对格生物 ×2 + 未阻挡时本体 +2）、
  吸血鬼长老的护卫与仆从免疫（`vampire_elder_ward` / `initiate_warded`）、血魔导师在 `resolveOnSummon()`。
* 专属音效：鲜血沸腾 `BloodBoil.ogg`；其余按通用效果音层（含生命付费 → `NegativeEffect`）。

---

## 2. 权威数据来源（怎么自己查原版行为）

### 2.0 卡组与数值表字段（2026-10-09 考证结论，实装剩余卡牌前必读）

* **一副卡组 = 20 张 = 4 火 + 4 水 + 4 气 + 4 土 + 4 流派专属**。证据：exe 字符串 `^Your deck should contain 20 cards^`；
  `pc/Inf/decks.spe`（uint32 头 + 50 × 60 字节记录，每条记录含 20 个 little-endian uint16 卡 id）
  里「机械」套牌为 2,3,5,11 + 13,15,17,19 + 26,28,31,34 + 37,39,45,47 + 65,66,67,68，
  映射回 `Gd.spe` 恰好是 field0 = 1/2/3/4/5 各 4 条；exe 列名 `^Fire cards^ ^Water cards^ ^Air cards^ ^Earth cards^ ^Special cards^`。
  安卓引擎的 `createPlayer()` 正是这个模型，不需要改。
* **`Gd.spe` 数值表 11 个整数**（已交叉验证）：`[0]` 分组（1=火 2=水 3=气 4=土 5=流派 6=中立）；
  `[1..3]` = 费用 / 攻击 / 生命；`[5]=1` 恰好对应 10 张「攻击可打全场」的卡；
  `[6]`：所有 field0=5 的 128 张都是 50，所有 field0=6 的 54 行与 24 个衍生/子技能行都是 0
  ——**同一卡池内 `[6]=50` 即「可发牌」，`0` 即「引擎衍生/子技能」**（与 [#1.5](#15-已实装的森林流派10-张本轮) 的
  `token` 判定一致）；`[8]=1` 恰好是 14 张「对魔法免疫」；`[9]` = 需要指定目标；`[10]` = 目标类型。
* **field0=6 的中立池不进普通卡组**：`decks.spe` 里没有任何一条，且 exe 另外列出一个独立法师
  `^Spectromancer^`（虹光法师）与赛制 `^Duels of spectromancers^`。因此**这 50 张应当作为第 16 个流派
  （虹光法师，`HeroClass 'spectromancer'`，能量走通用 `'special'`）的专属卡池**实装，而不是塞进现有流派的牌库。
* **`Tamed Griffin`（9 个变体）+ `Sudden strike` 不是卡组卡**，而是战役圣物产物：exe 字符串
  `^Book of Griffinology^`、`^Griffin collar^`、`^Griffin's training (+1 attack and +2 life)^`、
  `^Spiked griffin barding (+1 attack)^`、`^Heavy griffin barding (+4 life)^` 等对应 9 个变体的数值；
  `Sudden strike` 是宠物主动技能（「移动到目标空格，攻击 +3」）。安卓的战役圣物「驯化狮鹫 / 狮鹫学之书」已有对应玩法。
* **两处数值表与自身文本冲突**（一律以文本为准）：`Inactive Hellbot` 表里 cost=5 而文本写 cost 9；
  `Vampiric Cloud` 表里 life=99 而文本写 life 20。
* 卡牌数据库里 `Tamed Griffin` 出现 9 次、`Starfish` 出现 4 次（同名不同数值：4/16 本体 + 4/8 衍生），
  `pc_parity_check.cjs` 会按费用/生命取最匹配的一条，因此同名衍生卡可以放心另建一条 `token: true` 条目。


| 文件 | 内容 | 读法 |
|---|---|---|
| `pc/Inf/Gd.spe` | **卡牌全文数据库** | 前 3366 行是 305 条 × 11 个整数；之后是文本卡表：奇数行 `^卡名^`，偶数行 `^描述^`（`~` 是换行）。**费用/攻血一律以文本描述为准** —— 数值表在文本第 99 张（Sleeping Giant）之后与文本表**错位一条**，不可靠 |
| `pc/Sounds.ctl` | **音效事件表** | `事件名 "文件.ogg,vol=NN,pan=NN"`。事件名基本就是卡名（`Flame_Wave`、`Natures_Fury`…）；`vol` 单位是百分比，缺省 100；`none` 表示无音效 |
| `pc/Spectromancer.exe` | **行为真相** | 可打印字符串查：`Sound\Play\<卡名>` 是卡牌音效机制；`Sound\Play\...` 附近的**效果文本片段**给出了通用效果音层规则（如 ` ^deals 2 damage to opponent's creatures^` → `Sound\Play\NegativeEffect`）；`images\combat\*` 是动画素材清单。`s=500` 等价于 ctl 的 `vol=50`，即 `s = vol × 10` |
| `pc/Images/Cards/` | 卡面原画 | 生物是 `.jpg`，法术是 `.tga`。`android/public/cards/` 已有 730 个文件（`X.jpg` + `XBig.jpg`），新卡基本都能直接找到现成素材 |
| `pc/Scripts/*.txt` | UI 脚本 | 布局与 `Link UI\...\Sound\Play\X` 的按钮音效绑定 |
| `pc/Inf/Cs.spe / Steps.spe` | 对战/教程状态 | 二进制，尚未解出有意义结构 |

常用一行命令（提取某张卡的原文）：

```bash
cd /d/sync/project/Spectromancer && node -e "
const fs=require('fs');
const L=fs.readFileSync('pc/Inf/Gd.spe','latin1').split(/\r?\n/).map(s=>s.replace(/\r\$/,''));
const t=L.slice(L.findIndex(l=>!/^-?\d+\$/.test(l)));
for(let i=0;i<t.length-1;i++){const m=/^\^([^^]+)\^\$/.exec(t[i]);
 if(m&&m[1].includes(process.argv[1]))console.log(m[1]+'\n  '+t[i+1].replace(/\^/g,'').replace(/~/g,'\n  '));}
" 关键词
```

---

## 3. 改动约定

* **代码只改 `android/`**；`pc/` 只读。
* 新卡牌：`android/src/data/cards.json` 追加条目，字段沿用现有风格
  （`id / element / className? / name / nameCn / type / cost / attack? / life? / image / imgUrl / imgBigUrl / desc / ability? / onSummon? / spellEffect? / requiresTarget? / isWall? / swift? / flying? / spellImmune? / regen? / targetType?`）。
  引擎实现写在 `android/src/engine/game.ts`：入场效果加进 `resolveOnSummon()` 的 `switch (card.onSummon)`，
  法术加进 `resolveSpell()` 的 `switch (card.spellEffect)`，被动/回合效果写进 `startTurn()` 或
  `recalculateBoardStats()` 或 `executeCombat()`。
* 动画/音效：法术在 `main.ts::playSpellVFX()` 加分支；卡面特效类放 `style.css`。
* **`cards.json` 现在是唯一手调真源**。`scripts/generate_cards.cjs` 是早期的一次性生成器，
  它按内部硬编码的 136 张 `cardSpecs` **整份重写** `cards.json`，跑一次就会抹掉后来的所有手工修正
  （新增卡、描述修正、`requiresTarget`/`ability`/`targetType` 调整、剧毒移除…）。
  **不要直接运行它**；要扩充就先把它与当前 `cards.json` 对齐，或干脆只手工编辑 `cards.json`。
* 每完成一项，按项目规范更新仓库根目录 `CHANGELOG.md`（Keep a Changelog 风格，中文）。

---

## 4. 还没做的（剩余 0 张卡牌 —— 原版 305 张已全部实装）

`node scripts/pc_parity_check.cjs` 现在报告 **唯一未实装 0**，且「数值不一致」「无对应分支」两节均为 (无)。

### 1.9 已实装的虹光法师（《力量集结》中立造物 50 张）
* 设计依据见 **§2.0**：中立造物不进普通卡组 → 新建第 16 个流派 `HeroClass 'spectromancer'`（虹光法师），
  专属卡池 = `className: 'spectromancer'` 的 45 张可发牌造物（另有 8 个 `token` 衍生条目）。
* **衍生单位**统一走 `spawnToken(who, cardId, slot)`，它要求目标格**为空**：像「沉睡巨人→狂暴巨人」
  「禁锢元素→至尊元素」「未激活的终极机械→地狱机兵」这类**原位转化**必须先 `board[idx] = null`
  再 spawn，失败要还原（本轮踩过这个坑）。
* **原位转化**在 `startTurn()` 的造物循环里判定；**位置移动**（行军石/漫步石/淘气仙子/人鱼革命家）走新的
  `triggerEndOfTurnCreatures(who)`，由 `executeCombat()` 在职业被动之前调用（人鱼革命家会**更换 owner**，
  记得同步 `c.owner` 并把 `canAttack` 置 false）。
* **动态攻击力**统一在 `dynamicAttack()` 里扩展（`attack_equal_highest_power` / `attack_equal_lowest_power` /
  `attack_equal_power_sum`），只统计**五个活跃系**（火水气土 + 职业系），不要累加 `mana` 里的全部 11 个键。
* **全场/全体效果**用 `opposingBoardOf(board)` 判断另一半棋盘；死亡触发集中在 `cleanupDead()`。
* **费用税**（永雨之地 +2 / 抑魔处所 ×2 / 阻尼之龙魔法 ×2）走 `applyGlobalCostModifiers()`，在 `canPlayCard()`
  与 `playCard()` 两处都要调用，且**不看归属方**（原版写「双方」）。
* **反应卡**（魔法学院 / 星魂加速器 / 魔力风暴 / 活性龙卷风 / 对方场上的星魂妨碍者）统一挂在
  `onCardPlayed(who, card)`，由 `playCard()` 在卡牌完全结算后调用一次。
* **三座祭坛**复用「在生物上召唤」的机制：`isSacrificeAltar()` + `resolveSacrificeAltar()`，
  `canPlayCard()` 允许落在祭坛上、`playCard()` 用 `offeredToAltar` 分支提前结算并返回（祭坛留在场上）。
* **可激活造物**：`BEAST_ACTIVATED_ABILITIES` 新增 `manaElement`，可指定从别的能量池付费
  （未激活的终极机械 = 4 点机械系能量）。
* **灵魂匣**在 `checkWinner()` 里把被庇护一方的生命钳到 1；该卡 `token: true`，不进普通卡组。
* `Tamed Griffin`（0 费 2/8，`token`）与 `Sudden strike`（宠物主动技能，登记在 `DERIVED`）属于**战役圣物玩法**；
  安卓战役现有伴生狮鹫仍是自研的 `air_griffin`（3/18 飞行），**这是已知的有意差异**（原版宠物为 2/8 + 9 种圣物变体）。

### 已实装的五批（作为范式参考）
第一批（8 张）：`holy_crusader`(onSummon) / `holy_holy_avenger`(cleanupDead 里的邻格死亡钩子) /
`holy_templar`(playCard 召唤分支)、`holy_angel_of_war`(onSummon)、`holy_divine_meddling` /
`holy_rage_of_god`(resolveSpell)、`air_air_spirit`(recalculateBoardStats 动态攻击 + 横扫)、
`mech_hellbot`(executeCombat 独立分支，三格齐射)。
第二批（森林 10 张，见 §1.5）：职业被动 + 新 `HeroClass` + 衍生单位（`token`）+ 统一伤害汇点。
第三批（魔匠 9 张，见 §1.6）：开局冠军生物 + 玩家态强化 + 动态攻击力 + 额外攻击 + 免伤被动。
第四批（邪教 8 张，见 §1.7）：伤害路由（减免/放大/转嫁）+ 攻击结算钩子 + 禁止施法 + 负成长修正。
第五批（鲜血 9 张，见 §1.8）：双重付费 + 本体受伤汇点 + 临时加攻字段 `pendingAttackBonus`。

---

## 5. 已知遗留 / 待确认

1. **「消灭」类法术与法术免疫**：已确认灵魂汲取/裂解/龙卷风等对寒冰傀儡、钢铁傀儡无效（卡面写明不承受魔法与技能伤害），
   引擎 `!spellImmune` 判断正确。但**血祭仪式 / 自爆 / 牺牲献祭**（摧毁的是「己方」目标生物）**没有**做同样检查，
   按同一规则应当也不可指定免疫生物 —— 需要一并改 `canPlayCard` 与 `main.ts` 的己方目标高亮。
2. **恶魔变节者**（三首恶魔亡语产物）已按原版修正，但它不是 `cards.json` 里的独立卡，只存在于 `game.ts` 的
   `cleanupDead()` 里。
3. 尸毒/剧毒机制已删除。若后续实装的卡需要「持续伤害」，那是新机制，不要复活旧的臆造实现。
4. `sound.ts` 里给 10~12 点治疗用的 `healingmini` 目前只有 `water_elemental_summon` 一处在用；
   若要更贴原版，所有 10~12 点治疗都应改用它。
5. UI 按钮音效：安卓统一用 `click`(btn1.ogg)；原版的 `Button2/3/4/5/ButtonM/Button2l/2r`（带 pan 的左右箭头变体）
   在 Web 端因无 pan 未实装。
6. `Turntime.ogg`（原版回合超时提示音）未使用 —— 安卓没有回合计时器。
7. **古木守护者（Treefolk Protector）的减伤范围是推断**：原版英文只写
   “Treefolk Protector decreases by 3 damage dealt by the opponent's spells”，中文写作「使对方魔法造成的所有伤害-3」，
   都没有点明受保护对象。这里按「守护己方全场（本体 + 己方所有生物）」实装（对比原版对自身生效的写法一律会写明
   “Damage dealt to <卡名> is reduced by N”）。若日后在真机上读到不同表现，改 `game.ts::applyDamageModifiers()` 一处即可。
8. **`pc_parity_check.cjs` 的两条容差**：`Gd.spe` 对衍生单位（【兵蜂】）不写费用，此类条目按 0 费校验；
   “The attack of X is equal to …”（森林饿狼）被识别为可变攻击力。这两条都是原版文本本身的写法，
   不是放宽标准 —— 新增卡牌若又出现新写法，应继续细化解析而不是关掉校验。
9. `Acidic Rain` / `Stone Rain` / `Cursed Fog` 的全场伤害现在会走 `triggerDamage()`（补齐飘字与减伤），
   但仍有少数分支（如 `Army of Rats` 对随机友军的伤害）只扣血不通知 —— 后续如果再加「受伤触发」类卡牌，需要逐点补齐。
10. **【魔像】的「消灭」边界**：原版只说“被杀死时归位”，这里把 `isDestroyed`（裂解 / 自爆 / 牺牲献祭等
    「消灭」类效果）视为不再归位。由于它带 `spellImmune`，正常玩法下这些效果本来就点不中它；
    但 §5.1 提到的「己方目标摧毁类法术不检查法术免疫」是既有缺口，真要收口时应连同这里一起确认。
11. **冠军生物的身份用 `card.id` 判定**（`golem_golem` / `forest_magic_rabbit`），而这两张卡同时也在各自
    流派的发牌池里（`Gd.spe` 数值表 `p3=50`），因此理论上可以同时存在两只【魔像】——玩家态加成会同时作用于它们，
    `Golem Guide` 的换位取最靠左的一只。若日后确认原版不允许复本，加一条 `canPlayCard` 唯一性判定即可（兔子已有此判定）。
12. **邪教（Cult）的几处推断**，都在 `applyDamageModifiers()` / `onAttackDamageDealt()` 里，单点可改：
    * 「狂热信徒 ×2」放在减免**之后**：先由【古木守护者】-3、再翻倍（反向顺序会让减免被放大）；
    * 【掠夺者】按原文「**所有**对己方其它生物造成的伤害」实现，因此**己方魔法误伤自己人时也会被它接管**；
      但**自伤反噬**（狂热死士 / 狂怒纪念碑 / 邪恶独角兽自身流失）用 `noRedirect` 显式排除，否则「自损」会变成「掠夺者损」；
    * 【掠夺者】转嫁在 `depth === 0` 时生效，转嫁目标不再二次转嫁（避免两家同时有掠夺者/独角兽时互相踢皮球）；
    * 【邪恶独角兽】的转嫁要求对格生物存在且**非魔法免疫**，否则伤害正常落在它自己身上；
    * 【邪恶独角兽】「每回合损失 5 点生命」的时点取**拥有者回合开始阶段**（与原版其它「回合开始」效果一致）；
    * 【狂怒纪念碑】的额外攻击在攻击阶段开始时快照（`hasMonumentToRage`），若纪念碑在此阶段中途阵亡，已排入的额外攻击仍会执行。

---

## 6. 交接时要带上的上下文

给新 agent 的启动指令建议包含：

* 先读本文件 + 仓库根 `CHANGELOG.md` 的 `[Unreleased] - 2026-10-09` 段；
* 遵守 §3 的改动约定（尤其**不要运行 `scripts/generate_cards.cjs`**）；
* 每次改动后用 §0 的三条命令自检，并同步 `CHANGELOG.md`；
* 本次要做的是 §4 里的哪一组（明确指定，避免一次吞下 60 张）。
