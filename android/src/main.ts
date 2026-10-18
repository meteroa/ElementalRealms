import {
  getAiConfig,
  saveAiConfig,
  testAiConnection,
  PROVIDER_PRESETS,
  resetBattleBanterSession,
  generateEnemyBanter,
  generateAiBattlefieldScenario,
} from './engine/ai_client';
import './style.css';
import { SpectromancerEngine } from './engine/game';
import type { CardDef, BoardCreature, ElementType, HeroClass, CampaignLevel, NetworkUserProfile, NetworkMessage } from './types';
import campaignData from './data/campaign.json';
import cardsData from './data/cards.json';
import tournamentData from './data/tournament.json';
import { sound } from './engine/sound';
import { lanNetwork } from './engine/network';

export function toRel(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('./')) return url;
  if (url.startsWith('/')) return '.' + url;
  if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:')) {
    return './' + url;
  }
  return url;
}

// Normalize all static JSON data paths in memory
(cardsData as CardDef[]).forEach((c) => {
  if (c.imgUrl) c.imgUrl = toRel(c.imgUrl);
  if (c.imgBigUrl) c.imgBigUrl = toRel(c.imgBigUrl);
});
(campaignData as any[]).forEach((l) => {
  if (l.face) l.face = toRel(l.face);
});
(tournamentData as any[]).forEach((t) => {
  if (t.face) t.face = toRel(t.face);
});

type ViewMode =
  | 'menu'
  | 'single_duel_setup'
  | 'ai_duel_setup'
  | 'campaign'
  | 'battle'
  | 'league_setup'
  | 'league_table'
  | 'custom_deck_hub'
  | 'custom_deck_builder'
  | 'replay_viewer';

let currentView: ViewMode = typeof window !== 'undefined' && (window.location.search.includes('combat') || window.location.search.includes('battle')) ? 'battle' : 'menu';

// Total Avatars Count
export const TOTAL_FACES = 100;

// Single Duel Setup State
let playerFaceIndex = 0; // Face1
let playerClassIndex = 0; // 0 = 随机, 1..11 = classes
let aiFaceIndex = 5; // Face6 (Archmage)
let aiClassIndex = 0; // 0 = 随机

// Dedicated AI Duel Setup State
let aiDuelMode: 'human_vs_ai' | 'ai_vs_ai' = 'human_vs_ai';
let aiDuelAi1NameIdx = 0; // 阿姆哈特
let aiDuelAi1FaceIdx = 0; // Face1
let aiDuelAi1ClassIdx = 1; // Sorcery
let aiDuelAi2NameIdx = 5; // 萨缪尔
let aiDuelAi2FaceIdx = 5; // Face6
let aiDuelAi2ClassIdx = 2; // Necromancer
let aiDuelDifficultyIdx = 3; // 大师 (Master)
let aiDuelScenarioIdx = 0;

let showClassGridPickerFor: 'player' | 'ai' | 'lan' | 'ai_duel_1' | 'ai_duel_2' | null = null;
let showScenarioGridPicker: boolean = false;
let showAiScenarioModal: boolean = false;
let aiScenarioLoading: boolean = false;
let aiScenarioPreview: BattlefieldScenario | null = null;
let aiScenarioPromptInput: string = '';
let showHelpModal: boolean = false;
let activeHelpTab: 'play' | 'combat' | 'deck' | 'classes' | 'modes' | 'cards' = 'play';
let codexCardFilter: string = 'all';
let showOptionsModal: boolean = false;
let showSurrenderModal: boolean = false;
let showOpponentHand: boolean = false;
let aiAnnouncedCard: CardDef | null = null;

// ==========================================
// CAMPAIGN MAP STATE & MULTI-CHARACTER PROFILES
// ==========================================
const CAMPAIGN_COMPLETED_KEY = 'spectromancer_campaign_completed';
const CAMPAIGN_UNLOCKED_KEY = 'spectromancer_campaign_unlocked';
const CAMPAIGN_PROFILES_KEY = 'spectromancer_campaign_profiles';

export interface CampaignProfile {
  id: string;
  playerName: string;
  playerFaceId: number;
  playerClassIdx: number;
  difficultyIdx: number;
  difficulty: string;
  completedLevels: number[];
  unlockedLevels: number[];
  selectedLevelId: number;
  createdAt: string;
}

const campaignDifficulties = ['容易', '普通', '困难', '大法师'];

let campaignProfiles: CampaignProfile[] = (() => {
  try {
    const raw = localStorage.getItem(CAMPAIGN_PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const legacyComp = localStorage.getItem(CAMPAIGN_COMPLETED_KEY);
    const comp = legacyComp ? JSON.parse(legacyComp) : [];
    const legacyUnl = localStorage.getItem(CAMPAIGN_UNLOCKED_KEY);
    const unl = legacyUnl ? JSON.parse(legacyUnl) : [1];
    return [{
      id: 'campaign_' + Date.now(),
      playerName: '传奇法师',
      playerFaceId: 1,
      playerClassIdx: 0,
      difficultyIdx: 0,
      difficulty: '容易',
      completedLevels: comp,
      unlockedLevels: unl,
      selectedLevelId: 1,
      createdAt: new Date().toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    }];
  } catch {}
  return [];
})();

function computeUnlockedCampaignLevels(completed: number[]): number[] {
  const unlocked = new Set<number>([1]);
  if (completed.includes(1)) {
    unlocked.add(2);
    unlocked.add(3);
    unlocked.add(4);
  }
  if (completed.some(id => [2, 3, 4].includes(id))) {
    unlocked.add(5);
  }
  if (completed.includes(5)) {
    unlocked.add(6);
  }
  if (completed.includes(6)) {
    unlocked.add(7);
  }
  if (completed.includes(7)) {
    unlocked.add(8);
  }
  if (completed.includes(8)) {
    unlocked.add(9);
  }
  if (completed.includes(9)) {
    unlocked.add(10);
    unlocked.add(11);
  }
  if (completed.some(id => [10, 11].includes(id))) {
    unlocked.add(12);
  }
  if (completed.includes(12)) {
    unlocked.add(13);
  }
  if (completed.includes(13)) {
    unlocked.add(14);
    unlocked.add(15);
  }
  if (completed.some(id => [14, 15].includes(id))) {
    unlocked.add(16);
  }
  if (completed.includes(16)) {
    unlocked.add(17);
  }
  if (completed.includes(17)) {
    unlocked.add(18);
    unlocked.add(19);
  }
  if (completed.some(id => [18, 19].includes(id))) {
    unlocked.add(20);
  }
  if (completed.includes(20)) {
    unlocked.add(21);
    unlocked.add(22);
  }
  if (completed.some(id => [21, 22].includes(id))) {
    unlocked.add(23);
  }
  return Array.from(unlocked).sort((a, b) => a - b);
}

let activeCampaignId: string = campaignProfiles[0]?.id || '';
let activeCampaign: CampaignProfile | null = campaignProfiles.find(p => p.id === activeCampaignId) || campaignProfiles[0] || null;

let completedCampaignLevels: number[] = activeCampaign?.completedLevels || [];
let unlockedCampaignLevels: number[] = computeUnlockedCampaignLevels(completedCampaignLevels);
let selectedCampaignLevelId: number = activeCampaign?.selectedLevelId || 1;
if (!unlockedCampaignLevels.includes(selectedCampaignLevelId)) {
  const nextUncompleted = unlockedCampaignLevels.find(id => !completedCampaignLevels.includes(id));
  selectedCampaignLevelId = nextUncompleted || unlockedCampaignLevels[unlockedCampaignLevels.length - 1] || 1;
}
let campaignMapIndex: 1 | 2 | 3 = (selectedCampaignLevelId >= 17) ? 3 : ((selectedCampaignLevelId >= 9) ? 2 : 1);
let campaignDifficultyIndex: number = activeCampaign?.difficultyIdx || 0;

let showCampaignHubModal = false;
let showCampaignSetupModal = false;
let campaignPlayerName = '战役领主';
let campaignPlayerFaceId = 1;
let campaignPlayerClassIdx = 0;
let campaignPlayerDifficultyIdx = 0;

function syncActiveCampaign() {
  if (activeCampaign) {
    completedCampaignLevels = activeCampaign.completedLevels || [];
    unlockedCampaignLevels = computeUnlockedCampaignLevels(completedCampaignLevels);
    activeCampaign.unlockedLevels = unlockedCampaignLevels;
    selectedCampaignLevelId = activeCampaign.selectedLevelId || 1;
    if (!unlockedCampaignLevels.includes(selectedCampaignLevelId)) {
      const nextUncompleted = unlockedCampaignLevels.find(id => !completedCampaignLevels.includes(id));
      selectedCampaignLevelId = nextUncompleted || unlockedCampaignLevels[unlockedCampaignLevels.length - 1] || 1;
      activeCampaign.selectedLevelId = selectedCampaignLevelId;
    }
    campaignDifficultyIndex = activeCampaign.difficultyIdx || 0;
  } else {
    completedCampaignLevels = [];
    unlockedCampaignLevels = [1];
    selectedCampaignLevelId = 1;
    campaignDifficultyIndex = 0;
  }
}

function saveCampaignProfiles() {
  if (activeCampaign) {
    activeCampaign.completedLevels = completedCampaignLevels;
    activeCampaign.unlockedLevels = unlockedCampaignLevels;
    activeCampaign.selectedLevelId = selectedCampaignLevelId;
    activeCampaign.difficultyIdx = campaignDifficultyIndex;
    activeCampaign.difficulty = campaignDifficulties[campaignDifficultyIndex] || '容易';
  }
  try {
    localStorage.setItem(CAMPAIGN_PROFILES_KEY, JSON.stringify(campaignProfiles));
    localStorage.setItem(CAMPAIGN_COMPLETED_KEY, JSON.stringify(completedCampaignLevels));
    localStorage.setItem(CAMPAIGN_UNLOCKED_KEY, JSON.stringify(unlockedCampaignLevels));
  } catch {}
}

function recordCampaignVictory() {
  if (currentBattleSource !== 'campaign') return;
  if (!engine || engine.winner !== 'player') return;
  if (!completedCampaignLevels.includes(selectedCampaignLevelId)) {
    completedCampaignLevels.push(selectedCampaignLevelId);
  }
  unlockedCampaignLevels = computeUnlockedCampaignLevels(completedCampaignLevels);
  const nextUncompleted = unlockedCampaignLevels.find(id => !completedCampaignLevels.includes(id));
  if (nextUncompleted) {
    selectedCampaignLevelId = nextUncompleted;
  }
  if (selectedCampaignLevelId >= 17 || completedCampaignLevels.includes(16)) {
    campaignMapIndex = 3;
  } else if (selectedCampaignLevelId >= 9 || completedCampaignLevels.includes(8)) {
    campaignMapIndex = 2;
  }
  saveCampaignProfiles();
  try {
    localStorage.removeItem(SAVE_BATTLE_KEY);
  } catch {}
}

function createNewCampaignProfile(name: string, faceId: number, classIdx: number, diffIdx: number) {
  let resolvedClassIdx = classIdx;
  if (resolvedClassIdx === 0 || HERO_CLASSES[resolvedClassIdx]?.id === 'random') {
    resolvedClassIdx = Math.floor(Math.random() * (HERO_CLASSES.length - 1)) + 1;
  }
  const newProfile: CampaignProfile = {
    id: 'campaign_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    playerName: name.trim() || '战役领主',
    playerFaceId: faceId,
    playerClassIdx: resolvedClassIdx,
    difficultyIdx: diffIdx,
    difficulty: campaignDifficulties[diffIdx] || '容易',
    completedLevels: [],
    unlockedLevels: [1],
    selectedLevelId: 1,
    createdAt: new Date().toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  };
  campaignProfiles.unshift(newProfile);
  activeCampaignId = newProfile.id;
  activeCampaign = newProfile;
  syncActiveCampaign();
  saveCampaignProfiles();
}

function deleteCampaignProfile(id: string) {
  openCustomConfirm(
    '删除战役角色档案',
    '确定要删除该战役英雄角色及其通关进度吗？此操作无法撤销。',
    () => {
      campaignProfiles = campaignProfiles.filter(p => p.id !== id);
      if (activeCampaignId === id) {
        activeCampaign = campaignProfiles[0] || null;
        activeCampaignId = activeCampaign?.id || '';
        syncActiveCampaign();
      }
      saveCampaignProfiles();
      render();
    }
  );
}

const CAMPAIGN_MAP1_NODES = [
  { levelId: 1, name: '德米尔', face: './faces/Face6.jpg', x: 23.5, y: 44.0, landmark: '麦田' },
  { levelId: 2, name: '闪银', face: './faces/Face7.jpg', x: 33.2, y: 51.5, landmark: '农舍' },
  { levelId: 3, name: '费德米尔', face: './faces/Face8.jpg', x: 28.5, y: 71.0, landmark: '风车' },
  { levelId: 4, name: '尼瑞恩', face: './faces/Face9.jpg', x: 20.5, y: 73.5, landmark: '圣殿城堡' },
  { levelId: 5, name: '洛瑞娜', face: './faces/Face10.jpg', x: 37.0, y: 74.0, landmark: '拉卡瓦河畔' },
  { levelId: 6, name: '斯哈克', face: './faces/Face11.jpg', x: 47.0, y: 49.0, landmark: '狂风要塞' },
  { levelId: 7, name: '阿芙黛娅', face: './faces/Face12.jpg', x: 56.5, y: 69.0, landmark: '荒芜山谷' },
  { levelId: 8, name: '博瑞', face: './faces/Face13.jpg', x: 73.2, y: 19.5, landmark: '禁锢熔炉' },
];

const CAMPAIGN_MAP1_ROUTES = [
  { from: 1, to: 2 },
  { from: 1, to: 3 },
  { from: 1, to: 4 },
  { from: 2, to: 6 },
  { from: 3, to: 5 },
  { from: 4, to: 5 },
  { from: 5, to: 7 },
  { from: 6, to: 7 },
  { from: 7, to: 8 },
];

// 第二大陆（Chapter 2：第 9 ~ 16 关）
const CAMPAIGN_MAP2_NODES = [
  { levelId: 9, name: '艾瑞欧', face: './faces/Face14.jpg', x: 33.7, y: 76.0, landmark: '荒野兽穴' },
  { levelId: 10, name: '卡特拉', face: './faces/Face15.jpg', x: 21.0, y: 46.5, landmark: '绝望火山' },
  { levelId: 11, name: '曼迪阿杜斯', face: './faces/Face16.jpg', x: 29.8, y: 60.8, landmark: '暗夜营地' },
  { levelId: 12, name: '沃兰娜', face: './faces/Face17.jpg', x: 50.8, y: 75.2, landmark: '巨石荒原' },
  { levelId: 13, name: '火焰领主', face: './faces/Face18.jpg', x: 54.7, y: 59.1, landmark: '绿光秘境' },
  { levelId: 14, name: '加法亚', face: './faces/Face19.jpg', x: 63.0, y: 73.5, landmark: '献祭神坛' },
  { levelId: 15, name: '图瑞恩', face: './faces/Face20.jpg', x: 73.7, y: 49.0, landmark: '审判城堡' },
  { levelId: 16, name: '弗斯拉夫', face: './faces/Face21.jpg', x: 79.1, y: 22.0, landmark: '水晶苍穹' },
];

const CAMPAIGN_MAP2_ROUTES = [
  { from: 9, to: 10 },
  { from: 9, to: 11 },
  { from: 10, to: 12 },
  { from: 11, to: 12 },
  { from: 12, to: 13 },
  { from: 13, to: 14 },
  { from: 13, to: 15 },
  { from: 14, to: 16 },
  { from: 15, to: 16 },
];

// 第三大陆（Chapter 3：第 17 ~ 23 关）
const CAMPAIGN_MAP3_NODES = [
  { levelId: 17, name: '哈米尔', face: './faces/Face22.jpg', x: 25.9, y: 71.8, landmark: '龙之天梯' },
  { levelId: 18, name: '哈拉尔', face: './faces/Face23.jpg', x: 28.8, y: 56.5, landmark: '永雨之地' },
  { levelId: 19, name: '龙王', face: './faces/Face24.jpg', x: 27.3, y: 22.0, landmark: '龙王之穴' },
  { levelId: 20, name: '黑暗凯文', face: './faces/Face25.jpg', x: 41.5, y: 54.0, landmark: '暗灵圣地' },
  { levelId: 21, name: '阿特朗', face: './faces/Face26.jpg', x: 57.6, y: 22.8, landmark: '魔法学院' },
  { levelId: 22, name: '风之领主', face: './faces/Face27.jpg', x: 54.7, y: 60.0, landmark: '风暴之殿' },
  { levelId: 23, name: '铎拉克', face: './faces/Face28.jpg', x: 80.1, y: 26.2, landmark: '星灵湮灭塔' },
];

const CAMPAIGN_MAP3_ROUTES = [
  { from: 17, to: 18 },
  { from: 17, to: 19 },
  { from: 18, to: 20 },
  { from: 19, to: 20 },
  { from: 20, to: 21 },
  { from: 20, to: 22 },
  { from: 21, to: 23 },
  { from: 22, to: 23 },
];

// 大陆传送门坐标
const CAMPAIGN_PORTAL_MAP1 = { x: 66.0, y: 26.0, targetMap: 2, label: '星门 · 前往第二大陆' };
const CAMPAIGN_PORTAL_MAP2_TO_1 = { x: 18.0, y: 82.0, targetMap: 1, label: '星门 · 返回第一大陆' };
const CAMPAIGN_PORTAL_MAP2_TO_3 = { x: 88.5, y: 21.0, targetMap: 3, label: '星门 · 前往第三大陆' };
const CAMPAIGN_PORTAL_MAP3 = { x: 18.0, y: 82.0, targetMap: 2, label: '星门 · 返回第二大陆' };

let campaignMapPanX = 0;
let campaignMapPanY = 0;
let campaignMapScale = 1;
let campaignMapInitialized = false;
let isCampaignDeckCollapsed = false;

// ==========================================
// LEAGUE OF HEROES STATE (Images 2 & 3)
// ==========================================
const LEAGUE_STATE_KEY = 'spectromancer_league_state';
interface LeagueCompetitor {
  name: string;
  face: string;
  className: HeroClass;
  classCn: string;
  wins: number;
  score: number;
  isPlayer?: boolean;
}
interface LeagueState {
  id: string;
  playerName: string;
  playerFaceId: number;
  playerClassIdx: number;
  difficulty: string;
  totalContestants?: number; // default 10, max 16
  currentMatch: number; // 1 .. totalMatches
  totalMatches?: number; // (totalContestants - 1) + 2
  standings: LeagueCompetitor[];
  matchSchedule?: number[]; // indices in tournamentData
  semiFinalOpponentIndex?: number;
  finalOpponentIndex?: number;
  phase?: 'regular' | 'semifinal' | 'final' | 'completed';
  createdAt?: string;
}

let leaguePlayerName = '玩家';
let leaguePlayerFaceId = 2; // Face2
let leaguePlayerClassIdx = 3; // 战争牧师 (cleric)
let leagueDifficultyIdx = 0; // 容易
const leagueDifficulties = ['容易', '普通', '困难', '大法师'];
const leagueContestantCountChoices = [8, 10, 12, 16];
let leagueContestantCountIdx = 1; // Default 10 contestants


const LEAGUE_PROFILES_KEY = 'spectromancer_league_profiles';
let leagueProfiles: LeagueState[] = (() => {
  try {
    const raw = localStorage.getItem(LEAGUE_PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const legacy = localStorage.getItem(LEAGUE_STATE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed) {
        if (!parsed.id) parsed.id = 'league_' + Date.now();
        return [parsed];
      }
    }
  } catch {}
  return [];
})();

let activeLeagueId: string = leagueProfiles[0]?.id || '';
let activeLeague: LeagueState | null = leagueProfiles.find(p => p.id === activeLeagueId) || leagueProfiles[0] || null;
let showLeagueHubModal = false;

// ==========================================
// REPLAY SYSTEM STATE
// ==========================================
const REPLAYS_STORAGE_KEY = 'spectromancer_battle_replays';
interface BattleReplay {
  id: string;
  timestamp: number;
  dateStr: string;
  mode: string;
  playerName: string;
  playerFace: string;
  enemyName: string;
  enemyFace: string;
  result: 'victory' | 'defeat';
  totalTurns: number;
  steps: import('./engine/game').ReplayStep[];
}

function createInitialDemoReplay(): BattleReplay {
  return {
    id: 'demo_replay_1',
    timestamp: Date.now() - 3600000,
    dateStr: '精彩对决示范',
    mode: '单局对战 (大法师示范)',
    playerName: '神圣领主',
    playerFace: './faces/Face2.jpg',
    enemyName: '深渊死灵师',
    enemyFace: './faces/Face6.jpg',
    result: 'victory',
    totalTurns: 2,
    steps: [
      {
        turn: 1, side: 'player', action: 'init', desc: '双方英雄就位，五大元素魔能涌动',
        playerHp: 60, enemyHp: 60,
        playerMana: { fire: 5, water: 5, air: 5, earth: 5, special: 2, death: 2, holy: 2, mechanics: 2, control: 2, chaos: 2, illusion: 2 },
        enemyMana: { fire: 4, water: 4, air: 4, earth: 4, special: 2, death: 2, holy: 2, mechanics: 2, control: 2, chaos: 2, illusion: 2 },
        playerBoard: [null, null, null, null, null, null],
        enemyBoard: [null, null, null, null, null, null],
      },
      {
        turn: 1, side: 'player', action: 'creature', desc: '玩家 在 [1号位] 召唤了【火灵学徒】(3/12)',
        cardName: '火灵学徒', cardId: 'fire_apprentice', cardImg: './cards/FireElemental.webp', targetSlot: 0,
        playerHp: 60, enemyHp: 60,
        playerMana: { fire: 2, water: 5, air: 5, earth: 5, special: 2, death: 2, holy: 2, mechanics: 2, control: 2, chaos: 2, illusion: 2 },
        enemyMana: { fire: 4, water: 4, air: 4, earth: 4, special: 2, death: 2, holy: 2, mechanics: 2, control: 2, chaos: 2, illusion: 2 },
        playerBoard: [
          { uid: 'demo_c1', card: { id: 'fire_apprentice', name: 'Fire Apprentice', nameCn: '火灵学徒', type: 'creature', cost: 3, attack: 3, life: 12, image: 'FireApprentice', imgUrl: './cards/FireElemental.webp', imgBigUrl: './cards/FireElementalBig.webp', desc: '火系初级学徒', element: 'fire' }, owner: 'player', slotIndex: 0, baseAttack: 3, currentAttack: 3, currentLife: 12, maxLife: 12, isWall: false, flying: false, spellImmune: false, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
        enemyBoard: [null, null, null, null, null, null],
      },
      {
        turn: 1, side: 'player', action: 'attack_phase', desc: '玩家 回合战线攻击结算：火灵学徒直接命中深渊死灵师本体造成 3 点伤害！',
        playerHp: 60, enemyHp: 57,
        playerMana: { fire: 2, water: 5, air: 5, earth: 5, special: 2, death: 2, holy: 2, mechanics: 2, control: 2, chaos: 2, illusion: 2 },
        enemyMana: { fire: 4, water: 4, air: 4, earth: 4, special: 2, death: 2, holy: 2, mechanics: 2, control: 2, chaos: 2, illusion: 2 },
        playerBoard: [
          { uid: 'demo_c1', card: { id: 'fire_apprentice', name: 'Fire Apprentice', nameCn: '火灵学徒', type: 'creature', cost: 3, attack: 3, life: 12, image: 'FireApprentice', imgUrl: './cards/FireElemental.webp', imgBigUrl: './cards/FireElementalBig.webp', desc: '火系初级学徒', element: 'fire' }, owner: 'player', slotIndex: 0, baseAttack: 3, currentAttack: 3, currentLife: 12, maxLife: 12, isWall: false, flying: false, spellImmune: false, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
        enemyBoard: [null, null, null, null, null, null],
      },
      {
        turn: 1, side: 'enemy', action: 'creature', desc: '深渊死灵师 在 [1号位] 召唤了【骷髅守卫】(2/10) 进行战线拦截',
        cardName: '骷髅守卫', cardId: 'death_skeleton', cardImg: './cards/MasterLich.webp', targetSlot: 0,
        playerHp: 60, enemyHp: 57,
        playerMana: { fire: 2, water: 5, air: 5, earth: 5, special: 2, death: 2, holy: 2, mechanics: 2, control: 2, chaos: 2, illusion: 2 },
        enemyMana: { fire: 4, water: 4, air: 4, earth: 4, special: 0, death: 0, holy: 0, mechanics: 0, control: 0, chaos: 0, illusion: 0 },
        playerBoard: [
          { uid: 'demo_c1', card: { id: 'fire_apprentice', name: 'Fire Apprentice', nameCn: '火灵学徒', type: 'creature', cost: 3, attack: 3, life: 12, image: 'FireApprentice', imgUrl: './cards/FireElemental.webp', imgBigUrl: './cards/FireElementalBig.webp', desc: '火系初级学徒', element: 'fire' }, owner: 'player', slotIndex: 0, baseAttack: 3, currentAttack: 3, currentLife: 12, maxLife: 12, isWall: false, flying: false, spellImmune: false, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
        enemyBoard: [
          { uid: 'demo_c2', card: { id: 'death_skeleton', name: 'Skeleton', nameCn: '骷髅守卫', type: 'creature', cost: 2, attack: 2, life: 10, image: 'Skeleton', imgUrl: './cards/MasterLich.webp', imgBigUrl: './cards/MasterLichBig.webp', desc: '亡灵骷髅守卫', element: 'death' }, owner: 'enemy', slotIndex: 0, baseAttack: 2, currentAttack: 2, currentLife: 10, maxLife: 10, isWall: false, flying: false, spellImmune: false, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
      },
      {
        turn: 2, side: 'player', action: 'spell', desc: '玩家 施放了法术【闪电箭】，直击敌方【骷髅守卫】造成 8 点雷霆暴击！',
        cardName: '闪电箭', cardId: 'air_lightning', cardImg: './cards/LightningBolt.webp', targetSlot: 0,
        playerHp: 60, enemyHp: 57,
        playerMana: { fire: 3, water: 6, air: 2, earth: 6, special: 3, death: 3, holy: 3, mechanics: 3, control: 3, chaos: 3, illusion: 3 },
        enemyMana: { fire: 5, water: 5, air: 5, earth: 5, special: 1, death: 1, holy: 1, mechanics: 1, control: 1, chaos: 1, illusion: 1 },
        playerBoard: [
          { uid: 'demo_c1', card: { id: 'fire_apprentice', name: 'Fire Apprentice', nameCn: '火灵学徒', type: 'creature', cost: 3, attack: 3, life: 12, image: 'FireApprentice', imgUrl: './cards/FireElemental.webp', imgBigUrl: './cards/FireElementalBig.webp', desc: '火系初级学徒', element: 'fire' }, owner: 'player', slotIndex: 0, baseAttack: 3, currentAttack: 3, currentLife: 12, maxLife: 12, isWall: false, flying: false, spellImmune: false, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
        enemyBoard: [
          { uid: 'demo_c2', card: { id: 'death_skeleton', name: 'Skeleton', nameCn: '骷髅守卫', type: 'creature', cost: 2, attack: 2, life: 2, image: 'Skeleton', imgUrl: './cards/MasterLich.webp', imgBigUrl: './cards/MasterLichBig.webp', desc: '亡灵骷髅守卫', element: 'death' }, owner: 'enemy', slotIndex: 0, baseAttack: 2, currentAttack: 2, currentLife: 2, maxLife: 10, isWall: false, flying: false, spellImmune: false, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
      },
      {
        turn: 2, side: 'player', action: 'attack_phase', desc: '玩家 回合战线攻击结算：火灵学徒(3攻)重击斩杀残血骷髅守卫，敌方战线崩溃！',
        playerHp: 60, enemyHp: 57,
        playerMana: { fire: 3, water: 6, air: 2, earth: 6, special: 3, death: 3, holy: 3, mechanics: 3, control: 3, chaos: 3, illusion: 3 },
        enemyMana: { fire: 5, water: 5, air: 5, earth: 5, special: 1, death: 1, holy: 1, mechanics: 1, control: 1, chaos: 1, illusion: 1 },
        playerBoard: [
          { uid: 'demo_c1', card: { id: 'fire_apprentice', name: 'Fire Apprentice', nameCn: '火灵学徒', type: 'creature', cost: 3, attack: 3, life: 12, image: 'FireApprentice', imgUrl: './cards/FireElemental.webp', imgBigUrl: './cards/FireElementalBig.webp', desc: '火系初级学徒', element: 'fire' }, owner: 'player', slotIndex: 0, baseAttack: 3, currentAttack: 3, currentLife: 12, maxLife: 12, isWall: false, flying: false, spellImmune: false, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
        enemyBoard: [null, null, null, null, null, null],
      },
    ]
  };
}

let battleReplays: BattleReplay[] = (() => {
  try {
    const raw = localStorage.getItem(REPLAYS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [createInitialDemoReplay()];
})();

let showReplayModal = false;
let activeViewingReplay: BattleReplay | null = null;
let replayCurrentStepIdx = 0;
let isReplayAutoPlaying = false;
let replayPlaybackTimer: any = null;
let replayPlaybackSpeed = 1;

let recordReplaysEnabled: boolean = (() => {
  try {
    const raw = localStorage.getItem('setting_record_replays');
    return raw !== null ? JSON.parse(raw) : true;
  } catch {
    return true;
  }
})();

interface BattlefieldScenario {
  id: string;
  name: string;
  icon: string;
  theme: string;
  playerHp: number;
  enemyHp: number;
  rule: string;
  extraPlayerMana?: Record<string, number>;
  extraEnemyMana?: Record<string, number>;
  initialPlayerCreatures?: Array<{ slot: number; cardId: string }>;
  initialEnemyCreatures?: Array<{ slot: number; cardId: string }>;
}

// ==========================================
// 特殊战场造物 (Special Battlefield Constructs)
// ==========================================
// 虹光造物（火山、祭坛、行军石、魔法学院、至尊元素…）不是任何流派的牌：它们不进牌库、
// 不进发牌池、也不能被选为职业。它们唯一的存在方式是作为「战场场景」的预置元素登场。
const BATTLEFIELD_RELIC_IDS: ReadonlySet<string> = new Set(
  (cardsData as CardDef[]).filter((c) => c.battlefield).map((c) => c.id)
);

function isBattlefieldRelic(cardId: string): boolean {
  return BATTLEFIELD_RELIC_IDS.has(cardId);
}

// 场景造物总览：卡牌资料页与帮助页共用。
function getBattlefieldRelics(): CardDef[] {
  return (cardsData as CardDef[]).filter((c) => c.battlefield);
}

// 把场景里的卡牌 id 解析成真正的 CardDef（找不到就跳过，避免场景静默失效）。
function resolveScenarioCreatures(
  specs?: Array<{ slot: number; cardId: string }>
): Array<{ slot: number; card: CardDef }> {
  const out: Array<{ slot: number; card: CardDef }> = [];
  if (!specs) return out;
  const allCards = cardsData as CardDef[];
  for (const item of specs) {
    const c = allCards.find((card) => card.id === item.cardId);
    if (c) out.push({ slot: item.slot, card: c });
  }
  return out;
}

// 该场景实际用到的造物 id（用于场景卡片下方的造物小图标预览）。
function getScenarioRelicIds(scenario: BattlefieldScenario): string[] {
  const ids = new Set<string>();
  [...(scenario.initialPlayerCreatures || []), ...(scenario.initialEnemyCreatures || [])].forEach((spec) => {
    if (isBattlefieldRelic(spec.cardId)) ids.add(spec.cardId);
  });
  return Array.from(ids);
}

const SINGLE_DUEL_DIFFICULTIES = ['容易', '普通', '困难', '大法师'];
let singleDuelDifficultyIdx: number = 1; // Default '普通'

export const MASTER_OPPONENT_NAMES = [
  '阿姆哈特', '阿特朗', '弗沃尔', '迪莫夫', '杜斯坦', '魁塔纳',
  '奥尔格德', '巴特拉斯', '伊格波特', '埃尔加', '富塔克', '欧拉夏',
  '古斯塔夫', '弗拉德', '斯哈克', '卡尔托', '莫特斯', '卡珊德拉',
  '加拉多', '大法师'
];
let singleDuelAiNameIdx: number = 0;

// 可被选择的流派（不含「随机」占位与特殊战场造物）。
function getSelectableClasses(): HeroClass[] {
  return HERO_CLASSES.filter((c) => c.id !== 'random').map((c) => c.id as HeroClass);
}

const BATTLEFIELD_SCENARIOS: BattlefieldScenario[] = [
  {
    id: 'random',
    name: '🎲 随机奇遇',
    icon: '🎲',
    theme: 'citadel',
    playerHp: 60,
    enemyHp: 60,
    rule: '随机奇遇法则：开局随机抽取特殊战场环境（特殊生命、元素充能、开局随从与场景主题）。',
  },
  {
    id: 'sanctuary',
    name: '🏛️ 星辉圣殿',
    icon: '🏛️',
    theme: 'citadel',
    playerHp: 60,
    enemyHp: 60,
    rule: '经典圣殿法则：双方 60 点初始生命值，标准决斗法则，能量常规匀速增长。',
  },
  {
    id: 'forest',
    name: '🌲 永恒密林',
    icon: '🌲',
    theme: 'forest',
    playerHp: 70,
    enemyHp: 70,
    rule: '密林生机庇佑：双方初始生命提升至 70 点，土系初始能量额外 +2，双方正中第3位各预置【巨型蜘蛛】护场！',
    extraPlayerMana: { earth: 2 },
    extraEnemyMana: { earth: 2 },
    initialPlayerCreatures: [{ slot: 2, cardId: 'earth_giant_spider' }],
    initialEnemyCreatures: [{ slot: 2, cardId: 'earth_giant_spider' }],
  },
  {
    id: 'inferno',
    name: '🌋 熔岩炼狱',
    icon: '🌋',
    theme: 'volcano',
    playerHp: 50,
    enemyHp: 50,
    rule: '烈焰焚天法则：双方初始生命降为 50 点，火系初始能量额外 +3，开局双方 1号位各入场一名【火焰祭司】对峙！',
    extraPlayerMana: { fire: 3 },
    extraEnemyMana: { fire: 3 },
    initialPlayerCreatures: [{ slot: 0, cardId: 'fire_priest_of_fire' }],
    initialEnemyCreatures: [{ slot: 0, cardId: 'fire_priest_of_fire' }],
  },
  {
    id: 'sky_peak',
    name: '☁️ 天界圣峰',
    icon: '☁️',
    theme: 'sky',
    playerHp: 60,
    enemyHp: 60,
    rule: '狂风雷霆法则：气系初始能量额外 +3，双方前锋 6号位各拥有高傲巡弋的【狮鹫】！',
    extraPlayerMana: { air: 3 },
    extraEnemyMana: { air: 3 },
    initialPlayerCreatures: [{ slot: 5, cardId: 'air_griffin' }],
    initialEnemyCreatures: [{ slot: 5, cardId: 'air_griffin' }],
  },
  {
    id: 'styx',
    name: '💀 幽暗冥河',
    icon: '💀',
    theme: 'citadel',
    playerHp: 45,
    enemyHp: 45,
    rule: '亡者死斗法则：双方初始生命仅 45 点，快节奏生死决斗，考验每一步精准致命斩杀！',
    extraPlayerMana: { special: 2 },
    extraEnemyMana: { special: 2 },
  },
  {
    id: 'clockwork',
    name: '⚙️ 机械要塞',
    icon: '⚙️',
    theme: 'sky',
    playerHp: 65,
    enemyHp: 65,
    rule: '钢铁共振法则：双方生命 65 点，全系初始能量各 +1，双方第2位各部署一名【哥布林狂战士】贴身搏击！',
    extraPlayerMana: { fire: 1, water: 1, air: 1, earth: 1, special: 1 },
    extraEnemyMana: { fire: 1, water: 1, air: 1, earth: 1, special: 1 },
    initialPlayerCreatures: [{ slot: 1, cardId: 'fire_goblin_berserker' }],
    initialEnemyCreatures: [{ slot: 1, cardId: 'fire_goblin_berserker' }],
  },
  {
    id: 'chaos_rift',
    name: '🌀 混沌裂隙',
    icon: '🌀',
    theme: 'volcano',
    playerHp: 80,
    enemyHp: 80,
    rule: '时空奇点法则：双方初始生命激增至 80 点史诗持久战，所有元素初始充能 +2，双方预置【混沌维和者】！',
    extraPlayerMana: { fire: 2, water: 2, air: 2, earth: 2, special: 2 },
    extraEnemyMana: { fire: 2, water: 2, air: 2, earth: 2, special: 2 },
    initialPlayerCreatures: [{ slot: 0, cardId: 'chaos_peacekeeper' }],
    initialEnemyCreatures: [{ slot: 0, cardId: 'chaos_peacekeeper' }],
  },
  {
    id: 'frost_glacier',
    name: '🌊 极地冰冠',
    icon: '🌊',
    theme: 'citadel',
    playerHp: 65,
    enemyHp: 65,
    rule: '极地严寒法则：双方生命提升至 65 点，水系初始能量额外 +3，开局法力冰川充盈！',
    extraPlayerMana: { water: 3 },
    extraEnemyMana: { water: 3 },
  },
  {
    id: 'iron_bulwark',
    name: '🛡️ 坚壁阵地',
    icon: '🛡️',
    theme: 'forest',
    playerHp: 75,
    enemyHp: 75,
    rule: '守护壁垒法则：双方生命提升至 75 点，土系初始能量 +2，双方前线 3、4号位展开厚重石壁对垒！',
    extraPlayerMana: { earth: 2 },
    extraEnemyMana: { earth: 2 },
    initialPlayerCreatures: [{ slot: 2, cardId: 'earth_giant_spider' }],
    initialEnemyCreatures: [{ slot: 3, cardId: 'earth_giant_spider' }],
  },
  {
    id: 'arcane_surge',
    name: '🔮 奥术狂潮',
    icon: '🔮',
    theme: 'sky',
    playerHp: 60,
    enemyHp: 60,
    rule: '流派共鸣法则：双方各自流派专属能量开局直接大幅充能 +4，起手即可展开专属流派神术！',
    extraPlayerMana: { special: 4 },
    extraEnemyMana: { special: 4 },
  },
  {
    id: 'grandmaster',
    name: '👑 宗师擂台',
    icon: '👑',
    theme: 'citadel',
    playerHp: 90,
    enemyHp: 90,
    rule: '巅峰对决法则：双方初始生命高达 90 点，全系能量各 +3，大后期神仙打架高阶战略大师局！',
    extraPlayerMana: { fire: 3, water: 3, air: 3, earth: 3, special: 3 },
    extraEnemyMana: { fire: 3, water: 3, air: 3, earth: 3, special: 3 },
  },

  // ==========================================
  // 特殊战场造物场景 (Battlefield Construct Scenarios)
  // 这些场景把虹光造物阵列为战场本身：火山、沼泽、诅咒之地持续消耗全场，
  // 和平之树压低全场攻击，行军石搅乱阵线，魔法学院/巨型橡树/火焰神殿免费铺场。
  // ==========================================
  {
    id: 'baffler_arena',
    name: '🌀 抑魔双倍场',
    icon: '🌀',
    theme: 'sky',
    playerHp: 70,
    enemyHp: 70,
    rule: '抑魔法则：双方阵中各预置一座【抑魔处所】——场上所有卡牌的费用翻倍，且抑魔处所不受任何魔法影响。高费决斗，每一步都要精打细算。',
    initialPlayerCreatures: [{ slot: 5, cardId: 'gop_baffler_roost' }],
    initialEnemyCreatures: [{ slot: 0, cardId: 'gop_baffler_roost' }],
  },
  {
    id: 'peace_grove',
    name: '🌳 和平之林',
    icon: '🌳',
    theme: 'forest',
    playerHp: 75,
    enemyHp: 75,
    rule: '和平法则：双方阵中各预置一棵【和平之树】，使对手所有生物攻击力 -1，土系初始能量 +2。低伤害拉锯战，谁能先拆掉对方的树谁就掌握主动。',
    extraPlayerMana: { earth: 2 },
    extraEnemyMana: { earth: 2 },
    initialPlayerCreatures: [{ slot: 2, cardId: 'gop_peace_tree' }],
    initialEnemyCreatures: [{ slot: 3, cardId: 'gop_peace_tree' }],
  },
  {
    id: 'volcano_forge',
    name: '🌋 火山熔炉',
    icon: '🌋',
    theme: 'volcano',
    playerHp: 60,
    enemyHp: 60,
    rule: '熔炉法则：双方 3 号位各矗立一座【火山】（99 生命、免疫魔法），每个拥有者回合开始时会烧灼对位生物 5 点。火系初始能量 +3，抢占对位就能白吃伤害。',
    extraPlayerMana: { fire: 3 },
    extraEnemyMana: { fire: 3 },
    initialPlayerCreatures: [{ slot: 2, cardId: 'gop_volcano' }],
    initialEnemyCreatures: [{ slot: 2, cardId: 'gop_volcano' }],
  },
  {
    id: 'fetid_marsh',
    name: '🦠 恶臭沼泽',
    icon: '🦠',
    theme: 'forest',
    playerHp: 65,
    enemyHp: 65,
    rule: '腐蚀法则：双方 2 号位各预置一片【恶臭沼泽】（免疫魔法），每个拥有者回合开始时对场上所有生物造成 2 点伤害。全场每回合持续掉血，速攻与再生生物价值暴涨。',
    initialPlayerCreatures: [{ slot: 1, cardId: 'gop_fetid_swamp' }],
    initialEnemyCreatures: [{ slot: 4, cardId: 'gop_fetid_swamp' }],
  },
  {
    id: 'cursed_graveyard',
    name: '💀 诅咒墓地',
    icon: '💀',
    theme: 'citadel',
    playerHp: 70,
    enemyHp: 70,
    rule: '诅咒法则：双方 1 号位各预置一片【诅咒之地】——场上任一生物死亡时，会按其攻击力对全场所有生物引爆一次伤害。链式爆破，送死也能反杀。',
    initialPlayerCreatures: [{ slot: 0, cardId: 'gop_cursed_ground' }],
    initialEnemyCreatures: [{ slot: 5, cardId: 'gop_cursed_ground' }],
  },
  {
    id: 'hallowed_sanctuary',
    name: '⛪ 神佑圣地',
    icon: '⛪',
    theme: 'citadel',
    playerHp: 75,
    enemyHp: 75,
    rule: '神佑法则：双方 3 号位各预置一片【神佑之地】——己方生物死亡时，按该生物攻击力为己方本体与全体生物回复生命。以命换血，越战越坚。',
    initialPlayerCreatures: [{ slot: 2, cardId: 'gop_hallowed_ground' }],
    initialEnemyCreatures: [{ slot: 3, cardId: 'gop_hallowed_ground' }],
  },
  {
    id: 'academy_of_magic',
    name: '🏫 魔法学院',
    icon: '🏫',
    theme: 'sky',
    playerHp: 60,
    enemyHp: 60,
    rule: '学院法则：双方 5 号位各预置一座【魔法学院】（免疫魔法）——每当拥有者施放一次魔法，就会在随机空格免费放下一名 4/12【魔法专家】。法术越密集，场面越失控。',
    initialPlayerCreatures: [{ slot: 4, cardId: 'gop_academy_of_magic' }],
    initialEnemyCreatures: [{ slot: 1, cardId: 'gop_academy_of_magic' }],
  },
  {
    id: 'great_oak_grove',
    name: '🌲 巨型橡树之林',
    icon: '🌲',
    theme: 'forest',
    playerHp: 65,
    enemyHp: 65,
    rule: '橡树法则：双方 4 号位各预置一棵【巨型橡树】，每个拥有者回合开始时在随机空格免费放下一名【森林仙子】。土系初始能量 +2，比谁能先把树苗养成洪流。',
    extraPlayerMana: { earth: 2 },
    extraEnemyMana: { earth: 2 },
    initialPlayerCreatures: [{ slot: 5, cardId: 'gop_great_oak' }],
    initialEnemyCreatures: [{ slot: 0, cardId: 'gop_great_oak' }],
  },
  {
    id: 'temple_of_fire',
    name: '🔥 烈焰神殿',
    icon: '🔥',
    theme: 'volcano',
    playerHp: 60,
    enemyHp: 60,
    rule: '神殿法则：双方 3 号位各预置一座【火焰神殿】，每个拥有者回合开始时在随机空格免费放下一名【火焰祭司】（每回合全系能量成长 +1）。火系初始能量 +3，能量滚雪球。',
    extraPlayerMana: { fire: 3 },
    extraEnemyMana: { fire: 3 },
    initialPlayerCreatures: [{ slot: 2, cardId: 'gop_temple_of_fire' }],
    initialEnemyCreatures: [{ slot: 3, cardId: 'gop_temple_of_fire' }],
  },
  {
    id: 'march_of_stone',
    name: '🗿 行军石阵',
    icon: '🗿',
    theme: 'citadel',
    playerHp: 70,
    enemyHp: 70,
    rule: '石阵法则：双方右侧各预置一块【行军石】（99 生命、免疫魔法），每个拥有者回合结束时会向右推进一格并与占位生物交换位置。阵线永不安定，堵位与换位成为核心博弈。',
    initialPlayerCreatures: [{ slot: 4, cardId: 'gop_marching_stone' }],
    initialEnemyCreatures: [{ slot: 1, cardId: 'gop_marching_stone' }],
  },
  {
    id: 'everraining_land',
    name: '🌧️ 永雨之地',
    icon: '🌧️',
    theme: 'sky',
    playerHp: 65,
    enemyHp: 65,
    rule: '永雨法则：双方 3 号位各预置一片【永雨之地】——场上所有卡牌费用 +2，任一玩家跳过回合时其本体受 5 点伤害。既拖慢节奏又惩罚空过，逼你每回合都得做事。',
    initialPlayerCreatures: [{ slot: 2, cardId: 'gop_everraining_land' }],
    initialEnemyCreatures: [{ slot: 3, cardId: 'gop_everraining_land' }],
  },
  {
    id: 'astral_convergence',
    name: '🌌 星魂共鸣',
    icon: '🌌',
    theme: 'sky',
    playerHp: 65,
    enemyHp: 65,
    rule: '共鸣法则：双方 2 号位各预置一名【星魂妨碍者】——当对手使用一张卡牌时，他会失去与该牌同系的所有剩余能量。能量清零的压迫下，出牌顺序就是生死线。',
    initialPlayerCreatures: [{ slot: 1, cardId: 'gop_astral_damper' }],
    initialEnemyCreatures: [{ slot: 4, cardId: 'gop_astral_damper' }],
  },
  {
    id: 'supreme_trial',
    name: '👑 至尊造物试炼',
    icon: '👑',
    theme: 'volcano',
    playerHp: 90,
    enemyHp: 90,
    rule: '试炼法则：双方各 90 点生命、全系初始能量 +3，双方 1 号位各预置一名【禁锢元素】——当拥有者任意一系能量达到 12 时，它会自行释放并转化为【至尊元素】。这是终局造物的舞台。',
    extraPlayerMana: { fire: 3, water: 3, air: 3, earth: 3, special: 3 },
    extraEnemyMana: { fire: 3, water: 3, air: 3, earth: 3, special: 3 },
    initialPlayerCreatures: [{ slot: 0, cardId: 'gop_cloistered_elemental' }],
    initialEnemyCreatures: [{ slot: 5, cardId: 'gop_cloistered_elemental' }],
  },
];

const CUSTOM_SCENARIOS_STORAGE_KEY = 'custom_battle_scenarios';

function getCustomScenarios(): BattlefieldScenario[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SCENARIOS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveCustomScenario(sc: BattlefieldScenario): void {
  const list = getCustomScenarios();
  const idx = list.findIndex((s) => s.id === sc.id);
  if (idx !== -1) {
    list[idx] = sc;
  } else {
    list.unshift(sc);
  }
  localStorage.setItem(CUSTOM_SCENARIOS_STORAGE_KEY, JSON.stringify(list));
}

function deleteCustomScenario(id: string): void {
  const list = getCustomScenarios().filter((s) => s.id !== id);
  localStorage.setItem(CUSTOM_SCENARIOS_STORAGE_KEY, JSON.stringify(list));
}

function getAllScenarios(): BattlefieldScenario[] {
  return [...BATTLEFIELD_SCENARIOS, ...getCustomScenarios()];
}

// 单局对战/联赛/局域网共用的场景装配。'random' 会先摇掉自身再抽取。
function pickScenarioById(id: string): BattlefieldScenario {
  const allSc = getAllScenarios();
  const found = allSc.find((s) => s.id === id);
  if (found && found.id !== 'random') return found;
  const candidates = allSc.filter((s) => s.id !== 'random');
  return candidates[Math.floor(Math.random() * candidates.length)] || allSc[0];
}

// 场景 → 引擎构造参数。单局对战、英雄联赛与局域网共用同一条装配路径，
// 保证同一场景在三种模式下预置的造物、生命与能量完全一致。
function buildScenarioEngineOptions(scenario: BattlefieldScenario) {
  return {
    playerHp: scenario.playerHp,
    enemyHp: scenario.enemyHp,
    leagueRule: scenario.rule,
    initialPlayerCreatures: resolveScenarioCreatures(scenario.initialPlayerCreatures),
    initialEnemyCreatures: resolveScenarioCreatures(scenario.initialEnemyCreatures),
    extraPlayerMana: scenario.extraPlayerMana,
    extraEnemyMana: scenario.extraEnemyMana,
  };
}

// 联赛：深度还原选手专属特技与开局阵容（对齐榜单界面说明与 PC 原版设定）
function buildLeagueOpponentEngineOptions(curOpponent: any, _scenario: BattlefieldScenario) {
  let playerHp = 60;
  let enemyHp = 60;
  let initialPlayerCreatures: Array<{ slot: number; cardId: string }> = [];
  let initialEnemyCreatures: Array<{ slot: number; cardId: string }> = [];
  let extraPlayerMana: Partial<Record<ElementType, number>> | undefined = undefined;
  let extraEnemyMana: Partial<Record<ElementType, number>> | undefined = undefined;

  const oppId = curOpponent?.id || 1;
  switch (oppId) {
    case 2: // Amehet: 玩家拥有【炽阳祭司】、【渊裔贤者】、【林间隐逸者】，阿姆哈特拥有【炼狱后勤官】
      initialPlayerCreatures = [
        { slot: 0, cardId: 'fire_priest_of_fire' },
        { slot: 1, cardId: 'water_merfolk_elder' },
        { slot: 2, cardId: 'earth_elf_hermit' },
      ];
      initialEnemyCreatures = [
        { slot: 0, cardId: 'demon_quartermaster' },
      ];
      break;
    case 9: // Forwor: 弗沃尔拥有【天灵蜂皇蜂巢】
      initialEnemyCreatures = [{ slot: 0, cardId: 'gop_beehive' }];
      break;
    case 10: // Futark: 双方场上拥有【噬齿尖牙突进石】
      initialPlayerCreatures = [{ slot: 2, cardId: 'gop_toothed_stone' }];
      initialEnemyCreatures = [{ slot: 2, cardId: 'gop_toothed_stone' }];
      break;
    case 11: // Galador: 基础系能量成长率高，开局能量多
      extraPlayerMana = { fire: 3, water: 3, air: 3, earth: 3 };
      extraEnemyMana = { fire: 3, water: 3, air: 3, earth: 3 };
      break;
    case 13: // Istran: 玩家拥有【蚀血蝠群黑雾】，伊斯坦恩拥有【秘典传习生】
      initialPlayerCreatures = [{ slot: 1, cardId: 'gop_vampiric_cloud' }];
      initialEnemyCreatures = [{ slot: 1, cardId: 'gop_sorcerors_apprentice' }];
      break;
    case 15: // Kaltor: 双方场上拥有【赋生狂岚风暴】
      initialPlayerCreatures = [{ slot: 2, cardId: 'gop_living_tornado' }];
      initialEnemyCreatures = [{ slot: 2, cardId: 'gop_living_tornado' }];
      break;
    case 16: // Kassandra: 双方场上拥有【失控魔流风暴】
      initialPlayerCreatures = [{ slot: 2, cardId: 'gop_mana_storm' }];
      initialEnemyCreatures = [{ slot: 2, cardId: 'gop_mana_storm' }];
      break;
    case 21: // Olgerd: 双方生命均为 40
      playerHp = 40;
      enemyHp = 40;
      break;
    case 23: // StoneGor: 高基础能量开局
      extraPlayerMana = { fire: 5, water: 5, air: 5, earth: 5 };
      extraEnemyMana = { fire: 5, water: 5, air: 5, earth: 5 };
      break;
    case 26: // Vatrax: 维特拉克斯拥有【阴鸷顽劣小魔】
      initialEnemyCreatures = [{ slot: 0, cardId: 'gop_niggling_imp' }];
      break;
    default:
      break;
  }

  const ruleText = (curOpponent?.rule || '').replace(/\r?\n/g, ' ');
  return {
    playerHp,
    enemyHp,
    leagueRule: ruleText,
    initialPlayerCreatures: resolveScenarioCreatures(initialPlayerCreatures),
    initialEnemyCreatures: resolveScenarioCreatures(initialEnemyCreatures),
    extraPlayerMana,
    extraEnemyMana,
  };
}

// 联赛战场环境场景分配（用于视觉背景与音效氛围）
// 同一场次重进不会换场景。
function getLeagueScenarioForCurrentMatch(): BattlefieldScenario {
  const matchNo = activeLeague?.currentMatch || 1;
  const seedStr = `${activeLeague?.id || 'league'}#${matchNo}`;
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  const candidates = BATTLEFIELD_SCENARIOS.filter((s) => s.id !== 'random');
  return candidates[h % candidates.length];
}

// 局域网：双方各自可选场景，因此只允许「双方对称」的场景，
// 避免出现「一方阵地上多一座祭坛」这种无法在开局同步的失衡。
// 判定标准：双方预置造物的 id 与数量完全一致（槽位允许因镜像而不同）。
function isLanSelectableScenario(scenario: BattlefieldScenario): boolean {
  if (scenario.id === 'random') return true;
  const sig = (specs?: Array<{ slot: number; cardId: string }>) =>
    (specs || []).map((s) => s.cardId).sort().join('|');
  return sig(scenario.initialPlayerCreatures) === sig(scenario.initialEnemyCreatures);
}

function getLanSelectableScenarios(): BattlefieldScenario[] {
  return BATTLEFIELD_SCENARIOS.filter(isLanSelectableScenario);
}

// 局域网场景下标越界保护（本地存储可能来自旧版本）。
function getCurrentLanScenario(): BattlefieldScenario {
  const list = getLanSelectableScenarios();
  if (!Number.isFinite(lanScenarioIdx) || lanScenarioIdx < 0 || lanScenarioIdx >= list.length) {
    lanScenarioIdx = 1 % list.length;
  }
  return list[lanScenarioIdx];
}
let singleDuelScenarioIdx: number = 0;
let showLeagueAdviceModal: boolean = false;
let showCampaignTreasuresModal: boolean = false;
let showLeagueCompletionModal: boolean = false;
let pendingConfirmDialog: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
} | null = null;

function openCustomConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText = '确定',
  cancelText = '取消'
) {
  pendingConfirmDialog = {
    title,
    message,
    confirmText,
    cancelText,
    onConfirm: () => {
      onConfirm();
    },
    onCancel: () => {
      if (onCancel) onCancel();
    }
  };
  render();
}

function renderCustomConfirmModal(): string {
  if (!pendingConfirmDialog) return '';
  return `
    <div class="modal-overlay" id="custom-confirm-overlay" style="z-index:99999;">
      <div class="stone-options-dialog" style="width:clamp(360px, 44vw, 520px); max-height:85vh; display:flex; flex-direction:column; border:2px solid #d4af37; box-shadow:0 12px 38px rgba(0,0,0,0.9);">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #451a03 0%, #78350f 50%, #451a03 100%); flex-shrink:0; display:flex; justify-content:space-between; align-items:center; padding:10px 18px;">
          <div class="options-title-text" style="color:#fef08a; font-size:17.5px;">⚠️ ${pendingConfirmDialog.title}</div>
          <button class="modal-close-btn" id="btn-pending-confirm-cancel-x" style="position:static; width:32px; height:32px; font-size:20px; cursor:pointer;" title="取消">×</button>
        </div>
        <div style="padding:22px 22px; font-size:15px; color:#3b2308; line-height:1.6; background:#fdfbf7;">
          ${pendingConfirmDialog.message.replace(/\n/g, '<br>')}
        </div>
        <div style="display:flex; justify-content:flex-end; gap:12px; padding:12px 18px; background:#f5eee1; border-top:1px solid #d4b378; border-radius:0 0 10px 10px;">
          <button class="campaign-pc-btn" id="btn-pending-confirm-cancel" style="padding:8px 20px; font-size:14px; min-width:80px;">${pendingConfirmDialog.cancelText || '取消'}</button>
          <button class="campaign-pc-btn start-btn" id="btn-pending-confirm-ok" style="padding:8px 22px; font-size:14px; min-width:90px;">${pendingConfirmDialog.confirmText || '确定'}</button>
        </div>
      </div>
    </div>
  `;
}


function formatCardAtk(atk?: number): string {
  if (atk === undefined || atk === null) return '0';
  return atk === -1 ? '*' : String(atk);
}

// Blood discipline cards pay life on top of their printed energy cost ("cost N blood and 2N
// life"), so the extra price is surfaced on the card face, the parchment preview and the pool.
function lifeCostBadge(card?: CardDef | null): string {
  if (!card || !card.lifeCost) return '';
  return `<div class="card-lifecost-badge" title="除能量外还需支付 ${card.lifeCost} 点生命">-${card.lifeCost}♥</div>`;
}

// Mirrors SpectromancerEngine.isValidSpellTarget for the slot highlighting in the combat view.
function isRestrictedTargetAllowed(card: CardDef | undefined | null, target: { card: CardDef; spellImmune: boolean } | null): boolean {
  if (!card || !target || target.spellImmune) return false;
  if (card.id === 'demon_power_chains') {
    return ['fire', 'water', 'air', 'earth'].includes(target.card.element);
  }
  return true;
}

function isFriendlyTargetSpell(card?: CardDef | null): boolean {
  if (!card || !card.requiresTarget) return false;
  return (
    card.id.includes('rescue') ||
    card.id.includes('glory') ||
    card.id.includes('natures_ritual') ||
    card.id.includes('healing_spray') ||
    card.id.includes('haste') ||
    card.id.includes('explosion') ||
    card.id.includes('blood_ritual') ||
    card.id.includes('sacrifice') ||
    card.id.includes('divine_justice')
  );
}

// ==========================================
// ACHIEVEMENTS SYSTEM STATE (Authentic PC Badges)
// ==========================================
const ACHIEVEMENTS_KEY = 'spectromancer_achievements';
interface AchievementDef {
  id: string;
  badgeImg: string;
  title: string;
  desc: string;
}

const ACHIEVEMENTS_LIST: AchievementDef[] = [
  // 1. 决斗大师系列
  { id: 'ace', badgeImg: './ui/achievements/AceBadge.png', title: '王牌徽章 (Ace)', desc: '连续 5 次在单局对战模式击败大法师' },
  { id: 'double_ace', badgeImg: './ui/achievements/DoubleAceBadge.png', title: '双重王牌徽章 (Double Ace)', desc: '连续 10 次在单局对战模式击败大法师' },
  { id: 'wide_open', badgeImg: './ui/achievements/WideOpenBadge.png', title: '大门开敞徽章 (Wide Open)', desc: '对方场上拥有 6 个未被阻挡的生物' },
  { id: 'overrun', badgeImg: './ui/achievements/OverrunBadge.png', title: '全面压制徽章 (Overrun)', desc: '玩家场上拥有 6 个未被阻挡的生物' },
  { id: 'share_the_pain', badgeImg: './ui/achievements/SharethePainBadge.png', title: '痛苦分享徽章 (Share the Pain)', desc: '单场对战中召唤 10 只海妖生物' },
  { id: 'storm_lord', badgeImg: './ui/achievements/StormLordBadge.png', title: '风暴领主徽章 (Storm Lord)', desc: '单场对战施放 5 次雷神之箭' },
  { id: 'dragon_master', badgeImg: './ui/achievements/DragonMasterBadge.png', title: '御龙大师徽章 (Dragon Master)', desc: '单场对战召唤 3 只以上火龙君临战场' },
  { id: 'rock_is_strong', badgeImg: './ui/achievements/RockisStrongBadge.png', title: '岩石就是力量徽章 (Rock is Strong)', desc: '单场对战施放 4 次石雨术构筑防线' },
  { id: 'big_spender', badgeImg: './ui/achievements/BigSpenderBadge.png', title: '大肆挥霍徽章 (Big Spender)', desc: '单场不使用费用低于 3 点的卡牌并获胜' },
  { id: 'the_whale', badgeImg: './ui/achievements/TheWhaleBadge.png', title: '巨鲸徽章 (The Whale)', desc: '在一局对战中本体生命值达到 150 点' },
  { id: 'still_standing', badgeImg: './ui/achievements/StillStandingBadge.png', title: '屹立不倒徽章 (Still Standing)', desc: '对战中累计承受 3000 点战斗伤害' },
  { id: 'quarterback', badgeImg: './ui/achievements/QuarterbackBadge.png', title: '四分卫徽章 (Quarterback)', desc: '单场对战中累计跳过 10 次出牌回合' },
  { id: 'photo_finish', badgeImg: './ui/achievements/PhotoFinishBadge.png', title: '鹰眼判定成功徽章 (Photo Finish)', desc: '在一场对战获胜时玩家生命不超过 5 点' },
  { id: 'photo_finished', badgeImg: './ui/achievements/PhotoFinishedBadge.png', title: '鹰眼判定失败徽章 (Photo Finished)', desc: '在一场对战失败时对方生命不超过 5 点' },
  { id: 'fire_suppression', badgeImg: './ui/achievements/FireSuppressionBadge.png', title: '拒绝火系徽章 (Fire Suppression)', desc: '在一场对战中不使用任何火系卡牌并取得胜利' },
  { id: 'water_suppression', badgeImg: './ui/achievements/WaterSuppressionBadge.png', title: '拒绝水系徽章 (Water Suppression)', desc: '在一场对战中不使用任何水系卡牌并取得胜利' },
  { id: 'air_suppression', badgeImg: './ui/achievements/AirSuppresstionBadge.png', title: '拒绝气系徽章 (Air Suppression)', desc: '在一场对战中不使用任何气系卡牌并取得胜利' },
  { id: 'earth_suppression', badgeImg: './ui/achievements/EarthSupressionBadge.png', title: '拒绝土系徽章 (Earth Suppression)', desc: '在一场对战中不使用任何土系卡牌并取得胜利' },
  { id: 'biding_time', badgeImg: './ui/achievements/BidingTimeBadge.png', title: '伺机而动徽章 (Biding Time)', desc: '单场积累 12 点特殊专属流派能量' },
  { id: 'arms_race', badgeImg: './ui/achievements/ArmsRaceBadge.png', title: '强悍助力徽章 (Arms Race)', desc: '在场上拥有一个攻击力达到 30 以上的生物' },
  { id: 'rebirth', badgeImg: './ui/achievements/RebirthBadge.png', title: '重生徽章 (Rebirth)', desc: '在场上同时拥有 4 个具有复活/再生特性的生物' },
  { id: 'wall_of_bodies', badgeImg: './ui/achievements/WallofBodiesBadge.png', title: '堆尸如山徽章 (Wall of Bodies)', desc: '单场对战中累计战死失去 30 个生物' },
  { id: 'scorched_earth', badgeImg: './ui/achievements/ScorchedEarthBadge.png', title: '烈焰焦土徽章 (Scorched Earth)', desc: '单场对战中累计击杀摧毁 30 个敌方生物' },
  { id: 'veterinarian', badgeImg: './ui/achievements/VeterinarianBadge.png', title: '兽医徽章 (Veterinarian)', desc: '单场对战中使己方生物累计回复 50 点生命' },
  { id: 'death_dealer', badgeImg: './ui/achievements/DeathDealerBadge.png', title: '死亡散布徽章 (Death Dealer)', desc: '对战中累计造成 3000 点伤害' },
  { id: 'death_of_cuts', badgeImg: './ui/achievements/DeathofaThousandCutsBadge.png', title: '千刀万剐徽章 (Thousand Cuts)', desc: '对战中累计承受 10000 点伤害' },
  { id: 'armageddon', badgeImg: './ui/achievements/ArmageddonBadge.png', title: '末日审判徽章 (Armageddon)', desc: '对战中累计造成 10000 点毁灭伤害' },

  // 2. 战役通关徽章
  { id: 'campaign_cleric', badgeImg: './ui/achievements/ClericCampaignBadge.png', title: '神圣牧师战役徽章', desc: '以神圣牧师为职业完成战役' },
  { id: 'campaign_necromancer', badgeImg: './ui/achievements/NecromancerCampaignBadge.png', title: '死灵法师战役徽章', desc: '以死灵法师为职业完成战役' },
  { id: 'campaign_mechanician', badgeImg: './ui/achievements/MechanicianCampaignBadge.png', title: '机械师战役徽章', desc: '以机械师为职业完成战役' },
  { id: 'campaign_chaosmaster', badgeImg: './ui/achievements/ChaosmasterCampaignBadge.png', title: '混沌之主战役徽章', desc: '以混沌之主为职业完成战役' },
  { id: 'campaign_illusionist', badgeImg: './ui/achievements/IllusionistCampaignBadge.png', title: '幻像师战役徽章', desc: '以幻像师为职业完成战役' },
  { id: 'campaign_dominator', badgeImg: './ui/achievements/DominatorCampaignBadge.png', title: '统御使战役徽章', desc: '以统御使为职业完成战役' },

  // 3. 大师级徽章 (最高难度完成)
  { id: 'master_cleric', badgeImg: './ui/achievements/MasterClericBadge.png', title: '大师级神圣牧师徽章', desc: '以神圣牧师为职业完成最高难度战役' },
  { id: 'master_necromancer', badgeImg: './ui/achievements/MasterNecromancerBadge.png', title: '大师级死灵法师徽章', desc: '以死灵法师为职业完成最高难度战役' },
  { id: 'master_mechanician', badgeImg: './ui/achievements/MasterMechanicianBadge.png', title: '大师级机械师徽章', desc: '以机械师为职业完成最高难度战役' },
  { id: 'master_chaosmaster', badgeImg: './ui/achievements/MasterChaosmasterBadge.png', title: '大师级混沌之主徽章', desc: '以混沌之主为职业完成最高难度战役' },
  { id: 'master_illusionist', badgeImg: './ui/achievements/MasterIllusionistBadge.png', title: '大师级幻像师徽章', desc: '以幻像师为职业完成最高难度战役' },
  { id: 'master_dominator', badgeImg: './ui/achievements/MasterDominatorBadge.png', title: '大师级统御使徽章', desc: '以统御使为职业完成最高难度战役' },

  // 4. 联赛与选手徽章
  { id: 'duelist_cleric', badgeImg: './ui/achievements/ClericCompetitorBadge.png', title: '神圣牧师选手徽章', desc: '以神圣牧师职业赢得联赛或高级对战' },
  { id: 'duelist_necromancer', badgeImg: './ui/achievements/NecromancerDuelistBadge.png', title: '死灵法师选手徽章', desc: '以死灵法师职业赢得联赛或高级对战' },
  { id: 'duelist_mechanician', badgeImg: './ui/achievements/MechanicianDuelistBadge.png', title: '机械师选手徽章', desc: '以机械师职业赢得联赛或高级对战' },
  { id: 'duelist_chaosmaster', badgeImg: './ui/achievements/ChaosmasterDuelistBadge.png', title: '混沌之主选手徽章', desc: '以混沌之主职业赢得联赛或高级对战' },
  { id: 'duelist_illusionist', badgeImg: './ui/achievements/IllusionistDuelistBadge.png', title: '幻像师选手徽章', desc: '以幻像师职业赢得联赛或高级对战' },
  { id: 'duelist_dominator', badgeImg: './ui/achievements/DominatorDuelistBadge.png', title: '统御使选手徽章', desc: '以统御使职业赢得联赛或高级对战' },
];

let unlockedAchievements: Record<string, string> = (() => {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
})();
let showAchievementsModal = false;

// ==========================================
// CUSTOM DECK BUILDER STATE (Images 4 & 5)
// ==========================================
const CUSTOM_DECKS_KEY = 'spectromancer_custom_decks';
interface CustomDeck {
  id: string;
  name: string;
  className: HeroClass;
  cards: CardDef[]; // 20 cards
}

const allCardsList = cardsData as CardDef[];

function getDefaultMechanicDeck(): CardDef[] {
  const fire = allCardsList.filter(c => c.element === 'fire').slice(0, 4);
  const water = allCardsList.filter(c => c.element === 'water').slice(0, 4);
  const air = allCardsList.filter(c => c.element === 'air').slice(0, 4);
  const earth = allCardsList.filter(c => c.element === 'earth').slice(0, 4);
  const mech = allCardsList.filter(c => c.className === 'mechanician' || c.element === 'mechanics').slice(0, 4);
  return [...fire, ...water, ...air, ...earth, ...mech];
}

let customDecks: CustomDeck[] = (() => {
  try {
    const raw = localStorage.getItem(CUSTOM_DECKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [
    {
      id: 'deck_mechanic_default',
      name: '机械',
      className: 'mechanician',
      cards: getDefaultMechanicDeck(),
    },
  ];
})();

let selectedDeckIdx = 0;
let customDeckAiDiffIdx = 3; // 大法师 default (Image 5)
const customDeckAiDiffList = ['学徒法师', '进阶法师', '专家法师', '大法师', '传奇法师'];
const customDeckOpponentList = ['拉德维尔', '杜斯坦', '乌姆卡兹', '莫里加', '在线1', '扎克里拉', '阿特朗', '弗沃尔'];
let selectedCustomOpponentIdx = 0;

let editingDeck: CustomDeck = {
  id: 'temp',
  name: '机械',
  className: 'mechanician',
  cards: [...customDecks[0].cards],
};
let selectedBuilderSlotIdx = 0;
let builderPoolFilter: ElementType = 'fire';
let hoveredBuilderCard: CardDef | null = null;
let currentBattleSource: 'duel' | 'campaign' | 'league' | 'custom_deck' | 'lan' | 'ai_duel' = 'duel';
let showRulesModal = false;
let showCombatLogsModal = false;
let showCardDetailModal = false;
let detailedCard: CardDef | null = null;
let activeEnemyBanter: string | null = null;
let activeBanterSpeaker: string = '';
let banterTimer: any = null;
let banterPopClass = 'anim-pop';

function showEnemyBanter(banter: string, durationMs = 5000, speaker?: string) {
  if (!banter || currentView !== 'battle') return;
  if (banterTimer) {
    clearTimeout(banterTimer);
    banterTimer = null;
  }
  activeEnemyBanter = banter;
  activeBanterSpeaker = speaker || '';
  banterPopClass = 'anim-pop';
  render();

  // 350ms 后清除入场动效类，确保后续生命扣减、生物攻击等触发 render() 时不会重复弹跳闪烁！
  setTimeout(() => {
    banterPopClass = '';
    const el = document.querySelector('.arcane-speech-scroll');
    if (el) el.classList.remove('anim-pop');
  }, 350);

  banterTimer = setTimeout(() => {
    if (activeEnemyBanter === banter) {
      const el = document.querySelector('.arcane-speech-scroll');
      if (el) {
        el.classList.add('anim-fade-out');
        setTimeout(() => {
          if (activeEnemyBanter === banter) {
            activeEnemyBanter = null;
            banterTimer = null;
            render();
          }
        }, 320);
      } else {
        activeEnemyBanter = null;
        banterTimer = null;
        render();
      }
    }
  }, durationMs);
}

let showAiApiKey = false;
let detailedCreatureSlot: { creature: BoardCreature; side: 'player' | 'enemy' } | null = null;

let turnTimerInterval: any = null;
let currentTurnTimerWho: 'player' | 'enemy' | null = null;
let currentTurnTimerRemaining: number = 30;

function resetTurnTimer() {
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }
  currentTurnTimerWho = null;
  currentTurnTimerRemaining = 30;
}

function updateTurnTimer() {
  if (currentView !== 'battle' || engine.gameOver) {
    resetTurnTimer();
    return;
  }

  const activeWho = engine.activeTurn;
  // If turn side switched, start a fresh 30s countdown
  if (currentTurnTimerWho !== activeWho) {
    if (turnTimerInterval) {
      clearInterval(turnTimerInterval);
      turnTimerInterval = null;
    }
    currentTurnTimerWho = activeWho;
    currentTurnTimerRemaining = 30;

    turnTimerInterval = setInterval(async () => {
      if (currentView !== 'battle' || engine.gameOver || engine.activeTurn !== currentTurnTimerWho) {
        resetTurnTimer();
        return;
      }

      currentTurnTimerRemaining--;

      // Direct DOM update (zero flicker!)
      const badge = document.getElementById(`turn-timer-${currentTurnTimerWho}`);
      if (badge) {
        badge.textContent = `⏱️ ${currentTurnTimerRemaining}s`;
        if (currentTurnTimerRemaining <= 10) {
          badge.classList.add('urgent');
        } else {
          badge.classList.remove('urgent');
        }
      }

      if (currentTurnTimerRemaining <= 0) {
        resetTurnTimer();
        if (engine.gameOver) return;

        if (engine.activeTurn === 'player' && !engine.isPlayerAiControlled && !engine.isLanGame) {
          console.warn('[Turn Timer] Player turn timed out after 30s. Automatically ending turn.');
          sound.play('damage');
          showToastNotice('⏱️ 回合思考超时 (30秒)，系统自动结束本回合！');
          if (!isActionPending && !engine.gameOver) {
            isActionPending = true;
            aiAnnouncedCard = null;
            try {
              await engine.passTurn('player');
            } catch (err) {
              console.error('[Turn Timer] Error passing player turn:', err);
            } finally {
              isActionPending = false;
            }
            render();
          }
        } else if (engine.activeTurn === 'enemy' && !engine.isLanGame) {
          console.warn('[Turn Timer] AI turn timed out after 30s. Automatically forcing passTurn.');
          aiAnnouncedCard = null;
          engine.log('⏳【裁判裁定】对手思考超时 (30秒)，系统自动推进战局进入交战！', 'damage');
          showToastNotice('⏱️ 电脑对手思考超时 (30秒)，系统自动裁定跳轮！');
          if (!isActionPending && !engine.gameOver) {
            isActionPending = true;
            try {
              await engine.passTurn('enemy');
            } catch (err) {
              console.error('[Turn Timer] Error passing enemy turn:', err);
            } finally {
              isActionPending = false;
            }
            render();
          }
        }
      }
    }, 1000);
  }
}
const APP_VERSION = 'v2.5.0 Mobile · HD';

const HERO_CLASSES: { id: HeroClass | 'random'; nameCn: string; icon: string; artImg: string; desc: string }[] = [
  { id: 'random', nameCn: '随机', icon: '🎲', artImg: './cards/SupremeElemental.webp', desc: '随机选择一个强大的法师流派' },
  { id: 'sorcery', nameCn: '巫术法师', icon: '🔮', artImg: './cards/Disintegrate.webp', desc: '经典巫术法师，精通飞弹、裂解射线与冥想心能' },
  { id: 'necromancer', nameCn: '死灵术士', icon: '💀', artImg: './cards/MasterLich.webp', desc: '召唤女妖、吸血鬼与巫妖，吸取敌人生机转化为死灵能量' },
  { id: 'cleric', nameCn: '圣殿骑士', icon: '✨', artImg: './cards/ArchAngel.webp', desc: '召唤圣骑士、十字军与大天使，掌握神圣护盾与群体圣疗' },
  { id: 'mechanician', nameCn: '机械工匠', icon: '⚙️', artImg: './cards/SteamTank.webp', desc: '部署矮人巧匠、火枪手、扑翼轰炸机与重型蒸汽坦克' },
  { id: 'dominator', nameCn: '心灵支配', icon: '👁️', artImg: './cards/MindStealer.webp', desc: '操控萨满与减速塔压制敌方能量，役使支配女巫与窃心魔' },
  { id: 'chaosmaster', nameCn: '混沌狂潮', icon: '🌀', artImg: './cards/InsanianLord.webp', desc: '驱使混沌狂战士、投石机与死棘刺客，爆发极强破坏力' },
  { id: 'illusionist', nameCn: '幻术大师', icon: '🎭', artImg: './cards/PhantomWarrior.webp', desc: '操纵反射镜之墙、虚影勇士与幻影刺客，虚实莫测' },
  { id: 'demonologist', nameCn: '恶魔学者', icon: '🔥', artImg: './cards/GreaterDemon.webp', desc: '役使劣魔、恶果魔与大恶魔，施放自爆献祭与地狱火' },
  { id: 'beastmaster', nameCn: '荒野驯兽', icon: '🐺', artImg: './cards/AncientDragon.webp', desc: '统御魔法仓鼠、暴怒狼獾、凶猛战隼与远古巨龙' },
  { id: 'chronomancer', nameCn: '时空术士', icon: '⏳', artImg: './cards/ChronoHunter.webp', desc: '驱使时空猎手、时间闪击者、时钟巨龙与时间停止，掌控额外回合' },
  { id: 'goblin', nameCn: '哥布林军团', icon: '👺', artImg: './cards/GoblinHero.webp', desc: '统御哥布林英雄、爆破工兵、鼠群与强盗突骑，擅长偷牌与机动' },
  { id: 'forest', nameCn: '密林德鲁伊', icon: '🌳', artImg: './cards/MagicRabbit.webp', desc: '荒野林语流派：每回合放置繁殖魔法兔子，以兔群之力召唤万木巨兽' },
  { id: 'golem', nameCn: '钢铁魔像', icon: '🗿', artImg: './cards/Golem.webp', desc: '开局拥有免疫魔法与特技的【钢铁魔像】，阵亡立刻复活并可持续强化' },
  { id: 'cult', nameCn: '狂热教徒', icon: '🕯️', artImg: './cards/Reaver.webp', desc: '狂热信徒以自伤换取狂暴力量，狂怒纪念碑赋予全军双重连击' },
  { id: 'blood', nameCn: '鲜血贵族', icon: '🩸', artImg: './cards/VampireElder.webp', desc: '吸血鬼秘法以生命为代价换取超强战力，食尸鬼吞噬尸体，审判官以伤换伤' },
];

// 虹光法师已从可选职业中移除；虹光造物（火山、祭坛、行军石、魔法学院、至尊元素…）不是任何流派的牌：
// 它们不进牌库、不进发牌池、也不能被选为职业。它们唯一的存在方式是作为「战场场景」的预置元素登场。

// ==========================================
// LAN MULTIPLAYER DUEL STATE
// ==========================================
let showLanLobbyModal = false;
let lanActiveTab: 'host' | 'join' = 'host';
let lanPlayerName: string = (() => {
  try { return localStorage.getItem('spectro_lan_name') || '奥术决斗者'; } catch { return '奥术决斗者'; }
})();
let lanPlayerFaceId: number = (() => {
  try { return parseInt(localStorage.getItem('spectro_lan_face') || '1', 10); } catch { return 1; }
})();
let lanPlayerClassIdx: number = (() => {
  try { return parseInt(localStorage.getItem('spectro_lan_class') || '1', 10); } catch { return 1; }
})();
// 局域网战场场景下标（仅房主选择，随 GAME_START 同步给 guest）。
// 注意：这里只做惰性读取，合法性校验在使用时进行（场景列表在文件后部声明）。
let lanScenarioIdx: number = (() => {
  try { return parseInt(localStorage.getItem('spectro_lan_scenario') || '1', 10); } catch { return 1; }
})();
let lanJoinCode: string = '';
let lanStatusText: string = '';
let lanIsConnecting: boolean = false;
let lanVsMatchData: { host: NetworkUserProfile; guest: NetworkUserProfile; countdown: number } | null = null;
let showLanDisconnectModal: boolean = false;
let lanDisconnectReason: string = '';

function getMyLanProfile(): NetworkUserProfile {
  const chosenClass = HERO_CLASSES[lanPlayerClassIdx] || HERO_CLASSES[1];
  let actualClass: HeroClass = 'sorcery';
  if (chosenClass.id === 'random') {
    const validClasses: HeroClass[] = [
      'sorcery', 'necromancer', 'cleric', 'mechanician', 'dominator',
      'chaosmaster', 'illusionist', 'demonologist', 'beastmaster', 'chronomancer', 'goblin', 'forest', 'golem', 'cult', 'blood'
    ];
    actualClass = validClasses[Math.floor(Math.random() * validClasses.length)];
  } else {
    actualClass = chosenClass.id as HeroClass;
  }
  return {
    name: lanPlayerName.trim() || '奥术决斗者',
    face: `./faces/Face${lanPlayerFaceId}.jpg`,
    className: actualClass,
    classCn: chosenClass.nameCn,
  };
}

function saveLanProfilePreferences() {
  try {
    localStorage.setItem('spectro_lan_name', lanPlayerName);
    localStorage.setItem('spectro_lan_face', lanPlayerFaceId.toString());
    localStorage.setItem('spectro_lan_class', lanPlayerClassIdx.toString());
    localStorage.setItem('spectro_lan_scenario', lanScenarioIdx.toString());
  } catch {}
}

function launchLanMatchWithCountdown(
  host: NetworkUserProfile,
  guest: NetworkUserProfile,
  onComplete: () => void
) {
  sound.play('showeff1');
  let count = 3;
  lanVsMatchData = { host, guest, countdown: count };
  render();

  const timer = window.setInterval(() => {
    count--;
    if (count > 0) {
      if (lanVsMatchData) {
        lanVsMatchData.countdown = count;
        sound.play('click');
        render();
      }
    } else {
      window.clearInterval(timer);
      lanVsMatchData = null;
      onComplete();
    }
  }, 800);
}

function setupLanNetworkCallbacks() {
  lanNetwork.onStatusChange = (_status, msg) => {
    lanStatusText = msg || '';
    render();
  };

  lanNetwork.onPeerConnected = (peerProfile) => {
    sound.play('click');
    showToastNotice(`🤝 对手【${peerProfile.name}】已加入房间！`);
    lanStatusText = `对手【${peerProfile.name}】已就绪`;
    render();
  };

  lanNetwork.onPeerDisconnected = (reason) => {
    if (currentView === 'battle' && engine.isLanGame) {
      showLanDisconnectModal = true;
      lanDisconnectReason = reason || '对手已退出游戏或网络连接中断';
    } else {
      lanStatusText = reason || '对手已断开连接';
    }
    render();
  };

  lanNetwork.onErrorOccurred = (errText) => {
    lanStatusText = errText;
    lanIsConnecting = false;
    showToastNotice('⚠️ ' + errText);
    render();
  };

  lanNetwork.onMessageReceived = async (msg: NetworkMessage) => {
    if (msg.type === 'GAME_START') {
      const { hostProfile, guestProfile, snapshot, scenarioId } = msg.payload;
      // 与房主在同一战场场景（含特殊造物预置）下开场；
      // 场面 HP/手牌/牌组随后由快照对齐。
      const lanScenario = pickScenarioById(scenarioId || 'sanctuary');
      launchLanMatchWithCountdown(hostProfile, guestProfile, () => {
        engine = new SpectromancerEngine(guestProfile.className, undefined, {
          playerName: guestProfile.name,
          playerFace: guestProfile.face,
          enemyName: hostProfile.name,
          enemyFace: hostProfile.face,
          enemyClass: hostProfile.className,
          ...buildScenarioEngineOptions(lanScenario),
        });
        engine.isLanGame = true;
        engine.isHost = false;
        engine.isGuest = true;
        setupEngineCallbacks();
        engine.applyStateSnapshot(snapshot);
        currentBattleSource = 'lan';
        currentView = 'battle';
        showLanLobbyModal = false;
        render();
      });
      return;
    }

    if (msg.type === 'STATE_SYNC') {
      if (engine.isLanGame && engine.isGuest) {
        engine.applyStateSnapshot(msg.payload);
        render();
      }
      return;
    }

    if (msg.type === 'VFX_EVENT') {
      if (engine.isLanGame && engine.isGuest) {
        const vfx = msg.payload;
        const mappedSide = vfx.side === 'player' ? 'enemy' : 'player';
        if (vfx.kind === 'damage') {
          engine.onDamageEffect?.(mappedSide, vfx.slot, vfx.amount);
        } else if (vfx.kind === 'heal') {
          engine.onHealEffect?.(mappedSide, vfx.slot, vfx.amount);
        } else if (vfx.kind === 'lunge') {
          engine.onAttackLunge?.(mappedSide, vfx.slot);
        } else if (vfx.kind === 'impact') {
          engine.onCardImpact?.(mappedSide, vfx.slot);
        }
      }
      return;
    }

    if (msg.type === 'ACTION_PLAY_CARD') {
      if (engine.isLanGame && engine.isHost) {
        const { cardId, targetSlot } = msg.payload;
        const card = engine.getEffectiveHand('enemy').find((c) => c.id === cardId);
        if (card && engine.canPlayCard('enemy', card)) {
          await engine.playCard('enemy', card, targetSlot);
        }
      }
      return;
    }

    if (msg.type === 'ACTION_PASS') {
      if (engine.isLanGame && engine.isHost) {
        await engine.passTurn('enemy');
      }
      return;
    }

    if (msg.type === 'SURRENDER') {
      if (engine.isLanGame) {
        engine.enemy.hp = 0;
        engine.checkWinner();
        showToastNotice('🏳️ 对手已投降！');
        render();
      }
      return;
    }
  };
}

function startLanBattleAsHost() {
  const hostProfile = getMyLanProfile();
  const guestProfile = lanNetwork.getPeerProfile();
  if (!guestProfile) {
    showToastNotice('⚠️ 尚无对手加入房间');
    return;
  }

  // 房主选定的战场场景（含特殊造物场景）随 GAME_START 一并下发，
  // 双方引擎在同一场景规则与预置造物下开场。
  const scenario = getCurrentLanScenario();

  launchLanMatchWithCountdown(hostProfile, guestProfile, () => {
    engine = new SpectromancerEngine(hostProfile.className, undefined, {
      playerName: hostProfile.name,
      playerFace: hostProfile.face,
      enemyName: guestProfile.name,
      enemyFace: guestProfile.face,
      enemyClass: guestProfile.className,
      ...buildScenarioEngineOptions(scenario),
    });
    engine.isLanGame = true;
    engine.isHost = true;
    engine.isGuest = false;
    setupEngineCallbacks();

    engine.onStateBroadcast = (snapshot) => {
      lanNetwork.sendMessage({ type: 'STATE_SYNC', payload: snapshot });
    };

    engine.onVfxBroadcast = (vfx) => {
      lanNetwork.sendMessage({ type: 'VFX_EVENT', payload: vfx });
    };

    const initialSnapshot = engine.exportStateSnapshot();
    lanNetwork.sendMessage({
      type: 'GAME_START',
      payload: {
        hostProfile,
        guestProfile,
        snapshot: initialSnapshot,
        scenarioId: scenario.id,
      },
    });

    currentBattleSource = 'lan';
    currentView = 'battle';
    showLanLobbyModal = false;
    render();
  });
}

setupLanNetworkCallbacks();

let engine = new SpectromancerEngine('sorcery');

let selectedCard: CardDef | null = null;
let inspectedCard: CardDef | null = null;
let inspectedCardSide: 'player' | 'enemy' = 'player';
let isActionPending = false;

const app = document.getElementById('app')!;

// Persistent floating & VFX layers
let floatingLayer = document.getElementById('floating-text-layer');
if (!floatingLayer) {
  floatingLayer = document.createElement('div');
  floatingLayer.id = 'floating-text-layer';
  document.body.appendChild(floatingLayer);
}

let spellFxLayer = document.getElementById('spell-fx-layer');
if (!spellFxLayer) {
  spellFxLayer = document.createElement('div');
  spellFxLayer.id = 'spell-fx-layer';
  document.body.appendChild(spellFxLayer);
}

let currentBattlefieldTheme: string = localStorage.getItem('battlefield_theme') || 'citadel';
let randomBattlefieldEnabled: boolean = localStorage.getItem('battlefield_random_enabled') === 'true';

const battlefieldBgs: Record<string, string> = {
  citadel: './ui/battlefield_citadel.jpg',
  sky: './ui/battlefield_sky.jpg',
  volcano: './ui/battlefield_volcano.jpg',
  forest: './ui/battlefield_forest.jpg',
  abyss: './ui/battlefield_abyss.jpg',
  tundra: './ui/battlefield_tundra.jpg',
  desert: './ui/battlefield_desert.jpg',
  shrine: './ui/battlefield_shrine.jpg',
};

function getThemeName(key: string): string {
  switch (key) {
    case 'citadel': return '星辉圣殿';
    case 'sky': return '天界圣峰';
    case 'volcano': return '熔岩炼狱';
    case 'forest': return '永恒密林';
    case 'abyss': return '深渊裂隙';
    case 'tundra': return '极地雪原';
    case 'desert': return '丝路大漠';
    case 'shrine': return '苍穹神坛';
    default: return '星辉圣殿';
  }
}

function applyRandomBattlefieldThemeIfNeeded() {
  if (randomBattlefieldEnabled) {
    const allThemes = Object.keys(battlefieldBgs);
    const chosen = allThemes[Math.floor(Math.random() * allThemes.length)];
    currentBattlefieldTheme = chosen;
  }
}

let hasSavedCurrentBattleReplay = false;

function checkAndUnlockAchievement(id: string) {
  if (unlockedAchievements[id]) return;
  const ach = ACHIEVEMENTS_LIST.find(a => a.id === id);
  if (!ach) return;
  unlockedAchievements[id] = new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlockedAchievements));
  } catch {}
  showAchievementToast(ach);
}

function showAchievementToast(ach: AchievementDef) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <img src="${ach.badgeImg}" class="achievement-toast-icon" style="width:38px; height:38px; border-radius:5px; border:1px solid #ffd700; object-fit:cover;" alt="icon" />
    <div class="achievement-toast-info">
      <div class="achievement-toast-title">达成成就！【${ach.title}】</div>
      <div class="achievement-toast-desc">${ach.desc}</div>
    </div>
  `;
  document.body.appendChild(toast);
  sound.play('victory', 1.0);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 600);
  }, 3500);
}

function saveCompletedBattleReplay(eng: SpectromancerEngine, mode: string) {
  if (!recordReplaysEnabled) return;
  const pName = eng.player.name || '玩家';
  const eName = eng.enemy.name || '对手';
  const pFace = currentBattleSource === 'lan' ? (eng.player.face || `./faces/Face${lanPlayerFaceId}.jpg`) : `./faces/Face${playerFaceIndex + 1}.jpg`;
  const eFace = currentBattleSource === 'campaign' 
    ? ([...CAMPAIGN_MAP1_NODES, ...CAMPAIGN_MAP2_NODES].find(n => n.levelId === selectedCampaignLevelId)?.face || `./faces/Face${aiFaceIndex + 1}.jpg`)
    : (currentBattleSource === 'league'
      ? (activeLeague?.standings[(activeLeague.currentMatch - 1) % activeLeague.standings.length]?.face || `./faces/Face${aiFaceIndex + 1}.jpg`)
      : (currentBattleSource === 'lan' ? (eng.enemy.face || `./faces/Face${aiFaceIndex + 1}.jpg`) : `./faces/Face${aiFaceIndex + 1}.jpg`));

  const replay: BattleReplay = {
    id: 'replay_' + Date.now(),
    timestamp: Date.now(),
    dateStr: new Date().toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    mode: mode === 'campaign' ? '战役对决' : (mode === 'league' ? '联赛排位' : (mode === 'custom_deck' ? '自组卡牌' : (mode === 'lan' ? '局域网对决' : '单局对战'))),
    playerName: pName,
    playerFace: pFace,
    enemyName: eName,
    enemyFace: eFace,
    result: eng.winner === 'player' ? 'victory' : 'defeat',
    totalTurns: eng.turnCount,
    steps: [...eng.replaySteps]
  };

  battleReplays.unshift(replay);
  if (battleReplays.length > 20) battleReplays.pop();
  try {
    localStorage.setItem(REPLAYS_STORAGE_KEY, JSON.stringify(battleReplays));
  } catch {}
}

function showCombatDamageEffect(side: 'player' | 'enemy', slot: number | 'hero', amount: number) {
  if (amount <= 0) return;
  let targetEl: HTMLElement | null = null;
  if (slot === 'hero') {
    targetEl = document.querySelector(`.combat-hero-portrait-frame.${side === 'player' ? 'bottom' : 'top'}`) ||
               document.querySelector(`.combat-hero-row.${side === 'player' ? 'player' : 'opponent'}`);
  } else {
    targetEl = document.querySelector(`.combat-board-slot[data-side="${side}"][data-slot-index="${slot}"]`) ||
               document.querySelector(`.board-slot[data-side="${side}"][data-slot="${slot}"]`);
  }

  const fl = floatingLayer || document.getElementById('floating-text-layer');
  if (targetEl && fl) {
    const rect = targetEl.getBoundingClientRect();
    const floatEl = document.createElement('div');
    floatEl.className = 'floating-combat-text damage';
    floatEl.innerText = `-${amount}`;
    floatEl.style.left = `${rect.left + rect.width / 2}px`;
    floatEl.style.top = `${rect.top + rect.height * 0.25}px`;
    fl.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 1000);
  }

  if (amount >= 8) {
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 350);
  }
}

function showCombatHealEffect(side: 'player' | 'enemy', slot: number | 'hero', amount: number) {
  if (amount <= 0) return;
  let targetEl: HTMLElement | null = null;
  if (slot === 'hero') {
    targetEl = document.querySelector(`.combat-hero-portrait-frame.${side === 'player' ? 'bottom' : 'top'}`) ||
               document.querySelector(`.combat-hero-row.${side === 'player' ? 'player' : 'opponent'}`);
  } else {
    targetEl = document.querySelector(`.combat-board-slot[data-side="${side}"][data-slot-index="${slot}"]`) ||
               document.querySelector(`.board-slot[data-side="${side}"][data-slot="${slot}"]`);
  }

  const fl = floatingLayer || document.getElementById('floating-text-layer');
  if (targetEl && fl) {
    const rect = targetEl.getBoundingClientRect();
    const floatEl = document.createElement('div');
    floatEl.className = 'floating-combat-text heal';
    floatEl.innerText = `+${amount}`;
    floatEl.style.left = `${rect.left + rect.width / 2}px`;
    floatEl.style.top = `${rect.top + rect.height * 0.25}px`;
    fl.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 1000);
  }
}

function applyReplayStep(stepIdx: number) {
  if (!activeViewingReplay || !activeViewingReplay.steps || activeViewingReplay.steps.length === 0) return;
  const clampedIdx = Math.max(0, Math.min(stepIdx, activeViewingReplay.steps.length - 1));
  const prevStep = activeViewingReplay.steps[replayCurrentStepIdx];
  replayCurrentStepIdx = clampedIdx;
  const step = activeViewingReplay.steps[clampedIdx];
  if (!step) return;

  engine.turnCount = step.turn;
  engine.activeTurn = step.side;
  engine.player.hp = step.playerHp;
  engine.enemy.hp = step.enemyHp;
  if (step.playerMana) engine.player.mana = { ...step.playerMana };
  if (step.enemyMana) engine.enemy.mana = { ...step.enemyMana };
  if (step.playerBoard) engine.playerBoard = step.playerBoard.map(c => c ? { ...c, card: { ...c.card } } : null);
  if (step.enemyBoard) engine.enemyBoard = step.enemyBoard.map(c => c ? { ...c, card: { ...c.card } } : null);

  engine.log(`[回放 第${step.turn}回合] ${step.desc}`, 'info');
  render();

  // Trigger floating combat animations on freshly updated DOM
  if (prevStep && clampedIdx > 0) {
    if (step.playerHp < prevStep.playerHp) {
      showCombatDamageEffect('player', 'hero', prevStep.playerHp - step.playerHp);
    } else if (step.playerHp > prevStep.playerHp) {
      showCombatHealEffect('player', 'hero', step.playerHp - prevStep.playerHp);
    }

    if (step.enemyHp < prevStep.enemyHp) {
      showCombatDamageEffect('enemy', 'hero', prevStep.enemyHp - step.enemyHp);
    } else if (step.enemyHp > prevStep.enemyHp) {
      showCombatHealEffect('enemy', 'hero', step.enemyHp - prevStep.enemyHp);
    }

    for (let i = 0; i < 6; i++) {
      const pPrev = prevStep.playerBoard ? prevStep.playerBoard[i] : null;
      const pNext = step.playerBoard ? step.playerBoard[i] : null;
      if (pPrev && pNext && pNext.currentLife < pPrev.currentLife) {
        showCombatDamageEffect('player', i, pPrev.currentLife - pNext.currentLife);
      } else if (pPrev && pNext && pNext.currentLife > pPrev.currentLife) {
        showCombatHealEffect('player', i, pNext.currentLife - pPrev.currentLife);
      }

      const ePrev = prevStep.enemyBoard ? prevStep.enemyBoard[i] : null;
      const eNext = step.enemyBoard ? step.enemyBoard[i] : null;
      if (ePrev && eNext && eNext.currentLife < ePrev.currentLife) {
        showCombatDamageEffect('enemy', i, ePrev.currentLife - eNext.currentLife);
      } else if (ePrev && eNext && eNext.currentLife > ePrev.currentLife) {
        showCombatHealEffect('enemy', i, eNext.currentLife - ePrev.currentLife);
      }
    }
  }

  if (step.action === 'creature') {
    sound.play('summon');
    if (step.targetSlot !== undefined) {
      const cardEl = document.querySelector(`.combat-board-slot[data-side="${step.side}"][data-slot-index="${step.targetSlot}"] .board-card`);
      if (cardEl) {
        cardEl.classList.add('card-summon-settle');
        setTimeout(() => cardEl.classList.remove('card-summon-settle'), 800);
      }
    }
  } else if (step.action === 'spell') {
    const spellCard = allCardsList.find((c: CardDef) => c.id === step.cardId || c.nameCn === step.cardName);
    if (spellCard) {
      void playSpellVFX(step.side, spellCard, step.targetSlot);
    } else {
      sound.play('flamewave');
    }
  } else if (step.action === 'attack_phase') {
    sound.play('attack');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 350);
    const attackingBoard = step.side === 'player' ? step.playerBoard : step.enemyBoard;
    attackingBoard?.forEach((c, sIdx) => {
      if (c && c.currentAttack > 0) {
        if (engine.onAttackLunge) engine.onAttackLunge(step.side, sIdx);
      }
    });
  }
}

function startWatchingReplay(replay: BattleReplay) {
  activeViewingReplay = replay;
  replayCurrentStepIdx = 0;
  isReplayAutoPlaying = false;
  showReplayModal = false;
  currentView = 'replay_viewer';

  sound.playBgm(getCombatBgmForCurrentBattle());

  engine.player.name = replay.playerName;
  engine.player.face = replay.playerFace;
  engine.enemy.name = replay.enemyName;
  engine.enemy.face = replay.enemyFace;
  engine.gameOver = false;
  engine.winner = null;

  applyReplayStep(0);
}

function stepReplayForward() {
  if (!activeViewingReplay || !activeViewingReplay.steps) return;
  if (replayCurrentStepIdx < activeViewingReplay.steps.length - 1) {
    applyReplayStep(replayCurrentStepIdx + 1);
  } else {
    stopReplayAutoPlay();
  }
}

function startReplayAutoPlay() {
  isReplayAutoPlaying = true;
  if (replayPlaybackTimer) clearInterval(replayPlaybackTimer);
  const interval = Math.max(350, Math.floor(1400 / replayPlaybackSpeed));
  replayPlaybackTimer = setInterval(() => {
    stepReplayForward();
  }, interval);
  render();
}

function stopReplayAutoPlay() {
  isReplayAutoPlaying = false;
  if (replayPlaybackTimer) {
    clearInterval(replayPlaybackTimer);
    replayPlaybackTimer = null;
  }
  render();
}

function getNextOpponentForLeague(): any {
  const tourList = tournamentData as any[];
  if (!activeLeague) return tourList[0];
  const N = activeLeague.totalContestants || 10;
  const regMatches = N - 1;
  const schedule = (activeLeague.matchSchedule && activeLeague.matchSchedule.length > 0)
    ? activeLeague.matchSchedule
    : Array.from({ length: regMatches }, (_, i) => i % tourList.length);

  if (activeLeague.currentMatch <= regMatches) {
    const oppIdx = (activeLeague.currentMatch - 1) % schedule.length;
    const tourIdx = schedule[oppIdx];
    return tourList[tourIdx] || tourList[0];
  } else if (activeLeague.currentMatch === N) {
    // Semi-Finals
    const oppIdx = activeLeague.semiFinalOpponentIndex ?? schedule[0] ?? 0;
    return tourList[oppIdx] || tourList[0];
  } else {
    // Grand Final
    const oppIdx = activeLeague.finalOpponentIndex ?? schedule[1] ?? 1;
    return tourList[oppIdx] || tourList[1];
  }
}

function createNewLeagueProfile(name: string, faceId: number, classIdx: number, diffIdx: number, contestantCount = 10) {
  const tourList = tournamentData as any[];

  // Choose (contestantCount - 1) unique AI opponents from tournamentData
  const aiCount = contestantCount - 1;
  const pool = tourList.map((_, idx) => idx);
  const shuffledIndices: number[] = [];
  while (shuffledIndices.length < aiCount && pool.length > 0) {
    const r = Math.floor(Math.random() * pool.length);
    shuffledIndices.push(pool.splice(r, 1)[0]);
  }

  const selectedOpponents = shuffledIndices.map(idx => tourList[idx]);

  let resolvedLeagueClassIdx = classIdx;
  if (resolvedLeagueClassIdx === 0 || HERO_CLASSES[resolvedLeagueClassIdx]?.id === 'random') {
    resolvedLeagueClassIdx = Math.floor(Math.random() * (HERO_CLASSES.length - 1)) + 1;
  }
  const actualChosenClass = HERO_CLASSES[resolvedLeagueClassIdx] || HERO_CLASSES[1];

  const initialStandings: LeagueCompetitor[] = [
    {
      name: name.trim() || '玩家',
      face: `./faces/Face${faceId}.jpg`,
      className: actualChosenClass.id as HeroClass,
      classCn: actualChosenClass.nameCn,
      wins: 0,
      score: 0,
      isPlayer: true
    },
    ...selectedOpponents.map((t: any) => ({
      name: t.cnName,
      face: t.face,
      className: t.className,
      classCn: t.classCn,
      wins: 0,
      score: 0,
      isPlayer: false
    }))
  ];

  const totalMatches = aiCount + 2; // (N - 1) regular + 1 semi-final + 1 final

  const newProfile: LeagueState = {
    id: 'league_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    playerName: name.trim() || '玩家',
    playerFaceId: faceId,
    playerClassIdx: resolvedLeagueClassIdx,
    difficulty: leagueDifficulties[diffIdx] || '容易',
    totalContestants: contestantCount,
    currentMatch: 1,
    totalMatches,
    standings: initialStandings,
    matchSchedule: shuffledIndices,
    phase: 'regular',
    createdAt: new Date().toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  };

  leagueProfiles.unshift(newProfile);
  activeLeagueId = newProfile.id;
  activeLeague = newProfile;
  try {
    localStorage.setItem(LEAGUE_PROFILES_KEY, JSON.stringify(leagueProfiles));
    localStorage.setItem(LEAGUE_STATE_KEY, JSON.stringify(newProfile));
  } catch {}
}

function deleteLeagueProfile(id: string) {
  openCustomConfirm(
    '删除联赛角色',
    '确定要删除该英雄角色及其联赛进度吗？此操作无法撤销。',
    () => {
      leagueProfiles = leagueProfiles.filter(p => p.id !== id);
      if (activeLeagueId === id) {
        activeLeague = leagueProfiles[0] || null;
        activeLeagueId = activeLeague?.id || '';
      }
      try {
        localStorage.setItem(LEAGUE_PROFILES_KEY, JSON.stringify(leagueProfiles));
        if (activeLeague) {
          localStorage.setItem(LEAGUE_STATE_KEY, JSON.stringify(activeLeague));
        } else {
          localStorage.removeItem(LEAGUE_STATE_KEY);
        }
      } catch {}
      render();
    }
  );
}


function saveActiveLeague() {
  if (!activeLeague) return;
  const idx = leagueProfiles.findIndex(p => p.id === activeLeague!.id);
  if (idx !== -1) {
    leagueProfiles[idx] = activeLeague;
  } else {
    leagueProfiles.push(activeLeague);
  }
  try {
    localStorage.setItem(LEAGUE_PROFILES_KEY, JSON.stringify(leagueProfiles));
    localStorage.setItem(LEAGUE_STATE_KEY, JSON.stringify(activeLeague));
  } catch {}
}

function triggerBattleCompletion() {
  if (hasSavedCurrentBattleReplay) return;
  hasSavedCurrentBattleReplay = true;
  saveCompletedBattleReplay(engine, currentBattleSource);

  // If player won campaign, record and persist campaign progress immediately!
  if (currentBattleSource === 'campaign' && engine.winner === 'player') {
    recordCampaignVictory();
  }

  // Check achievements
  if (engine.winner === 'player') {
    checkAndUnlockAchievement('first_win');
    if (engine.player.hp <= 5 && engine.player.hp > 0) {
      checkAndUnlockAchievement('still_standing');
    }
    const myCreatures = engine.playerBoard.filter(c => c !== null).length;
    if (myCreatures >= 5) {
      checkAndUnlockAchievement('overrun');
    }
    if (battleReplays.length >= 3 && battleReplays.slice(0, 3).every(r => r.result === 'victory')) {
      checkAndUnlockAchievement('double_ace');
    }

    if (currentBattleSource === 'campaign') {
      if (selectedCampaignLevelId === 1) {
        checkAndUnlockAchievement('campaign_stage1');
      }
      if (completedCampaignLevels.length >= 3) {
        checkAndUnlockAchievement('campaign_branch');
      }
    } else if (currentBattleSource === 'league') {
      checkAndUnlockAchievement('league_win');
      if (activeLeague && activeLeague.currentMatch >= 8) {
        checkAndUnlockAchievement('league_champ');
      }
    } else if (currentBattleSource === 'custom_deck') {
      checkAndUnlockAchievement('custom_builder');
    }
  }

  // Check spell casts and summons from replay steps
  const lightningBoltCount = engine.replaySteps.filter(s => s.side === 'player' && s.cardId === 'air_lightning_bolt').length;
  if (lightningBoltCount >= 5) {
    checkAndUnlockAchievement('storm_lord');
  }
  const dragonCount = engine.replaySteps.filter(s => s.side === 'player' && s.cardId === 'fire_dragon').length;
  if (dragonCount >= 3) {
    checkAndUnlockAchievement('dragon_master');
  }
  const stoneRainCount = engine.replaySteps.filter(s => s.side === 'player' && s.cardId === 'earth_stone_rain').length;
  if (stoneRainCount >= 4) {
    checkAndUnlockAchievement('rock_is_strong');
  }
}


// ===================================
// BATTLE SAVE & RESUME SYSTEM
// ===================================
const SAVE_BATTLE_KEY = 'spectromancer_saved_battle_v2';

function showToastNotice(msg: string): void {
  const existing = document.querySelector('.game-toast-notice');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'game-toast-notice';
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 2200);
}

function saveCurrentBattle(): boolean {
  try {
    const battleData = {
      timestamp: Date.now(),
      battleSource: currentBattleSource,
      campaignProfileId: activeCampaign?.id || null,
      campaignLevelId: selectedCampaignLevelId || 1,
      leagueProfileId: activeLeague?.id || null,
      leagueMatch: activeLeague?.currentMatch || 1,
      engineState: {
        playerClass: engine.player.className,
        playerFace: engine.player.face,
        playerName: engine.player.name,
        playerHp: engine.player.hp,
        playerMana: engine.player.mana,
        playerSpecialElement: engine.player.specialElement,
        playerHand: engine.player.hand,
        enemyClass: engine.enemy.className,
        enemyFace: engine.enemy.face,
        enemyName: engine.enemy.name,
        enemyHp: engine.enemy.hp,
        enemyMana: engine.enemy.mana,
        enemySpecialElement: engine.enemy.specialElement,
        enemyHand: engine.enemy.hand,
        playerBoard: engine.playerBoard,
        enemyBoard: engine.enemyBoard,
        activeTurn: engine.activeTurn,
        turnCount: engine.turnCount,
        logs: engine.logs,
        enemyRevealedCardIds: Array.from(engine.enemyRevealedCardIds),
        gameOver: engine.gameOver,
        winner: engine.winner,
        leagueRule: engine.leagueRule,
        difficulty: engine.difficulty,
      },
      currentBattlefieldTheme,
    };
    localStorage.setItem(SAVE_BATTLE_KEY, JSON.stringify(battleData));
    return true;
  } catch (err) {
    console.error('Failed to save battle:', err);
    return false;
  }
}

function loadSavedBattle(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_BATTLE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const s = data.engineState;
    if (!s) return false;

    // Restore engine
    engine = new SpectromancerEngine(s.playerClass || 'sorcery');
    engine.player.name = s.playerName;
    engine.player.face = s.playerFace;
    engine.player.hp = s.playerHp;
    engine.player.mana = s.playerMana;
    engine.player.specialElement = s.playerSpecialElement;
    engine.player.className = s.playerClass;
    engine.player.hand = s.playerHand;

    engine.enemy.name = s.enemyName;
    engine.enemy.face = s.enemyFace;
    engine.enemy.hp = s.enemyHp;
    engine.enemy.mana = s.enemyMana;
    engine.enemy.specialElement = s.enemySpecialElement;
    engine.enemy.className = s.enemyClass;
    engine.enemy.hand = s.enemyHand;

    engine.playerBoard = s.playerBoard;
    engine.enemyBoard = s.enemyBoard;
    engine.activeTurn = s.activeTurn;
    engine.turnCount = s.turnCount;
    engine.logs = s.logs || [];
    engine.enemyRevealedCardIds = new Set(s.enemyRevealedCardIds || []);
    engine.gameOver = s.gameOver || false;
    engine.winner = s.winner || null;
    engine.leagueRule = s.leagueRule;
    engine.difficulty = s.difficulty || '普通';

    if (data.battleSource) {
      currentBattleSource = data.battleSource;
    }
    if (data.campaignLevelId) {
      selectedCampaignLevelId = data.campaignLevelId;
    }
    if (data.campaignProfileId) {
      const prof = campaignProfiles.find(p => p.id === data.campaignProfileId);
      if (prof) activeCampaign = prof;
    }
    if (data.leagueProfileId) {
      const l = leagueProfiles.find(p => p.id === data.leagueProfileId);
      if (l) {
        activeLeague = l;
        activeLeagueId = l.id;
      }
    }

    if (data.currentBattlefieldTheme) {
      currentBattlefieldTheme = data.currentBattlefieldTheme;
    }

    setupEngineCallbacks();
    selectedCard = null;
    inspectedCard = null;
    showOpponentHand = false;
    return true;
  } catch (err) {
    console.error('Failed to load saved battle:', err);
    return false;
  }
}

function getSavedBattleInfo(): any | null {
  try {
    const raw = localStorage.getItem(SAVE_BATTLE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data.engineState && !data.engineState.gameOver) {
      return data;
    }
  } catch {}
  return null;
}

function hasSavedCampaignBattle(profileId?: string): boolean {
  const data = getSavedBattleInfo();
  if (!data) return false;
  if (data.battleSource !== 'campaign') return false;
  if (profileId && data.campaignProfileId && data.campaignProfileId !== profileId) return false;
  return true;
}

function hasSavedLeagueBattle(profileId?: string): boolean {
  const data = getSavedBattleInfo();
  if (!data) return false;
  if (data.battleSource !== 'league') return false;
  if (profileId && data.leagueProfileId && data.leagueProfileId !== profileId) return false;
  return true;
}


// Start Menu Music on launch
sound.playBgm('menu1');

async function animateCardToSlot(
  who: 'player' | 'enemy',
  card: CardDef,
  targetSlot?: number
): Promise<void> {
  let sourceEl: HTMLElement | null = null;
  if (who === 'player') {
    sourceEl = document.querySelector(`.combat-hand-card-item[data-card-id="${card.id}"]`) || document.querySelector('.combat-hand-card-item.selected');
  } else {
    sourceEl = document.querySelector('.combat-hero-portrait-frame.top');
  }

  let sLeft = window.innerWidth * 0.5;
  let sTop = who === 'player' ? window.innerHeight * 0.85 : window.innerHeight * 0.15;
  let sWidth = 108;
  let sHeight = 98;

  if (sourceEl) {
    const sRect = sourceEl.getBoundingClientRect();
    if (sRect.width > 0 && sRect.height > 0) {
      if (who === 'enemy') {
        sWidth = 90;
        sHeight = 90;
        sLeft = sRect.left + sRect.width / 2 - sWidth / 2;
        sTop = sRect.top + sRect.height / 2 - sHeight / 2;
      } else {
        sLeft = sRect.left;
        sTop = sRect.top;
        sWidth = sRect.width;
        sHeight = sRect.height;
      }
    }
    sourceEl.classList.add('card-flying-out');
  }

  // ========================================================
  // 1. SPELL CARDS: Authentic "放大进入" (Big Spell Presentation)
  // ========================================================
  if (card.type === 'spell') {
    const arenaEl = document.querySelector('.combat-slots-arena') || document.querySelector('.combat-main-field') || document.querySelector('.combat-battlefield-section');
    const arenaRect = arenaEl ? arenaEl.getBoundingClientRect() : null;
    const targetCenterX = (arenaRect && arenaRect.width > 0) ? (arenaRect.left + arenaRect.width / 2) : (window.innerWidth * 0.5);
    const targetCenterY = (arenaRect && arenaRect.height > 0) ? (arenaRect.top + arenaRect.height / 2) : (window.innerHeight * 0.38);
    const bigCardW = 160;
    const bigCardH = 220;

    const spellShowcase = document.createElement('div');
    spellShowcase.className = `big-spell-presentation elem-${card.element}`;
    spellShowcase.style.position = 'fixed';
    spellShowcase.style.left = `${targetCenterX - bigCardW / 2}px`;
    spellShowcase.style.top = `${targetCenterY - bigCardH / 2}px`;
    spellShowcase.style.width = `${bigCardW}px`;
    spellShowcase.style.height = `${bigCardH}px`;
    spellShowcase.style.zIndex = '9999';
    spellShowcase.style.pointerEvents = 'none';

    spellShowcase.innerHTML = `
      <div class="big-spell-banner">
        <img src="./ui/vfx/usecardtextbar.png" class="banner-bg" alt="banner" />
        <span class="banner-text">${who === 'player' ? '施放法术' : '敌方施法'}：【${card.nameCn}】</span>
      </div>
      <div class="big-spell-frame elem-${card.element}">
        <img src="${toRel(card.imgBigUrl || card.imgUrl)}" class="big-spell-art" alt="${card.nameCn}" />
        <div class="big-spell-gem elem-${card.element}">${card.cost}</div>
        <div class="big-spell-title">${card.nameCn}</div>
      </div>
    `;

    document.body.appendChild(spellShowcase);

    // Dynamic flight from hand/avatar expanding to center showcase
    const sDeltaX = (sLeft + sWidth / 2) - targetCenterX;
    const sDeltaY = (sTop + sHeight / 2) - targetCenterY;

    try {
      const flyIn = spellShowcase.animate(
        [
          { transform: `translate(${sDeltaX}px, ${sDeltaY}px) scale(0.45)`, opacity: 0.2 },
          { transform: 'translate(0px, -15px) scale(1.15)', opacity: 1, offset: 0.65 },
          { transform: 'translate(0px, 0px) scale(1.0)', opacity: 1 }
        ],
        {
          duration: 480,
          easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.15)',
          fill: 'forwards'
        }
      );
      await flyIn.finished;
    } catch {}

    // Execute the spell visual effect on target/field
    let destEl: HTMLElement | null = null;
    const isFriendly = isFriendlyTargetSpell(card);
    const targetSide = isFriendly ? who : (who === 'player' ? 'enemy' : 'player');
    if (targetSlot !== undefined) {
      destEl = document.querySelector(`.combat-board-slot[data-side="${targetSide}"][data-slot-index="${targetSlot}"]`);
    }

    await playSpellVFX(who, card, targetSlot, destEl);

    // Smoothly dissolve the showcase card
    try {
      const fadeOut = spellShowcase.animate(
        [
          { transform: 'translate(0px, 0px) scale(1.0)', opacity: 1 },
          { transform: 'translate(0px, -20px) scale(1.15)', opacity: 0 }
        ],
        {
          duration: 380,
          easing: 'ease-in-out',
          fill: 'forwards'
        }
      );
      await fadeOut.finished;
    } catch {}
    spellShowcase.remove();

    if (sourceEl) {
      sourceEl.classList.remove('card-flying-out');
    }
    return;
  }

  // ========================================================
  // 2. CREATURE CARDS: Move into destination board slot
  // ========================================================
  let destEl: HTMLElement | null = null;
  if (targetSlot !== undefined) {
    destEl = document.querySelector(`.combat-board-slot[data-side="${who}"][data-slot-index="${targetSlot}"]`);
  }

  let dLeft = window.innerWidth * 0.5;
  let dTop = window.innerHeight * 0.35;
  let dWidth = 108;
  let dHeight = 98;

  if (destEl) {
    const dRect = destEl.getBoundingClientRect();
    if (dRect.width > 0 && dRect.height > 0) {
      dLeft = dRect.left;
      dTop = dRect.top;
      dWidth = dRect.width;
      dHeight = dRect.height;
    }
  }

  const cardImg = card.imgBigUrl || card.imgUrl;
  const ghost = document.createElement('div');
  ghost.className = `flying-card-ghost ${card.element}`;
  ghost.style.position = 'fixed';
  ghost.style.left = `${sLeft}px`;
  ghost.style.top = `${sTop}px`;
  ghost.style.width = `${sWidth}px`;
  ghost.style.height = `${sHeight}px`;
  ghost.style.zIndex = '9999';
  ghost.style.pointerEvents = 'none';

  ghost.innerHTML = `
    <div class="board-card vertical ${card.flying ? 'flying' : ''}">
      <img src="${toRel(cardImg)}" class="board-card-art" alt="${card.nameCn}" />
      <div class="card-cost-gem elem-${card.element}">${card.cost}</div>
      <div class="card-stat-atk" title="攻击力: ${formatCardAtk(card.attack)}">${formatCardAtk(card.attack)}</div>
      <div class="card-stat-hp" title="生命值: ${card.life}">${card.life}</div>
    </div>
  `;
  document.body.appendChild(ghost);

  const deltaX = (dLeft + dWidth / 2) - (sLeft + sWidth / 2);
  const deltaY = (dTop + dHeight / 2) - (sTop + sHeight / 2);
  const arcApexY = deltaY * 0.45 + (who === 'player' ? -55 : 45);
  const scaleX = sWidth > 0 ? (dWidth / sWidth) : 1;
  const scaleY = sHeight > 0 ? (dHeight / sHeight) : 1;

  try {
    const animation = ghost.animate(
      [
        { transform: 'translate(0px, 0px) scale(1, 1) rotate(0deg)', opacity: 0.95 },
        { transform: `translate(${deltaX * 0.45}px, ${arcApexY}px) scale(1.15, 1.15) rotate(${who === 'player' ? -6 : 6}deg)`, opacity: 1, offset: 0.42 },
        { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY}) rotate(0deg)`, opacity: 0.98 }
      ],
      {
        duration: 680,
        easing: 'cubic-bezier(0.22, 0.85, 0.32, 1)',
        fill: 'forwards'
      }
    );
    await animation.finished;
  } catch {} finally {
    ghost.remove();
  }

  if (destEl) {
    const ripple = document.createElement('div');
    ripple.className = `slot-summon-ripple ${card.element}`;
    destEl.appendChild(ripple);
    destEl.classList.add('slot-landing-flash');
    sound.play('summondrop');

    setTimeout(() => {
      ripple.remove();
      destEl?.classList.remove('slot-landing-flash');
    }, 650);
  } else {
    sound.play('summon');
  }

  if (sourceEl) {
    sourceEl.classList.remove('card-flying-out');
  }
}

// Helper: Draw authentic procedural branching lightning bolt onto canvas
function drawBranchingLightning(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  depth = 0
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(6, Math.floor(dist / 24));

  let curX = x1;
  let curY = y1;

  ctx.beginPath();
  ctx.moveTo(curX, curY);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    let nextX = x1 + dx * t;
    let nextY = y1 + dy * t;

    if (i < steps) {
      const perpX = -dy / dist;
      const perpY = dx / dist;
      const jitter = (Math.random() - 0.5) * (dist * 0.16) * (1 - Math.abs(t - 0.5) * 0.4);
      nextX += perpX * jitter;
      nextY += perpY * jitter;
    }

    ctx.lineTo(nextX, nextY);

    // Branch arcs
    if (depth < 2 && Math.random() < 0.3 && i > 1 && i < steps - 1) {
      const branchLen = dist * (0.2 + Math.random() * 0.25);
      const branchAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.3;
      const bx = nextX + Math.cos(branchAngle) * branchLen;
      const by = nextY + Math.sin(branchAngle) * branchLen;
      drawBranchingLightning(ctx, nextX, nextY, bx, by, depth + 1);
      ctx.moveTo(nextX, nextY);
    }

    curX = nextX;
    curY = nextY;
  }

  ctx.stroke();
}

// Render dynamic lightning strike from sky to target coordinates
async function triggerAuthenticLightning(
  targetX: number,
  targetY: number,
  layer: HTMLElement,
  startX?: number
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.className = 'vfx-lightning-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  layer.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  // Trigger screen flash
  const flash = document.createElement('div');
  flash.className = 'screen-flash-lightning';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 320);

  // Trigger screen shake
  app.classList.add('screen-shake');
  setTimeout(() => app.classList.remove('screen-shake'), 450);

  // Spawns impact burst (from lparts.png) at target
  const burst = document.createElement('div');
  burst.className = 'vfx-lparts-burst';
  burst.style.left = `${targetX}px`;
  burst.style.top = `${targetY}px`;
  layer.appendChild(burst);
  setTimeout(() => burst.remove(), 600);

  const originX = startX ?? (targetX + (Math.random() - 0.5) * 50);
  const originY = 0;

  try {
    // Animate 3 rapid crackling discharge frames without hardware shadowBlur (prevents x86 GPU shader crash)
    const frames = [
      { alpha: 1.0, width: 4.5 },
      { alpha: 0.85, width: 3.2 },
      { alpha: 0.45, width: 2.0 }
    ];

    for (const f of frames) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'bevel';

      // 1. Wide outer electric cyan haze
      ctx.strokeStyle = `rgba(56, 189, 248, ${f.alpha * 0.35})`;
      ctx.lineWidth = f.width * 3.6;
      drawBranchingLightning(ctx, originX, originY, targetX, targetY);

      // 2. Focused vibrant cyan core aura
      ctx.strokeStyle = `rgba(0, 208, 255, ${f.alpha * 0.85})`;
      ctx.lineWidth = f.width * 1.8;
      drawBranchingLightning(ctx, originX, originY, targetX, targetY);

      // 3. Inner blinding white lightning core
      ctx.strokeStyle = `rgba(255, 255, 255, ${f.alpha})`;
      ctx.lineWidth = f.width;
      drawBranchingLightning(ctx, originX, originY, targetX, targetY);

      ctx.restore();
      await new Promise((r) => setTimeout(r, 65));
    }
  } catch (err) {
    console.warn('Lightning animation warning:', err);
  } finally {
    canvas.remove();
  }
}

async function playSpellVFX(
  who: 'player' | 'enemy',
  card: CardDef,
  targetSlot?: number,
  destEl?: HTMLElement | null
): Promise<void> {
  const layer = spellFxLayer || document.getElementById('spell-fx-layer') || document.body;
  const oppSide = who === 'player' ? 'enemy' : 'player';
  const isFriendly = isFriendlyTargetSpell(card);
  let targetSide: 'player' | 'enemy' = isFriendly ? who : oppSide;
  // Cards that may target either side (Rescue Operation, beast abilities) have to resolve which
  // half of the board actually holds the chosen slot.
  if (card.targetType === 'any_creature' && targetSlot !== undefined) {
    const casterBoard = who === 'player' ? engine.playerBoard : engine.enemyBoard;
    if (!casterBoard[targetSlot]) targetSide = oppSide;
  }

  if (!destEl && targetSlot !== undefined) {
    destEl = document.querySelector(`.combat-board-slot[data-side="${targetSide}"][data-slot-index="${targetSlot}"]`);
  }

  let targetX = window.innerWidth * 0.5;
  let targetY = window.innerHeight * 0.35;
  if (destEl) {
    const r = destEl.getBoundingClientRect();
    targetX = r.left + r.width / 2;
    targetY = r.top + r.height / 2;
  }

  const spellId = card.id;

  // Helper to obtain center coordinates of hero portraits
  const getHeroPos = (side: 'player' | 'enemy') => {
    const el = document.querySelector(`.combat-hero-portrait-frame.${side === 'player' ? 'bottom' : 'top'}`) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, el };
    }
    return {
      x: window.innerWidth * 0.15,
      y: side === 'player' ? window.innerHeight * 0.75 : window.innerHeight * 0.22,
      el: null
    };
  };

  // ========================================================
  // 1. LIGHTNING / AIR SPELLS (Call to Thunder, Lightning Bolt, Chain Lightning)
  // ========================================================
  // Tornado (PC Sounds.ctl: tornado -> tornado.ogg). The PC has no dedicated sprite for it,
  // so it gets the generic swirling overlay instead of the lightning bolt one.
  if (spellId === 'air_tornado') {
    sound.play('tornado');
    const cyclone = document.createElement('div');
    cyclone.className = 'spell-vfx-arcane';
    cyclone.style.background = 'radial-gradient(circle at center, rgba(226, 232, 240, 0.85) 0%, rgba(148, 163, 184, 0.5) 40%, rgba(51, 65, 85, 0.25) 70%, transparent 85%)';
    layer.appendChild(cyclone);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 600);
    }

    await new Promise((r) => setTimeout(r, 850));
    cyclone.remove();
    return;
  }

  if (spellId === 'air_chain_lightning' || spellId === 'air_call_to_thunder' || spellId === 'air_lightning_bolt') {
    if (spellId === 'air_chain_lightning') {
      sound.play('chainlightning');

      // 1. Strike opposing hero first
      const oppHero = getHeroPos(oppSide);
      void triggerAuthenticLightning(oppHero.x, oppHero.y, layer);
      if (oppHero.el) {
        oppHero.el.classList.add('card-impact-hit');
        setTimeout(() => oppHero.el?.classList.remove('card-impact-hit'), 500);
      }

      // 2. Chain lightning jumps sequentially across enemy slots
      const enemySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`)) as HTMLElement[];
      for (let i = 0; i < enemySlots.length; i++) {
        const sEl = enemySlots[i];
        const sRect = sEl.getBoundingClientRect();
        const sX = sRect.left + sRect.width / 2;
        const sY = sRect.top + sRect.height / 2;

        void triggerAuthenticLightning(sX, sY, layer);
        sEl.classList.add('card-impact-hit');
        setTimeout(() => sEl.classList.remove('card-impact-hit'), 450);
        await new Promise((r) => setTimeout(r, 70));
      }

      await new Promise((r) => setTimeout(r, 600));
      return;
    } else if (spellId === 'air_call_to_thunder') {
      sound.play('calltothunder');

      // Authentic Call to Thunder: Strikes BOTH target creature and opposing hero simultaneously!
      const oppHero = getHeroPos(oppSide);
      void triggerAuthenticLightning(oppHero.x, oppHero.y, layer);
      if (oppHero.el) {
        oppHero.el.classList.add('card-impact-hit');
        setTimeout(() => oppHero.el?.classList.remove('card-impact-hit'), 500);
      }

      void triggerAuthenticLightning(targetX, targetY, layer);
      if (destEl) {
        destEl.classList.add('card-impact-hit');
        setTimeout(() => destEl?.classList.remove('card-impact-hit'), 500);
      }

      await new Promise((r) => setTimeout(r, 650));
      return;
    } else {
      // Single Lightning Bolt (落雷术 / 雷神之箭)
      sound.play('lightningbolt');
      await triggerAuthenticLightning(targetX, targetY, layer);
      if (destEl) {
        destEl.classList.add('card-impact-hit');
        setTimeout(() => destEl?.classList.remove('card-impact-hit'), 500);
      }
      await new Promise((r) => setTimeout(r, 550));
      return;
    }
  }

  // ========================================================
  // 2. FIRE SPELLS (Flame Wave, Inferno, Fireball, Hellfire, Explosion)
  // ========================================================
  if (spellId === 'fire_flame_wave') {
    sound.play('flamewave');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 550);

    const wave = document.createElement('div');
    wave.className = 'spell-vfx-flamewave';
    layer.appendChild(wave);

    const enemySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`)) as HTMLElement[];
    enemySlots.forEach((s) => {
      const pillar = document.createElement('div');
      pillar.className = 'vfx-slot-flame-pillar';
      s.appendChild(pillar);
      s.classList.add('card-impact-hit');
      setTimeout(() => {
        pillar.remove();
        s.classList.remove('card-impact-hit');
      }, 750);
    });

    await new Promise((r) => setTimeout(r, 780));
    wave.remove();
    return;
  }

  if (spellId === 'fire_inferno') {
    sound.play('inferno');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 650);

    const wave = document.createElement('div');
    wave.className = 'spell-vfx-flamewave';
    wave.style.background = 'radial-gradient(circle at center, rgba(239, 68, 68, 0.75) 0%, rgba(249, 115, 22, 0.45) 50%, transparent 85%)';
    layer.appendChild(wave);

    // Target + adjacent slots blast
    const slotsToHit = [targetSlot !== undefined ? targetSlot - 1 : -1, targetSlot ?? 2, targetSlot !== undefined ? targetSlot + 1 : -1];
    slotsToHit.forEach((sIdx) => {
      if (sIdx >= 0 && sIdx < 5) {
        const slotEl = document.querySelector(`.combat-board-slot[data-side="${oppSide}"][data-slot-index="${sIdx}"]`) as HTMLElement | null;
        if (slotEl) {
          const r = slotEl.getBoundingClientRect();
          const proj = document.createElement('div');
          proj.className = 'vfx-fireball-projectile';
          proj.style.left = `${r.left + r.width / 2}px`;
          proj.style.top = `${r.top + r.height / 2}px`;
          layer.appendChild(proj);
          slotEl.classList.add('card-impact-hit');
          setTimeout(() => {
            proj.remove();
            slotEl.classList.remove('card-impact-hit');
          }, 650);
        }
      }
    });

    await new Promise((r) => setTimeout(r, 800));
    wave.remove();
    return;
  }

  if (spellId === 'fire_armageddon') {
    sound.play('armageddon');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 800);

    const wave = document.createElement('div');
    wave.className = 'spell-vfx-flamewave';
    wave.style.background = 'radial-gradient(circle at center, rgba(220, 38, 38, 0.85) 0%, rgba(249, 115, 22, 0.55) 45%, rgba(120, 53, 15, 0.3) 70%, transparent 88%)';
    layer.appendChild(wave);

    const everySlot = Array.from(document.querySelectorAll('.combat-board-slot')) as HTMLElement[];
    everySlot.forEach((s) => {
      const pillar = document.createElement('div');
      pillar.className = 'vfx-slot-flame-pillar';
      s.appendChild(pillar);
      s.classList.add('card-impact-hit');
      setTimeout(() => {
        pillar.remove();
        s.classList.remove('card-impact-hit');
      }, 800);
    });

    const oppHero = getHeroPos(oppSide);
    if (oppHero.el) {
      oppHero.el.classList.add('card-impact-hit');
      setTimeout(() => oppHero.el?.classList.remove('card-impact-hit'), 800);
    }

    await new Promise((r) => setTimeout(r, 950));
    wave.remove();
    return;
  }

  if (spellId === 'spec_fireball' || spellId.includes('fireball')) {
    sound.play('fireball');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 450);

    const proj = document.createElement('div');
    proj.className = 'vfx-fireball-projectile';
    proj.style.left = `${targetX}px`;
    proj.style.top = `${targetY}px`;
    layer.appendChild(proj);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 600);
    }

    await new Promise((r) => setTimeout(r, 650));
    proj.remove();
    return;
  }

  if (spellId === 'demon_hellfire' || spellId.includes('hellfire')) {
    sound.play('hellfire');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 700);

    const allSlots = Array.from(document.querySelectorAll('.combat-board-slot')) as HTMLElement[];
    allSlots.forEach((s) => {
      const eruption = document.createElement('div');
      eruption.className = 'vfx-hellfire-eruption';
      s.appendChild(eruption);
      s.classList.add('card-impact-hit');
      setTimeout(() => {
        eruption.remove();
        s.classList.remove('card-impact-hit');
      }, 850);
    });

    await new Promise((r) => setTimeout(r, 850));
    return;
  }

  if (spellId === 'demon_explosion' || spellId.includes('explosion')) {
    sound.play('explosion');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 650);

    const boom = document.createElement('div');
    boom.className = 'vfx-demon-explosion';
    boom.style.left = `${targetX}px`;
    boom.style.top = `${targetY}px`;
    layer.appendChild(boom);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 600);
    }

    await new Promise((r) => setTimeout(r, 750));
    boom.remove();
    return;
  }

  // ========================================================
  // 3. WATER & ACID SPELLS (Meditation, Acidic Rain, Healing Spray)
  // ========================================================
  if (spellId === 'water_meditation' || spellId.includes('meditation')) {
    sound.play('meditation');

    const hero = getHeroPos(who);
    const ripple = document.createElement('div');
    ripple.className = 'vfx-meditation-ripple';
    ripple.style.left = `${hero.x}px`;
    ripple.style.top = `${hero.y}px`;
    layer.appendChild(ripple);

    await new Promise((r) => setTimeout(r, 900));
    ripple.remove();
    return;
  }

  if (spellId === 'water_acidic_rain' || spellId.includes('acid')) {
    sound.play('acidicrain');
    const acidScreen = document.createElement('div');
    acidScreen.className = 'spell-vfx-acidic';
    layer.appendChild(acidScreen);

    for (let i = 0; i < 18; i++) {
      const drop = document.createElement('div');
      drop.className = 'vfx-acid-drop';
      drop.style.left = `${window.innerWidth * (0.04 + Math.random() * 0.92)}px`;
      drop.style.animationDelay = `${Math.random() * 0.35}s`;
      layer.appendChild(drop);
      setTimeout(() => drop.remove(), 750);
    }

    const allSlots = document.querySelectorAll('.combat-board-slot');
    allSlots.forEach((s) => {
      s.classList.add('card-impact-hit');
      setTimeout(() => s.classList.remove('card-impact-hit'), 500);
    });

    await new Promise((r) => setTimeout(r, 850));
    acidScreen.remove();
    return;
  }

  if (spellId === 'spec_healing_spray' || spellId.includes('healing_spray')) {
    sound.play('healing_spray');
    const slotsToHit = [targetSlot !== undefined ? targetSlot - 1 : -1, targetSlot ?? 2, targetSlot !== undefined ? targetSlot + 1 : -1];
    slotsToHit.forEach((sIdx) => {
      if (sIdx >= 0 && sIdx < 5) {
        const slotEl = document.querySelector(`.combat-board-slot[data-side="${who}"][data-slot-index="${sIdx}"]`) as HTMLElement | null;
        if (slotEl) {
          const mist = document.createElement('div');
          mist.className = 'vfx-healing-spray-mist';
          slotEl.appendChild(mist);
          slotEl.classList.add('card-impact-hit');
          setTimeout(() => {
            mist.remove();
            slotEl.classList.remove('card-impact-hit');
          }, 950);
        }
      }
    });
    await new Promise((r) => setTimeout(r, 850));
    return;
  }

  // ========================================================
  // 4. EARTH SPELLS (Stone Rain, Nature's Ritual, Rejuvenation)
  // ========================================================
  if (spellId === 'earth_stone_rain' || spellId.includes('stone_rain')) {
    sound.play('stonerain');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 750);

    for (let i = 0; i < 9; i++) {
      setTimeout(() => {
        const rock = document.createElement('div');
        rock.className = 'vfx-falling-rock';
        rock.style.left = `${window.innerWidth * (0.12 + 0.09 * i + (Math.random() - 0.5) * 0.06)}px`;
        rock.style.setProperty('--target-top', `${window.innerHeight * (0.28 + Math.random() * 0.35)}px`);
        layer.appendChild(rock);
        setTimeout(() => rock.remove(), 650);
      }, i * 60);
    }

    const allSlots = document.querySelectorAll('.combat-board-slot');
    allSlots.forEach((s) => {
      s.classList.add('card-impact-hit');
      setTimeout(() => s.classList.remove('card-impact-hit'), 500);
    });

    await new Promise((r) => setTimeout(r, 900));
    return;
  }

  if (spellId === 'earth_rejuvenation' || spellId.includes('rejuvenation')) {
    sound.play('rejuvenation');
    const hero = getHeroPos(who);
    const aura = document.createElement('div');
    aura.className = 'vfx-rejuvenate-aura';
    aura.style.left = `${hero.x}px`;
    aura.style.top = `${hero.y}px`;
    layer.appendChild(aura);

    if (hero.el) {
      hero.el.classList.add('card-impact-hit');
      setTimeout(() => hero.el?.classList.remove('card-impact-hit'), 700);
    }

    await new Promise((r) => setTimeout(r, 900));
    aura.remove();
    return;
  }

  // Nature's Fury (PC Sounds.ctl: Natures_Fury -> naturalfury.ogg, vol=200)
  if (spellId === 'earth_natures_fury') {
    sound.play('naturalfury');

    // 1. Emerald flash & violent screen shake
    const flash = document.createElement('div');
    flash.className = 'screen-flash-nature';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 400);

    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 650);

    const oppHero = getHeroPos(oppSide);

    // 2. Roaring bear phantom spirit surging forward
    const bear = document.createElement('div');
    bear.className = 'vfx-nature-fury-bear';
    bear.style.left = `${oppHero.x}px`;
    bear.style.top = `${oppHero.y}px`;
    layer.appendChild(bear);

    // 3. Savage triple claw tear across opponent hero
    setTimeout(() => {
      const claw = document.createElement('div');
      claw.className = 'vfx-nature-fury-claw';
      claw.style.left = `${oppHero.x}px`;
      claw.style.top = `${oppHero.y}px`;
      layer.appendChild(claw);

      const burst = document.createElement('div');
      burst.className = 'vfx-nature-fury-burst';
      burst.style.left = `${oppHero.x}px`;
      burst.style.top = `${oppHero.y}px`;
      layer.appendChild(burst);

      if (oppHero.el) {
        oppHero.el.classList.add('card-impact-hit');
        setTimeout(() => oppHero.el?.classList.remove('card-impact-hit'), 600);
      }

      setTimeout(() => {
        claw.remove();
        burst.remove();
      }, 700);
    }, 200);

    await new Promise((r) => setTimeout(r, 950));
    bear.remove();
    return;
  }

  if (spellId === 'earth_natures_ritual') {
    sound.play('naturerit');
    const tree = document.createElement('div');
    tree.className = 'vfx-ritforest-tree';
    tree.style.left = `${targetX}px`;
    tree.style.top = `${targetY}px`;
    layer.appendChild(tree);

    if (destEl) {
      const shield = document.createElement('div');
      shield.className = 'vfx-shield-bubble';
      destEl.appendChild(shield);
      setTimeout(() => shield.remove(), 1000);
    }

    await new Promise((r) => setTimeout(r, 900));
    tree.remove();
    return;
  }

  // Ritual of the Forest (PC Sounds.ctl: Ritual_Of_The_Forest -> ritual_of_the_forest.ogg,
  // vol=50). The PC drives it with its own ritForest sprite, so the world tree grows out of the
  // caster's hero and out of every friendly slot while the whole line is warded.
  if (spellId === 'forest_ritual_of_the_forest') {
    sound.play('ritualoftheforest');

    const hero = getHeroPos(who);
    const heroTree = document.createElement('div');
    heroTree.className = 'vfx-ritforest-tree';
    heroTree.style.left = `${hero.x}px`;
    heroTree.style.top = `${hero.y}px`;
    layer.appendChild(heroTree);
    if (hero.el) {
      hero.el.classList.add('card-impact-hit');
      setTimeout(() => hero.el?.classList.remove('card-impact-hit'), 800);
    }

    const mySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${who}"]`)) as HTMLElement[];
    mySlots.forEach((s, i) => {
      setTimeout(() => {
        const r = s.getBoundingClientRect();
        const tree = document.createElement('div');
        tree.className = 'vfx-ritforest-tree';
        tree.style.left = `${r.left + r.width / 2}px`;
        tree.style.top = `${r.top + r.height / 2}px`;
        layer.appendChild(tree);
        const shield = document.createElement('div');
        shield.className = 'vfx-shield-bubble';
        s.appendChild(shield);
        setTimeout(() => {
          tree.remove();
          shield.remove();
        }, 900);
      }, i * 70);
    });

    await new Promise((r) => setTimeout(r, 1050));
    heroTree.remove();
    return;
  }

  // Golem's Frenzy / Golem's Justice (PC Sounds.ctl: Golems_Frenzy -> GolemsFrenzy.ogg,
  // Golems_Justice -> GolemsJustice.ogg). The champion Golem drives both spells with its stone
  // fist (Golem.tga), pulverising the opposing line — Justice then mends its own neighbours.
  if (spellId === 'golem_golems_frenzy' || spellId === 'golem_golems_justice') {
    const isJustice = spellId === 'golem_golems_justice';
    sound.play(isJustice ? 'golemsjustice' : 'golemsfrenzy');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 550);

    const casterBoard = who === 'player' ? engine.playerBoard : engine.enemyBoard;
    const golemSlot = casterBoard.findIndex((c) => c !== null && c.card.id === 'golem_golem');
    if (golemSlot !== -1) {
      const golemEl = document.querySelector(
        `.combat-board-slot[data-side="${who}"][data-slot-index="${golemSlot}"]`
      ) as HTMLElement | null;
      if (golemEl) {
        const gr = golemEl.getBoundingClientRect();
        const fist = document.createElement('div');
        fist.className = 'vfx-golem-smash';
        fist.style.left = `${gr.left + gr.width / 2}px`;
        fist.style.top = `${gr.top + gr.height / 2}px`;
        layer.appendChild(fist);
        golemEl.classList.add('card-impact-hit');
        setTimeout(() => {
          fist.remove();
          golemEl.classList.remove('card-impact-hit');
        }, 620);
      }
    }

    const enemySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`)) as HTMLElement[];
    enemySlots.forEach((s, i) => {
      setTimeout(() => {
        const sr = s.getBoundingClientRect();
        const burst = document.createElement('div');
        burst.className = 'vfx-wrath-burst';
        burst.style.left = `${sr.left + sr.width / 2}px`;
        burst.style.top = `${sr.top + sr.height / 2}px`;
        burst.style.filter = 'drop-shadow(0 0 18px #d6d3d1) brightness(1.5)';
        layer.appendChild(burst);
        s.classList.add('card-impact-hit');
        setTimeout(() => {
          burst.remove();
          s.classList.remove('card-impact-hit');
        }, 700);
      }, 120 + i * 60);
    });

    if (isJustice && golemSlot !== -1) {
      [golemSlot - 1, golemSlot + 1].forEach((nIdx, i) => {
        const el = document.querySelector(
          `.combat-board-slot[data-side="${who}"][data-slot-index="${nIdx}"]`
        ) as HTMLElement | null;
        if (!el) return;
        setTimeout(() => {
          const shield = document.createElement('div');
          shield.className = 'vfx-shield-bubble';
          el.appendChild(shield);
          setTimeout(() => shield.remove(), 1000);
        }, 320 + i * 90);
      });
    }

    await new Promise((r) => setTimeout(r, 1000));
    return;
  }

  // Army Upgrade (PC Sounds.ctl: Army_Upgrade -> ArmyUpgrade.ogg) — the whole line is refitted
  // while the champion Golem is permanently reinforced.
  if (spellId === 'golem_army_upgrade') {
    sound.play('armyupgrade');

    const mySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${who}"]`)) as HTMLElement[];
    mySlots.forEach((s, i) => {
      setTimeout(() => {
        const shield = document.createElement('div');
        shield.className = 'vfx-shield-bubble';
        shield.style.filter = 'drop-shadow(0 0 18px #fbbf24) drop-shadow(0 0 35px #f59e0b) brightness(1.4)';
        s.appendChild(shield);
        s.classList.add('card-impact-hit');
        setTimeout(() => {
          shield.remove();
          s.classList.remove('card-impact-hit');
        }, 900);
      }, i * 60);
    });

    const casterBoard = who === 'player' ? engine.playerBoard : engine.enemyBoard;
    const golemSlot = casterBoard.findIndex((c) => c !== null && c.card.id === 'golem_golem');
    if (golemSlot !== -1) {
      const golemEl = document.querySelector(
        `.combat-board-slot[data-side="${who}"][data-slot-index="${golemSlot}"]`
      ) as HTMLElement | null;
      if (golemEl) {
        setTimeout(() => {
          const gr = golemEl.getBoundingClientRect();
          const slam = document.createElement('div');
          slam.className = 'vfx-golem-smash';
          slam.style.left = `${gr.left + gr.width / 2}px`;
          slam.style.top = `${gr.top + gr.height / 2}px`;
          layer.appendChild(slam);
          setTimeout(() => slam.remove(), 620);
        }, 240);
      }
    }

    await new Promise((r) => setTimeout(r, 950));
    return;
  }

  // Call to Ancient Spirits (PC Sounds.ctl: Call_To_Ancient_Spirits -> AncientSpirits.ogg,
  // vol=60). Wrathful spirits sweep the whole board: the heavy pass hits the opposing line, the
  // lighter echo then washes over the caster's own creatures.
  if (spellId === 'cult_call_to_ancient_spirits') {
    sound.play('ancientspirits');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 500);

    const sweep = (side: 'player' | 'enemy', delay: number, bright: string) => {
      const slots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${side}"]`)) as HTMLElement[];
      slots.forEach((s, i) => {
        setTimeout(() => {
          const r = s.getBoundingClientRect();
          const spirit = document.createElement('div');
          spirit.className = 'vfx-spirits-apparition';
          spirit.style.left = `${r.left + r.width / 2}px`;
          spirit.style.top = `${r.top + r.height / 2}px`;
          spirit.style.filter = bright;
          layer.appendChild(spirit);
          s.classList.add('card-impact-hit');
          setTimeout(() => {
            spirit.remove();
            s.classList.remove('card-impact-hit');
          }, 800);
        }, delay + i * 75);
      });
    };

    sweep(oppSide, 0, 'drop-shadow(0 0 22px #a78bfa) brightness(1.5)');
    sweep(who, 340, 'drop-shadow(0 0 18px #7c3aed) brightness(0.85) opacity(0.85)');

    await new Promise((r) => setTimeout(r, 1100));
    return;
  }

  // Blood Boil (PC Sounds.ctl: Blood_Boil -> BloodBoil.ogg) — the caster's own blood erupts over
  // the opposing line.
  if (spellId === 'blood_blood_boil') {
    sound.play('bloodboil');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 450);

    const wave = document.createElement('div');
    wave.className = 'spell-vfx-flamewave';
    wave.style.background = 'radial-gradient(circle at center, rgba(220, 38, 38, 0.7) 0%, rgba(127, 29, 29, 0.5) 45%, rgba(69, 10, 10, 0.3) 70%, transparent 88%)';
    layer.appendChild(wave);

    const enemySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`)) as HTMLElement[];
    enemySlots.forEach((s, i) => {
      setTimeout(() => {
        const sr = s.getBoundingClientRect();
        const orb = document.createElement('div');
        orb.className = 'vfx-essence-drain-orb';
        orb.style.background = 'radial-gradient(circle, #fff 8%, #dc2626 48%, #7f1d1d 85%, transparent 100%)';
        orb.style.left = `${sr.left + sr.width / 2}px`;
        orb.style.top = `${sr.top + sr.height / 2}px`;
        orb.style.setProperty('--start-x', `${sr.left + sr.width / 2}px`);
        orb.style.setProperty('--start-y', `${sr.top + sr.height / 2}px`);
        orb.style.setProperty('--end-x', `${sr.left + sr.width / 2}px`);
        orb.style.setProperty('--end-y', `${sr.top + sr.height / 2}px`);
        layer.appendChild(orb);
        s.classList.add('card-impact-hit');
        setTimeout(() => {
          orb.remove();
          s.classList.remove('card-impact-hit');
        }, 700);
      }, i * 60);
    });

    await new Promise((r) => setTimeout(r, 850));
    wave.remove();
    return;
  }

  // ========================================================
  // 5. HOLY SPELLS (Divine Justice, Divine Intervention, Ritual of Glory)
  // ========================================================
  if (spellId === 'spec_ritual_of_glory' || spellId.includes('glory')) {
    sound.play('ritual_of_glory');
    const mySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${who}"]`)) as HTMLElement[];
    mySlots.forEach((s) => {
      const col = document.createElement('div');
      col.className = 'vfx-glory-column';
      s.appendChild(col);
      s.classList.add('card-impact-hit');
      setTimeout(() => {
        col.remove();
        s.classList.remove('card-impact-hit');
      }, 1000);
    });

    await new Promise((r) => setTimeout(r, 850));
    return;
  }

  if (spellId === 'holy_divine_intervention' || spellId.includes('intervention')) {
    sound.play('divineint');
    const hero = getHeroPos(who);
    if (hero.el) {
      // 1. Celestial golden beam descending upon the hero
      const beam = document.createElement('div');
      beam.className = 'vfx-divine-intervention-pillar';
      beam.style.left = `${hero.x}px`;
      layer.appendChild(beam);

      // 2. Radiant golden halo expanding from hero
      const halo = document.createElement('div');
      halo.className = 'vfx-divine-intervention-halo';
      halo.style.left = `${hero.x}px`;
      halo.style.top = `${hero.y}px`;
      layer.appendChild(halo);

      // 3. Four elemental mana orbs rising (+2 Fire, Water, Air, Earth)
      const colors = ['#f97316', '#38bdf8', '#facc15', '#4ade80'];
      const offsets = [-24, -8, 8, 24];
      colors.forEach((color, i) => {
        const orb = document.createElement('div');
        orb.className = 'vfx-mana-orb-rise';
        orb.style.backgroundColor = color;
        orb.style.boxShadow = `0 0 14px ${color}, 0 0 24px #fff`;
        orb.style.left = `${hero.x + offsets[i]}px`;
        orb.style.top = `${hero.y}px`;
        orb.style.setProperty('--dx', `${offsets[i] * 1.5}px`);
        layer.appendChild(orb);
        setTimeout(() => orb.remove(), 950);
      });

      // 4. Hero heal +10 visual feedback
      hero.el.classList.add('card-impact-hit');
      setTimeout(() => hero.el?.classList.remove('card-impact-hit'), 800);

      setTimeout(() => {
        beam.remove();
        halo.remove();
      }, 1050);
    }

    await new Promise((r) => setTimeout(r, 950));
    return;
  }

  if (spellId === 'holy_wrath_of_god' || spellId.includes('wrath_of_god')) {
    sound.play('wrathofgod');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 650);

    const enemySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`)) as HTMLElement[];
    enemySlots.forEach((s, i) => {
      setTimeout(() => {
        const sr = s.getBoundingClientRect();
        const col = document.createElement('div');
        col.className = 'vfx-wrath-column';
        col.style.left = `${sr.left + sr.width / 2}px`;
        layer.appendChild(col);

        const burst = document.createElement('div');
        burst.className = 'vfx-wrath-burst';
        burst.style.left = `${sr.left + sr.width / 2}px`;
        burst.style.top = `${sr.top + sr.height / 2}px`;
        layer.appendChild(burst);

        s.classList.add('card-impact-hit');
        setTimeout(() => {
          col.remove();
          burst.remove();
          s.classList.remove('card-impact-hit');
        }, 800);
      }, i * 75);
    });

    await new Promise((r) => setTimeout(r, 1000));
    return;
  }

  if (spellId.includes('divine') || spellId.includes('wrath') || card.element === 'holy') {
    const holySound = spellId.includes('divine_justice') ? 'divjustice'
      : spellId.includes('divine_meddling') ? 'divinemeddling'
      : spellId.includes('rage_of_god') ? 'rageofgod'
      : 'wrathofgod';
    sound.play(holySound);
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 450);

    const col = document.createElement('div');
    col.className = 'vfx-wrath-column';
    col.style.left = `${targetX}px`;
    layer.appendChild(col);

    const burst = document.createElement('div');
    burst.className = 'vfx-wrath-burst';
    burst.style.left = `${targetX}px`;
    burst.style.top = `${targetY}px`;
    layer.appendChild(burst);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 600);
    }

    await new Promise((r) => setTimeout(r, 850));
    col.remove();
    burst.remove();
    return;
  }

  // ========================================================
  // 6. SPECIAL / ARCANE SPELLS (Steal Essence, Mana Burn, Disintegrate)
  // ========================================================
  if (spellId === 'spec_steal_essence' || spellId.includes('steal_essence')) {
    sound.play('steal_essence');
    const hero = getHeroPos(who);

    const orb = document.createElement('div');
    orb.className = 'vfx-essence-drain-orb';
    orb.style.setProperty('--start-x', `${targetX}px`);
    orb.style.setProperty('--start-y', `${targetY}px`);
    orb.style.setProperty('--end-x', `${hero.x}px`);
    orb.style.setProperty('--end-y', `${hero.y}px`);
    layer.appendChild(orb);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 500);
    }

    await new Promise((r) => setTimeout(r, 780));
    orb.remove();
    if (hero.el) {
      hero.el.classList.add('card-impact-hit');
      setTimeout(() => hero.el?.classList.remove('card-impact-hit'), 400);
    }
    return;
  }

  if (spellId === 'spec_mana_burn' || spellId.includes('mana_burn')) {
    sound.play('mana_burn');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 450);

    const oppHero = getHeroPos(oppSide);
    const burst = document.createElement('div');
    burst.className = 'vfx-mana-burn-burst';
    burst.style.left = `${oppHero.x}px`;
    burst.style.top = `${oppHero.y}px`;
    layer.appendChild(burst);

    if (oppHero.el) {
      oppHero.el.classList.add('card-impact-hit');
      setTimeout(() => oppHero.el?.classList.remove('card-impact-hit'), 600);
    }

    await new Promise((r) => setTimeout(r, 750));
    burst.remove();
    return;
  }

  if (spellId === 'spec_disintegrate' || spellId.includes('disintegrate')) {
    sound.play('disintegrate');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 500);

    const ray = document.createElement('div');
    ray.className = 'vfx-disintegrate-ray';
    ray.style.left = `${targetX}px`;
    layer.appendChild(ray);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 600);
    }

    await new Promise((r) => setTimeout(r, 750));
    ray.remove();
    return;
  }

  // ========================================================
  // 7. DEATH SPELLS (Dark Ritual, Blood Ritual, Cursed Fog)
  // ========================================================
  if (spellId === 'death_dark_ritual' || spellId.includes('dark_ritual')) {
    sound.play('darkritual');
    const hero = getHeroPos(who);

    const apparition = document.createElement('div');
    apparition.className = 'vfx-spirits-apparition';
    apparition.style.left = `${hero.x}px`;
    apparition.style.top = `${hero.y}px`;
    layer.appendChild(apparition);

    if (hero.el) {
      hero.el.classList.add('card-impact-hit');
      setTimeout(() => hero.el?.classList.remove('card-impact-hit'), 500);
    }

    await new Promise((r) => setTimeout(r, 1100));
    apparition.remove();
    return;
  }

  if (spellId === 'death_blood_ritual' || spellId.includes('blood_ritual')) {
    sound.play('bloodritual');
    const hero = getHeroPos(who);

    const orb = document.createElement('div');
    orb.className = 'vfx-essence-drain-orb';
    orb.style.background = 'radial-gradient(circle, #fff 10%, #dc2626 50%, #7f1d1d 85%, transparent 100%)';
    orb.style.boxShadow = '0 0 30px #ef4444, 0 0 50px #b91c1c';
    orb.style.setProperty('--start-x', `${targetX}px`);
    orb.style.setProperty('--start-y', `${targetY}px`);
    orb.style.setProperty('--end-x', `${hero.x}px`);
    orb.style.setProperty('--end-y', `${hero.y}px`);
    layer.appendChild(orb);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 600);
    }

    await new Promise((r) => setTimeout(r, 850));
    orb.remove();
    return;
  }

  // Rage of Souls (PC Sounds.ctl: Rage_Of_Souls -> Rage_Of_Souls.ogg) — the spell Drain Souls
  // turns into; it strikes every opposing creature rather than the opposing hero.
  if (spellId === 'death_rage_of_souls') {
    sound.play('rage_of_souls');

    const enemySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`)) as HTMLElement[];
    enemySlots.forEach((s, i) => {
      setTimeout(() => {
        const r = s.getBoundingClientRect();
        const apparition = document.createElement('div');
        apparition.className = 'vfx-spirits-apparition';
        apparition.style.left = `${r.left + r.width / 2}px`;
        apparition.style.top = `${r.top + r.height / 2}px`;
        layer.appendChild(apparition);
        s.classList.add('card-impact-hit');
        setTimeout(() => {
          apparition.remove();
          s.classList.remove('card-impact-hit');
        }, 800);
      }, i * 90);
    });

    await new Promise((r) => setTimeout(r, 1000));
    return;
  }

  if (spellId === 'death_drain_souls' || spellId.includes('drain_soul')) {
    sound.play('drainsouls');
    const hero = getHeroPos(who);

    const apparition = document.createElement('div');
    apparition.className = 'vfx-spirits-apparition';
    apparition.style.left = `${targetX}px`;
    apparition.style.top = `${targetY}px`;
    layer.appendChild(apparition);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 600);
    }

    setTimeout(() => {
      const orb = document.createElement('div');
      orb.className = 'vfx-essence-drain-orb';
      orb.style.background = 'radial-gradient(circle, #fff 10%, #a855f7 45%, #581c87 85%, transparent 100%)';
      orb.style.boxShadow = '0 0 25px #c084fc, 0 0 45px #9333ea';
      orb.style.setProperty('--start-x', `${targetX}px`);
      orb.style.setProperty('--start-y', `${targetY}px`);
      orb.style.setProperty('--end-x', `${hero.x}px`);
      orb.style.setProperty('--end-y', `${hero.y}px`);
      layer.appendChild(orb);
      setTimeout(() => {
        orb.remove();
        if (hero.el) {
          hero.el.classList.add('card-impact-hit');
          setTimeout(() => hero.el?.classList.remove('card-impact-hit'), 500);
        }
      }, 750);
    }, 200);

    await new Promise((r) => setTimeout(r, 1050));
    apparition.remove();
    return;
  }

  if (spellId === 'death_cursed_fog' || spellId.includes('cursed_fog')) {
    sound.play('cursedfog');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 600);

    const fog = document.createElement('div');
    fog.className = 'spell-vfx-acidic';
    fog.style.background = 'radial-gradient(circle at center, rgba(88, 28, 135, 0.75) 0%, rgba(59, 7, 100, 0.55) 50%, transparent 85%)';
    layer.appendChild(fog);

    const enemySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`)) as HTMLElement[];
    enemySlots.forEach((s, i) => {
      setTimeout(() => {
        const sr = s.getBoundingClientRect();
        const apparition = document.createElement('div');
        apparition.className = 'vfx-spirits-apparition';
        apparition.style.left = `${sr.left + sr.width / 2}px`;
        apparition.style.top = `${sr.top + sr.height / 2}px`;
        layer.appendChild(apparition);
        s.classList.add('card-impact-hit');
        setTimeout(() => {
          apparition.remove();
          s.classList.remove('card-impact-hit');
        }, 700);
      }, i * 60);
    });

    const oppHero = getHeroPos(oppSide);
    if (oppHero.el) {
      setTimeout(() => {
        oppHero.el?.classList.add('card-impact-hit');
        setTimeout(() => oppHero.el?.classList.remove('card-impact-hit'), 500);
      }, 300);
    }

    await new Promise((r) => setTimeout(r, 1000));
    fog.remove();
    return;
  }

  if (card.element === 'death') {
    sound.play('drainsouls');
    const apparition = document.createElement('div');
    apparition.className = 'vfx-spirits-apparition';
    apparition.style.left = `${targetX}px`;
    apparition.style.top = `${targetY}px`;
    layer.appendChild(apparition);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 500);
    }
    await new Promise((r) => setTimeout(r, 1100));
    apparition.remove();
    return;
  }

  // ========================================================
  // 8. TIME SPELLS (Time Stop, Haste)
  // ========================================================
  if (spellId === 'time_hasten' || spellId.includes('hasten')) {
    sound.play('hasten');
    if (destEl) {
      const clock = document.createElement('div');
      clock.className = 'vfx-hasten-clock';
      destEl.appendChild(clock);
      setTimeout(() => clock.remove(), 900);
    }
    await new Promise((r) => setTimeout(r, 850));
    return;
  }

  if (spellId === 'time_time_stop') {
    sound.play('time_stop');
    const hourglass = document.createElement('div');
    hourglass.className = 'vfx-timestop-hourglass';
    layer.appendChild(hourglass);

    const wave = document.createElement('div');
    wave.className = 'vfx-timestop-wave';
    layer.appendChild(wave);

    await new Promise((r) => setTimeout(r, 1100));
    hourglass.remove();
    wave.remove();
    return;
  }

  // ========================================================
  // 9. CONTROL & ILLUSION (Weakness, Madness)
  // ========================================================
  if (spellId === 'illus_madness' || spellId.includes('madness')) {
    sound.play('madness');
    const spiral = document.createElement('div');
    spiral.className = 'vfx-madness-spiral';
    spiral.style.left = `${targetX}px`;
    spiral.style.top = `${targetY}px`;
    layer.appendChild(spiral);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 600);
    }

    await new Promise((r) => setTimeout(r, 850));
    spiral.remove();
    return;
  }

  // Hypnosis (PC Sounds.ctl: Hypnosis -> hypnosys.ogg) — the two strongest enemy creatures
  // turn on their own hero.
  if (spellId === 'illus_hypnosis') {
    sound.play('hypnosys');

    const charmed = (Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"] .board-card`)) as HTMLElement[])
      .slice(0, 2);
    charmed.forEach((el, i) => {
      setTimeout(() => {
        const spiral = document.createElement('div');
        spiral.className = 'vfx-madness-spiral';
        const r = el.getBoundingClientRect();
        spiral.style.left = `${r.left + r.width / 2}px`;
        spiral.style.top = `${r.top + r.height / 2}px`;
        layer.appendChild(spiral);
        el.classList.add('card-impact-hit');
        setTimeout(() => spiral.remove(), 850);
      }, i * 180);
    });

    const oppHero = getHeroPos(oppSide);
    setTimeout(() => {
      if (!oppHero.el) return;
      oppHero.el.classList.add('card-impact-hit');
      setTimeout(() => oppHero.el?.classList.remove('card-impact-hit'), 600);
    }, 260);

    await new Promise((r) => setTimeout(r, 1000));
    return;
  }

  // 10. BEAST SCORPION ACTIVATED ABILITY: VENOM SPRAY (毒蝎主动技能：毒液喷射)
  if (spellId === 'ability_beast_scorpion' || spellId === 'beast_scorpion' || spellId.includes('scorpion')) {
    sound.play('poison');
    const venomBurst = document.createElement('div');
    venomBurst.className = 'vfx-venom-spray-burst';
    venomBurst.style.left = `${targetX}px`;
    venomBurst.style.top = `${targetY}px`;
    layer.appendChild(venomBurst);

    for (let i = 0; i < 8; i++) {
      const drop = document.createElement('div');
      drop.className = 'vfx-venom-droplet';
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.4;
      const dist = 18 + Math.random() * 30;
      drop.style.left = `${targetX + Math.cos(angle) * dist}px`;
      drop.style.top = `${targetY + Math.sin(angle) * dist}px`;
      drop.style.animationDelay = `${Math.random() * 0.15}s`;
      layer.appendChild(drop);
      setTimeout(() => drop.remove(), 650);
    }

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 500);
    }

    await new Promise((r) => setTimeout(r, 680));
    venomBurst.remove();
    return;
  }

  // Poisonous Cloud (PC Sounds.ctl: Poisonous_Cloud -> poisoncloud.ogg)
  if (spellId === 'ctrl_poisonous_cloud') {
    sound.play('poisoncloud');

    const cloud = document.createElement('div');
    cloud.className = 'spell-vfx-acidic';
    layer.appendChild(cloud);

    for (let i = 0; i < 14; i++) {
      const drop = document.createElement('div');
      drop.className = 'vfx-acid-drop';
      drop.style.left = `${window.innerWidth * (0.04 + Math.random() * 0.92)}px`;
      drop.style.animationDelay = `${Math.random() * 0.35}s`;
      layer.appendChild(drop);
      setTimeout(() => drop.remove(), 750);
    }

    const enemySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`)) as HTMLElement[];
    enemySlots.forEach((s) => {
      s.classList.add('card-impact-hit');
      setTimeout(() => s.classList.remove('card-impact-hit'), 600);
    });

    await new Promise((r) => setTimeout(r, 950));
    cloud.remove();
    return;
  }

  if (spellId === 'ctrl_weakness' || spellId.includes('weakness')) {
    sound.play('weakness');
    const enemySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`)) as HTMLElement[];
    enemySlots.forEach((s) => {
      const r = s.getBoundingClientRect();
      const curse = document.createElement('div');
      curse.className = 'vfx-weakness-curse';
      curse.style.left = `${r.left + r.width / 2}px`;
      curse.style.top = `${r.top + r.height / 2}px`;
      layer.appendChild(curse);
      s.classList.add('card-impact-hit');
      setTimeout(() => {
        curse.remove();
        s.classList.remove('card-impact-hit');
      }, 750);
    });

    await new Promise((r) => setTimeout(r, 800));
    return;
  }

  // ========================================================
  // 10. GOBLIN SPELLS (Rescue Operation, Army of Rats)
  // ========================================================
  if (spellId === 'goblin_rescue_operation' || spellId.includes('rescue')) {
    sound.play('rescue_operation');
    if (destEl) {
      const lift = document.createElement('div');
      lift.className = 'vfx-rescue-lift';
      destEl.appendChild(lift);
      destEl.classList.add('card-impact-hit');
      setTimeout(() => {
        lift.remove();
        destEl?.classList.remove('card-impact-hit');
      }, 850);
    }
    await new Promise((r) => setTimeout(r, 850));
    return;
  }

  if (spellId.includes('rat')) {
    sound.play('army_of_rats');
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const rat = document.createElement('div');
        rat.className = 'vfx-rat-sprite';
        rat.style.setProperty('--start-x', `${-60}px`);
        rat.style.setProperty('--start-y', `${window.innerHeight * (0.25 + 0.08 * i)}px`);
        rat.style.setProperty('--end-x', `${window.innerWidth + 60}px`);
        rat.style.setProperty('--end-y', `${window.innerHeight * (0.28 + 0.08 * i)}px`);
        layer.appendChild(rat);
        setTimeout(() => rat.remove(), 800);
      }, i * 80);
    }

    const enemySlots = document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`);
    enemySlots.forEach((s) => {
      s.classList.add('card-impact-hit');
      setTimeout(() => s.classList.remove('card-impact-hit'), 600);
    });

    await new Promise((r) => setTimeout(r, 900));
    return;
  }

  // ========================================================
  // 10b. SORCERY EXTRAS (Sacrifice, Sonic Boom)
  // ========================================================
  if (spellId === 'special_sacrifice') {
    sound.play('sacrifice');

    if (destEl) {
      const slash = document.createElement('div');
      slash.className = 'vfx-slash-impact';
      destEl.appendChild(slash);
      destEl.classList.add('card-impact-hit');
      setTimeout(() => {
        slash.remove();
        destEl?.classList.remove('card-impact-hit');
      }, 600);
    }

    const hero = getHeroPos(who);
    if (hero.el) {
      const ward = document.createElement('div');
      ward.className = 'vfx-essence-drain-orb';
      ward.style.left = `${hero.x}px`;
      ward.style.top = `${hero.y}px`;
      layer.appendChild(ward);
      setTimeout(() => ward.remove(), 750);
    }

    await new Promise((r) => setTimeout(r, 850));
    return;
  }

  if (spellId === 'special_sonic_boom') {
    sound.play('sonic_boom');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 650);

    const shock = document.createElement('div');
    shock.className = 'spell-vfx-arcane';
    shock.style.background = 'radial-gradient(circle at center, rgba(224, 242, 254, 0.9) 0%, rgba(125, 211, 252, 0.55) 40%, rgba(14, 165, 233, 0.3) 65%, transparent 85%)';
    layer.appendChild(shock);

    const oppHero = getHeroPos(oppSide);
    if (oppHero.el) {
      oppHero.el.classList.add('card-impact-hit');
      setTimeout(() => oppHero.el?.classList.remove('card-impact-hit'), 650);
    }
    const enemySlots = document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`);
    enemySlots.forEach((s) => {
      const r = (s as HTMLElement).getBoundingClientRect();
      const ring = document.createElement('div');
      ring.className = 'vfx-wrath-burst';
      ring.style.left = `${r.left + r.width / 2}px`;
      ring.style.top = `${r.top + r.height / 2}px`;
      ring.style.filter = 'drop-shadow(0 0 25px #7dd3fc) brightness(2.2)';
      layer.appendChild(ring);
      s.classList.add('card-impact-hit');
      setTimeout(() => {
        ring.remove();
        s.classList.remove('card-impact-hit');
      }, 750);
    });

    await new Promise((r) => setTimeout(r, 950));
    shock.remove();
    return;
  }

  // ========================================================
  // 11. MECHANICS, CHAOS & DEMON POWER CHAINS
  // ========================================================
  // Overtime (PC Sounds.ctl: Overtime -> overtime.ogg, vol=40) — foundry energy surge at the caster
  if (spellId === 'mech_overtime') {
    sound.play('overtime');

    const hero = getHeroPos(who);
    const surge = document.createElement('div');
    surge.className = 'vfx-meditation-ripple';
    surge.style.left = `${hero.x}px`;
    surge.style.top = `${hero.y}px`;
    surge.style.filter = 'hue-rotate(160deg) brightness(1.4)';
    layer.appendChild(surge);

    await new Promise((r) => setTimeout(r, 900));
    surge.remove();
    return;
  }

  if (spellId === 'mech_cannonade') {
    sound.play('cannonade');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 650);

    const enemySlots = Array.from(document.querySelectorAll(`.combat-board-slot[data-side="${oppSide}"]`)) as HTMLElement[];
    for (let i = 0; i < enemySlots.length; i++) {
      const s = enemySlots[i];
      const r = s.getBoundingClientRect();
      const burst = document.createElement('div');
      burst.className = 'vfx-cannon-burst';
      burst.style.left = `${r.left + r.width / 2}px`;
      burst.style.top = `${r.top + r.height / 2}px`;
      layer.appendChild(burst);
      s.classList.add('card-impact-hit');
      setTimeout(() => {
        burst.remove();
        s.classList.remove('card-impact-hit');
      }, 550);
      await new Promise((r) => setTimeout(r, 70));
    }
    await new Promise((r) => setTimeout(r, 550));
    return;
  }

  if (spellId === 'chaos_doom_bolt') {
    sound.play('doombolt');
    app.classList.add('screen-shake');
    setTimeout(() => app.classList.remove('screen-shake'), 450);

    const beam = document.createElement('div');
    beam.className = 'vfx-doombolt-beam';
    beam.style.left = `${targetX - 8}px`;
    layer.appendChild(beam);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 500);
    }
    await new Promise((r) => setTimeout(r, 650));
    beam.remove();
    return;
  }

  if (spellId === 'chaos_wave') {
    sound.play('chaowave');
    const wave = document.createElement('div');
    wave.className = 'vfx-chaos-wave';
    layer.appendChild(wave);
    await new Promise((r) => setTimeout(r, 800));
    wave.remove();
    return;
  }

  if (spellId === 'demon_power_chains') {
    sound.play('power_chains');
    const chains = document.createElement('div');
    chains.className = 'vfx-power-chains';
    chains.style.left = `${targetX}px`;
    chains.style.top = `${targetY}px`;
    layer.appendChild(chains);

    if (destEl) {
      destEl.classList.add('card-impact-hit');
      setTimeout(() => destEl?.classList.remove('card-impact-hit'), 600);
    }
    await new Promise((r) => setTimeout(r, 800));
    chains.remove();
    return;
  }

  // Default fallback for any remaining spells. PC mirrors this: it fires Sound\Play\<CardName>
  // and silently does nothing when Sounds.ctl has no entry for that card.
  if (sound.has(card.id)) sound.play(card.id);
  app.classList.add('screen-shake');
  setTimeout(() => app.classList.remove('screen-shake'), 350);

  if (destEl) {
    destEl.classList.add('card-impact-hit');
    setTimeout(() => destEl?.classList.remove('card-impact-hit'), 500);
  }
  await new Promise((r) => setTimeout(r, 600));
}

function setupEngineCallbacks() {
  engine.onCardAnnouncement = async (who, card) => {
    if (showOptionsModal || showHelpModal || showRulesModal || showCombatLogsModal) {
      return;
    }
    aiAnnouncedCard = card;
    sound.play('showeff1');
    if (who === 'enemy' && !engine.isLanGame) {
      // 避免重复调用：若本回合大模型下棋决策已生成并展示了战意台词，坚决不发第二遍重复请求！
      if (!activeEnemyBanter) {
        const oppClassObj = HERO_CLASSES.find(c => c.id === engine.enemy.className);
        generateEnemyBanter(
          engine.enemy.name,
          oppClassObj?.nameCn || '法师',
          engine.enemy.hp,
          engine.player.hp,
          `打出【${card.nameCn}】`
        ).then((banter) => {
          if (banter && currentView === 'battle') {
            engine.log(`💬【${engine.enemy.name}】：“${banter}”`, 'heal');
            showEnemyBanter(banter, 5000);
          }
        }).catch((err) => {
          console.warn('[AI Banter] Failed:', err);
        });
      }
    }
    await new Promise<void>((resolve) => {
      let done = false;
      const t = setTimeout(() => {
        if (!done) {
          done = true;
          aiAnnouncedCard = null;
          render();
          resolve();
        }
      }, 1600);

      const dismiss = () => {
        if (!done) {
          done = true;
          clearTimeout(t);
          aiAnnouncedCard = null;
          render();
          window.removeEventListener('click', dismiss);
          window.removeEventListener('keydown', dismiss);
          resolve();
        }
      };

      setTimeout(() => {
        window.addEventListener('click', dismiss, { once: true });
        window.addEventListener('keydown', dismiss, { once: true });
      }, 120);
    });
  };

  engine.onCardEnterSlot = async (info) => {
    await animateCardToSlot(info.who, info.card, info.targetSlot);
  };

  // Creatures the engine places on its own (Mad Hermit's passive Magic Rabbit, the returning
  // Golem champion) never pass through the click path, so their arrival sprite is replayed here.
  engine.onCreatureAppear = (side, slotIndex, card) => {
    if (card.id !== 'forest_magic_rabbit' && card.id !== 'golem_golem') return;
    const slotEl = document.querySelector(
      `.combat-board-slot[data-side="${side}"][data-slot-index="${slotIndex}"]`
    ) as HTMLElement | null;
    if (!slotEl) return;
    const layer = spellFxLayer || document.getElementById('spell-fx-layer') || document.body;
    const r = slotEl.getBoundingClientRect();
    const fx = document.createElement('div');
    fx.className = card.id === 'golem_golem' ? 'vfx-golem-smash' : 'vfx-rabbits';
    fx.style.left = `${r.left + r.width / 2}px`;
    fx.style.top = `${r.top + r.height / 2}px`;
    layer.appendChild(fx);
    slotEl.classList.add('card-impact-hit');
    setTimeout(() => {
      fx.remove();
      slotEl.classList.remove('card-impact-hit');
    }, 950);
  };

  engine.onStateChange = () => render();

  engine.onAiBanter = (banter: string, who?: 'player' | 'enemy') => {
    if (banter && currentView === 'battle') {
      const speakerName = who === 'player' ? engine.player.name : engine.enemy.name;
      engine.log(`💬【${speakerName}】：“${banter}”`, 'heal');
      showEnemyBanter(banter, 4500, speakerName);
    }
  };

  engine.onDamageEffect = (side, slot, amount) => {
    let targetEl: HTMLElement | null = null;
    if (slot === 'hero') {
      targetEl = document.querySelector(`.combat-hero-portrait-frame.${side === 'player' ? 'bottom' : 'top'}`);
    } else {
      targetEl = document.querySelector(`.combat-board-slot[data-side="${side}"][data-slot-index="${slot}"]`);
    }

    if (targetEl && floatingLayer) {
      const rect = targetEl.getBoundingClientRect();
      const floatEl = document.createElement('div');
      floatEl.className = 'floating-combat-text damage';
      floatEl.innerText = `-${amount}`;
      floatEl.style.left = `${rect.left + rect.width / 2}px`;
      floatEl.style.top = `${rect.top + rect.height * 0.25}px`;
      floatingLayer.appendChild(floatEl);
      setTimeout(() => floatEl.remove(), 1000);
    }

    if (amount >= 12) {
      app.classList.add('screen-shake');
      setTimeout(() => app.classList.remove('screen-shake'), 350);
    }
  };

  engine.onHealEffect = (side, slot, amount) => {
    let targetEl: HTMLElement | null = null;
    if (slot === 'hero') {
      targetEl = document.querySelector(`.combat-hero-portrait-frame.${side === 'player' ? 'bottom' : 'top'}`);
    } else {
      targetEl = document.querySelector(`.combat-board-slot[data-side="${side}"][data-slot-index="${slot}"]`);
    }

    if (targetEl && floatingLayer) {
      const rect = targetEl.getBoundingClientRect();
      const floatEl = document.createElement('div');
      floatEl.className = 'floating-combat-text heal';
      floatEl.innerText = `+${amount}`;
      floatEl.style.left = `${rect.left + rect.width / 2}px`;
      floatEl.style.top = `${rect.top + rect.height * 0.25}px`;
      floatingLayer.appendChild(floatEl);
      setTimeout(() => floatEl.remove(), 1000);
    }
  };

  engine.onAttackLunge = (side, slot) => {
    sound.play('attack', 1.5);
    const cardEl = document.querySelector(`.combat-board-slot[data-side="${side}"][data-slot-index="${slot}"] .board-card`);
    if (cardEl) {
      const animClass = side === 'player' ? 'lungePlayer' : 'lungeEnemy';
      cardEl.classList.remove('lungePlayer', 'lungeEnemy');
      void (cardEl as HTMLElement).offsetWidth;
      cardEl.classList.add(animClass);
      setTimeout(() => cardEl.classList.remove(animClass), 600);
    }
  };

  engine.onCardImpact = (side, slot) => {
    let targetEl: HTMLElement | null = null;
    if (slot === 'hero') {
      targetEl = document.querySelector(`.combat-hero-portrait-frame.${side === 'player' ? 'bottom' : 'top'}`);
    } else {
      targetEl = document.querySelector(`.combat-board-slot[data-side="${side}"][data-slot-index="${slot}"]`);
    }
    if (targetEl) {
      targetEl.classList.add('card-impact-hit');
      const slash = document.createElement('div');
      slash.className = 'vfx-slash-impact';
      targetEl.appendChild(slash);
      setTimeout(() => {
        slash.remove();
        targetEl?.classList.remove('card-impact-hit');
      }, 420);
    }
  };

  // Trigger opening banter if AI is enabled
  if (!engine.isLanGame) {
    resetBattleBanterSession();
    if (banterTimer) {
      clearTimeout(banterTimer);
      banterTimer = null;
    }
    activeEnemyBanter = null;
    const oppClassObj = HERO_CLASSES.find(c => c.id === engine.enemy.className);
    setTimeout(() => {
      if (currentView === 'battle' && !engine.gameOver) {
        generateEnemyBanter(
          engine.enemy.name,
          oppClassObj?.nameCn || '法师',
          engine.enemy.hp,
          engine.player.hp,
          '对决开局挑衅'
        ).then((banter) => {
          if (banter && currentView === 'battle') {
            engine.log(`💬【${engine.enemy.name}】：“${banter}”`, 'heal');
            showEnemyBanter(banter, 4500);
          }
        }).catch(() => {});
      }
    }, 1200);
  }
}

setupEngineCallbacks();

// ==========================================
// RENDER VIEWS
// ==========================================

function renderMainMenu(): string {
  const hasSavedBattle = Boolean(localStorage.getItem(SAVE_BATTLE_KEY));
  return `
    <div class="main-menu-view">
      <!-- AMBIENT PARTICLES -->
      <div class="menu-ambient-layer">
        <div class="menu-particle p1"></div>
        <div class="menu-particle p2"></div>
        <div class="menu-particle p3"></div>
        <div class="menu-particle p4"></div>
      </div>

      <!-- TOP HEADER / BRANDING & UTILITY BAR -->
      <div class="mobile-menu-header">
        <div class="mobile-menu-brand">
          <img src="./ui/game_logo.svg" class="mobile-menu-logo" alt="元素秘境" />
        </div>

        <div class="mobile-menu-util-bar">
          <button class="menu-util-btn ${hasSavedBattle ? 'has-save-highlight' : ''}" id="btn-menu-load-save" title="${hasSavedBattle ? '读取并继续上次保存的对战进度' : '当前暂无对战存档'}">
            <span class="util-icon">💾</span>
            <span class="util-label">${hasSavedBattle ? '读取存档' : '暂无存档'}</span>
          </button>
          <button class="menu-util-btn" id="btn-menu-replays" title="对战录像与回放馆">
            <span class="util-icon">📼</span>
            <span class="util-label">对战回放</span>
          </button>
          <button class="menu-util-btn" id="btn-menu-achievements" title="达成成就一览">
            <span class="util-icon">🏆</span>
            <span class="util-label">荣誉成就</span>
          </button>
          <button class="menu-util-btn" id="btn-menu-help" title="游戏玩法与规则秘典">
            <span class="util-icon">📖</span>
            <span class="util-label">游戏帮助</span>
          </button>
          <button class="menu-util-btn" id="btn-menu-options" title="设置与音效">
            <span class="util-icon">⚙️</span>
            <span class="util-label">设置</span>
          </button>
        </div>
      </div>

      <!-- MAIN MODE TILES (ANDROID MOBILE TOUCH ERGONOMIC) -->
      <div class="mobile-menu-content">
        ${hasSavedBattle ? `
          <div class="saved-battle-quick-card" id="btn-resume-battle-banner">
            <div class="saved-card-glow-indicator"></div>
            <div class="saved-card-text">
              <div class="saved-card-title">⚡ 发现进行中的对战存档</div>
              <div class="saved-card-sub">点击立即载入历史战局并继续对决</div>
            </div>
            <button class="saved-card-btn" id="btn-resume-battle-action">继续对决 ▶</button>
          </div>
        ` : ''}
        <div class="mobile-mode-grid">
          <!-- 1. Single Duel (Primary Hero Tile) -->
          <div class="mobile-mode-card primary" id="btn-menu-single-duel">
            <div class="mode-card-badge">推荐对战</div>
            <div class="mode-card-icon-wrap">
              <span class="mode-card-icon">⚔️</span>
            </div>
            <div class="mode-card-body">
              <div class="mode-card-title">单局对战</div>
              <div class="mode-card-desc">自定义 15 大流派与 ${TOTAL_FACES} 款高清典藏头像，人机快速博弈</div>
            </div>
            <div class="mode-card-arrow">▶</div>
          </div>

          <!-- 2. Campaign Mode -->
          <div class="mobile-mode-card" id="btn-menu-campaign">
            <div class="mode-card-badge blue">史诗征程</div>
            <div class="mode-card-icon-wrap">
              <span class="mode-card-icon">🗺️</span>
            </div>
            <div class="mode-card-body">
              <div class="mode-card-title">战役模式</div>
              <div class="mode-card-desc">7 大篇章 · 65 关剧情挑战与领地首领讨伐</div>
            </div>
            <div class="mode-card-arrow">▶</div>
          </div>

          <!-- 3. League -->
          <div class="mobile-mode-card" id="btn-menu-league">
            <div class="mode-card-badge purple">联赛竞技</div>
            <div class="mode-card-icon-wrap">
              <span class="mode-card-icon">🏆</span>
            </div>
            <div class="mode-card-body">
              <div class="mode-card-title">英雄联赛</div>
              <div class="mode-card-desc">大师阶梯对抗，全职业大师切磋试炼</div>
            </div>
            <div class="mode-card-arrow">▶</div>
          </div>

          <!-- 4. Custom Deck / Cards -->
          <div class="mobile-mode-card" id="btn-menu-custom-deck">
            <div class="mode-card-badge green">全系卡牌</div>
            <div class="mode-card-icon-wrap">
              <span class="mode-card-icon">🎴</span>
            </div>
            <div class="mode-card-body">
              <div class="mode-card-title">自组卡组</div>
              <div class="mode-card-desc">查阅 233 张卡牌与特技秘典</div>
            </div>
            <div class="mode-card-arrow">▶</div>
          </div>

          <!-- 5. LAN Wireless Duel -->
          <div class="mobile-mode-card lan-duel" id="btn-menu-lan">
            <div class="mode-card-badge cyan">无线对决</div>
            <div class="mode-card-icon-wrap">
              <span class="mode-card-icon">🌐</span>
            </div>
            <div class="mode-card-body">
              <div class="mode-card-title">局域网对战</div>
              <div class="mode-card-desc">同一 Wi-Fi 或热点下 4 位房间码即时双人对决</div>
            </div>
            <div class="mode-card-arrow">▶</div>
          </div>

          <!-- 6. AI Peak Showdown (大模型巅峰对决) -->
          <div class="mobile-mode-card ai-duel" id="btn-menu-ai-duel">
            <div class="mode-card-badge purple">大模型AI</div>
            <div class="mode-card-icon-wrap" style="background:linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(0, 0, 0, 0.6) 100%); border-color:rgba(192, 132, 252, 0.6);">
              <span class="mode-card-icon">🔮</span>
            </div>
            <div class="mode-card-body">
              <div class="mode-card-title" style="color:#f3e8ff;">AI 巅峰对决</div>
              <div class="mode-card-desc">大模型心智博弈 · 支持玩家对决与双AI上帝观战</div>
            </div>
            <div class="mode-card-arrow" style="color:#d8b4fe;">▶</div>
          </div>
        </div>
      </div>

      <!-- FOOTER STATUS & VERSION -->
      <div class="mobile-menu-footer">
        <div class="menu-footer-left">
          <span class="footer-tip">💡 提示：在战斗中轻触任意卡牌或生物，可在羊皮纸中查看详尽战术技能</span>
        </div>
        <div class="menu-version-text">${APP_VERSION}</div>
      </div>
    </div>
  `;
}

function renderLanLobbyModal(): string {
  const currentRoomCode = lanNetwork.getRoomCode();
  const isHost = lanActiveTab === 'host';
  const isConnected = lanNetwork.isConnected();
  const peerProfile = lanNetwork.getPeerProfile();
  const currentClass = HERO_CLASSES[lanPlayerClassIdx] || HERO_CLASSES[1];
  const lanScenario = getCurrentLanScenario();
  const lanScenarioList = getLanSelectableScenarios();
  const relicPreview = getScenarioRelicIds(lanScenario).slice(0, 6)
    .map((id) => (cardsData as CardDef[]).find((c) => c.id === id))
    .filter((c): c is CardDef => !!c);

  return `
    <div class="modal-overlay" id="lan-lobby-modal-overlay">
      <div class="lan-lobby-dialog">
        <!-- HEADER -->
        <div class="lan-header-banner">
          <div class="lan-header-title-wrap">
            <span class="lan-header-icon">🌐</span>
            <div>
              <div class="lan-header-title">局域网对决 · 实时联机</div>
            </div>
            <span class="lan-header-badge">Wi-Fi / 热点直连</span>
          </div>
          <button class="modal-close-btn" id="btn-lan-lobby-close" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;" title="返回主菜单">×</button>
        </div>

        <!-- PROFILE CUSTOMIZATION BAR -->
        <div class="lan-profile-bar">
          <div class="lan-profile-face-wrap" id="btn-lan-cycle-face" title="点击切换英雄形象 (共${TOTAL_FACES}款)">
            <img src="./faces/Face${lanPlayerFaceId}.jpg" class="hero-avatar" alt="Avatar" />
            <div class="face-change-hint">换头像</div>
          </div>
          <div class="lan-profile-info">
            <div class="lan-profile-name-row">
              <input type="text" class="lan-profile-name-input" id="input-lan-player-name" value="${lanPlayerName}" maxlength="12" placeholder="输入玩家昵称" />
              <div class="lan-class-stepper">
                <button class="lan-class-step-btn" id="btn-lan-class-prev" title="上一个流派">◀</button>
                <button class="lan-class-display-btn" id="btn-lan-open-class-picker" title="点击展开全流派石板选择">
                  <img src="${toRel(currentClass.artImg)}" class="lan-class-avatar" alt="${currentClass.nameCn}" />
                  <span class="lan-class-name">${currentClass.nameCn}</span>
                  <span class="lan-class-badge-pill">切换</span>
                </button>
                <button class="lan-class-step-btn" id="btn-lan-class-next" title="下一个流派">▶</button>
              </div>
            </div>
            <div style="font-size:11px; color:#94a3b8;">
              当前形象: <strong>#${lanPlayerFaceId}</strong> · 流派: <strong style="color:#ffd700;">${currentClass.nameCn}</strong>（共 ${HERO_CLASSES.length - 1} 大流派及随机可选）
            </div>
            ${isHost ? `
            <div class="lan-class-stepper" style="margin-top:6px;">
              <button class="lan-class-step-btn" id="btn-lan-scene-prev" title="上一个战场场景">◀</button>
              <button class="lan-class-display-btn" id="btn-lan-scene-display" title="点击查看战场场景规则">
                <span style="font-size:16px;">${lanScenario.icon}</span>
                <span class="lan-class-name">${lanScenario.name}</span>
                <span class="lan-class-badge-pill">战场</span>
              </button>
              <button class="lan-class-step-btn" id="btn-lan-scene-next" title="下一个战场场景">▶</button>
            </div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">
              战场场景: <strong style="color:#7dd3fc;">${lanScenario.name}</strong>（共 ${lanScenarioList.length} 款，随房间同步给对手）
              ${relicPreview.length ? `<div style="margin-top:3px; display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                <span style="color:#fbbf24;">预置造物:</span>
                ${relicPreview.map((c) => `<img src="${toRel(c.imgUrl)}" title="${c.nameCn}" style="width:26px; height:36px; object-fit:contain; border-radius:4px; background:rgba(255,255,255,0.06);" />`).join('')}
              </div>` : ''}
            </div>
            ` : `
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">
              战场场景由房主选择，开局时自动同步
            </div>
            `}
          </div>
        </div>

        <!-- TAB STRIP -->
        <div class="lan-tab-strip">
          <button class="lan-tab-btn ${lanActiveTab === 'host' ? 'active' : ''}" id="btn-lan-tab-host">
            <span>👑 我要建房 (Host)</span>
          </button>
          <button class="lan-tab-btn ${lanActiveTab === 'join' ? 'active' : ''}" id="btn-lan-tab-join">
            <span>⚔️ 我要加入 (Join)</span>
          </button>
        </div>

        <!-- BODY -->
        <div class="lan-lobby-body">
          ${isHost ? `
            <!-- HOST PANEL -->
            <div class="lan-host-box">
              <div class="lan-code-title">
                <span>🔑 4 位局域网对决房间码</span>
              </div>
              <div class="lan-digit-display">
                ${currentRoomCode ? currentRoomCode.split('').map(d => `<div class="lan-digit-box">${d}</div>`).join('') : `
                  <div class="lan-digit-box placeholder">-</div>
                  <div class="lan-digit-box placeholder">-</div>
                  <div class="lan-digit-box placeholder">-</div>
                  <div class="lan-digit-box placeholder">-</div>
                `}
              </div>

              ${currentRoomCode ? `
                <div style="display:flex; gap:10px; align-items:center;">
                  <button class="lan-copy-btn" id="btn-lan-copy-code">
                    <span>📋 复制房间码</span>
                  </button>
                  <button class="lan-copy-btn" id="btn-lan-recreate-room" style="color:#cbd5e1; border-color:#64748b;">
                    <span>🔄 重新生成</span>
                  </button>
                </div>
              ` : `
                <button class="lan-action-btn primary" id="btn-lan-create-room">
                  <span>⚡ 立即生成房间码</span>
                </button>
              `}
            </div>

            <!-- STATUS OR PEER CARD -->
            ${isConnected && peerProfile ? `
              <div class="lan-peer-card">
                <img src="${peerProfile.face}" class="lan-peer-avatar" alt="${peerProfile.name}" />
                <div class="lan-peer-info">
                  <div class="lan-peer-name">${peerProfile.name}</div>
                  <div class="lan-peer-class">流派: ${peerProfile.classCn} · 已进入对战席位</div>
                </div>
                <div style="font-size:12px; color:#4ade80; font-weight:800;">● 已就绪</div>
              </div>
            ` : `
              <div class="lan-status-box">
                ${currentRoomCode ? `
                  <div class="lan-status-spinner"></div>
                  <div class="lan-status-text">${lanStatusText || '等待局域网内好友输入此 4 位房间码加入...'}</div>
                ` : `
                  <div class="lan-status-text" style="color:#94a3b8;">点击上方按钮创建房间，好友即可在同一 Wi-Fi 或热点下加入对决</div>
                `}
              </div>
            `}
          ` : `
            <!-- JOIN PANEL -->
            <div class="lan-host-box">
              <div class="lan-code-title">
                <span>🔢 请输入房主的 4 位房间码</span>
              </div>
              <div class="lan-digit-display">
                ${[0, 1, 2, 3].map(i => {
                  const digit = lanJoinCode[i] || '';
                  return `<div class="lan-digit-box ${digit ? '' : 'placeholder'}">${digit || '-'}</div>`;
                }).join('')}
              </div>
            </div>

            <!-- TOUCH NUMPAD -->
            <div class="lan-keypad">
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `
                <button class="lan-keypad-btn btn-lan-key" data-key="${n}">${n}</button>
              `).join('')}
              <button class="lan-keypad-btn action-btn btn-lan-key-clear">清空</button>
              <button class="lan-keypad-btn btn-lan-key" data-key="0">0</button>
              <button class="lan-keypad-btn action-btn btn-lan-key-backspace">⌫</button>
            </div>

            <div class="lan-status-box">
              ${lanIsConnecting ? `
                <div class="lan-status-spinner"></div>
                <div class="lan-status-text">${lanStatusText || '正在搜寻局域网对决房间...'}</div>
              ` : `
                <div class="lan-status-text" style="color:${lanStatusText.includes('失败') || lanStatusText.includes('超时') ? '#f87171' : '#94a3b8'};">
                  ${lanStatusText || '提示：双方需处于同一无线局域网 Wi-Fi 或手机热点下'}
                </div>
              `}
            </div>
          `}
        </div>

        <!-- ACTIONS FOOTER -->
        <div class="lan-actions-footer">
          <button class="lan-action-btn secondary" id="btn-lan-footer-cancel">返回</button>
          ${isHost ? `
            <button class="lan-action-btn primary" id="btn-lan-start-duel" ${!isConnected || !peerProfile ? 'disabled' : ''}>
              <span>⚔️ 开始对决 ▶</span>
            </button>
          ` : `
            <button class="lan-action-btn primary" id="btn-lan-join-action" ${lanJoinCode.length !== 4 || lanIsConnecting ? 'disabled' : ''}>
              <span>⚡ 立即加入房间</span>
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderLanVsOverlay(): string {
  if (!lanVsMatchData) return '';
  const { host, guest, countdown } = lanVsMatchData;
  return `
    <div class="lan-vs-overlay">
      <div class="lan-vs-container">
        <!-- HOST -->
        <div class="lan-vs-combatant">
          <div class="lan-vs-avatar-wrap">
            <img src="${host.face}" class="lan-vs-avatar" alt="${host.name}" />
          </div>
          <div class="lan-vs-name">${host.name}</div>
          <div class="lan-vs-class-badge">${host.classCn}</div>
        </div>

        <!-- LIGHTNING VS -->
        <div class="lan-vs-center">
          <div class="lan-vs-lightning">VS</div>
          <div class="lan-vs-countdown">对决构筑中... ${countdown}</div>
        </div>

        <!-- GUEST -->
        <div class="lan-vs-combatant">
          <div class="lan-vs-avatar-wrap">
            <img src="${guest.face}" class="lan-vs-avatar" alt="${guest.name}" />
          </div>
          <div class="lan-vs-name">${guest.name}</div>
          <div class="lan-vs-class-badge">${guest.classCn}</div>
        </div>
      </div>
      <div style="font-size:14px; color:#93c5fd; font-weight:700;">
        📶 局域网 P2P 通道建立成功 · 双方状态同步就绪
      </div>
    </div>
  `;
}

function renderLanDisconnectModal(): string {
  if (!showLanDisconnectModal) return '';
  return `
    <div class="modal-overlay" style="z-index: 999999;">
      <div class="stone-options-dialog" style="width:clamp(320px, 80vw, 480px); text-align:center; padding:24px;">
        <div style="font-size:48px; margin-bottom:12px;">📡</div>
        <div style="font-size:18px; font-weight:900; color:#ef4444; margin-bottom:8px;">局域网连接中断</div>
        <p style="font-size:14px; color:#cbd5e1; margin-bottom:20px; line-height:1.5;">
          ${lanDisconnectReason || '对方已退出游戏或网络信号中断。'}
        </p>
        <button class="lan-action-btn primary" id="btn-lan-disconnect-confirm" style="margin:0 auto;">
          <span>返回主菜单</span>
        </button>
      </div>
    </div>
  `;
}

function updateSingleDuelInPlace() {
  const overlay = document.getElementById('single-duel-overlay');
  if (!overlay) return;

  // 1. 难度就地刷新
  const diffEl = overlay.querySelector('.league-choice-val.diff');
  if (diffEl) diffEl.textContent = SINGLE_DUEL_DIFFICULTIES[singleDuelDifficultyIdx];

  // 2. 场景与造物法则就地刷新
  const allSc = getAllScenarios();
  const curScenario = pickScenarioById(allSc[singleDuelScenarioIdx]?.id || 'sanctuary');
  const sceneNameEl = overlay.querySelector('#duel-scene-val-display') || overlay.querySelector('#btn-duel-scene-prev + .league-choice-val');
  if (sceneNameEl) sceneNameEl.textContent = curScenario.name;
  const ruleEl = overlay.querySelector('.single-duel-rule-desc');
  if (ruleEl) ruleEl.innerHTML = `⚡ <strong>场景法则：</strong>${curScenario.rule}`;

  const relicContainer = overlay.querySelector('.single-duel-relics-container');
  const relicIds = getScenarioRelicIds(curScenario);
  if (relicContainer) {
    if (!relicIds.length) {
      relicContainer.innerHTML = '';
      (relicContainer as HTMLElement).style.display = 'none';
    } else {
      const relics = relicIds
        .map((id) => (cardsData as CardDef[]).find((c) => c.id === id))
        .filter((c): c is CardDef => !!c);
      (relicContainer as HTMLElement).style.display = 'flex';
      relicContainer.innerHTML = `
        <span style="font-size:11px; color:#fbbf24; font-weight:800;">🌈 预置造物（双方阵线）:</span>
        ${relics.map((c) => `<img src="${toRel(c.imgUrl)}" title="${c.nameCn}｜${c.desc}" style="width:30px; height:42px; object-fit:contain; border-radius:5px; background:rgba(255,255,255,0.07); cursor:help;" />`).join('')}
      `;
    }
  }

  // 3. 玩家头像与流派就地刷新
  const pFaceUrl = `./faces/Face${playerFaceIndex + 1}.jpg`;
  const pImg = overlay.querySelector('#btn-player-face-prev + .duel-avatar-wrap .duel-avatar-img') as HTMLImageElement;
  if (pImg) pImg.src = pFaceUrl;
  const pFaceInd = overlay.querySelector('#btn-player-face-prev + .duel-avatar-wrap .duel-face-indicator');
  if (pFaceInd) pFaceInd.textContent = `头像 ${playerFaceIndex + 1}/${TOTAL_FACES}`;

  const pClassObj = HERO_CLASSES[playerClassIndex];
  const pClassBadge = overlay.querySelector('#btn-player-class-pick');
  if (pClassBadge) {
    pClassBadge.innerHTML = `<img src="${toRel(pClassObj.artImg)}" class="duel-class-inline-img" alt="${pClassObj.nameCn}" /> ${pClassObj.nameCn}`;
  }
  const pClassDesc = overlay.querySelector('.duel-combatant-card:first-child .duel-class-desc');
  if (pClassDesc) pClassDesc.textContent = pClassObj.desc;

  // 4. AI 尊名、头像与流派就地刷新
  const aiChosenName = MASTER_OPPONENT_NAMES[singleDuelAiNameIdx % MASTER_OPPONENT_NAMES.length];
  const aiNameEl = overlay.querySelector('#duel-ai-name-val');
  if (aiNameEl) aiNameEl.textContent = aiChosenName;

  const aiFaceUrl = `./faces/Face${aiFaceIndex + 1}.jpg`;
  const aiImg = overlay.querySelector('#btn-ai-face-prev + .duel-avatar-wrap .duel-avatar-img') as HTMLImageElement;
  if (aiImg) aiImg.src = aiFaceUrl;
  const aiFaceInd = overlay.querySelector('#btn-ai-face-prev + .duel-avatar-wrap .duel-face-indicator');
  if (aiFaceInd) aiFaceInd.textContent = `头像 ${aiFaceIndex + 1}/${TOTAL_FACES}`;

  const aiClassObj = HERO_CLASSES[aiClassIndex];
  const aiClassBadge = overlay.querySelector('#btn-ai-class-pick');
  if (aiClassBadge) {
    aiClassBadge.innerHTML = `<img src="${toRel(aiClassObj.artImg)}" class="duel-class-inline-img" alt="${aiClassObj.nameCn}" /> ${aiClassObj.nameCn}`;
  }
  const aiClassDesc = overlay.querySelector('.duel-combatant-card:last-child .duel-class-desc');
  if (aiClassDesc) aiClassDesc.textContent = aiClassObj.desc;
}

function renderSingleDuelSetup(): string {
  const pClassObj = HERO_CLASSES[playerClassIndex];
  const aiClassObj = HERO_CLASSES[aiClassIndex];

  const pFaceUrl = `./faces/Face${playerFaceIndex + 1}.jpg`;
  const aiFaceUrl = `./faces/Face${aiFaceIndex + 1}.jpg`;
  const allSc = getAllScenarios();
  const curScenario = allSc[singleDuelScenarioIdx] || allSc[0];
  const curAiName = MASTER_OPPONENT_NAMES[singleDuelAiNameIdx % MASTER_OPPONENT_NAMES.length];
  const relicIds = getScenarioRelicIds(curScenario);
  const relics = relicIds
    .map((id) => (cardsData as CardDef[]).find((c) => c.id === id))
    .filter((c): c is CardDef => !!c);

  return `
    <div class="main-menu-view" style="filter: brightness(0.4) blur(4px);"></div>
    <div class="single-duel-overlay" id="single-duel-overlay">
      <div class="single-duel-frame">
        <div class="single-duel-title-banner">
          <div class="single-duel-title">单局对战 · 决斗设定</div>
          <button class="modal-close-btn" id="btn-close-duel" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;" title="关闭">×</button>
        </div>

        <!-- SETTINGS PANEL: DIFFICULTY & BATTLEFIELD SCENARIO (MOVED TO TOP) -->
        <div class="single-duel-settings-panel" style="margin-top:0; margin-bottom:6px;">
          <div class="single-duel-setting-row">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="single-duel-setting-label">⚔️ 难度:</span>
              <div class="league-choice-stepper" style="margin:0;">
                <button class="campaign-diff-btn" id="btn-duel-diff-prev">◀</button>
                <span class="league-choice-val diff" style="min-width:64px; text-align:center;">${SINGLE_DUEL_DIFFICULTIES[singleDuelDifficultyIdx]}</span>
                <button class="campaign-diff-btn" id="btn-duel-diff-next">▶</button>
              </div>
            </div>
            <div class="duel-scene-control-group">
              <span class="single-duel-setting-label">🗺️ 场景:</span>
              <div id="duel-scene-val-display" class="league-choice-val duel-scene-name-badge" title="点击展开场景图鉴选场">${curScenario.name}</div>
              <div class="duel-scene-btn-group">
                <button class="duel-stone-action-btn close" id="btn-duel-scene-grid" title="展开浏览所有战场场景与自定义场景">🗺️ 场景图鉴</button>
                <button class="duel-stone-action-btn start" id="btn-duel-scene-ai-create" title="✨ AI 场景工坊">✨ AI工坊</button>
              </div>
            </div>
          </div>
          <div class="single-duel-rule-desc">
            ⚡ <strong>场景法则：</strong>${curScenario.rule}
          </div>
          <div class="single-duel-relics-container" style="display: ${relicIds.length ? 'flex' : 'none'}; align-items:center; gap:8px; flex-wrap:wrap; padding:6px 10px; background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.25); border-radius:8px;">
            <span style="font-size:11px; color:#fbbf24; font-weight:800;">🌈 预置造物（双方阵线）:</span>
            ${relics.map((c) => `<img src="${toRel(c.imgUrl)}" title="${c.nameCn}｜${c.desc}" style="width:30px; height:42px; object-fit:contain; border-radius:5px; background:rgba(255,255,255,0.07); cursor:help;" />`).join('')}
          </div>
        </div>

        <div class="duel-combatants-row">
          <!-- PLAYER (玩家) -->
          <div class="duel-combatant-card">
            <div class="duel-name-plate">玩家</div>
            <div class="duel-avatar-picker">
              <button class="duel-arrow-btn" id="btn-player-face-prev" title="上一个头像">◀</button>
              <div class="duel-avatar-wrap">
                <img src="${pFaceUrl}" class="duel-avatar-img" alt="Player Face" />
                <div class="duel-face-indicator">头像 ${playerFaceIndex + 1}/${TOTAL_FACES}</div>
              </div>
              <button class="duel-arrow-btn" id="btn-player-face-next" title="下一个头像">▶</button>
            </div>
            <div class="duel-class-picker">
              <span class="duel-class-label">职业:</span>
              <button class="duel-mini-arrow" id="btn-player-class-prev">◀</button>
              <div class="duel-class-badge" id="btn-player-class-pick" title="点击切换职业">
                <img src="${toRel(pClassObj.artImg)}" class="duel-class-inline-img" alt="${pClassObj.nameCn}" /> ${pClassObj.nameCn}
              </div>
              <button class="duel-mini-arrow" id="btn-player-class-next">▶</button>
              <button class="duel-wrench-btn" id="btn-player-class-grid" title="打开职业列表">⚙</button>
            </div>
            <div class="duel-class-desc">${pClassObj.desc}</div>
          </div>

          <!-- CENTER VS DUEL ACTION ZONE -->
          <div class="duel-vs-center-col">
            <div class="duel-vs-emblem">VS</div>
            <button class="campaign-pc-btn start-btn duel-center-start-btn" id="btn-start-duel">
              ⚔ 开始对决
            </button>
          </div>

          <!-- AI (电脑魔导师) -->
          <div class="duel-combatant-card">
            <div class="duel-name-plate ai-name-plate-interactive" style="display:flex; align-items:center; justify-content:center; gap:6px;">
              <button class="duel-mini-arrow" id="btn-ai-name-prev" title="上一个魔导师尊名">◀</button>
              <span id="duel-ai-name-val" style="min-width:76px; text-align:center; font-weight:800; color:#ffd700; cursor:pointer;" title="点击切换对手魔导师尊名">${curAiName}</span>
              <button class="duel-mini-arrow" id="btn-ai-name-next" title="下一个魔导师尊名">▶</button>
            </div>
            <div class="duel-avatar-picker">
              <button class="duel-arrow-btn" id="btn-ai-face-prev" title="上一个头像">◀</button>
              <div class="duel-avatar-wrap">
                <img src="${aiFaceUrl}" class="duel-avatar-img" alt="AI Face" />
                <div class="duel-face-indicator">头像 ${aiFaceIndex + 1}/${TOTAL_FACES}</div>
              </div>
              <button class="duel-arrow-btn" id="btn-ai-face-next" title="下一个头像">▶</button>
            </div>
            <div class="duel-class-picker">
              <span class="duel-class-label">职业:</span>
              <button class="duel-mini-arrow" id="btn-ai-class-prev">◀</button>
              <div class="duel-class-badge" id="btn-ai-class-pick" title="点击切换职业">
                <img src="${toRel(aiClassObj.artImg)}" class="duel-class-inline-img" alt="${aiClassObj.nameCn}" /> ${aiClassObj.nameCn}
              </div>
              <button class="duel-mini-arrow" id="btn-ai-class-next">▶</button>
              <button class="duel-wrench-btn" id="btn-ai-class-grid" title="打开职业列表">⚙</button>
            </div>
            <div class="duel-class-desc">${aiClassObj.desc}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAiDuelSetupModal(): string {
  const allSc = getAllScenarios();
  const curScenario = allSc[aiDuelScenarioIdx] || allSc[0];
  const relicIds = getScenarioRelicIds(curScenario);
  const relics = relicIds
    .map((id) => (cardsData as CardDef[]).find((c) => c.id === id))
    .filter((c): c is CardDef => !!c);

  const ai1Name = MASTER_OPPONENT_NAMES[aiDuelAi1NameIdx % MASTER_OPPONENT_NAMES.length];
  const ai2Name = MASTER_OPPONENT_NAMES[aiDuelAi2NameIdx % MASTER_OPPONENT_NAMES.length];
  const aiCfg = getAiConfig();

  const pClassObj = HERO_CLASSES[aiDuelMode === 'human_vs_ai' ? playerClassIndex : aiDuelAi1ClassIdx] || HERO_CLASSES[1];
  const eClassObj = HERO_CLASSES[aiDuelAi2ClassIdx] || HERO_CLASSES[2];

  const leftFaceUrl = aiDuelMode === 'human_vs_ai' ? `./faces/Face${playerFaceIndex + 1}.jpg` : `./faces/Face${aiDuelAi1FaceIdx + 1}.jpg`;
  const rightFaceUrl = `./faces/Face${aiDuelAi2FaceIdx + 1}.jpg`;

  return `
    <div class="main-menu-view" style="filter: brightness(0.35) blur(6px);"></div>
    <div class="single-duel-overlay" id="ai-duel-overlay">
      <div class="single-duel-frame" style="border: 2px solid rgba(192, 132, 252, 0.7); box-shadow: 0 0 35px rgba(168, 85, 247, 0.35), 0 20px 60px rgba(0,0,0,0.9);">
        <div class="single-duel-title-banner" style="background: linear-gradient(180deg, #3b1d54 0%, #1c0e2b 100%); border-bottom: 2px solid #a855f7;">
          <div class="single-duel-title" style="color: #f3e8ff; display: flex; align-items: center; gap: 8px;">
            <span>🔮 AI 巅峰对决 · 神谕魔导师试炼</span>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(168,85,247,0.3); border: 1px solid #c084fc; color: #e9d5ff; white-space: nowrap; flex-shrink: 0;">大模型心智驱动</span>
          </div>
          <button class="modal-close-btn" id="btn-close-ai-duel" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;" title="返回主菜单">×</button>
        </div>

        <!-- AI SERVICE STATUS STRIP -->
        <div class="ai-duel-status-strip" style="background: ${aiCfg.enabled ? 'rgba(74, 222, 128, 0.12)' : 'rgba(239, 68, 68, 0.14)'}; border: 1px solid ${aiCfg.enabled ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.4)'}; border-radius: 8px; padding: 6px 14px; margin: 8px 14px 4px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: ${aiCfg.enabled ? '#86efac' : '#fca5a5'}; font-weight: 700;">
            <span>${aiCfg.enabled ? '🟢' : '🔴'}</span>
            <span>${aiCfg.enabled ? `大模型心智已激活 (${aiCfg.provider.toUpperCase()} · ${aiCfg.model})` : '大模型总开关当前处于关闭状态，无法开启对决'}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="duel-stone-action-btn ${aiCfg.enabled ? 'close' : 'start'}" id="btn-ai-duel-quick-toggle-ai" style="padding: 2px 10px; height: 26px; font-size: 11.5px;">
              ${aiCfg.enabled ? '⚙ 模型与模式设置' : '⚡ 开启大模型'}
            </button>
          </div>
        </div>

        <!-- TOP CONTROLS: MATCH MODE & DIFFICULTY & SCENARIO -->
        <div class="single-duel-settings-panel" style="margin: 8px 14px 6px; padding: 10px 14px;">
          <div class="single-duel-setting-row" style="gap: 12px; margin-bottom: 4px;">
            <!-- 1. 对战模式 -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="single-duel-setting-label">🎮 模式:</span>
              <div style="display: flex; gap: 4px;">
                <button class="duel-stone-action-btn ${aiDuelMode === 'human_vs_ai' ? 'start' : 'close'}" id="btn-ai-duel-mode-human" style="padding: 3px 8px; font-size: 12px; height: 30px;">
                  ⚔️ 人机博弈
                </button>
                <button class="duel-stone-action-btn ${aiDuelMode === 'ai_vs_ai' ? 'start' : 'close'}" id="btn-ai-duel-mode-spectator" style="padding: 3px 8px; font-size: 12px; height: 30px; color: #fef08a;">
                  👁️ 神谕观战
                </button>
              </div>
            </div>

            <!-- 2. AI 智力与算力 -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="single-duel-setting-label">⚡ AI智力:</span>
              <div class="league-choice-stepper" style="margin:0;">
                <button class="campaign-diff-btn" id="btn-ai-duel-diff-prev">◀</button>
                <span class="league-choice-val diff" id="ai-duel-diff-val" style="min-width:64px; text-align:center;">${SINGLE_DUEL_DIFFICULTIES[aiDuelDifficultyIdx]}</span>
                <button class="campaign-diff-btn" id="btn-ai-duel-diff-next">▶</button>
              </div>
            </div>
          </div>

          <!-- 3. 战场场景与场景工坊 -->
          <div class="single-duel-setting-row" style="margin-bottom: 2px;">
            <div class="duel-scene-control-group" style="width: 100%;">
              <span class="single-duel-setting-label">🗺️ 场景:</span>
              <div id="ai-duel-scene-val" class="league-choice-val duel-scene-name-badge" title="点击展开场景图鉴选场">${curScenario.name}</div>
              <div class="duel-scene-btn-group">
                <button class="duel-stone-action-btn close" id="btn-ai-duel-scene-grid" title="展开浏览所有战场场景">🗺️ 场景图鉴</button>
                <button class="duel-stone-action-btn start" id="btn-ai-duel-scene-ai-create" title="✨ AI 场景工坊">✨ AI工坊</button>
              </div>
            </div>
          </div>

          <div class="single-duel-rule-desc" style="margin-top: 6px;">
            ⚡ <strong>场景法则：</strong>${curScenario.rule}
          </div>
          <div class="single-duel-relics-container" style="display: ${relicIds.length ? 'flex' : 'none'}; align-items:center; gap:8px; flex-wrap:wrap; padding:4px 8px; background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.25); border-radius:6px; margin-top:4px;">
            <span style="font-size:11px; color:#fbbf24; font-weight:800;">🌈 阵线造物:</span>
            ${relics.map((c) => `<img src="${toRel(c.imgUrl)}" title="${c.nameCn}｜${c.desc}" style="width:26px; height:36px; object-fit:contain; border-radius:4px; background:rgba(255,255,255,0.07);" />`).join('')}
          </div>
        </div>

        <!-- COMBATANTS ROW -->
        <div class="duel-combatants-row" style="margin: 4px 14px 12px;">
          <!-- LEFT COMBATANT: PLAYER OR AI MASTER 1 -->
          <div class="duel-combatant-card" style="border-color: rgba(96, 165, 250, 0.5);">
            <div class="duel-name-plate" style="color: #93c5fd; display:flex; align-items:center; justify-content:center; gap:6px;">
              ${aiDuelMode === 'human_vs_ai' ? `
                <span>玩家 (挑战者)</span>
              ` : `
                <button class="duel-mini-arrow" id="btn-ai-duel-p1-name-prev">◀</button>
                <span style="min-width:76px; text-align:center; font-weight:800; color:#93c5fd;">${ai1Name}</span>
                <button class="duel-mini-arrow" id="btn-ai-duel-p1-name-next">▶</button>
              `}
            </div>
            <div class="duel-avatar-picker">
              <button class="duel-arrow-btn" id="btn-ai-duel-p1-face-prev">◀</button>
              <div class="duel-avatar-wrap">
                <img src="${leftFaceUrl}" class="duel-avatar-img" alt="Left Face" id="img-ai-duel-p1-face" />
                <div class="duel-face-indicator">头像 ${(aiDuelMode === 'human_vs_ai' ? playerFaceIndex : aiDuelAi1FaceIdx) + 1}/${TOTAL_FACES}</div>
              </div>
              <button class="duel-arrow-btn" id="btn-ai-duel-p1-face-next">▶</button>
            </div>
            <div class="duel-class-picker">
              <span class="duel-class-label">流派:</span>
              <button class="duel-mini-arrow" id="btn-ai-duel-p1-class-prev">◀</button>
              <div class="duel-class-badge" id="btn-ai-duel-p1-class-pick">
                <img src="${toRel(pClassObj.artImg)}" class="duel-class-inline-img" alt="${pClassObj.nameCn}" /> ${pClassObj.nameCn}
              </div>
              <button class="duel-mini-arrow" id="btn-ai-duel-p1-class-next">▶</button>
              <button class="duel-wrench-btn" id="btn-ai-duel-p1-class-grid" title="打开职业列表">⚙</button>
            </div>
            <div class="duel-class-desc">${pClassObj.desc}</div>
          </div>

          <!-- CENTER VS DUEL ACTION ZONE -->
          <div class="duel-vs-center-col">
            <div class="duel-vs-emblem" style="font-size: clamp(28px, 3.2vw, 44px); color: #c084fc; text-shadow: 0 0 15px rgba(192, 132, 252, 0.6);">VS</div>
            <button class="campaign-pc-btn start-btn duel-center-start-btn" id="btn-start-ai-duel-action" ${!aiCfg.enabled ? 'disabled style="background: linear-gradient(180deg, #4b5563 0%, #1f2937 100%) !important; border-color: #6b7280 !important; box-shadow: none !important; opacity: 0.6; cursor: not-allowed; color: #9ca3af !important;" title="大模型总开关当前处于关闭状态，无法开启对决。请先点击上方按钮开启大模型。"' : 'style="background: linear-gradient(180deg, #9333ea 0%, #6b21a8 100%); border-color: #d8b4fe; box-shadow: 0 0 20px rgba(147, 51, 234, 0.5);"'}>
              ${!aiCfg.enabled ? '🔒 需开启大模型 ▶' : (aiDuelMode === 'ai_vs_ai' ? '👁️ 开始神谕观战 ▶' : '⚡ 开启智脑对决 ▶')}
            </button>
          </div>

          <!-- RIGHT COMBATANT: AI MASTER 2 -->
          <div class="duel-combatant-card" style="border-color: rgba(248, 113, 113, 0.5);">
            <div class="duel-name-plate" style="color: #fca5a5; display:flex; align-items:center; justify-content:center; gap:6px;">
              <button class="duel-mini-arrow" id="btn-ai-duel-p2-name-prev">◀</button>
              <span style="min-width:76px; text-align:center; font-weight:800; color:#fca5a5;">${ai2Name}</span>
              <button class="duel-mini-arrow" id="btn-ai-duel-p2-name-next">▶</button>
            </div>
            <div class="duel-avatar-picker">
              <button class="duel-arrow-btn" id="btn-ai-duel-p2-face-prev">◀</button>
              <div class="duel-avatar-wrap">
                <img src="${rightFaceUrl}" class="duel-avatar-img" alt="Right Face" id="img-ai-duel-p2-face" />
                <div class="duel-face-indicator">头像 ${aiDuelAi2FaceIdx + 1}/${TOTAL_FACES}</div>
              </div>
              <button class="duel-arrow-btn" id="btn-ai-duel-p2-face-next">▶</button>
            </div>
            <div class="duel-class-picker">
              <span class="duel-class-label">流派:</span>
              <button class="duel-mini-arrow" id="btn-ai-duel-p2-class-prev">◀</button>
              <div class="duel-class-badge" id="btn-ai-duel-p2-class-pick">
                <img src="${toRel(eClassObj.artImg)}" class="duel-class-inline-img" alt="${eClassObj.nameCn}" /> ${eClassObj.nameCn}
              </div>
              <button class="duel-mini-arrow" id="btn-ai-duel-p2-class-next">▶</button>
              <button class="duel-wrench-btn" id="btn-ai-duel-p2-class-grid" title="打开职业列表">⚙</button>
            </div>
            <div class="duel-class-desc">${eClassObj.desc}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderClassGridPickerModal(target: 'player' | 'ai' | 'lan' | 'ai_duel_1' | 'ai_duel_2'): string {
  const currentIdx = target === 'player'
    ? playerClassIndex
    : (target === 'ai'
      ? aiClassIndex
      : (target === 'lan'
        ? lanPlayerClassIdx
        : (target === 'ai_duel_1' ? (aiDuelMode === 'human_vs_ai' ? playerClassIndex : aiDuelAi1ClassIdx) : aiDuelAi2ClassIdx)));
  const targetLabel = target === 'player'
    ? '玩家'
    : (target === 'ai'
      ? '电脑对手'
      : (target === 'lan'
        ? '局域网对决'
        : (target === 'ai_duel_1' ? (aiDuelMode === 'human_vs_ai' ? '玩家 (挑战者)' : 'AI 蓝方魔导') : 'AI 红方魔导')));
  return `
    <div class="class-grid-modal-overlay" id="class-grid-overlay">
      <div class="class-grid-card">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(198,155,63,0.3); padding-bottom:8px;">
          <h3 style="color:#ffd700; font-size:17px; font-weight:900;">选择【${targetLabel}】职业流派</h3>
          <button class="modal-close-btn" id="btn-close-class-grid" style="position:static; width:28px; height:28px;">×</button>
        </div>
        <div class="class-grid-list">
          ${HERO_CLASSES.map((cls, idx) => `
            <div class="class-grid-item ${currentIdx === idx ? 'active' : ''}" data-target="${target}" data-class-index="${idx}">
              <div class="class-grid-thumb-wrap">
                <img src="${toRel(cls.artImg)}" class="class-grid-thumb-img" alt="${cls.nameCn}" />
              </div>
              <div class="class-grid-name">${cls.nameCn}</div>
              <div style="font-size:10px; color:#cbd5e1; text-align:center; line-height:1.3;">${cls.desc.substring(0, 22)}...</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderScenarioGridPickerModal(): string {
  const allSc = getAllScenarios();
  const currentSelectedIdx = currentView === 'ai_duel_setup' ? aiDuelScenarioIdx : singleDuelScenarioIdx;

  return `
    <div class="class-grid-modal-overlay" id="scenario-grid-overlay">
      <div class="class-grid-card scenario-grid-modal-dialog" style="width:min(1080px, 94vw); height:min(88vh, 860px); max-height:90vh; display:flex; flex-direction:column; padding:18px 22px; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid rgba(198,155,63,0.35); padding-bottom:12px; margin-bottom:4px; flex-shrink:0;">
          <div style="display:flex; align-items:center; gap:14px;">
            <h3 style="color:#ffd700; font-size:20px; font-weight:900; margin:0; text-shadow:0 1px 4px #000;">🗺️ 战场场景与法则总览 (${allSc.length}个)</h3>
            <button class="duel-stone-action-btn start" id="btn-open-ai-creator-from-grid" style="padding:5px 16px; font-size:13.5px; color:#fef08a; display:inline-flex; align-items:center; gap:5px; box-shadow:0 2px 8px rgba(0,0,0,0.5);">
              <span>✨</span>
              <span>AI 场景造物</span>
            </button>
          </div>
          <button class="modal-close-btn" id="btn-close-scenario-grid" style="position:static; width:32px; height:32px; font-size:20px; cursor:pointer;" title="关闭">×</button>
        </div>

        <div class="scenario-grid-scroll-container" style="min-height:0; flex:1; overflow-y:scroll; overflow-x:hidden; display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:14px; padding:12px 6px 20px 2px; align-content:start;">
          ${allSc.map((sc, idx) => {
            const isCur = idx === currentSelectedIdx;
            const bgUrl = battlefieldBgs[sc.theme] || battlefieldBgs.citadel;
            const isCustom = sc.id.startsWith('custom_');
            return `
              <div class="scenario-grid-item ${isCur ? 'active' : ''} ${isCustom ? 'custom-scenario' : ''}" data-scenario-idx="${idx}" style="cursor:pointer; position:relative; background:linear-gradient(180deg, rgba(32,24,18,0.96) 0%, rgba(16,12,9,0.98) 100%); border:2px solid ${isCur ? '#ffd700' : (isCustom ? '#f59e0b' : '#6b4e33')}; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 6px 16px rgba(0,0,0,0.65); min-height:165px; box-sizing:border-box; flex-shrink:0;">
                <div style="height:56px; min-height:56px; background:url('${bgUrl}') center/cover no-repeat; position:relative; display:flex; align-items:center; padding:8px 12px; flex-shrink:0;">
                  <div style="position:absolute; inset:0; background:linear-gradient(0deg, rgba(16,12,9,0.92) 0%, rgba(0,0,0,0.3) 100%);"></div>
                  <div style="position:relative; z-index:2; display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div style="display:flex; align-items:center; gap:6px; min-width:0; padding-right:8px;">
                      <span style="font-weight:900; font-size:15.5px; color:#ffd700; text-shadow:0 1px 4px #000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sc.name}</span>
                      ${isCustom ? `<span style="font-size:10px; background:linear-gradient(135deg, #b45309 0%, #78350f 100%); color:#fef3c7; border:1px solid #f59e0b; padding:1px 6px; border-radius:4px; font-weight:900; flex-shrink:0;">玩家自创</span>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                      <span style="font-size:12px; font-weight:900; background:rgba(0,0,0,0.7); color:#fef08a; padding:3px 8px; border-radius:5px; border:1px solid #ca8a04; box-shadow:0 1px 3px rgba(0,0,0,0.5);">${sc.playerHp} HP</span>
                      ${isCustom ? `
                        <button class="btn-delete-custom-scenario top-delete-btn" data-scenario-id="${sc.id}" style="background:#dc2626; border:1.5px solid #f87171; color:#fff; font-size:12px; padding:3px 8px; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(220,38,38,0.6);" title="快速删除此自创场景">🗑️</button>
                      ` : ''}
                    </div>
                  </div>
                </div>
                <div style="padding:10px 12px 12px 12px; flex:1; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
                  <div style="font-size:13px; color:#e2e8f0; line-height:1.55; word-break:break-word;">${sc.rule}</div>
                  <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid rgba(198,155,63,0.2); margin-top:auto;">
                    <span style="font-size:12px; color:#d97706; font-weight:800;">🏛️ 主题: ${getThemeName(sc.theme)}</span>
                    ${isCustom ? `
                      <button class="btn-delete-custom-scenario" data-scenario-id="${sc.id}" style="background:linear-gradient(135deg, #dc2626 0%, #991b1b 100%); border:1.5px solid #ef4444; color:#ffffff; font-size:12.5px; font-weight:900; padding:4px 14px; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; box-shadow:0 2px 8px rgba(220,38,38,0.55); z-index:5;" title="永久删除此自创场景">
                        <span style="font-size:13px;">🗑️</span>
                        <span>删除场景</span>
                      </button>
                    ` : `<span style="font-size:11.5px; color:#78716c; font-style:italic;">内置秘境</span>`}
                  </div>
                </div>
                ${isCur ? `<div style="position:absolute; top:6px; right:6px; background:linear-gradient(135deg, #16a34a 0%, #15803d 100%); color:#fff; font-size:10.5px; font-weight:900; padding:2px 8px; border-radius:5px; z-index:4; box-shadow:0 2px 6px rgba(0,0,0,0.6); border:1px solid #4ade80;">当前选用</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderAiScenarioModal(): string {
  return `
    <div class="modal-overlay" id="ai-scenario-modal-overlay">
      <div class="stone-options-dialog ai-scenario-modal-dialog">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #3b0764 0%, #6b21a8 50%, #3b0764 100%); display:flex; justify-content:space-between; align-items:center; padding:10px 20px; flex-shrink:0;">
          <div class="options-title-text" style="color:#fef08a;">✨ AI 场景创世造物神殿</div>
          <button class="modal-close-btn" id="btn-close-ai-scenario" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;">×</button>
        </div>

        <div class="ai-scenario-modal-scroll" style="flex:1; min-height:0; overflow-y:auto; padding:clamp(12px, 1.8vh, 20px); display:flex; flex-direction:column; gap:12px;">
          <div class="ai-scenario-intro-tip" style="font-size:13px; color:#3b1e06; line-height:1.45; font-weight:700;">
            描述您心中的奇幻战场法则（例如环境背景、元素亲和、开局预置随从或生命值），大模型将为您自动构筑并在单局对战中即刻生效游玩！
          </div>

          <!-- Prompt Input -->
          <div style="display:flex; flex-direction:column; gap:5px;">
            <span style="font-size:12.5px; font-weight:900; color:#4a2810;">构想描述 / 提示词：</span>
            <textarea id="ai-scenario-prompt-input" rows="3" style="width:100%; box-sizing:border-box; background:rgba(255,255,255,0.96); border:2px solid #8e723a; border-radius:8px; padding:8px 10px; font-size:13.5px; font-weight:700; color:#180b02; resize:vertical;" placeholder="例如：极寒冰封王座之巅，寒风呼啸，双方开局各有一尊寒冰守卫护场，生命上限70，水系能量充沛...">${aiScenarioPromptInput}</textarea>
          </div>

          <!-- Quick Presets -->
          <div class="ai-scenario-presets-wrap" style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
            <span style="font-size:12.5px; font-weight:900; color:#4a2810;">灵感预设：</span>
            <button class="btn-ai-scene-preset" data-preset="冰雪极寒雪原，暴风雪呼啸，水系能量+2，双方槽位2预置【寒冰守卫】，生命值70">❄️ 极地冰封王座</button>
            <button class="btn-ai-scene-preset" data-preset="烈焰地心熔炉深渊，岩浆翻滚，火系能量+2，双方槽位0预置【火焰祭司】，生命值50">🌋 远古地心锻炉</button>
            <button class="btn-ai-scene-preset" data-preset="天界狂雷雷霆之巅，电闪雷鸣，气系能量+3，双方槽位3预置【狮鹫】，双方生命值60">⚡ 苍穹狂雷圣峰</button>
            <button class="btn-ai-scene-preset" data-preset="古老死者墓园，死气弥漫，暗影能量充沛，生命值55，开局预置亡灵随从">💀 幽冥凋零墓园</button>
          </div>

          <!-- Generate Action -->
          <div style="display:flex; justify-content:center; margin-top:2px;">
            <button class="campaign-pc-btn start-btn" id="btn-trigger-ai-scene-gen" style="padding:8px 30px; font-size:14.5px; font-weight:900;" ${aiScenarioLoading ? 'disabled' : ''}>
              ${aiScenarioLoading ? '⚡ 正在构思奇幻战场法则与造物数据...' : '🔮 召唤 AI 构筑场景'}
            </button>
          </div>

          <!-- Preview Card (if generated) -->
          ${aiScenarioPreview ? `
            <div style="border:2px solid #ca8a04; border-radius:10px; padding:12px; background:linear-gradient(180deg, #2e1065 0%, #1e1b4b 100%); display:flex; flex-direction:column; gap:8px; margin-top:6px; box-shadow:0 6px 18px rgba(0,0,0,0.7);">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(254,240,138,0.3); padding-bottom:6px;">
                <span style="font-size:17px; font-weight:900; color:#fde047;">${aiScenarioPreview.name}</span>
                <span style="font-size:12px; background:#431407; color:#fdba74; padding:2px 8px; border-radius:4px; font-weight:900;">${getThemeName(aiScenarioPreview.theme)} · 双方 ${aiScenarioPreview.playerHp} HP</span>
              </div>
              <div style="font-size:13.5px; color:#f1f5f9; line-height:1.5;">${aiScenarioPreview.rule}</div>
              <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:6px;">
                <button class="duel-stone-action-btn start" id="btn-save-ai-scene" style="padding:6px 20px; font-size:14px;">💾 保存并选用此场景</button>
                <button class="duel-stone-action-btn close" id="btn-discard-ai-scene" style="padding:6px 14px; font-size:13px;">放弃</button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderCodexPageContent(tab: string): string {
  switch (tab) {
    case 'deck':
      return `
        <div class="codex-section-card">
          <div class="codex-section-title">🃏 20张手牌严格构筑体系</div>
          <div class="codex-section-body">
            Spectromancer 采用严密的 20 张卡牌体系：<br>
            • <strong>四大基础元素：</strong> 火系 4 张、水系 4 张、气系 4 张、土系 4 张。<br>
            • <strong>专属流派法术：</strong> 当前职业专精系 4 张（战场造物不进入任何卡组，仅由战场场景预置）。<br>
            所有卡牌分为低阶（1-4费）、中阶（2-9费）、高阶（5-11费）与传奇（10-12费）梯度，确保不同阶段均有策略应对。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">⚖️ 核心卡牌平衡法则</div>
          <div class="codex-section-body">
            为保证决斗策略的绝对平衡，构筑遵循以下平衡准则：<br>
            1. <strong>基础成长卡牌唯一性：</strong> 【火焰祭司】、【人鱼长老】、【精灵隐士】这三张基础元素成长率+1的核心牌，全套卡组<strong>有且只能包含 1 张</strong>。<br>
            2. <strong>治疗卡牌区间：</strong> 基础元素治疗牌控制在 <strong>2 到 4 张</strong> 之间。<br>
            3. <strong>全场群伤限制：</strong> 强力群体清场牌（如【火焰波浪】、【连锁闪电】）全套卡组<strong>仅限 1 张</strong>。<br>
            4. <strong>直伤打击牌：</strong> 直接对英雄本体造成伤害的卡牌通常为 1~2 张。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">🔒 严格同系替换机制</div>
          <div class="codex-section-body">
            在自组卡组工坊中，卡牌替换必须遵循<strong>同系严格单卡替换</strong>规则，且同一卡组内严禁出现重复卡牌，彻底杜绝极端套牌失衡。
          </div>
        </div>
      `;

    case 'classes':
      return `
        <div class="codex-section-card">
          <div class="codex-section-title">✨ 六大经典法术专精 (Base Game)</div>
          <div class="codex-section-body">
            • <strong>🔮 巫术大师 (Sorcery)：</strong> 掌握纯粹奥术风暴、智力震撼与冥想，擅长直接法术伤害与强力单体控场。<br>
            • <strong>💀 死灵术士 (Necromancer)：</strong> 役使深渊亡骸、哀嚎女妖与吸血鬼领主，擅长牺牲献祭、亡者复苏与生命汲取。<br>
            • <strong>✨ 战争牧师 (Cleric)：</strong> 召唤神圣十字军、圣骑士与大天使，擅长神圣护盾、生命治愈与群体天谴审判。<br>
            • <strong>⚙️ 机械师 (Mechanician)：</strong> 部署矮人工匠、火枪手、扑翼轰炸机与重型蒸汽坦克，构筑钢铁阵地。<br>
            • <strong>👁️ 支配者 (Dominator)：</strong> 操纵心智奴役、萨满祭司与能量阻尼塔，削减敌方能量并反转战局。<br>
            • <strong>🌀 混沌大师 (Chaosmaster)：</strong> 操控混沌维和者、狂战士与混沌投石机，具备极高随机爆发与毁灭冲击力。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">👑 英雄联盟资料片专精 (League of Heroes)</div>
          <div class="codex-section-body">
            • <strong>🎭 幻术师 (Illusionist)：</strong> 构筑镜面反射之墙、幻像勇士与幽幻刺客，以虚实转换与反伤折磨对手。<br>
            • <strong>🔥 恶魔学者 (Demonologist)：</strong> 召唤深渊劣魔、恶果魔与末日大恶魔，精通自爆灼烧与恶魔契约。<br>
            • <strong>🐺 驯兽师 (Beastmaster)：</strong> 统领荒野群兽、魔法仓鼠、狼獾、死亡之隼与远古巨龙，掌控全属性野性灵能。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">⚡ 力量集结资料片专精 (Gathering of Power)</div>
          <div class="codex-section-body">
            • <strong>⏳ 时空术士 (Chronomancer)：</strong> 役使时空猎人、时间闪击者与时间之龙，甚至能施放【时间停止】获得额外连续行动回合！<br>
            • <strong>👺 地精幻术 (Goblin)：</strong> 率领哥布林英雄、爆破小队、鼠疫入侵与扰乱奇兵，具备灵活突袭与牌库削减奇效。<br>
            • <strong>🌳 森林召唤 (Forest)：</strong> 开局免费放置的【魔法兔子】会永久成长，暴怒海狸、复仇浣熊与森林仪式都以其攻击力结算收益。<br>
            • <strong>🗿 魔匠 (Golem)：</strong> 开局即有一只不受魔法与技能伤害的【魔像】，阵亡后会满血归位，军备升级与操纵师可永久堆高它的攻击力。<br>
            • <strong>🕯️ 狂热邪教 (Cult)：</strong> 狂怒纪念碑让全军每回合多攻击一次，狂热死士攻击力每回合 +2 永续成长，掠夺者既替全军承伤又能挡住对手的取巧打法。<br>
            • <strong>🩸 鲜血血族 (Blood)：</strong> 所有血族卡牌都是「能量 + 生命」双重付费，同费下数值远超常规：食尸鬼靠敌方尸体无限成长，审判者让对格生物承伤翻倍。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">🌈 特殊战场造物 (Battlefield Constructs)</div>
          <div class="codex-section-body">
            <strong>虹光造物不是第 16 个流派。</strong>它们没有专属牌库、不发牌、不可选为人物，也不进入任何自组卡组——它们是<strong>战场场景的组成部分</strong>：在单局对战、英雄联赛、局域网与战役中，由战场规则直接预置在阵线上。<br>
            • <strong>造物总数：</strong> 共 <strong>52 张</strong>（44 张可直接预置的造物 + 8 张由其他造物召唤的衍生物）。<br>
            • <strong>代表造物：</strong> 【火山】烧灼对位生物、【恶臭沼泽】持续腐蚀全场、【诅咒之地】死亡引爆、【和平之树】压制对手攻击、【行军石】每回合推进换位、三座祭坛把生物转化为能量、【魔法学院】【巨型橡树】【火焰神殿】每回合免费铺场、【至尊元素】在能量满溢时降临。<br>
            • <strong>如何体验：</strong> 在单局对战与局域网对战的「战场场景」中选择对应法则（如「🌋 火山熔炉」「🌳 和平之林」），英雄联赛会按场次自动轮换场景，战役关卡亦会在战规中预置造物。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">📜 流派与卡牌现状总览</div>
          <div class="codex-section-body">
            • <strong>可选流派：</strong> 共 <strong>15 大法术专精</strong>，选人界面另提供 1 项「🎲 随机」选项。<br>
            • <strong>卡牌总数：</strong> 基础四大元素 火系 12 张 / 水系 12 张 / 气系 13 张 / 土系 12 张（共 49 张）+ 15 大专精流派专属卡（共 125 张）+ 特殊战场造物（共 52 张）= <strong>全游戏共 233 张卡牌</strong>。<br>
            • <strong>重要说明：</strong> 战场造物只作为场景元素登场，永远不会出现在任何牌组中；卡组构筑与发牌池均已将其排除。
          </div>
        </div>
      `;

    case 'modes':
      return `
        <div class="codex-section-card">
          <div class="codex-section-title">🎮 丰厚多样的对战玩法</div>
          <div class="codex-section-body">
            1. <strong>单局对战 (Single Duel)：</strong> 自由配置 15 大流派与随机流派、精美英雄头像与 AI 难度，并在开局前挑选「战场场景」——特殊造物（火山、祭坛、行军石、魔法学院…）会作为战场规则预置在阵线上。<br>
            2. <strong>战役模式 (Campaign)：</strong> 踏上宏伟的元素大陆大地图，攻伐 7 大篇章领地据点；击败领主开启后续多重分支路线，体验各领地专属战规，部分关卡战规会预置特殊造物。<br>
            3. <strong>英雄联赛 (League of Heroes)：</strong> 支持创建多名法师角色档案，参与 8 轮天梯排位决战；每场联赛都会按赛程分配一个战场场景（含特殊造物场景），冲击巅峰积分榜首！<br>
            4. <strong>自组卡牌工坊 (Custom Deck)：</strong> 精细构筑专属 20 张王牌套牌，体验极致的套路搭配与战术博弈。<br>
            5. <strong>局域网对战 (LAN Duel)：</strong> 同一无线局域网或手机热点下，输入 4 位房间码即可实现低延迟跨设备双人实时联机对决！房主选择的战场场景会同步给双方。<br>
            6. <strong>对战录像回放 (Replay Cinema)：</strong> 全战场真实重现每一场高光交锋，支持分步单步推演与多倍速观摩！
          </div>
        </div>
      `;

    case 'cards': {
      const filterGroups = [
        { id: 'all', label: '全部' },
        { id: 'fire', label: '🔥 火系' },
        { id: 'water', label: '💧 水系' },
        { id: 'air', label: '⚡ 气系' },
        { id: 'earth', label: '🌿 土系' },
        { id: 'sorcery', label: '🔮 巫术' },
        { id: 'necromancer', label: '💀 死灵' },
        { id: 'cleric', label: '✨ 战争牧师' },
        { id: 'mechanician', label: '⚙️ 机械师' },
        { id: 'dominator', label: '👁️ 支配者' },
        { id: 'chaosmaster', label: '🌀 混沌大师' },
        { id: 'illusionist', label: '🎭 幻术师' },
        { id: 'demonologist', label: '😈 恶魔学者' },
        { id: 'beastmaster', label: '🐺 驯兽师' },
        { id: 'chronomancer', label: '⏳ 时空术士' },
        { id: 'goblin', label: '👺 地精' },
        { id: 'forest', label: '🌳 森林' },
        { id: 'golem', label: '🗿 魔匠' },
        { id: 'cult', label: '🕯️ 邪教' },
        { id: 'blood', label: '🩸 鲜血' },
        { id: 'spectromancer', label: '🌈 战场造物' },
      ];

      const filteredCards = allCardsList.filter(c => {
        if (codexCardFilter === 'all') return true;
        if (['fire', 'water', 'air', 'earth'].includes(codexCardFilter)) {
          return c.element === codexCardFilter;
        }
        return c.className === codexCardFilter;
      });

      const elementLabels: Record<string, string> = {
        fire: '火系',
        water: '水系',
        air: '气系',
        earth: '土系',
        special: '专属'
      };

      return `
        <div style="font-size:12px; color:#94a3b8; margin-bottom:8px;">
          共 ${allCardsList.length} 张卡牌：四大元素 49 张 · 15 大流派专属 125 张 · 🌈 特殊战场造物 ${getBattlefieldRelics().length} 张（仅由战场场景预置，不进入任何牌组）
        </div>
        <div class="codex-cards-filter-bar">
          ${filterGroups.map(fg => {
            const count = allCardsList.filter(c => {
              if (fg.id === 'all') return true;
              if (['fire', 'water', 'air', 'earth'].includes(fg.id)) return c.element === fg.id;
              return c.className === fg.id;
            }).length;
            const isActive = codexCardFilter === fg.id;
            return `
              <button class="codex-filter-btn ${isActive ? 'active' : ''}" data-filter="${fg.id}">
                ${fg.label} <span class="codex-filter-count">(${count})</span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="codex-cards-grid">
          ${filteredCards.map(c => {
            const elemBadgeName = c.battlefield
              ? '战场造物'
              : c.className
                ? (HERO_CLASSES.find(cls => cls.id === c.className)?.nameCn || '专属')
                : (elementLabels[c.element] || '基础');
            const typeBadgeName = c.isWall ? '城墙' : (c.type === 'creature' ? '生物' : '法术');
            return `
              <div class="codex-card-item">
                <div class="codex-card-thumb-wrap">
                  <img src="${toRel(c.imgUrl)}" class="codex-card-thumb ${c.type === 'spell' ? 'spell-art' : ''}" alt="${c.nameCn}" loading="lazy" />
                  <div class="codex-card-badge-cost" title="能量消耗: ${c.cost}">${c.cost}</div>
                  ${lifeCostBadge(c)}
                  ${c.type === 'creature' ? `
                    <div class="codex-card-badges-row">
                      <span class="codex-card-badge-atk" title="攻击力: ${formatCardAtk(c.attack)}">⚔️ ${formatCardAtk(c.attack)}</span>
                      <span class="codex-card-badge-life" title="生命值: ${c.life}">❤️ ${c.life}</span>
                    </div>
                  ` : ''}
                </div>
                <div class="codex-card-info">
                  <div class="codex-card-top-line">
                    <span class="codex-card-title">${c.nameCn}</span>
                    <span class="codex-card-subtitle">${c.name}</span>
                    <span class="codex-card-tag ${c.element}">${elemBadgeName} · ${typeBadgeName}</span>
                  </div>
                  <div class="codex-card-desc">${c.desc}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    default: // 'play'
      return `
        <div class="codex-section-card">
          <div class="codex-section-title">🔮 游戏核心目标与胜负判定</div>
          <div class="codex-section-body">
            在“魔导对决 (Spectromancer)”中，您将扮演一名操控万象元素的法师，通过召唤生物与施放魔法来与对手决斗。<br>
            双方英雄在开局时拥有 <strong>60 点生命值</strong>。战斗目标是率先将对手的生命削减至 <strong>0 点或以下</strong>，即可斩获对决胜利！
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">🌀 五大元素与能量增长体系</div>
          <div class="codex-section-body">
            每位法师在对战中能够调动 5 种魔法元素：<br>
            • <strong>火 (Fire)：</strong> 烈焰轰击、暴烈直接伤害与全场范围重创。<br>
            • <strong>水 (Water)：</strong> 冰霜护盾、虚弱寒冻、生命甘霖与战法再生。<br>
            • <strong>气 (Air)：</strong> 闪电穿刺、飞行奇袭、雷霆风暴与迅捷突袭。<br>
            • <strong>土 (Earth)：</strong> 磐石坚壁、毒素侵蚀、自然祈福与大地仪式。<br>
            • <strong>第五专精元素：</strong> 由您选择的英雄流派决定（如神圣、死亡、机械、控制、混沌等）。<br><br>
            <strong>能量机制：</strong> 先攻玩家初始能量总数为 21，后攻为 20；先攻回合结束后攻法师获得各系 +1 补充（共 +5 能量）。通常情况下，每回合开始时各系基础能量自然增长 +1 点。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">⚔️ 六大对位槽位与战线布局</div>
          <div class="codex-section-body">
            双方战场各自拥有 <strong>6 个生物战线槽位</strong>：<br>
            • 生物必须召唤在己方空闲槽位中。若所有 6 个槽位已满，则当前无法再召唤新生物，只能施放法术或跳过回合。<br>
            • 新召唤的生物通常需要待机一轮（具备【迅捷】特性的生物入场即可攻击）。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">⚔️ 战斗回合的四大阶段</div>
          <div class="codex-section-body">
            每个对战回合由四个严格阶段按序进行：<br>
            <strong>1. 获得能量阶段：</strong> 双方英雄各系基础元素自然增长 +1 点（部分法术或生物可提供额外成长率加成）。<br>
            <strong>2. 生物被动效果阶段：</strong> 战线生物的毒素衰减、自然再生、治疗英雄等光环与被动特技按序生效。<br>
            <strong>3. 玩家操作出牌阶段：</strong> 当前行动方根据各系剩余能量召唤生物或施放即时法术，亦可主动选择跳过出牌。<br>
            <strong>4. 生物攻击结算阶段：</strong> 己方阵线存活且具备攻击力的生物由左至右依次发动对位攻击！
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">📜 “从左到右”结算核心铁律</div>
          <div class="codex-section-body">
            这是 Spectromancer 判定一切生物攻击与法术伤害生效顺序的核心准则：<br>
            • 在生物攻击阶段，严格由<strong>左侧 1 号位至右侧 6 号位</strong>生物依次发动突袭。<br>
            • 施放群体伤害法术（如【石雨术】、【酸雨术】）时，优先对敌方从左至右结算，再对己方生物从左至右结算。<br>
            • 左侧生物先击破敌方生物后，后续友军不会遭到对应格挡。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">🎯 对位交锋与本体直击伤害</div>
          <div class="codex-section-body">
            • <strong>阵线格挡：</strong> 若所对格位有敌方生物，攻击力将直接扣减该生物生命值，生命降至 0 即战死离场。<br>
            • <strong>直穿本体：</strong> 若所对格位为空格（未被阻挡），生物将越过阵线直接打击敌方英雄本体生命！<br>
            • <strong>飞行特技：</strong> 拥有飞行特技的生物可无视地面阻挡生物，直接贯穿轰击敌方英雄！
          </div>
        </div>
      `;
  }
}

function renderGameHelpModal(): string {
  return `
    <div class="modal-overlay" id="game-help-modal-overlay">
      <div class="stone-options-dialog" style="width:clamp(660px, 75vw, 1020px); height:88vh; max-height:88vh; display:flex; flex-direction:column;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%); flex-shrink:0; display:flex; justify-content:space-between; align-items:center; padding:10px 20px;">
          <div class="options-title-text" style="color:#e0e7ff;">📖 游戏帮助 (Help)</div>
          <button class="modal-close-btn" id="btn-close-help" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;">×</button>
        </div>

        <!-- Chapter Navigation Tabs -->
        <div class="codex-tabs-bar" style="flex-shrink:0;">
          <button class="codex-tab-btn ${activeHelpTab === 'play' ? 'active' : ''}" id="tab-codex-play">📖 如何游戏</button>
          <button class="codex-tab-btn ${activeHelpTab === 'deck' ? 'active' : ''}" id="tab-codex-deck">🃏 卡组构筑</button>
          <button class="codex-tab-btn ${activeHelpTab === 'classes' ? 'active' : ''}" id="tab-codex-classes">🧙 流派与特殊造物</button>
          <button class="codex-tab-btn ${activeHelpTab === 'modes' ? 'active' : ''}" id="tab-codex-modes">🗺️ 游戏模式</button>
          <button class="codex-tab-btn ${activeHelpTab === 'cards' ? 'active' : ''}" id="tab-codex-cards">🃏 卡牌资料</button>
        </div>

        <!-- Chapter Content Scroll Area -->
        <div class="codex-page-scroll" style="flex:1;">
          ${renderCodexPageContent(activeHelpTab)}
        </div>
      </div>
    </div>
  `;
}

function renderAchievementsModal(): string {
  const unlockedCount = Object.keys(unlockedAchievements).length;
  return `
    <div class="modal-overlay" id="achievements-modal-overlay">
      <div class="stone-options-dialog" style="width:clamp(600px, 66vw, 920px); max-height:88vh; display:flex; flex-direction:column;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #451a03 0%, #78350f 50%, #451a03 100%); display:flex; justify-content:space-between; align-items:center; padding:10px 20px; flex-shrink:0;">
          <div class="options-title-text" style="color:#fef08a;">🏆 荣誉与辉煌成就馆 (${unlockedCount} / ${ACHIEVEMENTS_LIST.length})</div>
          <button class="modal-close-btn" id="btn-achievements-close" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;">×</button>
        </div>

        <div style="flex:1; overflow-y:auto; padding:clamp(12px, 1.8vh, 20px); display:flex; flex-direction:column; gap:10px;">
          ${ACHIEVEMENTS_LIST.map((ach) => {
            const isUnlocked = Boolean(unlockedAchievements[ach.id]);
            const unlockDate = unlockedAchievements[ach.id];
            return `
              <div class="achievement-entry-card">
                <img src="${ach.badgeImg}" class="achievement-badge-art ${isUnlocked ? 'unlocked' : 'locked'}" alt="${ach.title}" />
                <div style="flex:1; display:flex; flex-direction:column; gap:3px;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="achievement-title-text">${ach.title}</span>
                    <span class="achievement-status-tag ${isUnlocked ? 'unlocked' : 'locked'}">
                      ${isUnlocked ? '✓ 已达成' : '🔒 未解锁'}
                    </span>
                  </div>
                  <div class="achievement-desc-text">${ach.desc}</div>
                  ${isUnlocked ? `<div style="font-size:11.5px; color:#854d0e; font-weight:700;">达成时间: ${unlockDate}</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderReplayManagerModal(): string {
  return `
    <div class="modal-overlay" id="replay-modal-overlay">
      <div class="stone-options-dialog" style="width:clamp(560px, 64vw, 880px); max-height:88vh; display:flex; flex-direction:column;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%); display:flex; justify-content:space-between; align-items:center; padding:10px 20px; flex-shrink:0;">
          <div class="options-title-text" style="color:#c7d2fe;">📼 对战录像与回放馆</div>
          <button class="modal-close-btn" id="btn-replay-modal-close" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;">×</button>
        </div>

        <div style="flex:1; overflow-y:auto; padding:clamp(12px, 1.8vh, 20px); display:flex; flex-direction:column; gap:12px;">
          ${battleReplays.length === 0 ? `
            <div style="text-align:center; padding:40px; color:#421e05; font-size:16px; font-weight:800;">
              暂无保存的对战录像。<br>进行并完成任意单局对决、战役讨伐或联赛排位后，系统将自动录制完整对决过程！
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${battleReplays.map((rep) => `
                <div class="replay-item-card">
                  <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                    <div class="replay-player-col">
                      <img src="${rep.playerFace}" class="replay-avatar" alt="${rep.playerName}" />
                      <span class="replay-name-sub" title="${rep.playerName}">${rep.playerName}</span>
                    </div>
                    <span style="font-weight:900; color:#dc2626; font-size:13px; margin:0 2px;">VS</span>
                    <div class="replay-player-col">
                      <img src="${rep.enemyFace}" class="replay-avatar" alt="${rep.enemyName}" />
                      <span class="replay-name-sub" title="${rep.enemyName}">${rep.enemyName}</span>
                    </div>
                  </div>

                  <div class="replay-item-meta-col" style="flex:1; min-width:0; padding:0 10px; display:flex; flex-direction:column; gap:3px;">
                    <div class="replay-badges-row" style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                      <span class="replay-mode-badge">${rep.mode}</span>
                      <span class="replay-result-tag ${rep.result}">${rep.result === 'victory' ? '🏆 决战胜利' : '💀 战局败北'}</span>
                    </div>
                    <div style="font-size:12px; color:#785834; font-weight:800; white-space:nowrap;">共 ${rep.totalTurns} 回合 · ${rep.steps.length} 个操作</div>
                    <div style="font-size:11.5px; color:#6b4e33; white-space:nowrap;">录制时间: ${rep.dateStr}</div>
                  </div>

                  <div style="display:flex; gap:8px; flex-shrink:0;">
                    <button class="duel-stone-action-btn start btn-watch-replay" data-replay-id="${rep.id}" style="padding:6px 14px; font-size:13px;">▶ 回放</button>
                    <button class="duel-stone-action-btn close btn-delete-replay" data-replay-id="${rep.id}" style="padding:6px 10px; font-size:13px;" title="删除录像">🗑️</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderReplayBattlefieldDock(): string {
  if (!activeViewingReplay || !activeViewingReplay.steps) return '';
  const total = activeViewingReplay.steps.length;
  const current = activeViewingReplay.steps[replayCurrentStepIdx] || activeViewingReplay.steps[0];
  return `
    <div class="replay-battle-controller-dock">
      <button class="replay-ctrl-btn" id="btn-replay-dock-exit" title="返回录像列表">◀ 退出回放</button>
      <button class="replay-ctrl-btn" id="btn-replay-dock-first" title="跳至开局初始状态">⏮ 开局</button>
      <button class="replay-ctrl-btn" id="btn-replay-dock-prev" title="回退上一步">◀ 上一步</button>
      <button class="replay-play-btn" id="btn-replay-dock-play">${isReplayAutoPlaying ? '⏸ 暂停' : '▶ 自动播放'}</button>
      <button class="replay-ctrl-btn" id="btn-replay-dock-next" title="推进下一步">下一步 ▶</button>
      <button class="replay-ctrl-btn" id="btn-replay-dock-last" title="跳至终局">⏭ 终局</button>
      <button class="replay-ctrl-btn" id="btn-replay-dock-speed" style="color:#60a5fa;" title="切换倍速">⚡ ${replayPlaybackSpeed}x</button>
      <div class="replay-step-desc-pill" title="${current?.desc || ''}">
        <span style="color:#ffd700; font-weight:900; margin-right:6px;">[${replayCurrentStepIdx + 1}/${total}]</span>
        <span>${current?.desc || '对决推演中'}</span>
      </div>
    </div>
  `;
}

function renderLeagueHubModal(): string {
  return `
    <div class="modal-overlay" id="league-hub-modal-overlay">
      <div class="stone-options-dialog" style="width:clamp(540px, 60vw, 840px); max-height:88vh; display:flex; flex-direction:column;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #3d2314 0%, #7c2d12 50%, #3d2314 100%); display:flex; justify-content:space-between; align-items:center; padding:10px 20px; flex-shrink:0;">
          <div class="options-title-text" style="color:#ffd700;">英雄联赛 · 角色与联赛档案</div>
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="campaign-pc-btn start-btn" id="btn-league-hub-create-new" style="padding:6px 18px; font-size:14px;">➕ 创建新角色</button>
            <button class="modal-close-btn" id="btn-league-hub-close" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;">×</button>
          </div>
        </div>

        <div style="flex:1; overflow-y:auto; padding:clamp(12px, 1.8vh, 20px); display:flex; flex-direction:column; gap:12px;">
          ${leagueProfiles.length === 0 ? `
            <div style="text-align:center; padding:36px; color:#421e05; font-size:16px; font-weight:800;">
              尚未创建任何联赛角色档案。<br>点击下方【创建新角色】开启您的 8 轮大师排位赛！
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${leagueProfiles.map((p) => {
                const isCur = p.id === activeLeagueId;
                const pClass = HERO_CLASSES[p.playerClassIdx] || HERO_CLASSES[3];
                const playerStanding = [...p.standings].sort((a, b) => b.score - a.score);
                const rankIdx = playerStanding.findIndex(s => s.isPlayer) + 1;
                return `
                  <div class="league-profile-card ${isCur ? 'active' : ''}" data-profile-id="${p.id}">
                    <img src="./faces/Face${p.playerFaceId}.jpg" class="league-profile-face" alt="${p.playerName}" />
                    <div style="flex:1; display:flex; flex-direction:column; gap:3px;">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:clamp(16px, 1.3vw, 20px); font-weight:900; color:#ffd700; text-shadow:0 1px 3px #000;">${p.playerName}</span>
                        <span style="font-size:12px; font-weight:900; background:#7c2d12; color:#fed7aa; padding:2px 8px; border-radius:4px; border:1px solid #d4af37;">${pClass.nameCn} · ${p.difficulty}</span>
                        ${isCur ? '<span style="font-size:11px; background:#166534; color:#86efac; padding:2px 6px; border-radius:4px; font-weight:900;">当前选择</span>' : ''}
                      </div>
                      <div style="font-size:clamp(12.5px, 1.05vw, 15px); color:#2b1f13; font-weight:800;">
                        当前轮次: 第 ${p.currentMatch} / 8 轮 · 当前排名: 第 ${rankIdx > 0 ? rankIdx : 1} 名
                      </div>
                      ${p.createdAt ? `<div style="font-size:11px; color:#6b4e33;">创建时间: ${p.createdAt}</div>` : ''}
                    </div>
                    <div style="display:flex; gap:8px;">
                      <button class="duel-stone-action-btn start btn-select-league-profile" data-profile-id="${p.id}" style="padding:6px 14px; font-size:13px;">进入</button>
                      <button class="duel-stone-action-btn close btn-delete-league-profile" data-profile-id="${p.id}" style="padding:6px 10px; font-size:13px;" title="删除角色">🗑️</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderCampaignHubModal(): string {
  return `
    <div class="modal-overlay" id="campaign-hub-modal-overlay">
      <div class="stone-options-dialog" style="width:clamp(540px, 60vw, 840px); max-height:88vh; display:flex; flex-direction:column;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #1e3a1e 0%, #15803d 50%, #1e3a1e 100%); display:flex; justify-content:space-between; align-items:center; padding:10px 20px; flex-shrink:0;">
          <div class="options-title-text" style="color:#fef08a;">战役模式 · 角色与征战档案</div>
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="campaign-pc-btn start-btn" id="btn-campaign-hub-create-new" style="padding:6px 18px; font-size:14px;">➕ 创建新角色</button>
            <button class="modal-close-btn" id="btn-campaign-hub-close" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;">×</button>
          </div>
        </div>

        <div style="flex:1; overflow-y:auto; padding:clamp(12px, 1.8vh, 20px); display:flex; flex-direction:column; gap:12px;">
          ${campaignProfiles.length === 0 ? `
            <div style="text-align:center; padding:36px; color:#421e05; font-size:16px; font-weight:800;">
              尚未创建任何战役角色档案。<br>点击下方【创建新角色】开启您的史诗战役征程！
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${campaignProfiles.map((p) => {
                const isCur = p.id === activeCampaignId;
                const pClass = HERO_CLASSES[p.playerClassIdx] || HERO_CLASSES[0];
                const clearedCount = (p.completedLevels || []).length;
                return `
                  <div class="league-profile-card ${isCur ? 'active' : ''}" data-campaign-id="${p.id}">
                    <img src="./faces/Face${p.playerFaceId}.jpg" class="league-profile-face" alt="${p.playerName}" />
                    <div style="flex:1; display:flex; flex-direction:column; gap:3px;">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:clamp(16px, 1.3vw, 20px); font-weight:900; color:#ffd700; text-shadow:0 1px 3px #000;">${p.playerName}</span>
                        <span style="font-size:12px; font-weight:900; background:#166534; color:#bbf7d0; padding:2px 8px; border-radius:4px; border:1px solid #d4af37;">${pClass.nameCn} · ${p.difficulty}</span>
                        ${isCur ? '<span style="font-size:11px; background:#1e3a8a; color:#bfdbfe; padding:2px 6px; border-radius:4px; font-weight:900;">当前选择</span>' : ''}
                      </div>
                      <div style="font-size:clamp(12.5px, 1.05vw, 15px); color:#2b1f13; font-weight:800;">
                        征战进度: 已通关 ${clearedCount} / 65 关 · 当前所选关卡: 第 ${p.selectedLevelId || 1} 关
                      </div>
                      ${p.createdAt ? `<div style="font-size:11px; color:#6b4e33;">创建时间: ${p.createdAt}</div>` : ''}
                    </div>
                    <div style="display:flex; gap:8px;">
                      <button class="duel-stone-action-btn start btn-select-campaign-profile" data-campaign-id="${p.id}" style="padding:6px 14px; font-size:13px;">进入</button>
                      <button class="duel-stone-action-btn close btn-delete-campaign-profile" data-campaign-id="${p.id}" style="padding:6px 10px; font-size:13px;" title="删除角色">🗑️</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function updateCampaignSetupInPlace() {
  const overlay = document.getElementById('campaign-new-char-overlay');
  if (!overlay) return;
  const chosenClass = HERO_CLASSES[campaignPlayerClassIdx] || HERO_CLASSES[0];
  const faceImg = overlay.querySelector('#campaign-avatar-face-img') as HTMLImageElement;
  if (faceImg) faceImg.src = `./faces/Face${campaignPlayerFaceId}.jpg`;
  const classVal = overlay.querySelector('#campaign-choice-class-val');
  if (classVal) classVal.textContent = chosenClass.nameCn;
  const diffVal = overlay.querySelector('#campaign-choice-diff-val');
  if (diffVal) diffVal.textContent = campaignDifficulties[campaignPlayerDifficultyIdx];
}

function renderCampaignSetupModal(): string {
  const chosenClass = HERO_CLASSES[campaignPlayerClassIdx] || HERO_CLASSES[0];
  return `
    <div class="league-new-char-overlay" id="campaign-new-char-overlay">
      <div class="league-new-char-modal">
        <div class="league-modal-title-banner" style="background: linear-gradient(90deg, #1e3a1e 0%, #15803d 50%, #1e3a1e 100%); display:flex; justify-content:space-between; align-items:center; padding:8px 16px;">
          <div class="league-modal-title" style="color:#fef08a;">战役模式 · 创建新角色</div>
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="campaign-pc-btn start-btn" id="btn-campaign-create-char" style="padding:6px 20px; font-size:15px;">创建并开启</button>
            <button class="modal-close-btn" id="btn-campaign-close-setup" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;">×</button>
          </div>
        </div>

        <div class="league-modal-content-grid">
          <div class="league-avatar-picker-col">
            <button class="league-arrow-btn" id="btn-campaign-face-prev">◀</button>
            <div class="league-avatar-portrait-wrap">
              <img src="./faces/Face${campaignPlayerFaceId}.jpg" class="league-avatar-img" id="campaign-avatar-face-img" alt="头像" />
            </div>
            <button class="league-arrow-btn" id="btn-campaign-face-next">▶</button>
          </div>

          <div class="league-fields-col">
            <div class="league-field-row">
              <span class="league-field-label">英雄姓名:</span>
              <input type="text" id="campaign-name-input" value="${campaignPlayerName}" class="league-text-input" maxlength="12" />
            </div>

            <div class="league-field-row">
              <span class="league-field-label">职业流派:</span>
              <div class="league-choice-stepper">
                <button class="campaign-diff-btn" id="btn-campaign-class-prev">◀</button>
                <span class="league-choice-val" id="campaign-choice-class-val">${chosenClass.nameCn}</span>
                <button class="campaign-diff-btn" id="btn-campaign-class-next">▶</button>
              </div>
            </div>

            <div class="league-field-row">
              <span class="league-field-label">战役难度:</span>
              <div class="league-choice-stepper">
                <button class="campaign-diff-btn" id="btn-campaign-setup-diff-prev">◀</button>
                <span class="league-choice-val diff" id="campaign-choice-diff-val">${campaignDifficulties[campaignPlayerDifficultyIdx]}</span>
                <button class="campaign-diff-btn" id="btn-campaign-setup-diff-next">▶</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}


function renderOptionsModal(): string {
  const bgmVolPct = Math.round(sound.getBgmVolume() * 100);
  const sfxVolPct = Math.round(sound.getSfxVolume() * 100);
  const combatRate = sound.getCombatBgmRate();
  const rateLabel = combatRate <= 0.88 ? '🐌 沉稳慢调 (0.88x)' : (combatRate <= 0.94 ? '🎼 典雅深沉 (0.92x)' : '⚡ 原版疾奏 (1.0x)');

  return `
    <div class="modal-overlay" id="options-modal-overlay">
      <div class="stone-options-dialog" style="width:clamp(560px, 58vw, 760px); max-height:88vh; display:flex; flex-direction:column;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #2b180d 0%, #4a2816 50%, #2b180d 100%); flex-shrink:0; display:flex; justify-content:space-between; align-items:center; padding:10px 20px;">
          <div class="options-title-text" style="color:#ffd700; font-size:clamp(18px, 1.5vw, 22px);">⚙️ 游戏选项与音频设置</div>
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="options-seal-btn confirm" id="btn-confirm-options" title="确定完成">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6));"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button class="options-seal-btn close" id="btn-close-options" title="关闭窗口">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6));"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <div style="flex:1; overflow-y:auto; padding:clamp(18px, 2.4vh, 28px); display:flex; flex-direction:column; gap:18px;">
          <!-- BGM Setting (Toggle + Volume Slider) -->
          <div style="display:flex; flex-direction:column; gap:10px; background:#ffffff; border:1.5px solid #d4b378; border-radius:10px; padding:14px 20px; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:clamp(16px, 1.35vw, 19.5px); font-weight:900; color:#381e05;">🎵 游戏背景音乐 (BGM)</div>
                <div style="font-size:clamp(12.5px, 1vw, 14px); color:#786047; margin-top:3px;">控制主菜单、大地图与决斗战斗背景配乐</div>
              </div>
              <button class="duel-stone-action-btn ${sound.bgmEnabled ? 'start' : 'close'}" id="btn-toggle-bgm" style="padding:8px 24px; font-size:clamp(14px, 1.15vw, 16px); min-width:115px; height:42px;">
                ${sound.bgmEnabled ? '🔊 已开启' : '🔇 已静音'}
              </button>
            </div>
            <div style="display:flex; align-items:center; gap:14px; padding-top:10px; border-top:1px dashed rgba(212, 179, 120, 0.6);">
              <span style="font-size:clamp(13px, 1vw, 14.5px); font-weight:800; color:#5c3d1e; white-space:nowrap;">音量调节</span>
              <input type="range" id="slider-bgm-volume" min="0" max="100" value="${bgmVolPct}" class="fantasy-range-slider" style="flex:1;" />
              <span id="label-bgm-volume" style="font-size:clamp(14px, 1.1vw, 16px); font-weight:900; color:#854d0e; min-width:44px; text-align:right; font-family:'Cinzel', Georgia, serif;">${bgmVolPct}%</span>
            </div>
          </div>

          <!-- SFX Setting (Toggle + Volume Slider) -->
          <div style="display:flex; flex-direction:column; gap:10px; background:#ffffff; border:1.5px solid #d4b378; border-radius:10px; padding:14px 20px; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:clamp(16px, 1.35vw, 19.5px); font-weight:900; color:#381e05;">🔔 战斗与技能音效 (SFX)</div>
                <div style="font-size:clamp(12.5px, 1vw, 14px); color:#786047; margin-top:3px;">控制生物召唤、攻击冲击、魔法轰击与界面音效</div>
              </div>
              <button class="duel-stone-action-btn ${sound.enabled ? 'start' : 'close'}" id="btn-toggle-sfx" style="padding:8px 24px; font-size:clamp(14px, 1.15vw, 16px); min-width:115px; height:42px;">
                ${sound.enabled ? '🔔 已开启' : '🔕 已静音'}
              </button>
            </div>
            <div style="display:flex; align-items:center; gap:14px; padding-top:10px; border-top:1px dashed rgba(212, 179, 120, 0.6);">
              <span style="font-size:clamp(13px, 1vw, 14.5px); font-weight:800; color:#5c3d1e; white-space:nowrap;">音量调节</span>
              <input type="range" id="slider-sfx-volume" min="0" max="100" value="${sfxVolPct}" class="fantasy-range-slider" style="flex:1;" />
              <span id="label-sfx-volume" style="font-size:clamp(14px, 1.1vw, 16px); font-weight:900; color:#854d0e; min-width:44px; text-align:right; font-family:'Cinzel', Georgia, serif;">${sfxVolPct}%</span>
            </div>
          </div>

          <!-- Combat Music Tempo Setting (慢放调节) -->
          <div style="display:flex; flex-direction:column; gap:12px; background:#ffffff; border:1.5px solid #d4b378; border-radius:10px; padding:14px 20px; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:clamp(16px, 1.35vw, 19.5px); font-weight:900; color:#381e05;">⚔️ 战斗背景音乐节奏</div>
                <div style="font-size:clamp(12.5px, 1vw, 14px); color:#786047; margin-top:3px;">慢放战斗背景音乐，平缓促战急迫感，烘托专注沉着的高维策略交锋</div>
              </div>
              <span id="label-combat-rate" style="font-size:clamp(13px, 1.1vw, 15px); color:#854d0e; font-weight:900; background:#fef3c7; border:1.5px solid #fde68a; padding:4px 12px; border-radius:8px;">
                ${rateLabel}
              </span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
              <button class="duel-stone-action-btn ${combatRate <= 0.88 ? 'start' : 'close'}" id="btn-combat-rate-slow" style="height:42px; font-size:clamp(13px, 1.1vw, 15px); padding:4px;">
                🐌 沉稳慢调 (0.88x)
              </button>
              <button class="duel-stone-action-btn ${(combatRate > 0.88 && combatRate <= 0.94) ? 'start' : 'close'}" id="btn-combat-rate-mid" style="height:42px; font-size:clamp(13px, 1.1vw, 15px); padding:4px;">
                🎼 典雅深沉 (0.92x)
              </button>
              <button class="duel-stone-action-btn ${combatRate > 0.94 ? 'start' : 'close'}" id="btn-combat-rate-orig" style="height:42px; font-size:clamp(13px, 1.1vw, 15px); padding:4px;">
                ⚡ 原版疾奏 (1.0x)
              </button>
            </div>
          </div>

          <!-- Record Replays Toggle (Interactive Slide Switch) -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1.5px solid #d4b378; border-radius:10px; padding:14px 20px; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            <div>
              <div style="font-size:clamp(16px, 1.35vw, 19.5px); font-weight:900; color:#381e05;">📼 自动记录对战录像</div>
              <div style="font-size:clamp(12.5px, 1vw, 14px); color:#786047; margin-top:3px;">对战结束后自动保存推演过程至录像馆（可在主界面查阅与复盘）</div>
            </div>
            <div class="slide-toggle-track ${recordReplaysEnabled ? 'active' : ''}" id="btn-toggle-record-replays" role="switch" aria-checked="${recordReplaysEnabled}" title="切换自动录像">
              <div class="slide-toggle-knob"></div>
            </div>
          </div>

          <!-- Display / Fullscreen Setting -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1.5px solid #d4b378; border-radius:10px; padding:14px 20px; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            <div>
              <div style="font-size:clamp(16px, 1.35vw, 19.5px); font-weight:900; color:#381e05;">🖥️ 画面显示与全屏模式</div>
              <div style="font-size:clamp(12.5px, 1vw, 14px); color:#786047; margin-top:3px;">支持一键切换无边框沉浸全屏对决（亦可在对战中随时按 <kbd style="background:#fef3c7; border:1px solid #d4b378; padding:1px 6px; border-radius:4px; font-weight:700;">F11</kbd> 或 <kbd style="background:#fef3c7; border:1px solid #d4b378; padding:1px 6px; border-radius:4px; font-weight:700;">Alt+Enter</kbd> 切换）</div>
            </div>
            <button class="duel-stone-action-btn ${document.fullscreenElement ? 'start' : 'close'}" id="btn-toggle-fullscreen" style="padding:8px 20px; font-size:clamp(13px, 1.1vw, 15px); min-width:130px; height:42px;">
              ${document.fullscreenElement ? '⛶ 退出全屏' : '⛶ 进入全屏'}
            </button>
          </div>

          <!-- Battlefield Background Theme -->
          <div style="background:#ffffff; border:1.5px solid #d4b378; border-radius:10px; padding:16px 20px; display:flex; flex-direction:column; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <div style="font-size:clamp(16px, 1.35vw, 19.5px); font-weight:900; color:#381e05;">🗺️ 对战战场背景环境</div>
                <div style="font-size:clamp(12.5px, 1vw, 14px); color:#786047; margin-top:3px;">选择战斗对决主界面的远景圣所主题，支持特定主题或开启全随机轮播</div>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <span id="options-theme-label" style="font-size:clamp(13px, 1.1vw, 15px); color:#854d0e; font-weight:900; background:#fef3c7; border:1.5px solid #fde68a; padding:4px 12px; border-radius:8px;">
                  ${randomBattlefieldEnabled ? '🎲 战斗随机轮播' : getThemeName(currentBattlefieldTheme)}
                </span>
                <div style="display:flex; align-items:center; gap:6px;" title="战斗时使用随机背景">
                  <span style="font-size:12px; font-weight:800; color:#854d0e;">随机背景</span>
                  <div class="slide-toggle-track ${randomBattlefieldEnabled ? 'active' : ''}" id="btn-toggle-random-battlefield" role="switch" aria-checked="${randomBattlefieldEnabled}">
                    <div class="slide-toggle-knob"></div>
                  </div>
                </div>
              </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
              <button class="duel-stone-action-btn ${!randomBattlefieldEnabled && currentBattlefieldTheme === 'citadel' ? 'start' : 'close'}" id="btn-theme-citadel" style="height:40px; font-size:clamp(12px, 1vw, 14px); padding:4px;">🏛️ 星辉圣殿</button>
              <button class="duel-stone-action-btn ${!randomBattlefieldEnabled && currentBattlefieldTheme === 'sky' ? 'start' : 'close'}" id="btn-theme-sky" style="height:40px; font-size:clamp(12px, 1vw, 14px); padding:4px;">☁️ 天界圣峰</button>
              <button class="duel-stone-action-btn ${!randomBattlefieldEnabled && currentBattlefieldTheme === 'volcano' ? 'start' : 'close'}" id="btn-theme-volcano" style="height:40px; font-size:clamp(12px, 1vw, 14px); padding:4px;">🌋 熔岩炼狱</button>
              <button class="duel-stone-action-btn ${!randomBattlefieldEnabled && currentBattlefieldTheme === 'forest' ? 'start' : 'close'}" id="btn-theme-forest" style="height:40px; font-size:clamp(12px, 1vw, 14px); padding:4px;">🌲 永恒密林</button>
              <button class="duel-stone-action-btn ${!randomBattlefieldEnabled && currentBattlefieldTheme === 'abyss' ? 'start' : 'close'}" id="btn-theme-abyss" style="height:40px; font-size:clamp(12px, 1vw, 14px); padding:4px;">🌌 深渊裂隙</button>
              <button class="duel-stone-action-btn ${!randomBattlefieldEnabled && currentBattlefieldTheme === 'tundra' ? 'start' : 'close'}" id="btn-theme-tundra" style="height:40px; font-size:clamp(12px, 1vw, 14px); padding:4px;">❄️ 极地雪原</button>
              <button class="duel-stone-action-btn ${!randomBattlefieldEnabled && currentBattlefieldTheme === 'desert' ? 'start' : 'close'}" id="btn-theme-desert" style="height:40px; font-size:clamp(12px, 1vw, 14px); padding:4px;">🏜️ 丝路大漠</button>
              <button class="duel-stone-action-btn ${!randomBattlefieldEnabled && currentBattlefieldTheme === 'shrine' ? 'start' : 'close'}" id="btn-theme-shrine" style="height:40px; font-size:clamp(12px, 1vw, 14px); padding:4px;">✨ 苍穹神坛</button>
            </div>
          </div>

          <!-- 🤖 AI 大模型对战与战意传音设置 -->
          ${(() => {
            const aiCfg = getAiConfig();
            return `
              <div style="background:#ffffff; border:1.5px solid #d4b378; border-radius:10px; padding:16px 20px; display:flex; flex-direction:column; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.06);" id="options-ai-wrapper">
                <!-- 开关 1: AI 总开关 (开启后激活 AI 巅峰对决与大模型心智) -->
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:clamp(16px, 1.35vw, 19.5px); font-weight:900; color:#381e05;">🔮 开启大模型 AI 心智 (总开关)</div>
                    <div style="font-size:clamp(12.5px, 1vw, 14px); color:#786047; margin-top:3px;">
                      启用云端或本地大模型。开启后，主界面<strong>「AI 巅峰对决」</strong>即刻激活畅玩，并可为下方常规模式注入 AI 心智！
                    </div>
                  </div>
                  <div class="slide-toggle-track ${aiCfg.enabled ? 'active' : ''}" id="btn-toggle-ai-enabled" role="switch" aria-checked="${aiCfg.enabled}" title="切换 AI 总开关">
                    <div class="slide-toggle-knob"></div>
                  </div>
                </div>

                <div id="options-ai-details-panel" style="display:${aiCfg.enabled ? 'flex' : 'none'}; flex-direction:column; gap:14px; padding-top:14px; border-top:1px dashed rgba(212, 179, 120, 0.6);">
                  <!-- 开关 2: 常规 PVE 模式应用范围 -->
                  <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:12px 16px; display:flex; flex-direction:column; gap:8px;">
                    <div style="font-size:13.5px; font-weight:800; color:#9a3412;">🎯 开关二：AI 心智应用于哪些常规模式？</div>
                    <div style="font-size:12px; color:#7c2d12; line-height:1.45;">
                      选择在哪些常规游戏中由大模型掌控电脑对手（含出牌思考与战意传音）。未勾选的模式将保持毫秒级本地原生算法，0 网络开销：<br>
                      <em>（💡 提示：主界面的「AI 巅峰对决」无需配置，开启总开关后始终全力启用大模型）</em>
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-top:4px;">
                      <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:#431407; cursor:pointer;">
                        <input type="checkbox" id="chk-ai-mode-duel" ${aiCfg.applyModes?.duel !== false ? 'checked' : ''} style="width:17px; height:17px; accent-color:#ea580c; cursor:pointer;" />
                        ⚔️ 单人对战模式
                      </label>
                      <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:#431407; cursor:pointer;">
                        <input type="checkbox" id="chk-ai-mode-league" ${aiCfg.applyModes?.league !== false ? 'checked' : ''} style="width:17px; height:17px; accent-color:#ea580c; cursor:pointer;" />
                        🏆 英雄联赛模式
                      </label>
                      <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:#431407; cursor:pointer;">
                        <input type="checkbox" id="chk-ai-mode-campaign" ${aiCfg.applyModes?.campaign !== false ? 'checked' : ''} style="width:17px; height:17px; accent-color:#ea580c; cursor:pointer;" />
                        🗺️ 战役剧情模式
                      </label>
                      <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:#431407; cursor:pointer;">
                        <input type="checkbox" id="chk-ai-mode-custom-deck" ${aiCfg.applyModes?.custom_deck !== false ? 'checked' : ''} style="width:17px; height:17px; accent-color:#ea580c; cursor:pointer;" />
                        🎴 自组卡组实测
                      </label>
                    </div>
                  </div>

                  <!-- 大模型服务商与参数配置 -->
                  <div style="font-size:13px; font-weight:800; color:#5c3d1e;">⚙️ 模型接口与密钥配置：</div>
                  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
                    ${(['deepseek', 'siliconflow', 'ollama', 'custom'] as const).map(p => `
                      <button class="duel-stone-action-btn ${aiCfg.provider === p ? 'start' : 'close'}" id="btn-ai-provider-${p}" style="height:38px; font-size:12.5px; padding:2px 8px;">
                        ${p === 'deepseek' ? 'DeepSeek (推荐)' : (p === 'siliconflow' ? '硅基流动' : (p === 'ollama' ? '本地 Ollama' : '自定义'))}
                      </button>
                    `).join('')}
                  </div>

                  <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <label style="font-size:13px; font-weight:800; color:#5c3d1e;">API Key (密钥)：</label>
                      <button id="btn-toggle-reveal-apikey" style="background:none; border:none; color:#854d0e; font-size:12px; font-weight:700; cursor:pointer;">
                        ${showAiApiKey ? '🙈 隐藏' : '👁️ 显示'}
                      </button>
                    </div>
                    <input type="${showAiApiKey ? 'text' : 'password'}" id="input-ai-apikey" value="${aiCfg.apiKey}" placeholder="${aiCfg.provider === 'ollama' ? '本地 Ollama 免填 API Key' : '请输入 sk-...'}" style="width:100%; height:38px; padding:0 12px; border:1.5px solid #d4b378; border-radius:8px; font-size:13.5px; background:#fffbf0; color:#381e05; box-sizing:border-box;" />
                  </div>

                  <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:10px;">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                      <label style="font-size:12.5px; font-weight:800; color:#5c3d1e;">接口地址 (Base URL)：</label>
                      <input type="text" id="input-ai-baseurl" value="${aiCfg.baseUrl}" placeholder="https://api.deepseek.com/v1" style="width:100%; height:36px; padding:0 10px; border:1.5px solid #d4b378; border-radius:8px; font-size:12px; background:#fffbf0; color:#381e05; box-sizing:border-box;" />
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                      <label style="font-size:12.5px; font-weight:800; color:#5c3d1e;">模型标识 (Model)：</label>
                      <input type="text" id="input-ai-model" value="${aiCfg.model}" placeholder="deepseek-chat" style="width:100%; height:36px; padding:0 10px; border:1.5px solid #d4b378; border-radius:8px; font-size:12px; background:#fffbf0; color:#381e05; box-sizing:border-box;" />
                    </div>
                  </div>

                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; gap:8px;">
                      <button class="duel-stone-action-btn start" id="btn-test-ai-connection" style="height:36px; padding:0 16px; font-size:13px; font-weight:800;">
                        ⚡ 测试连通性
                      </button>
                      <button class="duel-stone-action-btn close" id="btn-view-ai-combat-logs" style="height:36px; padding:0 14px; font-size:12.5px; font-weight:700;" title="查看对战时大模型的完整请求发送与响应结果">
                        📄 对战 AI 记录
                      </button>
                    </div>
                    <span id="ai-test-result" style="font-size:12.5px; font-weight:800; color:#854d0e;">
                      💡 实战请求与响应已实时同步至 tools/battle_ai_records.txt
                    </span>
                  </div>
                </div>

                <div id="options-ai-disabled-hint" style="display:${aiCfg.enabled ? 'none' : 'block'}; font-size:12.5px; color:#854d0e; background:#fef3c7; border:1px solid #fde68a; padding:8px 12px; border-radius:6px; line-height:1.45;">
                  💡 当前处于<strong>普通离线模式</strong>：由本地高效决策引擎毫秒级驱动，0 网络请求，0 费用消耗。随时可点击右上角总开关开启大模型心智与「AI 巅峰对决」！
                </div>
              </div>
            `;
          })()}

          ${currentView === 'battle' ? `
            <div style="border-top:1.5px dashed rgba(198,155,63,0.4); padding-top:16px; display:flex; flex-direction:column; gap:8px;">
              <button class="campaign-pc-btn start-btn" id="btn-options-save-quit" style="width:100%; height:48px; font-size:clamp(15.5px, 1.3vw, 18px); font-weight:900;">
                💾 保存战斗进度并返回主菜单
              </button>
              <div style="font-size:12.5px; color:#5c3d1e; text-align:center; font-weight:700;">
                自动保存当前血量、能量、场上随从与手牌状态，可随时在主菜单恢复对决
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderAiAnnouncementModal(card: CardDef): string {
  const elemNames: Record<ElementType, string> = {
    fire: '火系', water: '水系', air: '气系', earth: '土系', special: '巫术',
    death: '死灵', holy: '圣职', mechanics: '机械', control: '支配', chaos: '混沌', illusion: '幻术',
  };
  const clsName = card.className ? (HERO_CLASSES.find(c => c.id === card.className)?.nameCn || '特殊') : (elemNames[card.element] || '特殊');
  const isCreature = card.type === 'creature';
  const actionVerb = isCreature ? '召唤' : '施法';
  return `
    <div class="ai-announcement-overlay" id="ai-announcement-overlay">
      <div class="ai-announcement-wrapper">
        <div class="ai-announcement-header">${engine.enemy.name} ${actionVerb} ${card.nameCn}</div>
        <div class="ai-announcement-card-frame">
          <!-- Left: Card in slot -->
          <div class="ai-announcement-card-slot">
            <img src="${toRel(card.imgBigUrl || card.imgUrl)}" class="ai-announcement-card-art ${card.type === 'spell' ? 'spell-art' : ''}" alt="${card.nameCn}" />
            <div class="ai-card-cost">${card.cost}</div>
            <div class="ai-card-name">${card.nameCn}</div>
            ${isCreature ? `
              <div class="ai-card-footer">
                <span class="badge-atk">${formatCardAtk(card.attack)}</span>
                <span class="badge-hp">${card.life}</span>
              </div>
            ` : ''}
          </div>
          <!-- Right: Parchment Description -->
          <div class="ai-announcement-desc-slot">
            <div class="ai-desc-title">${card.nameCn}</div>
            <div class="ai-desc-sub">${clsName}${isCreature ? '生物' : '魔法'}，费用 ${card.cost}</div>
            ${isCreature ? `
              <div class="ai-desc-stats">攻击 ${formatCardAtk(card.attack)}，生命 ${card.life}</div>
            ` : ''}
            <div class="ai-desc-text">${card.desc}</div>
          </div>
        </div>
        <div class="ai-announcement-footer">按任意键继续</div>
      </div>
    </div>
  `;
}

function renderSurrenderModal(): string {
  return `
    <div class="modal-overlay" id="surrender-modal-overlay">
      <div class="surrender-stone-dialog">
        <div class="surrender-title">您真的要投降认输吗？</div>
        <div class="surrender-desc">当前对决将被判定为战败，所有战局结算将即刻执行。</div>
        <div class="surrender-btn-row">
          <button class="duel-stone-action-btn start" id="btn-confirm-surrender">是 (确定认输)</button>
          <button class="duel-stone-action-btn close" id="btn-cancel-surrender">否 (继续战斗)</button>
        </div>
      </div>
    </div>
  `;
}

function renderCombatScreen(): string {
  const p = engine.player;
  const e = engine.enemy;

  const currentSpecialElement: ElementType = showOpponentHand ? e.specialElement : p.specialElement;
  const elementsOrder: ElementType[] = ['fire', 'water', 'air', 'earth', currentSpecialElement];
  const elemNames: Record<ElementType, string> = {
    fire: '火系',
    water: '水系',
    air: '气系',
    earth: '土系',
    special: '巫术',
    death: '死灵',
    holy: '圣职',
    mechanics: '机械',
    control: '支配',
    chaos: '混沌',
    illusion: '幻术',
  };

  const pClassObj = HERO_CLASSES.find((c) => c.id === p.className);
  const eClassObj = HERO_CLASSES.find((c) => c.id === e.className);
  const pSpecialName = pClassObj ? pClassObj.nameCn : '特殊';
  const eSpecialName = eClassObj ? eClassObj.nameCn : '特殊';

  const effectiveEnemyHand = engine.getEffectiveHand('enemy');
  const effectivePlayerHand = engine.getEffectiveHand('player');
  const previewCard = inspectedCard || selectedCard || (showOpponentHand ? effectiveEnemyHand[0] : effectivePlayerHand[0]);

  return `
    <div class="combat-view-container">
      <!-- 1. LEFT PANEL: FAR-LEFT ACTION STRIP + INFO COLUMN (HEROES, INSPECTOR, LOGS) -->
      <div class="combat-left-panel">
        <!-- SUB-COLUMN 1: Far-Left Action Control Strip (一整列操作与状态按键) -->
        <div class="combat-actions-strip">
          <!-- 1. 对手卡牌 / 己方卡牌 -->
          <button class="combat-strip-item btn-toggle-cards ${showOpponentHand ? 'viewing-opponent' : ''}" id="btn-toggle-show-cards" title="切换查阅对手/己方手牌">
            <span class="strip-icon">👁️</span>
            <span class="strip-text">${showOpponentHand ? '己方卡牌' : '对手卡牌'}</span>
          </button>

          <!-- 2. 保存退出 -->
          <button class="combat-strip-item btn-save-exit" id="btn-combat-save-exit" title="保存战斗进度并返回主菜单">
            <span class="strip-icon">💾</span>
            <span class="strip-text">保存退出</span>
          </button>

          <!-- 3. 战场规则 -->
          <button class="combat-strip-item btn-rules" id="btn-combat-rules" title="查看当前战场特殊规则">
            <span class="strip-icon">📜</span>
            <span class="strip-text">战场规则</span>
          </button>

          ${currentView === 'replay_viewer' ? `
            <!-- 回放退出按钮 -->
            <button class="combat-strip-item btn-surrender" id="btn-replay-strip-exit" title="退出回放并返回列表">
              <span class="strip-icon">◀</span>
              <span class="strip-text">退出回放</span>
            </button>
          ` : `
            <!-- 4. 投降 -->
            <button class="combat-strip-item btn-surrender" id="btn-combat-surrender" title="认输投降">
              <span class="strip-icon">🏳️</span>
              <span class="strip-text">投降</span>
            </button>

            <!-- 5. 获得建议 -->
            <button class="combat-strip-item btn-advice" id="btn-get-advice" ${engine.activeTurn !== 'player' || engine.isCombatPhase ? 'disabled' : ''} title="获取AI战术建议">
              <span class="strip-icon">💡</span>
              <span class="strip-text">获得建议</span>
            </button>

            <!-- 6. 结束回合 (大尺寸主操作键) -->
            ${engine.activeTurn === 'player' ? `
              <button class="combat-strip-item btn-end-turn" id="btn-end-turn" ${engine.isCombatPhase ? 'disabled' : ''} title="结束己方回合并开始交战">
                <span class="strip-icon">⚔️</span>
                <span class="strip-text">结束回合</span>
              </button>
            ` : (engine.activeTurn === 'enemy' ? `
              <button class="combat-strip-item btn-end-turn" disabled title="敌方魔导师正在运筹帷幄与思索对策...">
                <span class="strip-icon">⏳</span>
                <span class="strip-text">敌方行动</span>
              </button>
            ` : `
              <button class="combat-strip-item btn-end-turn" disabled title="正在结算交战">
                <span class="strip-icon">⚔️</span>
                <span class="strip-text">交战结算</span>
              </button>
            `)}
          `}
        </div>

        <!-- SUB-COLUMN 2: Info & Double Parchment (英雄卡片、卡牌检视、实况记录) -->
        <div class="combat-info-column">
          <!-- Top: Heroes Stack -->
          <div class="combat-heroes-stack">
            <!-- Opponent Hero Card: Sinister Demonic Theme with Full Width Mana Bar -->
            <div class="combat-hero-row opponent ${engine.activeTurn === 'enemy' ? 'turn-active' : 'turn-inactive'}" style="position: relative;">
              ${activeEnemyBanter ? `
                <div class="arcane-speech-scroll comic-dialogue-bubble ${banterPopClass}" title="${activeBanterSpeaker ? `${activeBanterSpeaker}的战意传音` : 'AI 魔导师战意传音'}">
                  <div class="arcane-speech-tail comic-bubble-tail"></div>
                  <div class="arcane-speech-body">
                    <span class="arcane-speech-text">“${activeEnemyBanter}”</span>
                  </div>
                </div>
              ` : ''}
              <div class="combat-hero-top-row">
                <div class="combat-hero-portrait-wrap">
                  <img src="${toRel(e.face)}" class="combat-hero-avatar combat-hero-portrait-frame top" alt="${e.name}" />
                  <img src="./ui/Portraitramka.png" class="combat-hero-ramka" alt="Frame" />
                  <span class="combat-hero-badge-tag enemy">敌</span>
                </div>
                <div class="combat-hero-info">
                  <div class="combat-hero-name-plate">
                    <span class="combat-hero-hp enemy">${e.hp}</span>
                    <span class="combat-hero-name" title="${e.name}">${e.name}</span>
                    <div class="combat-hero-status-badges">
                      ${engine.activeTurn === 'enemy' && !engine.gameOver ? `
                        <span class="turn-timer-badge enemy" id="turn-timer-enemy" title="敌方思考倒计时">⏱️ ${currentTurnTimerRemaining}s</span>
                      ` : ''}
                      <span class="combat-hero-class-tag enemy">${eSpecialName}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="hero-mana-bar opponent-full-width">
                ${['fire', 'water', 'air', 'earth', e.specialElement].map((elem, idx) => {
                  const label = idx === 4 ? eSpecialName : elemNames[elem as ElementType];
                  const elemIcons: Record<string, string> = { fire: '🔥', water: '💧', air: '⚡', earth: '🌿', special: '🔮', death: '💀', holy: '✨', mechanics: '⚙️', control: '👁️', chaos: '🌀', illusion: '🎭', sorcery: '🔮' };
                  const icon = elemIcons[elem] || '🔮';
                  const manaVal = e.mana[elem as ElementType] || 0;
                  return `
                    <div class="hero-mana-chip elem-${elem}" title="${label}能量: ${manaVal}">
                      <span class="chip-icon">${icon}</span>
                      <span class="chip-val">${manaVal}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Player Hero Card: Radiant Celestial Theme without Mana Bar (Mana displayed in hand column header) -->
            <div class="combat-hero-row player ${engine.activeTurn === 'player' ? 'turn-active' : 'turn-inactive'}">
              <div class="combat-hero-portrait-wrap">
                <img src="${toRel(p.face)}" class="combat-hero-avatar combat-hero-portrait-frame bottom" alt="${p.name}" />
                <img src="./ui/Portraitramka.png" class="combat-hero-ramka" alt="Frame" />
                <span class="combat-hero-badge-tag player">我</span>
              </div>
              <div class="combat-hero-info">
                <div class="combat-hero-name-plate">
                  <span class="combat-hero-hp player">${p.hp}</span>
                  <span class="combat-hero-name" title="${p.name}">${p.name}</span>
                  <div class="combat-hero-status-badges">
                    ${engine.activeTurn === 'player' && !engine.gameOver ? `
                      <span class="turn-timer-badge player" id="turn-timer-player" title="己方思考倒计时">⏱️ ${currentTurnTimerRemaining}s</span>
                    ` : ''}
                    <span class="combat-hero-class-tag player">${pSpecialName}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Double Parchment Container -->
          <div class="combat-double-parchment-container">
            <!-- 1. Upper: Card Inspection Parchment -->
            <div class="combat-inspect-parchment" id="combat-inspect-parchment" style="cursor: pointer;" title="轻触展开全屏卡牌详情">
              ${previewCard ? (() => {
                const previewSide = inspectedCard ? inspectedCardSide : (selectedCard ? 'player' : (showOpponentHand ? 'enemy' : 'player'));
                const previewEffCost = engine ? engine.getCardEffectiveCost(previewSide, previewCard) : previewCard.cost;
                const costDisplayHtml = previewEffCost !== previewCard.cost
                  ? `${previewEffCost}费 <span class="cost-mod-sub">(原${previewCard.cost}费)</span>`
                  : `${previewEffCost}费`;
                return `
                <div class="parchment-card-top-row">
                  <img src="${toRel(previewCard.imgBigUrl || previewCard.imgUrl)}" class="parchment-card-art ${previewCard.type === 'spell' ? 'spell-art' : ''}" alt="${previewCard.nameCn}" />
                  <div class="parchment-card-meta">
                    <div class="parchment-card-title">${previewCard.nameCn} (${costDisplayHtml}) <span style="font-size: 10px; opacity: 0.6; float: right;">⤢</span></div>
                    <div class="parchment-card-sub" style="${previewCard.isActivatedAbility ? 'color: #8b3a00; font-weight: bold;' : ''}">
                      ${previewCard.isActivatedAbility
                        ? (previewCard.desc.includes('\n') ? previewCard.desc.split('\n')[0] : `【${previewCard.nameCn}】的主动技能，费用 ${previewEffCost}`)
                        : `${previewCard.className ? (HERO_CLASSES.find(c => c.id === previewCard.className)?.nameCn || '特殊') : (elemNames[previewCard.element] || '特殊')} · ${previewCard.type === 'creature' ? '生物' : '法术'} · ${previewCard.name}`}
                    </div>
                    ${previewCard.type === 'creature' ? `
                      <div class="parchment-card-stats-row">
                        <span class="stat-badge atk">⚔️ 攻击: ${formatCardAtk(previewCard.attack)}</span>
                        <span class="stat-badge hp">❤️ 生命: ${previewCard.life}</span>
                      </div>
                    ` : ''}
                  </div>
                </div>
                <div class="parchment-card-desc">
                  ${previewCard.isActivatedAbility && previewCard.desc.includes('\n')
                    ? previewCard.desc.split('\n').slice(1).join('\n')
                    : previewCard.desc}
                </div>
                `;
              })() : `
                <div class="parchment-empty-tip">
                  轻触任意手牌或在场生物<br/>检视详尽技能说明与战术属性
                </div>
              `}
            </div>

            <!-- 2. Lower: Combat Log Chronicle -->
            <div class="combat-log-parchment">
              <div class="combat-log-header" id="btn-combat-log" style="cursor: pointer;" title="轻触展开完整战历">📜 战斗实况记录 <span style="font-size: 10px; opacity: 0.6; float: right;">⤢</span></div>
              <div class="combat-log-scroll" id="combat-log-scroll">
                ${engine.logs.length === 0 ? '<div class="combat-log-line info">对决刚刚开始，准备出牌...</div>' : ''}
                ${[...engine.logs].reverse().map(l => `
                  <div class="combat-log-line ${l.type}">${l.text}</div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. RIGHT PANEL: UPPER BATTLEFIELD + LOWER 20-CARD HAND -->
      <div class="combat-right-panel">
        <!-- UPPER BATTLEFIELD: Clean, Unobstructed 6-Slot Table -->
        <div class="combat-battlefield-section combat-center-battlefield" style="background-image: url('${battlefieldBgs[currentBattlefieldTheme] || battlefieldBgs.citadel}');">
          <!-- Prompt Banner (Floating Top: Authentic PC Ribbon) -->
          <div class="battlefield-prompt-banner ${selectedCard ? 'active' : ''}">
            ${selectedCard
              ? `<span style="margin-right:6px;">${selectedCard.type === 'creature'
                  ? `选择位置 ${selectedCard.nameCn}`
                  : (selectedCard.requiresTarget ? `选择目标 ${selectedCard.nameCn}` : `选择施法 ${selectedCard.nameCn}`)}</span>
                 <button class="banner-card-info-btn" id="btn-banner-inspect-card" style="pointer-events:auto; background:rgba(0,0,0,0.65); border:1px solid #ffd700; color:#ffd700; border-radius:4px; padding:1px 7px; font-size:11px; font-weight:800; cursor:pointer;" title="查看卡牌详情">ℹ️ 详情</button>`
              : ''}
          </div>

          <!-- 6 Slots Arena (Centered, leaving generous breathing space around scenery) -->
          <div class="combat-slots-arena">
            <!-- Enemy 6 Slots Row -->
            <div class="combat-slots-lane enemy-lane">
              ${engine.enemyBoard.map((c, idx) => {
                const isTarget = selectedCard?.type === 'spell' && selectedCard.requiresTarget &&
                  selectedCard.targetType !== 'empty_friendly_slot' &&
                  (
                    (!isFriendlyTargetSpell(selectedCard) && selectedCard.targetType !== 'none') ||
                    selectedCard.targetType === 'any_creature' ||
                    selectedCard.targetType === 'enemy_creature'
                  ) && isRestrictedTargetAllowed(selectedCard, c);
                return `
                  <div class="combat-board-slot top-slot ${isTarget ? 'active-target' : ''}" data-side="enemy" data-slot-index="${idx}">
                    <div class="slot-filigree top"></div>
                    ${c ? `
                      <div class="board-card vertical ${c.flying ? 'flying' : ''} ${c.uid === engine.lastSummonedUid ? 'card-summon-settle' : ''}">
                        <img src="${toRel(c.card.imgBigUrl || c.card.imgUrl)}" class="board-card-art" alt="${c.card.nameCn}" />
                        <div class="card-cost-gem">${c.card.cost}</div>
                        <div class="card-stat-atk ${c.buffedAttack || c.currentAttack > c.baseAttack ? 'buffed' : (c.currentAttack < c.baseAttack ? 'debuffed' : '')}" title="攻击力: ${c.currentAttack} (基础: ${c.baseAttack})">${c.currentAttack}</div>
                        <div class="card-stat-hp" title="生命值: ${c.currentLife}">${c.currentLife}</div>
                        ${c.skipNextAttack ? '<div class="vfx-stunned-stars" title="跳过攻击/眩晕"></div>' : ''}
                      </div>
                    ` : '<div class="empty-slot-label">' + (idx + 1) + '</div>'}
                    <div class="slot-filigree bottom"></div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Player 6 Slots Row -->
            <div class="combat-slots-lane player-lane">
              ${engine.playerBoard.map((c, idx) => {
                const isCreatureTarget = selectedCard?.type === 'creature' && (
                  selectedCard.onSummon === 'forest_wolf_devour'
                    ? c?.card.id === 'forest_magic_rabbit'
                    : (selectedCard.id === 'death_emissary_of_dorlak' ? c !== null : c === null)
                );
                const isFalconMoveTarget = selectedCard?.targetType === 'empty_friendly_slot' && c === null;
                const isFriendlySpellTarget = selectedCard?.type === 'spell' && selectedCard.requiresTarget &&
                  (isFriendlyTargetSpell(selectedCard) || selectedCard.targetType === 'any_creature') &&
                  selectedCard.targetType !== 'empty_friendly_slot' &&
                  c !== null && !c.spellImmune;
                const isTarget = isCreatureTarget || isFalconMoveTarget || isFriendlySpellTarget;
                return `
                  <div class="combat-board-slot bottom-slot ${isTarget ? 'active-target' : ''}" data-side="player" data-slot-index="${idx}">
                    <div class="slot-filigree top"></div>
                    ${c ? `
                      <div class="board-card vertical ${c.flying ? 'flying' : ''} ${c.uid === engine.lastSummonedUid ? 'card-summon-settle' : ''}">
                        <img src="${toRel(c.card.imgBigUrl || c.card.imgUrl)}" class="board-card-art" alt="${c.card.nameCn}" />
                        <div class="card-cost-gem">${c.card.cost}</div>
                        <div class="card-stat-atk ${c.buffedAttack || c.currentAttack > c.baseAttack ? 'buffed' : (c.currentAttack < c.baseAttack ? 'debuffed' : '')}" title="攻击力: ${c.currentAttack} (基础: ${c.baseAttack})">${c.currentAttack}</div>
                        <div class="card-stat-hp" title="生命值: ${c.currentLife}">${c.currentLife}</div>
                        ${c.skipNextAttack ? '<div class="vfx-stunned-stars" title="跳过攻击/眩晕"></div>' : ''}
                      </div>
                    ` : '<div class="empty-slot-label">' + (idx + 1) + '</div>'}
                    <div class="slot-filigree bottom"></div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- LOWER HAND SECTION: 5 Columns of 4 Tall Vertical CCG Cards with Elemental Framing -->
        <div class="combat-hand-section">
          <!-- 5-Column 20-Card Grid (Framed with Elemental Borders) -->
          <div class="combat-hand-grid">
            ${elementsOrder.map((elem, idx) => {
              const targetHand = showOpponentHand ? engine.getEffectiveHand('enemy') : engine.getEffectiveHand('player');
              const targetSpecialElem = showOpponentHand ? e.specialElement : p.specialElement;
              const targetSpecialClass = showOpponentHand ? e.className : p.className;
              const currentSpecialName = showOpponentHand ? eSpecialName : pSpecialName;

              let cardsOfElem = idx === 4
                ? targetHand.filter((c) =>
                    c.element === targetSpecialElem ||
                    c.element === 'special' ||
                    (targetSpecialClass && c.className === targetSpecialClass)
                  )
                : targetHand.filter((c) => c.element === elem);

              if (idx === 4 && cardsOfElem.length === 0) {
                cardsOfElem = targetHand.slice(16, 20);
              }

              const colLabel = idx === 4 ? currentSpecialName : elemNames[elem];
              const elemIcons: Record<string, string> = { fire: '🔥', water: '💧', air: '⚡', earth: '🌿', special: '🔮', death: '💀', holy: '✨', mechanics: '⚙️', control: '👁️', chaos: '🌀', illusion: '🎭', sorcery: '🔮' };
              const icon = elemIcons[elem] || '🔮';
              const colMana = (showOpponentHand ? e.mana[elem] : p.mana[elem]) || 0;

              const labelFontSize = colLabel.length >= 4 
                ? 'font-size: clamp(9px, 0.75vw, 11px);' 
                : colLabel.length >= 3 
                  ? 'font-size: clamp(10px, 0.85vw, 12px);' 
                  : 'font-size: clamp(12px, 1vw, 14px);';

              return `
                <div class="hand-column elem-${elem}">
                  <div class="hand-column-header elem-${elem}">
                    <span class="col-icon">${icon}</span>
                    <span class="col-label" style="${labelFontSize}" title="${colLabel}">${colLabel}</span>
                    <span class="col-mana-badge" title="${colLabel}能量">${colMana}</span>
                  </div>
                  <div class="hand-column-cards">
                    ${cardsOfElem.map((card) => {
                      // Hand cells are wide strips (~2.7–4.2 : 1), so spell/ability cards use the
                      // wide banner art (whole circular motif + art-filled surround) while creature
                      // paintings keep the large art.
                      const cardImg = card.type === 'spell'
                        ? (card.imgUrl || card.imgBigUrl)
                        : (card.imgBigUrl || card.imgUrl);
                      if (showOpponentHand) {
                        const isRevealed = (currentBattleSource === 'campaign' && completedCampaignLevels.includes(6))
                          ? true
                          : (engine.enemyRevealedCardIds.has(card.id) || (card.isActivatedAbility && engine.enemyRevealedCardIds.has(card.id.replace('ability_', ''))));
                        const isSelected = selectedCard?.id === card.id || inspectedCard?.id === card.id;

                        if (isRevealed) {
                          const effCost = engine.getCardEffectiveCost('enemy', card);
                          const isCostModified = effCost !== card.cost;
                          const costDiffClass = isCostModified ? (effCost > card.cost ? 'cost-increased' : 'cost-discounted') : '';
                          return `
                            <div class="combat-hand-card-item hand-card-cell vertical elem-${card.element} type-${card.type} revealed ${isSelected ? 'selected' : ''}" data-card-id="${card.id}" data-is-opponent="true">
                              <img src="${toRel(cardImg)}" class="hand-card-art ${card.type === 'spell' ? 'spell-art' : ''}" alt="${card.nameCn}" />
                              <div class="card-cost-gem elem-${card.element} ${costDiffClass}" title="${isCostModified ? `原基础费用: ${card.cost}，环境修正后实收: ${effCost}` : `费用: ${effCost}`}">${effCost}</div>
                              ${lifeCostBadge(card)}
                              ${card.type === 'creature' ? `
                                <div class="card-stats-badges">
                                  <div class="card-stat-atk" title="攻击力: ${formatCardAtk(card.attack)}">${formatCardAtk(card.attack)}</div>
                                  <div class="card-stat-hp" title="生命值: ${card.life}">${card.life}</div>
                                </div>
                              ` : ''}
                            </div>
                          `;
                        } else {
                          return `
                            <div class="combat-hand-card-item hand-card-cell vertical elem-${elem} face-down ${isSelected ? 'selected' : ''}" data-card-id="${card.id}" data-is-opponent="true" title="敌方手牌（未明示）">
                              <div class="face-down-inner">
                                <div class="face-down-dragon-seal">${icon}</div>
                                <div class="face-down-label">未知</div>
                              </div>
                            </div>
                          `;
                        }
                      } else {
                        const effCost = engine.getCardEffectiveCost('player', card);
                        const isCostModified = effCost !== card.cost;
                        const costDiffClass = isCostModified ? (effCost > card.cost ? 'cost-increased' : 'cost-discounted') : '';
                        const canAfford = p.mana[card.element] >= effCost && (!card.lifeCost || p.hp > card.lifeCost);
                        const isSelected = selectedCard?.id === card.id;
                        return `
                          <div class="combat-hand-card-item hand-card-cell vertical elem-${card.element} type-${card.type} ${canAfford ? 'playable' : 'disabled'} ${isSelected ? 'selected' : ''}" data-card-id="${card.id}">
                            <img src="${toRel(cardImg)}" class="hand-card-art ${card.type === 'spell' ? 'spell-art' : ''}" alt="${card.nameCn}" />
                            <div class="card-cost-gem elem-${card.element} ${costDiffClass}" title="${isCostModified ? `原基础费用: ${card.cost}，环境修正后实收: ${effCost}` : `费用: ${effCost}`}">${effCost}</div>
                            ${lifeCostBadge(card)}
                            ${card.type === 'creature' ? `
                              <div class="card-stats-badges">
                                <div class="card-stat-atk" title="攻击力: ${formatCardAtk(card.attack)}">${formatCardAtk(card.attack)}</div>
                                <div class="card-stat-hp" title="生命值: ${card.life}">${card.life}</div>
                              </div>
                            ` : ''}
                          </div>
                        `;
                      }
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
    ${showSurrenderModal ? renderSurrenderModal() : ''}
    ${aiAnnouncedCard ? renderAiAnnouncementModal(aiAnnouncedCard) : ''}
    ${showRulesModal ? renderBattlefieldRulesModal() : ''}
    ${showCombatLogsModal ? renderCombatLogsModal() : ''}
    ${showCardDetailModal && detailedCard ? renderCardDetailModal() : ''}
  `;
}

function renderCombatLogsModal(): string {
  return `
    <div class="modal-overlay" id="combat-logs-modal-overlay">
      <div class="stone-options-dialog" style="width:min(580px, 94vw); max-height:85vh; display:flex; flex-direction:column; padding:0; overflow:hidden;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%); display:flex; justify-content:space-between; align-items:center; padding:10px 18px; flex-shrink:0;">
          <div class="options-title-text" style="color:#e0e7ff; font-size:16px;">📜 战斗实况记录 (${engine.logs.length}条)</div>
          <button class="modal-close-btn" id="btn-close-combat-logs" style="position:static; width:32px; height:32px; font-size:20px; cursor:pointer;" title="关闭">×</button>
        </div>
        <div class="combat-log-modal-scroll" id="combat-log-modal-scroll" style="flex:1; overflow-y:auto; padding:12px 14px; display:flex; flex-direction:column; gap:6px; background:#f5edd9 url('/ui/Paper.png') center / 100% 100% no-repeat;">
          ${engine.logs.length === 0 ? '<div class="combat-log-line info" style="font-size:13px; color:#5c4033; padding:8px;">对决刚刚开始，准备出牌...</div>' : ''}
          ${[...engine.logs].reverse().map(l => `
            <div class="combat-log-line ${l.type}" style="font-size:12.5px; line-height:1.45; padding:5px 8px; border-radius:4px; border:1px solid rgba(142,114,58,0.25); background:rgba(255,255,255,0.7);">${l.text}</div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderCardDetailModal(): string {
  if (!detailedCard) return '';
  const card = detailedCard;
  const creature = detailedCreatureSlot?.creature;
  const side = detailedCreatureSlot?.side || inspectedCardSide || 'player';
  const effCost = (currentView === 'battle' && engine) ? engine.getCardEffectiveCost(side, card) : card.cost;
  const costDiffText = effCost !== card.cost
    ? `${effCost}费 (原${card.cost}费 ${effCost > card.cost ? `🔺+${effCost - card.cost}` : `🔻-${card.cost - effCost}`})`
    : `${card.cost}费`;
  const elemNames: Record<string, string> = { fire: '火系', water: '水系', air: '气系', earth: '土系', special: '巫术', death: '死灵', holy: '圣职', mechanics: '机械', control: '支配', chaos: '混沌', illusion: '幻术', beast: '驯兽', chrono: '时空', goblin: '地精', forest: '森林', golem: '魔匠', cult: '邪教', blood: '鲜血', spectromancer: '战场造物' };
  const elemBadge = card.className ? (HERO_CLASSES.find(c => c.id === card.className)?.nameCn || '专属') : (elemNames[card.element] || '基础');

  return `
    <div class="modal-overlay" id="card-detail-modal-overlay">
      <div class="stone-options-dialog" style="width:min(440px, 92vw); max-height:88vh; display:flex; flex-direction:column; padding:0; overflow:hidden; border-radius:12px; box-shadow:0 12px 36px rgba(0,0,0,0.85);">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #2b1d0c 0%, #4a3418 50%, #2b1d0c 100%); display:flex; justify-content:space-between; align-items:center; padding:10px 16px; flex-shrink:0;">
          <div class="options-title-text" style="color:#ffd700; font-size:16px; font-weight:900;">
            ${card.nameCn} <span style="font-size:13px; color:#e2c079;">(${costDiffText})</span>
          </div>
          <button class="modal-close-btn" id="btn-close-card-detail" style="position:static; width:30px; height:30px; font-size:20px; cursor:pointer;" title="关闭">×</button>
        </div>
        <div style="flex:1; overflow-y:auto; padding:14px; background:#f5edd9 url('/ui/Paper.png') center / 100% 100% no-repeat; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; gap:14px; align-items:center;">
            <img src="${toRel(card.imgBigUrl || card.imgUrl)}" style="width:105px; height:105px; object-fit:contain; border-radius:8px; border:2px solid #b89355; box-shadow:0 4px 12px rgba(0,0,0,0.35); flex-shrink:0; background:#1e140d;" alt="${card.nameCn}" />
            <div style="flex:1; display:flex; flex-direction:column; gap:4px; min-width:0;">
              <div style="font-size:14px; font-weight:900; color:#451a03;">${card.name}</div>
              <div style="font-size:12px; color:#854d0e; font-weight:700;">
                ${elemBadge} · ${card.type === 'creature' ? '生物' : '法术'}
              </div>
              ${card.type === 'creature' ? `
                <div style="display:flex; gap:8px; margin-top:4px;">
                  <span style="font-size:12.5px; padding:2px 8px; border-radius:4px; font-weight:900; background:#dc2626; color:#fff;">⚔️ 攻击: ${creature ? creature.currentAttack : formatCardAtk(card.attack)}</span>
                  <span style="font-size:12.5px; padding:2px 8px; border-radius:4px; font-weight:900; background:#16a34a; color:#fff;">❤️ 生命: ${creature ? creature.currentLife : card.life}${creature ? `/${creature.maxLife}` : ''}</span>
                </div>
              ` : ''}
            </div>
          </div>

          ${creature ? `
            <div style="font-size:11.5px; padding:6px 10px; border-radius:6px; background:rgba(217,119,6,0.12); border:1px solid rgba(217,119,6,0.3); color:#92400e; font-weight:700;">
              【当前阵线状态】${side === 'player' ? '己方' : '敌方'} [${creature.slotIndex + 1}号位] ·
              基础攻/命: ${creature.baseAttack}/${creature.maxLife}
              ${creature.flying ? ' · 🕊️ 飞行' : ''}
              ${creature.spellImmune ? ' · 🛡️ 魔免' : ''}
              ${creature.skipNextAttack ? ' · 💫 眩晕待机' : ''}
            </div>
          ` : ''}

          <div style="font-size:13px; line-height:1.6; color:#27180c; background:rgba(255,255,255,0.7); padding:10px 12px; border-radius:8px; border:1px solid #d4b378; word-break:break-word;">
            ${card.desc}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderBattlefieldRulesModal(): string {
  let title = '当前战场特殊规则';
  let bodyHtml = '';

  if (currentBattleSource === 'league') {
    const opp = (tournamentData as any[]).find((t: any) => t.cnName === engine.enemy.name || t.engName === engine.enemy.name || t.name === engine.enemy.name);
    const ruleText = (engine.leagueRule || opp?.rule || '无特殊战规，遵循常规联赛决斗规则。').replace(/\r?\n/g, ' ');
    const oppClassObj = HERO_CLASSES.find(c => c.id === engine.enemy.className);
    title = `英雄大师赛 · 专属特技战规 (${engine.enemy.name})`;
    bodyHtml = `
      <div style="font-size:clamp(17px, 1.4vw, 22px); margin-bottom:12px; color:#5c2c10; font-weight:900;">
        对手：${engine.enemy.name} · ${oppClassObj?.nameCn || engine.enemy.className} (第 ${activeLeague?.currentMatch || 1} 场)
      </div>
      <div style="background:rgba(142,114,58,0.18); border-left:4px solid #8e723a; padding:12px 16px; border-radius:6px; font-size:clamp(16px, 1.3vw, 20px); line-height:1.65; color:#221508; font-weight:800;">
        ⚡ <strong>专属特技：</strong>${ruleText}
      </div>
    `;
  } else if (currentBattleSource === 'campaign') {
    const lvl = engine.campaignLevel || (campaignData as CampaignLevel[]).find(l => l.id === selectedCampaignLevelId) || (campaignData as CampaignLevel[])[0];
    title = `战役关卡 · ${lvl.oppName} (${lvl.title})`;
    bodyHtml = `
      <div style="font-size:clamp(17px, 1.4vw, 22px); margin-bottom:12px; color:#5c2c10; font-weight:900;">
        领地首领：${lvl.oppName} · ${lvl.title} (生命值: ${lvl.enemyHp})
      </div>
      <div style="margin-bottom:14px; font-size:clamp(15.5px, 1.25vw, 19.5px); line-height:1.6; color:#2a1a0e; font-weight:700;">
        <strong style="color:#5c2c10;">📜 领地战况：</strong>
        <div style="margin-top:6px; line-height:1.65;">${formatStoryText(lvl.story)}</div>
      </div>
      ${lvl.rules ? `
        <div style="background:rgba(142,114,58,0.18); border-left:4px solid #8e723a; padding:12px 16px; border-radius:6px; font-size:clamp(16px, 1.3vw, 20px); line-height:1.65; color:#221508; font-weight:800;">
          ⚡ <strong>特殊战规：</strong>
          <div style="margin-top:6px; line-height:1.65;">${formatStoryText(lvl.rules)}</div>
        </div>
      ` : `
        <div style="background:rgba(142,114,58,0.18); border-left:4px solid #8e723a; padding:12px 16px; border-radius:6px; font-size:clamp(16px, 1.3vw, 20px); line-height:1.65; color:#221508; font-weight:800;">
          标准战役对决：将敌方守关领主生命值清零即可攻克该领地。
        </div>
      `}
    `;
  } else if (currentBattleSource === 'lan') {
    title = '局域网对决 · 实时联机';
    bodyHtml = `
      <div style="font-size:clamp(17px, 1.4vw, 22px); margin-bottom:12px; color:#1e3a8a; font-weight:900;">
        对手：${engine.enemy.name} · ${HERO_CLASSES.find(c => c.id === engine.enemy.className)?.nameCn || engine.enemy.className}
      </div>
      <div style="background:rgba(30,58,138,0.12); border-left:4px solid #3b82f6; padding:12px 16px; border-radius:6px; font-size:clamp(15px, 1.2vw, 19px); line-height:1.65; color:#1e293b; font-weight:800;">
        📶 <strong>联机环境：</strong>局域网 WebRTC P2P 直连通道，状态全同步。<br>
        ⚡ <strong>规则：</strong>标准决斗规则，消灭对方英雄生命值即可斩获胜利。
      </div>
    `;
  } else if (currentBattleSource === 'custom_deck') {
    title = '自组卡牌实战决斗';
    bodyHtml = `
      <div style="font-size:clamp(16px, 1.3vw, 20px); line-height:1.7; color:#26180c; font-weight:700;">
        <p style="margin:0 0 10px 0;"><strong>对决机制：</strong>双方使用各自的 20 张专属构筑牌组（火、水、气、土及专属流派各 4 张）。</p>
        <p style="margin:0;"><strong>能量增长：</strong>每回合自动增长各系元素能量，通过合理布局生物攻防与法术轰杀，消灭对方英雄获胜。</p>
      </div>
    `;
  } else if (currentBattleSource === 'ai_duel') {
    title = '🔮 AI 巅峰对决 · 神谕大模型战规';
    const ruleText = engine.leagueRule || '大模型神级魔导对弈：双方具备极高策略算力与实时对白心智。';
    bodyHtml = `
      <div style="font-size:clamp(17px, 1.4vw, 22px); margin-bottom:12px; color:#581c87; font-weight:900;">
        ${engine.isPlayerAiControlled ? `👁️ 神谕上帝观战：【${engine.player.name}】VS【${engine.enemy.name}】` : `🔮 玩家对决：【玩家】VS【${engine.enemy.name}】`} (难度: ${engine.difficulty})
      </div>
      <div style="background:rgba(147,51,234,0.12); border-left:4px solid #a855f7; padding:12px 16px; border-radius:6px; font-size:clamp(16px, 1.3vw, 20px); line-height:1.65; color:#3b0764; font-weight:800;">
        ⚡ <strong>场景法则：</strong>${ruleText}
      </div>
    `;
  } else {
    title = '单局对决 · 战场环境法则';
    const ruleText = engine.leagueRule || '标准单场对决：双方各 60 点生命值，每回合轮流召唤生物或施展法术。';
    bodyHtml = `
      <div style="font-size:clamp(17px, 1.4vw, 22px); margin-bottom:12px; color:#5c2c10; font-weight:900;">
        对决难度：${engine.difficulty || '普通'} · 战场环境：${getThemeName(currentBattlefieldTheme)}
      </div>
      <div style="background:rgba(142,114,58,0.18); border-left:4px solid #8e723a; padding:12px 16px; border-radius:6px; font-size:clamp(16px, 1.3vw, 20px); line-height:1.65; color:#221508; font-weight:800;">
        ⚡ <strong>场景法则：</strong>${ruleText}
      </div>
    `;
  }

  return `
    <div class="combat-rules-modal-overlay" id="combat-rules-modal-overlay">
      <div class="combat-rules-modal">
        <div class="combat-rules-title" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>📜</span>
            <span>${title}</span>
          </div>
          <button class="modal-close-btn" id="btn-close-rules-modal" style="position:static; width:36px; height:36px; font-size:24px; font-weight:900; cursor:pointer;" title="关闭规则">×</button>
        </div>
        <div class="combat-rules-body">
          ${bodyHtml}
        </div>
      </div>
    </div>
  `;
}

function formatStoryText(text: string): string {
  if (!text) return '';
  return text
    .split(/\r?\n\r?\n/)
    .map(paragraph => paragraph.replace(/\r?\n/g, ''))
    .join('<br><br>');
}

// ==========================================
// RENDER MODE 1: CAMPAIGN WORLD MAP (Image 1)
// ==========================================
function renderCampaignMapScreen(): string {
  unlockedCampaignLevels = computeUnlockedCampaignLevels(completedCampaignLevels);

  if (!unlockedCampaignLevels.includes(selectedCampaignLevelId)) {
    const nextUncompleted = unlockedCampaignLevels.find(id => !completedCampaignLevels.includes(id));
    selectedCampaignLevelId = nextUncompleted || unlockedCampaignLevels[unlockedCampaignLevels.length - 1] || 1;
  }
  const currentLvl = (campaignData as CampaignLevel[]).find(l => l.id === selectedCampaignLevelId) || (campaignData as CampaignLevel[])[0];

  const currentMapBg = campaignMapIndex === 3
    ? './ui/Campaign_Map3.jpg'
    : (campaignMapIndex === 2 ? './ui/Campaign_Map2.jpg' : './ui/Campaign_Map1.jpg');
  const activeNodes = campaignMapIndex === 3
    ? CAMPAIGN_MAP3_NODES
    : (campaignMapIndex === 2 ? CAMPAIGN_MAP2_NODES : CAMPAIGN_MAP1_NODES);
  const activeRoutes = campaignMapIndex === 3
    ? CAMPAIGN_MAP3_ROUTES
    : (campaignMapIndex === 2 ? CAMPAIGN_MAP2_ROUTES : CAMPAIGN_MAP1_ROUTES);
  const portal1Unlocked = completedCampaignLevels.includes(8);
  const portal2Unlocked = completedCampaignLevels.includes(16);

  const bannerText = campaignMapIndex === 1
    ? '第一大陆 · 黎明平原与要塞 (第 1 ~ 8 关)'
    : (campaignMapIndex === 2
        ? '第二大陆 · 元素荒原与苍穹 (第 9 ~ 16 关)'
        : '第三大陆 · 龙之群峰与终焉神殿 (第 17 ~ 23 关)');

  return `
    <div class="campaign-screen-view">
      <div class="campaign-map-viewport" id="campaign-map-viewport">
        <div class="campaign-map-stage" id="campaign-map-stage">
          <img src="${currentMapBg}" class="campaign-map-bg" alt="战役大地图" />

          <!-- 路线 SVG 连线层 -->
          <svg class="campaign-map-routes" viewBox="0 0 1024 592">
            ${activeRoutes.map(route => {
              const fromNode = activeNodes.find(n => n.levelId === route.from);
              const toNode = activeNodes.find(n => n.levelId === route.to);
              if (!fromNode || !toNode) return '';
              const x1 = (fromNode.x / 100) * 1024;
              const y1 = (fromNode.y / 100) * 592;
              const x2 = (toNode.x / 100) * 1024;
              const y2 = (toNode.y / 100) * 592;
              const isCompleted = completedCampaignLevels.includes(route.to);
              const isAvailable = unlockedCampaignLevels.includes(route.to) && completedCampaignLevels.includes(route.from);
              const lineClass = isCompleted ? 'route-completed' : (isAvailable ? 'route-available' : 'route-locked');
              return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="campaign-route-line ${lineClass}" />`;
            }).join('')}
          </svg>

          <div class="campaign-top-banner-wrap">
            <div class="campaign-top-banner">
              <span>${bannerText}</span>
            </div>
          </div>

          ${activeNodes.map(n => {
            const isSelected = n.levelId === selectedCampaignLevelId;
            const isCompleted = completedCampaignLevels.includes(n.levelId);
            const isUnlocked = unlockedCampaignLevels.includes(n.levelId);
            const stateClass = isCompleted ? 'completed' : (isUnlocked ? 'available' : 'locked');
            return `
              <div class="campaign-node ${stateClass} ${isSelected ? 'selected' : ''}"
                   data-level-id="${n.levelId}"
                   data-unlocked="${isUnlocked ? '1' : '0'}"
                   style="left: ${n.x}%; top: ${n.y}%;"
                   title="第 ${n.levelId} 关 · ${n.name} (${n.landmark})">
                <div class="campaign-node-badge-title">第 ${n.levelId} 关 · ${n.name}</div>
                <div class="campaign-node-avatar-frame">
                  <img src="${n.face}" class="campaign-node-img" alt="${n.name}" />
                  ${isCompleted ? '<div class="campaign-node-status-badge">✓</div>' : ''}
                  ${!isUnlocked ? '<div class="campaign-node-lock-badge">🔒</div>' : ''}
                </div>
                <div class="campaign-node-landmark-tag">${n.landmark}</div>
                <div class="campaign-node-pointer"></div>
              </div>
            `;
          }).join('')}

          ${campaignMapIndex === 1 ? `
            <!-- Map 1 星门: 前往第二大陆 -->
            <div class="campaign-node campaign-portal ${portal1Unlocked ? 'portal-active available' : 'locked'}"
                 data-portal-target="2"
                 data-unlocked="${portal1Unlocked ? '1' : '0'}"
                 style="left: ${CAMPAIGN_PORTAL_MAP1.x}%; top: ${CAMPAIGN_PORTAL_MAP1.y}%;"
                 title="${portal1Unlocked ? '星门 · 穿越至第二大陆 (第9~16关)' : '星门 (需击败第8关博瑞激活)'}">
              <div class="campaign-node-badge-title">${portal1Unlocked ? '✨ 星门 · 前往第二大陆 ➔' : '🔒 星门 (未激活)'}</div>
              <div class="campaign-node-avatar-frame">
                <span class="campaign-portal-icon">🌀</span>
                ${!portal1Unlocked ? '<div class="campaign-node-lock-badge">🔒</div>' : ''}
              </div>
              <div class="campaign-node-landmark-tag">星魂传送门</div>
              <div class="campaign-node-pointer"></div>
            </div>
          ` : (campaignMapIndex === 2 ? `
            <!-- Map 2 星门: 返回第一大陆 -->
            <div class="campaign-node campaign-portal portal-active available"
                 data-portal-target="1"
                 data-unlocked="1"
                 style="left: ${CAMPAIGN_PORTAL_MAP2_TO_1.x}%; top: ${CAMPAIGN_PORTAL_MAP2_TO_1.y}%;"
                 title="星门 · 返回第一大陆 (第1~8关)">
              <div class="campaign-node-badge-title">⬅ 星门 · 返回第一大陆</div>
              <div class="campaign-node-avatar-frame">
                <span class="campaign-portal-icon">🚪</span>
              </div>
              <div class="campaign-node-landmark-tag">星魂传送门</div>
              <div class="campaign-node-pointer"></div>
            </div>

            <!-- Map 2 星门: 前往第三大陆 -->
            <div class="campaign-node campaign-portal ${portal2Unlocked ? 'portal-active available' : 'locked'}"
                 data-portal-target="3"
                 data-unlocked="${portal2Unlocked ? '1' : '0'}"
                 style="left: ${CAMPAIGN_PORTAL_MAP2_TO_3.x}%; top: ${CAMPAIGN_PORTAL_MAP2_TO_3.y}%;"
                 title="${portal2Unlocked ? '星门 · 穿越至第三大陆 (第17~23关)' : '星门 (需击败第16关弗斯拉夫激活)'}">
              <div class="campaign-node-badge-title">${portal2Unlocked ? '✨ 星门 · 前往第三大陆 ➔' : '🔒 星门 (未激活)'}</div>
              <div class="campaign-node-avatar-frame">
                <span class="campaign-portal-icon">🌀</span>
                ${!portal2Unlocked ? '<div class="campaign-node-lock-badge">🔒</div>' : ''}
              </div>
              <div class="campaign-node-landmark-tag">星魂传送门</div>
              <div class="campaign-node-pointer"></div>
            </div>
          ` : `
            <!-- Map 3 星门: 返回第二大陆 -->
            <div class="campaign-node campaign-portal portal-active available"
                 data-portal-target="2"
                 data-unlocked="1"
                 style="left: ${CAMPAIGN_PORTAL_MAP3.x}%; top: ${CAMPAIGN_PORTAL_MAP3.y}%;"
                 title="星门 · 返回第二大陆 (第9~16关)">
              <div class="campaign-node-badge-title">⬅ 星门 · 返回第二大陆</div>
              <div class="campaign-node-avatar-frame">
                <span class="campaign-portal-icon">🚪</span>
              </div>
              <div class="campaign-node-landmark-tag">星魂传送门</div>
              <div class="campaign-node-pointer"></div>
            </div>
          `)}
        </div>

        <!-- 悬浮地图操控按钮 -->
        <div class="campaign-map-controls">
          <div class="campaign-continent-selector-box" title="战役大陆切换 (当前：第 ${campaignMapIndex} 大陆)">
            <div class="continent-selector-header">
              <span class="continent-hdr-icon">🗺️</span>
              <span class="continent-hdr-title">大陆 ${campaignMapIndex}</span>
            </div>
            <div class="continent-btn-row">
              <button class="continent-nav-btn ${campaignMapIndex === 1 ? 'active' : ''}" data-target-map="1" title="第一大陆 · 黎明平原与要塞 (第1~8关)${campaignMapIndex === 1 ? '【当前所在】' : ''}">Ⅰ</button>
              <button class="continent-nav-btn ${campaignMapIndex === 2 ? 'active' : ''}" data-target-map="2" title="第二大陆 · 元素荒原与苍穹 (第9~16关)${campaignMapIndex === 2 ? '【当前所在】' : ''}">Ⅱ</button>
              <button class="continent-nav-btn ${campaignMapIndex === 3 ? 'active' : ''}" data-target-map="3" title="第三大陆 · 龙之群峰与终焉神殿 (第17~23关)${campaignMapIndex === 3 ? '【当前所在】' : ''}">Ⅲ</button>
            </div>
          </div>
          <div class="campaign-ctrl-btn-group">
            <button class="map-ctrl-btn" id="btn-campaign-zoom-in" title="放大地图 (或鼠标滚轮向上)">＋</button>
            <button class="map-ctrl-btn" id="btn-campaign-zoom-out" title="缩小地图 (或鼠标滚轮向下)">－</button>
            <button class="map-ctrl-btn" id="btn-campaign-recenter" title="聚焦当前关卡">🎯</button>
            <button class="map-ctrl-btn" id="btn-campaign-fit" title="全景居中 (自适应屏幕)">🗺️</button>
          </div>
        </div>

        <div class="campaign-map-drag-hint">
          <span>🖱️ 拖拽平移 · 滚轮/按钮缩放 · 点击关卡挑战 · 星门穿越大陆</span>
        </div>
      </div>

      <div class="campaign-bottom-deck ${isCampaignDeckCollapsed ? 'collapsed' : ''}" id="campaign-bottom-deck">
        <!-- 折叠/展开悬浮控制手柄 -->
        <button class="campaign-deck-toggle-btn" id="btn-campaign-toggle-deck" title="${isCampaignDeckCollapsed ? '展开战役详情面板' : '收起面板，畅享全景大地图'}">
          <span class="toggle-icon">${isCampaignDeckCollapsed ? '▲ 展开面板' : '▼ 收起面板'}</span>
        </button>

        <!-- 收起时的极简迷你快捷条 (Mini HUD) -->
        <div class="campaign-deck-mini-bar" id="campaign-deck-mini-bar">
          <div class="mini-bar-left">
            <span class="mini-level-badge">第 ${currentLvl.id} 关</span>
            <span class="mini-opp-name">${currentLvl.oppName} · ${currentLvl.title}</span>
            <span class="mini-opp-hp">❤️ ${currentLvl.enemyHp}</span>
          </div>
          <div class="mini-bar-right">
            ${hasSavedCampaignBattle(activeCampaign?.id) ? `
              <button class="mini-pc-btn resume-btn" id="btn-mini-resume-battle">接续战斗</button>
            ` : ''}
            <button class="mini-pc-btn start-btn" id="btn-mini-start-battle">${unlockedCampaignLevels.includes(selectedCampaignLevelId) ? '开始战斗 ⚔️' : '关卡未解锁 🔒'}</button>
            <button class="mini-pc-btn expand-btn" id="btn-mini-expand-deck">展开详情 ▲</button>
          </div>
        </div>

        <div class="campaign-deck-left">
          <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" id="btn-campaign-avatar-click" title="点击查看/切换战役角色">
            <img src="${activeCampaign ? `./faces/Face${activeCampaign.playerFaceId}.jpg` : './faces/Face1.jpg'}" style="width:40px; height:40px; border-radius:6px; border:1.5px solid #d4af37; object-fit:cover;" alt="Avatar" />
            <div style="display:flex; flex-direction:column; text-align:left;">
              <span style="font-size:13px; font-weight:900; color:#ffd700;">${activeCampaign ? activeCampaign.playerName : '战役法师'}</span>
              <span style="font-size:11px; color:#fed7aa;">${HERO_CLASSES[activeCampaign?.playerClassIdx ?? 0]?.nameCn || '僧侣'}</span>
            </div>
          </div>
          <div class="campaign-diff-box">
            <span class="campaign-diff-label">难度:</span>
            <div class="campaign-diff-selector">
              <button class="campaign-diff-btn" id="btn-campaign-diff-prev">◀</button>
              <span class="campaign-diff-value">${campaignDifficulties[campaignDifficultyIndex]}</span>
              <button class="campaign-diff-btn" id="btn-campaign-diff-next">▶</button>
            </div>
          </div>
        </div>

        <div class="campaign-deck-center">
          <div class="campaign-story-header">
            <span class="campaign-story-title">${currentLvl.oppName} · ${currentLvl.title}</span>
            <span class="campaign-story-hp">生命值: ${currentLvl.enemyHp}</span>
          </div>
          <div class="campaign-story-text">
            ${formatStoryText(currentLvl.story)}
          </div>
          ${currentLvl.rules ? `
            <div class="campaign-story-rules">
              <strong>战斗特殊规则：</strong>${currentLvl.rules.replace(/\r?\n/g, ' ')}
            </div>
          ` : ''}
        </div>

        <div class="campaign-deck-right">
          ${hasSavedCampaignBattle(activeCampaign?.id) ? `
            <button class="campaign-pc-btn start-btn" id="btn-campaign-resume-battle" style="background:linear-gradient(180deg,#15803d,#166534); border-color:#86efac; box-shadow:0 0 8px rgba(34,197,94,0.6);">接续战斗</button>
          ` : ''}
          <button class="campaign-pc-btn start-btn" id="btn-campaign-start-battle">开始战斗</button>
          <button class="campaign-pc-btn" id="btn-campaign-profile-hub">角色档案</button>
          <button class="campaign-pc-btn" id="btn-campaign-awards">奖品</button>
          <button class="campaign-pc-btn" id="btn-campaign-main-menu">主菜单</button>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// RENDER MODE 2: LEAGUE OF HEROES (Images 2 & 3)
// ==========================================
function updateLeagueSetupInPlace() {
  const overlay = document.getElementById('league-new-char-overlay');
  if (!overlay) return;
  const chosenClass = HERO_CLASSES[leaguePlayerClassIdx] || HERO_CLASSES[3];
  const faceImg = overlay.querySelector('#league-avatar-face-img') as HTMLImageElement;
  if (faceImg) faceImg.src = `./faces/Face${leaguePlayerFaceId}.jpg`;
  const classVal = overlay.querySelector('#league-choice-class-val');
  if (classVal) classVal.textContent = chosenClass.nameCn;
  const diffVal = overlay.querySelector('#league-choice-diff-val');
  if (diffVal) diffVal.textContent = leagueDifficulties[leagueDifficultyIdx];
  const cVal = overlay.querySelector('#league-contestants-count-val');
  if (cVal) cVal.textContent = `${leagueContestantCountChoices[leagueContestantCountIdx]} 人 (含玩家)`;
}

function renderLeagueSetupModal(): string {
  const chosenClass = HERO_CLASSES[leaguePlayerClassIdx] || HERO_CLASSES[3];
  return `
    <div class="league-new-char-overlay" id="league-new-char-overlay">
      <div class="league-new-char-modal">
        <div class="league-modal-title-banner" style="display:flex; justify-content:space-between; align-items:center; padding:8px 16px;">
          <div class="league-modal-title">新角色</div>
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="campaign-pc-btn start-btn" id="btn-league-create-char" style="padding:6px 20px; font-size:15px;">创建</button>
            <button class="modal-close-btn" id="btn-league-close-setup" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;">×</button>
          </div>
        </div>

        <div class="league-modal-content-grid">
          <div class="league-avatar-picker-col">
            <button class="league-arrow-btn" id="btn-league-face-prev">◀</button>
            <div class="league-avatar-portrait-wrap">
              <img src="./faces/Face${leaguePlayerFaceId}.jpg" class="league-avatar-img" id="league-avatar-face-img" alt="头像" />
            </div>
            <button class="league-arrow-btn" id="btn-league-face-next">▶</button>
          </div>

          <div class="league-fields-col">
            <div class="league-field-row">
              <span class="league-field-label">玩家姓名:</span>
              <input type="text" id="league-name-input" value="${leaguePlayerName}" class="league-text-input" maxlength="12" />
            </div>

            <div class="league-field-row">
              <span class="league-field-label">职业:</span>
              <div class="league-choice-stepper">
                <button class="campaign-diff-btn" id="btn-league-class-prev">◀</button>
                <span class="league-choice-val" id="league-choice-class-val">${chosenClass.nameCn}</span>
                <button class="campaign-diff-btn" id="btn-league-class-next">▶</button>
              </div>
            </div>

            <div class="league-field-row">
              <span class="league-field-label">难度:</span>
              <div class="league-choice-stepper">
                <button class="campaign-diff-btn" id="btn-league-diff-prev">◀</button>
                <span class="league-choice-val diff" id="league-choice-diff-val">${leagueDifficulties[leagueDifficultyIdx]}</span>
                <button class="campaign-diff-btn" id="btn-league-diff-next">▶</button>
              </div>
            </div>

            <div class="league-field-row">
              <span class="league-field-label">选手数量:</span>
              <div class="league-choice-stepper">
                <button class="campaign-diff-btn" id="btn-league-contestants-prev">◀</button>
                <span class="league-choice-val diff" id="league-contestants-count-val">${leagueContestantCountChoices[leagueContestantCountIdx]} 人 (含玩家)</span>
                <button class="campaign-diff-btn" id="btn-league-contestants-next">▶</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCampaignTreasuresModal(): string {
  const beaten = completedCampaignLevels;
  const relics = [
    {
      id: 'gryphon',
      name: '伴生驯化狮鹫 (Tamed Gryphon)',
      img: './cards/Griffin.webp',
      req: '通关关卡 1（德米尔）',
      unlocked: beaten.includes(1),
      desc: '在每一场战役开始时，伴生狮鹫（攻击 3 / 生命 18 / 飞行）将直接入驻玩家第 3 号槽位，开局即可形成强大空中火力压制！',
    },
    {
      id: 'health',
      name: '健康护符 (Talisman of Health)',
      img: './ui/rewards/R2001.jpg',
      req: '通关关卡 2（闪银）',
      unlocked: beaten.includes(2),
      desc: '远古守护石碑雕刻的神圣护符，使你在所有战役对决中的基础生命上限由 60 点永久提升至 65 点！',
    },
    {
      id: 'tome',
      name: '狮鹫学之书 (Tome of Gryphonology)',
      img: './ui/rewards/R3001.jpg',
      req: '通关关卡 3（费德米尔）',
      unlocked: beaten.includes(3),
      desc: '古代驯兽大师失传的典籍，使你的伴生狮鹫获得涅槃之术，若在战场阵亡，将自动重铸生机！',
    },
    {
      id: 'signets',
      name: '元素圣戒 (Signets of the Elements)',
      img: './ui/rewards/R4001.jpg',
      req: '通关关卡 4（尼瑞恩）',
      unlocked: beaten.includes(4),
      desc: '火、水、气、土四大元素圣戒，赋予佩戴者澎湃的元素共鸣，每场战役开局时基础四大元素能量各 +1！',
    },
    {
      id: 'blood',
      name: '巨魔之血药剂 (Vial of Troll Blood)',
      img: './cards/Troll.webp',
      req: '通关关卡 5（维兰娜）',
      unlocked: beaten.includes(5),
      desc: '淬炼野蛮巨魔旺盛生命力的魔法药剂，使伴生狮鹫获得每回合自动治愈自愈 +2 生命之强韧被动！',
    },
    {
      id: 'telescope',
      name: '全知望远镜 (Farseeing Telescope)',
      img: './ui/rewards/R3005.jpg',
      req: '通关关卡 6（艾瑞欧）',
      unlocked: beaten.includes(6),
      desc: '能够看穿以太迷雾的古法透镜，在战役对决中洞悉敌方法师的法术底牌！',
    },
    {
      id: 'prism',
      name: '铎拉克巨棱镜碎片 (Fragment of Great Prism)',
      img: './ui/rewards/R5000.jpg',
      req: '通关战役终战（风火天峰）',
      unlocked: beaten.length >= 8,
      desc: '上古传奇法师铎拉克镇压混沌世界的无上神器碎片，象征战役终极救世主的至高殿堂荣耀！',
    },
  ];

  return `
    <div class="modal-overlay" id="campaign-treasures-modal-overlay">
      <div class="stone-options-dialog" style="width:clamp(560px, 62vw, 860px); max-height:88vh; display:flex; flex-direction:column; background: linear-gradient(155deg, rgba(32, 24, 18, 0.98) 0%, rgba(16, 12, 10, 0.99) 100%); border: 2px solid #a8843c;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #16361c 0%, #265930 50%, #16361c 100%); border-bottom: 2px solid #ca8a04; display:flex; justify-content:space-between; align-items:center; padding:10px 20px; flex-shrink:0;">
          <div class="options-title-text" style="color:#fef08a; font-size:clamp(17px, 1.4vw, 21px); font-weight:900; letter-spacing:1px;">🏆 战役圣物殿堂 · 战利品 (Campaign Relics)</div>
          <button class="modal-close-btn" id="btn-close-campaign-treasures" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;" title="关闭">×</button>
        </div>

        <div style="flex:1; overflow-y:auto; padding:clamp(14px, 2vh, 22px); display:flex; flex-direction:column; gap:12px;">
          <div style="background:linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(21,128,61,0.12) 100%); border:1.5px solid #4ade80; border-radius:8px; padding:10px 16px; font-size:12.5px; color:#dcfce7; line-height:1.5;">
            📜 <strong>圣物法则：</strong>击败战役不同区域守护者即可解锁对应上古圣物。已激活的圣物会在后续所有战役对决中自动赋予英雄初始随从、能量增益与被动特权！
          </div>

          <div style="display:flex; flex-direction:column; gap:10px;">
            ${relics.map(r => `
              <div style="background:linear-gradient(135deg, rgba(28, 22, 17, 0.95) 0%, rgba(16, 12, 10, 0.98) 100%); border:1.5px solid ${r.unlocked ? '#ca8a04' : '#4b3c2a'}; border-radius:9px; padding:10px 14px; display:flex; align-items:center; gap:14px; box-shadow:0 4px 12px rgba(0,0,0,0.7), inset 0 0 10px rgba(0,0,0,0.5); opacity:${r.unlocked ? '1' : '0.65'};">
                <div style="width:clamp(52px, 5.5vw, 68px); height:clamp(52px, 5.5vw, 68px); border-radius:8px; border:2px solid ${r.unlocked ? '#ffd700' : '#574632'}; overflow:hidden; flex-shrink:0; box-shadow:0 3px 8px rgba(0,0,0,0.8); position:relative; background:#0a0807;">
                  <img src="${r.img}" alt="${r.name}" style="width:100%; height:100%; object-fit:cover; filter:${r.unlocked ? 'contrast(1.08) brightness(1.05)' : 'grayscale(0.9) brightness(0.55)'};" />
                  ${r.unlocked ? '<div style="position:absolute; inset:0; box-shadow:inset 0 0 8px rgba(255,215,0,0.35); pointer-events:none;"></div>' : ''}
                </div>
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="font-size:clamp(14px, 1.2vw, 16px); font-weight:900; color:${r.unlocked ? '#ffd700' : '#a8947b'}; text-shadow:0 1px 2px #000;">${r.name}</span>
                    <span style="font-size:11.5px; font-weight:900; padding:2px 8px; border-radius:5px; white-space:nowrap; ${r.unlocked ? 'background: linear-gradient(135deg, #854d0e, #a16207); color: #fef08a; border: 1px solid #fde047; box-shadow: 0 0 8px rgba(250, 204, 21, 0.4);' : 'background: rgba(40, 35, 30, 0.8); color: #8c7860; border: 1px solid #574632;'}">
                      ${r.unlocked ? '🌟 已激活生效' : `🔒 未解锁 (${r.req})`}
                    </span>
                  </div>
                  <div style="font-size:12px; color:${r.unlocked ? '#f5dfbe' : '#73614c'}; margin-top:4px; line-height:1.45;">
                    ${r.desc}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLeagueOpponentAdviceModal(): string {
  if (!activeLeague) return '';
  const curOpponent = getNextOpponentForLeague();

  const classAdviceMap: Record<string, { strengths: string; weaknesses: string; tip: string }> = {
    sorcery: {
      strengths: '法术直接伤害高、闪电爆发与直接斩杀能力极强。',
      weaknesses: '随从身板普遍较为脆弱，消耗大量特殊法术能量。',
      tip: '建议早期利用低费生物占据多个槽位，利用石墙或水元素吸收法术火力，尽快压低其血线。',
    },
    necromancer: {
      strengths: '亡者复苏、吸血诅咒、持续消磨敌方生命。',
      weaknesses: '启动偏慢，惧怕圣光净化与大范围群体直伤。',
      tip: '避免留下残血生物被其亡灵吞噬，优先用火球或闪电秒杀其核心召唤物，不给其滚雪球的机会。',
    },
    cleric: {
      strengths: '高额治疗回复、神圣护盾、审判圣裁。',
      weaknesses: '缺乏速杀爆发力，依赖持续站场和随从防御。',
      tip: '切忌拖入慢速消耗战！集中火力定点突破其脆弱槽位，直接打击本体阻断其治疗节奏。',
    },
    mechanician: {
      strengths: '机械自爆装置、炮台阵列、护甲坚硬。',
      weaknesses: '机械零件组装需要充能启动时间，灵活性不足。',
      tip: '在其机械工事未成型前迅速抢攻，利用气系弹射或水系冰冻打乱其阵型配合。',
    },
    dominator: {
      strengths: '心灵控制、操纵敌方生物为己用、扭曲意志。',
      weaknesses: '本体防御羸弱，失去对手生物借力后输出匮乏。',
      tip: '出怪需谨慎，尽量使用具有即时战吼价值的随从或法术，避免召唤超高攻击的大哥被其策反。',
    },
    chaosmaster: {
      strengths: '随机骰子、极度不可预测的混沌波动、高上限爆发。',
      weaknesses: '极其不稳定，下限极低且可能伤及自身。',
      tip: '保持场面稳健，多铺设具有扎实生命值的随从，利用其混沌失控的反噬终结比赛。',
    },
    illusionist: {
      strengths: '幻影替身、闪避致命伤害、虚实难辨。',
      weaknesses: '幻象一旦被识破或承受轻微攻击即破碎消失。',
      tip: '多使用多段伤害或低费 AOE 快速戳破其幻影，破除虚假防御后直捣黄龙。',
    },
    demonologist: {
      strengths: '献祭恶魔、深渊烈焰、恐怖的自残高爆发。',
      weaknesses: '自身生命消耗剧烈，容错率极低。',
      tip: '防范其开局恶魔冲锋，稳住第一波冲击后，其自残扣血将让其迅速进入你的斩杀线。',
    },
    beastmaster: {
      strengths: '野兽群奔、多路开花、狂暴增益。',
      weaknesses: '单卡质量不高，极度惧怕大范围清场法术。',
      tip: '保留水系酸雨、火系流星或气系闪电风暴，等其铺满野兽时一网打尽。',
    },
    chronomancer: {
      strengths: '时间加速、回溯回合、重置技能冷却。',
      weaknesses: '节奏极为严苛，一旦被扰乱关键轮次则前功尽弃。',
      tip: '抓住其时间法术空档期全力输出，逼迫其提前交出保命技能。',
    },
    goblin: {
      strengths: '人海战术、哥布林狂热冲锋、极速铺场抢血。',
      weaknesses: '后劲极差，手牌消耗极快。',
      tip: '起手优先抓取坚固阻挡随从与低费解场牌，只要撑过前 4 回合即胜券在握。',
    },
    forest: {
      strengths: '每回合免费放置的【魔法兔子】会永久成长，暴怒海狸、复仇浣熊与森林仪式都以兔子攻击力结算收益。',
      weaknesses: '幻兔只有 10 点生命，一旦被清除，所有以 X 结算的卡牌收益骤降。',
      tip: '优先用单体伤害法术秒杀【魔法兔子】，迫使其以 0 攻的【森林狼】或空转的森林仪式浪费资源。',
    },
    golem: {
      strengths: '开局即有一只不受魔法与技能伤害的【钢铁魔像】，阵亡后会满血归位（代价仅 10 点生命），军备升级与魔像驯导者可永久堆高它的攻击力。',
      weaknesses: '魔像每次阵亡都要付出 10 点生命，反复阵亡会迅速掏空本体；其余卡牌多为辅助，本身威胁不高。',
      tip: '用高攻生物反复击杀【钢铁魔像】逼迫其不断支付 10 点生命，并优先清掉【魔像教官】以阻止魔像每回合攻击两次。',
    },
    cult: {
      strengths: '狂怒纪念碑让全军每回合多攻击一次，狂热者攻击力每回合 +2 永续成长，掠夺者既替全军承伤又能挡住对手的取巧打法。',
      weaknesses: '舍身圣者每造成一次伤害就自损等量生命，祭碑也随全军输出不断流失生命，整体靠自伤换强度极易自爆。',
      tip: '用低伤害的小生物「喂」给【狂热者】与【狂怒纪念碑】逼其自损；面对【掠夺者】时改用生物强攻而非魔法，并集火点掉纪念碑。',
    },
    blood: {
      strengths: '所有血族卡牌都是「能量 + 生命」双重付费，因此同费下数值远超常规：腐食腐鬼靠敌方尸体无限成长，猩红裁决官让对格生物承伤翻倍，苦痛惩罚者与鲜血贤者把伤痛化为攻击力。',
      weaknesses: '每次施法都要付出生命，本体极易被自己掏空；猩红裁决官、鲜血贤者等核心都依赖对格或对方本体受创才有收益。',
      tip: '保持本体高血量、用高攻生物反复压制【鲜血审判官】；对手生命低于 20 时其血族卡牌几乎无法使用，此时全力抢血即可。',
    },
  };

  const advice = classAdviceMap[curOpponent.className] || {
    strengths: '综合流派实力强劲，擅长多属性法术协同。',
    weaknesses: '能量分配较为分散。',
    tip: '观察其能量储备最多的元素，提前针对其可能打出的强力法术进行防范。',
  };

  return `
    <div class="modal-overlay" id="league-advice-modal-overlay">
      <div class="stone-options-dialog" style="width:clamp(560px, 60vw, 840px); max-height:88vh; display:flex; flex-direction:column;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #451a03 0%, #78350f 50%, #451a03 100%); display:flex; justify-content:space-between; align-items:center; padding:10px 20px; flex-shrink:0;">
          <div class="options-title-text" style="color:#fef08a;">📜 针对下轮对手的对战建议与战术秘卷</div>
          <button class="modal-close-btn" id="btn-close-league-advice" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;" title="关闭">×</button>
        </div>

        <div style="flex:1; overflow-y:auto; padding:clamp(14px, 2vh, 22px); display:flex; flex-direction:column; gap:14px;">
          <!-- Opponent Profile Box -->
          <div style="background:linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(142,114,58,0.1) 100%); border:1.5px solid #d4af37; border-radius:8px; padding:12px 18px; display:flex; align-items:center; gap:16px;">
            <img src="${curOpponent.face}" style="width:68px; height:68px; border-radius:50%; border:2px solid #d4af37; object-fit:cover; box-shadow:0 2px 6px rgba(0,0,0,0.2);" alt="${curOpponent.cnName}" />
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:18px; font-weight:900; color:#3b2308;">${curOpponent.cnName}</span>
                <span style="font-size:13px; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:2px 8px; border-radius:6px; font-weight:bold;">${curOpponent.classCn}</span>
              </div>
              <div style="font-size:13px; color:#5c4028; margin-top:4px;">
                ${curOpponent.rule ? `<strong>特技规则：</strong>${curOpponent.rule.replace(/\r?\n/g, ' ')}` : '精通本流派各阶法术与战斗生物'}
              </div>
            </div>
          </div>

          <!-- Tactical Breakdown -->
          <div style="background:#ffffff; border:1px solid #d4af37; border-radius:8px; padding:14px 18px; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <div style="font-size:15px; font-weight:900; color:#92400e; margin-bottom:8px;">⚔️ 对手流派特点剖析</div>
            <div style="font-size:13.5px; color:#334155; line-height:1.6;">
              • <strong>核心优势：</strong>${advice.strengths}<br>
              • <strong>潜在弱点：</strong>${advice.weaknesses}
            </div>
          </div>

          <!-- Counter Strategy -->
          <div style="background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border:1.5px solid #86efac; border-radius:8px; padding:14px 18px; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <div style="font-size:15px; font-weight:900; color:#166534; margin-bottom:8px;">💡 军师锦囊：克制策略与破局之法</div>
            <div style="font-size:13.5px; color:#14532d; line-height:1.6;">
              ${advice.tip}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLeagueCompletionModal(): string {
  if (!activeLeague) return '';
  const sorted = [...activeLeague.standings].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.wins - a.wins;
  });
  const playerRank = sorted.findIndex(s => s.isPlayer) + 1;
  const isChampion = playerRank === 1;

  return `
    <div class="modal-overlay" id="league-completion-modal-overlay">
      <div class="stone-options-dialog" style="width:clamp(480px, 52vw, 680px); max-height:85vh; display:flex; flex-direction:column; text-align:center;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #451a03 0%, #78350f 50%, #451a03 100%); display:flex; justify-content:space-between; align-items:center; padding:10px 20px; flex-shrink:0;">
          <div class="options-title-text" style="color:#fef08a;">🏆 ${activeLeague.difficulty}联赛 · 赛季荣耀结算</div>
          <button class="modal-close-btn" id="btn-close-league-completion" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer;" title="关闭">×</button>
        </div>

        <div style="padding:28px 24px; display:flex; flex-direction:column; align-items:center; gap:16px;">
          <div style="font-size:64px; line-height:1;">
            ${isChampion ? '👑' : playerRank === 2 ? '🥈' : playerRank === 3 ? '🥉' : '🎖️'}
          </div>
          <div style="font-size:24px; font-weight:900; color:#92400e;">
            ${isChampion ? '恭喜加冕联赛总冠军！' : `荣获第 ${playerRank} 名！`}
          </div>
          <div style="font-size:14.5px; color:#475569; max-width:440px; line-height:1.6;">
            经过常规赛与残酷的淘汰赛角逐，${activeLeague.playerName} 以出色的发挥完成了全部赛程！
          </div>

          <div style="display:flex; justify-content:center; gap:20px; margin-top:8px;">
            <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:8px; padding:10px 24px;">
              <div style="font-size:12px; color:#854d0e;">最终名次</div>
              <div style="font-size:22px; font-weight:900; color:#b45309;">第 ${playerRank} 名</div>
            </div>
            <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:8px; padding:10px 24px;">
              <div style="font-size:12px; color:#854d0e;">累计积分</div>
              <div style="font-size:22px; font-weight:900; color:#b45309;">${sorted.find(s => s.isPlayer)?.score || 0} 分</div>
            </div>
          </div>

          <button class="campaign-pc-btn start-btn" id="btn-league-completion-ok" style="margin-top:16px; padding:10px 36px; font-size:16px;">
            重返联赛大厅
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderLeagueStandingsScreen(): string {
  if (!activeLeague) {
    return renderLeagueSetupModal();
  }

  const sorted = [...activeLeague.standings].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.wins - a.wins;
  });

  const curOpponent = getNextOpponentForLeague();
  const N = activeLeague.totalContestants || 10;
  const regMatches = N - 1;
  const totalMatches = activeLeague.totalMatches || (N + 1);

  let roundText = `场次 ${activeLeague.currentMatch} / ${totalMatches}`;
  if (activeLeague.currentMatch <= regMatches) {
    roundText = `常规赛 · 场次 ${activeLeague.currentMatch} / ${regMatches}`;
  } else if (activeLeague.currentMatch === N) {
    roundText = `四强半决赛 · 淘汰赛`;
  } else if (activeLeague.currentMatch === N + 1) {
    roundText = `巅峰总决赛 · 冠军之战`;
  } else {
    roundText = `联赛已圆满完赛`;
  }

  return `
    <div class="league-standings-view">
      <img src="./ui/Tournament_Bg_New.jpg" class="league-standings-bg" alt="联赛背景" />

      <div class="league-header-banner">
        <div class="league-header-title">${activeLeague.difficulty}联赛</div>
        <div class="league-header-round">${roundText}</div>
      </div>

      <div class="league-table-container">
        <table class="league-table">
          <thead>
            <tr>
              <th style="width:16%;">排名</th>
              <th style="width:42%;">名字</th>
              <th style="width:21%;">胜利</th>
              <th style="width:21%;">得分</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((item, idx) => {
              const isPlayer = item.isPlayer;
              const isNextOpponent = !isPlayer && (item.name === curOpponent.cnName || item.name === curOpponent.name);
              let rowClass = '';
              if (isPlayer) rowClass = 'player-row';
              else if (isNextOpponent) rowClass = 'next-opponent-row';

              return `
                <tr class="${rowClass}">
                  <td>${idx + 1}</td>
                  <td>
                    ${item.name}
                    ${isPlayer ? ' 👑' : ''}
                    ${isNextOpponent ? ' <span class="next-opp-badge">⚔️ 下轮对手</span>' : ''}
                  </td>
                  <td>${item.wins}</td>
                  <td>${item.score}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="campaign-bottom-deck">
        <div class="campaign-deck-left" style="width:clamp(120px, 12vw, 150px);">
          <div class="league-avatar-portrait-wrap" style="width:clamp(64px, 6.5vw, 84px); height:clamp(64px, 6.5vw, 84px); border-radius:50%; margin:auto;">
            <img src="${curOpponent.face}" class="league-avatar-img" alt="${curOpponent.cnName}" />
          </div>
          <div class="campaign-diff-box">
            <span class="campaign-diff-label">难度:</span>
            <span class="campaign-diff-value" style="color:#ffd700;">${activeLeague.difficulty}</span>
          </div>
        </div>

        <div class="campaign-deck-center">
          <div class="campaign-story-header">
            <span class="campaign-story-title">${curOpponent.cnName}，${curOpponent.classCn}</span>
            <span class="campaign-story-hp">${roundText}</span>
          </div>
          <div class="campaign-story-text" style="font-size:clamp(15px, 1.25vw, 19px); padding:6px 0; line-height:1.6;">
            ${formatStoryText(curOpponent.rule)}
          </div>
        </div>

        <div class="campaign-deck-right">
          ${hasSavedLeagueBattle(activeLeague.id) ? `
            <button class="campaign-pc-btn start-btn" id="btn-league-resume-match" style="background:linear-gradient(180deg,#15803d,#166534); border-color:#86efac; box-shadow:0 0 8px rgba(34,197,94,0.6);">接续对决</button>
          ` : ''}
          <button class="campaign-pc-btn start-btn" id="btn-league-start-match">开始战斗</button>
          <button class="campaign-pc-btn" id="btn-league-open-hub" style="color:#ffd700;">角色档案</button>
          <button class="campaign-pc-btn" id="btn-league-advice" style="color:#fef08a;">对战建议</button>
          <button class="campaign-pc-btn" id="btn-league-menu">主菜单</button>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// RENDER MODE 3: CUSTOM DECK BUILDER & HUB (Images 4 & 5)
// ==========================================
function renderCustomDeckHubScreen(): string {
  const currentDeck = customDecks[selectedDeckIdx] || customDecks[0];
  const classObj = HERO_CLASSES.find(c => c.id === currentDeck.className) || HERO_CLASSES[4];

  return `
    <div class="custom-deck-hub-view">
      <img src="./ui/MainMenuBg.jpg" class="custom-deck-hub-bg" alt="自组卡牌背景" />
      <div class="custom-deck-hub-overlay"></div>

      <div class="custom-deck-hub-window">
        <div class="custom-deck-hub-title-banner">
          <div class="custom-deck-hub-title">自组卡牌模式</div>
        </div>

        <div class="custom-deck-hub-grid">
          <div class="custom-deck-hub-left">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="league-field-label">您的牌组:</span>
              <div style="display:flex; gap:6px;">
                <button class="duel-stone-action-btn close" id="btn-deck-edit" style="padding:2px 14px; font-size:12px;">编辑</button>
                <button class="duel-stone-action-btn close" id="btn-deck-delete" style="padding:2px 14px; font-size:12px;">删除</button>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px;">
              <div class="league-choice-stepper" style="flex:1;">
                <button class="campaign-diff-btn" id="btn-deck-prev">◀</button>
                <span class="league-choice-val">${currentDeck.name}</span>
                <button class="campaign-diff-btn" id="btn-deck-next">▶</button>
              </div>
              <button class="duel-stone-action-btn start" id="btn-deck-new" style="padding:5px 16px; font-size:12.5px;">新建</button>
            </div>

            <div class="campaign-deck-center" style="height:clamp(120px, 16vh, 160px); overflow-y:auto;">
              <div class="campaign-story-text">
                您的对手将是一个随机职业角色。
                <br><br>
                当前牌组【<strong>${currentDeck.name}</strong>】归属于 <strong>${classObj.nameCn}</strong> 专精，已构筑 <strong>${currentDeck.cards.length}</strong> / 20 张专属战斗卡牌。
              </div>
            </div>
          </div>

          <div class="custom-deck-hub-right">
            <div class="league-field-row">
              <span class="league-field-label">您的职业:</span>
              <div class="league-choice-stepper">
                <button class="campaign-diff-btn" id="btn-deck-class-prev">◀</button>
                <span class="league-choice-val">${classObj.nameCn}</span>
                <button class="campaign-diff-btn" id="btn-deck-class-next">▶</button>
              </div>
            </div>

            <div class="league-field-row">
              <span class="league-field-label">对手等级:</span>
              <div class="league-choice-stepper">
                <button class="campaign-diff-btn" id="btn-deck-diff-prev">◀</button>
                <span class="league-choice-val diff">${customDeckAiDiffList[customDeckAiDiffIdx]}</span>
                <button class="campaign-diff-btn" id="btn-deck-diff-next">▶</button>
              </div>
            </div>

            <div class="league-field-row">
              <span class="league-field-label">您的对手:</span>
              <div class="custom-deck-opponents-list">
                ${customDeckOpponentList.map((opp, idx) => `
                  <div class="custom-deck-opponent-item ${selectedCustomOpponentIdx === idx ? 'active' : ''}" data-opp-idx="${idx}">
                    ${opp}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:16px; justify-content:center; margin-top:4px;">
          <button class="duel-stone-action-btn start" id="btn-deck-start" style="padding:8px 36px; font-size:15px;">开始</button>
          <button class="duel-stone-action-btn close" id="btn-deck-back" style="padding:8px 36px; font-size:15px;">返回</button>
        </div>
      </div>
    </div>
  `;
}

function renderCustomDeckBuilderScreen(): string {
  const classObj = HERO_CLASSES.find(c => c.id === editingDeck.className) || HERO_CLASSES[4];
  // Mirrors SpectromancerEngine's class→power map so every discipline (Forest included) shows
  // its own card pool in the 5th column instead of falling back to the illusion pool.
  const classElementMap: Record<string, ElementType> = {
    sorcery: 'special',
    demonologist: 'special',
    beastmaster: 'special',
    chronomancer: 'special',
    goblin: 'special',
    forest: 'special',
    golem: 'special',
    cult: 'special',
    blood: 'special',
    spectromancer: 'special',
    necromancer: 'death',
    cleric: 'holy',
    mechanician: 'mechanics',
    dominator: 'control',
    chaosmaster: 'chaos',
    illusionist: 'illusion',
  };
  const elements: { key: ElementType; label: string }[] = [
    { key: 'fire', label: '火系' },
    { key: 'water', label: '水系' },
    { key: 'air', label: '气系' },
    { key: 'earth', label: '土系' },
    { key: classElementMap[editingDeck.className] || 'special', label: classObj.nameCn }
  ];

  // PC tokens (Bee Soldier…) exist in Gd.spe but can never be put into a deck.
  // 特殊战场造物同理：只能由战场场景预置，不得进入自组卡组。
  let pool = allCardsList.filter(c => {
    if (c.token) return false;
    if (c.battlefield) return false;
    if (builderPoolFilter === 'special') {
      return c.className === editingDeck.className || c.element === 'special';
    }
    return c.element === builderPoolFilter;
  });

  const previewCard = hoveredBuilderCard || editingDeck.cards[selectedBuilderSlotIdx] || editingDeck.cards[0];

  return `
    <div class="deck-builder-view">
      <img src="./ui/CreateDeck_Bg.jpg" class="deck-builder-bg" alt="自组卡组编辑器" />

      <div class="deck-builder-top-bar">
        <div class="deck-builder-top-left" style="display:flex; align-items:center; gap:clamp(10px, 1.2vw, 18px);">
          <span style="font-size:clamp(15px, 1.3vw, 19px); font-weight:900; color:#d1b58a;">卡组名称:</span>
          <input type="text" id="builder-deck-name" value="${editingDeck.name}" class="league-text-input" style="width:clamp(150px, 15vw, 220px); padding:6px 12px; font-size:clamp(14px, 1.2vw, 18px);" />
          <button class="campaign-pc-btn" id="btn-builder-clear" style="padding:6px 20px; font-size:clamp(14px, 1.15vw, 17px);">清空</button>
        </div>

        <div class="deck-builder-top-right" style="display:flex; align-items:center; gap:clamp(10px, 1.4vw, 20px);">
          <span style="font-size:clamp(15px, 1.3vw, 19px); font-weight:900; color:#d1b58a;">职业:</span>
          <div class="league-choice-stepper" style="padding:4px 10px; width:clamp(140px, 14vw, 190px); font-size:clamp(14px, 1.2vw, 18px);">
            <button class="campaign-diff-btn" id="btn-builder-class-prev">◀</button>
            <span class="league-choice-val">${classObj.nameCn}</span>
            <button class="campaign-diff-btn" id="btn-builder-class-next">▶</button>
          </div>
          <button class="campaign-pc-btn start-btn" id="btn-builder-save" style="padding:8px 28px; font-size:clamp(15px, 1.25vw, 18px); min-width:96px;">保存</button>
          <button class="campaign-pc-btn" id="btn-builder-exit" style="padding:8px 28px; font-size:clamp(15px, 1.25vw, 18px); min-width:96px;">退出</button>
        </div>
      </div>

      <div class="deck-builder-content">
        <div class="deck-columns-container">
          <div class="deck-5-cols-grid">
            ${elements.map((elem, colIdx) => {
              const startIdx = colIdx * 4;
              return `
                <div class="deck-elem-column">
                  <div class="deck-col-header ${elem.key}">${elem.label}</div>
                  ${[0, 1, 2, 3].map(slotOffset => {
                    const slotIdx = startIdx + slotOffset;
                    const card = editingDeck.cards[slotIdx];
                    const isSelected = selectedBuilderSlotIdx === slotIdx;
                    return `
                      <div class="deck-slot-card ${!card ? 'empty' : ''} ${isSelected ? 'selected' : ''}"
                           data-slot-idx="${slotIdx}"
                           style="${isSelected ? 'border-color:#ffd700; box-shadow:0 0 12px #ffd700;' : ''}">
                        ${card ? `
                          <img src="${toRel(card.imgUrl)}" class="deck-slot-card-img ${card.type === 'spell' ? 'spell-art' : ''}" alt="${card.nameCn}" />
                          <div class="deck-slot-cost">${card.cost}</div>
                          ${card.type === 'creature' ? `
                            <div class="deck-slot-atk">${formatCardAtk(card.attack)}</div>
                            <div class="deck-slot-life">${card.life}</div>
                          ` : ''}
                        ` : `
                          <span>+</span>
                        `}
                      </div>
                    `;
                  }).join('')}
                </div>
              `;
            }).join('')}
          </div>

          <div class="campaign-deck-center" style="height:clamp(95px, 13vh, 120px); overflow-y:auto;">
            ${previewCard ? `
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(142,114,58,0.3); padding-bottom:2px;">
                <span style="font-weight:900; color:#5c2c10; font-size:14px;">${previewCard.nameCn} (${previewCard.name})</span>
                <span style="font-size:12px; font-weight:800; color:#991b1b;">能量消耗: ${previewCard.cost}${previewCard.lifeCost ? ` + ${previewCard.lifeCost} 生命` : ''}</span>
              </div>
              <div style="font-size:12px; color:#332415; margin-top:2px; line-height:1.45;">
                ${previewCard.desc}
              </div>
            ` : '请悬停或点击卡牌以查看详细战术属性'}
          </div>
        </div>

        <div class="deck-pool-container">
          <div class="deck-pool-tabs">
            <button class="deck-pool-tab ${builderPoolFilter === 'fire' ? 'active' : ''}" data-filter="fire">火系</button>
            <button class="deck-pool-tab ${builderPoolFilter === 'water' ? 'active' : ''}" data-filter="water">水系</button>
            <button class="deck-pool-tab ${builderPoolFilter === 'air' ? 'active' : ''}" data-filter="air">气系</button>
            <button class="deck-pool-tab ${builderPoolFilter === 'earth' ? 'active' : ''}" data-filter="earth">土系</button>
            <button class="deck-pool-tab ${builderPoolFilter === 'special' ? 'active' : ''}" data-filter="special">${classObj.nameCn}</button>
          </div>
          <div class="deck-pool-grid">
            ${pool.map((c) => {
              const isEquipped = editingDeck.cards.some(slotCard => slotCard && slotCard.id === c.id);
              return `
                <div class="deck-pool-item ${isEquipped ? 'already-equipped' : ''}" data-card-id="${c.id}" title="${c.nameCn} (${c.cost}耗能${c.lifeCost ? ` + ${c.lifeCost}生命` : ''})${isEquipped ? ' - 已配置在卡组中' : ''}">
                  <img src="${toRel(c.imgUrl)}" class="deck-slot-card-img ${c.type === 'spell' ? 'spell-art' : ''}" alt="${c.nameCn}" />
                  <div class="deck-slot-cost">${c.cost}</div>
                  ${lifeCostBadge(c)}
                  ${c.type === 'creature' ? `
                    <div class="deck-slot-atk">${formatCardAtk(c.attack)}</div>
                    <div class="deck-slot-life">${c.life}</div>
                  ` : ''}
                  ${isEquipped ? '<div class="deck-pool-badge">✓ 已配置</div>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderGameOverModal(): string {
  const isSpectator = currentBattleSource === 'ai_duel' && aiDuelMode === 'ai_vs_ai';
  const winnerName = engine.winner === 'player' ? engine.player.name : engine.enemy.name;
  const isWin = engine.winner === 'player';

  const modalTitle = isSpectator ? `【${winnerName}】登顶获胜` : (isWin ? '决 战 胜 利' : '战 局 败 北');
  const modalSubtitle = isSpectator ? '✦ AI 巅峰神谕推演终局 ✦' : (isWin ? '✦ VICTORY ACHIEVED ✦' : '✦ DEFEAT IN BATTLE ✦');

  return `
    <div class="modal-overlay" id="game-over-modal-overlay">
      <div class="battle-result-stone-dialog ${isWin || isSpectator ? 'win' : 'defeat'}">
        <div class="battle-result-crest-wrap">
          <div class="battle-result-crest">${isWin || isSpectator ? '🏆' : '💀'}</div>
          <div class="battle-result-title-banner ${isWin || isSpectator ? 'win' : 'defeat'}">
            <h2 class="battle-result-title">${modalTitle}</h2>
            <div class="battle-result-subtitle">${modalSubtitle}</div>
          </div>
        </div>

        <div class="battle-result-body">
          <p class="battle-result-desc">
            ${isSpectator
              ? `两大高阶 AI 魔导师经过 <strong>${engine.turnCount}</strong> 回合的算力风暴与博弈推演，最终由 <strong>【${winnerName}】</strong> 技高一筹斩获胜局！`
              : (isWin
                  ? (currentBattleSource === 'campaign'
                      ? `恭喜大捷！第 <strong>${selectedCampaignLevelId}</strong> 关对手已被击败，大地图新战线现已向您敞开！`
                      : (currentBattleSource === 'league'
                          ? `联赛凯歌高奏！您在第 <strong>${activeLeague?.currentMatch || 1}</strong> 轮对决中力克强敌，积分大幅飙升！`
                          : (currentBattleSource === 'lan'
                              ? `局域网联机凯歌！您在与 <strong>${engine.enemy.name}</strong> 的高能智斗中运筹帷幄，赢得了整场对决的无上荣耀！`
                              : (currentBattleSource === 'ai_duel'
                                  ? `您在与大模型魔导师 <strong>${engine.enemy.name}</strong> 的巅峰智斗中运筹帷幄，成功以人类智慧战胜了高阶 AI 心智！`
                                  : '您精心构筑的卡组经受住了实战考验，以完美的元素统合之力瓦解了敌军！'))))
                  : (currentBattleSource === 'lan'
                      ? `在与 <strong>${engine.enemy.name}</strong> 的奥术交锋中棋差一着……胜败乃法师常事，重整旗鼓再来一局！`
                      : (currentBattleSource === 'ai_duel'
                          ? `大模型魔导师 <strong>${engine.enemy.name}</strong> 施展了超凡算力压制，棋差一着……胜败乃常事，总结克敌之道，再次问鼎巅峰！`
                          : '英雄生命力耗尽，战场符文暗淡……但真正的魔导师在沉寂中洞察生机，总结克敌之道，再次问鼎巅峰！')))}
          </p>
          <div class="battle-result-stats-pill">
            <span>战局博弈: <strong>${engine.turnCount}</strong> 回合</span>
            <span>双方领主: <strong>${engine.player.name}</strong> vs <strong>${engine.enemy.name}</strong></span>
          </div>
        </div>

        <div class="battle-result-actions-row">
          ${currentBattleSource === 'campaign' ? `
            <button class="battle-result-btn next" id="btn-campaign-result-return">
              <span class="btn-icon">🗺️</span>
              <span>返回大地图</span>
            </button>
          ` : ''}
          ${currentBattleSource === 'league' ? `
            <button class="battle-result-btn next" id="btn-league-result-return">
              <span class="btn-icon">🏆</span>
              <span>返回联赛榜单</span>
            </button>
          ` : ''}
          ${currentBattleSource === 'custom_deck' ? `
            <button class="battle-result-btn next" id="btn-deck-result-return">
              <span class="btn-icon">🎴</span>
              <span>返回自组卡牌</span>
            </button>
          ` : ''}
          ${currentBattleSource === 'ai_duel' ? `
            <button class="battle-result-btn next" id="btn-ai-duel-result-return">
              <span class="btn-icon">🔮</span>
              <span>返回巅峰设置</span>
            </button>
          ` : ''}
          ${currentBattleSource === 'lan' ? `
            <button class="battle-result-btn next" id="btn-lan-result-return">
              <span class="btn-icon">🌐</span>
              <span>返回局域网大厅</span>
            </button>
          ` : `
            <button class="battle-result-btn restart" id="btn-restart">
              <span class="btn-icon">🔄</span>
              <span>${isSpectator ? '再次推演' : (isWin ? '再次对战' : '整军再战')}</span>
            </button>
          `}
          <button class="battle-result-btn menu" id="btn-return-menu">
            <span class="btn-icon">🏠</span>
            <span>返回主菜单</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

let activeBattleBgm: string = '';

function startAiDuelBattle() {
  if (!getAiConfig().enabled) {
    sound.play('error');
    showToastNotice('⚠️ 大模型总开关当前处于关闭状态，无法开启对决！请先开启大模型。');
    return;
  }

  currentBattleSource = 'ai_duel';
  resetBattleBanterSession();
  activeEnemyBanter = null;

  const chosenDiff = SINGLE_DUEL_DIFFICULTIES[aiDuelDifficultyIdx];
  const allSc = getAllScenarios();
  const scenario = pickScenarioById(allSc[aiDuelScenarioIdx]?.id || 'sanctuary');

  currentBattlefieldTheme = scenario.theme;
  sound.playBgm(getCombatBgmForCurrentBattle());

  const availableClasses = getSelectableClasses();
  const isSpectator = aiDuelMode === 'ai_vs_ai';

  const pClassId = HERO_CLASSES[isSpectator ? aiDuelAi1ClassIdx : playerClassIndex].id;
  let pClass: HeroClass = pClassId === 'random'
    ? availableClasses[Math.floor(Math.random() * availableClasses.length)]
    : (pClassId as HeroClass);

  const eClassId = HERO_CLASSES[aiDuelAi2ClassIdx].id;
  let eClass: HeroClass = eClassId === 'random'
    ? availableClasses[Math.floor(Math.random() * availableClasses.length)]
    : (eClassId as HeroClass);

  const pName = isSpectator ? MASTER_OPPONENT_NAMES[aiDuelAi1NameIdx % MASTER_OPPONENT_NAMES.length] : '玩家';
  const pFace = isSpectator ? `./faces/Face${aiDuelAi1FaceIdx + 1}.jpg` : `./faces/Face${playerFaceIndex + 1}.jpg`;
  const eName = MASTER_OPPONENT_NAMES[aiDuelAi2NameIdx % MASTER_OPPONENT_NAMES.length];
  const eFace = `./faces/Face${aiDuelAi2FaceIdx + 1}.jpg`;

  engine = new SpectromancerEngine(pClass, undefined, {
    playerName: pName,
    playerFace: pFace,
    enemyName: eName,
    enemyFace: eFace,
    enemyClass: eClass,
    difficulty: chosenDiff,
    battleSource: 'ai_duel',
    isPlayerAiControlled: isSpectator,
    ...buildScenarioEngineOptions(scenario),
  });

  setupEngineCallbacks();
  selectedCard = null;
  inspectedCard = null;
  showHelpModal = false;
  showOptionsModal = false;
  currentView = 'battle';
  render();

  showToastNotice(isSpectator
    ? `🔮 神谕上帝观战开启！【${pName}】VS【${eName}】(${scenario.name} · ${chosenDiff})`
    : `🔮 AI 巅峰对决开启！挑战【${eName}】(${scenario.name} · ${chosenDiff})`
  );

  if (isSpectator && engine.activeTurn === 'player') {
    setTimeout(() => {
      if (currentView === 'battle' && engine.activeTurn === 'player' && engine.isPlayerAiControlled) {
        engine.triggerAiTurn('player');
      }
    }, 1000);
  }
}

function getCombatBgmForCurrentBattle(): string {
  if (activeBattleBgm) {
    return activeBattleBgm;
  }
  activeBattleBgm = sound.getRandomCombatTrack();
  return activeBattleBgm;
}

let hasPickedBattlefieldForMatch: boolean = false;

function syncModeBgm() {
  if (currentView === 'battle' || currentView === 'replay_viewer') {
    if (!hasPickedBattlefieldForMatch) {
      applyRandomBattlefieldThemeIfNeeded();
      hasPickedBattlefieldForMatch = true;
    }
    sound.playBgm(getCombatBgmForCurrentBattle());
  } else if (currentView === 'campaign') {
    hasPickedBattlefieldForMatch = false;
    activeBattleBgm = '';
    sound.playBgm('campaign_map');
  } else {
    hasPickedBattlefieldForMatch = false;
    activeBattleBgm = '';
    sound.playBgm('menu');
  }
}

export function render() {
  syncModeBgm();
  if (currentView === 'menu') {
    app.innerHTML = renderMainMenu();
    if (showReplayModal) app.innerHTML += renderReplayManagerModal();
    if (showAchievementsModal) app.innerHTML += renderAchievementsModal();
    if (showLeagueHubModal) app.innerHTML += renderLeagueHubModal();
    if (showCampaignHubModal) app.innerHTML += renderCampaignHubModal();
    if (showCampaignSetupModal) app.innerHTML += renderCampaignSetupModal();
    if (showLanLobbyModal) app.innerHTML += renderLanLobbyModal();
  } else if (currentView === 'single_duel_setup') {
    app.innerHTML = renderSingleDuelSetup();
  } else if (currentView === 'ai_duel_setup') {
    app.innerHTML = renderAiDuelSetupModal();
  } else if (currentView === 'campaign') {
    app.innerHTML = renderCampaignMapScreen();
    if (showCampaignHubModal) app.innerHTML += renderCampaignHubModal();
    if (showCampaignSetupModal) app.innerHTML += renderCampaignSetupModal();
  } else if (currentView === 'league_setup') {
    app.innerHTML = renderMainMenu() + renderLeagueSetupModal();
  } else if (currentView === 'league_table') {
    app.innerHTML = renderLeagueStandingsScreen();
    if (showLeagueHubModal) app.innerHTML += renderLeagueHubModal();
  } else if (currentView === 'custom_deck_hub') {
    app.innerHTML = renderCustomDeckHubScreen();
  } else if (currentView === 'custom_deck_builder') {
    app.innerHTML = renderCustomDeckBuilderScreen();
  } else if (currentView === 'replay_viewer') {
    app.innerHTML = renderCombatScreen() + renderReplayBattlefieldDock();
  } else if (currentView === 'battle') {
    app.innerHTML = renderCombatScreen();
    if (engine.gameOver) {
      if (!hasSavedCurrentBattleReplay) {
        triggerBattleCompletion();
      }
      app.innerHTML += renderGameOverModal();
    }
  }

  if (showHelpModal) app.innerHTML += renderGameHelpModal();
  if (showOptionsModal) app.innerHTML += renderOptionsModal();
  if (showCampaignTreasuresModal) app.innerHTML += renderCampaignTreasuresModal();
  if (showLeagueAdviceModal) app.innerHTML += renderLeagueOpponentAdviceModal();
  if (showLeagueCompletionModal) app.innerHTML += renderLeagueCompletionModal();
  if (pendingConfirmDialog) app.innerHTML += renderCustomConfirmModal();
  if (lanVsMatchData) app.innerHTML += renderLanVsOverlay();
  if (showLanDisconnectModal) app.innerHTML += renderLanDisconnectModal();
  if (showClassGridPickerFor) app.innerHTML += renderClassGridPickerModal(showClassGridPickerFor);
  if (showScenarioGridPicker) app.innerHTML += renderScenarioGridPickerModal();
  if (showAiScenarioModal) app.innerHTML += renderAiScenarioModal();

  attachEventListeners();

  const logScroll = document.getElementById('combat-log-scroll');
  if (logScroll) {
    logScroll.scrollTop = logScroll.scrollHeight;
  }
  updateTurnTimer();
}

function attachEventListeners() {
  // ===================================
  // MAIN MENU ACTIONS
  // ===================================
  document.getElementById('btn-menu-single-duel')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'single_duel_setup';
    render();
  });

  document.getElementById('btn-menu-lan')?.addEventListener('click', () => {
    sound.play('click');
    showLanLobbyModal = true;
    render();
  });

  document.getElementById('btn-menu-ai-duel')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'ai_duel_setup';
    render();
  });

  // ===================================
  // LAN MULTIPLAYER LOBBY ACTIONS
  // ===================================
  document.getElementById('btn-lan-lobby-close')?.addEventListener('click', () => {
    sound.play('click');
    lanNetwork.disconnect();
    showLanLobbyModal = false;
    lanIsConnecting = false;
    lanStatusText = '';
    render();
  });

  document.getElementById('btn-lan-footer-cancel')?.addEventListener('click', () => {
    sound.play('click');
    lanNetwork.disconnect();
    showLanLobbyModal = false;
    lanIsConnecting = false;
    lanStatusText = '';
    render();
  });

  document.getElementById('btn-lan-cycle-face')?.addEventListener('click', () => {
    lanPlayerFaceId = (lanPlayerFaceId % TOTAL_FACES) + 1;
    saveLanProfilePreferences();
    sound.play('click');
    render();
  });

  const lanNameInput = document.getElementById('input-lan-player-name') as HTMLInputElement | null;
  lanNameInput?.addEventListener('input', (e) => {
    lanPlayerName = (e.target as HTMLInputElement).value;
    saveLanProfilePreferences();
  });

  document.getElementById('btn-lan-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    lanPlayerClassIdx = (lanPlayerClassIdx - 1 + HERO_CLASSES.length) % HERO_CLASSES.length;
    saveLanProfilePreferences();
    render();
  });

  document.getElementById('btn-lan-class-next')?.addEventListener('click', () => {
    sound.play('click');
    lanPlayerClassIdx = (lanPlayerClassIdx + 1) % HERO_CLASSES.length;
    saveLanProfilePreferences();
    render();
  });

  document.getElementById('btn-lan-open-class-picker')?.addEventListener('click', () => {
    sound.play('click');
    showClassGridPickerFor = 'lan';
    render();
  });

  // 局域网战场场景选择器（仅房主可选，随开局同步给 guest）
  document.getElementById('btn-lan-scene-prev')?.addEventListener('click', () => {
    sound.play('click');
    const list = getLanSelectableScenarios();
    lanScenarioIdx = (lanScenarioIdx - 1 + list.length) % list.length;
    saveLanProfilePreferences();
    render();
  });

  document.getElementById('btn-lan-scene-next')?.addEventListener('click', () => {
    sound.play('click');
    const list = getLanSelectableScenarios();
    lanScenarioIdx = (lanScenarioIdx + 1) % list.length;
    saveLanProfilePreferences();
    render();
  });

  document.getElementById('btn-lan-scene-display')?.addEventListener('click', () => {
    sound.play('click');
    showToastNotice(`⚔️ ${getCurrentLanScenario().rule}`);
  });

  document.getElementById('btn-lan-tab-host')?.addEventListener('click', () => {
    if (lanActiveTab !== 'host') {
      sound.play('click');
      lanActiveTab = 'host';
      render();
    }
  });

  document.getElementById('btn-lan-tab-join')?.addEventListener('click', () => {
    if (lanActiveTab !== 'join') {
      sound.play('click');
      lanActiveTab = 'join';
      render();
    }
  });

  document.getElementById('btn-lan-create-room')?.addEventListener('click', async () => {
    sound.play('click');
    lanStatusText = '正在创建局域网房间...';
    render();
    try {
      await lanNetwork.createRoom(getMyLanProfile());
      showToastNotice(`🎉 房间创建成功！房间码: ${lanNetwork.getRoomCode()}`);
    } catch (err: any) {
      showToastNotice('⚠️ 创建房间失败: ' + (err.message || '网络错误'));
    }
    render();
  });

  document.getElementById('btn-lan-recreate-room')?.addEventListener('click', async () => {
    sound.play('click');
    lanStatusText = '正在重新生成房间...';
    render();
    try {
      await lanNetwork.createRoom(getMyLanProfile());
      showToastNotice(`🎉 新房间创建成功！房间码: ${lanNetwork.getRoomCode()}`);
    } catch (err: any) {
      showToastNotice('⚠️ 创建房间失败: ' + (err.message || '网络错误'));
    }
    render();
  });

  document.getElementById('btn-lan-copy-code')?.addEventListener('click', () => {
    sound.play('click');
    const code = lanNetwork.getRoomCode();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        showToastNotice(`📋 房间码 [${code}] 已复制到剪贴板！`);
      }).catch(() => {
        showToastNotice(`房间码: ${code}`);
      });
    } else {
      showToastNotice(`房间码: ${code}`);
    }
  });

  document.getElementById('btn-lan-start-duel')?.addEventListener('click', () => {
    sound.play('click');
    startLanBattleAsHost();
  });

  document.querySelectorAll('.btn-lan-key').forEach((el) => {
    el.addEventListener('click', () => {
      const key = (el as HTMLElement).dataset.key;
      if (key && lanJoinCode.length < 4) {
        sound.play('click');
        lanJoinCode += key;
        render();
      }
    });
  });

  document.querySelector('.btn-lan-key-clear')?.addEventListener('click', () => {
    sound.play('click');
    lanJoinCode = '';
    render();
  });

  document.querySelector('.btn-lan-key-backspace')?.addEventListener('click', () => {
    sound.play('click');
    lanJoinCode = lanJoinCode.slice(0, -1);
    render();
  });

  document.getElementById('btn-lan-join-action')?.addEventListener('click', async () => {
    if (lanJoinCode.length === 4 && !lanIsConnecting) {
      sound.play('click');
      lanIsConnecting = true;
      lanStatusText = `正在连接房间 [${lanJoinCode}]...`;
      render();
      try {
        await lanNetwork.joinRoom(lanJoinCode, getMyLanProfile());
        lanIsConnecting = false;
        showToastNotice(`✅ 已成功加入房间 [${lanJoinCode}]！等待房主开始...`);
        render();
      } catch (err: any) {
        lanIsConnecting = false;
        lanStatusText = err.message || '连接失败，请确认房间码';
        render();
      }
    }
  });

  document.getElementById('btn-lan-disconnect-confirm')?.addEventListener('click', () => {
    sound.play('click');
    showLanDisconnectModal = false;
    currentView = 'menu';
    lanNetwork.disconnect();
    render();
  });

  document.getElementById('btn-lan-result-return')?.addEventListener('click', () => {
    sound.play('click');
    lanNetwork.disconnect();
    showLanLobbyModal = true;
    currentView = 'menu';
    render();
  });

  document.getElementById('btn-menu-campaign')?.addEventListener('click', () => {
    sound.play('click');
    if (campaignProfiles.length === 0) {
      showCampaignSetupModal = true;
    } else {
      currentView = 'campaign';
      sound.playBgm('campaign_map');
    }
    render();
  });

  document.getElementById('btn-menu-league')?.addEventListener('click', () => {
    sound.play('click');
    if (leagueProfiles.length === 0) {
      currentView = 'league_setup';
    } else {
      showLeagueHubModal = true;
    }
    render();
  });

  document.getElementById('btn-menu-custom-deck')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'custom_deck_hub';
    render();
  });

  document.getElementById('btn-menu-replays')?.addEventListener('click', () => {
    sound.play('click');
    showReplayModal = true;
    render();
  });

  document.getElementById('btn-menu-achievements')?.addEventListener('click', () => {
    sound.play('click');
    showAchievementsModal = true;
    render();
  });

  document.getElementById('btn-menu-help')?.addEventListener('click', () => {
    sound.play('click');
    showHelpModal = true;
    render();
  });

  function bindCodexCardFilterEvents() {
    document.querySelectorAll('.codex-filter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        sound.play('click');
        codexCardFilter = (e.currentTarget as HTMLElement).dataset.filter || 'all';
        const scrollArea = document.querySelector('#game-help-modal-overlay .codex-page-scroll');
        if (scrollArea) {
          scrollArea.innerHTML = renderCodexPageContent('cards');
          bindCodexCardFilterEvents();
        }
      });
    });
  }

  ['play', 'combat', 'deck', 'classes', 'modes', 'cards'].forEach((t) => {
    document.getElementById(`tab-codex-${t}`)?.addEventListener('click', () => {
      sound.play('click');
      activeHelpTab = t as any;
      document.querySelectorAll('.codex-tab-btn').forEach((b) => b.classList.remove('active'));
      document.getElementById(`tab-codex-${t}`)?.classList.add('active');
      const scrollArea = document.querySelector('#game-help-modal-overlay .codex-page-scroll');
      if (scrollArea) {
        scrollArea.innerHTML = renderCodexPageContent(activeHelpTab);
        scrollArea.scrollTop = 0;
        if (activeHelpTab === 'cards') {
          bindCodexCardFilterEvents();
        }
      }
    });
  });

  bindCodexCardFilterEvents();

  document.getElementById('btn-close-help')?.addEventListener('click', () => {
    sound.play('click');
    showHelpModal = false;
    render();
  });

  document.getElementById('btn-replay-modal-close')?.addEventListener('click', () => {
    sound.play('click');
    showReplayModal = false;
    render();
  });

  document.getElementById('btn-achievements-close')?.addEventListener('click', () => {
    sound.play('click');
    showAchievementsModal = false;
    render();
  });

  document.getElementById('btn-league-hub-close')?.addEventListener('click', () => {
    sound.play('click');
    showLeagueHubModal = false;
    render();
  });

  document.getElementById('btn-league-hub-create-new')?.addEventListener('click', () => {
    sound.play('click');
    showLeagueHubModal = false;
    currentView = 'league_setup';
    render();
  });

  document.getElementById('btn-league-open-hub')?.addEventListener('click', () => {
    sound.play('click');
    showLeagueHubModal = true;
    render();
  });

  document.querySelectorAll('.btn-select-league-profile').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.play('click');
      const pid = (btn as HTMLElement).dataset.profileId;
      const found = leagueProfiles.find(p => p.id === pid);
      if (found) {
        activeLeagueId = found.id;
        activeLeague = found;
        showLeagueHubModal = false;
        currentView = 'league_table';
        render();
      }
    });
  });

  document.querySelectorAll('.btn-delete-league-profile').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.play('click');
      const pid = (btn as HTMLElement).dataset.profileId;
      if (pid) {
        deleteLeagueProfile(pid);
      }
    });
  });

  // Replay actions
  document.querySelectorAll('.btn-watch-replay').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.play('click');
      const rid = (btn as HTMLElement).dataset.replayId;
      const found = battleReplays.find(r => r.id === rid);
      if (found) {
        startWatchingReplay(found);
      }
    });
  });

  document.querySelectorAll('.btn-delete-replay').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.play('click');
      const rid = (btn as HTMLElement).dataset.replayId;
      battleReplays = battleReplays.filter(r => r.id !== rid);
      try {
        localStorage.setItem(REPLAYS_STORAGE_KEY, JSON.stringify(battleReplays));
      } catch {}
      render();
    });
  });

  // Replay Battlefield Dock controls
  const handleExitReplay = () => {
    sound.play('click');
    stopReplayAutoPlay();
    currentView = 'menu';
    sound.playBgm('menu1');
    showReplayModal = true;
    render();
  };
  document.getElementById('btn-replay-dock-exit')?.addEventListener('click', handleExitReplay);
  document.getElementById('btn-replay-strip-exit')?.addEventListener('click', handleExitReplay);
  document.getElementById('btn-replay-exit')?.addEventListener('click', handleExitReplay);

  document.getElementById('btn-replay-dock-first')?.addEventListener('click', () => {
    sound.play('click');
    applyReplayStep(0);
  });
  document.getElementById('btn-replay-step-first')?.addEventListener('click', () => {
    sound.play('click');
    applyReplayStep(0);
  });

  document.getElementById('btn-replay-dock-prev')?.addEventListener('click', () => {
    sound.play('click');
    if (replayCurrentStepIdx > 0) {
      applyReplayStep(replayCurrentStepIdx - 1);
    }
  });
  document.getElementById('btn-replay-step-prev')?.addEventListener('click', () => {
    sound.play('click');
    if (replayCurrentStepIdx > 0) {
      applyReplayStep(replayCurrentStepIdx - 1);
    }
  });

  const handleTogglePlay = () => {
    sound.play('click');
    if (isReplayAutoPlaying) {
      stopReplayAutoPlay();
    } else {
      startReplayAutoPlay();
    }
  };
  document.getElementById('btn-replay-dock-play')?.addEventListener('click', handleTogglePlay);
  document.getElementById('btn-replay-step-play')?.addEventListener('click', handleTogglePlay);

  document.getElementById('btn-replay-dock-next')?.addEventListener('click', () => {
    sound.play('click');
    stepReplayForward();
  });
  document.getElementById('btn-replay-step-next')?.addEventListener('click', () => {
    sound.play('click');
    stepReplayForward();
  });

  document.getElementById('btn-replay-dock-last')?.addEventListener('click', () => {
    sound.play('click');
    if (activeViewingReplay?.steps) {
      applyReplayStep(activeViewingReplay.steps.length - 1);
    }
  });
  document.getElementById('btn-replay-step-last')?.addEventListener('click', () => {
    sound.play('click');
    if (activeViewingReplay?.steps) {
      applyReplayStep(activeViewingReplay.steps.length - 1);
    }
  });

  const handleToggleSpeed = () => {
    sound.play('click');
    replayPlaybackSpeed = replayPlaybackSpeed === 1 ? 2 : (replayPlaybackSpeed === 2 ? 4 : 1);
    if (isReplayAutoPlaying) {
      startReplayAutoPlay();
    } else {
      render();
    }
  };
  document.getElementById('btn-replay-dock-speed')?.addEventListener('click', handleToggleSpeed);
  document.getElementById('btn-replay-speed')?.addEventListener('click', handleToggleSpeed);

  document.getElementById('btn-menu-options')?.addEventListener('click', () => {
    sound.play('click');
    showOptionsModal = true;
    render();
  });


  // ===================================
  // SINGLE DUEL SETUP ACTIONS
  // ===================================
  document.getElementById('btn-close-duel')?.addEventListener('click', () => {
    sound.play('click');
    showClassGridPickerFor = null;
    currentView = 'menu';
    render();
  });

  document.getElementById('btn-player-face-prev')?.addEventListener('click', () => {
    sound.play('click');
    playerFaceIndex = (playerFaceIndex - 1 + TOTAL_FACES) % TOTAL_FACES;
    updateSingleDuelInPlace();
  });
  document.getElementById('btn-player-face-next')?.addEventListener('click', () => {
    sound.play('click');
    playerFaceIndex = (playerFaceIndex + 1) % TOTAL_FACES;
    updateSingleDuelInPlace();
  });

  document.getElementById('btn-player-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    playerClassIndex = (playerClassIndex - 1 + HERO_CLASSES.length) % HERO_CLASSES.length;
    updateSingleDuelInPlace();
  });
  document.getElementById('btn-player-class-next')?.addEventListener('click', () => {
    sound.play('click');
    playerClassIndex = (playerClassIndex + 1) % HERO_CLASSES.length;
    updateSingleDuelInPlace();
  });
  document.getElementById('btn-player-class-pick')?.addEventListener('click', () => {
    sound.play('click');
    playerClassIndex = (playerClassIndex + 1) % HERO_CLASSES.length;
    updateSingleDuelInPlace();
  });
  document.getElementById('btn-player-class-grid')?.addEventListener('click', () => {
    sound.play('click');
    showClassGridPickerFor = 'player';
    render();
  });

  document.getElementById('btn-ai-name-prev')?.addEventListener('click', () => {
    sound.play('click');
    singleDuelAiNameIdx = (singleDuelAiNameIdx - 1 + MASTER_OPPONENT_NAMES.length) % MASTER_OPPONENT_NAMES.length;
    updateSingleDuelInPlace();
  });
  document.getElementById('btn-ai-name-next')?.addEventListener('click', () => {
    sound.play('click');
    singleDuelAiNameIdx = (singleDuelAiNameIdx + 1) % MASTER_OPPONENT_NAMES.length;
    updateSingleDuelInPlace();
  });
  document.getElementById('duel-ai-name-val')?.addEventListener('click', () => {
    sound.play('click');
    singleDuelAiNameIdx = (singleDuelAiNameIdx + 1) % MASTER_OPPONENT_NAMES.length;
    updateSingleDuelInPlace();
  });

  document.getElementById('btn-ai-face-prev')?.addEventListener('click', () => {
    sound.play('click');
    aiFaceIndex = (aiFaceIndex - 1 + TOTAL_FACES) % TOTAL_FACES;
    singleDuelAiNameIdx = aiFaceIndex % MASTER_OPPONENT_NAMES.length;
    updateSingleDuelInPlace();
  });
  document.getElementById('btn-ai-face-next')?.addEventListener('click', () => {
    sound.play('click');
    aiFaceIndex = (aiFaceIndex + 1) % TOTAL_FACES;
    singleDuelAiNameIdx = aiFaceIndex % MASTER_OPPONENT_NAMES.length;
    updateSingleDuelInPlace();
  });

  document.getElementById('btn-ai-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    aiClassIndex = (aiClassIndex - 1 + HERO_CLASSES.length) % HERO_CLASSES.length;
    updateSingleDuelInPlace();
  });
  document.getElementById('btn-ai-class-next')?.addEventListener('click', () => {
    sound.play('click');
    aiClassIndex = (aiClassIndex + 1) % HERO_CLASSES.length;
    updateSingleDuelInPlace();
  });
  document.getElementById('btn-ai-class-pick')?.addEventListener('click', () => {
    sound.play('click');
    aiClassIndex = (aiClassIndex + 1) % HERO_CLASSES.length;
    updateSingleDuelInPlace();
  });
  document.getElementById('btn-ai-class-grid')?.addEventListener('click', () => {
    sound.play('click');
    showClassGridPickerFor = 'ai';
    render();
  });

  document.getElementById('btn-close-class-grid')?.addEventListener('click', () => {
    sound.play('click');
    showClassGridPickerFor = null;
    render();
  });

  document.getElementById('class-grid-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('class-grid-overlay')) {
      sound.play('click');
      showClassGridPickerFor = null;
      render();
    }
  });

  document.querySelectorAll('.class-grid-item').forEach((item) => {
    item.addEventListener('click', () => {
      sound.play('click');
      const target = (item as HTMLElement).dataset.target;
      const clsIdx = parseInt((item as HTMLElement).dataset.classIndex || '0');
      if (target === 'player') {
        playerClassIndex = clsIdx;
      } else if (target === 'ai') {
        aiClassIndex = clsIdx;
      } else if (target === 'lan') {
        lanPlayerClassIdx = clsIdx;
        saveLanProfilePreferences();
      } else if (target === 'ai_duel_1') {
        if (aiDuelMode === 'human_vs_ai') playerClassIndex = clsIdx;
        else aiDuelAi1ClassIdx = clsIdx;
      } else if (target === 'ai_duel_2') {
        aiDuelAi2ClassIdx = clsIdx;
      }
      showClassGridPickerFor = null;
      render();
    });
  });

  document.getElementById('btn-duel-diff-prev')?.addEventListener('click', () => {
    sound.play('click');
    singleDuelDifficultyIdx = (singleDuelDifficultyIdx - 1 + SINGLE_DUEL_DIFFICULTIES.length) % SINGLE_DUEL_DIFFICULTIES.length;
    updateSingleDuelInPlace();
  });
  document.getElementById('btn-duel-diff-next')?.addEventListener('click', () => {
    sound.play('click');
    singleDuelDifficultyIdx = (singleDuelDifficultyIdx + 1) % SINGLE_DUEL_DIFFICULTIES.length;
    updateSingleDuelInPlace();
  });

  document.getElementById('duel-scene-val-display')?.addEventListener('click', () => {
    sound.play('click');
    showScenarioGridPicker = true;
    render();
  });

  document.getElementById('btn-duel-scene-grid')?.addEventListener('click', () => {
    sound.play('click');
    showScenarioGridPicker = true;
    render();
  });
  document.getElementById('btn-duel-scene-ai-create')?.addEventListener('click', () => {
    sound.play('click');
    showAiScenarioModal = true;
    render();
  });

  // ===================================
  // SCENARIO GRID PICKER & AI SCENARIO ACTIONS
  // ===================================
  document.getElementById('scenario-grid-overlay')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'scenario-grid-overlay') {
      sound.play('click');
      showScenarioGridPicker = false;
      render();
    }
  });
  document.getElementById('btn-close-scenario-grid')?.addEventListener('click', () => {
    sound.play('click');
    showScenarioGridPicker = false;
    render();
  });
  document.getElementById('btn-open-ai-creator-from-grid')?.addEventListener('click', () => {
    sound.play('click');
    showScenarioGridPicker = false;
    showAiScenarioModal = true;
    render();
  });
  document.querySelectorAll('.scenario-grid-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.btn-delete-custom-scenario')) return;
      sound.play('click');
      const idx = parseInt(item.getAttribute('data-scenario-idx') || '0', 10);
      if (currentView === 'ai_duel_setup') {
        aiDuelScenarioIdx = idx;
      } else {
        singleDuelScenarioIdx = idx;
      }
      showScenarioGridPicker = false;
      render();
    });
  });
  document.querySelectorAll('.btn-delete-custom-scenario').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const scId = btn.getAttribute('data-scenario-id');
      if (scId) {
        if (!confirm('确定要永久删除此自创秘境场景吗？')) return;
        sound.play('click');
        deleteCustomScenario(scId);
        showToastNotice('🗑️ 已成功删除自创场景！');
        const allSc = getAllScenarios();
        if (singleDuelScenarioIdx >= allSc.length) singleDuelScenarioIdx = 0;
        if (aiDuelScenarioIdx >= allSc.length) aiDuelScenarioIdx = 0;
        render();
      }
    });
  });

  document.getElementById('btn-close-ai-scenario')?.addEventListener('click', () => {
    sound.play('click');
    showAiScenarioModal = false;
    aiScenarioPreview = null;
    render();
  });
  document.querySelectorAll('.btn-ai-scene-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      sound.play('click');
      const preset = btn.getAttribute('data-preset') || '';
      aiScenarioPromptInput = preset;
      const textarea = document.getElementById('ai-scenario-prompt-input') as HTMLTextAreaElement;
      if (textarea) textarea.value = preset;
    });
  });
  document.getElementById('btn-trigger-ai-scene-gen')?.addEventListener('click', async () => {
    sound.play('btn1');
    const textarea = document.getElementById('ai-scenario-prompt-input') as HTMLTextAreaElement;
    const promptText = textarea ? textarea.value.trim() : aiScenarioPromptInput;
    if (!promptText) {
      alert('请输入场景构想描述或选择上方灵感预设！');
      return;
    }
    aiScenarioPromptInput = promptText;
    aiScenarioLoading = true;
    render();

    try {
      const generated = await generateAiBattlefieldScenario(promptText);
      aiScenarioLoading = false;
      if (generated) {
        aiScenarioPreview = generated as BattlefieldScenario;
      }
      render();
    } catch (err: any) {
      aiScenarioLoading = false;
      alert(`AI 场景生成失败: ${err?.message || '未知错误'}`);
      render();
    }
  });
  document.getElementById('btn-save-ai-scene')?.addEventListener('click', () => {
    sound.play('btn1');
    if (aiScenarioPreview) {
      saveCustomScenario(aiScenarioPreview);
      const allSc = getAllScenarios();
      const newIdx = allSc.findIndex((s) => s.id === aiScenarioPreview?.id);
      if (newIdx !== -1) {
        if (currentView === 'ai_duel_setup') {
          aiDuelScenarioIdx = newIdx;
        } else {
          singleDuelScenarioIdx = newIdx;
        }
      }
      aiScenarioPreview = null;
      showAiScenarioModal = false;
      render();
    }
  });
  document.getElementById('btn-discard-ai-scene')?.addEventListener('click', () => {
    sound.play('click');
    aiScenarioPreview = null;
    render();
  });

function startSingleDuelBattle() {
  currentBattleSource = 'duel';
  hasSavedCurrentBattleReplay = false;
  resetBattleBanterSession();
  activeEnemyBanter = null;

  const chosenDiff = SINGLE_DUEL_DIFFICULTIES[singleDuelDifficultyIdx];

  // Determine Scenario
  const allSc = getAllScenarios();
  const scenario = pickScenarioById(allSc[singleDuelScenarioIdx]?.id || 'sanctuary');

  currentBattlefieldTheme = scenario.theme;
  sound.playBgm(getCombatBgmForCurrentBattle());

  const availableClasses = getSelectableClasses();

  let pClass: HeroClass = HERO_CLASSES[playerClassIndex].id === 'random'
    ? availableClasses[Math.floor(Math.random() * availableClasses.length)]
    : (HERO_CLASSES[playerClassIndex].id as HeroClass);

  let eClass: HeroClass = HERO_CLASSES[aiClassIndex].id === 'random'
    ? availableClasses[Math.floor(Math.random() * availableClasses.length)]
    : (HERO_CLASSES[aiClassIndex].id as HeroClass);

  const aiChosenName = MASTER_OPPONENT_NAMES[singleDuelAiNameIdx % MASTER_OPPONENT_NAMES.length] || '大法师';

  engine = new SpectromancerEngine(pClass, undefined, {
    playerName: '玩家',
    playerFace: `./faces/Face${playerFaceIndex + 1}.jpg`,
    enemyName: aiChosenName,
    enemyFace: `./faces/Face${aiFaceIndex + 1}.jpg`,
    enemyClass: eClass,
    difficulty: chosenDiff,
    ...buildScenarioEngineOptions(scenario),
  });

  setupEngineCallbacks();
  selectedCard = null;
  inspectedCard = null;
  showHelpModal = false;
  showOptionsModal = false;
  currentView = 'battle';
  render();
  showToastNotice(`⚔️ 对战开启！【${scenario.name}】(${chosenDiff}难度)`);
}

  document.getElementById('btn-start-duel')?.addEventListener('click', () => {
    sound.play('click');
    startSingleDuelBattle();
  });

  // ===================================
  // AI PEAK SHOWDOWN SETUP ACTIONS
  // ===================================
  document.getElementById('btn-close-ai-duel')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'menu';
    render();
  });

  document.getElementById('btn-ai-duel-quick-toggle-ai')?.addEventListener('click', () => {
    sound.play('click');
    showOptionsModal = true;
    render();
  });

  document.getElementById('btn-ai-duel-mode-human')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelMode = 'human_vs_ai';
    render();
  });

  document.getElementById('btn-ai-duel-mode-spectator')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelMode = 'ai_vs_ai';
    render();
  });

  document.getElementById('btn-ai-duel-diff-prev')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelDifficultyIdx = (aiDuelDifficultyIdx - 1 + SINGLE_DUEL_DIFFICULTIES.length) % SINGLE_DUEL_DIFFICULTIES.length;
    render();
  });
  document.getElementById('btn-ai-duel-diff-next')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelDifficultyIdx = (aiDuelDifficultyIdx + 1) % SINGLE_DUEL_DIFFICULTIES.length;
    render();
  });

  document.getElementById('ai-duel-scene-val')?.addEventListener('click', () => {
    sound.play('click');
    showScenarioGridPicker = true;
    render();
  });

  document.getElementById('btn-ai-duel-scene-grid')?.addEventListener('click', () => {
    sound.play('click');
    showScenarioGridPicker = true;
    render();
  });
  document.getElementById('btn-ai-duel-scene-ai-create')?.addEventListener('click', () => {
    sound.play('click');
    showAiScenarioModal = true;
    render();
  });

  document.getElementById('btn-ai-duel-p1-face-prev')?.addEventListener('click', () => {
    sound.play('click');
    if (aiDuelMode === 'human_vs_ai') {
      playerFaceIndex = (playerFaceIndex - 1 + TOTAL_FACES) % TOTAL_FACES;
    } else {
      aiDuelAi1FaceIdx = (aiDuelAi1FaceIdx - 1 + TOTAL_FACES) % TOTAL_FACES;
    }
    render();
  });
  document.getElementById('btn-ai-duel-p1-face-next')?.addEventListener('click', () => {
    sound.play('click');
    if (aiDuelMode === 'human_vs_ai') {
      playerFaceIndex = (playerFaceIndex + 1) % TOTAL_FACES;
    } else {
      aiDuelAi1FaceIdx = (aiDuelAi1FaceIdx + 1) % TOTAL_FACES;
    }
    render();
  });

  document.getElementById('btn-ai-duel-p1-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    if (aiDuelMode === 'human_vs_ai') {
      playerClassIndex = (playerClassIndex - 1 + HERO_CLASSES.length) % HERO_CLASSES.length;
    } else {
      aiDuelAi1ClassIdx = (aiDuelAi1ClassIdx - 1 + HERO_CLASSES.length) % HERO_CLASSES.length;
    }
    render();
  });
  document.getElementById('btn-ai-duel-p1-class-next')?.addEventListener('click', () => {
    sound.play('click');
    if (aiDuelMode === 'human_vs_ai') {
      playerClassIndex = (playerClassIndex + 1) % HERO_CLASSES.length;
    } else {
      aiDuelAi1ClassIdx = (aiDuelAi1ClassIdx + 1) % HERO_CLASSES.length;
    }
    render();
  });
  document.getElementById('btn-ai-duel-p1-class-pick')?.addEventListener('click', () => {
    sound.play('click');
    if (aiDuelMode === 'human_vs_ai') {
      playerClassIndex = (playerClassIndex + 1) % HERO_CLASSES.length;
    } else {
      aiDuelAi1ClassIdx = (aiDuelAi1ClassIdx + 1) % HERO_CLASSES.length;
    }
    render();
  });
  document.getElementById('btn-ai-duel-p1-class-grid')?.addEventListener('click', () => {
    sound.play('click');
    showClassGridPickerFor = 'ai_duel_1';
    render();
  });

  document.getElementById('btn-ai-duel-p1-name-prev')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelAi1NameIdx = (aiDuelAi1NameIdx - 1 + MASTER_OPPONENT_NAMES.length) % MASTER_OPPONENT_NAMES.length;
    render();
  });
  document.getElementById('btn-ai-duel-p1-name-next')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelAi1NameIdx = (aiDuelAi1NameIdx + 1) % MASTER_OPPONENT_NAMES.length;
    render();
  });

  document.getElementById('btn-ai-duel-p2-name-prev')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelAi2NameIdx = (aiDuelAi2NameIdx - 1 + MASTER_OPPONENT_NAMES.length) % MASTER_OPPONENT_NAMES.length;
    render();
  });
  document.getElementById('btn-ai-duel-p2-name-next')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelAi2NameIdx = (aiDuelAi2NameIdx + 1) % MASTER_OPPONENT_NAMES.length;
    render();
  });
  document.getElementById('btn-ai-duel-p2-face-prev')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelAi2FaceIdx = (aiDuelAi2FaceIdx - 1 + TOTAL_FACES) % TOTAL_FACES;
    render();
  });
  document.getElementById('btn-ai-duel-p2-face-next')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelAi2FaceIdx = (aiDuelAi2FaceIdx + 1) % TOTAL_FACES;
    render();
  });
  document.getElementById('btn-ai-duel-p2-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelAi2ClassIdx = (aiDuelAi2ClassIdx - 1 + HERO_CLASSES.length) % HERO_CLASSES.length;
    render();
  });
  document.getElementById('btn-ai-duel-p2-class-next')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelAi2ClassIdx = (aiDuelAi2ClassIdx + 1) % HERO_CLASSES.length;
    render();
  });
  document.getElementById('btn-ai-duel-p2-class-pick')?.addEventListener('click', () => {
    sound.play('click');
    aiDuelAi2ClassIdx = (aiDuelAi2ClassIdx + 1) % HERO_CLASSES.length;
    render();
  });
  document.getElementById('btn-ai-duel-p2-class-grid')?.addEventListener('click', () => {
    sound.play('click');
    showClassGridPickerFor = 'ai_duel_2';
    render();
  });

  document.getElementById('btn-start-ai-duel-action')?.addEventListener('click', () => {
    sound.play('click');
    startAiDuelBattle();
  });

  // ===================================
  // CAMPAIGN ACTIONS
  // ===================================
function startCampaignBattle(levelId: number = selectedCampaignLevelId) {
  selectedCampaignLevelId = levelId;
  currentBattleSource = 'campaign';
  hasSavedCurrentBattleReplay = false;
  resetBattleBanterSession();
  activeEnemyBanter = null;
  activeBattleBgm = '';

  const currentLvl = (campaignData as CampaignLevel[]).find((l) => l.id === selectedCampaignLevelId) || (campaignData as CampaignLevel[])[0];
  const validClasses: HeroClass[] = [
    'sorcery', 'necromancer', 'cleric', 'mechanician', 'dominator',
    'chaosmaster', 'illusionist', 'demonologist', 'beastmaster', 'chronomancer', 'goblin', 'forest', 'golem', 'cult', 'blood'
  ];
  const rawClassId = activeCampaign ? HERO_CLASSES[activeCampaign.playerClassIdx]?.id : undefined;
  const pClass: HeroClass = (!rawClassId || rawClassId === 'random')
    ? validClasses[Math.floor(Math.random() * validClasses.length)]
    : rawClassId;
  const pName = activeCampaign ? activeCampaign.playerName : '战役法师';
  const pFace = activeCampaign ? `./faces/Face${activeCampaign.playerFaceId}.jpg` : './faces/Face1.jpg';

  // PC Spectromancer Campaign Initial Battlefield Creatures & Relics
  const initialPlayerCreatures: Array<{ slot: number; card: CardDef }> = [];
  const initialEnemyCreatures: Array<{ slot: number; card: CardDef }> = [];
  const allCards = cardsData as CardDef[];

  // Level 1 (Demir): Player starts with a Priest of Fire at slot 2
  if (selectedCampaignLevelId === 1) {
    const priest = allCards.find(c => c.id === 'fire_priest_of_fire');
    if (priest) initialPlayerCreatures.push({ slot: 2, card: priest });
  }

  // Relic: Tamed Gryphon (Unlocked if level 1 is completed)
  if (completedCampaignLevels.includes(1) && selectedCampaignLevelId !== 1) {
    const gryphon = allCards.find(c => c.id === 'air_griffin');
    if (gryphon) initialPlayerCreatures.push({ slot: 2, card: gryphon });
  }

  // Level 2 (Silver): Enemy starts with Water/Ice Elemental or Golem
  if (selectedCampaignLevelId === 2) {
    const elem = allCards.find(c => c.id === 'water_water_elemental') || allCards.find(c => c.id === 'water_ice_golem');
    if (elem) initialEnemyCreatures.push({ slot: 2, card: elem });
  }

  // Level 3 (Fedemir): Enemy starts with Mech / Chaos Peacemaker or Guardian
  if (selectedCampaignLevelId === 3) {
    const guard = allCards.find(c => c.id === 'mech_steel_golem') || allCards.find(c => c.id === 'sorcery_spectral_assassin');
    if (guard) initialEnemyCreatures.push({ slot: 2, card: guard });
  }

  // Level 5 (Lorana / Vilan): Enemy starts with two Goblin Berserkers
  if (selectedCampaignLevelId === 5) {
    const goblin = allCards.find(c => c.id === 'fire_goblin_berserker');
    if (goblin) {
      initialEnemyCreatures.push({ slot: 1, card: goblin });
      initialEnemyCreatures.push({ slot: 4, card: goblin });
    }
  }

  // Level 6 (Sirroca / 斯哈克): Enemy starts with an Air Elemental
  if (selectedCampaignLevelId === 6) {
    const airElem = allCards.find(c => c.id === 'air_air_elemental');
    if (airElem) {
      initialEnemyCreatures.push({ slot: 2, card: airElem });
    }
  }

  // Level 7 (Avdofya / 阿芙黛娅): Enemy starts with 3 Elven Healers
  if (selectedCampaignLevelId === 7) {
    const healer = allCards.find(c => c.id === 'earth_elvish_healer');
    if (healer) {
      initialEnemyCreatures.push({ slot: 1, card: healer });
      initialEnemyCreatures.push({ slot: 2, card: healer });
      initialEnemyCreatures.push({ slot: 3, card: healer });
    }
  }

  // Level 8 (Borey / 博瑞): Player starts with a Cloistered Elemental
  if (selectedCampaignLevelId === 8) {
    const cloistered = allCards.find(c => c.id === 'gop_cloistered_elemental');
    if (cloistered) {
      initialPlayerCreatures.push({ slot: 2, card: cloistered });
    }
  }

  // Level 9 (Alrio / 艾瑞欧): Enemy starts with Mad Cat of Alrio
  if (selectedCampaignLevelId === 9) {
    const cat = allCards.find(c => c.id === 'gop_mad_cat_of_alrio');
    if (cat) {
      initialEnemyCreatures.push({ slot: 2, card: cat });
    }
  }

  // Level 10 (Katla / 卡特拉): Both sides start with a Volcano
  if (selectedCampaignLevelId === 10) {
    const volcano = allCards.find(c => c.id === 'gop_volcano');
    if (volcano) {
      initialPlayerCreatures.push({ slot: 2, card: volcano });
      initialEnemyCreatures.push({ slot: 2, card: volcano });
    }
  }

  // Level 11 (Melidiadus / 曼迪阿杜斯): Enemy starts with 3 Vampires
  if (selectedCampaignLevelId === 11) {
    const vampire = allCards.find(c => c.id === 'gop_vampire');
    if (vampire) {
      initialEnemyCreatures.push({ slot: 1, card: vampire });
      initialEnemyCreatures.push({ slot: 2, card: vampire });
      initialEnemyCreatures.push({ slot: 3, card: vampire });
    }
  }

  // Relic: Talisman of Health (+5 max HP if level 2 completed)
  const pMaxHp = completedCampaignLevels.includes(2) ? 65 : 60;

  // Relic: Signets of the Elements (+1 initial mana if level 4 completed)
  const extraPlayerMana: Partial<Record<ElementType, number>> = {
    fire: completedCampaignLevels.includes(4) ? 1 : 0,
    water: completedCampaignLevels.includes(4) ? 1 : 0,
    air: completedCampaignLevels.includes(4) ? 1 : 0,
    earth: completedCampaignLevels.includes(4) ? 1 : 0,
    special: 0,
  };

  const campaignDiff = activeCampaign?.difficulty || campaignDifficulties[campaignDifficultyIndex] || '普通';
  engine = new SpectromancerEngine(pClass, currentLvl, {
    playerName: pName,
    playerFace: pFace,
    playerHp: pMaxHp,
    enemyHp: currentLvl.enemyHp,
    enemyName: currentLvl.oppName,
    enemyFace: currentLvl.face,
    difficulty: campaignDiff,
    initialPlayerCreatures,
    initialEnemyCreatures,
    extraPlayerMana,
    leagueRule: currentLvl.rules || undefined,
  });
  if (currentLvl.rules) {
    engine.log(`【战役战场规则】${currentLvl.rules.replace(/\r?\n/g, ' ')}`, 'heal');
  }
  setupEngineCallbacks();
  selectedCard = null;
  inspectedCard = null;
  currentView = 'battle';
  sound.playBgm(getCombatBgmForCurrentBattle());
  render();
}

  document.getElementById('close-campaign-btn')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'menu';
    render();
  });

  document.querySelectorAll('.btn-start-campaign').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lvlId = parseInt((btn as HTMLElement).dataset.levelId || '1');
      sound.play('click');
      startCampaignBattle(lvlId);
    });
  });

  // ===================================
  // COMBAT ACTIONS
  // ===================================
  document.getElementById('btn-combat-main-menu')?.addEventListener('click', () => {
    sound.play('click');
    openCustomConfirm(
      '退出当前对决',
      '确定要返回主菜单吗？若未保存当前对局，未保存的回合进度将丢失。您也可通过【⚙️】设置保存当前战局。',
      () => {
        sound.playBgm('menu1');
        showHelpModal = false;
        showOptionsModal = false;
        currentView = 'menu';
        render();
      },
      undefined,
      '退出对决',
      '继续战斗'
    );
  });

  document.getElementById('btn-combat-help')?.addEventListener('click', () => {
    sound.play('click');
    showHelpModal = true;
    render();
  });

  document.getElementById('btn-close-help')?.addEventListener('click', () => {
    sound.play('click');
    showHelpModal = false;
    render();
  });

  document.getElementById('btn-combat-save-exit')?.addEventListener('click', () => {
    sound.play('click');
    if (saveCurrentBattle()) {
      showToastNotice('💾 战斗进度已保存！随时可继续对决。');
    }
    currentView = 'menu';
    sound.playBgm('menu1');
    render();
  });

  const handleCloseOptions = () => {
    sound.play('click');
    showOptionsModal = false;
    render();
  };
  document.getElementById('btn-close-options')?.addEventListener('click', handleCloseOptions);
  document.getElementById('btn-confirm-options')?.addEventListener('click', handleCloseOptions);
  document.getElementById('options-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) handleCloseOptions();
  });

  document.getElementById('btn-combat-rules')?.addEventListener('click', () => {
    sound.play('click');
    showRulesModal = true;
    render();
  });

  document.getElementById('btn-close-rules-modal')?.addEventListener('click', () => {
    sound.play('click');
    showRulesModal = false;
    render();
  });

  document.getElementById('combat-rules-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      sound.play('click');
      showRulesModal = false;
      render();
    }
  });

  document.getElementById('btn-combat-log')?.addEventListener('click', () => {
    sound.play('click');
    showCombatLogsModal = true;
    render();
  });

  document.getElementById('btn-close-combat-logs')?.addEventListener('click', () => {
    sound.play('click');
    showCombatLogsModal = false;
    render();
  });

  document.getElementById('combat-logs-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      showCombatLogsModal = false;
      render();
    }
  });

  document.getElementById('btn-close-card-detail')?.addEventListener('click', () => {
    sound.play('click');
    showCardDetailModal = false;
    render();
  });

  document.getElementById('card-detail-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      showCardDetailModal = false;
      render();
    }
  });

  document.getElementById('combat-inspect-parchment')?.addEventListener('click', () => {
    const pCard = inspectedCard || selectedCard;
    if (pCard) {
      sound.play('click');
      detailedCard = pCard;
      const pCreature = engine.playerBoard.find(c => c && c.card.id === pCard.id);
      const eCreature = engine.enemyBoard.find(c => c && c.card.id === pCard.id);
      if (pCreature) {
        detailedCreatureSlot = { creature: pCreature, side: 'player' };
      } else if (eCreature) {
        detailedCreatureSlot = { creature: eCreature, side: 'enemy' };
      } else {
        detailedCreatureSlot = null;
      }
      showCardDetailModal = true;
      render();
    }
  });

  document.getElementById('btn-banner-inspect-card')?.addEventListener('click', (e) => {
    e.stopPropagation();
    sound.play('click');
    if (selectedCard) {
      detailedCard = selectedCard;
      detailedCreatureSlot = null;
      showCardDetailModal = true;
      render();
    }
  });

  document.getElementById('btn-options-save-quit')?.addEventListener('click', () => {
    sound.play('click');
    if (saveCurrentBattle()) {
      showToastNotice('✅ 战斗已自动保存！已安全返回主菜单。');
    }
    showOptionsModal = false;
    currentView = 'menu';
    sound.playBgm('menu1');
    render();
  });

  const handleLoadSavedBattle = () => {
    sound.play('click');
    if (loadSavedBattle()) {
      showToastNotice('⚔️ 已成功载入战斗存档！继续对决。');
      currentView = 'battle';
      sound.playBgm(getCombatBgmForCurrentBattle());
      render();
    } else {
      showToastNotice('ℹ️ 暂无未完成的对战存档');
    }
  };

  document.getElementById('btn-menu-load-save')?.addEventListener('click', handleLoadSavedBattle);
  document.getElementById('btn-resume-battle-banner')?.addEventListener('click', handleLoadSavedBattle);
  document.getElementById('btn-resume-battle-action')?.addEventListener('click', handleLoadSavedBattle);

  const bgmSlider = document.getElementById('slider-bgm-volume') as HTMLInputElement | null;
  const bgmLabel = document.getElementById('label-bgm-volume');
  bgmSlider?.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) {
      if (bgmLabel) bgmLabel.textContent = `${val}%`;
      sound.setBgmVolume(val / 100);
      if (val > 0 && !sound.bgmEnabled) {
        sound.bgmEnabled = true;
        const btn = document.getElementById('btn-toggle-bgm');
        if (btn) {
          btn.className = 'duel-stone-action-btn start';
          btn.textContent = '🔊 已开启';
        }
      }
    }
  });

  const sfxSlider = document.getElementById('slider-sfx-volume') as HTMLInputElement | null;
  const sfxLabel = document.getElementById('label-sfx-volume');
  sfxSlider?.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) {
      if (sfxLabel) sfxLabel.textContent = `${val}%`;
      sound.setSfxVolume(val / 100);
      if (val > 0 && !sound.enabled) {
        sound.enabled = true;
        const btn = document.getElementById('btn-toggle-sfx');
        if (btn) {
          btn.className = 'duel-stone-action-btn start';
          btn.textContent = '🔔 已开启';
        }
      }
    }
  });

  document.getElementById('btn-toggle-bgm')?.addEventListener('click', () => {
    sound.play('click');
    sound.toggleBgm();
    if (sound.bgmEnabled && sound.getBgmVolume() === 0) {
      sound.setBgmVolume(0.5);
      if (bgmSlider) bgmSlider.value = '50';
      if (bgmLabel) bgmLabel.textContent = '50%';
    }
    const btn = document.getElementById('btn-toggle-bgm');
    if (btn) {
      btn.className = `duel-stone-action-btn ${sound.bgmEnabled ? 'start' : 'close'}`;
      btn.textContent = sound.bgmEnabled ? '🔊 已开启' : '🔇 已静音';
    }
  });

  document.getElementById('btn-toggle-sfx')?.addEventListener('click', () => {
    sound.play('click');
    sound.toggleMute();
    if (sound.enabled && sound.getSfxVolume() === 0) {
      sound.setSfxVolume(0.5);
      if (sfxSlider) sfxSlider.value = '50';
      if (sfxLabel) sfxLabel.textContent = '50%';
    }
    const btn = document.getElementById('btn-toggle-sfx');
    if (btn) {
      btn.className = `duel-stone-action-btn ${sound.enabled ? 'start' : 'close'}`;
      btn.textContent = sound.enabled ? '🔔 已开启' : '🔕 已静音';
    }
  });

  const updateCombatRateButtons = (rate: number) => {
    sound.setCombatBgmRate(rate);
    const label = document.getElementById('label-combat-rate');
    if (label) {
      label.textContent = rate <= 0.88 ? '🐌 沉稳慢调 (0.88x)' : (rate <= 0.94 ? '🎼 典雅深沉 (0.92x)' : '⚡ 原版疾奏 (1.0x)');
    }
    const btnSlow = document.getElementById('btn-combat-rate-slow');
    const btnMid = document.getElementById('btn-combat-rate-mid');
    const btnOrig = document.getElementById('btn-combat-rate-orig');
    if (btnSlow) btnSlow.className = `duel-stone-action-btn ${rate <= 0.88 ? 'start' : 'close'}`;
    if (btnMid) btnMid.className = `duel-stone-action-btn ${(rate > 0.88 && rate <= 0.94) ? 'start' : 'close'}`;
    if (btnOrig) btnOrig.className = `duel-stone-action-btn ${rate > 0.94 ? 'start' : 'close'}`;
  };

  document.getElementById('btn-combat-rate-slow')?.addEventListener('click', () => {
    sound.play('click');
    updateCombatRateButtons(0.88);
  });
  document.getElementById('btn-combat-rate-mid')?.addEventListener('click', () => {
    sound.play('click');
    updateCombatRateButtons(0.92);
  });
  document.getElementById('btn-combat-rate-orig')?.addEventListener('click', () => {
    sound.play('click');
    updateCombatRateButtons(1.0);
  });

  document.getElementById('btn-toggle-record-replays')?.addEventListener('click', () => {
    sound.play('click');
    recordReplaysEnabled = !recordReplaysEnabled;
    try {
      localStorage.setItem('setting_record_replays', JSON.stringify(recordReplaysEnabled));
    } catch {}
    const track = document.getElementById('btn-toggle-record-replays');
    if (track) {
      if (recordReplaysEnabled) {
        track.classList.add('active');
        track.setAttribute('aria-checked', 'true');
      } else {
        track.classList.remove('active');
        track.setAttribute('aria-checked', 'false');
      }
    }
  });

  document.getElementById('btn-toggle-fullscreen')?.addEventListener('click', () => {
    sound.play('click');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  const updateFsBtnState = () => {
    const btn = document.getElementById('btn-toggle-fullscreen');
    if (btn) {
      const isFs = Boolean(document.fullscreenElement);
      btn.className = `duel-stone-action-btn ${isFs ? 'start' : 'close'}`;
      btn.textContent = isFs ? '⛶ 退出全屏' : '⛶ 进入全屏';
    }
  };
  document.removeEventListener('fullscreenchange', updateFsBtnState);
  document.addEventListener('fullscreenchange', updateFsBtnState);

  const allBattlefieldThemes = ['citadel', 'sky', 'volcano', 'forest', 'abyss', 'tundra', 'desert', 'shrine'] as const;

  const updateThemeButtons = () => {
    const lbl = document.getElementById('options-theme-label');
    if (lbl) {
      lbl.textContent = randomBattlefieldEnabled ? '🎲 战斗随机轮播' : getThemeName(currentBattlefieldTheme);
    }
    const toggleTrack = document.getElementById('btn-toggle-random-battlefield');
    if (toggleTrack) {
      if (randomBattlefieldEnabled) {
        toggleTrack.classList.add('active');
        toggleTrack.setAttribute('aria-checked', 'true');
      } else {
        toggleTrack.classList.remove('active');
        toggleTrack.setAttribute('aria-checked', 'false');
      }
    }
    allBattlefieldThemes.forEach(t => {
      const b = document.getElementById(`btn-theme-${t}`);
      if (b) {
        b.className = `duel-stone-action-btn ${(!randomBattlefieldEnabled && currentBattlefieldTheme === t) ? 'start' : 'close'}`;
      }
    });
  };

  document.getElementById('btn-toggle-random-battlefield')?.addEventListener('click', () => {
    sound.play('click');
    randomBattlefieldEnabled = !randomBattlefieldEnabled;
    localStorage.setItem('battlefield_random_enabled', randomBattlefieldEnabled ? 'true' : 'false');
    updateThemeButtons();
  });

  allBattlefieldThemes.forEach(t => {
    document.getElementById(`btn-theme-${t}`)?.addEventListener('click', () => {
      sound.play('click');
      randomBattlefieldEnabled = false;
      localStorage.setItem('battlefield_random_enabled', 'false');
      currentBattlefieldTheme = t;
      localStorage.setItem('battlefield_theme', t);
      updateThemeButtons();
    });
  });


  

  // AI Brain Settings Listeners (Direct DOM update, zero flicker!)
  document.getElementById('btn-toggle-ai-enabled')?.addEventListener('click', () => {
    sound.play('click');
    const cfg = getAiConfig();
    cfg.enabled = !cfg.enabled;
    saveAiConfig(cfg);
    const track = document.getElementById('btn-toggle-ai-enabled');
    const panel = document.getElementById('options-ai-details-panel');
    const hint = document.getElementById('options-ai-disabled-hint');
    if (track) {
      track.classList.toggle('active', cfg.enabled);
      track.setAttribute('aria-checked', String(cfg.enabled));
    }
    if (panel) panel.style.display = cfg.enabled ? 'flex' : 'none';
    if (hint) hint.style.display = cfg.enabled ? 'none' : 'block';
  });

  (['duel', 'league', 'campaign', 'custom-deck'] as const).forEach((m) => {
    const key = m === 'custom-deck' ? 'custom_deck' : m;
    document.getElementById(`chk-ai-mode-${m}`)?.addEventListener('change', (e) => {
      sound.play('click');
      const cfg = getAiConfig();
      if (!cfg.applyModes) {
        cfg.applyModes = { duel: true, league: true, campaign: true, custom_deck: true };
      }
      cfg.applyModes[key] = (e.target as HTMLInputElement).checked;
      saveAiConfig(cfg);
    });
  });

  (['deepseek', 'siliconflow', 'ollama', 'custom'] as const).forEach((p) => {
    document.getElementById(`btn-ai-provider-${p}`)?.addEventListener('click', () => {
      sound.play('click');
      const cfg = getAiConfig();
      cfg.provider = p;
      const preset = PROVIDER_PRESETS[p];
      if (preset && p !== 'custom') {
        cfg.baseUrl = preset.baseUrl;
        cfg.model = preset.model;
      }
      saveAiConfig(cfg);
      (['deepseek', 'siliconflow', 'ollama', 'custom'] as const).forEach((otherP) => {
        const btn = document.getElementById(`btn-ai-provider-${otherP}`);
        if (btn) btn.className = `duel-stone-action-btn ${otherP === p ? 'start' : 'close'}`;
      });
      const inputBaseUrl = document.getElementById('input-ai-baseurl') as HTMLInputElement | null;
      const inputModel = document.getElementById('input-ai-model') as HTMLInputElement | null;
      const inputApiKey = document.getElementById('input-ai-apikey') as HTMLInputElement | null;
      if (inputBaseUrl) inputBaseUrl.value = cfg.baseUrl;
      if (inputModel) inputModel.value = cfg.model;
      if (inputApiKey && p === 'ollama') inputApiKey.placeholder = '本地 Ollama 免填 API Key';
      const resultSpan = document.getElementById('ai-test-result');
      if (resultSpan) {
        resultSpan.textContent = '💡 已切换配置，随时可点击测试连通性';
        resultSpan.style.color = '#854d0e';
      }
    });
  });

  document.getElementById('input-ai-apikey')?.addEventListener('input', (e) => {
    const cfg = getAiConfig();
    cfg.apiKey = (e.target as HTMLInputElement).value.trim();
    saveAiConfig(cfg);
  });

  document.getElementById('btn-toggle-reveal-apikey')?.addEventListener('click', () => {
    sound.play('click');
    showAiApiKey = !showAiApiKey;
    const input = document.getElementById('input-ai-apikey') as HTMLInputElement | null;
    const btn = document.getElementById('btn-toggle-reveal-apikey');
    if (input) input.type = showAiApiKey ? 'text' : 'password';
    if (btn) btn.textContent = showAiApiKey ? '🙈 隐藏' : '👁️ 显示';
  });

  document.getElementById('input-ai-baseurl')?.addEventListener('input', (e) => {
    const cfg = getAiConfig();
    cfg.baseUrl = (e.target as HTMLInputElement).value.trim();
    saveAiConfig(cfg);
  });

  document.getElementById('input-ai-model')?.addEventListener('input', (e) => {
    const cfg = getAiConfig();
    cfg.model = (e.target as HTMLInputElement).value.trim();
    saveAiConfig(cfg);
  });

  document.getElementById('btn-test-ai-connection')?.addEventListener('click', async () => {
    sound.play('click');
    const cfg = getAiConfig();
    const btn = document.getElementById('btn-test-ai-connection') as HTMLButtonElement | null;
    const resultSpan = document.getElementById('ai-test-result');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ 测试中...';
    }
    if (resultSpan) {
      resultSpan.textContent = '⏳ 正在向模型发送握手测试...';
      resultSpan.style.color = '#854d0e';
    }

    const res = await testAiConnection(cfg);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ 测试连通性';
    }
    if (res.success) {
      const track = document.getElementById('btn-toggle-ai-enabled');
      const panel = document.getElementById('options-ai-details-panel');
      const hint = document.getElementById('options-ai-disabled-hint');
      if (track) {
        track.classList.add('active');
        track.setAttribute('aria-checked', 'true');
      }
      if (panel) panel.style.display = 'flex';
      if (hint) hint.style.display = 'none';

      if (resultSpan) {
        resultSpan.textContent = `✅ 连通成功 (${res.latencyMs || 0}ms)！已自动启用魔导对白`;
        resultSpan.style.color = '#16a34a';
      }
      showToastNotice('✅ AI 模型连通成功！已自动开启战局对白');
    } else {
      if (resultSpan) {
        resultSpan.textContent = `❌ 失败: ${res.message || '网络连接错误'}`;
        resultSpan.style.color = '#dc2626';
      }
    }
  });

  document.getElementById('btn-view-ai-combat-logs')?.addEventListener('click', () => {
    sound.play('click');
    const logs = (window as any).__exportCombatAiLogs ? (window as any).__exportCombatAiLogs() : '';
    if (!logs || logs === '暂无对战 AI 记录') {
      showToastNotice('ℹ️ 暂无对战记录。开启 AI 并在对战中出牌后，或运行 tools/test_combat_api.js 即可生成！');
      return;
    }
    const blob = new Blob([logs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'battle_ai_records.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToastNotice('📄 已导出最新对战大模型请求与响应！文件亦实时写入 tools/battle_ai_records.txt');
  });

  document.getElementById('btn-combat-surrender')?.addEventListener('click', () => {
    sound.play('click');
    showSurrenderModal = true;
    render();
  });

  document.getElementById('btn-confirm-surrender')?.addEventListener('click', () => {
    sound.play('click');
    showSurrenderModal = false;
    if (engine.isLanGame) {
      lanNetwork.sendMessage({ type: 'SURRENDER' });
    }
    engine.player.hp = 0;
    engine.checkWinner();
    render();
  });

  document.getElementById('btn-cancel-surrender')?.addEventListener('click', () => {
    sound.play('click');
    showSurrenderModal = false;
    render();
  });

  document.getElementById('btn-toggle-show-cards')?.addEventListener('click', () => {
    sound.play('click');
    showOpponentHand = !showOpponentHand;
    inspectedCard = null;
    selectedCard = null;
    render();
  });

  document.getElementById('btn-get-advice')?.addEventListener('click', () => {
    sound.play('click');
    if (engine.isLanGame) {
      showToastNotice('ℹ️ 局域网对决中无法使用战术锦囊');
      return;
    }
    const advice = engine.getAdvice();
    if (advice.card) {
      selectedCard = advice.card;
      inspectedCard = advice.card;
    }
    engine.log(advice.adviceText, 'heal');
    render();
  });

  document.getElementById('btn-end-turn')?.addEventListener('click', async () => {
    if (isActionPending) return;
    if (engine.activeTurn === 'player' && !engine.gameOver && !engine.isCombatPhase) {
      if (engine.isLanGame && engine.isGuest) {
        sound.play('click');
        isActionPending = true;
        selectedCard = null;
        try {
          lanNetwork.sendMessage({ type: 'ACTION_PASS' });
        } finally {
          setTimeout(() => { isActionPending = false; }, 300);
        }
        return;
      }
      isActionPending = true;
      selectedCard = null;
      try {
        await engine.passTurn('player');
      } finally {
        isActionPending = false;
      }
    }
  });

  // Hand card clicks
  document.querySelectorAll('.combat-hand-card-item').forEach((el) => {
    const cardId = (el as HTMLElement).dataset.cardId!;
    const isOpponent = (el as HTMLElement).dataset.isOpponent === 'true';

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      sound.play('click');
      const c = isOpponent
        ? engine.getEffectiveHand('enemy').find((x) => x.id === cardId)
        : engine.getEffectiveHand('player').find((x) => x.id === cardId);
      if (c) {
        inspectedCard = c;
        inspectedCardSide = isOpponent ? 'enemy' : 'player';
        detailedCard = c;
        detailedCreatureSlot = null;
        showCardDetailModal = true;
        render();
      }
    });

    el.addEventListener('click', async () => {
      sound.play('click');
      if (isOpponent) {
        const oppCard = engine.getEffectiveHand('enemy').find((c) => c.id === cardId);
        if (oppCard) {
          const isRevealed = (currentBattleSource === 'campaign' && completedCampaignLevels.includes(6))
            ? true
            : (engine.enemyRevealedCardIds.has(oppCard.id) || (oppCard.isActivatedAbility && engine.enemyRevealedCardIds.has(oppCard.id.replace('ability_', ''))));
          if (isRevealed) {
            inspectedCard = oppCard;
            inspectedCardSide = 'enemy';
          } else {
            inspectedCard = {
              ...oppCard,
              nameCn: `未明示卡牌 (${oppCard.cost}费)`,
              desc: `【未明示敌方手牌】敌方本系手牌尚未打出或揭示。每当敌方施放或召唤该卡牌时，该卡牌将被记录并显现。`,
            };
            inspectedCardSide = 'enemy';
          }
          render();
        }
        return;
      }

      const card = engine.getEffectiveHand('player').find((c) => c.id === cardId);
      if (!card) return;

      inspectedCard = card;
      inspectedCardSide = 'player';

      if (selectedCard?.id === card.id) {
        // If clicking selected spell that requires no target, cast it immediately!
        if (card.type === 'spell' && !card.requiresTarget && engine.canPlayCard('player', card) && !isActionPending) {
          if (engine.isLanGame && engine.isGuest) {
            isActionPending = true;
            try {
              lanNetwork.sendMessage({ type: 'ACTION_PLAY_CARD', payload: { cardId: card.id } });
            } finally {
              selectedCard = null;
              setTimeout(() => { isActionPending = false; }, 300);
            }
            render();
            return;
          }
          isActionPending = true;
          try {
            await engine.playCard('player', card);
          } finally {
            selectedCard = null;
            isActionPending = false;
          }
        } else {
          selectedCard = null;
        }
      } else {
        selectedCard = card;
        // PC prompt "^You can't use this card while Reaver is in play^".
        if (
          card.type === 'spell' &&
          !card.isActivatedAbility &&
          engine.playerBoard.some((c) => c !== null && c.card.ability === 'reaver_redirect')
        ) {
          showToastNotice('⚠️ 当【掠夺者】在场时，您不能施放魔法');
        }
        // PC prompt "^You should have more life to use this card^" (Blood double payment).
        if (card.lifeCost && engine.player.hp <= card.lifeCost) {
          showToastNotice(`⚠️ 生命不足：施放【${card.nameCn}】需额外支付 ${card.lifeCost} 点生命`);
        }
        // PC prompt "^There is no rabbit in play^" — Forest Wolf needs a Magic Rabbit to eat.
        if (
          card.onSummon === 'forest_wolf_devour' &&
          !engine.playerBoard.some((c) => c !== null && c.card.id === 'forest_magic_rabbit')
        ) {
          showToastNotice('⚠️ 场上没有【魔法兔子】，【森林饿狼】无法被召唤');
        }
      }
      render();
    });
  });

  // Board slot clicks (inspect, summon, or target spell)
  document.querySelectorAll('.combat-board-slot').forEach((slotEl) => {
    const slotIdx = parseInt((slotEl as HTMLElement).dataset.slotIndex!);
    const side = (slotEl as HTMLElement).dataset.side!;

    slotEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const occ = side === 'player' ? engine.playerBoard[slotIdx] : engine.enemyBoard[slotIdx];
      if (occ) {
        sound.play('click');
        inspectedCard = occ.card;
        inspectedCardSide = side as 'player' | 'enemy';
        detailedCard = occ.card;
        detailedCreatureSlot = { creature: occ, side: side as 'player' | 'enemy' };
        showCardDetailModal = true;
        render();
      }
    });

    slotEl.addEventListener('click', async () => {
      const occupied = side === 'player' ? engine.playerBoard[slotIdx] : engine.enemyBoard[slotIdx];

      // If no card selected, tapping occupied creature inspects it in parchment!
      if (!selectedCard && occupied) {
        sound.play('click');
        inspectedCard = occupied.card;
        inspectedCardSide = side as 'player' | 'enemy';
        render();
        return;
      }

      if (!selectedCard || engine.isCombatPhase || isActionPending) {
        if (occupied) {
          inspectedCard = occupied.card;
          inspectedCardSide = side as 'player' | 'enemy';
          render();
        }
        return;
      }

      if (side === 'player') {
        const isValidCreatureSlot = selectedCard.onSummon === 'forest_wolf_devour'
          ? engine.playerBoard[slotIdx]?.card.id === 'forest_magic_rabbit'
          : (selectedCard.id === 'death_emissary_of_dorlak'
            ? engine.playerBoard[slotIdx] !== null
            : engine.playerBoard[slotIdx] === null);
        if ((selectedCard.type === 'creature' && isValidCreatureSlot) || (selectedCard.targetType === 'empty_friendly_slot' && engine.playerBoard[slotIdx] === null)) {
          if (engine.isLanGame && engine.isGuest) {
            isActionPending = true;
            const cardToPlay = selectedCard;
            try {
              lanNetwork.sendMessage({ type: 'ACTION_PLAY_CARD', payload: { cardId: cardToPlay.id, targetSlot: slotIdx } });
            } finally {
              selectedCard = null;
              setTimeout(() => { isActionPending = false; }, 300);
            }
            render();
            return;
          }
          isActionPending = true;
          const cardToPlay = selectedCard;
          try {
            await engine.playCard('player', cardToPlay, slotIdx);
          } finally {
            selectedCard = null;
            isActionPending = false;
          }
        } else if (selectedCard.type === 'spell' && selectedCard.requiresTarget && (isFriendlyTargetSpell(selectedCard) || selectedCard.targetType === 'any_creature') && selectedCard.targetType !== 'empty_friendly_slot') {
          if (engine.playerBoard[slotIdx] && !engine.playerBoard[slotIdx]!.spellImmune) {
            if (engine.isLanGame && engine.isGuest) {
              isActionPending = true;
              const cardToPlay = selectedCard;
              try {
                lanNetwork.sendMessage({ type: 'ACTION_PLAY_CARD', payload: { cardId: cardToPlay.id, targetSlot: slotIdx } });
              } finally {
                selectedCard = null;
                setTimeout(() => { isActionPending = false; }, 300);
              }
              render();
              return;
            }
            isActionPending = true;
            const cardToPlay = selectedCard;
            try {
              await engine.playCard('player', cardToPlay, slotIdx);
            } finally {
              selectedCard = null;
              isActionPending = false;
            }
          }
        }
      } else if (side === 'enemy' && selectedCard.type === 'spell' && selectedCard.requiresTarget && (!isFriendlyTargetSpell(selectedCard) || selectedCard.targetType === 'any_creature' || selectedCard.targetType === 'enemy_creature') && selectedCard.targetType !== 'empty_friendly_slot') {
        if (engine.enemyBoard[slotIdx] && !engine.enemyBoard[slotIdx]!.spellImmune) {
          if (engine.isLanGame && engine.isGuest) {
            isActionPending = true;
            const cardToPlay = selectedCard;
            try {
              lanNetwork.sendMessage({ type: 'ACTION_PLAY_CARD', payload: { cardId: cardToPlay.id, targetSlot: slotIdx } });
            } finally {
              selectedCard = null;
              setTimeout(() => { isActionPending = false; }, 300);
            }
            render();
            return;
          }
          isActionPending = true;
          const cardToPlay = selectedCard;
          try {
            await engine.playCard('player', cardToPlay, slotIdx);
          } finally {
            selectedCard = null;
            isActionPending = false;
          }
        }
      }
    });
  });

  // ===================================
  // CAMPAIGN MAP ACTIONS & PAN/ZOOM CONTROLS (Image 1)
  // ===================================
  function initCampaignMapInteractions() {
    const viewport = document.getElementById('campaign-map-viewport');
    const stage = document.getElementById('campaign-map-stage');
    if (!viewport || !stage) return;

    const STAGE_W = 1024;
    const STAGE_H = 592;

    function updateTransform(smooth = false) {
      if (!stage) return;
      stage.style.transition = smooth ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
      stage.style.transform = `translate3d(${campaignMapPanX}px, ${campaignMapPanY}px, 0) scale(${campaignMapScale})`;
    }

    function getSafeViewportHeight(): number {
      if (!viewport) return window.innerHeight;
      const vh = viewport.clientHeight;
      const deck = document.getElementById('campaign-bottom-deck');
      const isCollapsed = deck?.classList.contains('collapsed') ?? isCampaignDeckCollapsed;
      const deckH = isCollapsed ? 44 : (deck?.clientHeight || 200);
      return Math.max(160, vh - deckH);
    }

    function clampPan(x: number, y: number, scale: number): { x: number; y: number } {
      if (!viewport) return { x, y };
      const vw = viewport.clientWidth;
      const safeH = getSafeViewportHeight();
      const sw = STAGE_W * scale;
      const sh = STAGE_H * scale;

      const rawMinX = Math.min(60, vw - sw - 60);
      const rawMaxX = Math.max(-60, vw - sw > 0 ? (vw - sw) / 2 + 60 : 60);
      const minX = Math.min(rawMinX, rawMaxX);
      const maxX = Math.max(rawMinX, rawMaxX);

      // Y 轴平移：允许地图下半部及边缘完全平移至底部面板之上，留出 60px 充裕余量
      const rawMinY = safeH - sh - 60;
      const rawMaxY = Math.max(50, safeH - sh > 0 ? (safeH - sh) / 2 + 50 : 50);
      const minY = Math.min(rawMinY, rawMaxY);
      const maxY = Math.max(rawMinY, rawMaxY);

      return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y))
      };
    }

    function focusLevel(levelId: number, smooth = true) {
      if (!viewport) return;
      const currentNodes = campaignMapIndex === 3 ? CAMPAIGN_MAP3_NODES : (campaignMapIndex === 2 ? CAMPAIGN_MAP2_NODES : CAMPAIGN_MAP1_NODES);
      const node = currentNodes.find(n => n.levelId === levelId) || currentNodes[0];
      const nx = (node.x / 100) * STAGE_W;
      const ny = (node.y / 100) * STAGE_H;
      const vw = viewport.clientWidth;
      const safeH = getSafeViewportHeight();

      // 将关卡优雅居中于安全可视区域内（避让顶部条幅）
      const visualCenterY = Math.max(60, (safeH + 36) / 2);
      const targetX = (vw / 2) - (nx * campaignMapScale);
      const targetY = visualCenterY - (ny * campaignMapScale);
      const clamped = clampPan(targetX, targetY, campaignMapScale);
      campaignMapPanX = clamped.x;
      campaignMapPanY = clamped.y;
      updateTransform(smooth);
    }

    function fitAll(smooth = true) {
      if (!viewport) return;
      const vw = viewport.clientWidth;
      const safeH = getSafeViewportHeight();
      const scale = Math.max(0.48, Math.min(1.2, Math.min(vw / STAGE_W, safeH / STAGE_H)));
      campaignMapScale = scale;
      campaignMapPanX = (vw - STAGE_W * scale) / 2;
      campaignMapPanY = (safeH - STAGE_H * scale) / 2;
      const clamped = clampPan(campaignMapPanX, campaignMapPanY, scale);
      campaignMapPanX = clamped.x;
      campaignMapPanY = clamped.y;
      updateTransform(smooth);
    }

    // 初次进入时计算最佳自适应视角并对焦当前关卡
    if (!campaignMapInitialized) {
      const vw = viewport.clientWidth;
      const safeH = getSafeViewportHeight();
      campaignMapScale = Math.max(0.72, Math.min(1.15, Math.min(vw / STAGE_W, safeH / STAGE_H) * 1.15));
      focusLevel(selectedCampaignLevelId, false);
      campaignMapInitialized = true;
    } else {
      updateTransform(false);
    }

    // 拖拽手势交互 (鼠标与单指触摸)
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startPanX = 0;
    let startPanY = 0;
    let dragDist = 0;
    let suppressClick = false;

    viewport.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.campaign-map-controls')) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startPanX = campaignMapPanX;
      startPanY = campaignMapPanY;
      dragDist = 0;
      suppressClick = false;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('is-dragging');
      stage.style.transition = 'none';
    });

    viewport.addEventListener('pointermove', (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      dragDist += Math.hypot(dx, dy);
      if (dragDist > 6) {
        suppressClick = true;
      }
      const clamped = clampPan(startPanX + dx, startPanY + dy, campaignMapScale);
      campaignMapPanX = clamped.x;
      campaignMapPanY = clamped.y;
      updateTransform(false);
    });

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      viewport.classList.remove('is-dragging');
      try { viewport.releasePointerCapture(e.pointerId); } catch {}
      if (dragDist > 6) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 80);
      }
    };

    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);

    // 滚轮缩放 (以安全可视区鼠标位置为中心)
    viewport.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const oldScale = campaignMapScale;
      const newScale = Math.max(0.48, Math.min(2.0, oldScale * zoomFactor));
      if (newScale === oldScale) return;

      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      campaignMapPanX = mouseX - (mouseX - campaignMapPanX) * (newScale / oldScale);
      campaignMapPanY = mouseY - (mouseY - campaignMapPanY) * (newScale / oldScale);
      campaignMapScale = newScale;

      const clamped = clampPan(campaignMapPanX, campaignMapPanY, newScale);
      campaignMapPanX = clamped.x;
      campaignMapPanY = clamped.y;
      updateTransform(false);
    }, { passive: false });

    // 大陆战区直选控制盒标签事件
    document.querySelectorAll('.continent-nav-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetMap = parseInt((btn as HTMLElement).dataset.targetMap || '1', 10) as 1 | 2 | 3;
        if (targetMap === campaignMapIndex) return;
        sound.play('click');
        campaignMapIndex = targetMap;
        const nodes = campaignMapIndex === 3 ? CAMPAIGN_MAP3_NODES : (campaignMapIndex === 2 ? CAMPAIGN_MAP2_NODES : CAMPAIGN_MAP1_NODES);
        if (!nodes.some(n => n.levelId === selectedCampaignLevelId)) {
          selectedCampaignLevelId = nodes[0].levelId;
        }
        render();
        focusLevel(selectedCampaignLevelId, false);
      });
    });

    // 折叠/展开底部情报面板事件
    const toggleDeckBtn = document.getElementById('btn-campaign-toggle-deck');
    const miniExpandBtn = document.getElementById('btn-mini-expand-deck');
    const toggleDeckHandler = (e: Event) => {
      e.stopPropagation();
      sound.play('click');
      isCampaignDeckCollapsed = !isCampaignDeckCollapsed;
      const deck = document.getElementById('campaign-bottom-deck');
      if (deck) {
        deck.classList.toggle('collapsed', isCampaignDeckCollapsed);
      }
      if (toggleDeckBtn) {
        toggleDeckBtn.title = isCampaignDeckCollapsed ? '展开战役详情面板' : '收起面板，畅享全景大地图';
        const icon = toggleDeckBtn.querySelector('.toggle-icon');
        if (icon) icon.textContent = isCampaignDeckCollapsed ? '▲ 展开面板' : '▼ 收起面板';
      }
      focusLevel(selectedCampaignLevelId, true);
    };
    toggleDeckBtn?.addEventListener('click', toggleDeckHandler);
    miniExpandBtn?.addEventListener('click', toggleDeckHandler);

    // 迷你栏开始战斗与接续战斗事件
    document.getElementById('btn-mini-start-battle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('btn-campaign-start-battle')?.click();
    });
    document.getElementById('btn-mini-resume-battle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('btn-campaign-resume-battle')?.click();
    });

    document.getElementById('btn-campaign-zoom-in')?.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.play('click');
      const newScale = Math.min(2.0, campaignMapScale * 1.2);
      const vw = viewport.clientWidth;
      const safeH = getSafeViewportHeight();
      campaignMapPanX = (vw / 2) - ((vw / 2) - campaignMapPanX) * (newScale / campaignMapScale);
      campaignMapPanY = (safeH / 2) - ((safeH / 2) - campaignMapPanY) * (newScale / campaignMapScale);
      campaignMapScale = newScale;
      const clamped = clampPan(campaignMapPanX, campaignMapPanY, newScale);
      campaignMapPanX = clamped.x;
      campaignMapPanY = clamped.y;
      updateTransform(true);
    });

    document.getElementById('btn-campaign-zoom-out')?.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.play('click');
      const newScale = Math.max(0.48, campaignMapScale * 0.83);
      const vw = viewport.clientWidth;
      const safeH = getSafeViewportHeight();
      campaignMapPanX = (vw / 2) - ((vw / 2) - campaignMapPanX) * (newScale / campaignMapScale);
      campaignMapPanY = (safeH / 2) - ((safeH / 2) - campaignMapPanY) * (newScale / campaignMapScale);
      campaignMapScale = newScale;
      const clamped = clampPan(campaignMapPanX, campaignMapPanY, newScale);
      campaignMapPanX = clamped.x;
      campaignMapPanY = clamped.y;
      updateTransform(true);
    });

    document.getElementById('btn-campaign-recenter')?.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.play('click');
      focusLevel(selectedCampaignLevelId, true);
    });

    document.getElementById('btn-campaign-fit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.play('click');
      fitAll(true);
    });

    // 节点与传送门点击交互与防误触
    document.querySelectorAll('.campaign-node').forEach((nodeEl) => {
      nodeEl.addEventListener('click', (e) => {
        if (suppressClick) return;
        e.stopPropagation();

        // 传送门点击交互
        const portalTarget = (nodeEl as HTMLElement).dataset.portalTarget;
        if (portalTarget) {
          const targetMap = parseInt(portalTarget, 10) as 1 | 2 | 3;
          const isUnlocked = (nodeEl as HTMLElement).dataset.unlocked === '1';
          if (!isUnlocked) {
            sound.play('click');
            const reqBoss = targetMap === 2 ? '博瑞' : '弗斯拉夫';
            showToastNotice(`🌀 星门尚未激活，请先击败该大陆最终首领【${reqBoss}】！`);
            nodeEl.classList.add('shake-locked');
            setTimeout(() => nodeEl.classList.remove('shake-locked'), 400);
            return;
          }
          sound.play('victory');
          campaignMapIndex = targetMap;
          const targetNodes = targetMap === 3 ? CAMPAIGN_MAP3_NODES : (targetMap === 2 ? CAMPAIGN_MAP2_NODES : CAMPAIGN_MAP1_NODES);
          selectedCampaignLevelId = targetNodes[0].levelId;
          const continentNames = { 1: '第一大陆', 2: '第二大陆', 3: '第三大陆' };
          showToastNotice(`✨ 穿越星门，您已抵达【${continentNames[targetMap]}】！`);
          render();
          focusLevel(selectedCampaignLevelId, false);
          return;
        }

        const lvlId = parseInt((nodeEl as HTMLElement).dataset.levelId || '1', 10);
        const isUnlocked = (nodeEl as HTMLElement).dataset.unlocked === '1';

        if (!isUnlocked) {
          sound.play('click');
          showToastNotice(`⚔️ 第 ${lvlId} 关尚未解锁，可先查阅对手情报与战场规则！`);
          nodeEl.classList.add('shake-locked');
          setTimeout(() => nodeEl.classList.remove('shake-locked'), 400);
        } else {
          sound.play('click');
        }

        selectedCampaignLevelId = lvlId;

        // 样式切换与平滑镜头对焦
        document.querySelectorAll('.campaign-node').forEach(el => {
          el.classList.toggle('selected', parseInt((el as HTMLElement).dataset.levelId || '0', 10) === lvlId);
        });
        focusLevel(lvlId, true);

        // 动态更新底部剧情与对手信息面板
        const currentLvl = (campaignData as CampaignLevel[]).find(l => l.id === lvlId) || (campaignData as CampaignLevel[])[0];
        const deckCenter = document.querySelector('.campaign-deck-center');
        if (deckCenter) {
          deckCenter.innerHTML = `
            <div class="campaign-story-header">
              <span class="campaign-story-title">${currentLvl.oppName} · ${currentLvl.title}</span>
              <span class="campaign-story-hp">生命值: ${currentLvl.enemyHp}</span>
            </div>
            <div class="campaign-story-text">
              ${formatStoryText(currentLvl.story)}
            </div>
            ${currentLvl.rules ? `
              <div class="campaign-story-rules">
                <strong>战斗特殊规则：</strong>${currentLvl.rules.replace(/\r?\n/g, ' ')}
              </div>
            ` : ''}
          `;
        }

        // 同步更新迷你栏
        const miniBadge = document.querySelector('.mini-level-badge');
        const miniName = document.querySelector('.mini-opp-name');
        const miniHp = document.querySelector('.mini-opp-hp');
        const miniStartBtn = document.getElementById('btn-mini-start-battle');
        if (miniBadge) miniBadge.textContent = `第 ${lvlId} 关`;
        if (miniName) miniName.textContent = `${currentLvl.oppName} · ${currentLvl.title}`;
        if (miniHp) miniHp.textContent = `❤️ ${currentLvl.enemyHp}`;
        if (miniStartBtn) {
          miniStartBtn.textContent = isUnlocked ? '开始战斗 ⚔️' : '关卡未解锁 🔒';
          (miniStartBtn as HTMLElement).style.opacity = isUnlocked ? '1' : '0.6';
          (miniStartBtn as HTMLElement).style.filter = isUnlocked ? 'none' : 'grayscale(0.5)';
        }

        const startBtn = document.getElementById('btn-campaign-start-battle');
        if (startBtn) {
          startBtn.textContent = isUnlocked ? '开始战斗' : '关卡未解锁';
          (startBtn as HTMLElement).style.opacity = isUnlocked ? '1' : '0.6';
          (startBtn as HTMLElement).style.filter = isUnlocked ? 'none' : 'grayscale(0.5)';
        }
        saveCampaignProfiles();
      });
    });
  }

  initCampaignMapInteractions();

  document.getElementById('btn-campaign-diff-prev')?.addEventListener('click', () => {
    sound.play('click');
    campaignDifficultyIndex = (campaignDifficultyIndex - 1 + campaignDifficulties.length) % campaignDifficulties.length;
    saveCampaignProfiles();
    render();
  });
  document.getElementById('btn-campaign-diff-next')?.addEventListener('click', () => {
    sound.play('click');
    campaignDifficultyIndex = (campaignDifficultyIndex + 1) % campaignDifficulties.length;
    saveCampaignProfiles();
    render();
  });

  document.getElementById('btn-campaign-resume-battle')?.addEventListener('click', () => {
    sound.play('click');
    if (loadSavedBattle()) {
      currentView = 'battle';
      sound.playBgm(getCombatBgmForCurrentBattle());
      render();
    }
  });

  document.getElementById('btn-campaign-start-battle')?.addEventListener('click', () => {
    if (!unlockedCampaignLevels.includes(selectedCampaignLevelId)) {
      sound.play('click');
      showToastNotice(`⚔️ 第 ${selectedCampaignLevelId} 关尚未解锁，请先突破前置关卡！`);
      return;
    }
    sound.play('click');
    startCampaignBattle(selectedCampaignLevelId);
  });

  document.getElementById('btn-campaign-profile-hub')?.addEventListener('click', () => {
    sound.play('click');
    showCampaignHubModal = true;
    render();
  });

  document.getElementById('btn-campaign-avatar-click')?.addEventListener('click', () => {
    sound.play('click');
    showCampaignHubModal = true;
    render();
  });

  document.getElementById('btn-campaign-hub-close')?.addEventListener('click', () => {
    sound.play('click');
    showCampaignHubModal = false;
    render();
  });

  document.getElementById('btn-campaign-hub-create-new')?.addEventListener('click', () => {
    sound.play('click');
    showCampaignHubModal = false;
    showCampaignSetupModal = true;
    render();
  });

  document.getElementById('btn-campaign-close-setup')?.addEventListener('click', () => {
    sound.play('click');
    showCampaignSetupModal = false;
    if (campaignProfiles.length > 0) {
      showCampaignHubModal = true;
    }
    render();
  });

  document.getElementById('btn-campaign-face-prev')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerFaceId = ((campaignPlayerFaceId - 2 + TOTAL_FACES) % TOTAL_FACES) + 1;
    updateCampaignSetupInPlace();
  });

  document.getElementById('btn-campaign-face-next')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerFaceId = (campaignPlayerFaceId % TOTAL_FACES) + 1;
    updateCampaignSetupInPlace();
  });

  document.getElementById('btn-campaign-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerClassIdx = (campaignPlayerClassIdx - 1 + HERO_CLASSES.length) % HERO_CLASSES.length;
    updateCampaignSetupInPlace();
  });

  document.getElementById('btn-campaign-class-next')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerClassIdx = (campaignPlayerClassIdx + 1) % HERO_CLASSES.length;
    updateCampaignSetupInPlace();
  });

  document.getElementById('btn-campaign-setup-diff-prev')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerDifficultyIdx = (campaignPlayerDifficultyIdx - 1 + campaignDifficulties.length) % campaignDifficulties.length;
    updateCampaignSetupInPlace();
  });

  document.getElementById('btn-campaign-setup-diff-next')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerDifficultyIdx = (campaignPlayerDifficultyIdx + 1) % campaignDifficulties.length;
    updateCampaignSetupInPlace();
  });

  document.getElementById('btn-campaign-create-char')?.addEventListener('click', () => {
    sound.play('click');
    const nameInput = document.getElementById('campaign-name-input') as HTMLInputElement;
    const name = nameInput ? nameInput.value : campaignPlayerName;
    createNewCampaignProfile(name, campaignPlayerFaceId, campaignPlayerClassIdx, campaignPlayerDifficultyIdx);
    showCampaignSetupModal = false;
    currentView = 'campaign';
    sound.playBgm('campaign_map');
    render();
  });

  document.querySelectorAll('.btn-select-campaign-profile').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      sound.play('click');
      const pid = (e.currentTarget as HTMLElement).getAttribute('data-campaign-id');
      const found = campaignProfiles.find(p => p.id === pid);
      if (found) {
        activeCampaignId = found.id;
        activeCampaign = found;
        syncActiveCampaign();
        showCampaignHubModal = false;
        currentView = 'campaign';
        sound.playBgm('campaign_map');
        render();
      }
    });
  });

  document.querySelectorAll('.btn-delete-campaign-profile').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = (e.currentTarget as HTMLElement).getAttribute('data-campaign-id');
      if (pid) {
        sound.play('click');
        deleteCampaignProfile(pid);
      }
    });
  });

  document.getElementById('btn-campaign-awards')?.addEventListener('click', () => {
    sound.play('btn1');
    showCampaignTreasuresModal = true;
    render();
  });

  document.getElementById('btn-close-campaign-treasures')?.addEventListener('click', () => {
    sound.play('click');
    showCampaignTreasuresModal = false;
    render();
  });
  document.getElementById('campaign-treasures-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      sound.play('click');
      showCampaignTreasuresModal = false;
      render();
    }
  });



  document.getElementById('btn-campaign-main-menu')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'menu';
    sound.playBgm('menu');
    render();
  });

  // ===================================
  // LEAGUE ACTIONS (Images 2 & 3)
  // ===================================
  document.getElementById('btn-league-face-prev')?.addEventListener('click', () => {
    sound.play('click');
    leaguePlayerFaceId = ((leaguePlayerFaceId - 2 + TOTAL_FACES) % TOTAL_FACES) + 1;
    updateLeagueSetupInPlace();
  });
  document.getElementById('btn-league-face-next')?.addEventListener('click', () => {
    sound.play('click');
    leaguePlayerFaceId = (leaguePlayerFaceId % TOTAL_FACES) + 1;
    updateLeagueSetupInPlace();
  });

  document.getElementById('league-name-input')?.addEventListener('input', (e) => {
    leaguePlayerName = (e.target as HTMLInputElement).value;
  });

  document.getElementById('btn-league-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    leaguePlayerClassIdx = leaguePlayerClassIdx <= 1 ? HERO_CLASSES.length - 1 : leaguePlayerClassIdx - 1;
    updateLeagueSetupInPlace();
  });
  document.getElementById('btn-league-class-next')?.addEventListener('click', () => {
    sound.play('click');
    leaguePlayerClassIdx = leaguePlayerClassIdx >= HERO_CLASSES.length - 1 ? 1 : leaguePlayerClassIdx + 1;
    updateLeagueSetupInPlace();
  });

  document.getElementById('btn-league-diff-prev')?.addEventListener('click', () => {
    sound.play('click');
    leagueDifficultyIdx = (leagueDifficultyIdx - 1 + leagueDifficulties.length) % leagueDifficulties.length;
    updateLeagueSetupInPlace();
  });
  document.getElementById('btn-league-diff-next')?.addEventListener('click', () => {
    sound.play('click');
    leagueDifficultyIdx = (leagueDifficultyIdx + 1) % leagueDifficulties.length;
    updateLeagueSetupInPlace();
  });

  document.getElementById('btn-league-contestants-prev')?.addEventListener('click', () => {
    sound.play('click');
    leagueContestantCountIdx = (leagueContestantCountIdx - 1 + leagueContestantCountChoices.length) % leagueContestantCountChoices.length;
    updateLeagueSetupInPlace();
  });
  document.getElementById('btn-league-contestants-next')?.addEventListener('click', () => {
    sound.play('click');
    leagueContestantCountIdx = (leagueContestantCountIdx + 1) % leagueContestantCountChoices.length;
    updateLeagueSetupInPlace();
  });

  document.getElementById('btn-league-close-setup')?.addEventListener('click', () => {
    sound.play('click');
    if (leagueProfiles.length > 0) {
      showLeagueHubModal = true;
    }
    currentView = 'menu';
    render();
  });

  document.getElementById('btn-league-create-char')?.addEventListener('click', () => {
    sound.play('btn1');
    const nameInput = document.getElementById('league-name-input') as HTMLInputElement;
    if (nameInput) {
      leaguePlayerName = nameInput.value.trim() || '玩家';
    }
    const cCount = leagueContestantCountChoices[leagueContestantCountIdx] || 10;
    createNewLeagueProfile(leaguePlayerName, leaguePlayerFaceId, leaguePlayerClassIdx, leagueDifficultyIdx, cCount);
    currentView = 'league_table';
    render();
  });

  document.getElementById('btn-league-resume-match')?.addEventListener('click', () => {
    sound.play('click');
    if (loadSavedBattle()) {
      currentView = 'battle';
      sound.playBgm(getCombatBgmForCurrentBattle());
      render();
    }
  });

function startLeagueBattle() {
  if (!activeLeague) return;
  currentBattleSource = 'league';
  hasSavedCurrentBattleReplay = false;
  sound.playBgm(getCombatBgmForCurrentBattle());
  const curOpponent = getNextOpponentForLeague();
  const leagueScenario = getLeagueScenarioForCurrentMatch();
  currentBattlefieldTheme = leagueScenario.theme || 'citadel';
  const pClass = activeLeague.standings.find((s) => s.isPlayer)?.className || 'cleric';
  engine = new SpectromancerEngine(pClass, undefined, {
    playerName: activeLeague.playerName,
    playerFace: `./faces/Face${activeLeague.playerFaceId}.jpg`,
    enemyName: curOpponent.cnName,
    enemyFace: curOpponent.face,
    enemyClass: curOpponent.className,
    difficulty: activeLeague.difficulty || '普通',
    ...buildLeagueOpponentEngineOptions(curOpponent, leagueScenario),
  });
  setupEngineCallbacks();
  selectedCard = null;
  inspectedCard = null;
  currentView = 'battle';
  render();
  showToastNotice(`🏆 联赛开战！对决【${curOpponent.cnName}】· 战场环境【${leagueScenario.name}】`);
}

  document.getElementById('btn-league-start-match')?.addEventListener('click', () => {
    sound.play('click');
    startLeagueBattle();
  });

  document.getElementById('btn-league-advice')?.addEventListener('click', () => {
    sound.play('click');
    showLeagueAdviceModal = true;
    render();
  });

  document.getElementById('btn-close-league-advice')?.addEventListener('click', () => {
    sound.play('click');
    showLeagueAdviceModal = false;
    render();
  });

  document.getElementById('btn-close-league-completion')?.addEventListener('click', () => {
    sound.play('click');
    showLeagueCompletionModal = false;
    render();
  });

  document.getElementById('btn-league-completion-ok')?.addEventListener('click', () => {
    sound.play('click');
    showLeagueCompletionModal = false;
    if (activeLeague) {
      activeLeague.currentMatch = 1;
      activeLeague.phase = 'regular';
      saveActiveLeague();
    }
    render();
  });

  document.getElementById('btn-pending-confirm-ok')?.addEventListener('click', () => {
    sound.play('click');
    const cb = pendingConfirmDialog?.onConfirm;
    pendingConfirmDialog = null;
    if (cb) cb();
    render();
  });

  document.getElementById('btn-pending-confirm-cancel')?.addEventListener('click', () => {
    sound.play('click');
    const cb = pendingConfirmDialog?.onCancel;
    pendingConfirmDialog = null;
    if (cb) cb();
    render();
  });

  document.getElementById('btn-pending-confirm-cancel-x')?.addEventListener('click', () => {
    sound.play('click');
    const cb = pendingConfirmDialog?.onCancel;
    pendingConfirmDialog = null;
    if (cb) cb();
    render();
  });

  document.getElementById('btn-league-menu')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'menu';
    render();
  });

  // ===================================
  // CUSTOM DECK HUB & BUILDER ACTIONS (Images 4 & 5)
  // ===================================
  document.getElementById('btn-deck-prev')?.addEventListener('click', () => {
    sound.play('click');
    selectedDeckIdx = (selectedDeckIdx - 1 + customDecks.length) % customDecks.length;
    render();
  });
  document.getElementById('btn-deck-next')?.addEventListener('click', () => {
    sound.play('click');
    selectedDeckIdx = (selectedDeckIdx + 1) % customDecks.length;
    render();
  });

  document.getElementById('btn-deck-edit')?.addEventListener('click', () => {
    sound.play('click');
    const d = customDecks[selectedDeckIdx] || customDecks[0];
    editingDeck = {
      id: d.id,
      name: d.name,
      className: d.className,
      cards: [...d.cards],
    };
    currentView = 'custom_deck_builder';
    render();
  });

  document.getElementById('btn-deck-new')?.addEventListener('click', () => {
    sound.play('click');
    editingDeck = {
      id: 'deck_' + Date.now(),
      name: `自定义卡组 ${customDecks.length + 1}`,
      className: 'mechanician',
      cards: getDefaultMechanicDeck(),
    };
    currentView = 'custom_deck_builder';
    render();
  });

  document.getElementById('btn-deck-delete')?.addEventListener('click', () => {
    sound.play('click');
    if (customDecks.length > 1) {
      customDecks.splice(selectedDeckIdx, 1);
      selectedDeckIdx = Math.max(0, selectedDeckIdx - 1);
      localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(customDecks));
      render();
    } else {
      showToastNotice('⚠️ 至少需要保留一套卡组！');
    }
  });

  document.getElementById('btn-deck-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    const d = customDecks[selectedDeckIdx];
    const curIdx = HERO_CLASSES.findIndex(c => c.id === d.className);
    const nextIdx = curIdx <= 1 ? HERO_CLASSES.length - 1 : curIdx - 1;
    d.className = HERO_CLASSES[nextIdx].id as HeroClass;
    localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(customDecks));
    render();
  });
  document.getElementById('btn-deck-class-next')?.addEventListener('click', () => {
    sound.play('click');
    const d = customDecks[selectedDeckIdx];
    const curIdx = HERO_CLASSES.findIndex(c => c.id === d.className);
    const nextIdx = curIdx >= HERO_CLASSES.length - 1 ? 1 : curIdx + 1;
    d.className = HERO_CLASSES[nextIdx].id as HeroClass;
    localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(customDecks));
    render();
  });

  document.getElementById('btn-deck-diff-prev')?.addEventListener('click', () => {
    sound.play('click');
    customDeckAiDiffIdx = (customDeckAiDiffIdx - 1 + customDeckAiDiffList.length) % customDeckAiDiffList.length;
    render();
  });
  document.getElementById('btn-deck-diff-next')?.addEventListener('click', () => {
    sound.play('click');
    customDeckAiDiffIdx = (customDeckAiDiffIdx + 1) % customDeckAiDiffList.length;
    render();
  });

  document.querySelectorAll('.custom-deck-opponent-item').forEach((oppEl) => {
    oppEl.addEventListener('click', () => {
      sound.play('click');
      selectedCustomOpponentIdx = parseInt((oppEl as HTMLElement).dataset.oppIdx || '0', 10);
      render();
    });
  });

function startCustomDeckBattle() {
  currentBattleSource = 'custom_deck';
  hasSavedCurrentBattleReplay = false;
  sound.playBgm(getCombatBgmForCurrentBattle());
  const d = customDecks[selectedDeckIdx] || customDecks[0];
  const oppName = customDeckOpponentList[selectedCustomOpponentIdx] || '大法师';
  const chosenCustomDiff = SINGLE_DUEL_DIFFICULTIES[singleDuelDifficultyIdx] || '普通';
  engine = new SpectromancerEngine(d.className, undefined, {
    enemyName: oppName,
    enemyFace: `./faces/Face${(selectedCustomOpponentIdx % 20) + 10}.jpg`,
    difficulty: chosenCustomDiff,
    customDeck: d.cards,
  });
  setupEngineCallbacks();
  selectedCard = null;
  inspectedCard = null;
  currentView = 'battle';
  render();
}

  document.getElementById('btn-deck-start')?.addEventListener('click', () => {
    sound.play('click');
    startCustomDeckBattle();
  });

  document.getElementById('btn-deck-back')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'menu';
    render();
  });

  // Builder View Actions
  document.getElementById('builder-deck-name')?.addEventListener('input', (e) => {
    editingDeck.name = (e.target as HTMLInputElement).value;
  });

  document.getElementById('btn-builder-clear')?.addEventListener('click', () => {
    sound.play('click');
    editingDeck.cards = [];
    render();
  });

  document.getElementById('btn-builder-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    const curIdx = HERO_CLASSES.findIndex(c => c.id === editingDeck.className);
    const nextIdx = curIdx <= 1 ? HERO_CLASSES.length - 1 : curIdx - 1;
    editingDeck.className = HERO_CLASSES[nextIdx].id as HeroClass;
    render();
  });
  document.getElementById('btn-builder-class-next')?.addEventListener('click', () => {
    sound.play('click');
    const curIdx = HERO_CLASSES.findIndex(c => c.id === editingDeck.className);
    const nextIdx = curIdx >= HERO_CLASSES.length - 1 ? 1 : curIdx + 1;
    editingDeck.className = HERO_CLASSES[nextIdx].id as HeroClass;
    render();
  });

  document.querySelectorAll('.deck-slot-card').forEach((slotEl) => {
    slotEl.addEventListener('click', () => {
      sound.play('click');
      selectedBuilderSlotIdx = parseInt((slotEl as HTMLElement).dataset.slotIdx || '0', 10);
      hoveredBuilderCard = editingDeck.cards[selectedBuilderSlotIdx] || null;
      // Auto-switch right filter tab to match this column's element!
      const colIdx = Math.floor(selectedBuilderSlotIdx / 4);
      const colElemKeys: ElementType[] = ['fire', 'water', 'air', 'earth', 'special'];
      builderPoolFilter = colElemKeys[colIdx];
      render();
    });
    slotEl.addEventListener('mouseenter', () => {
      const idx = parseInt((slotEl as HTMLElement).dataset.slotIdx || '0', 10);
      if (editingDeck.cards[idx]) {
        hoveredBuilderCard = editingDeck.cards[idx];
        const inspectEl = document.querySelector('.deck-builder-content .campaign-deck-center');
        if (inspectEl) {
          inspectEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(142,114,58,0.3); padding-bottom:2px;">
              <span style="font-weight:900; color:#5c2c10; font-size:14px;">${hoveredBuilderCard.nameCn} (${hoveredBuilderCard.name})</span>
              <span style="font-size:12px; font-weight:800; color:#991b1b;">能量消耗: ${hoveredBuilderCard.cost}</span>
            </div>
            <div style="font-size:12px; color:#332415; margin-top:2px; line-height:1.45;">
              ${hoveredBuilderCard.desc}
            </div>
          `;
        }
      }
    });
  });

  document.querySelectorAll('.deck-pool-tab').forEach((tabEl) => {
    tabEl.addEventListener('click', () => {
      sound.play('click');
      builderPoolFilter = (tabEl as HTMLElement).dataset.filter as any;
      render();
    });
  });

  document.querySelectorAll('.deck-pool-item').forEach((itemEl) => {
    const cardId = (itemEl as HTMLElement).dataset.cardId;
    const card = allCardsList.find(c => c.id === cardId);
    if (!card) return;

    itemEl.addEventListener('mouseenter', () => {
      hoveredBuilderCard = card;
      const inspectEl = document.querySelector('.deck-builder-content .campaign-deck-center');
      if (inspectEl) {
        inspectEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(142,114,58,0.3); padding-bottom:2px;">
            <span style="font-weight:900; color:#5c2c10; font-size:14px;">${card.nameCn} (${card.name})</span>
            <span style="font-size:12px; font-weight:800; color:#991b1b;">能量消耗: ${card.cost}</span>
          </div>
          <div style="font-size:12px; color:#332415; margin-top:2px; line-height:1.45;">
            ${card.desc}
          </div>
        `;
      }
    });

    itemEl.addEventListener('click', () => {
      sound.play('click');
      // Strictly prevent duplicate cards in the 20-card deck!
      if (editingDeck.cards.some(c => c && c.id === card.id)) {
        const inspectEl = document.querySelector('.deck-builder-content .campaign-deck-center');
        if (inspectEl) {
          inspectEl.innerHTML = `
            <div style="color:#ef4444; font-weight:900; font-size:14.5px; padding:6px 0; text-align:center;">
              ⚠️ 该卡牌【${card.nameCn}】已在当前卡组中！每种卡牌在 20 张卡组中仅限配置 1 张。
            </div>
          `;
        }
        return;
      }

      // Strictly enforce same-element replacement!
      // Column map: 0: fire (0..3), 1: water (4..7), 2: air (8..11), 3: earth (12..15), 4: special (16..19)
      let colIdx = 0;
      if (card.element === 'fire') colIdx = 0;
      else if (card.element === 'water') colIdx = 1;
      else if (card.element === 'air') colIdx = 2;
      else if (card.element === 'earth') colIdx = 3;
      else colIdx = 4; // special or class specific

      const startIdx = colIdx * 4;
      const endIdx = startIdx + 3;

      // If currently selected slot is already in this column, replace it!
      if (selectedBuilderSlotIdx >= startIdx && selectedBuilderSlotIdx <= endIdx) {
        editingDeck.cards[selectedBuilderSlotIdx] = card;
        // Advance to next slot within this same column
        selectedBuilderSlotIdx = startIdx + ((selectedBuilderSlotIdx - startIdx + 1) % 4);
      } else {
        // Different column: find first empty slot in the matching column, or replace the first slot of that column
        let targetSlot = -1;
        for (let i = startIdx; i <= endIdx; i++) {
          if (!editingDeck.cards[i]) {
            targetSlot = i;
            break;
          }
        }
        if (targetSlot === -1) {
          targetSlot = startIdx;
        }
        editingDeck.cards[targetSlot] = card;
        selectedBuilderSlotIdx = targetSlot;
      }
      render();
    });
  });

  document.getElementById('btn-builder-clear')?.addEventListener('click', () => {
    sound.play('click');
    editingDeck.cards = new Array(20).fill(null);
    render();
  });

  document.getElementById('btn-builder-save')?.addEventListener('click', () => {
    sound.play('btn1');
    const nameInput = document.getElementById('builder-deck-name') as HTMLInputElement;
    if (nameInput) {
      editingDeck.name = nameInput.value.trim() || '自组卡组';
    }
    if (editingDeck.cards.length < 20) {
      const def = getDefaultMechanicDeck();
      for (let i = 0; i < 20; i++) {
        if (!editingDeck.cards[i]) editingDeck.cards[i] = def[i];
      }
    }
    const idx = customDecks.findIndex(d => d.id === editingDeck.id);
    if (idx !== -1) {
      customDecks[idx] = { ...editingDeck, cards: [...editingDeck.cards] };
    } else {
      customDecks.push({ ...editingDeck, cards: [...editingDeck.cards] });
      selectedDeckIdx = customDecks.length - 1;
    }
    localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(customDecks));
    showToastNotice('✅ 牌组已成功保存！');
    render();
  });

  document.getElementById('btn-builder-exit')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'custom_deck_hub';
    render();
  });

  // Battle Result Navigation Buttons
  document.getElementById('btn-campaign-result-return')?.addEventListener('click', () => {
    sound.play('click');
    sound.playBgm('campaign_map');
    recordCampaignVictory();
    currentView = 'campaign';
    render();
  });

  document.getElementById('btn-league-result-return')?.addEventListener('click', () => {
    sound.play('click');
    sound.playBgm('menu1');
    if (activeLeague) {
      const N = activeLeague.totalContestants || 10;
      const regMatches = N - 1;

      if (engine.winner === 'player') {
        const p = activeLeague.standings.find(s => s.isPlayer);
        if (p) {
          p.wins += 1;
          p.score += activeLeague.currentMatch > regMatches ? 30 : 15;
        }
      }

      // Simulate other AI matches
      activeLeague.standings.forEach(s => {
        if (!s.isPlayer && Math.random() > 0.45) {
          s.wins += 1;
          s.score += Math.floor(Math.random() * 8) + 4;
        }
      });

      if (activeLeague.currentMatch < regMatches) {
        // Still in regular season
        activeLeague.currentMatch += 1;
      } else if (activeLeague.currentMatch === regMatches) {
        // Regular season completed! Top 4 qualify for playoffs
        const sorted = [...activeLeague.standings].sort((a, b) => b.score !== a.score ? b.score - a.score : b.wins - a.wins);
        const playerRank = sorted.findIndex(s => s.isPlayer) + 1;
        if (playerRank <= 4) {
          activeLeague.currentMatch = N; // Advance to Semi-Final
          activeLeague.phase = 'semifinal';
          const topOpponents = sorted.filter(s => !s.isPlayer);
          const chosen = topOpponents[0];
          const tourList = tournamentData as any[];
          const tIdx = tourList.findIndex(t => t.cnName === chosen.name || t.name === chosen.name);
          activeLeague.semiFinalOpponentIndex = tIdx >= 0 ? tIdx : 0;
        } else {
          // Out of playoffs
          activeLeague.phase = 'completed';
          showLeagueCompletionModal = true;
        }
      } else if (activeLeague.currentMatch === N) {
        // Semi-Final completed
        if (engine.winner === 'player') {
          activeLeague.currentMatch = N + 1; // Advance to Grand Final
          activeLeague.phase = 'final';
          const sorted = [...activeLeague.standings].sort((a, b) => b.score !== a.score ? b.score - a.score : b.wins - a.wins);
          const topOpponents = sorted.filter(s => !s.isPlayer);
          const chosen = topOpponents[1] || topOpponents[0];
          const tourList = tournamentData as any[];
          const tIdx = tourList.findIndex(t => t.cnName === chosen.name || t.name === chosen.name);
          activeLeague.finalOpponentIndex = tIdx >= 0 ? tIdx : 1;
        } else {
          activeLeague.phase = 'completed';
          showLeagueCompletionModal = true;
        }
      } else {
        // Grand Final completed
        activeLeague.phase = 'completed';
        showLeagueCompletionModal = true;
        if (engine.winner === 'player') {
          checkAndUnlockAchievement('league_champ');
        }
      }

      saveActiveLeague();
    }
    currentView = 'league_table';
    render();
  });

  document.getElementById('btn-deck-result-return')?.addEventListener('click', () => {
    sound.play('click');
    sound.playBgm('menu1');
    currentView = 'custom_deck_hub';
    render();
  });

  document.getElementById('btn-ai-duel-result-return')?.addEventListener('click', () => {
    sound.play('click');
    sound.playBgm('menu1');
    currentView = 'ai_duel_setup';
    render();
  });

  // Game over buttons
  document.getElementById('btn-restart')?.addEventListener('click', () => {
    sound.play('click');
    activeBattleBgm = '';
    if (currentBattleSource === 'campaign' && engine && engine.winner === 'player') {
      recordCampaignVictory();
    }
    if (currentBattleSource === 'ai_duel') {
      startAiDuelBattle();
      return;
    }
    if (currentBattleSource === 'campaign') {
      startCampaignBattle(selectedCampaignLevelId);
      return;
    }
    if (currentBattleSource === 'league') {
      startLeagueBattle();
      return;
    }
    if (currentBattleSource === 'custom_deck') {
      startCustomDeckBattle();
      return;
    }
    startSingleDuelBattle();
  });

  document.getElementById('btn-return-menu')?.addEventListener('click', () => {
    sound.play('click');
    sound.playBgm('menu1');
    if (currentBattleSource === 'campaign' && engine && engine.winner === 'player') {
      recordCampaignVictory();
    }
    currentView = 'menu';
    render();
  });
}

function initFullscreen() {
  try {
    const w = typeof window !== 'undefined' ? (window as any) : null;
    if (w && w.plus) {
      if (w.plus.navigator) {
        w.plus.navigator.setFullscreen(true);
        if (typeof w.plus.navigator.hideSystemNavigation === 'function') {
          w.plus.navigator.hideSystemNavigation();
        }
      }
      // Unlock orientation so Android sensor automatically rotates between landscape and portrait
      if (w.plus.screen && typeof w.plus.screen.unlockOrientation === 'function') {
        w.plus.screen.unlockOrientation();
      }
    }
  } catch {}
}

if (typeof window !== 'undefined') {
  if ((window as any).plus) {
    initFullscreen();
  } else {
    document.addEventListener('plusready', initFullscreen, false);
  }
  document.addEventListener('DOMContentLoaded', initFullscreen);

  let resizeDebounceTimer: any = null;
  const onOrientationOrResize = () => {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(() => {
      render();
    }, 120);
  };
  window.addEventListener('resize', onOrientationOrResize);
  window.addEventListener('orientationchange', onOrientationOrResize);
}

render();


