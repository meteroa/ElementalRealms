import type { CardDef, BoardCreature, PlayerState, ElementType, HeroClass, BattleLogEntry, CampaignLevel, NetworkGameStateSnapshot } from '../types';
import cardsData from '../data/cards.json';
import { sound } from './sound';

export interface ReplayStep {
  turn: number;
  side: 'player' | 'enemy';
  action: 'spell' | 'creature' | 'pass' | 'attack_phase' | 'init';
  cardName?: string;
  cardId?: string;
  cardImg?: string;
  targetSlot?: number;
  desc: string;
  playerHp: number;
  enemyHp: number;
  playerMana: Record<ElementType, number>;
  enemyMana: Record<ElementType, number>;
  playerBoard: (BoardCreature | null)[];
  enemyBoard: (BoardCreature | null)[];
}

export interface BeastAbilityMeta {
  name: string;
  nameCn: string;
  cost: number;
  image: string;
  imgUrl: string;
  imgBigUrl: string;
  desc: string;
  requiresTarget: boolean;
  targetType: 'empty_friendly_slot' | 'enemy_creature' | 'any_creature' | 'none';
  // Optional: the power this skill is paid from when it differs from the creature's own element
  // (PC Inactive Hellbot: "Can be activated for a cost of 4 Mechanical power").
  manaElement?: ElementType;
}

export const BEAST_ACTIVATED_ABILITIES: Record<string, BeastAbilityMeta> = {
  // PC Inactive Hellbot: "Can be activated for a cost of 4 Mechanical power."
  gop_inactive_hellbot: {
    name: 'Activate',
    nameCn: '激活',
    cost: 4,
    manaElement: 'mechanics',
    image: 'InactiveHellbot',
    imgUrl: './cards/InactiveHellbot.webp',
    imgBigUrl: './cards/InactiveHellbotBig.webp',
    desc: '支付 4 点机械系能量，使【未激活的终极机械】变身为【地狱机兵】(3/28)。',
    requiresTarget: false,
    targetType: 'none',
  },
  beast_magic_hamster: {
    name: 'Natural Healing',
    nameCn: '自然回复',
    cost: 3,
    image: 'NaturalHealing',
    imgUrl: './cards/NaturalHealing.webp',
    imgBigUrl: './cards/NaturalHealingBig.webp',
    desc: '【魔法仓鼠】的主动技能，费用 3\n【魔法仓鼠】使己方所有生物回复18点生命。',
    requiresTarget: false,
    targetType: 'none',
  },
  beast_scorpion: {
    name: 'Poison',
    nameCn: '毒液喷射',
    cost: 2,
    image: 'Poison',
    imgUrl: './cards/Poison.webp',
    imgBigUrl: './cards/PoisonBig.webp',
    desc: '【毒蝎】的主动技能，费用 2\n【毒蝎】对目标敌方生物造成14点伤害。',
    requiresTarget: true,
    targetType: 'enemy_creature',
  },
  beast_wolverine: {
    name: 'Enrage',
    nameCn: '暴怒',
    cost: 2,
    image: 'Enrage',
    imgUrl: './cards/Enrage.webp',
    imgBigUrl: './cards/EnrageBig.webp',
    desc: '【狼獾】的主动技能，费用 2\n【狼獾】完全回复至满生命，攻击力永久+2。',
    requiresTarget: false,
    targetType: 'none',
  },
  beast_energy_beast: {
    name: 'Pump Energy',
    nameCn: '充能',
    cost: 1,
    image: 'PumpEnergy',
    imgUrl: './cards/PumpEnergy.webp',
    imgBigUrl: './cards/PumpEnergyBig.webp',
    desc: '【魔能兽】的主动技能，费用 1\n使拥有者的火系、水系、气系和土系能量各+1。',
    requiresTarget: false,
    targetType: 'none',
  },
  beast_death_falcon: {
    name: 'Move Falcon',
    nameCn: '隼之突袭',
    cost: 1,
    image: 'MoveFalcon',
    imgUrl: './cards/MoveFalcon.webp',
    imgBigUrl: './cards/MoveFalconBig.webp',
    desc: '【死亡之隼】的主动技能，费用 1\n【死亡之隼】移动到目标空格处，并且对对方所有生物造成4点伤害。',
    requiresTarget: true,
    targetType: 'empty_friendly_slot',
  },
  beast_white_elephant: {
    name: 'Trumpet',
    nameCn: '战吼',
    cost: 0,
    image: 'Trumpet',
    imgUrl: './cards/Trumpet.webp',
    imgBigUrl: './cards/TrumpetBig.webp',
    desc: '【白象】的主动技能，费用 0\n使拥有者的野兽系能量+1。',
    requiresTarget: false,
    targetType: 'none',
  },
  beast_basilisk: {
    name: 'Gaze',
    nameCn: '凝视',
    cost: 0,
    image: 'Gaze',
    imgUrl: './cards/Gaze.webp',
    imgBigUrl: './cards/GazeBig.webp',
    desc: '【巨蜥】的主动技能，费用 0\n对目标生物造成6点伤害。',
    requiresTarget: true,
    targetType: 'any_creature',
  },
  beast_ancient_dragon: {
    name: 'Breathe Fire',
    nameCn: '火焰吐息',
    cost: 3,
    image: 'BreatheFire',
    imgUrl: './cards/BreatheFire.webp',
    imgBigUrl: './cards/BreatheFireBig.webp',
    desc: '【远古巨龙】的主动技能，费用 3\n【远古巨龙】对对方本体和对方所有生物各造成10点伤害。',
    requiresTarget: false,
    targetType: 'none',
  },
};

export const RAGE_OF_SOULS_CARD: CardDef = {
  id: 'death_rage_of_souls',
  element: 'death',
  className: 'necromancer',
  name: 'Rage of Souls',
  nameCn: '灵魂狂怒',
  type: 'spell',
  cost: 7,
  image: 'RageofSouls',
  imgUrl: './cards/RageofSouls.webp',
  imgBigUrl: './cards/RageofSoulsBig.webp',
  desc: '【灵魂狂怒】对对方所有生物造成（9+施法者死亡系能量）点伤害，施法者每杀死一个生物回复2点生命。',
  spellEffect: 'rage_of_souls',
  requiresTarget: false,
  targetType: 'none',
};

export class SpectromancerEngine {
  public player: PlayerState;
  public enemy: PlayerState;
  public playerBoard: (BoardCreature | null)[] = [null, null, null, null, null, null];
  public enemyBoard: (BoardCreature | null)[] = [null, null, null, null, null, null];
  public activeTurn: 'player' | 'enemy' = 'player';
  public isCombatPhase: boolean = false;
  public turnCount: number = 1;
  public gameOver: boolean = false;
  public winner: 'player' | 'enemy' | null = null;
  public logs: BattleLogEntry[] = [];
  public currentCampaign: CampaignLevel | null = null;
  public replaySteps: ReplayStep[] = [];

  // LAN Multiplayer properties & callbacks
  public isLanGame: boolean = false;
  public isHost: boolean = false;
  public isGuest: boolean = false;
  public onStateBroadcast?: (snapshot: NetworkGameStateSnapshot) => void;
  public onVfxBroadcast?: (event: { type: string; payload: any }) => void;

  // Animation & Visual Feedback Callbacks
  public onStateChange?: () => void;
  public onDamageEffect?: (side: 'player' | 'enemy', slot: number | 'hero', amount: number) => void;
  public onHealEffect?: (side: 'player' | 'enemy', slot: number | 'hero', amount: number) => void;
  public onAttackLunge?: (side: 'player' | 'enemy', slot: number) => void;
  public onCardImpact?: (side: 'player' | 'enemy', slot: number | 'hero') => void;
  public onSpellVfx?: (vfxType: string) => void;
  public onCardEnterSlot?: (info: { who: 'player' | 'enemy'; card: CardDef; targetSlot?: number }) => Promise<void>;
  // Fired when the engine itself places a creature on the board (Mad Hermit's passive Magic
  // Rabbit) so the client can replay the arrival animation for a slot nobody clicked.
  public onCreatureAppear?: (side: 'player' | 'enemy', slotIndex: number, card: CardDef) => void;
  public onCardAnnouncement?: (who: 'player' | 'enemy', card: CardDef) => Promise<void>;
  public enemyRevealedCardIds: Set<string> = new Set();
  public playerRevealedCardIds: Set<string> = new Set();
  public lastSummonedUid: string | null = null;

  // Set while resolveSpell() runs so triggerDamage() can tell spell damage from every other
  // source (creature abilities and on-summon effects are not spells).
  private activeSpellCaster: 'player' | 'enemy' | null = null;
  private spellAbsorbedThisCast: number = 0;

  // Turn skip / extra actions
  public skipNextTurn: { player: boolean; enemy: boolean } = { player: false, enemy: false };
  public extraActionRemaining: { player: number; enemy: number } = { player: 0, enemy: 0 };
  public extraSpellOnly: { player: boolean; enemy: boolean } = { player: false, enemy: false };
  public leagueRule?: string;
  public campaignLevel?: CampaignLevel;
  public difficulty: string = '普通';
  private aiRecentCardIds: string[] = [];

  constructor(
    playerClass: HeroClass = 'sorcery',
    campaign?: CampaignLevel,
    customConfig?: {
      playerName?: string;
      playerFace?: string;
      enemyName?: string;
      enemyFace?: string;
      enemyClass?: HeroClass;
      playerHp?: number;
      enemyHp?: number;
      difficulty?: string;
      customDeck?: CardDef[];
      leagueRule?: string;
      initialPlayerCreatures?: Array<{ slot: number; card: CardDef }>;
      initialEnemyCreatures?: Array<{ slot: number; card: CardDef }>;
      extraPlayerMana?: Partial<Record<ElementType, number>>;
      extraEnemyMana?: Partial<Record<ElementType, number>>;
      isLanGame?: boolean;
      isHost?: boolean;
      isGuest?: boolean;
    }
  ) {
    this.currentCampaign = campaign || null;
    this.isLanGame = !!customConfig?.isLanGame;
    this.isHost = !!customConfig?.isHost;
    this.isGuest = !!customConfig?.isGuest;

    const enemyClassPool: HeroClass[] = [
      'sorcery', 'necromancer', 'cleric', 'mechanician', 'dominator',
      'chaosmaster', 'illusionist', 'demonologist', 'beastmaster', 'chronomancer', 'goblin', 'forest', 'golem', 'cult', 'blood'
    ];
    const enemyClass: HeroClass = customConfig?.enemyClass || (campaign ? enemyClassPool[campaign.id % enemyClassPool.length] : 'necromancer');
    const enemyHp = customConfig?.enemyHp || (campaign ? campaign.enemyHp : 60);
    const enemyFace = customConfig?.enemyFace || (campaign ? campaign.face : './faces/Face6.jpg');
    const enemyName = customConfig?.enemyName || (campaign ? campaign.oppName : '大法师');

    const playerName = customConfig?.playerName || '玩家';
    const playerFace = customConfig?.playerFace || './faces/Face1.jpg';
    const playerHp = customConfig?.playerHp || 60;
    this.difficulty = customConfig?.difficulty || '普通';

    this.player = this.createPlayer('player', playerName, playerFace, playerClass, playerHp);
    this.enemy = this.createPlayer('enemy', enemyName, enemyFace, enemyClass, enemyHp);

    if (customConfig?.customDeck && customConfig.customDeck.length === 20) {
      this.player.hand = [...customConfig.customDeck];
    }

    this.campaignLevel = campaign;
    this.leagueRule = customConfig?.leagueRule;

    if (customConfig?.leagueRule) {
      this.log(`【战场规则生效】${customConfig.leagueRule.replace(/\r?\n/g, ' ')}`, 'heal');
    }

    if (customConfig?.extraPlayerMana) {
      Object.entries(customConfig.extraPlayerMana).forEach(([elem, amount]) => {
        const e = elem === 'special' ? this.player.specialElement : (elem as ElementType);
        if (this.player.mana[e] !== undefined) {
          this.player.mana[e] += amount;
        }
      });
    }
    if (customConfig?.extraEnemyMana) {
      Object.entries(customConfig.extraEnemyMana).forEach(([elem, amount]) => {
        const e = elem === 'special' ? this.enemy.specialElement : (elem as ElementType);
        if (this.enemy.mana[e] !== undefined) {
          this.enemy.mana[e] += amount;
        }
      });
    }

    if (customConfig?.initialPlayerCreatures) {
      customConfig.initialPlayerCreatures.forEach((item) => {
        this.placeInitialCreature('player', item.slot, item.card);
      });
    }
    if (customConfig?.initialEnemyCreatures) {
      customConfig.initialEnemyCreatures.forEach((item) => {
        this.placeInitialCreature('enemy', item.slot, item.card);
      });
    }

    // Golem Master class ability (both sides), after any scenario pre-placed creatures.
    this.placeClassChampion('player');
    this.placeClassChampion('enemy');

    this.startTurn('player');

    this.replaySteps = [{
      turn: 1,
      side: 'player',
      action: 'init',
      desc: '战斗开始，双方就位',
      playerHp: this.player.hp,
      enemyHp: this.enemy.hp,
      playerMana: { ...this.player.mana },
      enemyMana: { ...this.enemy.mana },
      playerBoard: this.cloneBoard(this.playerBoard),
      enemyBoard: this.cloneBoard(this.enemyBoard),
    }];
  }

  public placeInitialCreature(
    side: 'player' | 'enemy',
    slotIndex: number,
    card: CardDef
  ): BoardCreature | null {
    if (slotIndex < 0 || slotIndex >= 6) return null;
    const board = side === 'player' ? this.playerBoard : this.enemyBoard;
    const actor = side === 'player' ? this.player : this.enemy;
    const initialAtk = (card.attack === -1 && card.ability === 'attack_equal_element_power')
      ? (actor.mana[card.element as ElementType] || 0)
      : (card.attack || 0);

    const creature: BoardCreature = {
      uid: Math.random().toString(36).substring(2, 9),
      card,
      owner: side,
      slotIndex,
      baseAttack: initialAtk,
      currentAttack: initialAtk,
      buffedAttack: false,
      currentLife: card.life || 1,
      maxLife: card.life || 1,
      isWall: !!card.isWall,
      flying: !!card.flying,
      spellImmune: !!card.spellImmune,
      regen: card.regen || 0,
      canAttack: false,
    };
    board[slotIndex] = creature;
    this.recalculateBoardStats();
    this.log(`【战场随从入场】${side === 'player' ? this.player.name : this.enemy.name} 的【${card.nameCn}】进驻 [${slotIndex + 1}号位]！`, 'summon');
    return creature;
  }

  public cloneBoard(board: (BoardCreature | null)[]): (BoardCreature | null)[] {
    return board.map((c) => (c ? { ...c, card: { ...c.card } } : null));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private createPlayer(
    id: 'player' | 'enemy',
    name: string,
    face: string,
    classType: HeroClass,
    maxHp: number
  ): PlayerState {
    // 职业 → 专属能量元素映射。虹光造物（spectromancer）不是可选职业，
    // 因此不在此列；其卡牌只作为战场场景元素预置登场。
    const elemMap: Partial<Record<HeroClass, ElementType>> = {
      sorcery: 'special',
      necromancer: 'death',
      cleric: 'holy',
      mechanician: 'mechanics',
      dominator: 'control',
      chaosmaster: 'chaos',
      illusionist: 'illusion',
      demonologist: 'special',
      beastmaster: 'special',
      chronomancer: 'special',
      goblin: 'special',
      forest: 'special',
      golem: 'special',
      cult: 'special',
      blood: 'special',
    };

    const specialElem: ElementType = elemMap[classType] || 'special';

    const allCards = cardsData as CardDef[];

    // Spectromancer authentic dynamic random dealing: 4 random cards per element
    const getRandomCards = (pool: CardDef[], count: number = 4) => {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count).sort((a, b) => a.cost - b.cost);
    };

    // Tokens (Bee Soldier…) exist in Gd.spe but are never dealt into a deck.
    // 特殊战场造物（火山、祭坛、行军石、至尊元素…）同理：它们只作为战场场景元素预置登场，
    // 任何流派的发牌池与牌库都不得包含它们。
    const specialCardsPool = allCards.filter(
      (c) => !c.token && !c.battlefield && (c.className === classType || (c.element === specialElem && !c.className))
    );

    const hand = [
      ...getRandomCards(allCards.filter((c) => c.element === 'fire' && !c.token && !c.battlefield)),
      ...getRandomCards(allCards.filter((c) => c.element === 'water' && !c.token && !c.battlefield)),
      ...getRandomCards(allCards.filter((c) => c.element === 'air' && !c.token && !c.battlefield)),
      ...getRandomCards(allCards.filter((c) => c.element === 'earth' && !c.token && !c.battlefield)),
      ...getRandomCards(specialCardsPool.length >= 4 ? specialCardsPool : allCards.filter((c) => c.element === 'special' && !c.token && !c.battlefield)),
    ];

    return {
      id,
      name,
      className: classType,
      face,
      hp: maxHp,
      maxHp,
      specialElement: specialElem,
      mana: {
        fire: 4,
        water: 4,
        air: 4,
        earth: 4,
        special: 4,
        death: 4,
        holy: 4,
        mechanics: 4,
        control: 4,
        chaos: 4,
        illusion: 4,
      },
      growth: {
        fire: 1,
        water: 1,
        air: 1,
        earth: 1,
        special: 1,
        death: 1,
        holy: 1,
        mechanics: 1,
        control: 1,
        chaos: 1,
        illusion: 1,
      },
      hand,
      golemAttackBonus: 0,
      golemTempAttackBonus: 0,
    };
  }

  // PC Golem Master class ability: "starts the duel with Golem in a random slot."
  private placeClassChampion(side: 'player' | 'enemy'): void {
    const actor = side === 'player' ? this.player : this.enemy;
    if (actor.className !== 'golem') return;
    const board = side === 'player' ? this.playerBoard : this.enemyBoard;
    const emptySlots: number[] = [];
    board.forEach((c, idx) => {
      if (c === null) emptySlots.push(idx);
    });
    if (emptySlots.length === 0) return;
    const slotIndex = emptySlots[Math.floor(Math.random() * emptySlots.length)];
    const golem = this.spawnToken(side, 'golem_golem', slotIndex);
    if (!golem) return;
    this.lastSummonedUid = golem.uid;
    this.log(`被动技能：【魔匠师】的对战开局魔像已在 [${slotIndex + 1}号位] 就位！`, 'summon');
  }

  public log(text: string, type: BattleLogEntry['type'] = 'info') {
    this.logs.unshift({
      id: Math.random().toString(36).substring(2, 9),
      text,
      type,
    });
    if (this.logs.length > 50) this.logs.pop();
  }

  public startTurn(who: 'player' | 'enemy') {
    if (this.gameOver) return;

    this.activeTurn = who;
    this.isCombatPhase = false;
    this.extraSpellOnly[who] = false;
    const actor = who === 'player' ? this.player : this.enemy;
    const opponent = who === 'player' ? this.enemy : this.player;
    const board = who === 'player' ? this.playerBoard : this.enemyBoard;
    const oppBoard = who === 'player' ? this.enemyBoard : this.playerBoard;

    this.log(`--- 第 ${this.turnCount} 回合：${actor.name} 行动 ---`, 'info');

    // 1. Calculate active mana growth & creature growth auras
    let extraFireGrowth = 0;
    let extraWaterGrowth = 0;
    let extraAirGrowth = 0;
    let extraEarthGrowth = 0;
    let extraSpecialGrowth = 0;
    let extraMechGrowth = 0;
    let extraIllusGrowth = 0;

    board.forEach((c) => {
      if (!c) return;
      if (c.card.ability === 'fire_growth_1') extraFireGrowth += 1;
      if (c.card.ability === 'water_growth_1') extraWaterGrowth += 1;
      if (c.card.ability === 'air_growth_1') extraAirGrowth += 1;
      if (c.card.ability === 'earth_growth_2') extraEarthGrowth += 2;
      if (c.card.ability === 'sorcery_growth_2') extraSpecialGrowth += 2;
      if (c.card.ability === 'mechanics_growth_1') extraMechGrowth += 1;
      if (c.card.ability === 'illusion_growth_1') extraIllusGrowth += 1;
      if (c.card.ability === 'demon_quartermaster_growth') extraSpecialGrowth += 1;
      // PC Blind Prophet: +1 growth to Fire/Water/Air/Earth, -1 to the Worship (class) power.
      if (c.card.ability === 'blind_prophet_growth') {
        extraFireGrowth += 1;
        extraWaterGrowth += 1;
        extraAirGrowth += 1;
        extraEarthGrowth += 1;
        extraSpecialGrowth -= 1;
      }
      // PC Merfolk Revolutionary: +1 owner Water growth (its -1 to the opponent is handled below).
      if (c.card.ability === 'merfolk_revolution') extraWaterGrowth += 1;
      // PC Dark Troll / Megacolossus: -1 growth to Earth / Air for their owner.
      if (c.card.ability === 'dark_troll_earth_drain') extraEarthGrowth -= 1;
      if (c.card.ability === 'attack_equal_power_sum') extraAirGrowth -= 1;
      if (c.card.ability === 'attack_equal_element_power') {
        if (c.card.element === 'fire') extraFireGrowth += 1;
        if (c.card.element === 'water') extraWaterGrowth += 1;
        if (c.card.element === 'air') extraAirGrowth += 1;
        if (c.card.element === 'earth') extraEarthGrowth += 1;
      }
      if (c.card.ability === 'mind_master_all_growth_1') {
        extraFireGrowth += 1;
        extraWaterGrowth += 1;
        extraAirGrowth += 1;
        extraEarthGrowth += 1;
        extraSpecialGrowth += 1;
      }
    });

    let oppAstralGuardCount = 0;
    let oppWaterDrain = 0;
    oppBoard.forEach((c) => {
      if (c && c.card.ability === 'astral_guard_drain_growth_1') {
        oppAstralGuardCount++;
      }
      // PC Merfolk Revolutionary also "reduces the growth of opponent's Water power by 1".
      if (c && c.card.ability === 'merfolk_revolution') oppWaterDrain++;
    });

    const activeElements: ElementType[] = ['fire', 'water', 'air', 'earth', actor.specialElement];
    activeElements.forEach((elem) => {
      let g = actor.growth[elem];
      if (elem === 'fire') g += extraFireGrowth;
      if (elem === 'water') g += extraWaterGrowth;
      if (elem === 'air') g += extraAirGrowth;
      if (elem === 'earth') g += extraEarthGrowth;
      if (elem === 'special') g += extraSpecialGrowth;
      if (elem === 'mechanics') g += extraMechGrowth;
      if (elem === 'illusion') g += extraIllusGrowth;
      if (oppAstralGuardCount > 0) {
        g = Math.max(0, g - oppAstralGuardCount);
      }
      if (elem === 'water' && oppWaterDrain > 0) {
        g = Math.max(0, g - oppWaterDrain);
      }
      actor.mana[elem] += g;
    });
    if (oppAstralGuardCount > 0) {
      this.log(`受到敌方【星魂守卫】星界压制，${actor.name} 本回合各系能量成长率 -${oppAstralGuardCount}！`, 'damage');
    }

    // 2. Creature turn-start triggers
    board.forEach((creature, idx) => {
      if (!creature) return;

      // PC Library of the Mad Magi: each turn the owner's specialty-power cards are replaced with
      // a random discipline's cards.
      if (creature.card.ability === 'library_of_magi') {
        const pool = (cardsData as CardDef[]).filter(
          (c) => !!c.className && c.className !== actor.className && !c.token && !c.battlefield && !c.isActivatedAbility
        );
        let replaced = 0;
        actor.hand = actor.hand.map((hc) => {
          const isSpecialty = hc.className === actor.className || (hc.element === actor.specialElement && !hc.className);
          if (!isSpecialty || hc.isActivatedAbility || pool.length === 0) return hc;
          replaced++;
          return { ...pool[Math.floor(Math.random() * pool.length)] };
        });
        if (replaced > 0) {
          sound.play('positiveeffect');
          this.log(`【${creature.card.nameCn}】重写魔典，替换了 ${replaced} 张专属系卡牌！`, 'heal');
        }
      }

      // Regen
      if (creature.regen > 0 && creature.currentLife < creature.maxLife) {
        const heal = Math.min(creature.regen, creature.maxLife - creature.currentLife);
        creature.currentLife += heal;
        this.triggerHeal(who, idx, heal);
        sound.play('heal');
        this.log(`【${creature.card.nameCn}】再生恢复了 ${heal} 点生命。`, 'heal');
      }

      // Magic Rabbit (PC): "At the beginning of its owner's turn Magic Rabbit's attack
      // increases by 1 permanently."
      if (creature.card.ability === 'rabbit_growth_1') {
        creature.baseAttack += 1;
        creature.currentAttack += 1;
        sound.play('positiveeffect');
        this.log(`【${creature.card.nameCn}】汲取森林生机，攻击力永久 +1（当前 ${creature.currentAttack}）！`, 'heal');
      }

      // PC Zealot: "At the beginning of its owner's turn, Zealot's attack increases by 2
      // permanently."
      if (creature.card.ability === 'zealot_fury_recoil') {
        creature.baseAttack += 2;
        creature.currentAttack += 2;
        sound.play('positiveeffect');
        this.log(`【${creature.card.nameCn}】狂热高涨，攻击力永久 +2（当前 ${creature.currentAttack}）！`, 'heal');
      }

      // PC Devoted Servant: "At the beginning of its owner's turn, Devoted Servant's attack
      // increases by 1 permanently."
      if (creature.card.ability === 'servant_blood_growth') {
        creature.baseAttack += 1;
        creature.currentAttack += 1;
        sound.play('positiveeffect');
        this.log(`【${creature.card.nameCn}】侍奉不辍，攻击力永久 +1（当前 ${creature.currentAttack}）！`, 'heal');
      }

      // PC Cursed Unicorn: while it is blocked it loses 5 life each turn.
      if (creature.card.ability === 'cursed_unicorn_curse' && oppBoard[idx]) {
        creature.currentLife -= 5;
        this.triggerDamage(who, idx, 5, { selfInflicted: true });
        sound.play('negativeeffect');
        this.log(`【${creature.card.nameCn}】被【${oppBoard[idx]!.card.nameCn}】压制，损失 5 点生命！`, 'damage');
      }

      // PC Greater Bargul: "At the beginning of its owner's turn Greater Bargul deals 3 damage
      // to its owner."
      if (creature.card.ability === 'bargul_backfire_3') {
        actor.hp -= 3;
        this.triggerDamage(who, 'hero', 3, { selfInflicted: true });
        sound.play('negativeeffect');
        this.log(`【${creature.card.nameCn}】暴虐难驯，反噬 ${actor.name} 造成 3 点伤害！`, 'damage');
      }

      // ---------- Gathering of Power neutrals ----------
      // PC Mad Cat of Alrio: 4 damage to its owner's other creatures each turn.
      if (creature.card.ability === 'mad_cat_rampage') {
        board.forEach((ally, aIdx) => {
          if (ally && aIdx !== idx && !ally.spellImmune) {
            ally.currentLife -= 4;
            this.triggerDamage(who, aIdx, 4);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${creature.card.nameCn}】发狂抓挠，对己方其它生物各造成 4 点伤害！`, 'damage');
      }

      // PC Volcano: 5 damage to neighbouring creatures each turn.
      if (creature.card.ability === 'volcano_burn') {
        [idx - 1, idx + 1].forEach((nIdx) => {
          if (nIdx >= 0 && nIdx < board.length && board[nIdx] && !board[nIdx]!.spellImmune) {
            board[nIdx]!.currentLife -= 5;
            this.triggerDamage(who, nIdx, 5);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${creature.card.nameCn}】岩浆喷涌，对邻格生物各造成 5 点伤害！`, 'damage');
      }

      // PC Fetid Swamp: 2 damage to every creature each turn.
      if (creature.card.ability === 'fetid_swamp_rot') {
        const oppSideKey: 'player' | 'enemy' = who === 'player' ? 'enemy' : 'player';
        board.forEach((ally, aIdx) => {
          if (ally && !ally.spellImmune) {
            ally.currentLife -= 2;
            this.triggerDamage(who, aIdx, 2);
          }
        });
        oppBoard.forEach((opp, oIdx) => {
          if (opp && !opp.spellImmune) {
            opp.currentLife -= 2;
            this.triggerDamage(oppSideKey, oIdx, 2);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${creature.card.nameCn}】瘴气弥漫，对所有生物各造成 2 点伤害！`, 'damage');
      }

      // PC Beehive: stuns the opponent's creature with the highest life each turn.
      if (creature.card.ability === 'beehive_stun') {
        let targetIdx = -1;
        let best = -1;
        oppBoard.forEach((opp, oIdx) => {
          if (opp && !opp.spellImmune && opp.currentLife > best) {
            best = opp.currentLife;
            targetIdx = oIdx;
          }
        });
        if (targetIdx !== -1) {
          oppBoard[targetIdx]!.skipNextAttack = true;
          oppBoard[targetIdx]!.canAttack = false;
          sound.play('poison');
          this.log(`【${creature.card.nameCn}】蜂群突袭，使敌方生命最高的【${oppBoard[targetIdx]!.card.nameCn}】跳过下轮攻击！`, 'damage');
        }
      }

      // PC Great Oak / Temple of Fire: summon a token into a random empty slot each turn.
      if (creature.card.ability === 'great_oak_summon' || creature.card.ability === 'temple_of_fire_summon') {
        const tokenId = creature.card.ability === 'great_oak_summon' ? 'earth_forest_sprite' : 'fire_priest_of_fire';
        const emptySlots: number[] = [];
        board.forEach((slot, sIdx) => {
          if (slot === null) emptySlots.push(sIdx);
        });
        if (emptySlots.length > 0) {
          const spawnIdx = emptySlots[Math.floor(Math.random() * emptySlots.length)];
          if (this.spawnToken(who, tokenId, spawnIdx)) {
            sound.play('positiveeffect');
            this.log(`【${creature.card.nameCn}】召唤援军，在 [${spawnIdx + 1}号位] 放置了一只援军生物！`, 'summon');
          }
        }
      }

      // PC Cloistered Elemental: released once any of its owner's powers reaches 12.
      if (creature.card.ability === 'cloistered_release') {
        const powers: ElementType[] = ['fire', 'water', 'air', 'earth', actor.specialElement];
        if (powers.some((e) => (actor.mana[e] || 0) >= 12)) {
          board[idx] = null;
          const released = this.spawnToken(who, 'gop_supreme_elemental', idx);
          if (released) {
            released.canAttack = false;
            sound.play('positiveeffect');
            this.log(`【${creature.card.nameCn}】封印崩解，转化为【至尊元素】！`, 'summon');
          } else {
            board[idx] = creature;
          }
        }
      }

      // PC Sleeping Giant: wakes up (becomes a 14/55 Raging Giant) at 30 life or less.
      if (creature.card.ability === 'sleeping_giant_wake' && creature.currentLife <= 30 && creature.currentLife > 0) {
        board[idx] = null;
        const awoken = this.spawnToken(who, 'gop_raging_giant', idx);
        if (awoken) {
          sound.play('negativeeffect');
          this.log(`【${creature.card.nameCn}】轰然苏醒，转化为【狂暴巨人】(14/55)！`, 'summon');
        } else {
          board[idx] = creature;
        }
      }

      // Elven Healer: heals 3 to hero
      if (creature.card.ability === 'heal_hero_3') {
        const heal = Math.min(3, actor.maxHp - actor.hp);
        actor.hp += heal;
        this.triggerHeal(who, 'hero', heal);
        sound.play('heal');
        this.log(`【精灵医者】圣愈之光为 ${actor.name} 恢复 3 点生命。`, 'heal');
      }

      // Master Healer: heals 3 to hero and all allies
      if (creature.card.ability === 'heal_all_allies_3') {
        actor.hp = Math.min(actor.maxHp, actor.hp + 3);
        this.triggerHeal(who, 'hero', 3);
        board.forEach((ally, aIdx) => {
          if (ally) {
            ally.currentLife = Math.min(ally.maxLife, ally.currentLife + 3);
            this.triggerHeal(who, aIdx, 3);
          }
        });
        sound.play('heal');
        this.log(`【医疗大师】神圣普照，为己方全员恢复 3 点生命！`, 'heal');
      }

      // Demon Apostate: heals 2 life to its owner and to each of its owner's creatures
      if (creature.card.ability === 'demon_apostate_heal_2') {
        actor.hp = Math.min(actor.maxHp, actor.hp + 2);
        this.triggerHeal(who, 'hero', 2);
        board.forEach((ally, aIdx) => {
          if (ally) {
            ally.currentLife = Math.min(ally.maxLife, ally.currentLife + 2);
            this.triggerHeal(who, aIdx, 2);
          }
        });
        sound.play('healingmini');
        this.log(`【恶魔变节者】暗影祷言，为拥有者本体及己方所有生物恢复 2 点生命！`, 'heal');
      }

      // Goblin Berserker: deals 2 damage to neighbors
      if (creature.card.ability === 'berserk') {
        [idx - 1, idx + 1].forEach((nIdx) => {
          if (nIdx >= 0 && nIdx < 6) {
            const target = board[nIdx];
            if (target && !target.spellImmune) {
              target.currentLife -= 2;
              this.triggerDamage(who, nIdx, 2);
              this.log(`【${creature.card.nameCn}】狂暴波及邻格【${target.card.nameCn}】，造成 2 点伤害！`, 'damage');
            }
          }
        });
      }

      // Sea Sprite: 2 damage to owner
      if (creature.card.ability === 'backfire_2') {
        actor.hp -= 2;
        this.triggerDamage(who, 'hero', 2);
        this.log(`【海妖】反噬其主，对 ${actor.name} 造成 2 点伤害！`, 'damage');
      }

      // Wall of Lightning: 4 damage to enemy hero
      if (creature.card.ability === 'wall_lightning_burn') {
        opponent.hp -= 4;
        this.triggerDamage(who === 'player' ? 'enemy' : 'player', 'hero', 4);
        sound.play('negativeeffect');
        this.log(`【闪电之墙】雷光迸射，对 ${opponent.name} 造成 4 点雷击伤害！`, 'damage');
      }

      // Ornithopter: 2 damage to all enemy creatures
      if (creature.card.ability === 'bomb_2') {
        oppBoard.forEach((opp, oIdx) => {
          if (opp && !opp.spellImmune) {
            opp.currentLife -= 2;
            this.triggerDamage(who === 'player' ? 'enemy' : 'player', oIdx, 2);
          }
        });
        sound.play('boom');
        this.log(`【扑翼飞机】投弹扫射，对敌方全场生物造成 2 点轰炸伤害！`, 'damage');
      }

      // Cannon: 8 damage to enemy with highest HP
      if (creature.card.ability === 'cannon_highest_hp_8') {
        let maxHpVal = -1;
        let targetIdx = -1;
        oppBoard.forEach((opp, oIdx) => {
          if (opp && !opp.spellImmune && opp.currentLife > maxHpVal) {
            maxHpVal = opp.currentLife;
            targetIdx = oIdx;
          }
        });
        if (targetIdx !== -1 && oppBoard[targetIdx]) {
          oppBoard[targetIdx]!.currentLife -= 8;
          this.triggerDamage(who === 'player' ? 'enemy' : 'player', targetIdx, 8);
          sound.play('negativeeffect');
          this.log(`【加农重炮】重击锁定【${oppBoard[targetIdx]!.card.nameCn}】，轰击造成 8 点穿甲重创！`, 'damage');
        }
      }

      // Chaos Peacekeeper: heals 1-6 to hero
      if (creature.card.ability === 'chaos_heal_1_6') {
        const roll = Math.floor(Math.random() * 6) + 1;
        actor.hp = Math.min(actor.maxHp, actor.hp + roll);
        this.triggerHeal(who, 'hero', roll);
        sound.play('heal');
        this.log(`【混沌维和者】混沌赐福，为 ${actor.name} 恢复 ${roll} 点生命。`, 'heal');
      }

      // Chaos Berserker: deals 1-6 to enemy hero
      if (creature.card.ability === 'chaos_damage_1_6') {
        const roll = Math.floor(Math.random() * 6) + 1;
        opponent.hp -= roll;
        this.triggerDamage(who === 'player' ? 'enemy' : 'player', 'hero', roll);
        sound.play('boom');
        this.log(`【${creature.card.nameCn}】疯狂突袭，对 ${opponent.name} 造成 ${roll} 点混乱伤害！`, 'damage');
      }

      // Chaos Shaman: decreases random enemy power by 2
      if (creature.card.ability === 'chaos_drain_power_2') {
        const elems: ElementType[] = ['fire', 'water', 'air', 'earth', opponent.specialElement];
        const chosen = elems[Math.floor(Math.random() * elems.length)];
        opponent.mana[chosen] = Math.max(0, opponent.mana[chosen] - 2);
        this.log(`【混沌萨满】剥夺魔能，使敌方 ${chosen.toUpperCase()} 能量 -2！`, 'damage');
      }

      // Chaos Catapult: 10 damage to random enemy creature
      if (creature.card.ability === 'chaos_stone_10') {
        const livingTargets: number[] = [];
        oppBoard.forEach((opp, oIdx) => {
          if (opp && !opp.spellImmune) livingTargets.push(oIdx);
        });
        if (livingTargets.length > 0) {
          const tIdx = livingTargets[Math.floor(Math.random() * livingTargets.length)];
          oppBoard[tIdx]!.currentLife -= 10;
          this.triggerDamage(who === 'player' ? 'enemy' : 'player', tIdx, 10);
          sound.play('negativeeffect');
          this.log(`【混沌石砲】巨石轰击敌方【${oppBoard[tIdx]!.card.nameCn}】，造成 10 点重创！`, 'damage');
        }
      }

      // Oracle: deals illusion power to enemy hero
      if (creature.card.ability === 'oracle_illusion_burn') {
        const dmg = Math.max(0, actor.mana.illusion);
        opponent.hp -= dmg;
        this.triggerDamage(who === 'player' ? 'enemy' : 'player', 'hero', dmg);
        sound.play('negativeeffect');
        this.log(`【${creature.card.nameCn}】神谕制裁，对 ${opponent.name} 造成 ${dmg} 点幻象精神伤害！`, 'damage');
      }

      // Ratmaster: 6 damage to all enemies, -3 random owner power
      if (creature.card.ability === 'ratmaster_pulse_6') {
        oppBoard.forEach((opp, oIdx) => {
          if (opp && !opp.spellImmune) {
            opp.currentLife -= 6;
            this.triggerDamage(who === 'player' ? 'enemy' : 'player', oIdx, 6);
          }
        });
        const elems: ElementType[] = ['fire', 'water', 'air', 'earth', actor.specialElement];
        const chosen = elems[Math.floor(Math.random() * elems.length)];
        actor.mana[chosen] = Math.max(0, actor.mana[chosen] - 3);
        sound.play('negativeeffect');
        this.log(`【${creature.card.nameCn}】鼠群撕咬全场敌军造成 6 点伤害，牺牲了 3 点 ${chosen.toUpperCase()} 能量！`, 'damage');
      }

      // Chrono Engine: grants extra card play action
      if (creature.card.ability === 'chrono_engine') {
        this.extraActionRemaining[who] = (this.extraActionRemaining[who] || 0) + 1;
        sound.play('positiveeffect');
        this.log(`【${creature.card.nameCn}】时空引擎运转，赋予拥有者本回合额外一个出牌阶段！`, 'heal');
      }

      // Insanian Lord: at the beginning of its owner's turn increases a random owner's power by 2
      if (creature.card.ability === 'chaos_gain_power_2') {
        const elems: ElementType[] = ['fire', 'water', 'air', 'earth', actor.specialElement];
        const chosen = elems[Math.floor(Math.random() * elems.length)];
        actor.mana[chosen] = (actor.mana[chosen] || 0) + 2;
        sound.play('positiveeffect');
        this.log(`【混沌领主】混沌恩泽，使拥有者随机一系（${chosen.toUpperCase()}）能量 +2！`, 'heal');
      }

      // Enable creature attack
      if (creature.skipNextAttack) {
        creature.skipNextAttack = false;
        creature.canAttack = false;
        this.log(`【${creature.card.nameCn}】处于跳过攻击状态，本回合跳过攻击阶段！`, 'info');
      } else if (!creature.isWall) {
        creature.canAttack = true;
      }
    });

    this.cleanupDead();
    this.checkWinner();
    this.notify();

    if (!this.gameOver && this.skipNextTurn[who]) {
      this.skipNextTurn[who] = false;
      this.log(`【时空压制】${actor.name} 失去本轮出牌阶段，直接进入战斗！`, 'damage');
      this.passTurn(who);
    }
  }

  public getEffectiveCard(who: 'player' | 'enemy', baseCard: CardDef): CardDef {
    const ability = BEAST_ACTIVATED_ABILITIES[baseCard.id];
    if (!ability) return baseCard;

    const myBoard = who === 'player' ? this.playerBoard : this.enemyBoard;
    const creatureOnBoard = myBoard.find((c) => c !== null && c.card.id === baseCard.id);
    if (!creatureOnBoard) return baseCard;

    return {
      id: `ability_${baseCard.id}`,
      element: ability.manaElement || baseCard.element,
      className: baseCard.className,
      name: ability.name,
      nameCn: ability.nameCn,
      type: 'spell',
      cost: ability.cost,
      image: ability.image,
      imgUrl: ability.imgUrl,
      imgBigUrl: ability.imgBigUrl,
      desc: ability.desc,
      requiresTarget: ability.requiresTarget,
      targetType: ability.targetType,
      isActivatedAbility: true,
      sourceCreatureUid: creatureOnBoard.uid,
      spellEffect: `beast_ability_${baseCard.id}`,
    };
  }

  public getEffectiveHand(who: 'player' | 'enemy'): CardDef[] {
    const actor = who === 'player' ? this.player : this.enemy;
    return actor.hand.map((c) => this.getEffectiveCard(who, c));
  }

  // PC Mad Hermit / Magic Rabbit uniqueness rule: "There can be only one Magic Rabbit in play."
  private isMagicRabbitInPlay(): boolean {
    return [...this.playerBoard, ...this.enemyBoard].some(
      (c) => c !== null && c.card.id === 'forest_magic_rabbit'
    );
  }

  // Enraged Beaver and Ritual of the Forest take X from the caster's own Magic Rabbit:
  // "where X is equal to the attack of Magic Rabbit" (0 while no rabbit is in play).
  private ownRabbitAttack(who: 'player' | 'enemy'): number {
    const board = who === 'player' ? this.playerBoard : this.enemyBoard;
    const rabbit = board.find((c) => c !== null && c.card.id === 'forest_magic_rabbit');
    return rabbit ? rabbit.currentAttack : 0;
  }

  // Puts a ready-to-play copy of a Gd.spe token (Bee Soldier…) onto the board. Tokens are
  // engine-spawned only, so they are never dealt into a deck.
  private spawnToken(
    who: 'player' | 'enemy',
    tokenId: string,
    slotIndex: number,
    overrides?: Partial<BoardCreature>
  ): BoardCreature | null {
    const card = (cardsData as CardDef[]).find((c) => c.id === tokenId);
    const board = who === 'player' ? this.playerBoard : this.enemyBoard;
    if (!card || slotIndex < 0 || slotIndex >= board.length || board[slotIndex] !== null) return null;
    const creature: BoardCreature = {
      uid: Math.random().toString(36).substring(2, 9),
      card,
      owner: who,
      slotIndex,
      baseAttack: card.attack || 0,
      currentAttack: card.attack || 0,
      buffedAttack: false,
      currentLife: card.life || 1,
      maxLife: card.life || 1,
      isWall: !!card.isWall,
      flying: !!card.flying,
      spellImmune: !!card.spellImmune,
      regen: card.regen || 0,
      canAttack: false,
      ...overrides,
    };
    board[slotIndex] = creature;
    return creature;
  }

  // Targeting rules that depend on the creature being aimed at rather than on its side.
  // PC Power Chains: "deals 12 damage to target opponent's Fire, Water, Air or Earth Creature".
  private isValidSpellTarget(card: CardDef, target: BoardCreature | null): target is BoardCreature {
    if (!target || target.spellImmune) return false;
    if (card.id === 'demon_power_chains') {
      return (['fire', 'water', 'air', 'earth'] as ElementType[]).includes(target.card.element);
    }
    return true;
  }

  public canPlayCard(who: 'player' | 'enemy', card: CardDef, targetSlot?: number): boolean {
    if (this.gameOver || this.activeTurn !== who || this.isCombatPhase) return false;
    const actor = who === 'player' ? this.player : this.enemy;
    const board = who === 'player' ? this.playerBoard : this.enemyBoard;

    if (!card.isActivatedAbility && BEAST_ACTIVATED_ABILITIES[card.id]) {
      const effective = this.getEffectiveCard(who, card);
      if (effective.isActivatedAbility) {
        return this.canPlayCard(who, effective, targetSlot);
      }
    }

    // PC Reaver: "While Reaver is in play, its owner can't cast spells." Beast activated
    // abilities are skills rather than spells, so they stay usable.
    if (card.type === 'spell' && !card.isActivatedAbility) {
      if (board.some((c) => c !== null && c.card.ability === 'reaver_redirect')) return false;
    }

    let cost = card.cost;
    // Check Damping Tower / Goblin Shaman penalty
    const oppBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
    oppBoard.forEach((c) => {
      if (c && c.card.ability === 'all_card_cost_plus_1') cost += 1;
      if (c && c.card.ability === 'spell_cost_plus_1' && card.type === 'spell') cost += 1;
    });

    // Check friendly Timeweaver discount
    board.forEach((c) => {
      if (c && c.card.ability === 'spell_cost_minus_1' && card.type === 'spell') {
        cost = Math.max(1, cost - 1);
      }
    });

    // Global Gathering-of-Power taxes (both players are affected).
    cost = this.applyGlobalCostModifiers(card, cost);

    if (actor.mana[card.element] < cost) return false;

    // PC Blood discipline: "cost N blood and 2N life" — the owner must be left with life to
    // spare ("You should have more life to use this card").
    if (card.lifeCost && actor.hp <= card.lifeCost) return false;

    if (card.isActivatedAbility) {
      const baseCardId = card.id.replace('ability_', '');
      const hasCreature = board.some((c) => c !== null && c.card.id === baseCardId);
      if (!hasCreature) return false;

      if (card.targetType === 'empty_friendly_slot') {
        return board.some((slot) => slot === null);
      }
      if (card.targetType === 'enemy_creature') {
        const opposingBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
        return opposingBoard.some((slot) => slot !== null && !slot.spellImmune);
      }
      if (card.targetType === 'any_creature') {
        const opposingBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
        return board.some((slot) => slot !== null && !slot.spellImmune) ||
               opposingBoard.some((slot) => slot !== null && !slot.spellImmune);
      }
      return true;
    }

    if (this.extraSpellOnly[who] && card.type !== 'spell') {
      return false;
    }

    if (card.type === 'creature') {
      // PC Magic Rabbit: "There can be only one Magic Rabbit in play."
      if (card.id === 'forest_magic_rabbit' && this.isMagicRabbitInPlay()) return false;

      if (card.id === 'death_emissary_of_dorlak') {
        if (targetSlot !== undefined) {
          return targetSlot >= 0 && targetSlot < board.length && board[targetSlot] !== null;
        }
        return board.some((slot) => slot !== null);
      }
      // PC Forest Wolf: "must be summoned onto Magic Rabbit. Magic Rabbit is killed."
      if (card.onSummon === 'forest_wolf_devour') {
        if (targetSlot !== undefined) {
          return targetSlot >= 0 && targetSlot < board.length && board[targetSlot]?.card.id === 'forest_magic_rabbit';
        }
        return board.some((slot) => slot !== null && slot.card.id === 'forest_magic_rabbit');
      }
      // PC altars: a creature may be summoned onto them and is sacrificed instead of arriving.
      if (targetSlot !== undefined) {
        if (targetSlot < 0 || targetSlot >= board.length) return false;
        const occupant = board[targetSlot];
        if (occupant && this.isSacrificeAltar(occupant)) return true;
        return occupant === null;
      }
      return board.some((slot) => slot === null);
    }

    if (card.requiresTarget) {
      const opposingBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
      if (card.id === 'goblin_rescue_operation') {
        // PC: the target may be any creature, on either side of the board.
        return board.some((slot) => slot !== null) || opposingBoard.some((slot) => slot !== null);
      }
      if (this.isFriendlyTargetSpell(card)) {
        return board.some((slot) => slot !== null);
      }
      return opposingBoard.some((slot) => this.isValidSpellTarget(card, slot));
    }

    return true;
  }

  public async playCard(who: 'player' | 'enemy', card: CardDef, targetSlot?: number): Promise<boolean> {
    if (!card.isActivatedAbility && BEAST_ACTIVATED_ABILITIES[card.id]) {
      const effective = this.getEffectiveCard(who, card);
      if (effective.isActivatedAbility) {
        card = effective;
      }
    }

    if (!this.canPlayCard(who, card)) return false;

    this.extraSpellOnly[who] = false;

    const actor = who === 'player' ? this.player : this.enemy;
    const board = who === 'player' ? this.playerBoard : this.enemyBoard;

    // PC Forest Wolf: "must be summoned onto Magic Rabbit. Magic Rabbit is killed."
    // Validated before the mana is spent, so an illegal target never burns energy.
    if (card.type === 'creature' && card.onSummon === 'forest_wolf_devour') {
      const host = targetSlot !== undefined ? board[targetSlot] : null;
      if (!host || host.card.id !== 'forest_magic_rabbit') return false;
    }

    const preCastMana: Record<ElementType, number> = { ...actor.mana };
    let finalCost = card.cost;
    const oppBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
    oppBoard.forEach((c) => {
      if (c && c.card.ability === 'all_card_cost_plus_1') finalCost += 1;
      if (c && c.card.ability === 'spell_cost_plus_1' && card.type === 'spell') finalCost += 1;
    });
    board.forEach((c) => {
      if (c && c.card.ability === 'spell_cost_minus_1' && card.type === 'spell') {
        finalCost = Math.max(1, finalCost - 1);
      }
    });
    finalCost = this.applyGlobalCostModifiers(card, finalCost);

    actor.mana[card.element] -= finalCost;

    // PC Blood discipline: the printed life half of the cost is paid by the owner on top of the
    // blood energy ("cost N blood and 2N life").
    if (card.lifeCost) {
      actor.hp -= card.lifeCost;
      this.triggerDamage(who, 'hero', card.lifeCost, { selfInflicted: true });
      sound.play('negativeeffect');
      this.log(`【${card.nameCn}】以 ${card.lifeCost} 点鲜血为祭，${actor.name} 生命降至 ${actor.hp}！`, 'damage');
    }

    if (who === 'enemy') {
      this.enemyRevealedCardIds.add(card.id);
      if (card.isActivatedAbility) {
        this.enemyRevealedCardIds.add(card.id.replace('ability_', ''));
      }
      if (this.onCardAnnouncement) {
        await this.onCardAnnouncement(who, card);
      }
    } else {
      this.playerRevealedCardIds.add(card.id);
      if (card.isActivatedAbility) {
        this.playerRevealedCardIds.add(card.id.replace('ability_', ''));
      }
    }

    if (card.isActivatedAbility) {
      const baseCardId = card.id.replace('ability_', '');
      await this.executeBeastActivatedAbility(who, baseCardId, card, targetSlot);
      this.notify();
      await this.delay(500);
      this.cleanupDead();
      this.notify();
      await this.delay(350);

      this.replaySteps.push({
        turn: this.turnCount,
        side: who,
        action: 'spell',
        cardName: card.nameCn,
        cardId: card.id,
        cardImg: card.imgBigUrl || card.imgUrl,
        targetSlot,
        desc: `使用主动技能【${card.nameCn}】`,
        playerHp: this.player.hp,
        enemyHp: this.enemy.hp,
        playerMana: { ...this.player.mana },
        enemyMana: { ...this.enemy.mana },
        playerBoard: this.cloneBoard(this.playerBoard),
        enemyBoard: this.cloneBoard(this.enemyBoard),
      });

      this.cleanupDead();
      this.checkWinner();

      if (this.extraActionRemaining[who] > 0) {
        this.extraActionRemaining[who]--;
        this.log(`【时序加速】${actor.name} 获得额外出牌机会！`, 'heal');
        this.notify();
        return true;
      }

      if (!this.gameOver) {
        await this.executeCombat(who);
      } else {
        this.notify();
      }
      return true;
    }

    if (card.type === 'creature') {
      if (targetSlot === undefined) return false;
      let inheritedAttack: number | null = null;
      let offeredToAltar: BoardCreature | null = null;
      if (card.id === 'death_emissary_of_dorlak') {
        if (board[targetSlot] === null) return false;
        const sac = board[targetSlot]!;
        this.log(`【${card.nameCn}】降临，吞噬献祭了原宿主友军【${sac.card.nameCn}】！`, 'damage');
        board[targetSlot] = null;
      } else if (card.onSummon === 'forest_wolf_devour') {
        // PC: the Rabbit is killed and the Wolf inherits its exact attack value.
        const rabbit = board[targetSlot]!;
        inheritedAttack = rabbit.currentAttack;
        this.log(`【${card.nameCn}】扑杀【${rabbit.card.nameCn}】，继承了它 ${inheritedAttack} 点攻击力！`, 'damage');
        board[targetSlot] = null;
      } else if (board[targetSlot] !== null && this.isSacrificeAltar(board[targetSlot]!)) {
        // The altar consumes the offering and stays in play.
        offeredToAltar = board[targetSlot]!;
        this.resolveSacrificeAltar(who, offeredToAltar, card);
        this.onCardPlayed(who, card);
        this.replaySteps.push({
          turn: this.turnCount,
          side: who,
          action: 'creature',
          cardName: card.nameCn,
          cardId: card.id,
          cardImg: card.imgUrl,
          targetSlot,
          desc: `${actor.name} 将【${card.nameCn}】献祭给【${offeredToAltar.card.nameCn}】`,
          playerHp: this.player.hp,
          enemyHp: this.enemy.hp,
          playerMana: { ...this.player.mana },
          enemyMana: { ...this.enemy.mana },
          playerBoard: this.cloneBoard(this.playerBoard),
          enemyBoard: this.cloneBoard(this.enemyBoard),
        });
        this.cleanupDead();
        this.checkWinner();
        if (!this.gameOver) {
          await this.executeCombat(who);
        } else {
          this.notify();
        }
        return true;
      } else {
        if (board[targetSlot] !== null) return false;
      }

      if (this.onCardEnterSlot) {
        await this.onCardEnterSlot({ who, card, targetSlot });
      } else {
        sound.play('summon');
      }

      // Swift aura: Merfolk Overlord only covers its neighbouring slots, while Priestess of
      // Moments covers every other creature its owner controls.
      let isSwift = !!card.swift;
      board.forEach((c, sIdx) => {
        if (!c) return;
        if (c.card.ability === 'double_attack_all_swift') isSwift = true;
        if (c.card.ability === 'neighbor_swift' && Math.abs(sIdx - targetSlot) === 1) isSwift = true;
        // PC Celestia: "allows all allied creatures to attack the turn they are summoned."
        if (c.card.ability === 'celestia_swift_all') isSwift = true;
      });

      const initialAtk = inheritedAttack !== null
        ? inheritedAttack
        : ((card.attack === -1 && card.ability === 'attack_equal_element_power')
          ? (preCastMana[card.element as ElementType] || 0)
          : (card.attack || 0));

      const creature: BoardCreature = {
        uid: Math.random().toString(36).substring(2, 9),
        card,
        owner: who,
        slotIndex: targetSlot,
        baseAttack: initialAtk,
        currentAttack: initialAtk,
        buffedAttack: false,
        currentLife: card.life || 1,
        maxLife: card.life || 1,
        isWall: !!card.isWall,
        flying: !!card.flying,
        spellImmune: !!card.spellImmune,
        regen: card.regen || 0,
        canAttack: isSwift,
      };

      this.lastSummonedUid = creature.uid;
      board[targetSlot] = creature;
      this.recalculateBoardStats();
      this.log(`${actor.name} 在 [${targetSlot + 1}号位] 召唤了【${card.nameCn}】！`, 'summon');
      this.notify();

      // Goblin Hero evasion when opposite creature is summoned
      const oppHeroCreature = oppBoard[targetSlot];
      if (oppHeroCreature && oppHeroCreature.card.ability === 'goblin_hero_synergy') {
        const emptySlots: number[] = [];
        oppBoard.forEach((slot, sIdx) => {
          if (slot === null) emptySlots.push(sIdx);
        });
        if (emptySlots.length > 0) {
          const newSlot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
          oppBoard[newSlot] = oppHeroCreature;
          oppBoard[targetSlot] = null;
          oppHeroCreature.slotIndex = newSlot;
          sound.play('move_falcon');
          this.log(`【${oppHeroCreature.card.nameCn}】见对格强敌降临，紧急闪避位移至 [${newSlot + 1}号位]！`, 'heal');
        }
      }

      // Templar: each time its owner summons a creature into a neighbouring slot it deals
      // 4 damage to the opponent.
      const templarHero = who === 'player' ? this.enemy : this.player;
      const templarSide = who === 'player' ? 'enemy' : 'player';
      [targetSlot - 1, targetSlot + 1].forEach((nIdx) => {
        if (nIdx < 0 || nIdx >= board.length) return;
        const templar = board[nIdx];
        if (templar && templar.card.ability === 'templar_retribution') {
          templarHero.hp -= 4;
          this.triggerDamage(templarSide, 'hero', 4);
          sound.play('negativeeffect');
          this.log(`【${templar.card.nameCn}】圣殿裁决，对新兵入伍处以神罚，对 ${templarHero.name} 造成 4 点伤害！`, 'damage');
        }
      });

      // Check for interceptor abilities (e.g., Dwarven Rifleman)
      oppBoard.forEach((c) => {
        if (c && c.card.ability === 'intercept_4' && !creature.spellImmune) {
          creature.currentLife -= 4;
          this.triggerDamage(who, targetSlot, 4);
          sound.play('boom');
          this.log(`敌方【${c.card.nameCn}】警戒射击，对新入场的【${creature.card.nameCn}】造成 4 点伤害！`, 'attack');
        }
      });

      setTimeout(() => {
        if (this.lastSummonedUid === creature.uid) {
          this.lastSummonedUid = null;
        }
      }, 700);
      await this.delay(450);

      await this.resolveOnSummon(who, card, targetSlot, preCastMana);
      this.notify();
      await this.delay(450);
      this.cleanupDead();
      this.notify();
      await this.delay(350);
    } else {
      if (this.onCardEnterSlot) {
        await this.onCardEnterSlot({ who, card, targetSlot });
      }
      this.log(`${actor.name} 施放了法术【${card.nameCn}】！`, 'info');
      await this.resolveSpell(who, card, targetSlot, preCastMana);
      this.notify();
      await this.delay(500); // 确保法术伤害扣血、飘字与命中特效在场上完整展现
      this.cleanupDead();    // 清理死亡随从，清空槽位
      this.notify();
      await this.delay(350); // 棋盘空位呈现完毕后再进入攻击结算
    }

    this.replaySteps.push({
      turn: this.turnCount,
      side: who,
      action: card.type === 'creature' ? 'creature' : 'spell',
      cardName: card.nameCn,
      cardId: card.id,
      cardImg: card.imgUrl,
      targetSlot,
      desc: card.type === 'creature'
        ? `${actor.name} 在 [${(targetSlot ?? 0) + 1}号位] 召唤了【${card.nameCn}】`
        : `${actor.name} 施放了法术【${card.nameCn}】`,
      playerHp: this.player.hp,
      enemyHp: this.enemy.hp,
      playerMana: { ...this.player.mana },
      enemyMana: { ...this.enemy.mana },
      playerBoard: this.cloneBoard(this.playerBoard),
      enemyBoard: this.cloneBoard(this.enemyBoard),
    });

    // Reaction cards (Academy of Magic / Astral Accelerator / Mana Storm / Living Tornado / the
    // opposing Astral Damper) fire once the played card has fully resolved.
    this.onCardPlayed(who, card);

    this.cleanupDead();
    this.checkWinner();

    // Check if player has extra actions (e.g. from Time Dragon / Chrono)
    if (this.extraActionRemaining[who] > 0) {
      this.extraActionRemaining[who]--;
      this.log(`【时序加速】${actor.name} 获得额外出牌机会！`, 'heal');
      this.notify();
      return true;
    }

    if (!this.gameOver) {
      await this.executeCombat(who);
    } else {
      this.notify();
    }

    return true;
  }

  private async executeBeastActivatedAbility(
    who: 'player' | 'enemy',
    baseCardId: string,
    _abilityCard: CardDef,
    targetSlot?: number
  ): Promise<void> {
    const actor = who === 'player' ? this.player : this.enemy;
    const opponent = who === 'player' ? this.enemy : this.player;
    const myBoard = who === 'player' ? this.playerBoard : this.enemyBoard;
    const oppBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
    const opposingSide = who === 'player' ? 'enemy' : 'player';

    switch (baseCardId) {
      case 'beast_death_falcon': {
        if (targetSlot === undefined || myBoard[targetSlot] !== null) return;
        const falconIdx = myBoard.findIndex((c) => c !== null && c.card.id === 'beast_death_falcon');
        if (falconIdx === -1) return;

        const falcon = myBoard[falconIdx]!;
        falcon.slotIndex = targetSlot;
        myBoard[falconIdx] = null;
        myBoard[targetSlot] = falcon;

        sound.play('move_falcon');
        this.log(`【死亡之隼】迅捷掠空，穿梭至第 ${targetSlot + 1} 槽位并卷起凌厉风暴！`, 'attack');

        oppBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 4;
            this.triggerDamage(opposingSide, idx, 4);
          }
        });
        this.log(`【隼之突袭】疾风割裂，对敌方全线生物造成 4 点伤害！`, 'damage');
        break;
      }
      case 'beast_magic_hamster': {
        sound.play('natural_healing');
        myBoard.forEach((c, idx) => {
          if (c) {
            const healAmount = Math.min(18, c.maxLife - c.currentLife);
            c.currentLife = Math.min(c.maxLife, c.currentLife + 18);
            this.triggerHeal(who, idx, healAmount > 0 ? healAmount : 18);
          }
        });
        this.log(`【魔法仓鼠】发动【自然回复】，为己方所有生物回复 18 点生命！`, 'heal');
        break;
      }
      case 'beast_scorpion': {
        if (targetSlot !== undefined && oppBoard[targetSlot] && !oppBoard[targetSlot]!.spellImmune) {
          oppBoard[targetSlot]!.currentLife -= 14;
          sound.play('poison');
          this.triggerDamage(opposingSide, targetSlot, 14);
          this.log(`【毒蝎】喷射致命剧毒，对【${oppBoard[targetSlot]!.card.nameCn}】造成 14 点剧毒伤害！`, 'damage');
        }
        break;
      }
      case 'beast_wolverine': {
        const wolverine = myBoard.find((c) => c !== null && c.card.id === 'beast_wolverine');
        if (wolverine) {
          wolverine.currentLife = wolverine.maxLife;
          wolverine.baseAttack += 2;
          wolverine.currentAttack += 2;
          wolverine.buffedAttack = true;
          sound.play('enrage');
          this.triggerHeal(who, wolverine.slotIndex, wolverine.maxLife);
          this.log(`【狼獾】陷入暴怒！生命值彻底回满，且攻击力永久提升至 ${wolverine.currentAttack}！`, 'heal');
        }
        break;
      }
      case 'beast_energy_beast': {
        actor.mana.fire = (actor.mana.fire || 0) + 1;
        actor.mana.water = (actor.mana.water || 0) + 1;
        actor.mana.air = (actor.mana.air || 0) + 1;
        actor.mana.earth = (actor.mana.earth || 0) + 1;
        sound.play('pump_energy');
        this.log(`【魔能兽】共鸣魔网，使拥有者的火、水、气、土能量各 +1！`, 'heal');
        break;
      }
      case 'beast_white_elephant': {
        actor.mana.special = (actor.mana.special || 0) + 1;
        sound.play('trumpet');
        this.log(`【白象】昂首长鸣，鼓舞野兽意志，野兽系能量 +1！`, 'heal');
        break;
      }
      case 'beast_basilisk': {
        if (targetSlot !== undefined) {
          const targetSide = oppBoard[targetSlot] ? opposingSide : (myBoard[targetSlot] ? who : null);
          const targetCreature = oppBoard[targetSlot] || myBoard[targetSlot];
          if (targetSide && targetCreature && !targetCreature.spellImmune) {
            targetCreature.currentLife -= 6;
            sound.play('gaze');
            this.triggerDamage(targetSide, targetSlot, 6);
            this.log(`【巨蜥】石化凝视，对【${targetCreature.card.nameCn}】造成 6 点石化重创！`, 'damage');
          }
        }
        break;
      }
      case 'beast_ancient_dragon': {
        sound.play('breathe_fire');
        opponent.hp -= 10;
        this.triggerDamage(opposingSide, 'hero', 10);
        oppBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 10;
            this.triggerDamage(opposingSide, idx, 10);
          }
        });
        this.log(`【远古巨龙】喷吐烈焰龙息，对敌方英雄及全线生物造成 10 点毁灭伤害！`, 'damage');
        break;
      }
      // PC Inactive Hellbot: 4 Mechanical power turns it into the Hellbot.
      case 'gop_inactive_hellbot': {
        const idx = myBoard.findIndex((c) => c !== null && c.card.id === 'gop_inactive_hellbot');
        if (idx === -1) return;
        myBoard[idx] = null;
        const active = this.spawnToken(who, 'mech_hellbot', idx);
        if (active) {
          active.canAttack = false;
          this.recalculateBoardStats();
          sound.play('positiveeffect');
          this.log(`【未激活的终极机械】轰然启动，变身为【地狱机兵】(3/28)！`, 'summon');
        }
        break;
      }
    }
  }

  private async resolveOnSummon(who: 'player' | 'enemy', card: CardDef, targetSlot: number, preCastMana?: Record<ElementType, number>): Promise<void> {
    const actor = who === 'player' ? this.player : this.enemy;
    const opponent = who === 'player' ? this.enemy : this.player;
    const opposingSide = who === 'player' ? 'enemy' : 'player';
    const opposingBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
    const myBoard = who === 'player' ? this.playerBoard : this.enemyBoard;
    const manaRef = preCastMana || actor.mana;
    if (card.ability === 'all_friendly_attack_1') {
      sound.play('strenghtening');
      this.recalculateBoardStats();
      this.log(`【牛头人指挥官】战意昂扬，赋予己方所有其它生物攻击力 +1！`, 'heal');
      this.notify();
    } else if (card.ability === 'neighbor_attack_2') {
      sound.play('strenghtening');
      this.recalculateBoardStats();
      this.log(`【兽人酋长】狂怒战吼，赋予两侧相邻生物攻击力 +2！`, 'heal');
      this.notify();
    }

    switch (card.onSummon) {
      case 'crusader_bless_2': {
        myBoard.forEach((c, idx) => {
          if (c) {
            c.currentLife = Math.min(c.maxLife, c.currentLife + 2);
            this.triggerHeal(who, idx, 2);
          }
        });
        sound.play('positiveeffect');
        this.log(`【${card.nameCn}】圣光抚慰，为己方所有生物恢复 2 点生命！`, 'heal');
        break;
      }
      case 'angel_of_war_8': {
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 8;
            this.triggerDamage(opposingSide, idx, 8);
          }
        });
        myBoard.forEach((c, idx) => {
          if (c) {
            c.currentLife = Math.min(c.maxLife, c.currentLife + 8);
            this.triggerHeal(who, idx, 8);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】战天使降临，对敌方全场造成 8 点圣裁，并治愈己方全员 8 点生命！`, 'damage');
        break;
      }
      case 'spawn_spiders': {
        [-1, 1].forEach((offset) => {
          const adj = targetSlot + offset;
          if (adj >= 0 && adj < myBoard.length && myBoard[adj] === null) {
            const spiderCard: CardDef = {
              id: 'earth_forest_spider',
              name: 'Forest Spider',
              nameCn: '丛林蜘蛛',
              type: 'creature',
              element: 'earth',
              cost: 1,
              attack: 2,
              life: 11,
              image: 'GiantSpider',
              imgUrl: './cards/GiantSpider.webp',
              imgBigUrl: './cards/GiantSpiderBig.webp',
              desc: '丛林蜘蛛',
            };
            const spiderCreature: BoardCreature = {
              uid: 'spawn_spider_' + Date.now() + '_' + adj,
              card: spiderCard,
              owner: who,
              slotIndex: adj,
              baseAttack: 2,
              currentAttack: 2,
              buffedAttack: false,
              currentLife: 11,
              maxLife: 11,
              isWall: false,
              flying: false,
              spellImmune: false,
              regen: 0,
              canAttack: false,
            };
            myBoard[adj] = spiderCreature;
            this.log(`【巨型蜘蛛】孵化繁衍，在 [${adj + 1}号位] 召唤了【丛林蜘蛛】(2/11)！`, 'summon');
          }
        });
        sound.play('summon');
        break;
      }
      case 'fire_elemental_summon': {
        opponent.hp -= 3;
        this.triggerDamage(opposingSide, 'hero', 3);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 3;
            this.triggerDamage(opposingSide, idx, 3);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】炽烈登场，对敌方英雄与全场敌军各造成 3 点烈焰灼烧！`, 'damage');
        break;
      }
      case 'air_elemental_summon': {
        opponent.hp -= 8;
        this.triggerDamage(opposingSide, 'hero', 8);
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】雷啸临空，对 ${opponent.name} 造成 8 点狂风重击！`, 'damage');
        break;
      }
      case 'earth_elemental_growth': {
        sound.play('positiveeffect');
        this.log(`【${card.nameCn}】大地苏醒，使拥有者每回合土系能量成长率 +1！`, 'heal');
        break;
      }
      case 'damage_all_enemies_5': {
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 5;
            this.triggerDamage(opposingSide, idx, 5);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】烈焰席卷，对敌方全场生物造成 5 点伤害！`, 'damage');
        break;
      }
      case 'damage_all_other_4': {
        myBoard.forEach((c, idx) => {
          if (c && idx !== targetSlot && !c.spellImmune) {
            c.currentLife -= 4;
            this.triggerDamage(who, idx, 4);
          }
        });
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 4;
            this.triggerDamage(opposingSide, idx, 4);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】践踏全场，对所有其它生物造成 4 点震荡伤害！`, 'damage');
        break;
      }
      case 'lich_burst_8': {
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 8;
            this.triggerDamage(opposingSide, idx, 8);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】入场冥火轰鸣，对敌方全场生物造成 8 点冥火伤害！`, 'damage');
        break;
      }
      case 'demon_greater_summon': {
        const fireDmg = Math.min(10, Math.max(1, manaRef.fire));
        opponent.hp -= fireDmg;
        this.triggerDamage(opposingSide, 'hero', fireDmg);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= fireDmg;
            this.triggerDamage(opposingSide, idx, fireDmg);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】深渊降临灭世登场，对敌方英雄及全场生物各造成 ${fireDmg} 点灭世烈焰伤害！`, 'damage');
        break;
      }
      case 'scorpion_stun': {
        const oppSlot = opposingBoard[targetSlot];
        if (oppSlot) {
          oppSlot.skipNextAttack = true;
          oppSlot.canAttack = false;
          sound.play('poison');
          this.log(`【${card.nameCn}】麻痹毒针刺入【${oppSlot.card.nameCn}】，使其麻痹跳过下轮攻击！`, 'damage');
        }
        break;
      }
      case 'angel_holy_3': {
        actor.mana.holy += 3;
        sound.play('positiveeffect');
        this.log(`【${card.nameCn}】圣光降临，圣职能量 +3！`, 'heal');
        break;
      }
      case 'timeblazer_teleport': {
        [targetSlot - 1, targetSlot + 1].forEach((sIdx) => {
          if (sIdx >= 0 && sIdx < 6 && myBoard[sIdx]) {
            myBoard[sIdx]!.directHeroAttackTurn = true;
          }
        });
        sound.play('positiveeffect');
        this.log(`【${card.nameCn}】时空穿梭，赋予两侧相邻友军在本回合攻击阶段直击敌方英雄本体的能力！`, 'heal');
        break;
      }
      case 'gain_fire_2': {
        actor.mana.fire += 2;
        sound.play('positiveeffect');
        this.log(`【${card.nameCn}】献祭获得火系能量 +2！`, 'heal');
        break;
      }
      case 'water_elemental_summon': {
        actor.hp = Math.min(actor.maxHp, actor.hp + 10);
        this.triggerHeal(who, 'hero', 10);
        sound.play('healingmini');
        this.log(`【${card.nameCn}】甘霖润泽，为 ${actor.name} 恢复 10 点生命！`, 'heal');
        break;
      }
      case 'griffin_strike': {
        if (manaRef.air >= 5) {
          opponent.hp -= 5;
          this.triggerDamage(opposingSide, 'hero', 5);
          sound.play('attack');
          this.log(`【${card.nameCn}】气流呼啸，对 ${opponent.name} 造成 5 点直接打击！`, 'damage');
        }
        break;
      }
      case 'faerie_sage_heal': {
        const healAmt = Math.min(10, Math.max(1, manaRef.earth));
        actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
        this.triggerHeal(who, 'hero', healAmt);
        sound.play('heal');
        this.log(`【${card.nameCn}】自然祈福，为 ${actor.name} 恢复 ${healAmt} 点生命！`, 'heal');
        break;
      }
      case 'titan_strike_15': {
        const oppSlot = opposingBoard[targetSlot];
        if (oppSlot && !oppSlot.spellImmune) {
          oppSlot.currentLife -= 15;
          this.triggerDamage(opposingSide, targetSlot, 15);
          sound.play('negativeeffect');
          this.log(`【${card.nameCn}】重踏落雷，对对格【${oppSlot.card.nameCn}】造成 15 点毁灭打击！`, 'damage');
        }
        break;
      }
      case 'banshee_shriek': {
        const opp = opposingBoard[targetSlot];
        if (opp && !opp.spellImmune) {
          const dmg = Math.ceil(opp.currentLife * 0.5);
          opp.currentLife -= dmg;
          this.triggerDamage(opposingSide, targetSlot, dmg);
          sound.play('negativeeffect');
          this.log(`【${card.nameCn}】怨灵尖啸，对对面【${opp.card.nameCn}】造成半血重创 (${dmg}点)！`, 'damage');
        }
        break;
      }
      case 'paladin_bless_4': {
        myBoard.forEach((c, idx) => {
          if (c) {
            c.currentLife = Math.min(c.maxLife, c.currentLife + 4);
            this.triggerHeal(who, idx, 4);
          }
        });
        sound.play('heal');
        this.log(`【${card.nameCn}】圣堂祈福，为全场友方生物恢复 4 点生命！`, 'heal');
        break;
      }
      case 'archangel_full_heal': {
        myBoard.forEach((c, idx) => {
          if (c) {
            const h = c.maxLife - c.currentLife;
            c.currentLife = c.maxLife;
            if (h > 0) this.triggerHeal(who, idx, h);
          }
        });
        sound.play('healing');
        this.log(`【${card.nameCn}】神圣光耀降临，使己方全场生物瞬间恢复至满生命！`, 'heal');
        break;
      }
      case 'tank_steam_12': {
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 12;
            this.triggerDamage(opposingSide, idx, 12);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】引擎轰鸣碾压进场，对敌方全场生物造成 12 点震荡伤害！`, 'damage');
        break;
      }
      case 'witch_drain_all_2': {
        (['fire', 'water', 'air', 'earth', opponent.specialElement] as ElementType[]).forEach((e) => {
          opponent.mana[e] = Math.max(0, opponent.mana[e] - 2);
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】枯萎诅咒，剥夺敌方各系能量 2 点！`, 'damage');
        break;
      }
      case 'giant_skip_turn': {
        this.skipNextTurn[opposingSide] = true;
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】泰山压顶，强制敌方跳过下一个出牌回合！`, 'damage');
        break;
      }
      case 'assassin_strike_12': {
        opponent.hp -= 12;
        this.triggerDamage(opposingSide, 'hero', 12);
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】化作暗影直刺，对 ${opponent.name} 造成 12 点要害伤害！`, 'damage');
        break;
      }
      case 'mage_cost_damage': {
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= c.card.cost;
            this.triggerDamage(opposingSide, idx, c.card.cost);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】法能引爆，对敌方每个生物造成等同于其召唤费用的镜像伤害！`, 'damage');
        break;
      }
      case 'hypnotist_aoe_5': {
        opponent.hp -= 5;
        this.triggerDamage(opposingSide, 'hero', 5);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 5;
            this.triggerDamage(opposingSide, idx, 5);
          }
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】心灵海啸，对敌方英雄及全场生物各造成 5 点精神冲击！`, 'damage');
        break;
      }
      case 'hamster_heal_10': {
        [targetSlot - 1, targetSlot + 1].forEach((nIdx) => {
          if (nIdx >= 0 && nIdx < myBoard.length && myBoard[nIdx]) {
            myBoard[nIdx]!.currentLife = Math.min(myBoard[nIdx]!.maxLife, myBoard[nIdx]!.currentLife + 10);
            this.triggerHeal(who, nIdx, 10);
          }
        });
        sound.play('heal');
        this.log(`【${card.nameCn}】萌愈之光为邻格友军各恢复 10 点生命！`, 'heal');
        break;
      }
      case 'ancient_dragon_boost_all_mana': {
        const elems: ElementType[] = ['fire', 'water', 'air', 'earth', actor.specialElement];
        elems.forEach((elem) => {
          actor.mana[elem] = (actor.mana[elem] || 0) + 1;
        });
        sound.play('positiveeffect');
        this.log(`【${card.nameCn}】降临战场，古龙神威令拥有者各系能量各 +1！`, 'heal');
        break;
      }
      case 'falcon_strike_4': {
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 4;
            this.triggerDamage(opposingSide, idx, 4);
          }
        });
        sound.play('flamewave');
        this.log(`【${card.nameCn}】疾风俯冲，对敌方所有生物造成 4 点风刃割裂伤害！`, 'damage');
        break;
      }
      case 'dragon_breath_10': {
        opponent.hp -= 10;
        this.triggerDamage(opposingSide, 'hero', 10);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 10;
            this.triggerDamage(opposingSide, idx, 10);
          }
        });
        sound.play('flamewave');
        this.log(`【${card.nameCn}】龙皇吐息，对敌方英雄与全场生物造成 10 点烈焰吐息伤害！`, 'damage');
        break;
      }
      case 'time_dragon_extra_card': {
        this.extraActionRemaining[who] = (this.extraActionRemaining[who] || 0) + 1;
        sound.play('positiveeffect');
        this.log(`【${card.nameCn}】时空扭转，允许本回合额外打出一张卡牌！`, 'heal');
        break;
      }
      case 'timeweaver_extra_spell': {
        this.extraActionRemaining[who] = (this.extraActionRemaining[who] || 0) + 1;
        this.extraSpellOnly[who] = true;
        sound.play('positiveeffect');
        this.log(`【${card.nameCn}】时空织锦，拥有者立即获得额外一个只能施放魔法的出牌阶段！`, 'heal');
        break;
      }
      case 'goblin_raider_squad': {
        const emptyIndices: number[] = [];
        myBoard.forEach((slot, sIdx) => {
          if (slot === null) emptyIndices.push(sIdx);
        });
        for (let i = emptyIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [emptyIndices[i], emptyIndices[j]] = [emptyIndices[j], emptyIndices[i]];
        }
        const targets = emptyIndices.slice(0, 2);
        targets.forEach((sIdx) => {
          myBoard[sIdx] = {
            uid: Math.random().toString(36).substring(2, 9),
            card: {
              id: 'goblin_raider',
              element: 'special',
              className: 'goblin',
              name: 'Goblin Raider',
              nameCn: '哥布林袭掠军',
              type: 'creature',
              cost: 6,
              attack: 4,
              life: 24,
              image: 'GoblinRaider',
              desc: '哥布林袭掠军分队',
              imgUrl: './cards/GoblinRaider.webp',
              imgBigUrl: './cards/GoblinRaiderBig.webp',
            },
            owner: who,
            slotIndex: sIdx,
            baseAttack: 4,
            currentAttack: 4,
            buffedAttack: false,
            currentLife: 24,
            maxLife: 24,
            isWall: false,
            flying: false,
            spellImmune: false,
            regen: 0,
            canAttack: false,
          };
          this.log(`【${card.nameCn}】军团集结，召集了一名【哥布林袭掠军】(4/24) 进驻 [${sIdx + 1}号位]！`, 'summon');
        });
        if (targets.length > 0) {
          sound.play('summon');
        }
        break;
      }

      // ---------- Forest (Mad Hermit) discipline ----------
      case 'squirrel_strike_8': {
        const oppSlot = opposingBoard[targetSlot];
        if (oppSlot && !oppSlot.spellImmune) {
          oppSlot.currentLife -= 8;
          this.triggerDamage(opposingSide, targetSlot, 8);
          sound.play('negativeeffect');
          this.log(`【${card.nameCn}】飞扑撕咬对格【${oppSlot.card.nameCn}】，造成 8 点伤害！`, 'damage');
        }
        break;
      }
      case 'forest_wolf_devour': {
        // The Rabbit was already killed and its attack inherited inside playCard().
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】吞下【魔法兔子】完成蜕变，攻击力承袭为 ${myBoard[targetSlot]?.currentAttack ?? 0}。`, 'damage');
        break;
      }
      case 'raccoon_mirror_strike': {
        const mirror = opposingBoard[targetSlot];
        const mirrorDmg = mirror ? mirror.currentAttack : 0;
        if (mirrorDmg > 0) {
          opponent.hp -= mirrorDmg;
          this.triggerDamage(opposingSide, 'hero', mirrorDmg);
          sound.play('negativeeffect');
          this.log(`【${card.nameCn}】以彼之道还施彼身，对 ${opponent.name} 造成 ${mirrorDmg} 点伤害！`, 'damage');
        }
        break;
      }
      case 'beaver_rabbit_blast': {
        const beaverDmg = this.ownRabbitAttack(who);
        if (beaverDmg > 0) {
          opponent.hp -= beaverDmg;
          this.triggerDamage(opposingSide, 'hero', beaverDmg);
          opposingBoard.forEach((c, idx) => {
            if (c && !c.spellImmune) {
              c.currentLife -= beaverDmg;
              this.triggerDamage(opposingSide, idx, beaverDmg);
            }
          });
          sound.play('negativeeffect');
          this.log(`【${card.nameCn}】借【魔法兔子】之力暴怒，对 ${opponent.name} 及敌方全场造成 ${beaverDmg} 点伤害！`, 'damage');
        }
        break;
      }
      case 'bee_queen_spawn': {
        let spawned = 0;
        [targetSlot - 1, targetSlot + 1].forEach((nIdx) => {
          if (nIdx >= 0 && nIdx < myBoard.length && myBoard[nIdx] === null) {
            if (this.spawnToken(who, 'forest_bee_soldier', nIdx)) {
              spawned++;
              this.log(`【${card.nameCn}】在 [${nIdx + 1}号位] 产下了一只【兵蜂】(2/8)！`, 'summon');
            }
          }
        });
        if (spawned > 0) sound.play('positiveeffect');
        break;
      }

      // ---------- Golem Master (魔匠) discipline ----------
      // PC Golem Instructor: "increases Golem's attack by 2." (no "while in play", so the bonus
      // is permanent and therefore lives on the player, not on the creature.)
      case 'golem_instructor_boost': {
        actor.golemAttackBonus = (actor.golemAttackBonus || 0) + 2;
        this.recalculateBoardStats();
        sound.play('positiveeffect');
        this.log(`【${card.nameCn}】调校技艺核心，【魔像】攻击力永久 +2（累计 +${actor.golemAttackBonus}）！`, 'heal');
        break;
      }
      // PC Dark Sculptor: "deals X damage to each of the opponent's creatures, where X is equal
      // to the number of creatures in play."
      case 'dark_sculptor_x': {
        const sculptorDmg = [...myBoard, ...opposingBoard].filter((c) => c !== null).length;
        if (sculptorDmg > 0) {
          opposingBoard.forEach((c, idx) => {
            if (c && !c.spellImmune) {
              c.currentLife -= sculptorDmg;
              this.triggerDamage(opposingSide, idx, sculptorDmg);
            }
          });
          sound.play('negativeeffect');
          this.log(`【${card.nameCn}】挥凿溅射，按场上 ${sculptorDmg} 个生物对敌方全场造成 ${sculptorDmg} 点伤害！`, 'damage');
        }
        break;
      }
      // PC Golem Guide: "swaps positions with Golem and increases Golem's attack by 3 until end
      // of turn."
      case 'golem_guide_swap': {
        const golemSlot = myBoard.findIndex((c) => c !== null && c.card.id === 'golem_golem');
        if (golemSlot !== -1 && golemSlot !== targetSlot) {
          const golem = myBoard[golemSlot]!;
          const guide = myBoard[targetSlot];
          if (guide) {
            myBoard[targetSlot] = golem;
            golem.slotIndex = targetSlot;
            myBoard[golemSlot] = guide;
            guide.slotIndex = golemSlot;
            this.log(`【${card.nameCn}】与【${golem.card.nameCn}】瞬间换位，魔像移驻 [${targetSlot + 1}号位]！`, 'heal');
          }
        }
        actor.golemTempAttackBonus = (actor.golemTempAttackBonus || 0) + 3;
        this.recalculateBoardStats();
        sound.play('positiveeffect');
        this.log(`【${card.nameCn}】引导魔力，【魔像】本回合攻击 +3（当前 ${actor.golemTempAttackBonus}）！`, 'heal');
        break;
      }

      // ---------- Cult (邪教) discipline ----------
      // PC Greater Bargul: "deals 20 damage to each other creature."
      case 'damage_all_other_20': {
        let struck = 0;
        const sides: Array<{ board: (BoardCreature | null)[]; side: 'player' | 'enemy'; skip: number }> = [
          { board: myBoard, side: who, skip: targetSlot },
          { board: opposingBoard, side: opposingSide, skip: -1 },
        ];
        sides.forEach(({ board: targetBoard, side: targetSide, skip }) => {
          targetBoard.forEach((c, idx) => {
            if (c && idx !== skip && !c.spellImmune) {
              c.currentLife -= 20;
              this.triggerDamage(targetSide, idx, 20);
              struck++;
            }
          });
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】魔王降临，对所有其它生物（共 ${struck} 个）造成 20 点毁灭冲击！`, 'damage');
        break;
      }

      // ---------- Blood (鲜血) discipline ----------
      // PC Vampire Elder: "puts a 5/14 Initiate into each of its empty neighboring slots."
      case 'vampire_elder_spawn': {
        let spawned = 0;
        [targetSlot - 1, targetSlot + 1].forEach((nIdx) => {
          if (nIdx >= 0 && nIdx < myBoard.length && myBoard[nIdx] === null) {
            if (this.spawnToken(who, 'blood_initiate', nIdx)) {
              spawned++;
              this.log(`【${card.nameCn}】初拥转化，在 [${nIdx + 1}号位] 唤醒了一只【仆从】(5/14)！`, 'summon');
            }
          }
        });
        if (spawned > 0) sound.play('positiveeffect');
        break;
      }
      // PC Magister of Blood: "deals 16 damage to the opponent and to each of the opponent's
      // blocked creatures."
      case 'magister_of_blood_16': {
        opponent.hp -= 16;
        this.triggerDamage(opposingSide, 'hero', 16);
        let blocked = 0;
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune && myBoard[idx] !== null) {
            c.currentLife -= 16;
            this.triggerDamage(opposingSide, idx, 16);
            blocked++;
          }
        });
        sound.play('negativeeffect');
        this.log(`【${card.nameCn}】血海倾覆，对 ${opponent.name} 造成 16 点伤害，并重创 ${blocked} 个被阻挡的敌方生物！`, 'damage');
        break;
      }
    }
  }

  private async resolveSpell(who: 'player' | 'enemy', card: CardDef, targetSlot?: number, preCastMana?: Record<ElementType, number>) {
    // Mark this damage window as "spell damage by `who`" so Treefolk Protector's aura can be
    // applied centrally in triggerDamage().
    this.activeSpellCaster = who;
    this.spellAbsorbedThisCast = 0;
    try {
      await this.resolveSpellEffect(who, card, targetSlot, preCastMana);
    } finally {
      this.activeSpellCaster = null;
      if (this.spellAbsorbedThisCast > 0) {
        this.log(`【古木守护者】以古木之盾减免了本回合 ${this.spellAbsorbedThisCast} 点来自对方魔法的伤害！`, 'heal');
        this.spellAbsorbedThisCast = 0;
      }
    }
  }

  private async resolveSpellEffect(who: 'player' | 'enemy', card: CardDef, targetSlot?: number, preCastMana?: Record<ElementType, number>) {
    const actor = who === 'player' ? this.player : this.enemy;
    const opponent = who === 'player' ? this.enemy : this.player;
    const opposingSide = who === 'player' ? 'enemy' : 'player';
    const opposingBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
    const myBoard = who === 'player' ? this.playerBoard : this.enemyBoard;
    const manaRef = preCastMana || actor.mana;

    // Dragon increases its owner's spell damage by 50%; Faerie Apprentice adds a flat +1
    // (PC: "increases the damage its owner's spells deal by 1", not a percentage).
    let spellAmp = 1.0;
    let spellFlatBonus = 0;
    myBoard.forEach((c) => {
      if (c && c.card.ability === 'spell_damage_50_percent') spellAmp *= 1.5;
      if (c && c.card.ability === 'spell_damage_plus_1') spellFlatBonus += 1;
    });
    // Spell damage = rounded-up (base x multiplier) + flat bonus.
    const spellDmg = (base: number): number => Math.ceil(base * spellAmp) + spellFlatBonus;

    switch (card.spellEffect) {
      case 'damage_all_enemy_creatures_9': {
        const dmg = spellDmg(9);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
          }
        });
        this.log(`【${card.nameCn}】席卷敌阵，对敌方全场生物各造成 ${dmg} 点伤害！`, 'damage');
        break;
      }
      case 'inferno_18_10': {
        const mainDmg = spellDmg(18);
        const aoeDmg = spellDmg(10);
        if (targetSlot !== undefined && opposingBoard[targetSlot]) {
          const t = opposingBoard[targetSlot]!;
          if (!t.spellImmune) {
            t.currentLife -= mainDmg;
            this.triggerDamage(opposingSide, targetSlot, mainDmg);
          }
        }
        opposingBoard.forEach((c, idx) => {
          if (c && idx !== targetSlot && !c.spellImmune) {
            c.currentLife -= aoeDmg;
            this.triggerDamage(opposingSide, idx, aoeDmg);
          }
        });
        this.log(`【${card.nameCn}】轰击主目标造成 ${mainDmg} 点伤害，溅射敌军各 ${aoeDmg} 点伤害！`, 'damage');
        break;
      }
      case 'meditation_boost': {
        actor.mana.fire += 1;
        actor.mana.air += 1;
        actor.mana.earth += 1;
        this.log(`【${card.nameCn}】宁神静气，火、气、土三系能量各 +1！`, 'heal');
        break;
      }
      case 'acidic_rain_15': {
        const dmg = spellDmg(15);
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(c.owner, c.slotIndex, dmg);
          }
        });
        (['fire', 'water', 'air', 'earth', opponent.specialElement] as ElementType[]).forEach((e) => {
          opponent.mana[e] = Math.max(0, opponent.mana[e] - 1);
        });
        this.log(`【${card.nameCn}】腐蚀全场，所有生物受到 ${dmg} 点侵蚀伤害，削减敌方各系能量 1 点！`, 'damage');
        break;
      }
      case 'call_to_thunder_6': {
        const dmg = spellDmg(6);
        if (targetSlot !== undefined && opposingBoard[targetSlot]) {
          const t = opposingBoard[targetSlot]!;
          if (!t.spellImmune) {
            t.currentLife -= dmg;
            this.triggerDamage(opposingSide, targetSlot, dmg);
          }
        }
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        this.log(`【${card.nameCn}】天雷正中目标生物与 ${opponent.name} 本体，各造成 ${dmg} 点雷电重创！`, 'damage');
        break;
      }
      case 'lightning_bolt_scaled': {
        const base = 5 + manaRef.air;
        const dmg = spellDmg(base);
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        this.log(`【${card.nameCn}】雷霆呼啸，对 ${opponent.name} 造成 ${dmg} 点直击雷电伤害！`, 'damage');
        break;
      }
      case 'chain_lightning_9': {
        const dmg = spellDmg(9);
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
          }
        });
        this.log(`【${card.nameCn}】雷网扩散，对敌方英雄及全场生物各造成 ${dmg} 点电弧伤害！`, 'damage');
        break;
      }
      case 'natures_ritual_heal_8': {
        if (targetSlot !== undefined && myBoard[targetSlot]) {
          myBoard[targetSlot]!.currentLife = Math.min(myBoard[targetSlot]!.maxLife, myBoard[targetSlot]!.currentLife + 8);
          this.triggerHeal(who, targetSlot, 8);
        }
        actor.hp = Math.min(actor.maxHp, actor.hp + 8);
        this.triggerHeal(who, 'hero', 8);
        this.log(`【${card.nameCn}】生机焕发，为目标生物与 ${actor.name} 各恢复 8 点生命！`, 'heal');
        break;
      }
      case 'rejuvenation_scaled': {
        const healAmt = manaRef.earth * 2;
        actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
        this.triggerHeal(who, 'hero', healAmt);
        this.log(`【${card.nameCn}】大地回春，为 ${actor.name} 恢复 ${healAmt} 点生命！`, 'heal');
        break;
      }
      case 'stone_rain_25': {
        const dmg = spellDmg(25);
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(c.owner, c.slotIndex, dmg);
          }
        });
        this.log(`【${card.nameCn}】毁天灭地，对全场所有生物造成 ${dmg} 点巨石暴击伤害！`, 'damage');
        break;
      }
      case 'healing_spray_9_6': {
        if (targetSlot !== undefined && myBoard[targetSlot]) {
          myBoard[targetSlot]!.currentLife = Math.min(myBoard[targetSlot]!.maxLife, myBoard[targetSlot]!.currentLife + 9);
          this.triggerHeal(who, targetSlot, 9);
          [targetSlot - 1, targetSlot + 1].forEach((nIdx) => {
            if (nIdx >= 0 && nIdx < myBoard.length && myBoard[nIdx]) {
              myBoard[nIdx]!.currentLife = Math.min(myBoard[nIdx]!.maxLife, myBoard[nIdx]!.currentLife + 6);
              this.triggerHeal(who, nIdx, 6);
            }
          });
        }
        this.log(`【${card.nameCn}】清泉喷涌，为主目标治愈 9 点生命，溅射相邻生物治愈 6 点生命！`, 'heal');
        break;
      }
      case 'fireball_9_6': {
        const mainD = spellDmg(9);
        const subD = spellDmg(6);
        if (targetSlot !== undefined && opposingBoard[targetSlot]) {
          const t = opposingBoard[targetSlot]!;
          if (!t.spellImmune) {
            t.currentLife -= mainD;
            this.triggerDamage(opposingSide, targetSlot, mainD);
          }
          [targetSlot - 1, targetSlot + 1].forEach((nIdx) => {
            if (nIdx >= 0 && nIdx < opposingBoard.length && opposingBoard[nIdx] && !opposingBoard[nIdx]!.spellImmune) {
              opposingBoard[nIdx]!.currentLife -= subD;
              this.triggerDamage(opposingSide, nIdx, subD);
            }
          });
        }
        this.log(`【${card.nameCn}】引爆，对主目标造成 ${mainD} 点伤害，相邻生物溅射 ${subD} 点伤害！`, 'damage');
        break;
      }
      case 'steal_essence_5': {
        const dmg = spellDmg(5);
        if (targetSlot !== undefined && opposingBoard[targetSlot]) {
          const t = opposingBoard[targetSlot]!;
          if (!t.spellImmune) {
            t.currentLife -= dmg;
            this.triggerDamage(opposingSide, targetSlot, dmg);
            if (t.currentLife <= 0) {
              actor.mana.special += 4;
              this.log(`【${card.nameCn}】斩杀成功，汲取获得 4 点专属能量！`, 'heal');
            }
          }
        }
        break;
      }
      case 'mana_burn_effect': {
        let maxVal = 0;
        let maxElem: ElementType = 'fire';
        (Object.keys(opponent.mana) as ElementType[]).forEach((e) => {
          if (opponent.mana[e] > maxVal) {
            maxVal = opponent.mana[e];
            maxElem = e;
          }
        });
        const burnDmg = spellDmg(maxVal);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= burnDmg;
            this.triggerDamage(opposingSide, idx, burnDmg);
          }
        });
        opponent.mana[maxElem] = Math.max(0, opponent.mana[maxElem] - 3);
        this.log(`【${card.nameCn}】点燃敌方最高的 ${maxElem.toUpperCase()} 能量，对敌全场生物造成 ${burnDmg} 点烈焰灼烧！`, 'damage');
        break;
      }
      case 'disintegrate_kill_and_11': {
        if (targetSlot !== undefined && opposingBoard[targetSlot]) {
          const t = opposingBoard[targetSlot]!;
          if (!t.spellImmune) {
            t.isDestroyed = true;
            t.currentLife = 0;
            this.triggerDamage(opposingSide, targetSlot, 99);
          }
        }
        const aoe = spellDmg(11);
        opposingBoard.forEach((c, idx) => {
          if (c && idx !== targetSlot && !c.spellImmune) {
            c.currentLife -= aoe;
            this.triggerDamage(opposingSide, idx, aoe);
          }
        });
        this.log(`【${card.nameCn}】秒杀粉碎目标生物，震波对敌方其它生物各造成 ${aoe} 点波及伤害！`, 'damage');
        break;
      }
      case 'ritual_of_glory_buff': {
        myBoard.forEach((c) => {
          if (c && !c.isWall) {
            c.currentLife = c.maxLife;
            c.currentAttack += 3;
            c.buffedAttack = true;
            c.tempAttackBuff = (c.tempAttackBuff || 0) + 3;
          }
        });
        sound.play('heal');
        this.log(`【${card.nameCn}】圣辉洗礼，己方全员生命回满且本回合攻击力 +3！`, 'heal');
        break;
      }
      case 'dark_ritual_3': {
        const dmg = spellDmg(3);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
          }
        });
        myBoard.forEach((c, idx) => {
          if (c) {
            c.currentLife = Math.min(c.maxLife, c.currentLife + 3);
            this.triggerHeal(who, idx, 3);
          }
        });
        this.log(`【${card.nameCn}】暗影侵蚀敌方造成 ${dmg} 点伤害，吸取暗能滋养友方恢复 3 点生命！`, 'damage');
        break;
      }
      case 'cursed_fog_12': {
        const dmg = spellDmg(12);
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(c.owner, c.slotIndex, dmg);
          }
        });
        opponent.hp -= 3;
        this.triggerDamage(opposingSide, 'hero', 3);
        this.log(`【${card.nameCn}】毒瘴弥漫全场造成 ${dmg} 点伤害，并对 ${opponent.name} 造成 3 点蚀骨伤害！`, 'damage');
        break;
      }
      case 'blood_ritual_sacrifice': {
        if (targetSlot !== undefined && myBoard[targetSlot]) {
          const sac = myBoard[targetSlot]!;
          const sacLife = Math.min(32, sac.currentLife);
          sac.isDestroyed = true;
          sac.currentLife = 0;
          const aoe = spellDmg(sacLife);
          opposingBoard.forEach((c, idx) => {
            if (c && !c.spellImmune) {
              c.currentLife -= aoe;
              this.triggerDamage(opposingSide, idx, aoe);
            }
          });
          this.log(`【${card.nameCn}】献祭【${sac.card.nameCn}】，将其 ${sacLife} 点鲜血化为红莲业火毁灭敌全场！`, 'damage');
        }
        break;
      }
      case 'divine_justice_heal_12_blast': {
        if (targetSlot !== undefined && myBoard[targetSlot]) {
          myBoard[targetSlot]!.currentLife = Math.min(myBoard[targetSlot]!.maxLife, myBoard[targetSlot]!.currentLife + 12);
          this.triggerHeal(who, targetSlot, 12);
        }
        const blast = spellDmg(12);
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !(c.owner === who && c.slotIndex === targetSlot) && !c.spellImmune) {
            c.currentLife -= blast;
            this.triggerDamage(c.owner, c.slotIndex, blast);
          }
        });
        this.log(`【${card.nameCn}】圣疗目标 12 点生命，神裁轰击全场其它生物造成 12 点圣火暴击！`, 'damage');
        break;
      }
      case 'divine_meddling': {
        ['fire', 'water', 'air', 'earth'].forEach((e) => {
          actor.mana[e as ElementType] += 2;
        });
        const dmg = spellDmg(10);
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        sound.play('divinemeddling');
        this.log(`【${card.nameCn}】神意干预，施法者火、水、气、土能量各 +2，并对 ${opponent.name} 造成 ${dmg} 点神圣惩戒！`, 'damage');
        break;
      }
      case 'rage_of_god': {
        const dmg = spellDmg(12);
        let survivedCount = 0;
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
            if (c.currentLife > 0) survivedCount++;
          }
        });
        const extra = survivedCount * 3;
        if (extra > 0) {
          opponent.hp -= extra;
          this.triggerDamage(opposingSide, 'hero', extra);
        }
        sound.play('rageofgod');
        this.log(`【${card.nameCn}】神怒天罚，对敌方全场造成 ${dmg} 点伤害，${survivedCount} 个幸存者使 ${opponent.name} 再受 ${extra} 点神罚！`, 'damage');
        break;
      }
      case 'divine_intervention_boost': {
        ['fire', 'water', 'air', 'earth'].forEach((e) => {
          actor.mana[e as ElementType] += 2;
        });
        actor.hp = Math.min(actor.maxHp, actor.hp + 10);
        this.triggerHeal(who, 'hero', 10);
        this.log(`【${card.nameCn}】四系能量各 +2，并为 ${actor.name} 恢复 10 点神圣生命！`, 'heal');
        break;
      }
      case 'cannonade_19': {
        const dmg = spellDmg(19);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
          }
        });
        this.log(`【${card.nameCn}】基地重炮全屏覆盖轰击，对敌方全场生物造成 ${dmg} 点毁灭伤害！`, 'damage');
        break;
      }
      case 'weakness_curse': {
        (['fire', 'water', 'air', 'earth', opponent.specialElement] as ElementType[]).forEach((e) => {
          opponent.mana[e] = Math.max(0, opponent.mana[e] - 1);
        });
        opponent.hp -= 3;
        this.triggerDamage(opposingSide, 'hero', 3);
        this.log(`【${card.nameCn}】夺取敌方全系能量各 1 点，并对 ${opponent.name} 造成 3 点精神重击！`, 'damage');
        break;
      }
      case 'doom_bolt_25': {
        const validTargets: number[] = [];
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) validTargets.push(idx);
        });
        if (validTargets.length > 0) {
          const tIdx = validTargets[Math.floor(Math.random() * validTargets.length)];
          const dmg = spellDmg(25);
          opposingBoard[tIdx]!.currentLife -= dmg;
          this.triggerDamage(opposingSide, tIdx, dmg);
          this.log(`【${card.nameCn}】混沌裂空，对敌方【${opposingBoard[tIdx]!.card.nameCn}】造成 ${dmg} 点秒杀级伤害！`, 'damage');
        }
        break;
      }
      case 'chaotic_wave_effect': {
        const dmgRoll = Math.floor(Math.random() * 11) + 2;
        const healRoll = Math.floor(Math.random() * 11) + 2;
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmgRoll;
            this.triggerDamage(opposingSide, idx, dmgRoll);
          }
        });
        myBoard.forEach((c, idx) => {
          if (c) {
            c.currentLife = Math.min(c.maxLife, c.currentLife + healRoll);
            this.triggerHeal(who, idx, healRoll);
          }
        });
        this.log(`【${card.nameCn}】潮汐翻涌，对敌全军造成 ${dmgRoll} 点伤害，为友军恢复 ${healRoll} 点生命！`, 'damage');
        break;
      }
      case 'madness_attack_damage': {
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= c.currentAttack;
            this.triggerDamage(opposingSide, idx, c.currentAttack);
          }
        });
        this.log(`【${card.nameCn}】操控心智，敌方所有生物受到等同于自身攻击力的反噬伤害！`, 'damage');
        break;
      }
      case 'demon_explosion_28': {
        if (targetSlot !== undefined && myBoard[targetSlot]) {
          myBoard[targetSlot]!.isDestroyed = true;
          myBoard[targetSlot]!.currentLife = 0;
          const opp = opposingBoard[targetSlot];
          if (opp && !opp.spellImmune) {
            opp.currentLife -= 28;
            this.triggerDamage(opposingSide, targetSlot, 28);
          }
          this.log(`【${card.nameCn}】轰然解体，对对格敌军造成 28 点巨额殉爆伤害！`, 'damage');
        }
        break;
      }
      case 'time_stop_freeze': {
        sound.play('lightning');
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 4;
            this.triggerDamage(opposingSide, idx, 4);
          }
        });
        this.skipNextTurn[opposingSide] = true;
        this.log(`【${card.nameCn}】时空静止，敌军全员受到 4 点时空震荡，强制跳过下一个出牌回合！`, 'damage');
        break;
      }
      case 'army_of_rats_12': {
        sound.play('rats');
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 12;
            this.triggerDamage(opposingSide, idx, 12);
          }
        });
        const friendlyIndices: number[] = [];
        myBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) friendlyIndices.push(idx);
        });
        if (friendlyIndices.length > 0) {
          const randIdx = friendlyIndices[Math.floor(Math.random() * friendlyIndices.length)];
          myBoard[randIdx]!.currentLife -= 12;
          this.triggerDamage(who, randIdx, 12);
        }
        this.log(`【${card.nameCn}】疯狂鼠群肆虐，对敌方全员造成 12 点伤害！`, 'damage');
        break;
      }
      case 'armageddon': {
        const base = 8 + manaRef.fire;
        const dmg = spellDmg(base);
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(c.owner, c.slotIndex, dmg);
          }
        });
        sound.play('armageddon');
        this.log(`【${card.nameCn}】末日降临，对全场所有生物和 ${opponent.name} 造成 ${dmg} 点毁灭伤害！`, 'damage');
        break;
      }
      case 'tornado_destroy': {
        if (targetSlot !== undefined && opposingBoard[targetSlot]) {
          const t = opposingBoard[targetSlot]!;
          if (!t.spellImmune) {
            t.isDestroyed = true;
            t.currentLife = 0;
            this.triggerDamage(opposingSide, targetSlot, 999);
            sound.play('tornado');
            this.log(`【${card.nameCn}】狂暴旋风将敌方【${t.card.nameCn}】直接卷入虚空消灭！`, 'damage');
          }
        }
        break;
      }
      case 'natures_fury': {
        const attacks: number[] = [];
        myBoard.forEach((c) => {
          if (c && c.currentAttack > 0) attacks.push(c.currentAttack);
        });
        attacks.sort((a, b) => b - a);
        const totalAtk = (attacks[0] || 0) + (attacks[1] || 0);
        const dmg = spellDmg(totalAtk);
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        sound.play('naturalfury');
        this.log(`【${card.nameCn}】汇聚全场至强力量，对 ${opponent.name} 造成 ${dmg} 点自然咆哮伤害！`, 'damage');
        break;
      }
      case 'drain_souls': {
        let killedCount = 0;
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !c.spellImmune) {
            c.isDestroyed = true;
            c.currentLife = 0;
            this.triggerDamage(c.owner, c.slotIndex, 999);
            killedCount++;
          }
        });
        const heal = killedCount * 2;
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        if (heal > 0) this.triggerHeal(who, 'hero', heal);
        const handIdx = actor.hand.findIndex((c) => c.id === 'death_drain_souls');
        if (handIdx !== -1) {
          actor.hand[handIdx] = { ...RAGE_OF_SOULS_CARD };
          this.log(`【灵魂汲取】收割完毕，已转化替代为【灵魂狂怒】！`, 'info');
        }
        sound.play('drainsouls');
        this.log(`【${card.nameCn}】收割灵魂消灭 ${killedCount} 个生物，为 ${actor.name} 恢复 ${heal} 点生命！`, 'damage');
        break;
      }
      case 'rage_of_souls': {
        const dmg = spellDmg(9 + (manaRef.death || 0));
        let killedCount = 0;
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
            if (c.currentLife <= 0) killedCount++;
          }
        });
        const heal = killedCount * 2;
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        if (heal > 0) this.triggerHeal(who, 'hero', heal);
        sound.play('rage_of_souls');
        this.log(`【${card.nameCn}】亡魂狂啸，对敌方全场造成 ${dmg} 点死亡震荡，吞噬 ${killedCount} 个亡魂为 ${actor.name} 恢复 ${heal} 点生命！`, 'damage');
        break;
      }
      case 'wrath_of_god': {
        const dmg = spellDmg(12);
        let survivedCount = 0;
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
            if (c.currentLife > 0) survivedCount++;
          }
        });
        actor.mana.holy = (actor.mana.holy || 0) + survivedCount;
        sound.play('divineintervention');
        this.log(`【${card.nameCn}】神怒天裁对敌全场造成 ${dmg} 点伤害，存活的 ${survivedCount} 个生物使施法者神圣能量 +${survivedCount}！`, 'damage');
        break;
      }
      case 'overtime': {
        actor.mana.mechanics = (actor.mana.mechanics || 0) + 1;
        sound.play('overtime');
        this.log(`【${card.nameCn}】连夜赶制工坊轰鸣，机械系能量 +1！`, 'heal');
        break;
      }
      case 'hypnosis': {
        const enemies = opposingBoard
          .filter((c): c is BoardCreature => c !== null && !c.spellImmune && c.currentAttack > 0)
          .sort((a, b) => b.currentAttack - a.currentAttack)
          .slice(0, 2);
        let totalDmg = 0;
        enemies.forEach((c) => {
          totalDmg += c.currentAttack;
          this.triggerDamage(opposingSide, 'hero', c.currentAttack);
          this.log(`【${c.card.nameCn}】受到催眠心智反噬，转头痛击 ${opponent.name} 造成 ${c.currentAttack} 点伤害！`, 'damage');
        });
        opponent.hp -= totalDmg;
        sound.play('hypnosys');
        break;
      }
      case 'poisonous_cloud': {
        (['fire', 'water', 'air', 'earth', opponent.specialElement] as ElementType[]).forEach((e) => {
          opponent.mana[e] = Math.max(0, opponent.mana[e] - 1);
        });
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            const dmg = Math.ceil(c.currentLife * 0.5);
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
          }
        });
        sound.play('poisoncloud');
        this.log(`【${card.nameCn}】剧毒之云笼罩，敌方各系能量 -1，并对敌全场生物造成现存生命 50% 的剧毒重创！`, 'damage');
        break;
      }
      case 'demon_power_chains_12': {
        if (targetSlot !== undefined && opposingBoard[targetSlot]) {
          const t = opposingBoard[targetSlot]!;
          if (this.isValidSpellTarget(card, t)) {
            const dmg = spellDmg(12);
            t.currentLife -= dmg;
            this.triggerDamage(opposingSide, targetSlot, dmg);
            const targetElem = t.card.element;
            if (targetElem in opponent.mana) {
              opponent.mana[targetElem] = Math.max(0, opponent.mana[targetElem] - 3);
            }
            sound.play('boom');
            this.log(`【${card.nameCn}】锁链缠绕敌方【${t.card.nameCn}】造成 ${dmg} 点伤害，并封印其 ${targetElem.toUpperCase()} 能量 3 点！`, 'damage');
          }
        }
        break;
      }
      case 'demon_hellfire_13': {
        const dmg = spellDmg(13);
        let killedCount = 0;
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
            if (c.currentLife <= 0) killedCount++;
          }
        });
        actor.mana.fire = (actor.mana.fire || 0) + killedCount;
        sound.play('hellfire');
        this.log(`【${card.nameCn}】炼狱之火对敌全场造成 ${dmg} 点伤害，焚化 ${killedCount} 个生物转化施法者火系能量 +${killedCount}！`, 'damage');
        break;
      }
      case 'sorcery_sacrifice': {
        if (targetSlot !== undefined && myBoard[targetSlot]) {
          const sac = myBoard[targetSlot]!;
          sac.isDestroyed = true;
          sac.currentLife = 0;
          this.triggerDamage(who, targetSlot, 999);
          ['fire', 'water', 'air', 'earth'].forEach((e) => {
            actor.mana[e as ElementType] = (actor.mana[e as ElementType] || 0) + 3;
          });
          sound.play('sacrifice');
          this.log(`【${card.nameCn}】献祭友方【${sac.card.nameCn}】，施法者火、水、气、土能量各 +3！`, 'heal');
        }
        break;
      }
      case 'sonic_boom': {
        const dmg = spellDmg(11);
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            c.skipNextAttack = true;
            c.canAttack = false;
            this.triggerDamage(opposingSide, idx, dmg);
          }
        });
        sound.play('sonic_boom');
        this.log(`【${card.nameCn}】震荡音波重创敌方英雄及全场生物 ${dmg} 点伤害，并使其震晕跳过下轮攻击！`, 'damage');
        break;
      }
      case 'goblin_rescue_heal_5': {
        // PC: the target may be any creature; it is only healed when it belongs to the caster.
        const rescueBoard = targetSlot !== undefined && myBoard[targetSlot] ? myBoard : opposingBoard;
        const rescueFriendly = rescueBoard === myBoard;
        if (targetSlot !== undefined && rescueBoard[targetSlot]) {
          const t = rescueBoard[targetSlot]!;
          if (rescueFriendly) {
            t.currentLife = Math.min(t.maxLife, t.currentLife + 5);
            this.triggerHeal(who, targetSlot, 5);
          }
          const emptyIndices: number[] = [];
          rescueBoard.forEach((slot, idx) => {
            if (slot === null && idx !== targetSlot) emptyIndices.push(idx);
          });
          if (emptyIndices.length > 0) {
            const newSlot = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            rescueBoard[newSlot] = t;
            rescueBoard[targetSlot] = null;
            t.slotIndex = newSlot;
            this.log(`【${card.nameCn}】救援撤离【${t.card.nameCn}】至 [${newSlot + 1}号位${rescueFriendly ? '，并为其恢复 5 点生命' : ''}！`, rescueFriendly ? 'heal' : 'info');
          } else {
            this.log(`【${card.nameCn}】为【${t.card.nameCn}】恢复 5 点生命！`, 'heal');
          }
          sound.play('heal');
        }
        break;
      }
      case 'haste_creature_extra_attack': {
        if (targetSlot !== undefined && myBoard[targetSlot]) {
          const t = myBoard[targetSlot]!;
          if (t.currentAttack <= 9 && t.currentAttack > 0) {
            const atk = t.currentAttack;
            opponent.hp -= atk;
            this.triggerDamage(opposingSide, 'hero', atk);
            opposingBoard.forEach((c, idx) => {
              if (c && !c.spellImmune) {
                c.currentLife -= atk;
                this.triggerDamage(opposingSide, idx, atk);
              }
            });
            sound.play('hasten');
            this.log(`【${card.nameCn}】时空加速！【${t.card.nameCn}】瞬影横扫，对敌方全军及英雄各造成 ${atk} 点突袭重击！`, 'attack');
          }
        }
        break;
      }
      // PC Ritual of the Forest: "heals X+5 life to its caster and to each of its caster's
      // creatures where X is equal to the attack of Magic Rabbit."
      case 'forest_ritual_heal': {
        const rabbitAtk = this.ownRabbitAttack(who);
        const healAmt = rabbitAtk + 5;
        actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
        this.triggerHeal(who, 'hero', healAmt);
        myBoard.forEach((c, idx) => {
          if (c) {
            c.currentLife = Math.min(c.maxLife, c.currentLife + healAmt);
            this.triggerHeal(who, idx, healAmt);
          }
        });
        this.log(`【${card.nameCn}】古林回响，为 ${actor.name} 及己方所有生物各恢复 ${healAmt} 点生命（X=${rabbitAtk}）！`, 'heal');
        break;
      }

      // ---------- Golem Master (魔匠) discipline ----------
      // PC Golem's Frenzy: "deals 3 damage to each of the opponent's creatures. For each
      // creature killed by this spell, Golem's attack is increased by 3 until end of turn."
      case 'golems_frenzy_3': {
        const dmg = spellDmg(3);
        let killed = 0;
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
            if (c.currentLife <= 0) killed++;
          }
        });
        if (killed > 0) {
          actor.golemTempAttackBonus = (actor.golemTempAttackBonus || 0) + killed * 3;
          this.recalculateBoardStats();
        }
        this.log(`【${card.nameCn}】对敌方全场造成 ${dmg} 点伤害，碾碎 ${killed} 个生物使【魔像】本回合攻击 +${killed * 3}！`, 'damage');
        break;
      }
      // PC Golem's Justice: "deals 4 damage to each of the opponent's creatures, then heals 4
      // life to Golem's neighbours."
      case 'golems_justice_4': {
        const dmg = spellDmg(4);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
          }
        });
        const golemSlot = myBoard.findIndex((c) => c !== null && c.card.id === 'golem_golem');
        if (golemSlot !== -1) {
          [golemSlot - 1, golemSlot + 1].forEach((nIdx) => {
            if (nIdx >= 0 && nIdx < myBoard.length && myBoard[nIdx]) {
              myBoard[nIdx]!.currentLife = Math.min(myBoard[nIdx]!.maxLife, myBoard[nIdx]!.currentLife + 4);
              this.triggerHeal(who, nIdx, 4);
            }
          });
        }
        this.log(`【${card.nameCn}】对敌方全场造成 ${dmg} 点伤害，并为【魔像】的邻格生物各回复 4 点生命！`, 'damage');
        break;
      }
      // PC Army Upgrade: "heals 3 life to each of its caster's creatures. Golem's attack is
      // increased by 2 permanently; this bonus remains even after Golem is killed."
      case 'army_upgrade': {
        myBoard.forEach((c, idx) => {
          if (c) {
            c.currentLife = Math.min(c.maxLife, c.currentLife + 3);
            this.triggerHeal(who, idx, 3);
          }
        });
        actor.golemAttackBonus = (actor.golemAttackBonus || 0) + 2;
        this.recalculateBoardStats();
        this.log(`【${card.nameCn}】己方全员回复 3 点生命，【魔像】攻击力永久 +2（累计 +${actor.golemAttackBonus}）！`, 'heal');
        break;
      }

      // ---------- Cult (邪教) discipline ----------
      // PC Call to Ancient Spirits: "deals 10 damage to each of the opponent's creatures, then
      // deals 5 damage to each of its caster's creatures."
      case 'call_to_ancient_spirits': {
        const spiritDmg = spellDmg(10);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= spiritDmg;
            this.triggerDamage(opposingSide, idx, spiritDmg);
          }
        });
        myBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 5;
            this.triggerDamage(who, idx, 5);
          }
        });
        this.log(`【${card.nameCn}】古灵咆哮，对敌方全场造成 ${spiritDmg} 点伤害，己方生物亦被余波波及各 5 点！`, 'damage');
        break;
      }

      // ---------- Blood (鲜血) discipline ----------
      // PC Blood Boil: "deals 4 damage to each of the opponent's creatures, then increases its
      // owner's Blood power by 1 for each creature killed by this spell."
      case 'blood_boil_4': {
        const dmg = spellDmg(4);
        let boiled = 0;
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(opposingSide, idx, dmg);
            if (c.currentLife <= 0) boiled++;
          }
        });
        if (boiled > 0) actor.mana.special = (actor.mana.special || 0) + boiled;
        this.log(`【${card.nameCn}】血沸爆裂，对敌方全场造成 ${dmg} 点伤害，${boiled} 个生物化作 ${boiled} 点鲜血系能量！`, 'damage');
        break;
      }
    }
  }

  // PC Mad Hermit passive class ability: "At the end of Mad Hermit's turn, that player puts
  // Magic Rabbit into a random empty slot as a passive class ability, as long as there is no
  // Magic Rabbit in play."
  private triggerClassEndOfTurn(who: 'player' | 'enemy'): void {
    const actor = who === 'player' ? this.player : this.enemy;
    if (actor.className !== 'forest') return;
    if (this.isMagicRabbitInPlay()) return;

    const board = who === 'player' ? this.playerBoard : this.enemyBoard;
    const emptySlots: number[] = [];
    board.forEach((c, idx) => {
      if (c === null) emptySlots.push(idx);
    });
    if (emptySlots.length === 0) return;

    const slotIndex = emptySlots[Math.floor(Math.random() * emptySlots.length)];
    const rabbit = this.spawnToken(who, 'forest_magic_rabbit', slotIndex);
    if (!rabbit) return;

    this.lastSummonedUid = rabbit.uid;
    sound.play('positiveeffect');
    this.log(`被动技能：【疯狂隐士】在 [${slotIndex + 1}号位] 放置了一只【魔法兔子】！`, 'summon');
    if (this.onCreatureAppear) this.onCreatureAppear(who, slotIndex, rabbit.card);
    setTimeout(() => {
      if (this.lastSummonedUid === rabbit.uid) this.lastSummonedUid = null;
    }, 700);
  }

  // PC Gathering-of-Power neutrals that move themselves (or change sides) at the end of their
  // owner's turn: Nettling Faerie, Marching/Wandering/Toothed Stone, Niggling Imp, Merfolk
  // Revolutionary. Called from executeCombat() before the class passive.
  private triggerEndOfTurnCreatures(who: 'player' | 'enemy'): void {
    const board = who === 'player' ? this.playerBoard : this.enemyBoard;
    const actor = who === 'player' ? this.player : this.enemy;
    const opponent = who === 'player' ? this.enemy : this.player;

    // Snapshot first: the loop mutates the board.
    const movers = board
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => c !== null);

    movers.forEach(({ c, idx }) => {
      if (!c || board[idx] !== c) return;
      const ability = c.card.ability;

      const swapWith = (target: number) => {
        if (target < 0 || target >= board.length || target === idx) return false;
        const other = board[target];
        board[target] = c;
        c.slotIndex = target;
        board[idx] = other;
        if (other) other.slotIndex = idx;
        return true;
      };

      if (ability === 'faerie_shift' || ability === 'niggling_imp') {
        // "moves to a random slot" / "moves to a random empty slot"
        const empty: number[] = [];
        board.forEach((slot, sIdx) => {
          if (slot === null) empty.push(sIdx);
        });
        if (empty.length > 0) {
          const target = empty[Math.floor(Math.random() * empty.length)];
          board[target] = c;
          c.slotIndex = target;
          board[idx] = null;
          sound.play('move_falcon');
          this.log(`【${c.card.nameCn}】飘忽不定，位移至 [${target + 1}号位]！`, 'heal');
        }
      } else if (ability === 'stone_march_right' || ability === 'stone_march_right_no_creature') {
        if (swapWith(idx + 1)) {
          sound.play('move_falcon');
          this.log(`【${c.card.nameCn}】轰隆前行，移动到 [${idx + 2}号位]！`, 'heal');
        }
      } else if (ability === 'stone_wander') {
        const target = Math.floor(Math.random() * board.length);
        if (swapWith(target)) {
          sound.play('move_falcon');
          this.log(`【${c.card.nameCn}】随机漂移，移动到 [${target + 1}号位]！`, 'heal');
        }
      } else if (ability === 'merfolk_revolution') {
        // "moves to the player with lower life"
        const targetBoard = actor.hp <= opponent.hp ? board : (who === 'player' ? this.enemyBoard : this.playerBoard);
        if (targetBoard !== board) {
          const empty: number[] = [];
          targetBoard.forEach((slot, sIdx) => {
            if (slot === null) empty.push(sIdx);
          });
          if (empty.length > 0) {
            const target = empty[Math.floor(Math.random() * empty.length)];
            board[idx] = null;
            // A creature changing sides keeps its stats but must re-learn whose turn it is.
            c.owner = who === 'player' ? 'enemy' : 'player';
            c.slotIndex = target;
            c.canAttack = false;
            targetBoard[target] = c;
            sound.play('move_falcon');
            this.log(`【${c.card.nameCn}】倒戈投向生命较低的一方（${targetBoard === this.playerBoard ? this.player.name : this.enemy.name}）！`, 'damage');
          }
        }
      }
    });
  }

  public async passTurn(who: 'player' | 'enemy'): Promise<void> {
    if (this.gameOver || this.activeTurn !== who || this.isCombatPhase) return;
    const actor = who === 'player' ? this.player : this.enemy;
    this.log(`${actor.name} 选择了跳过本轮出牌。`, 'info');

    // Chrono Engine +1 special mana on pass
    const myBoard = who === 'player' ? this.playerBoard : this.enemyBoard;
    myBoard.forEach((c) => {
      if (c && c.card.ability === 'chrono_engine') {
        actor.mana.special = (actor.mana.special || 0) + 1;
        sound.play('positiveeffect');
        this.log(`【${c.card.nameCn}】监测到跳轮，拥有者时间系能量 +1！`, 'heal');
      }
    });
    this.extraActionRemaining[who] = 0;
    this.extraSpellOnly[who] = false;

    this.replaySteps.push({
      turn: this.turnCount,
      side: who,
      action: 'pass',
      desc: `${actor.name} 跳过出牌`,
      playerHp: this.player.hp,
      enemyHp: this.enemy.hp,
      playerMana: { ...this.player.mana },
      enemyMana: { ...this.enemy.mana },
      playerBoard: this.cloneBoard(this.playerBoard),
      enemyBoard: this.cloneBoard(this.enemyBoard),
    });

    await this.executeCombat(who);
  }

  public async executeCombat(attackerSide: 'player' | 'enemy'): Promise<void> {
    this.isCombatPhase = true;
    this.notify();

    const attackerBoard = attackerSide === 'player' ? this.playerBoard : this.enemyBoard;
    const defenderSide = attackerSide === 'player' ? 'enemy' : 'player';
    const defenderBoard = attackerSide === 'player' ? this.enemyBoard : this.playerBoard;
    const defenderHero = attackerSide === 'player' ? this.enemy : this.player;

    // Attack order: Priestess of Moments ("double_attack_all_swift") performs an additional
    // attack in each of its owner's turns, so its slot is queued twice. PC Golem Handler grants
    // the champion Golem an extra attack in the same way, and PC Monument to Rage grants every
    // creature its owner controls one.
    const hasGolemHandler = attackerBoard.some(
      (c) => c !== null && c.card.ability === 'golem_handler_extra_attack'
    );
    const hasMonumentToRage = attackerBoard.some(
      (c) => c !== null && c.card.ability === 'monument_to_rage'
    );
    const attackQueue: number[] = [];
    for (let slot = 0; slot < attackerBoard.length; slot++) {
      attackQueue.push(slot);
      const queued = attackerBoard[slot];
      if (queued && queued.card.ability === 'double_attack_all_swift') attackQueue.push(slot);
      if (queued && hasGolemHandler && queued.card.id === 'golem_golem') attackQueue.push(slot);
      if (queued && hasMonumentToRage) attackQueue.push(slot);
    }

    for (const slot of attackQueue) {
      const attacker = attackerBoard[slot];
      if (!attacker || attacker.currentAttack <= 0 || !attacker.canAttack) continue;

      // Ancient Horror check on defending side
      let hasHorror = false;
      defenderBoard.forEach((d) => {
        if (d && d.card.ability === 'horror_fear_aura') hasHorror = true;
      });
      if (hasHorror && attacker.card.cost < (defenderHero.mana.control || 0)) {
        this.log(`受到【远古惧像】威慑，【${attacker.card.nameCn}】费用过低恐惧战栗跳过攻击！`, 'info');
        continue;
      }

      const directHero = !!attacker.directHeroAttackTurn;
      const defender = directHero ? null : defenderBoard[slot];

      // PC Guardian Statue: "receives no damage until it performs its first attack."
      attacker.hasAttacked = true;

      // 1. Trigger lunge animation callback
      if (this.onAttackLunge) {
        this.onAttackLunge(attackerSide, slot);
      }
      sound.play('attack');
      await this.delay(500);

      // Hellbot: attacks the opposing slot and its two neighbours; when all three lanes are
      // empty it deals triple damage to the opponent instead.
      if (attacker.card.ability === 'hellbot_triple') {
        const lanes = [slot - 1, slot, slot + 1].filter((i) => i >= 0 && i < defenderBoard.length);
        const occupied = lanes.filter((i) => defenderBoard[i] !== null);
        if (occupied.length === 0) {
          const triple = attacker.currentAttack * 3;
          defenderHero.hp -= triple;
          this.triggerDamage(defenderSide, 'hero', triple);
          this.onAttackDamageDealt(attackerSide, attacker, triple);
          this.log(`【${attacker.card.nameCn}】三路突进无人可挡，对 ${defenderHero.name} 造成 ${triple} 点三倍重创！`, 'attack');
        } else {
          occupied.forEach((i) => {
            const t = defenderBoard[i]!;
            let dmg = attacker.currentAttack;
            if (t.card.ability === 'shield_to_1') dmg = 1;
            else if (t.card.ability === 'armor_5') dmg = Math.max(0, dmg - 5);
            else if (t.card.ability === 'armor_1') dmg = Math.max(0, dmg - 1);
            t.currentLife -= dmg;
            this.triggerDamage(defenderSide, i, dmg);
            this.onAttackDamageDealt(attackerSide, attacker, dmg);
            this.log(`【${attacker.card.nameCn}】扫射 [${i + 1}号位]【${t.card.nameCn}】，造成 ${dmg} 点伤害！`, 'attack');
          });
        }
        if (this.onCardImpact) this.onCardImpact(defenderSide, slot);
        this.cleanupDead();
        this.notify();
        await this.delay(750);
        continue;
      }

      // 2. Deliver damage
      const isCleave = attacker.card.ability === 'cleave_all_enemies' || attacker.card.ability === 'air_spirit_swarm'
        // PC Astral Drake / Phoenix Hydra: "its attack damages opponent and each of opponent's creatures"
        || attacker.card.ability === 'attack_equal_lowest_power' || attacker.card.ability === 'phoenix_hydra_rebirth';

      if (defender) {
        let dmg = attacker.currentAttack;

        // PC Toothed Stone: "deals no damage to creatures" — it only ever hits the opposing hero.
        if (attacker.card.ability === 'stone_march_right_no_creature') {
          dmg = 0;
        }

        // Damage mitigation
        if (defender.card.ability === 'shield_to_1') {
          dmg = 1;
        } else if (defender.card.ability === 'armor_5') {
          dmg = Math.max(0, dmg - 5);
        } else if (defender.card.ability === 'armor_1') {
          dmg = Math.max(0, dmg - 1);
        }

        // Neighbor armor (Holy Guard: -2 neighbor damage)
        [slot - 1, slot + 1].forEach((nIdx) => {
          if (nIdx >= 0 && nIdx < defenderBoard.length && defenderBoard[nIdx]?.card.ability === 'neighbor_armor_2') {
            dmg = Math.max(0, dmg - 2);
          }
        });

        // Mindstealer: attacker damages itself
        if (defender.card.ability === 'mindsteal_self_damage') {
          attacker.currentLife -= attacker.currentAttack;
          this.triggerDamage(attackerSide, slot, attacker.currentAttack);
          this.log(`【窃心魔】心智操纵，令【${attacker.card.nameCn}】攻击自身受到 ${attacker.currentAttack} 点反噬伤害！`, 'damage');
        } else {
          const lifeBeforeHit = defender.currentLife;
          defender.currentLife -= dmg;
          this.triggerDamage(defenderSide, slot, dmg);
          this.onAttackDamageDealt(attackerSide, attacker, dmg);
          this.log(`【${attacker.card.nameCn}】重击【${defender.card.nameCn}】，造成 ${dmg} 点伤害！`, 'attack');

          // Wall of Reflection — PC: reflects an equal amount, but never more than the life it lost
          if (defender.card.ability === 'reflect_to_hero') {
            const attackerHero = attackerSide === 'player' ? this.player : this.enemy;
            const reflected = Math.max(0, Math.min(dmg, lifeBeforeHit));
            attackerHero.hp -= reflected;
            this.triggerDamage(attackerSide, 'hero', reflected);
            this.log(`【${defender.card.nameCn}】神镜反弹，将 ${reflected} 点伤害如实折射至 ${attackerHero.name}！`, 'damage');
          }

          // Vampirism
          if (attacker.card.ability === 'vampirism') {
            attacker.currentLife = Math.min(attacker.maxLife, attacker.currentLife + dmg);
            this.triggerHeal(attackerSide, slot, dmg);
          }

          // PC Mine: "When Mine is damaged by a creature the creature suffers 12 damage and the
          // Mine is destroyed."
          if (defender.card.ability === 'mine_invisible' && dmg > 0) {
            attacker.currentLife -= 12;
            this.triggerDamage(attackerSide, slot, 12);
            defender.isDestroyed = true;
            defender.currentLife = 0;
            sound.play('boom');
            this.log(`【${defender.card.nameCn}】轰然引爆，将【${attacker.card.nameCn}】炸成重伤（12 点）！`, 'damage');
          }

        }
      } else {
        let heroDmg = attacker.currentAttack;

        // PC Meatgrinder: "does no damage to players."
        if (attacker.card.ability === 'meatgrinder_no_hero') heroDmg = 0;

        // Ice Guard hero reduction
        let hasIceGuard = false;
        defenderBoard.forEach((c) => {
          if (c && c.card.ability === 'hero_shield_half') hasIceGuard = true;
        });
        if (hasIceGuard) {
          heroDmg = Math.ceil(heroDmg * 0.5);
        }

        // White Elephant redirect
        let elephantSlot: number = -1;
        defenderBoard.forEach((c, idx) => {
          if (c && c.card.ability === 'elephant_shield_hero') elephantSlot = idx;
        });

        if (elephantSlot !== -1 && defenderBoard[elephantSlot]) {
          const elephant = defenderBoard[elephantSlot]!;
          elephant.currentLife -= heroDmg;
          this.triggerDamage(defenderSide, elephantSlot, heroDmg);
          this.onAttackDamageDealt(attackerSide, attacker, heroDmg);
          this.log(`【${elephant.card.nameCn}】舍身庇佑，代替 ${defenderHero.name} 承担了 ${heroDmg} 点直接伤害！`, 'heal');
        } else {
          defenderHero.hp -= heroDmg;
          this.triggerDamage(defenderSide, 'hero', heroDmg);
          this.onAttackDamageDealt(attackerSide, attacker, heroDmg);
          this.log(`【${attacker.card.nameCn}】直入中军，对 ${defenderHero.name} 造成 ${heroDmg} 点打击伤害！`, 'attack');

          if (attacker.card.ability === 'lich_power_drain') {
            const attackerHeroObj = attackerSide === 'player' ? this.player : this.enemy;
            attackerHeroObj.mana.death = (attackerHeroObj.mana.death || 0) + 2;
            this.log(`【巫妖王】吸取死灵精粹，死灵能量 +2！`, 'heal');
          }

          if (attacker.card.ability === 'goblin_burn_card') {
            const elems: ElementType[] = ['fire', 'water', 'air', 'earth', defenderHero.specialElement];
            const chosen = elems[Math.floor(Math.random() * elems.length)];
            const candidateCards = defenderHero.hand.filter((c) => {
              if (c.element === chosen) return true;
              if (chosen === defenderHero.specialElement && (c.element === 'special' || c.className === defenderHero.className)) return true;
              return false;
            });
            if (candidateCards.length > 0) {
              candidateCards.sort((a, b) => a.cost - b.cost);
              const cardToBurn = candidateCards[0];
              const cIdx = defenderHero.hand.indexOf(cardToBurn);
              if (cIdx !== -1) {
                defenderHero.hand.splice(cIdx, 1);
                sound.play('boom');
                this.log(`【${attacker.card.nameCn}】突袭破坏，将 ${defenderHero.name} 的【${cardToBurn.nameCn}】(费用 ${cardToBurn.cost}) 永久炸毁销毁！`, 'damage');
              }
            } else {
              this.log(`【${attacker.card.nameCn}】突袭搜寻 ${chosen.toUpperCase()} 系卡牌，但目标手牌中已无可销毁卡牌！`, 'info');
            }
          }
        }
      }

      if (isCleave) {
        // PC: "damages the opponent and each of the opponent's creatures" — the opposing hero
        // is hit as well, even when a defender blocks the slot.
        let cleaveDealt = 0;
        if (defender) {
          this.cleaveHeroDamage(defenderSide, attacker.currentAttack);
          cleaveDealt += attacker.currentAttack;
        }
        defenderBoard.forEach((opp, oIdx) => {
          if (opp && oIdx !== slot) {
            opp.currentLife -= attacker.currentAttack;
            this.triggerDamage(defenderSide, oIdx, attacker.currentAttack);
            cleaveDealt += attacker.currentAttack;
          }
        });
        this.onAttackDamageDealt(attackerSide, attacker, cleaveDealt);
        this.log(`【${attacker.card.nameCn}】横扫全场，对敌方全线生物造成 ${attacker.currentAttack} 点横扫伤害！`, 'attack');
      }

      // 3. Card impact visual
      if (this.onCardImpact) {
        this.onCardImpact(defenderSide, defender ? slot : 'hero');
      }

      // PC Chastiser: its "+2 until after its next attack" is spent by this attack.
      if (attacker.pendingAttackBonus) {
        attacker.currentAttack = Math.max(0, attacker.currentAttack - attacker.pendingAttackBonus);
        attacker.pendingAttackBonus = 0;
      }

      // PC Solid Echo: "dies after its attack."
      if (attacker.card.ability === 'solid_echo_ephemeral') {
        attacker.currentLife = 0;
        attacker.isDestroyed = true;
        this.log(`【${attacker.card.nameCn}】回音消散，攻击后即刻湮灭。`, 'damage');
      }

      // PC Vampiric Cloud: every attack makes it permanently bigger.
      if (attacker.card.ability === 'vampiric_cloud_growth') {
        attacker.baseAttack += 1;
        attacker.currentAttack += 1;
        attacker.maxLife += 2;
        attacker.currentLife += 2;
        this.log(`【${attacker.card.nameCn}】吸血膨胀，攻击 +1、生命上限 +2（现为 ${attacker.currentAttack}/${attacker.maxLife}）！`, 'heal');
      }

      this.cleanupDead();
      this.notify();
      await this.delay(750);
    }

    // Revert temporary buffs & clear turn states
    attackerBoard.forEach((c) => {
      if (!c) return;
      c.directHeroAttackTurn = false;
      if (c.tempAttackBuff) {
        c.currentAttack = Math.max(0, c.currentAttack - c.tempAttackBuff);
        c.tempAttackBuff = 0;
        c.buffedAttack = c.currentAttack > c.baseAttack;
      }
    });

    // Golem's Frenzy / Golem Guide boosts last only until the end of the caster's turn.
    const attackerActor = attackerSide === 'player' ? this.player : this.enemy;
    attackerActor.golemTempAttackBonus = 0;

    // End-of-combat triggers (e.g. Goblin Portal Jumper, Basilisk, King of Chaos)
    attackerBoard.forEach((c, slotIdx) => {
      if (!c) return;

      if (c.card.ability === 'portal_jumper_stun_jump') {
        const opp = defenderBoard[slotIdx];
        if (opp) {
          opp.skipNextAttack = true;
          opp.canAttack = false;
          this.log(`【${c.card.nameCn}】虚空跃迁掷出闪光弹，使对格敌军【${opp.card.nameCn}】致盲跳过下轮攻击！`, 'damage');
        }
        const emptySlots: number[] = [];
        attackerBoard.forEach((s, idx) => {
          if (s === null) emptySlots.push(idx);
        });
        if (emptySlots.length > 0) {
          const newSlot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
          attackerBoard[newSlot] = c;
          attackerBoard[slotIdx] = null;
          c.slotIndex = newSlot;
          this.log(`【${c.card.nameCn}】跃迁移动至 [${newSlot + 1}号位]！`, 'heal');
        }
      }

      if (c.card.ability === 'basilisk_gaze_4') {
        defenderBoard.forEach((opp, oIdx) => {
          if (opp && !opp.spellImmune && opp.currentLife <= 8) {
            opp.currentLife -= 4;
            this.triggerDamage(defenderSide, oIdx, 4);
            this.log(`【巨蜥】石化凝视，对虚弱的【${opp.card.nameCn}】造成 4 点石化重创！`, 'damage');
          }
        });
        sound.play('gaze');
      }

      if (c.card.ability === 'chaos_summon_soldier') {
        const emptySlots: number[] = [];
        attackerBoard.forEach((s, sIdx) => {
          if (s === null) emptySlots.push(sIdx);
        });
        if (emptySlots.length > 0) {
          const spawnIdx = emptySlots[Math.floor(Math.random() * emptySlots.length)];
          // PC: the Chaos Lord's guard is a 4/15 Insanian Soldier (a real Gd.spe entry, field6=0).
          if (this.spawnToken(attackerSide, 'chaos_insanian_soldier', spawnIdx)) {
            sound.play('summon');
            this.log(`【混沌君王】号令全场，召唤了一名【混沌卫兵】(4/15) 入驻 [${spawnIdx + 1}号位]！`, 'summon');
          }
        }
      }
    });

    this.cleanupDead();
    this.checkWinner();
    // End-of-turn passive class ability (Mad Hermit summons Magic Rabbit).
    if (!this.gameOver) {
      this.triggerEndOfTurnCreatures(attackerSide);
      this.triggerClassEndOfTurn(attackerSide);
      this.cleanupDead();
    }
    this.isCombatPhase = false;

    const attackerHero = attackerSide === 'player' ? this.player : this.enemy;
    this.replaySteps.push({
      turn: this.turnCount,
      side: attackerSide,
      action: 'attack_phase',
      desc: `${attackerHero.name} 回合战线攻击结算`,
      playerHp: this.player.hp,
      enemyHp: this.enemy.hp,
      playerMana: { ...this.player.mana },
      enemyMana: { ...this.enemy.mana },
      playerBoard: this.cloneBoard(this.playerBoard),
      enemyBoard: this.cloneBoard(this.enemyBoard),
    });

    if (!this.gameOver) {
      if (attackerSide === 'player') {
        this.startTurn('enemy');
        this.notify();
        if (!this.isLanGame) {
          await this.delay(900);
          await this.triggerAiTurn();
        }
      } else {
        this.turnCount++;
        this.startTurn('player');
        this.notify();
      }
    } else {
      this.notify();
    }
  }

  // Cleave damage (Lightning Cloud, Forest Sprite, Hydra, Three-headed Demon) also reaches the
  // opposing hero; routed through Ice Guard / White Elephant exactly like a direct attack.
  private cleaveHeroDamage(side: 'player' | 'enemy', amount: number) {
    const board = side === 'player' ? this.playerBoard : this.enemyBoard;
    const hero = side === 'player' ? this.player : this.enemy;
    let dmg = amount;
    if (board.some((c) => c && c.card.ability === 'hero_shield_half')) dmg = Math.ceil(dmg * 0.5);
    const elephantSlot = board.findIndex((c) => c && c.card.ability === 'elephant_shield_hero');
    if (elephantSlot !== -1) {
      const elephant = board[elephantSlot]!;
      elephant.currentLife -= dmg;
      this.triggerDamage(side, elephantSlot, dmg);
      this.log(`【${elephant.card.nameCn}】舍身庇佑，代替 ${hero.name} 承担了 ${dmg} 点横扫伤害！`, 'heal');
    } else {
      hero.hp -= dmg;
      this.triggerDamage(side, 'hero', dmg);
    }
  }

  // Every damage source funnels through here right after the caller subtracted the damage, so
  // every redirection/reduction is expressed as "give the damage back". `opts.selfInflicted` marks
  // damage the wounded side caused itself (Zealot / Monument recoil, Cursed Unicorn's own curse,
  // the Blood life payment, the Golem's returning cost): Reaver never takes those over and Justicar
  // never amplifies them. `opts.depth` stops redirect chains.
  private triggerDamage(
    side: 'player' | 'enemy',
    slot: number | 'hero',
    amount: number,
    opts: { depth?: number; selfInflicted?: boolean } = {}
  ) {
    const dealt = this.applyDamageModifiers(side, slot, amount, opts.depth || 0, !!opts.selfInflicted);
    // Fully absorbed or fully redirected damage must not leave a floating "0" behind.
    if (dealt <= 0) return;
    if (slot === 'hero') this.onHeroDamaged(side, dealt);
    else this.onCreatureDamaged(side, slot, dealt);
    if (this.onDamageEffect) {
      this.onDamageEffect(side, slot, dealt);
    }
    if (this.isLanGame && this.isHost && this.onVfxBroadcast) {
      this.onVfxBroadcast({ type: 'damage', payload: { side, slot, amount: dealt } });
    }
  }

  // Single damage-routing pass shared by every "takes less damage" / "takes damage instead" /
  // "takes more damage" passive. Handles:
  //   * PC Guardian Statue    — no damage at all until it performs its first attack
  //   * PC Initiate           — no damage while a Vampire Elder is in play
  //   * PC Cursed Unicorn     — spell damage redirected to the opposite creature
  //   * PC Reaver             — all damage to its owner's other creatures redirected to it
  //   * PC Fanatic            — ×2 damage from the opponent's spells
  //   * PC Justicar           — ×2 damage to the creature facing it; +2 to the opposing hero
  //                             while its own lane is unblocked
  //   * PC Treefolk Protector — -3 damage from the opponent's spells
  private applyDamageModifiers(
    side: 'player' | 'enemy',
    slot: number | 'hero',
    amount: number,
    depth: number,
    selfInflicted: boolean
  ): number {
    // 99/999 sentinels mark destroy effects (Disintegrate, Tornado, Drain Souls), not damage.
    if (amount <= 0 || amount >= 100) return amount;

    const board = side === 'player' ? this.playerBoard : this.enemyBoard;
    const opposingBoard = side === 'player' ? this.enemyBoard : this.playerBoard;
    const opposingSide: 'player' | 'enemy' = side === 'player' ? 'enemy' : 'player';

    // PC Justicar: "While Justicar is unblocked all damage done to the opponent is increased by 2."
    // The bonus is target-based (it amplifies every hit the opposing hero takes while its lane is
    // empty), so it is applied before any absorption.
    if (slot === 'hero' && !selfInflicted) {
      const justicarSlot = opposingBoard.findIndex(
        (c) => c !== null && c.card.ability === 'justicar_judgement'
      );
      if (justicarSlot !== -1 && board[justicarSlot] === null) {
        const hero = side === 'player' ? this.player : this.enemy;
        hero.hp -= 2;
        this.log(`【审判者】无人可挡，对对方本体的伤害 +2！`, 'damage');
        amount += 2;
      }
    }

    if (slot !== 'hero') {
      const warded = board[slot];

      // Guardian Statue: fully immune until its first attack.
      if (warded && warded.card.ability === 'guardian_statue_ward' && !warded.hasAttacked) {
        board[slot]!.currentLife += amount;
        this.log(`【${warded.card.nameCn}】石躯未动，完全抵挡了 ${amount} 点伤害！`, 'heal');
        return 0;
      }

      // Initiate: "While Vampire Elder is in play Initiates receive no damage."
      if (
        warded &&
        warded.card.ability === 'initiate_warded' &&
        board.some((c) => c !== null && c.card.ability === 'vampire_elder_ward')
      ) {
        board[slot]!.currentLife += amount;
        this.log(`【吸血鬼长老】血裔庇护，【${warded.card.nameCn}】完全免疫了 ${amount} 点伤害！`, 'heal');
        return 0;
      }
    }

    const fromOpponentSpell = this.activeSpellCaster !== null && this.activeSpellCaster !== side;

    if (slot !== 'hero') {
      const target = board[slot];
      if (target && !selfInflicted && depth === 0) {
        // Cursed Unicorn: "all spell damage done to Cursed Unicorn is redirected to the opposite
        // creature" — which is the creature blocking it.
        if (fromOpponentSpell && target.card.ability === 'cursed_unicorn_curse') {
          const opposite = opposingBoard[slot];
          if (opposite && !opposite.spellImmune) {
            board[slot]!.currentLife += amount;
            opposite.currentLife -= amount;
            this.log(`【${target.card.nameCn}】以诅咒为媒，将 ${amount} 点魔法伤害转嫁给对格【${opposite.card.nameCn}】！`, 'damage');
            this.triggerDamage(opposingSide, slot, amount, { depth: depth + 1, selfInflicted: true });
            return 0;
          }
        }

        // Reaver: "All damage that would be dealt to its owner's other creatures is redirected to
        // Reaver instead."
        if (target.card.ability !== 'reaver_redirect') {
          const reaverSlot = board.findIndex((c) => c !== null && c.card.ability === 'reaver_redirect');
          if (reaverSlot !== -1 && reaverSlot !== slot) {
            const reaver = board[reaverSlot]!;
            board[slot]!.currentLife += amount;
            reaver.currentLife -= amount;
            this.log(`【${reaver.card.nameCn}】挡在【${target.card.nameCn}】身前，代为承受 ${amount} 点伤害！`, 'damage');
            this.triggerDamage(side, reaverSlot, amount, { depth: depth + 1, selfInflicted: true });
            return 0;
          }
        }
      }

      // Justicar: "The opposing creature receives double damage from all sources."
      if (target) {
        const facing = opposingBoard[slot];
        if (facing && facing.card.ability === 'justicar_judgement') {
          target.currentLife -= amount;
          this.log(`【${target.card.nameCn}】被【审判者】宣判，所受伤害翻倍至 ${amount * 2} 点！`, 'damage');
          return amount * 2;
        }
      }

      // Fanatic: the opponent's spells hurt it twice as much.
      if (fromOpponentSpell && target && target.card.ability === 'fanatic_spell_double') {
        target.currentLife -= amount;
        this.log(`【${target.card.nameCn}】的狂热信仰放大痛楚，魔法伤害翻倍至 ${amount * 2} 点！`, 'damage');
        return amount * 2;
      }
    }

    // Treefolk Protector: only the opponent's spells, only the owner's own side.
    if (!fromOpponentSpell) return amount;

    let reduction = 0;
    board.forEach((c) => {
      if (c && c.card.ability === 'spell_damage_reduce_3') reduction += 3;
    });
    if (reduction <= 0) return amount;

    const absorbed = Math.min(amount, reduction);
    if (slot === 'hero') {
      const hero = side === 'player' ? this.player : this.enemy;
      hero.hp = Math.min(hero.maxHp, hero.hp + absorbed);
    } else if (board[slot]) {
      board[slot]!.currentLife += absorbed;
    } else {
      return amount;
    }
    this.spellAbsorbedThisCast += absorbed;
    return amount - absorbed;
  }

  // PC Zealot / Monument to Rage: both lose life equal to the damage their owner's creatures deal
  // by attacking. Called right after an attacker's damage has been applied.
  private onAttackDamageDealt(side: 'player' | 'enemy', dealer: BoardCreature, amount: number) {
    if (amount <= 0 || this.gameOver) return;
    const board = side === 'player' ? this.playerBoard : this.enemyBoard;

    if (dealer.card.ability === 'zealot_fury_recoil' && board[dealer.slotIndex] === dealer) {
      dealer.currentLife -= amount;
      this.triggerDamage(side, dealer.slotIndex, amount, { selfInflicted: true });
      this.log(`【${dealer.card.nameCn}】狂热反噬，为造成的 ${amount} 点伤害付出等量生命！`, 'damage');
    }

    board.forEach((c, idx) => {
      if (c && c.card.ability === 'monument_to_rage') {
        c.currentLife -= amount;
        this.triggerDamage(side, idx, amount, { selfInflicted: true });
        this.log(`【${c.card.nameCn}】震动共鸣，为 ${dealer.card.nameCn} 造成的 ${amount} 点伤害流失等量生命！`, 'damage');
      }
    });
  }

  // PC Vampire Mystic / Chastiser: both feed on hero damage. The Mystic grows when the *opponent*
  // takes any damage ("attack +2 until end of turn"), the Chastiser when its *owner* does
  // ("attack +2 until after its next attack" — consumed in executeCombat).
  private onHeroDamaged(side: 'player' | 'enemy', amount: number) {
    if (amount <= 0) return;
    const damagedBoard = side === 'player' ? this.playerBoard : this.enemyBoard;
    const otherBoard = side === 'player' ? this.enemyBoard : this.playerBoard;

    otherBoard.forEach((c) => {
      if (c && c.card.ability === 'vampire_mystic_frenzy') {
        c.tempAttackBuff = (c.tempAttackBuff || 0) + 2;
        c.currentAttack += 2;
        sound.play('positiveeffect');
        this.log(`【${c.card.nameCn}】嗅到对方本体的鲜血，本回合攻击 +2（当前 ${c.currentAttack}）！`, 'heal');
      }
    });

    damagedBoard.forEach((c) => {
      if (c && c.card.ability === 'chastiser_wrath') {
        c.pendingAttackBonus = (c.pendingAttackBonus || 0) + 2;
        c.currentAttack += 2;
        sound.play('positiveeffect');
        this.log(`【${c.card.nameCn}】因主人受创而暴怒，攻击 +2（当前 ${c.currentAttack}），此加成在其下次攻击后消失！`, 'heal');
      }
    });
  }

  // PC Angry Angry Bear: "Each time Angry Angry Bear receives damage its attack increases by
  // 1 permanently." Hooked on the same damage choke point so melee, spells and abilities all
  // feed it.
  private onCreatureDamaged(side: 'player' | 'enemy', slot: number | 'hero', amount: number) {
    if (amount <= 0 || slot === 'hero') return;
    const board = side === 'player' ? this.playerBoard : this.enemyBoard;
    const bearer = board[slot];
    if (bearer && bearer.card.ability === 'bear_rage_on_damage') {
      bearer.baseAttack += 1;
      bearer.currentAttack += 1;
      sound.play('positiveeffect');
      this.log(`【${bearer.card.nameCn}】负伤暴怒，攻击力永久 +1（当前 ${bearer.currentAttack}）！`, 'heal');
    }
  }

  private triggerHeal(side: 'player' | 'enemy', slot: number | 'hero', amount: number) {
    if (this.onHealEffect) {
      this.onHealEffect(side, slot, amount);
    }
    if (this.isLanGame && this.isHost && this.onVfxBroadcast) {
      this.onVfxBroadcast({ type: 'heal', payload: { side, slot, amount } });
    }
  }

  private cleanupDead() {
    const checkDeath = (board: (BoardCreature | null)[], who: 'player' | 'enemy') => {
      const actor = who === 'player' ? this.player : this.enemy;
      board.forEach((creature, idx) => {
        if (creature && creature.currentLife <= 0) {
          this.log(`【${creature.card.nameCn}】战死离场。`, 'damage');

          // Death triggers
          if (creature.card.ability === 'demon_lemure_rebirth' && !creature.isDestroyed) {
            board[idx] = {
              ...creature,
              card: {
                id: 'demon_scrambled_lemure',
                element: 'special',
                className: 'demonologist',
                name: 'Scrambled Lemure',
                nameCn: '惊恐劣魔',
                type: 'creature',
                cost: 2,
                attack: 3,
                life: 6,
                image: 'ScrambledLemure',
                desc: '3/6 惊恐劣魔',
                imgUrl: './cards/ScrambledLemure.webp',
                imgBigUrl: './cards/ScrambledLemureBig.webp',
              },
              baseAttack: 3,
              currentAttack: 3,
              currentLife: 6,
              maxLife: 6,
              canAttack: false,
            };
            this.log(`【${creature.card.nameCn}】深渊裂变，重生为【惊恐劣魔】(3/6)！`, 'summon');
            return;
          }

          if (creature.card.ability === 'demon_quartermaster_growth' && !creature.isDestroyed) {
            board[idx] = {
              ...creature,
              card: {
                id: 'demon_enraged_quartermaster',
                element: 'special',
                className: 'demonologist',
                name: 'Enraged Quartermaster',
                nameCn: '暴怒军需官',
                type: 'creature',
                cost: 5,
                attack: 6,
                life: 20,
                image: 'EnragedQuartermaster',
                desc: '6/20 暴怒军需官',
                imgUrl: './cards/EnragedQuartermaster.webp',
                imgBigUrl: './cards/EnragedQuartermasterBig.webp',
              },
              baseAttack: 6,
              currentAttack: 6,
              currentLife: 20,
              maxLife: 20,
              canAttack: false,
            };
            this.log(`【${creature.card.nameCn}】狂怒爆发，在其原位唤醒了【暴怒军需官】(6/20)！`, 'summon');
            return;
          }

          if (creature.card.id === 'demon_three_headed' && !creature.isDestroyed) {
            board[idx] = {
              ...creature,
              card: {
                id: 'demon_apostate',
                element: 'special',
                className: 'demonologist',
                name: 'Demon Apostate',
                nameCn: '恶魔变节者',
                type: 'creature',
                cost: 7,
                attack: 2,
                life: 25,
                image: 'DemonApostate',
                desc: '2/25 恶魔变节者',
                imgUrl: './cards/DemonApostate.webp',
                imgBigUrl: './cards/DemonApostateBig.webp',
              },
              baseAttack: 2,
              currentAttack: 2,
              currentLife: 25,
              maxLife: 25,
              canAttack: false,
            };
            board[idx]!.card.ability = 'demon_apostate_heal_2';
            this.log(`【${creature.card.nameCn}】战死离场，在其原位放置了【恶魔变节者】(2/25)！`, 'summon');
            return;
          }

          if (creature.card.ability === 'holy_power_on_death') {
            actor.mana.holy += 2;
            this.log(`【${creature.card.nameCn}】圆寂升华，圣职能量 +2！`, 'heal');
          }

          if (creature.card.ability === 'demon_drain_all_on_death') {
            const oppHero = who === 'player' ? this.enemy : this.player;
            (['fire', 'water', 'air', 'earth', oppHero.specialElement] as ElementType[]).forEach((e) => {
              oppHero.mana[e] = Math.max(0, oppHero.mana[e] - 1);
            });
            this.log(`【${creature.card.nameCn}】恶果自爆，使对方全系能量各 -1！`, 'damage');
          }

          // Holy Avenger: a neighbouring death permanently raises its attack by 2
          [idx - 1, idx + 1].forEach((nIdx) => {
            if (nIdx < 0 || nIdx >= board.length) return;
            const witness = board[nIdx];
            if (witness && witness.card.ability === 'holy_avenger_mourning') {
              witness.baseAttack += 2;
              sound.play('positiveeffect');
              this.log(`【${witness.card.nameCn}】见证邻格阵亡，悲愤之下攻击力永久 +2！`, 'heal');
            }
          });

          // Keeper of Death & Chrono Hunter kill triggers
          const oppBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
          const oppHero = who === 'player' ? this.enemy : this.player;
          oppBoard.forEach((k) => {
            if (k && k.card.ability === 'death_power_on_kill') {
              oppHero.mana.death = (oppHero.mana.death || 0) + 1;
              this.log(`【${k.card.nameCn}】汲取亡魂，死灵能量 +1！`, 'heal');
            }
            if (k && k.card.ability === 'time_gain_on_kill') {
              oppHero.mana.special = (oppHero.mana.special || 0) + 2;
              this.log(`【${k.card.nameCn}】收割时间猎物，时间系能量 +2！`, 'heal');
            }
          });

          // Goblin Looter: looter_gain_power
          ['player', 'enemy'].forEach((sideKey) => {
            const s = sideKey as 'player' | 'enemy';
            const sBoard = s === 'player' ? this.playerBoard : this.enemyBoard;
            const sHero = s === 'player' ? this.player : this.enemy;
            sBoard.forEach((looter) => {
              if (looter && looter.card.ability === 'looter_gain_power') {
                const elems: ElementType[] = ['fire', 'water', 'air', 'earth', sHero.specialElement];
                const chosen = elems[Math.floor(Math.random() * elems.length)];
                sHero.mana[chosen] = (sHero.mana[chosen] || 0) + 1;
                this.log(`【${looter.card.nameCn}】拾荒搜刮，获得 1 点 ${chosen.toUpperCase()} 能量！`, 'heal');
              }
            });
          });

          // PC Ghoul: "Each time an opponent's creature dies Ghoul's attack increases by 1
          // permanently." — the dead creature's owner's opponent feeds its Ghouls.
          const ghoulBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
          ghoulBoard.forEach((g) => {
            if (g && g.card.ability === 'ghoul_feed') {
              g.baseAttack += 1;
              g.currentAttack += 1;
              sound.play('positiveeffect');
              this.log(`【${g.card.nameCn}】啃食敌方尸体，攻击力永久 +1（当前 ${g.currentAttack}）！`, 'heal');
            }
          });

          // ---------- Gathering of Power neutrals: death triggers ----------
          // PC Jade Statue: 25 damage to each creature.
          if (creature.card.ability === 'jade_statue_burst') {
            const oppSideKey: 'player' | 'enemy' = who === 'player' ? 'enemy' : 'player';
            board.forEach((ally, aIdx) => {
              if (ally && !ally.spellImmune) {
                ally.currentLife -= 25;
                this.triggerDamage(who, aIdx, 25);
              }
            });
            this.opposingBoardOf(board).forEach((opp, oIdx) => {
              if (opp && !opp.spellImmune) {
                opp.currentLife -= 25;
                this.triggerDamage(oppSideKey, oIdx, 25);
              }
            });
            sound.play('boom');
            this.log(`【${creature.card.nameCn}】玉石俱焚，对所有生物造成 25 点粉碎伤害！`, 'damage');
          }

          // PC Ambrosia Stone: "When Ambrosia Stone is destroyed opponent receives 20 life."
          if (creature.card.ability === 'ambrosia_gift') {
            const oppHero = who === 'player' ? this.enemy : this.player;
            oppHero.hp = Math.min(oppHero.maxHp, oppHero.hp + 20);
            this.log(`【${creature.card.nameCn}】碎裂成甘露，为 ${oppHero.name} 回复 20 点生命！`, 'heal');
          }

          // PC Phoenix Hydra: "Each time Phoenix Hydra dies it reborn and its attack permanently
          // increases by 1."
          if (creature.card.ability === 'phoenix_hydra_rebirth' && !creature.isDestroyed) {
            board[idx] = {
              ...creature,
              baseAttack: creature.baseAttack + 1,
              currentAttack: creature.currentAttack + 1,
              currentLife: creature.maxLife,
              canAttack: false,
            };
            sound.play('positiveeffect');
            this.log(`【${creature.card.nameCn}】浴火重生，攻击力永久 +1（现为 ${creature.currentAttack + 1}）！`, 'heal');
            return;
          }

          // PC Starfish chain: 4/16 -> two 4/8 -> two 2/4 -> two 1/2.
          if (
            creature.card.ability === 'starfish_split' ||
            creature.card.ability === 'starfish_split_2' ||
            creature.card.ability === 'starfish_split_3'
          ) {
            const childId = creature.card.ability === 'starfish_split'
              ? 'gop_starfish_2'
              : creature.card.ability === 'starfish_split_2' ? 'gop_starfish_3' : 'gop_starfish_4';
            let born = 0;
            [idx - 1, idx + 1].forEach((nIdx) => {
              if (nIdx >= 0 && nIdx < board.length && board[nIdx] === null) {
                if (this.spawnToken(who, childId, nIdx)) born++;
              }
            });
            if (born === 0) {
              const empty: number[] = [];
              board.forEach((slot, sIdx) => {
                if (slot === null) empty.push(sIdx);
              });
              for (let i = 0; i < 2 && empty.length > 0; i++) {
                const pick = empty.splice(Math.floor(Math.random() * empty.length), 1)[0];
                if (this.spawnToken(who, childId, pick)) born++;
              }
            }
            if (born > 0) {
              sound.play('summon');
              this.log(`【${creature.card.nameCn}】断肢再生，分裂出 ${born} 只更小的【海星】！`, 'summon');
            }
          }

          // PC Hallowed Ground: heals the owner and their creatures by the dying creature's attack.
          const hallowed = board.find((c) => c !== null && c.card.ability === 'hallowed_ground_heal');
          if (hallowed) {
            const healBy = Math.max(0, creature.currentAttack);
            if (healBy > 0) {
              actor.hp = Math.min(actor.maxHp, actor.hp + healBy);
              this.triggerHeal(who, 'hero', healBy);
              board.forEach((ally, aIdx) => {
                if (ally) {
                  ally.currentLife = Math.min(ally.maxLife, ally.currentLife + healBy);
                  this.triggerHeal(who, aIdx, healBy);
                }
              });
              this.log(`【${hallowed.card.nameCn}】圣光回响，使 ${actor.name} 与己方全员回复 ${healBy} 点生命！`, 'heal');
            }
          }

          // PC Cursed Ground: "When any creature dies all creatures in play are dealt damage equal
          // to its power."
          const cursed = board.find((c) => c !== null && c.card.ability === 'cursed_ground_pulse')
            || this.opposingBoardOf(board).find((c) => c !== null && c.card.ability === 'cursed_ground_pulse');
          if (cursed) {
            const power = Math.max(0, creature.currentAttack);
            if (power > 0) {
              const oppSideKey: 'player' | 'enemy' = who === 'player' ? 'enemy' : 'player';
              board.forEach((ally, aIdx) => {
                if (ally && !ally.spellImmune) {
                  ally.currentLife -= power;
                  this.triggerDamage(who, aIdx, power);
                }
              });
              this.opposingBoardOf(board).forEach((opp, oIdx) => {
                if (opp && !opp.spellImmune) {
                  opp.currentLife -= power;
                  this.triggerDamage(oppSideKey, oIdx, power);
                }
              });
              this.log(`【${creature.card.nameCn}】之死引发【${cursed.card.nameCn}】回响，全场生物承受 ${power} 点伤害！`, 'damage');
            }
          }

          // PC Devoted Servant: "When Devoted Servant dies it increases its owner's Blood power by
          // an amount equal to its attack."
          if (creature.card.ability === 'servant_blood_growth') {
            actor.mana.special = (actor.mana.special || 0) + Math.max(0, creature.currentAttack);
            this.log(`【${creature.card.nameCn}】血祭归主，为拥有者补充 ${creature.currentAttack} 点鲜血系能量！`, 'heal');
          }

          // PC Bee Queen / Bee Soldier: "When Bee Queen or a Bee Soldier dies it deals 3
          // damage to the opponent."
          if (creature.card.ability === 'bee_death_3') {
            const beeSide = who === 'player' ? 'enemy' : 'player';
            oppHero.hp -= 3;
            sound.play('negativeeffect');
            this.triggerDamage(beeSide, 'hero', 3);
            this.log(`【${creature.card.nameCn}】殒命反噬，对 ${oppHero.name} 造成 3 点伤害！`, 'damage');
          }

          // PC Golem Master: "When Golem dies Golem is put into another random empty slot (with
          // full life) and its owner loses 10 life."
          if (creature.card.id === 'golem_golem' && !creature.isDestroyed) {
            const otherSlots: number[] = [];
            board.forEach((slot, sIdx) => {
              if (slot === null && sIdx !== idx) otherSlots.push(sIdx);
            });
            // Its own slot is empty by now, so it can always return even if the rest is full.
            const candidates = otherSlots.length > 0 ? otherSlots : [idx];
            const newSlot = candidates[Math.floor(Math.random() * candidates.length)];
            board[idx] = null;
            board[newSlot] = {
              ...creature,
              uid: Math.random().toString(36).substring(2, 9),
              slotIndex: newSlot,
              currentLife: creature.maxLife,
              canAttack: false,
              hasAttacked: false,
            };
            actor.hp -= 10;
            sound.play('negativeeffect');
            this.triggerDamage(who, 'hero', 10, { selfInflicted: true });
            this.lastSummonedUid = board[newSlot]!.uid;
            if (this.onCreatureAppear) this.onCreatureAppear(who, newSlot, creature.card);
            this.log(`【${creature.card.nameCn}】碎裂重铸，在 [${newSlot + 1}号位] 满血归位，${actor.name} 失去 10 点生命！`, 'summon');
            return;
          }

          if (creature.card.ability === 'phoenix_rebirth' && !creature.isDestroyed && actor.mana.fire >= 10) {
            board[idx] = {
              ...creature,
              currentLife: creature.maxLife,
              canAttack: false,
            };
            this.log(`【${creature.card.nameCn}】浴火涅槃重生！`, 'heal');
            return;
          }

          board[idx] = null;
        }
      });
    };

    checkDeath(this.playerBoard, 'player');
    checkDeath(this.enemyBoard, 'enemy');
    this.recalculateBoardStats();
  }

  // PC cost taxes that hit every player regardless of who owns them: Everraining Land (+2 to all
  // cards), Baffler Roost (doubles all cards), Baffler Dragon (doubles spells only).
  private applyGlobalCostModifiers(card: CardDef, cost: number): number {
    let result = cost;
    let doubles = 0;
    [this.playerBoard, this.enemyBoard].forEach((b) => {
      b.forEach((c) => {
        if (!c) return;
        if (c.card.ability === 'everraining_tax') result += 2;
        if (c.card.ability === 'baffler_double_all') doubles += 1;
        if (c.card.ability === 'baffler_dragon_spell_double' && card.type === 'spell') doubles += 1;
      });
    });
    for (let i = 0; i < doubles; i++) result *= 2;
    return result;
  }

  // PC altars accept a summoned creature as an offering ("Owner can summon creatures onto Altar
  // of Sacrifice / Spectral Altar"; Unsummon Altar sacrifices every creature of that power type).
  private isSacrificeAltar(c: BoardCreature): boolean {
    return (
      c.card.ability === 'altar_of_sacrifice' ||
      c.card.ability === 'spectral_altar' ||
      c.card.ability === 'unsummon_altar'
    );
  }

  // Resolves the altar offering. The altar stays in play; the offered creature never arrives.
  private resolveSacrificeAltar(who: 'player' | 'enemy', altar: BoardCreature, card: CardDef): void {
    const actor = who === 'player' ? this.player : this.enemy;
    const element = card.element as ElementType;

    if (altar.card.ability === 'altar_of_sacrifice') {
      // "owner receives an amount of power equal to twice the creature's cost"
      if (element in actor.mana) actor.mana[element] = (actor.mana[element] || 0) + card.cost * 2;
      sound.play('sacrifice');
      this.log(`【${altar.card.nameCn}】吞噬了献祭的【${card.nameCn}】，${actor.name} 获得 ${card.cost * 2} 点对应能量！`, 'heal');
      return;
    }

    if (altar.card.ability === 'spectral_altar') {
      // "Owner gains an amount of power equal to the creature's cost in each of two random powers."
      const powers: ElementType[] = ['fire', 'water', 'air', 'earth', actor.specialElement];
      const shuffled = [...powers].sort(() => Math.random() - 0.5).slice(0, 2);
      shuffled.forEach((e) => {
        actor.mana[e] = (actor.mana[e] || 0) + card.cost;
      });
      sound.play('sacrifice');
      this.log(`【${altar.card.nameCn}】献祭【${card.nameCn}】，${actor.name} 的 ${shuffled.join(' / ')} 能量各 +${card.cost}！`, 'heal');
      return;
    }

    // Unsummon Altar: every creature in play of that power type is sacrificed and its cost is
    // returned to its owner.
    let refunded = 0;
    [this.playerBoard, this.enemyBoard].forEach((b) => {
      b.forEach((c) => {
        if (!c || c === altar || c.spellImmune) return;
        if (c.card.element !== element) return;
        const owner = c.owner === 'player' ? this.player : this.enemy;
        if (c.card.element in owner.mana) {
          owner.mana[c.card.element] = (owner.mana[c.card.element] || 0) + c.card.cost;
        }
        c.isDestroyed = true;
        c.currentLife = 0;
        refunded++;
      });
    });
    sound.play('sacrifice');
    this.log(`【${altar.card.nameCn}】遣散同系召唤物：${refunded} 个生物被献祭并返还各自费用！`, 'damage');
  }

  // Gathering-of-Power cards that react to a card being played: Academy of Magic, Astral
  // Accelerator, Mana Storm, Living Tornado and (for the other side) Astral Damper.
  private onCardPlayed(who: 'player' | 'enemy', card: CardDef): void {
    const board = who === 'player' ? this.playerBoard : this.enemyBoard;
    const actor = who === 'player' ? this.player : this.enemy;
    const oppBoard = who === 'player' ? this.enemyBoard : this.playerBoard;

    // PC Academy of Magic: each spell its owner casts summons a 4/12 Adept of Magic.
    if (card.type === 'spell' && board.some((c) => c !== null && c.card.ability === 'academy_summon_adept')) {
      const empty: number[] = [];
      board.forEach((slot, sIdx) => {
        if (slot === null) empty.push(sIdx);
      });
      if (empty.length > 0) {
        const idx = empty[Math.floor(Math.random() * empty.length)];
        if (this.spawnToken(who, 'gop_adept_of_magic', idx)) {
          sound.play('positiveeffect');
          this.log(`【魔法学院】在施法余波中召唤出【魔法专家】(4/12)，进驻 [${idx + 1}号位]！`, 'summon');
        }
      }
    }

    // PC Astral Accelerator: 2 power of a random type whenever a card of cost 4 or less is used.
    if (card.cost <= 4 && board.some((c) => c !== null && c.card.ability === 'astral_accelerator')) {
      const elems: ElementType[] = ['fire', 'water', 'air', 'earth', actor.specialElement];
      const pick = elems[Math.floor(Math.random() * elems.length)];
      actor.mana[pick] = (actor.mana[pick] || 0) + 2;
      sound.play('positiveeffect');
      this.log(`【星魂加速器】加速施法，使 ${actor.name} 的 ${pick.toUpperCase()} 能量 +2！`, 'heal');
    }

    // PC Mana Storm: using a specialty-power card scrambles the owner's four elemental pools.
    if (
      card.element === actor.specialElement &&
      board.some((c) => c !== null && c.card.ability === 'mana_storm_shuffle')
    ) {
      const elems: ElementType[] = ['fire', 'water', 'air', 'earth'];
      const total = elems.reduce((sum, e) => sum + (actor.mana[e] || 0), 0);
      let remaining = total;
      elems.forEach((e, i) => {
        if (i === elems.length - 1) {
          actor.mana[e] = remaining;
          return;
        }
        const take = Math.floor(Math.random() * (remaining + 1));
        actor.mana[e] = take;
        remaining -= take;
      });
      this.log(`【魔力风暴】元素之力被重新分配（四系合计 ${total} 点）！`, 'heal');
    }

    // PC Living Tornado: each Air card its owner uses moves it and permanently grows it.
    if (card.element === 'air') {
      board.forEach((c, idx) => {
        if (!c) return;
        if (c.card.ability === 'living_tornado') {
          const empty: number[] = [];
          board.forEach((slot, sIdx) => {
            if (slot === null) empty.push(sIdx);
          });
          if (empty.length > 0) {
            const target = empty[Math.floor(Math.random() * empty.length)];
            board[target] = c;
            c.slotIndex = target;
            board[idx] = null;
          }
          c.baseAttack += 1;
          c.currentAttack += 1;
          this.log(`【${c.card.nameCn}】随气流游走，攻击力永久 +1（当前 ${c.currentAttack}）！`, 'heal');
        }
      });
    }

    // PC Astral Damper: "When opponent plays a card they lose all remaining power of the type
    // spent." The Damper's owner is on the other board, so the player who just played the card is
    // its opponent — that player loses the power.
    if (oppBoard.some((c) => c !== null && c.card.ability === 'astral_damper')) {
      if (card.element in actor.mana) {
        actor.mana[card.element] = 0;
        this.log(`【星魂妨碍者】阻截魔能，使 ${actor.name} 的 ${card.element.toUpperCase()} 能量清零！`, 'damage');
      }
    }
  }

  // The board opposing the given one (used by the all-board Gathering-of-Power effects).
  private opposingBoardOf(board: (BoardCreature | null)[]): (BoardCreature | null)[] {
    return board === this.playerBoard ? this.enemyBoard : this.playerBoard;
  }

  // PC cards whose printed attack is a sentinel (-1) and whose real attack is derived at runtime.
  // Returns null when the card uses its printed/base attack.
  private dynamicAttack(
    c: BoardCreature,
    side: 'player' | 'enemy',
    board: (BoardCreature | null)[]
  ): number | null {
    const hero = side === 'player' ? this.player : this.enemy;
    const oppBoard = side === 'player' ? this.enemyBoard : this.playerBoard;
    // Only the five "live" powers grow (see startTurn); the other mana keys stay at their seed
    // value and must not inflate "owner's powers" style cards.
    const powers: ElementType[] = ['fire', 'water', 'air', 'earth', hero.specialElement];
    const powerValue = (e: ElementType) => hero.mana[e] || 0;

    switch (c.card.ability) {
      case 'attack_equal_element_power':
        return powerValue(c.card.element as ElementType);
      case 'air_spirit_swarm':
        // PC Air Spirit: "attack is equal to the number of opponent's creatures"
        return oppBoard.filter((x) => x !== null).length;
      case 'attack_equal_friendly_count':
        // PC Golem Instructor: "attack is equal to number of owner's creatures"
        return board.filter((x) => x !== null).length;
      case 'attack_equal_highest_power':
        // PC Supreme Elemental: "Attack is equal to highest owner power"
        return Math.max(...powers.map(powerValue));
      case 'attack_equal_lowest_power':
        // PC Astral Drake: "attack is equal to owner's lowest power"
        return Math.min(...powers.map(powerValue));
      case 'attack_equal_power_sum':
        // PC Megacolossus: "attack is equal to sum of owner's powers"
        return powers.reduce((sum, e) => sum + powerValue(e), 0);
      default:
        return null;
    }
  }

  public recalculateBoardStats(): void {
    ['player', 'enemy'].forEach((sideKey) => {
      const side = sideKey as 'player' | 'enemy';
      const board = side === 'player' ? this.playerBoard : this.enemyBoard;

      // 1. Calculate global aura bonuses on this side
      let allFriendlyAtkBonus = 0;
      board.forEach((c) => {
        if (!c) return;
        if (c.card.ability === 'all_friendly_attack_1') {
          allFriendlyAtkBonus += 1;
        }
      });

      // 2. Compute attack for each creature
      board.forEach((c, slotIdx) => {
        if (!c) return;

        const sideHero = side === 'player' ? this.player : this.enemy;
        const ownOppBoard = side === 'player' ? this.enemyBoard : this.playerBoard;
        const dynamic = this.dynamicAttack(c, side, board);
        let totalAtk = dynamic !== null ? dynamic : c.baseAttack;

        // Temporary attack swings that must survive a recalculation: "until end of turn" buffs
        // (Vampire Mystic, Ritual of Glory) and Chastiser's "until after its next attack".
        totalAtk += (c.tempAttackBuff || 0) + (c.pendingAttackBonus || 0);

        // PC Golem Master champion: its attack carries the permanent upgrades bought with Army
        // Upgrade / Golem Instructor (which survive its death) plus the "until end of turn"
        // boosts from Golem's Frenzy / Golem Guide.
        if (c.card.id === 'golem_golem') {
          totalAtk += (sideHero.golemAttackBonus || 0) + (sideHero.golemTempAttackBonus || 0);
        }

        if (!c.isWall) {
          // Minotaur Commander: all other friendly non-wall creatures
          let myAllBonus = allFriendlyAtkBonus;
          if (c.card.ability === 'all_friendly_attack_1') {
            myAllBonus -= 1;
          }
          totalAtk += Math.max(0, myAllBonus);

          // Orc Chieftain: neighbor bonus +2 to adjacent non-wall creatures
          [-1, 1].forEach((offset) => {
            const nIdx = slotIdx + offset;
            if (nIdx >= 0 && nIdx < board.length) {
              const neighbor = board[nIdx];
              if (neighbor && neighbor.card.ability === 'neighbor_attack_2') {
                totalAtk += 2;
              }
            }
          });

          // Vampire: +4 attack if opposite slot has an enemy creature
          if (c.card.ability === 'vampirism') {
            const oppBoard = side === 'player' ? this.enemyBoard : this.playerBoard;
            if (oppBoard[slotIdx]) {
              totalAtk += 4;
            }
          }

          // Goblin Hero: +2 attack for each adjacent creature
          if (c.card.ability === 'goblin_hero_synergy') {
            [-1, 1].forEach((offset) => {
              const nIdx = slotIdx + offset;
              if (nIdx >= 0 && nIdx < board.length && board[nIdx]) {
                totalAtk += 2;
              }
            });
          }

          // PC Peace Tree: "reduces attack of opponent's creatures by 1."
          const peaceTrees = ownOppBoard.filter(
            (x) => x !== null && x.card.ability === 'peace_tree_aura'
          ).length;
          if (peaceTrees > 0) totalAtk -= peaceTrees;
        }

        c.currentAttack = Math.max(0, totalAtk);
        c.buffedAttack = c.currentAttack > c.baseAttack;
      });
    });
  }

  public checkWinner() {
    // PC Soul Jar: "Council of Liches can't be defeated while Soul Jar is in play" — modelled as
    // "the Jar's owner cannot be defeated", so a warded side is clamped to 1 life.
    if (
      this.player.hp <= 0 &&
      this.playerBoard.some((c) => c !== null && c.card.ability === 'soul_jar')
    ) {
      this.player.hp = 1;
      this.log(`【灵魂匣】护住了 ${this.player.name} 的魂魄，使其免于败亡！`, 'heal');
    }
    if (
      this.enemy.hp <= 0 &&
      this.enemyBoard.some((c) => c !== null && c.card.ability === 'soul_jar')
    ) {
      this.enemy.hp = 1;
      this.log(`【灵魂匣】护住了 ${this.enemy.name} 的魂魄，使其免于败亡！`, 'heal');
    }

    if (this.enemy.hp <= 0 && this.player.hp <= 0) {
      this.gameOver = true;
      this.winner = 'player';
      sound.play('victory');
      this.log('⚔️ 双方英雄同时力竭，判定玩家获胜！', 'heal');
      this.recordCampaignVictory();
    } else if (this.enemy.hp <= 0) {
      this.gameOver = true;
      this.winner = 'player';
      sound.play('victory');
      this.log(`🎉 恭喜！你击败了 ${this.enemy.name}，斩获了对决的胜利！`, 'heal');
      this.recordCampaignVictory();
    } else if (this.player.hp <= 0) {
      this.gameOver = true;
      this.winner = 'enemy';
      sound.play('defeat');
      this.log(`💀 你的生命值耗尽，被 ${this.enemy.name} 击败了！`, 'damage');
    }

    // Campaign Special Battlefield Victory / Defeat Rules
    if (!this.gameOver && this.currentCampaign) {
      const campId = this.currentCampaign.id;

      // Level 6 (Sirroca / 斯哈克): "胜利条件：对方生命耗尽或者玩家杀死气灵。"
      if (campId === 6) {
        const hasAirElemental = this.enemyBoard.some(c => c !== null && c.card.id === 'air_air_elemental');
        if (!hasAirElemental) {
          this.gameOver = true;
          this.winner = 'player';
          sound.play('victory');
          this.log('🎉 斯哈克的气灵已被彻底消灭！狂风平息，判定玩家斩获胜利！', 'heal');
          this.recordCampaignVictory();
          return;
        }
      }

      // Level 5 (Lorana / 洛瑞娜): "胜利条件：对方生命耗尽或者玩家在八回合内生还。"
      if (campId === 5 && this.turnCount >= 8) {
        this.gameOver = true;
        this.winner = 'player';
        sound.play('victory');
        this.log('🛡️ 你已在拉卡瓦河畔坚守超过8个回合，成功生还，判定玩家获胜！', 'heal');
        this.recordCampaignVictory();
        return;
      }

      // Level 7 (Avdofya / 阿芙黛娅): "胜利条件：在十五回合内对方生命耗尽。失败条件：未达成胜利条件。"
      if (campId === 7 && this.turnCount > 15 && this.enemy.hp > 0) {
        this.gameOver = true;
        this.winner = 'enemy';
        sound.play('defeat');
        this.log('⏳ 战斗已超过15回合，未能阻止阿芙黛娅的邪恶仪式，战斗失败！', 'damage');
        return;
      }

      // Level 3 (Fedemir / 费德米尔): "胜利条件：在十回合内对方生命耗尽。失败条件：未达成胜利条件。"
      if (campId === 3 && this.turnCount > 10 && this.enemy.hp > 0) {
        this.gameOver = true;
        this.winner = 'enemy';
        sound.play('defeat');
        this.log('⏳ 战斗已超过10回合，未能在限定时间内击溃费德米尔，任务失败！', 'damage');
        return;
      }

      // Level 4 (Nirion / 尼瑞恩): "胜利条件：对方生命耗尽或者玩家召唤心灵大师。"
      if (campId === 4) {
        const hasMindMaster = this.playerBoard.some(c => c !== null && (c.card.id === 'control_mind_master' || c.card.nameCn.includes('心灵大师')));
        if (hasMindMaster) {
          this.gameOver = true;
          this.winner = 'player';
          sound.play('victory');
          this.log('✨ 玩家成功召唤了心灵大师并说服了尼瑞恩，判定玩家获胜！', 'heal');
          this.recordCampaignVictory();
          return;
        }
      }

      // Level 11 (Melidiadus / 曼迪阿杜斯): "胜利条件：杀死场上所有的吸血鬼。"
      if (campId === 11) {
        const hasVampires = this.enemyBoard.some(c => c !== null && (c.card.id === 'gop_vampire' || c.card.nameCn.includes('吸血鬼')));
        if (!hasVampires) {
          this.gameOver = true;
          this.winner = 'player';
          sound.play('victory');
          this.log('🧛 场上所有的吸血鬼已被全部斩杀，曼迪阿杜斯力量枯竭，判定玩家获胜！', 'heal');
          this.recordCampaignVictory();
          return;
        }
      }
    }
  }

  private recordCampaignVictory() {
    if (this.currentCampaign) {
      try {
        const nextId = this.currentCampaign.id + 1;
        const unlocked = JSON.parse(localStorage.getItem('unlocked_campaigns') || '[1]');
        if (!unlocked.includes(nextId)) {
          unlocked.push(nextId);
          localStorage.setItem('unlocked_campaigns', JSON.stringify(unlocked));
        }
      } catch {}
    }
  }

  public isFriendlyTargetSpell(card: CardDef): boolean {
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

  private estimateSpellPower(spell: CardDef): {
    isOffensive: boolean;
    isFriendly: boolean;
    isAoe: boolean;
    isInstantKill: boolean;
    estDamage: number;
    estHeal: number;
  } {
    const id = spell.id;
    const effect = spell.spellEffect || '';
    // Army Upgrade is a friendly buff/heal that needs no target, so it is scored on the same
    // "improve my board" axis as the targeted heals.
    const isFriendly = this.isFriendlyTargetSpell(spell) || effect.includes('army_upgrade');

    if (isFriendly) {
      return {
        isOffensive: false,
        isFriendly: true,
        isAoe: false,
        isInstantKill: false,
        estDamage: 0,
        estHeal: id.includes('heal') || effect.includes('heal') ? 8 : 4,
      };
    }

    if (effect.includes('disintegrate') || id.includes('disintegrate')) {
      return {
        isOffensive: true,
        isFriendly: false,
        isAoe: false,
        isInstantKill: true,
        estDamage: 999,
        estHeal: 0,
      };
    }

    let isAoe = false;
    let estDamage = 6;

    if (
      effect.includes('all_enemy') ||
      effect.includes('acidic_rain') ||
      effect.includes('armageddon') ||
      effect.includes('chain') ||
      effect.includes('frenzy') ||
      effect.includes('golems_justice') ||
      effect.includes('ancient_spirits') ||
      effect.includes('blood_boil')
    ) {
      isAoe = true;
    }

    if (effect.includes('inferno') || id.includes('inferno')) {
      estDamage = 18;
    } else if (effect.includes('stone_rain') || id.includes('stone_rain')) {
      estDamage = 25;
    } else if (effect.includes('acidic_rain') || id.includes('acidic_rain')) {
      estDamage = 15;
    } else if (effect.includes('fireball') || id.includes('fireball')) {
      estDamage = 10;
    } else if (effect.includes('lightning') || id.includes('lightning')) {
      estDamage = 9;
    } else if (effect.includes('damage_all_enemy_creatures_9')) {
      estDamage = 9;
    } else if (effect.includes('frenzy')) {
      estDamage = 3;
    } else if (effect.includes('golems_justice')) {
      estDamage = 4;
    } else if (effect.includes('ancient_spirits')) {
      estDamage = 10;
    } else if (effect.includes('blood_boil')) {
      estDamage = 4;
    } else if (effect.includes('thunder') || effect.includes('drain')) {
      estDamage = 6;
    } else if (spell.cost >= 6) {
      estDamage = 14;
    } else if (spell.cost >= 4) {
      estDamage = 8;
    }

    return {
      isOffensive: true,
      isFriendly: false,
      isAoe,
      isInstantKill: false,
      estDamage,
      estHeal: 0,
    };
  }

  private async triggerAiTurn(): Promise<void> {
    if (this.gameOver || this.activeTurn !== 'enemy' || this.isCombatPhase) return;

    const playableCards = this.getEffectiveHand('enemy').filter((c) => this.canPlayCard('enemy', c));
    if (playableCards.length === 0) {
      await this.passTurn('enemy');
      return;
    }

    // Easy difficulty occasional hesitation
    if (
      this.difficulty === '容易' &&
      Math.random() < 0.25 &&
      this.enemyBoard.some((c) => c !== null) &&
      this.enemy.hp > 15
    ) {
      await this.passTurn('enemy');
      return;
    }

    const emptySlots: number[] = [];
    this.enemyBoard.forEach((slot, idx) => {
      if (slot === null) emptySlots.push(idx);
    });

    const playerActiveCount = this.playerBoard.filter((c) => c !== null).length;

    interface CandidateAction {
      card: CardDef;
      targetSlot?: number;
      score: number;
    }

    const candidates: CandidateAction[] = [];

    for (const card of playableCards) {
      // 1. Anti-repetition penalty (decay over last few played cards)
      let antiRepetitionPenalty = 0;
      const recentLen = this.aiRecentCardIds.length;
      if (recentLen > 0 && this.aiRecentCardIds[recentLen - 1] === card.id) {
        antiRepetitionPenalty = 14;
      } else if (recentLen > 1 && this.aiRecentCardIds[recentLen - 2] === card.id) {
        antiRepetitionPenalty = 7;
      }

      // 2. Element mana reserve incentive: spend high mana surplus, conserve exhausted mana
      const currentElemMana = this.enemy.mana[card.element] || 0;
      let elemResourceBonus = 0;
      if (currentElemMana >= 7) elemResourceBonus += 4;
      else if (currentElemMana <= card.cost + 1) elemResourceBonus -= 2;

      // 2b. Blood discipline double payment: the life half of the cost is a real resource, so it
      // scales the price up and becomes prohibitive once the AI is in burn range.
      if (card.lifeCost) {
        elemResourceBonus -= card.lifeCost * 1.5;
        const lifeAfter = this.enemy.hp - card.lifeCost;
        if (lifeAfter <= 20) elemResourceBonus -= 20;
        else if (lifeAfter <= 30) elemResourceBonus -= 8;
      }

      if (card.type === 'creature') {
        const baseAttack =
          card.attack === -1 && card.ability === 'attack_equal_element_power'
            ? currentElemMana
            : (card.attack === -1 && card.ability === 'attack_equal_friendly_count'
              ? this.enemyBoard.filter((c) => c !== null).length
              : (card.attack || 0));
        const baseLife = card.life || 1;

        let traitBonus = 0;
        if (card.swift) traitBonus += 8;
        if (card.flying) traitBonus += 5;
        if (card.spellImmune) traitBonus += 4;
        if (card.regen) traitBonus += card.regen * 3;

        if (card.ability && card.ability.includes('growth')) {
          traitBonus += this.turnCount <= 6 ? 12 : 5;
        }
        if (card.onSummon === 'damage_all_enemies_5' || card.onSummon === 'fire_elemental_summon') {
          traitBonus += playerActiveCount * 4 + 6;
        } else if (card.onSummon === 'spawn_spiders') {
          traitBonus += 8;
        } else if (card.onSummon === 'dark_sculptor_x') {
          // X scales with the whole board, both sides included.
          traitBonus += (playerActiveCount + this.enemyBoard.filter((c) => c !== null).length) * 3 + 4;
        } else if (card.onSummon === 'golem_instructor_boost') {
          traitBonus += 6;
        } else if (card.onSummon === 'damage_all_other_20') {
          // 20 damage to every other creature: great when the opponent has the wider board, bad
          // when it would wipe our own.
          traitBonus += playerActiveCount * 6 + 10 - this.enemyBoard.filter((c) => c !== null).length * 5;
        }

        // Cult trade-offs: Fanatic is a spell magnet, and Reaver locks its own owner out of spells.
        if (card.ability === 'fanatic_spell_double') traitBonus -= 3;
        if (card.ability === 'reaver_redirect') {
          traitBonus -= this.enemy.hand.filter((c) => c.type === 'spell').length * 3;
        }

        if (card.onSummon === 'forest_wolf_devour') {
          // PC Forest Wolf: it must replace the Magic Rabbit and inherits its attack, so the
          // only legal slot is the rabbit's.
          const rabbitSlot = this.enemyBoard.findIndex(
            (slot) => slot !== null && slot.card.id === 'forest_magic_rabbit'
          );
          if (rabbitSlot !== -1) {
            const rabbit = this.enemyBoard[rabbitSlot]!;
            let slotScore = 30 + rabbit.currentAttack * 3 + baseLife * 0.4 + elemResourceBonus - antiRepetitionPenalty;
            const opp = this.playerBoard[rabbitSlot];
            if (opp) {
              slotScore += opp.currentAttack * 3.2;
              if (rabbit.currentAttack >= opp.currentLife) slotScore += 16;
            } else {
              slotScore += rabbit.currentAttack * 3.2;
            }
            candidates.push({ card, targetSlot: rabbitSlot, score: slotScore });
          }
        } else if (card.id === 'death_emissary_of_dorlak') {
          const occupiedFriendlySlots: number[] = [];
          this.enemyBoard.forEach((slot, idx) => {
            if (slot !== null) occupiedFriendlySlots.push(idx);
          });

          for (const slot of occupiedFriendlySlots) {
            const host = this.enemyBoard[slot]!;
            // Sacrificing high-attack/high-hp is costly, sacrificing weak or damaged friendly creature is high value
            const sacrificeCost = host.currentAttack * 2.2 + host.currentLife * 0.9;
            let slotScore = baseAttack * 2.2 + baseLife * 0.9 - sacrificeCost + traitBonus + elemResourceBonus - antiRepetitionPenalty;
            const opp = this.playerBoard[slot];
            if (opp) {
              const oppAtk = opp.currentAttack;
              const oppHp = opp.currentLife;
              slotScore += oppAtk * 3.2;
              if (baseAttack >= oppHp) slotScore += 16;
            } else {
              slotScore += baseAttack * 3.2;
            }
            candidates.push({ card, targetSlot: slot, score: slotScore });
          }
        } else {
          for (const slot of emptySlots) {
          let slotScore = baseAttack * 2.2 + baseLife * 0.9 + traitBonus + elemResourceBonus - antiRepetitionPenalty;
          const opp = this.playerBoard[slot];

          if (opp) {
            // Lane confrontation with player creature
            const oppAtk = opp.currentAttack;
            const oppHp = opp.currentLife;

            // Block threat bonus
            slotScore += oppAtk * 3.2;

            // Immediate or combat kill
            if (card.swift && baseAttack >= oppHp) {
              slotScore += 24 + oppAtk * 2.5;
            } else if (baseAttack >= oppHp) {
              slotScore += 14 + oppAtk * 1.5;
            }

            // Survivability
            if (oppAtk >= baseLife) {
              if (card.isWall) {
                slotScore -= 3;
              } else if (baseAttack < oppHp) {
                // Suicide feed
                slotScore -= 18;
              } else {
                // Mutual kill
                slotScore += card.cost <= 3 ? 3 : -4;
              }
            } else {
              // Surviving defender
              slotScore += 10;
            }
          } else {
            // Unblocked lane -> direct face damage
            slotScore += baseAttack * 3.2;
            if (this.player.hp < 25) {
              slotScore += 10 + (25 - this.player.hp);
            }
            if (card.isWall && baseAttack === 0) {
              // 0-attack wall in empty lane is useless
              slotScore -= 25;
            }
          }

          candidates.push({ card, targetSlot: slot, score: slotScore });
        }
      }
      } else if (card.type === 'spell') {
        if (card.isActivatedAbility) {
          if (card.targetType === 'empty_friendly_slot') {
            for (const slot of emptySlots) {
              let score = 16 + playerActiveCount * 6 + elemResourceBonus - antiRepetitionPenalty;
              const opp = this.playerBoard[slot];
              if (!opp) score += 6;
              candidates.push({ card, targetSlot: slot, score });
            }
          } else if (card.targetType === 'enemy_creature' || card.targetType === 'any_creature') {
            for (let s = 0; s < this.playerBoard.length; s++) {
              const opp = this.playerBoard[s];
              if (opp && !opp.spellImmune) {
                const estDmg = card.id.includes('scorpion') ? 14 : 6;
                let score = 10 + elemResourceBonus - antiRepetitionPenalty;
                if (estDmg >= opp.currentLife) {
                  score += 20 + opp.currentAttack * 3;
                } else {
                  score += estDmg * 1.5;
                }
                candidates.push({ card, targetSlot: s, score });
              }
            }
          } else {
            let score = 15 + elemResourceBonus - antiRepetitionPenalty;
            if (card.id.includes('ancient_dragon')) {
              score += playerActiveCount * 12 + 25;
            } else if (card.id.includes('hamster')) {
              let totalLost = 0;
              this.enemyBoard.forEach((c) => { if (c) totalLost += (c.maxLife - c.currentLife); });
              score += Math.min(30, totalLost * 1.8);
            } else if (card.id.includes('wolverine')) {
              const w = this.enemyBoard.find((c) => c && c.card.id === 'beast_wolverine');
              if (w) score += (w.maxLife - w.currentLife) + 8;
            } else if (card.id.includes('energy_beast')) {
              score += 10;
            } else if (card.id.includes('white_elephant')) {
              score += 8;
            }
            candidates.push({ card, targetSlot: undefined, score });
          }
          continue;
        }

        const spellInfo = this.estimateSpellPower(card);

        if (spellInfo.isFriendly) {
          // Friendly targeted spell
          for (let s = 0; s < this.enemyBoard.length; s++) {
            const ally = this.enemyBoard[s];
            if (ally) {
              let spellScore = 12 + ally.currentAttack * 2 + elemResourceBonus - antiRepetitionPenalty;
              if (ally.maxLife > ally.currentLife) {
                spellScore += Math.min(ally.maxLife - ally.currentLife, spellInfo.estHeal) * 2;
              }
              candidates.push({ card, targetSlot: s, score: spellScore });
            }
          }
        } else if (card.requiresTarget) {
          // Offensive targeted spell
          for (let s = 0; s < this.playerBoard.length; s++) {
            const opp = this.playerBoard[s];
            if (this.isValidSpellTarget(card, opp)) {
              let spellScore = 8 + elemResourceBonus - antiRepetitionPenalty;

              if (spellInfo.isInstantKill || spellInfo.estDamage >= opp.currentLife) {
                // Lethal kill on opposing unit
                spellScore += 22 + opp.currentAttack * 3.5;
              } else {
                spellScore += Math.min(spellInfo.estDamage, opp.currentLife) * 1.5 + opp.currentAttack * 1.2;
              }

              if (opp.isWall) {
                spellScore -= 12;
              }

              candidates.push({ card, targetSlot: s, score: spellScore });
            }
          }
        } else {
          // Untargeted / AOE spell
          let aoeScore = 10 + elemResourceBonus - antiRepetitionPenalty;
          if (spellInfo.isAoe) {
            if (playerActiveCount >= 3) aoeScore += 28 + playerActiveCount * 4;
            else if (playerActiveCount === 2) aoeScore += 16;
            else if (playerActiveCount === 1) aoeScore += 4;
            else aoeScore -= 30; // Don't waste AOE on empty board
          } else if (card.id.includes('meditation')) {
            aoeScore += this.turnCount <= 5 ? 14 : 6;
          }

          candidates.push({ card, targetSlot: undefined, score: aoeScore });
        }
      }
    }

    if (candidates.length === 0) {
      await this.passTurn('enemy');
      return;
    }

    // Difficulty tuning
    let chosenAction: CandidateAction;

    if (this.difficulty === '容易') {
      // Easy: add high noise, pick from top 3
      candidates.forEach((c) => {
        c.score += (Math.random() - 0.5) * 20;
      });
      candidates.sort((a, b) => b.score - a.score);
      const topPool = candidates.slice(0, Math.min(3, candidates.length));
      chosenAction = topPool[Math.floor(Math.random() * topPool.length)];
    } else if (this.difficulty === '普通') {
      // Normal: moderate noise, pick from top 2
      candidates.forEach((c) => {
        c.score += (Math.random() - 0.5) * 6;
      });
      candidates.sort((a, b) => b.score - a.score);
      const topPool = candidates.slice(0, Math.min(2, candidates.length));
      chosenAction = topPool[Math.floor(Math.random() * topPool.length)];
    } else if (this.difficulty === '困难') {
      // Hard: slight noise, smart saving mana check
      candidates.forEach((c) => {
        c.score += (Math.random() - 0.5) * 2;
      });
      candidates.sort((a, b) => b.score - a.score);

      // Check if saving mana for an expensive bomb next turn is better than a weak play
      const hasUnplayableBomb = this.enemy.hand.some(
        (c) => c.cost >= 6 && (c.attack || 0) >= 5 && (this.enemy.mana[c.element] || 0) === c.cost - 1
      );
      if (hasUnplayableBomb && candidates[0].score < 14 && playerActiveCount <= 2 && this.enemy.hp > 25) {
        await this.passTurn('enemy');
        return;
      }

      chosenAction = candidates[0];
    } else {
      // Master (大法师): purely optimal tactical choice
      candidates.sort((a, b) => b.score - a.score);
      chosenAction = candidates[0];
    }

    if (chosenAction) {
      this.aiRecentCardIds.push(chosenAction.card.id);
      if (this.aiRecentCardIds.length > 5) {
        this.aiRecentCardIds.shift();
      }
      await this.playCard('enemy', chosenAction.card, chosenAction.targetSlot);
    } else {
      await this.passTurn('enemy');
    }
  }

  public notify() {
    if (this.onStateChange) this.onStateChange();
    if (this.isLanGame && this.isHost && this.onStateBroadcast) {
      this.onStateBroadcast(this.exportStateSnapshot());
    }
  }

  public exportStateSnapshot(): NetworkGameStateSnapshot {
    return {
      turnCount: this.turnCount,
      activeTurn: this.activeTurn,
      isCombatPhase: this.isCombatPhase,
      gameOver: this.gameOver,
      winner: this.winner,
      playerHp: this.player.hp,
      playerMaxHp: this.player.maxHp,
      playerMana: { ...this.player.mana },
      playerGrowth: { ...this.player.growth },
      enemyHp: this.enemy.hp,
      enemyMaxHp: this.enemy.maxHp,
      enemyMana: { ...this.enemy.mana },
      enemyGrowth: { ...this.enemy.growth },
      playerBoard: this.cloneBoard(this.playerBoard),
      enemyBoard: this.cloneBoard(this.enemyBoard),
      playerGolemAttackBonus: this.player.golemAttackBonus || 0,
      playerGolemTempAttackBonus: this.player.golemTempAttackBonus || 0,
      enemyGolemAttackBonus: this.enemy.golemAttackBonus || 0,
      enemyGolemTempAttackBonus: this.enemy.golemTempAttackBonus || 0,
      guestHand: this.enemy.hand.map((c) => ({ ...c })),
      hostHand: this.player.hand.map((c) => ({ ...c })),
      enemyRevealedCardIds: Array.from(this.playerRevealedCardIds),
      lastLog: this.logs.length > 0 ? this.logs[0] : undefined,
    };
  }

  public applyStateSnapshot(snapshot: NetworkGameStateSnapshot) {
    this.turnCount = snapshot.turnCount;
    // For guest: host's 'player' is guest's 'enemy', host's 'enemy' is guest's 'player'
    this.activeTurn = snapshot.activeTurn === 'player' ? 'enemy' : 'player';
    this.isCombatPhase = snapshot.isCombatPhase;
    this.gameOver = snapshot.gameOver;
    this.winner = snapshot.winner === 'player' ? 'enemy' : (snapshot.winner === 'enemy' ? 'player' : snapshot.winner);

    // Swap players: guest is player, host is enemy
    this.player.hp = snapshot.enemyHp;
    this.player.maxHp = snapshot.enemyMaxHp;
    this.player.mana = { ...snapshot.enemyMana };
    this.player.growth = { ...snapshot.enemyGrowth };

    this.enemy.hp = snapshot.playerHp;
    this.enemy.maxHp = snapshot.playerMaxHp;
    this.enemy.mana = { ...snapshot.playerMana };
    this.enemy.growth = { ...snapshot.playerGrowth };

    // Swap boards
    this.playerBoard = snapshot.enemyBoard.map((c) => (c ? { ...c, owner: 'player', card: { ...c.card } } : null));
    this.enemyBoard = snapshot.playerBoard.map((c) => (c ? { ...c, owner: 'enemy', card: { ...c.card } } : null));

    this.player.golemAttackBonus = snapshot.enemyGolemAttackBonus || 0;
    this.player.golemTempAttackBonus = snapshot.enemyGolemTempAttackBonus || 0;
    this.enemy.golemAttackBonus = snapshot.playerGolemAttackBonus || 0;
    this.enemy.golemTempAttackBonus = snapshot.playerGolemTempAttackBonus || 0;

    if (snapshot.guestHand) {
      this.player.hand = snapshot.guestHand.map((c) => ({ ...c }));
    }
    if (snapshot.hostHand) {
      this.enemy.hand = snapshot.hostHand.map((c) => ({ ...c }));
    }

    if (snapshot.enemyRevealedCardIds) {
      this.enemyRevealedCardIds = new Set(snapshot.enemyRevealedCardIds);
    }

    if (snapshot.lastLog) {
      const exists = this.logs.some((l) => l.id === snapshot.lastLog!.id);
      if (!exists) {
        this.logs.unshift(snapshot.lastLog);
        if (this.logs.length > 50) this.logs.pop();
      }
    }

    if (this.onStateChange) this.onStateChange();
  }

  public reset(
    playerClass: HeroClass = 'sorcery',
    campaign?: CampaignLevel,
    customConfig?: {
      playerName?: string;
      playerFace?: string;
      enemyName?: string;
      enemyFace?: string;
      enemyClass?: HeroClass;
      enemyHp?: number;
    }
  ) {
    this.currentCampaign = campaign || null;
    const enemyClassPool: HeroClass[] = [
      'sorcery', 'necromancer', 'cleric', 'mechanician', 'dominator',
      'chaosmaster', 'illusionist', 'demonologist', 'beastmaster', 'chronomancer', 'goblin', 'forest', 'golem', 'cult', 'blood'
    ];
    const enemyClass: HeroClass = customConfig?.enemyClass || (campaign ? enemyClassPool[campaign.id % enemyClassPool.length] : 'necromancer');
    const enemyHp = customConfig?.enemyHp || (campaign ? campaign.enemyHp : 60);
    const enemyFace = customConfig?.enemyFace || (campaign ? campaign.face : './faces/Face6.jpg');
    const enemyName = customConfig?.enemyName || (campaign ? campaign.oppName : '大法师');

    const playerName = customConfig?.playerName || '玩家';
    const playerFace = customConfig?.playerFace || './faces/Face1.jpg';

    this.player = this.createPlayer('player', playerName, playerFace, playerClass, 60);
    this.enemy = this.createPlayer('enemy', enemyName, enemyFace, enemyClass, enemyHp);
    this.playerBoard = [null, null, null, null, null, null];
    this.enemyBoard = [null, null, null, null, null, null];
    this.activeTurn = 'player';
    this.isCombatPhase = false;
    this.turnCount = 1;
    this.gameOver = false;
    this.winner = null;
    this.logs = [];
    this.skipNextTurn = { player: false, enemy: false };
    this.extraActionRemaining = { player: 0, enemy: 0 };
    this.enemyRevealedCardIds.clear();
    this.playerRevealedCardIds.clear();
    this.placeClassChampion('player');
    this.placeClassChampion('enemy');
    this.startTurn('player');
    this.replaySteps = [{
      turn: 1,
      side: 'player',
      action: 'init',
      desc: '战斗开始，双方就位',
      playerHp: this.player.hp,
      enemyHp: this.enemy.hp,
      playerMana: { ...this.player.mana },
      enemyMana: { ...this.enemy.mana },
      playerBoard: this.cloneBoard(this.playerBoard),
      enemyBoard: this.cloneBoard(this.enemyBoard),
    }];
  }

  public getAdvice(): { card: CardDef | null; targetSlot?: number; adviceText: string } {
    if (this.gameOver) return { card: null, adviceText: '对决已结束。' };
    if (this.activeTurn !== 'player') return { card: null, adviceText: '当前是敌方行动回合，请稍候。' };

    const playable = this.player.hand.filter((c) => this.canPlayCard('player', c));
    if (playable.length === 0) {
      return { card: null, adviceText: '当前各系能量不足以施法，建议点击【结束回合】积攒能量。' };
    }

    const emptySlots: number[] = [];
    this.playerBoard.forEach((c, idx) => {
      if (c === null) emptySlots.push(idx);
    });

    let mostThreateningSlot = -1;
    let maxThreat = -1;
    emptySlots.forEach((slot) => {
      const opp = this.enemyBoard[slot];
      if (opp && opp.currentAttack > maxThreat) {
        maxThreat = opp.currentAttack;
        mostThreateningSlot = slot;
      }
    });

    const creatures = playable.filter((c) => c.type === 'creature');
    if (creatures.length > 0 && emptySlots.length > 0) {
      creatures.sort((a, b) => ((b.attack || 0) + (b.life || 0)) - ((a.attack || 0) + (a.life || 0)));
      const bestCreature = creatures[0];
      const targetSlot = mostThreateningSlot !== -1 ? mostThreateningSlot : emptySlots[0];
      const threat = this.enemyBoard[targetSlot];
      const adviceText = threat
        ? `战术建议：在 [${targetSlot + 1}号位] 召唤【${bestCreature.nameCn}】拦截敌方【${threat.card.nameCn}】！`
        : `战术建议：在 [${targetSlot + 1}号位] 召唤【${bestCreature.nameCn}】组织阵线直击敌方英雄！`;
      return { card: bestCreature, targetSlot, adviceText };
    }

    const spells = playable.filter((c) => c.type === 'spell');
    if (spells.length > 0) {
      const bestSpell = spells[0];
      return { card: bestSpell, adviceText: `战术建议：施放法术【${bestSpell.nameCn}】掌控战局！` };
    }

    return { card: null, adviceText: '建议点击【结束回合】推进战斗。' };
  }
}
