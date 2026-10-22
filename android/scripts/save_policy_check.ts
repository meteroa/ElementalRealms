/**
 * 存档策略逻辑仿真（不依赖浏览器/DOM，纯逻辑验证）
 * 复刻 main.ts 中的策略函数与列表操作，验证：
 *   1. 战役打完 -> 接续战斗消失（原 bug 的核心）
 *   2. 旧版遗留的 gameOver 存档在启动时被清理
 *   3. 战役/联赛单槽覆盖，互不挤占
 *   4. 局域网 / AI 观战不产生存档
 *   5. 单局/自组手动存档上限裁剪
 */

type Rec = {
  saveId: string;
  battleSource: string;
  campaignProfileId?: string | null;
  leagueProfileId?: string | null;
  battleData: { engineState: { gameOver: boolean } };
};

const MAX_MANUAL_SAVES = 8;

function isSaveAllowedForMode(source: string): boolean {
  return source === 'campaign' || source === 'league' || source === 'duel' || source === 'custom_deck';
}
function isSingleSlotMode(source: string): boolean {
  return source === 'campaign' || source === 'league';
}

// --- 模拟 localStorage ---
class Store {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const SAVE_BATTLE_KEY = 'legacy_single';
const SAVE_BATTLES_LIST_KEY = 'list';
let store = new Store();

function readRaw(): Rec[] {
  try {
    const raw = store.getItem(SAVE_BATTLES_LIST_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.filter(i => i && i.saveId);
  } catch {}
  return [];
}
/** 对应 getSavedBattlesList()：会过滤掉 gameOver */
function visibleList(): Rec[] {
  return readRaw().filter(r => r.battleData && r.battleData.engineState && !r.battleData.engineState.gameOver);
}
function persist(list: Rec[]): void {
  store.setItem(SAVE_BATTLES_LIST_KEY, JSON.stringify(list));
  if (list.length > 0) store.setItem(SAVE_BATTLE_KEY, JSON.stringify(list[0].battleData));
  else store.removeItem(SAVE_BATTLE_KEY);
}

// --- 对应 clearSavedBattleForCurrentBattle ---
function clearForCurrent(src: string, activeCampaignId?: string, activeLeagueId?: string): void {
  const list = readRaw();
  let kept = list;
  if (src === 'campaign') {
    kept = list.filter(r => !(r.battleSource === 'campaign' &&
      (!activeCampaignId || !r.campaignProfileId || r.campaignProfileId === activeCampaignId)));
  } else if (src === 'league') {
    kept = list.filter(r => !(r.battleSource === 'league' &&
      (!activeLeagueId || !r.leagueProfileId || r.leagueProfileId === activeLeagueId)));
  } else {
    kept = list.filter(r => r.saveId !== `slot_${src}`);
  }
  persist(kept);
}

// --- 对应 purgeStaleSavedBattles ---
function purge(): void {
  const parsed = readRaw();
  if (parsed.length === 0) return;
  const cleaned = parsed.filter(item => {
    if (!item.battleData || !item.battleData.engineState) return false;
    if (item.battleData.engineState.gameOver) return false;
    if (!isSaveAllowedForMode(item.battleSource)) return false;
    return true;
  });
  const seen = new Set<string>();
  const deduped = cleaned.filter(item => {
    if (!isSingleSlotMode(item.battleSource)) return true;
    if (seen.has(item.saveId)) return false;
    seen.add(item.saveId);
    return true;
  });
  if (deduped.length !== parsed.length) persist(deduped);
}

// --- 对应 saveCurrentBattle ---
function saveBattle(src: string, campId?: string, leagueId?: string): boolean {
  if (!isSaveAllowedForMode(src)) return false;
  let slotKey = src;
  if (src === 'campaign' && campId) slotKey = `campaign_${campId}`;
  else if (src === 'league' && leagueId) slotKey = `league_${leagueId}`;
  else if (src === 'duel' || src === 'custom_deck') slotKey = `${src}_${Date.now()}_${Math.random()}`;

  const rec: Rec = {
    saveId: `slot_${slotKey}`,
    battleSource: src,
    campaignProfileId: campId || null,
    leagueProfileId: leagueId || null,
    battleData: { engineState: { gameOver: false } },
  };
  const cur = readRaw().filter(r => r.saveId !== rec.saveId);
  cur.unshift(rec);

  const manual = cur.filter(r => !isSingleSlotMode(r.battleSource));
  if (manual.length > MAX_MANUAL_SAVES) {
    const drop = new Set(manual.slice(MAX_MANUAL_SAVES).map(r => r.saveId));
    persist(cur.filter(r => !drop.has(r.saveId)));
    return true;
  }
  persist(cur);
  return true;
}

// ===================== 断言 =====================
let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

console.log('\n[1] 战役：保存退出 → 接续战斗可用 → 打完 → 接续战斗必须消失');
store = new Store();
saveBattle('campaign', 'campA');
check('保存后战役存档可见', visibleList().length === 1);
clearForCurrent('campaign', 'campA');   // 战斗结束
check('打完后战役存档被清除', visibleList().length === 0, `实际=${visibleList().length}`);
check('旧版单槽键也清空', store.getItem(SAVE_BATTLE_KEY) === null);

console.log('\n[2] 复现原 bug 场景：旧版本遗留了一条 gameOver 存档');
store = new Store();
store.setItem(SAVE_BATTLES_LIST_KEY, JSON.stringify([
  { saveId: 'slot_campaign_A', battleSource: 'campaign', campaignProfileId: 'A', battleData: { engineState: { gameOver: true } } },
]));
check('修复前：可见列表已隐藏它，但原始列表仍残留', readRaw().length === 1 && visibleList().length === 0);
purge();
check('purge 后原始列表被真正清空', readRaw().length === 0, `实际=${readRaw().length}`);

console.log('\n[3] 战役：同一档案二次保存应覆盖，不同档案互不影响');
store = new Store();
saveBattle('campaign', 'campA');
saveBattle('campaign', 'campA');
check('同档案只保留 1 条', readRaw().length === 1, `实际=${readRaw().length}`);
saveBattle('campaign', 'campB');
check('两个档案共存 2 条', readRaw().length === 2, `实际=${readRaw().length}`);
clearForCurrent('campaign', 'campB');
check('只清掉 campB，campA 保留', readRaw().length === 1 && readRaw()[0].campaignProfileId === 'campA');

console.log('\n[4] 联赛：打完一场只清本联赛进度');
store = new Store();
saveBattle('league', undefined, 'L1');
saveBattle('campaign', 'campA');
saveBattle('league', undefined, 'L2');
check('共 3 条存档', readRaw().length === 3);
clearForCurrent('league', undefined, 'L1');
const left = readRaw().map(r => r.saveId).sort();
check('L1 被清、L2 与战役保留', left.length === 2 && !left.some(s => s.includes('league_L1')), JSON.stringify(left));

console.log('\n[5] 局域网 / AI 观战不允许存档');
store = new Store();
check('lan 保存被拒绝', saveBattle('lan') === false && readRaw().length === 0);
check('ai_duel 保存被拒绝', saveBattle('ai_duel') === false && readRaw().length === 0);
check('isSaveAllowedForMode(lan)=false', isSaveAllowedForMode('lan') === false);
check('isSaveAllowedForMode(ai_duel)=false', isSaveAllowedForMode('ai_duel') === false);

console.log('\n[6] 单局/自组：超出上限时裁剪最旧的，且不动战役进度');
store = new Store();
saveBattle('campaign', 'campA');
for (let i = 0; i < 12; i++) saveBattle('duel');
const manualCnt = readRaw().filter(r => !isSingleSlotMode(r.battleSource)).length;
check(`手动存档被裁到 ${MAX_MANUAL_SAVES}`, manualCnt === MAX_MANUAL_SAVES, `实际=${manualCnt}`);
check('战役进度未被挤掉', readRaw().some(r => r.battleSource === 'campaign'));
check('总数为 1+8=9', readRaw().length === 9, `实际=${readRaw().length}`);

console.log('\n[7] purge 遇到非法模式（历史脏数据）应剔除');
store = new Store();
store.setItem(SAVE_BATTLES_LIST_KEY, JSON.stringify([
  { saveId: 's1', battleSource: 'lan', battleData: { engineState: { gameOver: false } } },
  { saveId: 's2', battleSource: 'duel', battleData: { engineState: { gameOver: false } } },
]));
purge();
check('lan 脏数据被剔除，duel 保留', readRaw().length === 1 && readRaw()[0].saveId === 's2');

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
if (fail > 0) throw new Error(`存档策略校验失败: ${fail} 项`);
