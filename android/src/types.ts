export type ElementType = 'fire' | 'water' | 'air' | 'earth' | 'special' | 'death' | 'holy' | 'mechanics' | 'control' | 'chaos' | 'illusion';
export type HeroClass = 'sorcery' | 'necromancer' | 'cleric' | 'mechanician' | 'dominator' | 'chaosmaster' | 'illusionist' | 'demonologist' | 'beastmaster' | 'chronomancer' | 'goblin';

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
  poison?: number;
  regen?: number;
  ability?: string;
  onSummon?: string;
  spellEffect?: string;
  requiresTarget?: boolean;
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
  poison: number;
  regen: number;
  canAttack: boolean;
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
