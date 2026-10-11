export type ElementType = 'fire' | 'water' | 'air' | 'earth' | 'special' | 'death' | 'holy' | 'mechanics' | 'control' | 'chaos' | 'illusion';
export type HeroClass = 'sorcery' | 'necromancer' | 'cleric' | 'mechanician' | 'dominator' | 'chaosmaster' | 'illusionist' | 'demonologist' | 'beastmaster' | 'chronomancer' | 'goblin' | 'forest' | 'golem' | 'cult' | 'blood' | 'spectromancer';

export interface CardDef {
  id: string;
  element: ElementType;
  className?: string;
  name: string;
  nameCn: string;
  type: 'creature' | 'spell';
  cost: number;
  attack?: number;
  life?: number;
  image: string;
  imgUrl: string;
  imgBigUrl: string;
  desc: string;
  isWall?: boolean;
  swift?: boolean;
  flying?: boolean;
  spellImmune?: boolean;
  regen?: number;
  ability?: string;
  onSummon?: string;
  spellEffect?: string;
  requiresTarget?: boolean;
  isActivatedAbility?: boolean;
  sourceCreatureUid?: string;
  // PC tokens such as Bee Soldier exist in Gd.spe without a cost and are never dealt into a deck.
  token?: boolean;
  // 特殊战场造物：火山、行军石、三座祭坛、魔法学院、至尊元素等。它们不是任何流派的牌，
  // 因此永远不发牌、不进自组卡组、也不作为可选职业；只能在战场场景中作为预置场景元素登场。
  battlefield?: boolean;
  // Blood discipline double payment: the printed cost is paid from the class power pool and this
  // many extra life points are paid by the owner on top of it.
  lifeCost?: number;
  targetType?: 'empty_friendly_slot' | 'enemy_creature' | 'any_creature' | 'none';
}

export interface BoardCreature {
  uid: string;
  card: CardDef;
  owner: 'player' | 'enemy';
  slotIndex: number;
  baseAttack: number;
  currentAttack: number;
  buffedAttack?: boolean;
  currentLife: number;
  maxLife: number;
  isWall: boolean;
  flying: boolean;
  spellImmune: boolean;
  regen: number;
  canAttack: boolean;
  skipNextAttack?: boolean;
  directHeroAttackTurn?: boolean;
  tempAttackBuff?: number;
  // PC Chastiser: "+2 until after its next attack" — consumed right after this creature attacks.
  pendingAttackBonus?: number;
  isDestroyed?: boolean;
  // Guardian Statue (PC: "receives no damage until it performs its first attack").
  hasAttacked?: boolean;
  animState?: 'idle' | 'attacking' | 'damaged' | 'dead';
}

export interface PlayerState {
  id: 'player' | 'enemy';
  name: string;
  className: string;
  face: string;
  hp: number;
  maxHp: number;
  specialElement: ElementType;
  mana: Record<ElementType, number>;
  growth: Record<ElementType, number>;
  hand: CardDef[];
  // Golem Master champion upkeep. The permanent part survives the Golem's death (Army Upgrade /
  // Golem Instructor), the temporary part lasts until the end of the owner's turn (Golem's Frenzy
  // / Golem Guide) — both therefore live on the player, not on the creature.
  golemAttackBonus?: number;
  golemTempAttackBonus?: number;
}

export type GamePhase = 'player_turn' | 'combat' | 'enemy_turn' | 'game_over';

export interface BattleLogEntry {
  id: string;
  text: string;
  type: 'info' | 'summon' | 'attack' | 'damage' | 'heal' | 'death';
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  type: 'damage' | 'heal' | 'crit';
  targetSide: 'player' | 'enemy';
  targetSlot?: number;
  isHero?: boolean;
}

export interface CampaignLevel {
  id: number;
  chapter?: number;
  title: string;
  oppName: string;
  face: string;
  story: string;
  rules: string;
  enemyHp: number;
  unlocked: boolean;
}

export interface NetworkUserProfile {
  name: string;
  face: string;
  className: HeroClass;
  classCn: string;
  classType?: HeroClass;
}

export type NetworkMessageType =
  | 'ROOM_JOIN'
  | 'ROOM_ACCEPT'
  | 'GAME_START'
  | 'ACTION_PLAY_CARD'
  | 'ACTION_PASS'
  | 'STATE_SYNC'
  | 'VFX_EVENT'
  | 'SURRENDER'
  | 'CHAT'
  | 'PING'
  | 'PONG';

export interface NetworkMessage {
  type: NetworkMessageType;
  payload?: any;
}

// GAME_START 负载：房主把战场场景（含特殊造物场景）一并带给 guest，
// 保证双方引擎在同一场景规则下开场。
export interface LanGameStartPayload {
  hostProfile: NetworkUserProfile;
  guestProfile: NetworkUserProfile;
  snapshot: NetworkGameStateSnapshot;
  scenarioId?: string;
}

export interface NetworkGameStateSnapshot {
  turnCount: number;
  activeTurn: 'player' | 'enemy';
  isCombatPhase: boolean;
  gameOver: boolean;
  winner: 'player' | 'enemy' | null;
  playerHp: number;
  playerMaxHp: number;
  playerMana: Record<ElementType, number>;
  playerGrowth: Record<ElementType, number>;
  enemyHp: number;
  enemyMaxHp: number;
  enemyMana: Record<ElementType, number>;
  enemyGrowth: Record<ElementType, number>;
  playerBoard: (BoardCreature | null)[];
  enemyBoard: (BoardCreature | null)[];
  // Golem Master upkeep lives on the player, so it has to travel with the board for the guest.
  playerGolemAttackBonus?: number;
  playerGolemTempAttackBonus?: number;
  enemyGolemAttackBonus?: number;
  enemyGolemTempAttackBonus?: number;
  guestHand?: CardDef[];
  hostHand?: CardDef[];
  enemyRevealedCardIds?: string[];
  lastLog?: BattleLogEntry;
}

