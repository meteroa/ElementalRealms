import './style.css';
import { SpectromancerEngine } from './engine/game';
import type { CardDef, ElementType, HeroClass, CampaignLevel, NetworkUserProfile, NetworkMessage } from './types';
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
  | 'campaign'
  | 'battle'
  | 'league_setup'
  | 'league_table'
  | 'custom_deck_hub'
  | 'custom_deck_builder'
  | 'replay_viewer';

let currentView: ViewMode = typeof window !== 'undefined' && (window.location.search.includes('combat') || window.location.search.includes('battle')) ? 'battle' : 'menu';

// Single Duel Setup State
let playerFaceIndex = 0; // Face1
let playerClassIndex = 0; // 0 = 随机, 1..11 = classes
let aiFaceIndex = 5; // Face6 (Archmage)
let aiClassIndex = 0; // 0 = 随机
let showClassGridPickerFor: 'player' | 'ai' | 'lan' | null = null;
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

let activeCampaignId: string = campaignProfiles[0]?.id || '';
let activeCampaign: CampaignProfile | null = campaignProfiles.find(p => p.id === activeCampaignId) || campaignProfiles[0] || null;

let completedCampaignLevels: number[] = activeCampaign?.completedLevels || [];
let unlockedCampaignLevels: number[] = activeCampaign?.unlockedLevels || [1];
let selectedCampaignLevelId: number = activeCampaign?.selectedLevelId || 1;
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
    unlockedCampaignLevels = activeCampaign.unlockedLevels || [1];
    selectedCampaignLevelId = activeCampaign.selectedLevelId || 1;
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

function createNewCampaignProfile(name: string, faceId: number, classIdx: number, diffIdx: number) {
  const newProfile: CampaignProfile = {
    id: 'campaign_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    playerName: name.trim() || '战役领主',
    playerFaceId: faceId,
    playerClassIdx: classIdx,
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
  { levelId: 1, name: '德米尔', face: './faces/Face6.jpg', x: 18.5, y: 43.0, landmark: '麦田' },
  { levelId: 2, name: '闪银', face: './faces/Face7.jpg', x: 34.0, y: 39.0, landmark: '农舍' },
  { levelId: 3, name: '费德米尔', face: './faces/Face8.jpg', x: 30.5, y: 57.5, landmark: '风车' },
  { levelId: 4, name: '尼瑞恩', face: './faces/Face14.jpg', x: 22.0, y: 67.0, landmark: '圣殿城堡' },
  { levelId: 5, name: '维兰娜', face: './faces/Face21.jpg', x: 48.0, y: 32.0, landmark: '拉卡瓦河畔' },
  { levelId: 6, name: '艾瑞欧', face: './faces/Face25.jpg', x: 62.0, y: 46.0, landmark: '东境要塞' },
  { levelId: 7, name: '卡特拉', face: './faces/Face30.jpg', x: 74.0, y: 60.0, landmark: '荒芜山谷' },
  { levelId: 8, name: '风火领主', face: './faces/Face35.jpg', x: 82.0, y: 38.0, landmark: '风火天峰' },
];

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
        cardName: '火灵学徒', cardId: 'fire_apprentice', cardImg: './cards/fire_apprentice.jpg', targetSlot: 0,
        playerHp: 60, enemyHp: 60,
        playerMana: { fire: 2, water: 5, air: 5, earth: 5, special: 2, death: 2, holy: 2, mechanics: 2, control: 2, chaos: 2, illusion: 2 },
        enemyMana: { fire: 4, water: 4, air: 4, earth: 4, special: 2, death: 2, holy: 2, mechanics: 2, control: 2, chaos: 2, illusion: 2 },
        playerBoard: [
          { uid: 'demo_c1', card: { id: 'fire_apprentice', name: 'Fire Apprentice', nameCn: '火灵学徒', type: 'creature', cost: 3, attack: 3, life: 12, image: 'FireApprentice', imgUrl: './cards/fire_apprentice.jpg', imgBigUrl: './cards/fire_apprentice_big.jpg', desc: '火系初级学徒', element: 'fire' }, owner: 'player', slotIndex: 0, baseAttack: 3, currentAttack: 3, currentLife: 12, maxLife: 12, isWall: false, flying: false, spellImmune: false, poison: 0, regen: 0, canAttack: true },
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
          { uid: 'demo_c1', card: { id: 'fire_apprentice', name: 'Fire Apprentice', nameCn: '火灵学徒', type: 'creature', cost: 3, attack: 3, life: 12, image: 'FireApprentice', imgUrl: './cards/fire_apprentice.jpg', imgBigUrl: './cards/fire_apprentice_big.jpg', desc: '火系初级学徒', element: 'fire' }, owner: 'player', slotIndex: 0, baseAttack: 3, currentAttack: 3, currentLife: 12, maxLife: 12, isWall: false, flying: false, spellImmune: false, poison: 0, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
        enemyBoard: [null, null, null, null, null, null],
      },
      {
        turn: 1, side: 'enemy', action: 'creature', desc: '深渊死灵师 在 [1号位] 召唤了【骷髅守卫】(2/10) 进行战线拦截',
        cardName: '骷髅守卫', cardId: 'death_skeleton', cardImg: './cards/Skeleton.jpg', targetSlot: 0,
        playerHp: 60, enemyHp: 57,
        playerMana: { fire: 2, water: 5, air: 5, earth: 5, special: 2, death: 2, holy: 2, mechanics: 2, control: 2, chaos: 2, illusion: 2 },
        enemyMana: { fire: 4, water: 4, air: 4, earth: 4, special: 0, death: 0, holy: 0, mechanics: 0, control: 0, chaos: 0, illusion: 0 },
        playerBoard: [
          { uid: 'demo_c1', card: { id: 'fire_apprentice', name: 'Fire Apprentice', nameCn: '火灵学徒', type: 'creature', cost: 3, attack: 3, life: 12, image: 'FireApprentice', imgUrl: './cards/fire_apprentice.jpg', imgBigUrl: './cards/fire_apprentice_big.jpg', desc: '火系初级学徒', element: 'fire' }, owner: 'player', slotIndex: 0, baseAttack: 3, currentAttack: 3, currentLife: 12, maxLife: 12, isWall: false, flying: false, spellImmune: false, poison: 0, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
        enemyBoard: [
          { uid: 'demo_c2', card: { id: 'death_skeleton', name: 'Skeleton', nameCn: '骷髅守卫', type: 'creature', cost: 2, attack: 2, life: 10, image: 'Skeleton', imgUrl: './cards/Skeleton.jpg', imgBigUrl: './cards/SkeletonBig.jpg', desc: '亡灵骷髅守卫', element: 'death' }, owner: 'enemy', slotIndex: 0, baseAttack: 2, currentAttack: 2, currentLife: 10, maxLife: 10, isWall: false, flying: false, spellImmune: false, poison: 0, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
      },
      {
        turn: 2, side: 'player', action: 'spell', desc: '玩家 施放了法术【闪电箭】，直击敌方【骷髅守卫】造成 8 点雷霆暴击！',
        cardName: '闪电箭', cardId: 'air_lightning', cardImg: './cards/lightning.jpg', targetSlot: 0,
        playerHp: 60, enemyHp: 57,
        playerMana: { fire: 3, water: 6, air: 2, earth: 6, special: 3, death: 3, holy: 3, mechanics: 3, control: 3, chaos: 3, illusion: 3 },
        enemyMana: { fire: 5, water: 5, air: 5, earth: 5, special: 1, death: 1, holy: 1, mechanics: 1, control: 1, chaos: 1, illusion: 1 },
        playerBoard: [
          { uid: 'demo_c1', card: { id: 'fire_apprentice', name: 'Fire Apprentice', nameCn: '火灵学徒', type: 'creature', cost: 3, attack: 3, life: 12, image: 'FireApprentice', imgUrl: './cards/fire_apprentice.jpg', imgBigUrl: './cards/fire_apprentice_big.jpg', desc: '火系初级学徒', element: 'fire' }, owner: 'player', slotIndex: 0, baseAttack: 3, currentAttack: 3, currentLife: 12, maxLife: 12, isWall: false, flying: false, spellImmune: false, poison: 0, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
        enemyBoard: [
          { uid: 'demo_c2', card: { id: 'death_skeleton', name: 'Skeleton', nameCn: '骷髅守卫', type: 'creature', cost: 2, attack: 2, life: 2, image: 'Skeleton', imgUrl: './cards/Skeleton.jpg', imgBigUrl: './cards/SkeletonBig.jpg', desc: '亡灵骷髅守卫', element: 'death' }, owner: 'enemy', slotIndex: 0, baseAttack: 2, currentAttack: 2, currentLife: 2, maxLife: 10, isWall: false, flying: false, spellImmune: false, poison: 0, regen: 0, canAttack: true },
          null, null, null, null, null
        ],
      },
      {
        turn: 2, side: 'player', action: 'attack_phase', desc: '玩家 回合战线攻击结算：火灵学徒(3攻)重击斩杀残血骷髅守卫，敌方战线崩溃！',
        playerHp: 60, enemyHp: 57,
        playerMana: { fire: 3, water: 6, air: 2, earth: 6, special: 3, death: 3, holy: 3, mechanics: 3, control: 3, chaos: 3, illusion: 3 },
        enemyMana: { fire: 5, water: 5, air: 5, earth: 5, special: 1, death: 1, holy: 1, mechanics: 1, control: 1, chaos: 1, illusion: 1 },
        playerBoard: [
          { uid: 'demo_c1', card: { id: 'fire_apprentice', name: 'Fire Apprentice', nameCn: '火灵学徒', type: 'creature', cost: 3, attack: 3, life: 12, image: 'FireApprentice', imgUrl: './cards/fire_apprentice.jpg', imgBigUrl: './cards/fire_apprentice_big.jpg', desc: '火系初级学徒', element: 'fire' }, owner: 'player', slotIndex: 0, baseAttack: 3, currentAttack: 3, currentLife: 12, maxLife: 12, isWall: false, flying: false, spellImmune: false, poison: 0, regen: 0, canAttack: true },
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

const SINGLE_DUEL_DIFFICULTIES = ['容易', '普通', '困难', '大法师'];
let singleDuelDifficultyIdx: number = 1; // Default '普通'

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
    rule: '经典圣殿法则：双方 60 点初始生命值，遵循正统决斗法则，能量常规匀速增长。',
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
];
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
    card.id.includes('sacrifice')
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
let currentBattleSource: 'duel' | 'campaign' | 'league' | 'custom_deck' | 'lan' = 'duel';
let showRulesModal = false;

const HERO_CLASSES: { id: HeroClass | 'random'; nameCn: string; icon: string; artImg: string; desc: string }[] = [
  { id: 'random', nameCn: '随机', icon: '🎲', artImg: './cards/SupremeElemental.jpg', desc: '随机选择一个强大的法师流派' },
  { id: 'sorcery', nameCn: '巫术', icon: '🔮', artImg: './cards/Disintegrate.jpg', desc: '经典巫术大师，拥有控制与伤害法术，掌握冥想与心智震撼' },
  { id: 'necromancer', nameCn: '死灵', icon: '💀', artImg: './cards/MasterLich.jpg', desc: '召唤哀嚎女妖、吸血鬼与巫妖领主，吸取敌人生命转化为己用' },
  { id: 'cleric', nameCn: '战争牧师', icon: '✨', artImg: './cards/ArchAngel.jpg', desc: '召唤圣骑士、十字军与大天使，擅长神圣护盾与群体圣疗' },
  { id: 'mechanician', nameCn: '机械师', icon: '⚙️', artImg: './cards/SteamTank.jpg', desc: '部署矮人工匠、火枪手、扑翼轰炸机与重型蒸汽坦克' },
  { id: 'dominator', nameCn: '支配者', icon: '👁️', artImg: './cards/MindStealer.jpg', desc: '操控萨满与阻尼塔削减敌方能量，召唤远古女巫与窃心魔' },
  { id: 'chaosmaster', nameCn: '混沌大师', icon: '🌀', artImg: './cards/InsanianLord.jpg', desc: '操控混沌维和者、狂战士、混沌投石机与死棘，极具爆发力' },
  { id: 'illusionist', nameCn: '幻术师', icon: '🎭', artImg: './cards/PhantomWarrior.jpg', desc: '操纵镜面反射之墙、幻像勇士与幽幻刺客，虚实转换制敌' },
  { id: 'demonologist', nameCn: '恶魔学者', icon: '🔥', artImg: './cards/GreaterDemon.jpg', desc: '役使劣魔、恶果魔与大恶魔，施放自爆与地狱烈焰' },
  { id: 'beastmaster', nameCn: '驯兽师', icon: '🐺', artImg: './cards/AncientDragon.jpg', desc: '统御魔法仓鼠、狼獾、死亡之隼与远古巨龙，掌控全系野性灵能' },
  { id: 'chronomancer', nameCn: '时空术士', icon: '⏳', artImg: './cards/ChronoHunter.jpg', desc: '操纵时空猎人、时间闪击者、时间停止与时间之龙，掌控额外行动回合' },
  { id: 'goblin', nameCn: '地精幻术', icon: '👺', artImg: './cards/GoblinHero.jpg', desc: '统御哥布林英雄、爆破者、鼠疫入侵与袭掠军，战术机动与牌库破坏' },
];

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
      'chaosmaster', 'illusionist', 'demonologist', 'beastmaster', 'chronomancer', 'goblin'
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
      const { hostProfile, guestProfile, snapshot } = msg.payload;
      launchLanMatchWithCountdown(hostProfile, guestProfile, () => {
        engine = new SpectromancerEngine(guestProfile.className, undefined, {
          playerName: guestProfile.name,
          playerFace: guestProfile.face,
          enemyName: hostProfile.name,
          enemyFace: hostProfile.face,
          enemyClass: hostProfile.className,
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
        const card = engine.enemy.hand.find((c) => c.id === cardId);
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

  launchLanMatchWithCountdown(hostProfile, guestProfile, () => {
    engine = new SpectromancerEngine(hostProfile.className, undefined, {
      playerName: hostProfile.name,
      playerFace: hostProfile.face,
      enemyName: guestProfile.name,
      enemyFace: guestProfile.face,
      enemyClass: guestProfile.className,
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

const battlefieldBgs: Record<string, string> = {
  citadel: './ui/battlefield_citadel.jpg',
  sky: './ui/battlefield_sky.jpg',
  volcano: './ui/battlefield_volcano.jpg',
  forest: './ui/battlefield_forest.jpg',
};

function getThemeName(key: string): string {
  switch (key) {
    case 'citadel': return '星辉圣殿';
    case 'sky': return '天界圣峰';
    case 'volcano': return '熔岩炼狱';
    case 'forest': return '永恒密林';
    default: return '星辉圣殿';
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
    ? (CAMPAIGN_MAP1_NODES.find(n => n.levelId === selectedCampaignLevelId)?.face || `./faces/Face${aiFaceIndex + 1}.jpg`)
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

  const rMode = replay.mode || 'duel';
  if (rMode === 'league') sound.playBgm('combat2');
  else if (rMode === 'custom_deck') sound.playBgm('combat3');
  else sound.playBgm('combat1');

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
  const chosenClass = HERO_CLASSES[classIdx] || HERO_CLASSES[3];
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

  const initialStandings: LeagueCompetitor[] = [
    {
      name: name.trim() || '玩家',
      face: `./faces/Face${faceId}.jpg`,
      className: chosenClass.id === 'random' ? 'sorcery' : (chosenClass.id as HeroClass),
      classCn: chosenClass.nameCn,
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
    playerClassIdx: classIdx,
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
  const spellCount = engine.replaySteps.filter(s => s.side === 'player' && s.desc.includes('施放')).length;
  if (spellCount >= 4) {
    checkAndUnlockAchievement('storm_lord');
  }
  const bigCreature = engine.replaySteps.some(s => s.side === 'player' && s.desc.includes('耗能: ') && parseInt(s.desc.split('耗能: ')[1]) >= 8);
  if (bigCreature) {
    checkAndUnlockAchievement('dragon_master');
  }
  const earthOrStone = engine.replaySteps.some(s => s.side === 'player' && (s.cardName?.includes('石') || s.desc.includes('土')));
  if (earthOrStone) {
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
  const targetSide = isFriendly ? who : oppSide;

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
  if (spellId.includes('lightning') || spellId.includes('thunder') || card.element === 'air') {
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
    const mySlots = document.querySelectorAll(`.combat-board-slot[data-side="${who}"]`);
    mySlots.forEach((s) => {
      const shield = document.createElement('div');
      shield.className = 'vfx-shield-bubble';
      s.appendChild(shield);
      setTimeout(() => shield.remove(), 1100);
    });
    await new Promise((r) => setTimeout(r, 800));
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
    const tree = document.createElement('div');
    tree.className = 'vfx-ritforest-tree';
    tree.style.left = `${hero.x}px`;
    tree.style.top = `${hero.y}px`;
    layer.appendChild(tree);

    if (hero.el) {
      hero.el.classList.add('card-impact-hit');
      setTimeout(() => hero.el?.classList.remove('card-impact-hit'), 600);
    }

    await new Promise((r) => setTimeout(r, 900));
    tree.remove();
    return;
  }

  if (spellId === 'earth_natures_ritual' || spellId.includes('nature') || card.element === 'earth') {
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
      const shield = document.createElement('div');
      shield.className = 'vfx-shield-bubble';
      s.appendChild(shield);
      setTimeout(() => {
        col.remove();
        shield.remove();
      }, 1000);
    });

    await new Promise((r) => setTimeout(r, 850));
    return;
  }

  if (spellId === 'holy_divine_intervention' || spellId.includes('intervention')) {
    sound.play('divineint');
    const hero = getHeroPos(who);
    if (hero.el) {
      const shield = document.createElement('div');
      shield.className = 'vfx-shield-bubble';
      hero.el.appendChild(shield);
      setTimeout(() => shield.remove(), 1100);
    }

    await new Promise((r) => setTimeout(r, 850));
    return;
  }

  if (spellId.includes('divine') || spellId.includes('wrath') || card.element === 'holy') {
    sound.play(spellId.includes('divine_justice') ? 'divjustice' : 'wrathofgod');
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

  if (spellId.includes('cursed') || spellId.includes('drain') || card.element === 'death') {
    sound.play(spellId.includes('cursed') ? 'cursedfog' : 'drainsouls');
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

  if (spellId.includes('time')) {
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
  // 11. MECHANICS, CHAOS & DEMON POWER CHAINS
  // ========================================================
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

  // Default fallback for any remaining spells
  sound.play(card.id);
  app.classList.add('screen-shake');
  setTimeout(() => app.classList.remove('screen-shake'), 350);

  if (destEl) {
    destEl.classList.add('card-impact-hit');
    setTimeout(() => destEl?.classList.remove('card-impact-hit'), 500);
  }
  await new Promise((r) => setTimeout(r, 600));
}

function setupEngineCallbacks() {
  engine.onCardAnnouncement = async (_who, card) => {
    aiAnnouncedCard = card;
    sound.play('showeff1');
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

  engine.onStateChange = () => render();

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
              <div class="mode-card-desc">自定义 11 大流派与 78 款头像，人机快速博弈</div>
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
              <div class="mode-card-desc">查阅 136 张官方正版卡牌与特技秘典</div>
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
        </div>
      </div>

      <!-- FOOTER STATUS & VERSION -->
      <div class="mobile-menu-footer">
        <div class="menu-footer-left">
          <span class="footer-tip">💡 提示：在战斗中轻触任意卡牌或生物，可在羊皮纸中查看详尽战术技能</span>
        </div>
        <div class="menu-version-text">v 1.0 Mobile · HD</div>
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
          <div class="lan-profile-face-wrap" id="btn-lan-cycle-face" title="点击切换英雄形象 (共78款)">
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
              当前形象: <strong>#${lanPlayerFaceId}</strong> · 流派: <strong style="color:#ffd700;">${currentClass.nameCn}</strong>（共 11 大流派及随机可选）
            </div>
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

function renderSingleDuelSetup(): string {
  const pClassObj = HERO_CLASSES[playerClassIndex];
  const aiClassObj = HERO_CLASSES[aiClassIndex];

  const pFaceUrl = `./faces/Face${playerFaceIndex + 1}.jpg`;
  const aiFaceUrl = `./faces/Face${aiFaceIndex + 1}.jpg`;
  const curScenario = BATTLEFIELD_SCENARIOS[singleDuelScenarioIdx];

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
            <div style="display:flex; align-items:center; gap:6px; flex:1; justify-content:flex-end;">
              <span class="single-duel-setting-label">🗺️ 战场场景:</span>
              <div class="league-choice-stepper" style="margin:0;">
                <button class="campaign-diff-btn" id="btn-duel-scene-prev">◀</button>
                <span class="league-choice-val" style="min-width:120px; text-align:center;">${curScenario.name}</span>
                <button class="campaign-diff-btn" id="btn-duel-scene-next">▶</button>
              </div>
            </div>
          </div>
          <div class="single-duel-rule-desc">
            ⚡ <strong>场景法则：</strong>${curScenario.rule}
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
                <div class="duel-face-indicator">头像 ${playerFaceIndex + 1}/78</div>
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

          <!-- AI (大法师) -->
          <div class="duel-combatant-card">
            <div class="duel-name-plate">大法师</div>
            <div class="duel-avatar-picker">
              <button class="duel-arrow-btn" id="btn-ai-face-prev" title="上一个头像">◀</button>
              <div class="duel-avatar-wrap">
                <img src="${aiFaceUrl}" class="duel-avatar-img" alt="AI Face" />
                <div class="duel-face-indicator">头像 ${aiFaceIndex + 1}/78</div>
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

function renderClassGridPickerModal(target: 'player' | 'ai' | 'lan'): string {
  const currentIdx = target === 'player' ? playerClassIndex : (target === 'ai' ? aiClassIndex : lanPlayerClassIdx);
  const targetLabel = target === 'player' ? '玩家' : (target === 'ai' ? '电脑对手' : '局域网对决');
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

function renderCodexPageContent(tab: string): string {
  switch (tab) {
    case 'deck':
      return `
        <div class="codex-section-card">
          <div class="codex-section-title">🃏 20张手牌严格构筑体系</div>
          <div class="codex-section-body">
            Spectromancer 采用严密的 20 张卡牌体系：<br>
            • <strong>四大基础元素：</strong> 火系 4 张、水系 4 张、气系 4 张、土系 4 张。<br>
            • <strong>专属流派法术：</strong> 当前法师专精系 4 张。<br>
            所有卡牌分为低阶（1-4费）、中阶（2-9费）、高阶（5-11费）与传奇（10-12费）梯度，确保不同阶段均有策略应对。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">⚖️ 核心卡牌平衡法则</div>
          <div class="codex-section-body">
            为保证决斗策略的绝对平衡，构筑遵循官方设计准则：<br>
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
          <div class="codex-section-title">✨ 原版六大经典法术专精 (Base Game)</div>
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
            • <strong>👺 地精幻术 (Goblin)：</strong> 率领哥布林英雄、爆破小队、鼠疫入侵与扰乱奇兵，具备灵活突袭与牌库削减奇效。
          </div>
        </div>

        <div class="codex-section-card">
          <div class="codex-section-title">📜 全流派与卡池数量官方考证</div>
          <div class="codex-section-body">
            • <strong>实装流派总数：</strong> 正统官方最终版本共 <strong>11 大法术专精</strong>。在选人界面中，提供这 11 大流派以及 1 项“🎲 随机”选项，共 12 个可选项。<br>
            • <strong>卡牌总数构成：</strong> 基础四大元素（火、水、气、土）各 12 张（共 48 张）+ 11 个专精流派各 8 张专属卡（共 88 张）= <strong>全游戏共 136 张卡牌</strong>。<br>
            • <strong>流派数量澄清：</strong> 早期部分文档中流传的“16大流派”，系原版早期草案中的未实装废案占位符（如狂热教徒、吸血鬼领主等），实际并未有对应卡牌与机制。
          </div>
        </div>
      `;

    case 'modes':
      return `
        <div class="codex-section-card">
          <div class="codex-section-title">🎮 丰厚多样的对战玩法</div>
          <div class="codex-section-body">
            1. <strong>单局对战 (Single Duel)：</strong> 自由配置 11 大法师专精与随机流派、精美英雄头像与 AI 难度，畅享快节奏的纯粹法力交锋。<br>
            2. <strong>战役模式 (Campaign)：</strong> 踏上宏伟的元素大陆大地图，攻伐 7 大篇章领地据点；击败领主开启后续多重分支路线，体验各领地专属战规。<br>
            3. <strong>英雄联赛 (League of Heroes)：</strong> 支持创建多名法师角色档案，参与 8 轮天梯排位决战，冲击全服巅峰积分榜首！<br>
            4. <strong>自组卡牌工坊 (Custom Deck)：</strong> 精细构筑专属 20 张王牌套牌，体验极致的套路搭配与战术博弈。<br>
            5. <strong>局域网对战 (LAN Duel)：</strong> 同一无线局域网或手机热点下，输入 4 位房间码即可实现低延迟跨设备双人实时联机对决！<br>
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
            const elemBadgeName = c.className
              ? (HERO_CLASSES.find(cls => cls.id === c.className)?.nameCn || '专属')
              : (elementLabels[c.element] || '基础');
            const typeBadgeName = c.isWall ? '城墙' : (c.type === 'creature' ? '生物' : '法术');
            return `
              <div class="codex-card-item">
                <div class="codex-card-thumb-wrap">
                  <img src="${toRel(c.imgUrl)}" class="codex-card-thumb" alt="${c.nameCn}" loading="lazy" />
                  <div class="codex-card-badge-cost" title="能量消耗: ${c.cost}">${c.cost}</div>
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
          <button class="codex-tab-btn ${activeHelpTab === 'classes' ? 'active' : ''}" id="tab-codex-classes">🧙 11大流派</button>
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
              <img src="./faces/Face${campaignPlayerFaceId}.jpg" class="league-avatar-img" alt="头像" />
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
                <span class="league-choice-val">${chosenClass.nameCn}</span>
                <button class="campaign-diff-btn" id="btn-campaign-class-next">▶</button>
              </div>
            </div>

            <div class="league-field-row">
              <span class="league-field-label">战役难度:</span>
              <div class="league-choice-stepper">
                <button class="campaign-diff-btn" id="btn-campaign-setup-diff-prev">◀</button>
                <span class="league-choice-val diff">${campaignDifficulties[campaignPlayerDifficultyIdx]}</span>
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
  return `
    <div class="modal-overlay" id="options-modal-overlay">
      <div class="stone-options-dialog" style="width:clamp(560px, 58vw, 760px); max-height:88vh; display:flex; flex-direction:column;">
        <div class="options-header-banner" style="background: linear-gradient(90deg, #2b180d 0%, #4a2816 50%, #2b180d 100%); flex-shrink:0; display:flex; justify-content:space-between; align-items:center; padding:10px 20px;">
          <div class="options-title-text" style="color:#ffd700; font-size:clamp(18px, 1.5vw, 22px);">⚙️ 游戏选项与音频设置</div>
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="modal-close-btn confirm-tick-btn" id="btn-confirm-options" style="position:static; width:34px; height:34px; font-size:20px; font-weight:bold; cursor:pointer;" title="确定完成">✓</button>
            <button class="modal-close-btn" id="btn-close-options" style="position:static; width:34px; height:34px; font-size:22px; cursor:pointer; color:#f87171; background:rgba(239,68,68,0.18); border:1.5px solid #ef4444; border-radius:8px; display:inline-flex; align-items:center; justify-content:center;" title="关闭">×</button>
          </div>
        </div>

        <div style="flex:1; overflow-y:auto; padding:clamp(18px, 2.4vh, 28px); display:flex; flex-direction:column; gap:18px;">
          <!-- BGM Setting -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1.5px solid #d4b378; border-radius:10px; padding:14px 20px; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            <div>
              <div style="font-size:clamp(16px, 1.35vw, 19.5px); font-weight:900; color:#381e05;">🎵 游戏背景音乐 (BGM)</div>
              <div style="font-size:clamp(12.5px, 1vw, 14px); color:#786047; margin-top:3px;">控制主菜单、大地图与决斗战斗背景配乐</div>
            </div>
            <button class="duel-stone-action-btn ${sound.bgmEnabled ? 'start' : 'close'}" id="btn-toggle-bgm" style="padding:8px 24px; font-size:clamp(14px, 1.15vw, 16px); min-width:115px; height:42px;">
              ${sound.bgmEnabled ? '🔊 已开启' : '🔇 已静音'}
            </button>
          </div>

          <!-- SFX Setting -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1.5px solid #d4b378; border-radius:10px; padding:14px 20px; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            <div>
              <div style="font-size:clamp(16px, 1.35vw, 19.5px); font-weight:900; color:#381e05;">🔔 战斗与技能音效 (SFX)</div>
              <div style="font-size:clamp(12.5px, 1vw, 14px); color:#786047; margin-top:3px;">控制生物召唤、攻击冲击、魔法轰击与界面音效</div>
            </div>
            <button class="duel-stone-action-btn ${sound.enabled ? 'start' : 'close'}" id="btn-toggle-sfx" style="padding:8px 24px; font-size:clamp(14px, 1.15vw, 16px); min-width:115px; height:42px;">
              ${sound.enabled ? '🔔 已开启' : '🔕 已静音'}
            </button>
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

          <!-- Battlefield Background Theme -->
          <div style="background:#ffffff; border:1.5px solid #d4b378; border-radius:10px; padding:16px 20px; display:flex; flex-direction:column; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:clamp(16px, 1.35vw, 19.5px); font-weight:900; color:#381e05;">🗺️ 对战战场背景环境</div>
                <div style="font-size:clamp(12.5px, 1vw, 14px); color:#786047; margin-top:3px;">选择战斗对决主界面的远景圣所主题</div>
              </div>
              <span id="options-theme-label" style="font-size:clamp(14px, 1.2vw, 16px); color:#854d0e; font-weight:900; background:#fef3c7; border:1.5px solid #fde68a; padding:4px 14px; border-radius:8px;">
                ${getThemeName(currentBattlefieldTheme)}
              </span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px;">
              <button class="duel-stone-action-btn ${currentBattlefieldTheme === 'citadel' ? 'start' : 'close'}" id="btn-theme-citadel" style="height:44px; font-size:clamp(13px, 1.1vw, 15px); padding:4px;">🏛️ 星辉圣殿</button>
              <button class="duel-stone-action-btn ${currentBattlefieldTheme === 'sky' ? 'start' : 'close'}" id="btn-theme-sky" style="height:44px; font-size:clamp(13px, 1.1vw, 15px); padding:4px;">☁️ 天界圣峰</button>
              <button class="duel-stone-action-btn ${currentBattlefieldTheme === 'volcano' ? 'start' : 'close'}" id="btn-theme-volcano" style="height:44px; font-size:clamp(13px, 1.1vw, 15px); padding:4px;">🌋 熔岩炼狱</button>
              <button class="duel-stone-action-btn ${currentBattlefieldTheme === 'forest' ? 'start' : 'close'}" id="btn-theme-forest" style="height:44px; font-size:clamp(13px, 1.1vw, 15px); padding:4px;">🌲 永恒密林</button>
            </div>
          </div>

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

  const elementsOrder: ElementType[] = ['fire', 'water', 'air', 'earth', p.specialElement];
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

  const previewCard = inspectedCard || selectedCard || (showOpponentHand ? e.hand[0] : p.hand[0]);

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
            <button class="combat-strip-item btn-end-turn" id="btn-end-turn" ${engine.activeTurn !== 'player' || engine.isCombatPhase ? 'disabled' : ''} title="结束己方回合并开始交战">
              <span class="strip-icon">⚔️</span>
              <span class="strip-text">${engine.activeTurn === 'player' ? '结束回合' : '思考中'}</span>
            </button>
          `}
        </div>

        <!-- SUB-COLUMN 2: Info & Double Parchment (英雄卡片、卡牌检视、实况记录) -->
        <div class="combat-info-column">
          <!-- Top: Heroes Stack -->
          <div class="combat-heroes-stack">
            <!-- Opponent Hero Card: Sinister Demonic Theme with Full Width Mana Bar -->
            <div class="combat-hero-row opponent ${engine.activeTurn === 'enemy' ? 'turn-active' : 'turn-inactive'}">
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
                    <span class="combat-hero-class-tag enemy">${eSpecialName}</span>
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
                  <span class="combat-hero-class-tag player">${pSpecialName}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Double Parchment Container -->
          <div class="combat-double-parchment-container">
            <!-- 1. Upper: Card Inspection Parchment -->
            <div class="combat-inspect-parchment">
              ${previewCard ? `
                <div class="parchment-card-top-row">
                  <img src="${toRel(previewCard.imgBigUrl || previewCard.imgUrl)}" class="parchment-card-art ${previewCard.type === 'spell' ? 'spell-art' : ''}" alt="${previewCard.nameCn}" />
                  <div class="parchment-card-meta">
                    <div class="parchment-card-title">${previewCard.nameCn} (${previewCard.cost}费)</div>
                    <div class="parchment-card-sub">
                      ${previewCard.className ? (HERO_CLASSES.find(c => c.id === previewCard.className)?.nameCn || '特殊') : (elemNames[previewCard.element] || '特殊')} · ${previewCard.type === 'creature' ? '生物' : '法术'} · ${previewCard.name}
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
                  ${previewCard.desc}
                </div>
              ` : `
                <div class="parchment-empty-tip">
                  轻触任意手牌或在场生物<br/>检视详尽技能说明与战术属性
                </div>
              `}
            </div>

            <!-- 2. Lower: Combat Log Chronicle -->
            <div class="combat-log-parchment">
              <div class="combat-log-header">📜 战斗实况记录</div>
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
              ? (selectedCard.type === 'creature'
                  ? `选择位置 ${selectedCard.nameCn}`
                  : (selectedCard.requiresTarget ? `选择目标 ${selectedCard.nameCn}` : `选择施法 ${selectedCard.nameCn}`))
              : ''}
          </div>

          <!-- 6 Slots Arena (Centered, leaving generous breathing space around scenery) -->
          <div class="combat-slots-arena">
            <!-- Enemy 6 Slots Row -->
            <div class="combat-slots-lane enemy-lane">
              ${engine.enemyBoard.map((c, idx) => {
                const isTarget = selectedCard?.type === 'spell' && selectedCard.requiresTarget && !isFriendlyTargetSpell(selectedCard) && c !== null && !c.spellImmune;
                return `
                  <div class="combat-board-slot top-slot ${isTarget ? 'active-target' : ''}" data-side="enemy" data-slot-index="${idx}">
                    <div class="slot-filigree top"></div>
                    ${c ? `
                      <div class="board-card vertical ${c.flying ? 'flying' : ''} ${c.uid === engine.lastSummonedUid ? 'card-summon-settle' : ''}">
                        <img src="${toRel(c.card.imgBigUrl || c.card.imgUrl)}" class="board-card-art" alt="${c.card.nameCn}" />
                        <div class="card-cost-gem">${c.card.cost}</div>
                        <div class="card-stat-atk ${c.buffedAttack || c.currentAttack > c.baseAttack ? 'buffed' : (c.currentAttack < c.baseAttack ? 'debuffed' : '')}" title="攻击力: ${c.currentAttack} (基础: ${c.baseAttack})">${c.currentAttack}</div>
                        <div class="card-stat-hp" title="生命值: ${c.currentLife}">${c.currentLife}</div>
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
                const isCreatureTarget = selectedCard?.type === 'creature' && c === null;
                const isSpellTarget = selectedCard?.type === 'spell' && selectedCard.requiresTarget && isFriendlyTargetSpell(selectedCard) && c !== null;
                const isTarget = isCreatureTarget || isSpellTarget;
                return `
                  <div class="combat-board-slot bottom-slot ${isTarget ? 'active-target' : ''}" data-side="player" data-slot-index="${idx}">
                    <div class="slot-filigree top"></div>
                    ${c ? `
                      <div class="board-card vertical ${c.flying ? 'flying' : ''} ${c.uid === engine.lastSummonedUid ? 'card-summon-settle' : ''}">
                        <img src="${toRel(c.card.imgBigUrl || c.card.imgUrl)}" class="board-card-art" alt="${c.card.nameCn}" />
                        <div class="card-cost-gem">${c.card.cost}</div>
                        <div class="card-stat-atk ${c.buffedAttack || c.currentAttack > c.baseAttack ? 'buffed' : (c.currentAttack < c.baseAttack ? 'debuffed' : '')}" title="攻击力: ${c.currentAttack} (基础: ${c.baseAttack})">${c.currentAttack}</div>
                        <div class="card-stat-hp" title="生命值: ${c.currentLife}">${c.currentLife}</div>
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
              const targetHand = showOpponentHand ? e.hand : p.hand;
              const targetSpecialElem = showOpponentHand ? e.specialElement : p.specialElement;
              const currentSpecialName = showOpponentHand ? eSpecialName : pSpecialName;
              const cardsOfElem = targetHand.filter((c) => c.element === elem || (elem === targetSpecialElem && c.element === 'special'));
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
                      const cardImg = card.imgBigUrl || card.imgUrl;
                      if (showOpponentHand) {
                        const isRevealed = engine.enemyRevealedCardIds.has(card.id);
                        const isSelected = selectedCard?.id === card.id || inspectedCard?.id === card.id;

                        if (isRevealed) {
                          return `
                            <div class="combat-hand-card-item hand-card-cell vertical elem-${card.element} type-${card.type} revealed ${isSelected ? 'selected' : ''}" data-card-id="${card.id}" data-is-opponent="true">
                              <img src="${toRel(cardImg)}" class="hand-card-art ${card.type === 'spell' ? 'spell-art' : ''}" alt="${card.nameCn}" />
                              <div class="card-cost-gem elem-${card.element}">${card.cost}</div>
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
                        const canAfford = p.mana[card.element] >= card.cost;
                        const isSelected = selectedCard?.id === card.id;
                        return `
                          <div class="combat-hand-card-item hand-card-cell vertical elem-${card.element} type-${card.type} ${canAfford ? 'playable' : 'disabled'} ${isSelected ? 'selected' : ''}" data-card-id="${card.id}">
                            <img src="${toRel(cardImg)}" class="hand-card-art ${card.type === 'spell' ? 'spell-art' : ''}" alt="${card.nameCn}" />
                            <div class="card-cost-gem elem-${card.element}">${card.cost}</div>
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
  `;
}

function renderBattlefieldRulesModal(): string {
  let title = '当前战场特殊规则';
  let bodyHtml = '';

  if (currentBattleSource === 'league') {
    const opp = (tournamentData as any[]).find((t: any) => t.name === engine.enemy.name);
    const ruleText = engine.leagueRule || opp?.rule || '无特殊战规，遵循常规联赛决斗规则。';
    const oppClassObj = HERO_CLASSES.find(c => c.id === engine.enemy.className);
    title = `英雄联赛 · 特殊战规 (${engine.enemy.name})`;
    bodyHtml = `
      <div style="font-size:clamp(17px, 1.4vw, 22px); margin-bottom:12px; color:#5c2c10; font-weight:900;">
        对手：${engine.enemy.name} · ${oppClassObj?.nameCn || engine.enemy.className} (第 ${activeLeague?.currentMatch || 1} 场)
      </div>
      <div style="background:rgba(142,114,58,0.18); border-left:4px solid #8e723a; padding:12px 16px; border-radius:6px; font-size:clamp(16px, 1.3vw, 20px); line-height:1.65; color:#221508; font-weight:800;">
        ⚡ <strong>特殊规则：</strong>${ruleText}
      </div>
    `;
  } else if (currentBattleSource === 'campaign') {
    const lvl = (campaignData as CampaignLevel[]).find(l => l.id === selectedCampaignLevelId) || (campaignData as CampaignLevel[])[0];
    title = `战役关卡 · ${lvl.oppName} (${lvl.title})`;
    bodyHtml = `
      <div style="font-size:clamp(17px, 1.4vw, 22px); margin-bottom:10px; color:#5c2c10; font-weight:900;">
        领地首领：${lvl.oppName} · ${lvl.title} (生命值: ${lvl.enemyHp})
      </div>
      <div style="margin-bottom:12px; font-size:clamp(15.5px, 1.25vw, 19.5px); line-height:1.6; color:#2a1a0e; font-weight:700;">
        <strong>领地战况：</strong>${lvl.story.replace(/\r?\n/g, ' ')}
      </div>
      ${lvl.rules ? `
        <div style="background:rgba(142,114,58,0.18); border-left:4px solid #8e723a; padding:12px 16px; border-radius:6px; font-size:clamp(16px, 1.3vw, 20px); line-height:1.65; color:#221508; font-weight:800;">
          ⚡ <strong>特殊规则：</strong>${lvl.rules.replace(/\r?\n/g, ' ')}
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
  const isFirstBeaten = completedCampaignLevels.includes(1);

  // If first level beaten, unlock branching stages 2, 3, 4 (as in Image 1 reference)
  const availableNodeIds = isFirstBeaten
    ? [2, 3, 4]
    : [1];

  if (isFirstBeaten && selectedCampaignLevelId === 1) {
    selectedCampaignLevelId = 2;
  }
  const currentLvl = (campaignData as CampaignLevel[]).find(l => l.id === selectedCampaignLevelId) || (campaignData as CampaignLevel[])[0];

  return `
    <div class="campaign-screen-view">
      <div class="campaign-map-viewport">
        <img src="./ui/Campaign_Map1.jpg" class="campaign-map-bg" alt="战役大地图" />

        <div class="campaign-top-banner-wrap">
          <div class="campaign-top-banner">
            <span>选择下一个对手:</span>
          </div>
        </div>

        ${CAMPAIGN_MAP1_NODES.filter(n => availableNodeIds.includes(n.levelId) || completedCampaignLevels.includes(n.levelId)).map(n => {
          const isSelected = n.levelId === selectedCampaignLevelId;
          const isCompleted = completedCampaignLevels.includes(n.levelId);
          return `
            <div class="campaign-node ${isSelected ? 'selected' : ''}"
                 data-level-id="${n.levelId}"
                 style="left: ${n.x}%; top: ${n.y}%;"
                 title="${n.name} (${n.landmark})">
              <div class="campaign-node-avatar-frame">
                <img src="${n.face}" class="campaign-node-img" alt="${n.name}" />
                ${isCompleted ? '<div class="campaign-node-status-badge">✓</div>' : ''}
              </div>
              <div class="campaign-node-pointer"></div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="campaign-bottom-deck">
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
              <img src="./faces/Face${leaguePlayerFaceId}.jpg" class="league-avatar-img" alt="头像" />
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
                <span class="league-choice-val">${chosenClass.nameCn}</span>
                <button class="campaign-diff-btn" id="btn-league-class-next">▶</button>
              </div>
            </div>

            <div class="league-field-row">
              <span class="league-field-label">难度:</span>
              <div class="league-choice-stepper">
                <button class="campaign-diff-btn" id="btn-league-diff-prev">◀</button>
                <span class="league-choice-val diff">${leagueDifficulties[leagueDifficultyIdx]}</span>
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
      img: './cards/Griffin.jpg',
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
      img: './cards/Troll.jpg',
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
  const elements: { key: ElementType; label: string }[] = [
    { key: 'fire', label: '火系' },
    { key: 'water', label: '水系' },
    { key: 'air', label: '气系' },
    { key: 'earth', label: '土系' },
    { key: (editingDeck.className === 'sorcery' ? 'special' : (editingDeck.className === 'necromancer' ? 'death' : (editingDeck.className === 'cleric' ? 'holy' : (editingDeck.className === 'mechanician' ? 'mechanics' : (editingDeck.className === 'dominator' ? 'control' : (editingDeck.className === 'chaosmaster' ? 'chaos' : 'illusion')))))), label: classObj.nameCn }
  ];

  let pool = allCardsList.filter(c => {
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
                          <img src="${toRel(card.imgUrl)}" class="deck-slot-card-img" alt="${card.nameCn}" />
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
                <span style="font-size:12px; font-weight:800; color:#991b1b;">能量消耗: ${previewCard.cost}</span>
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
                <div class="deck-pool-item ${isEquipped ? 'already-equipped' : ''}" data-card-id="${c.id}" title="${c.nameCn} (${c.cost}耗能)${isEquipped ? ' - 已配置在卡组中' : ''}">
                  <img src="${toRel(c.imgUrl)}" class="deck-slot-card-img" alt="${c.nameCn}" />
                  <div class="deck-slot-cost">${c.cost}</div>
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
  const isWin = engine.winner === 'player';

  return `
    <div class="modal-overlay" id="game-over-modal-overlay">
      <div class="battle-result-stone-dialog ${isWin ? 'win' : 'defeat'}">
        <div class="battle-result-crest-wrap">
          <div class="battle-result-crest">${isWin ? '🏆' : '💀'}</div>
          <div class="battle-result-title-banner ${isWin ? 'win' : 'defeat'}">
            <h2 class="battle-result-title">${isWin ? '决 战 胜 利' : '战 局 败 北'}</h2>
            <div class="battle-result-subtitle">${isWin ? '✦ VICTORY ACHIEVED ✦' : '✦ DEFEAT IN BATTLE ✦'}</div>
          </div>
        </div>

        <div class="battle-result-body">
          <p class="battle-result-desc">
            ${isWin
              ? (currentBattleSource === 'campaign'
                  ? `恭喜大捷！第 <strong>${selectedCampaignLevelId}</strong> 关对手已被击败，大地图新战线现已向您敞开！`
                  : (currentBattleSource === 'league'
                      ? `联赛凯歌高奏！您在第 <strong>${activeLeague?.currentMatch || 1}</strong> 轮对决中力克强敌，积分大幅飙升！`
                      : (currentBattleSource === 'lan'
                          ? `局域网联机凯歌！您在与 <strong>${engine.enemy.name}</strong> 的高能智斗中运筹帷幄，赢得了整场对决的无上荣耀！`
                          : '您精心构筑的卡组经受住了实战考验，以完美的元素统合之力瓦解了敌军！')))
              : (currentBattleSource === 'lan'
                  ? `在与 <strong>${engine.enemy.name}</strong> 的奥术交锋中棋差一着……胜败乃法师常事，重整旗鼓再来一局！`
                  : '英雄生命力耗尽，战场符文暗淡……但真正的魔导师在沉寂中洞察生机，总结克敌之道，再次问鼎巅峰！')}
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
          ${currentBattleSource === 'lan' ? `
            <button class="battle-result-btn next" id="btn-lan-result-return">
              <span class="btn-icon">🌐</span>
              <span>返回局域网大厅</span>
            </button>
          ` : `
            <button class="battle-result-btn restart" id="btn-restart">
              <span class="btn-icon">🔄</span>
              <span>${isWin ? '再次对战' : '整军再战'}</span>
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

function getCombatBgmForCurrentBattle(): 'combat1' | 'combat2' | 'combat3' {
  if (currentBattleSource === 'lan') {
    return 'combat3';
  }
  if (currentBattleSource === 'league') {
    return 'combat2';
  }
  if (currentBattleSource === 'custom_deck') {
    return 'combat3';
  }
  if (currentBattleSource === 'campaign' || engine.currentCampaign) {
    const lvlId = selectedCampaignLevelId || engine.currentCampaign?.id || 1;
    if (lvlId <= 20) return 'combat1';
    if (lvlId <= 45) return 'combat2';
    return 'combat3';
  }
  return 'combat1';
}

function syncModeBgm() {
  if (currentView === 'battle') {
    sound.playBgm(getCombatBgmForCurrentBattle());
  } else if (currentView === 'replay_viewer') {
    const rMode = activeViewingReplay?.mode || 'duel';
    if (rMode === 'league') sound.playBgm('combat2');
    else if (rMode === 'custom_deck') sound.playBgm('combat3');
    else sound.playBgm('combat1');
  } else {
    sound.playBgm('menu1');
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

  attachEventListeners();

  const logScroll = document.getElementById('combat-log-scroll');
  if (logScroll) {
    logScroll.scrollTop = logScroll.scrollHeight;
  }
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
    lanPlayerFaceId = (lanPlayerFaceId % 78) + 1;
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
    playerFaceIndex = (playerFaceIndex - 1 + 78) % 78;
    render();
  });
  document.getElementById('btn-player-face-next')?.addEventListener('click', () => {
    sound.play('click');
    playerFaceIndex = (playerFaceIndex + 1) % 78;
    render();
  });

  document.getElementById('btn-player-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    playerClassIndex = (playerClassIndex - 1 + HERO_CLASSES.length) % HERO_CLASSES.length;
    render();
  });
  document.getElementById('btn-player-class-next')?.addEventListener('click', () => {
    sound.play('click');
    playerClassIndex = (playerClassIndex + 1) % HERO_CLASSES.length;
    render();
  });
  document.getElementById('btn-player-class-pick')?.addEventListener('click', () => {
    sound.play('click');
    playerClassIndex = (playerClassIndex + 1) % HERO_CLASSES.length;
    render();
  });
  document.getElementById('btn-player-class-grid')?.addEventListener('click', () => {
    sound.play('click');
    showClassGridPickerFor = 'player';
    render();
  });

  document.getElementById('btn-ai-face-prev')?.addEventListener('click', () => {
    sound.play('click');
    aiFaceIndex = (aiFaceIndex - 1 + 78) % 78;
    render();
  });
  document.getElementById('btn-ai-face-next')?.addEventListener('click', () => {
    sound.play('click');
    aiFaceIndex = (aiFaceIndex + 1) % 78;
    render();
  });

  document.getElementById('btn-ai-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    aiClassIndex = (aiClassIndex - 1 + HERO_CLASSES.length) % HERO_CLASSES.length;
    render();
  });
  document.getElementById('btn-ai-class-next')?.addEventListener('click', () => {
    sound.play('click');
    aiClassIndex = (aiClassIndex + 1) % HERO_CLASSES.length;
    render();
  });
  document.getElementById('btn-ai-class-pick')?.addEventListener('click', () => {
    sound.play('click');
    aiClassIndex = (aiClassIndex + 1) % HERO_CLASSES.length;
    render();
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
      }
      showClassGridPickerFor = null;
      render();
    });
  });

  document.getElementById('btn-duel-diff-prev')?.addEventListener('click', () => {
    sound.play('click');
    singleDuelDifficultyIdx = (singleDuelDifficultyIdx - 1 + SINGLE_DUEL_DIFFICULTIES.length) % SINGLE_DUEL_DIFFICULTIES.length;
    render();
  });
  document.getElementById('btn-duel-diff-next')?.addEventListener('click', () => {
    sound.play('click');
    singleDuelDifficultyIdx = (singleDuelDifficultyIdx + 1) % SINGLE_DUEL_DIFFICULTIES.length;
    render();
  });

  document.getElementById('btn-duel-scene-prev')?.addEventListener('click', () => {
    sound.play('click');
    singleDuelScenarioIdx = (singleDuelScenarioIdx - 1 + BATTLEFIELD_SCENARIOS.length) % BATTLEFIELD_SCENARIOS.length;
    render();
  });
  document.getElementById('btn-duel-scene-next')?.addEventListener('click', () => {
    sound.play('click');
    singleDuelScenarioIdx = (singleDuelScenarioIdx + 1) % BATTLEFIELD_SCENARIOS.length;
    render();
  });

  document.getElementById('btn-start-duel')?.addEventListener('click', () => {
    sound.play('click');
    currentBattleSource = 'duel';

    const chosenDiff = SINGLE_DUEL_DIFFICULTIES[singleDuelDifficultyIdx];

    // Determine Scenario
    let scenario = BATTLEFIELD_SCENARIOS[singleDuelScenarioIdx];
    if (scenario.id === 'random') {
      const candidates = BATTLEFIELD_SCENARIOS.filter(s => s.id !== 'random');
      scenario = candidates[Math.floor(Math.random() * candidates.length)];
    }

    currentBattlefieldTheme = scenario.theme;
    sound.playBgm(getCombatBgmForCurrentBattle());

    const availableClasses: HeroClass[] = [
      'sorcery', 'necromancer', 'cleric', 'mechanician', 'dominator',
      'chaosmaster', 'illusionist', 'demonologist', 'beastmaster', 'chronomancer', 'goblin'
    ];

    let pClass: HeroClass = HERO_CLASSES[playerClassIndex].id === 'random'
      ? availableClasses[Math.floor(Math.random() * availableClasses.length)]
      : (HERO_CLASSES[playerClassIndex].id as HeroClass);

    let eClass: HeroClass = HERO_CLASSES[aiClassIndex].id === 'random'
      ? availableClasses[Math.floor(Math.random() * availableClasses.length)]
      : (HERO_CLASSES[aiClassIndex].id as HeroClass);

    const allCards = cardsData as CardDef[];
    const initPlayerCreatures: Array<{ slot: number; card: CardDef }> = [];
    if (scenario.initialPlayerCreatures) {
      for (const item of scenario.initialPlayerCreatures) {
        const c = allCards.find(card => card.id === item.cardId);
        if (c) initPlayerCreatures.push({ slot: item.slot, card: c });
      }
    }

    const initEnemyCreatures: Array<{ slot: number; card: CardDef }> = [];
    if (scenario.initialEnemyCreatures) {
      for (const item of scenario.initialEnemyCreatures) {
        const c = allCards.find(card => card.id === item.cardId);
        if (c) initEnemyCreatures.push({ slot: item.slot, card: c });
      }
    }

    engine = new SpectromancerEngine(pClass, undefined, {
      playerName: '玩家',
      playerFace: `./faces/Face${playerFaceIndex + 1}.jpg`,
      enemyName: '大法师',
      enemyFace: `./faces/Face${aiFaceIndex + 1}.jpg`,
      enemyClass: eClass,
      playerHp: scenario.playerHp,
      enemyHp: scenario.enemyHp,
      difficulty: chosenDiff,
      leagueRule: scenario.rule,
      initialPlayerCreatures: initPlayerCreatures,
      initialEnemyCreatures: initEnemyCreatures,
      extraPlayerMana: scenario.extraPlayerMana,
      extraEnemyMana: scenario.extraEnemyMana,
    });

    setupEngineCallbacks();
    selectedCard = null;
    inspectedCard = null;
    showHelpModal = false;
    showOptionsModal = false;
    currentView = 'battle';
    render();
    showToastNotice(`⚔️ 对战开启！【${scenario.name}】(${chosenDiff}难度)`);
  });

  // ===================================
  // CAMPAIGN ACTIONS
  // ===================================
  document.getElementById('close-campaign-btn')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'menu';
    render();
  });

  document.querySelectorAll('.btn-start-campaign').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lvlId = parseInt((btn as HTMLElement).dataset.levelId || '1');
      const lvl = (campaignData as CampaignLevel[]).find((l) => l.id === lvlId);
      if (lvl) {
        sound.play('click');
        currentBattleSource = 'campaign';
        selectedCampaignLevelId = lvlId;
        const campaignDiff = activeCampaign?.difficulty || campaignDifficulties[campaignDifficultyIndex] || '普通';
        engine = new SpectromancerEngine('sorcery', lvl, {
          difficulty: campaignDiff,
        });
        setupEngineCallbacks();
        selectedCard = null;
        inspectedCard = null;
        currentView = 'battle';
        render();
      }
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
      sound.playBgm('combat1');
      render();
    } else {
      showToastNotice('ℹ️ 暂无未完成的对战存档');
    }
  };

  document.getElementById('btn-menu-load-save')?.addEventListener('click', handleLoadSavedBattle);
  document.getElementById('btn-resume-battle-banner')?.addEventListener('click', handleLoadSavedBattle);
  document.getElementById('btn-resume-battle-action')?.addEventListener('click', handleLoadSavedBattle);

  document.getElementById('btn-toggle-bgm')?.addEventListener('click', () => {
    sound.play('click');
    sound.toggleBgm();
    const btn = document.getElementById('btn-toggle-bgm');
    if (btn) {
      btn.className = `duel-stone-action-btn ${sound.bgmEnabled ? 'start' : 'close'}`;
      btn.textContent = sound.bgmEnabled ? '🔊 已开启' : '🔇 已静音';
    }
  });

  document.getElementById('btn-toggle-sfx')?.addEventListener('click', () => {
    sound.play('click');
    sound.toggleMute();
    const btn = document.getElementById('btn-toggle-sfx');
    if (btn) {
      btn.className = `duel-stone-action-btn ${sound.enabled ? 'start' : 'close'}`;
      btn.textContent = sound.enabled ? '🔔 已开启' : '🔕 已静音';
    }
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

  const updateThemeButtons = () => {
    const lbl = document.getElementById('options-theme-label');
    if (lbl) lbl.textContent = getThemeName(currentBattlefieldTheme);
    (['citadel', 'sky', 'volcano', 'forest'] as const).forEach(t => {
      const b = document.getElementById(`btn-theme-${t}`);
      if (b) {
        b.className = `duel-stone-action-btn ${currentBattlefieldTheme === t ? 'start' : 'close'}`;
      }
    });
  };

  document.getElementById('btn-theme-citadel')?.addEventListener('click', () => {
    sound.play('click');
    currentBattlefieldTheme = 'citadel';
    localStorage.setItem('battlefield_theme', 'citadel');
    updateThemeButtons();
  });

  document.getElementById('btn-theme-sky')?.addEventListener('click', () => {
    sound.play('click');
    currentBattlefieldTheme = 'sky';
    localStorage.setItem('battlefield_theme', 'sky');
    updateThemeButtons();
  });

  document.getElementById('btn-theme-volcano')?.addEventListener('click', () => {
    sound.play('click');
    currentBattlefieldTheme = 'volcano';
    localStorage.setItem('battlefield_theme', 'volcano');
    updateThemeButtons();
  });

  document.getElementById('btn-theme-forest')?.addEventListener('click', () => {
    sound.play('click');
    currentBattlefieldTheme = 'forest';
    localStorage.setItem('battlefield_theme', 'forest');
    updateThemeButtons();
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

    el.addEventListener('click', async () => {
      sound.play('click');
      if (isOpponent) {
        const oppCard = engine.enemy.hand.find((c) => c.id === cardId);
        if (oppCard) {
          if (engine.enemyRevealedCardIds.has(oppCard.id)) {
            inspectedCard = oppCard;
          } else {
            inspectedCard = {
              ...oppCard,
              nameCn: `未明示卡牌 (${oppCard.cost}费)`,
              desc: `【未明示敌方手牌】敌方本系手牌尚未打出或揭示。每当敌方施放或召唤该卡牌时，该卡牌将被记录并显现。`,
            };
          }
          render();
        }
        return;
      }

      const card = engine.player.hand.find((c) => c.id === cardId);
      if (!card) return;

      inspectedCard = card;

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
      }
      render();
    });
  });

  // Board slot clicks (inspect, summon, or target spell)
  document.querySelectorAll('.combat-board-slot').forEach((slotEl) => {
    const slotIdx = parseInt((slotEl as HTMLElement).dataset.slotIndex!);
    const side = (slotEl as HTMLElement).dataset.side!;

    slotEl.addEventListener('click', async () => {
      const occupied = side === 'player' ? engine.playerBoard[slotIdx] : engine.enemyBoard[slotIdx];

      // If no card selected, tapping occupied creature inspects it in parchment!
      if (!selectedCard && occupied) {
        sound.play('click');
        inspectedCard = occupied.card;
        render();
        return;
      }

      if (!selectedCard || engine.isCombatPhase || isActionPending) {
        if (occupied) {
          inspectedCard = occupied.card;
          render();
        }
        return;
      }

      if (side === 'player') {
        if (selectedCard.type === 'creature' && engine.playerBoard[slotIdx] === null) {
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
        } else if (selectedCard.type === 'spell' && selectedCard.requiresTarget && isFriendlyTargetSpell(selectedCard)) {
          if (engine.playerBoard[slotIdx]) {
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
      } else if (side === 'enemy' && selectedCard.type === 'spell' && selectedCard.requiresTarget && !isFriendlyTargetSpell(selectedCard)) {
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
  // CAMPAIGN MAP ACTIONS (Image 1)
  // ===================================
  document.querySelectorAll('.campaign-node').forEach((nodeEl) => {
    nodeEl.addEventListener('click', () => {
      const lvlId = parseInt((nodeEl as HTMLElement).dataset.levelId || '1', 10);
      sound.play('click');
      selectedCampaignLevelId = lvlId;
      render();
    });
  });

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
    sound.play('click');
    currentBattleSource = 'campaign';
    sound.playBgm(getCombatBgmForCurrentBattle());
    const currentLvl = (campaignData as CampaignLevel[]).find((l) => l.id === selectedCampaignLevelId) || (campaignData as CampaignLevel[])[0];
    const rawClassId = activeCampaign ? (HERO_CLASSES[activeCampaign.playerClassIdx]?.id || 'cleric') : 'cleric';
    const pClass: HeroClass = rawClassId === 'random' ? 'cleric' : rawClassId;
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
    });
    setupEngineCallbacks();
    currentView = 'battle';
    render();
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
    campaignPlayerFaceId = ((campaignPlayerFaceId - 2 + 78) % 78) + 1;
    render();
  });

  document.getElementById('btn-campaign-face-next')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerFaceId = (campaignPlayerFaceId % 78) + 1;
    render();
  });

  document.getElementById('btn-campaign-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerClassIdx = (campaignPlayerClassIdx - 1 + HERO_CLASSES.length) % HERO_CLASSES.length;
    render();
  });

  document.getElementById('btn-campaign-class-next')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerClassIdx = (campaignPlayerClassIdx + 1) % HERO_CLASSES.length;
    render();
  });

  document.getElementById('btn-campaign-setup-diff-prev')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerDifficultyIdx = (campaignPlayerDifficultyIdx - 1 + campaignDifficulties.length) % campaignDifficulties.length;
    render();
  });

  document.getElementById('btn-campaign-setup-diff-next')?.addEventListener('click', () => {
    sound.play('click');
    campaignPlayerDifficultyIdx = (campaignPlayerDifficultyIdx + 1) % campaignDifficulties.length;
    render();
  });

  document.getElementById('btn-campaign-create-char')?.addEventListener('click', () => {
    sound.play('click');
    const nameInput = document.getElementById('campaign-name-input') as HTMLInputElement;
    const name = nameInput ? nameInput.value : campaignPlayerName;
    createNewCampaignProfile(name, campaignPlayerFaceId, campaignPlayerClassIdx, campaignPlayerDifficultyIdx);
    showCampaignSetupModal = false;
    currentView = 'campaign';
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
    render();
  });

  // ===================================
  // LEAGUE ACTIONS (Images 2 & 3)
  // ===================================
  document.getElementById('btn-league-face-prev')?.addEventListener('click', () => {
    sound.play('click');
    leaguePlayerFaceId = ((leaguePlayerFaceId - 2 + 78) % 78) + 1;
    render();
  });
  document.getElementById('btn-league-face-next')?.addEventListener('click', () => {
    sound.play('click');
    leaguePlayerFaceId = (leaguePlayerFaceId % 78) + 1;
    render();
  });

  document.getElementById('league-name-input')?.addEventListener('input', (e) => {
    leaguePlayerName = (e.target as HTMLInputElement).value;
  });

  document.getElementById('btn-league-class-prev')?.addEventListener('click', () => {
    sound.play('click');
    leaguePlayerClassIdx = leaguePlayerClassIdx <= 1 ? HERO_CLASSES.length - 1 : leaguePlayerClassIdx - 1;
    render();
  });
  document.getElementById('btn-league-class-next')?.addEventListener('click', () => {
    sound.play('click');
    leaguePlayerClassIdx = leaguePlayerClassIdx >= HERO_CLASSES.length - 1 ? 1 : leaguePlayerClassIdx + 1;
    render();
  });

  document.getElementById('btn-league-diff-prev')?.addEventListener('click', () => {
    sound.play('click');
    leagueDifficultyIdx = (leagueDifficultyIdx - 1 + leagueDifficulties.length) % leagueDifficulties.length;
    render();
  });
  document.getElementById('btn-league-diff-next')?.addEventListener('click', () => {
    sound.play('click');
    leagueDifficultyIdx = (leagueDifficultyIdx + 1) % leagueDifficulties.length;
    render();
  });

  document.getElementById('btn-league-contestants-prev')?.addEventListener('click', () => {
    sound.play('click');
    leagueContestantCountIdx = (leagueContestantCountIdx - 1 + leagueContestantCountChoices.length) % leagueContestantCountChoices.length;
    render();
  });
  document.getElementById('btn-league-contestants-next')?.addEventListener('click', () => {
    sound.play('click');
    leagueContestantCountIdx = (leagueContestantCountIdx + 1) % leagueContestantCountChoices.length;
    render();
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

  document.getElementById('btn-league-start-match')?.addEventListener('click', () => {
    if (!activeLeague) return;
    sound.play('click');
    currentBattleSource = 'league';
    sound.playBgm(getCombatBgmForCurrentBattle());
    const curOpponent = getNextOpponentForLeague();
    const pClass = activeLeague.standings.find((s) => s.isPlayer)?.className || 'cleric';
    engine = new SpectromancerEngine(pClass, undefined, {
      playerName: activeLeague.playerName,
      playerFace: `./faces/Face${activeLeague.playerFaceId}.jpg`,
      enemyName: curOpponent.cnName,
      enemyFace: curOpponent.face,
      enemyClass: curOpponent.className,
      difficulty: activeLeague.difficulty || '普通',
      leagueRule: curOpponent.rule,
    });
    setupEngineCallbacks();
    currentView = 'battle';
    render();
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

  document.getElementById('btn-deck-start')?.addEventListener('click', () => {
    sound.play('click');
    currentBattleSource = 'custom_deck';
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
    currentView = 'battle';
    render();
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
    sound.playBgm('menu1');
    if (engine.winner === 'player') {
      if (!completedCampaignLevels.includes(selectedCampaignLevelId)) {
        completedCampaignLevels.push(selectedCampaignLevelId);
      }
      if (selectedCampaignLevelId === 1) {
        unlockedCampaignLevels = [1, 2, 3, 4];
      }
      saveCampaignProfiles();
    }
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

  // Game over buttons
  document.getElementById('btn-restart')?.addEventListener('click', () => {
    sound.play('click');
    engine.reset(engine.player.className as HeroClass, engine.currentCampaign || undefined);
    setupEngineCallbacks();
    selectedCard = null;
    inspectedCard = null;
    render();
  });

  document.getElementById('btn-return-menu')?.addEventListener('click', () => {
    sound.play('click');
    sound.playBgm('menu1');
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


