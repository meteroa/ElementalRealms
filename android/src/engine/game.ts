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
  public onCardAnnouncement?: (who: 'player' | 'enemy', card: CardDef) => Promise<void>;
  public enemyRevealedCardIds: Set<string> = new Set();
  public playerRevealedCardIds: Set<string> = new Set();
  public lastSummonedUid: string | null = null;

  // Turn skip / extra actions
  public skipNextTurn: { player: boolean; enemy: boolean } = { player: false, enemy: false };
  public extraActionRemaining: { player: number; enemy: number } = { player: 0, enemy: 0 };
  public leagueRule?: string;
  public campaignLevel?: CampaignLevel;
  public difficulty: string = '普通';

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
      'chaosmaster', 'illusionist', 'demonologist', 'beastmaster', 'chronomancer', 'goblin'
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
      poison: 0,
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
    const elemMap: Record<HeroClass, ElementType> = {
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
    };
    const specialElem: ElementType = elemMap[classType] || 'special';

    const allCards = cardsData as CardDef[];

    // Spectromancer authentic dynamic random dealing: 4 random cards per element
    const getRandomCards = (pool: CardDef[], count: number = 4) => {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count).sort((a, b) => a.cost - b.cost);
    };

    const specialCardsPool = allCards.filter(
      (c) => c.className === classType || (c.element === specialElem && !c.className)
    );

    const hand = [
      ...getRandomCards(allCards.filter((c) => c.element === 'fire')),
      ...getRandomCards(allCards.filter((c) => c.element === 'water')),
      ...getRandomCards(allCards.filter((c) => c.element === 'air')),
      ...getRandomCards(allCards.filter((c) => c.element === 'earth')),
      ...getRandomCards(specialCardsPool.length >= 4 ? specialCardsPool : allCards.filter((c) => c.element === 'special')),
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
    };
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

    if (this.skipNextTurn[who]) {
      this.skipNextTurn[who] = false;
      this.log(`【时空压制】${who === 'player' ? this.player.name : this.enemy.name} 被强制跳过出牌回合！`, 'damage');
      this.activeTurn = who;
      this.passTurn(who);
      return;
    }

    this.activeTurn = who;
    this.isCombatPhase = false;
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
      if (c.card.ability === 'time_growth_2') extraSpecialGrowth += 2;
      if (c.card.ability === 'attack_equal_element_power') {
        if (c.card.element === 'fire') extraFireGrowth += 1;
        if (c.card.element === 'water') extraWaterGrowth += 1;
        if (c.card.element === 'air') extraAirGrowth += 1;
        if (c.card.element === 'earth') extraEarthGrowth += 1;
      }
      if (c.card.ability === 'mind_master_all_growth_1' || c.card.ability === 'astral_guard_drain_growth_1') {
        extraFireGrowth += 1;
        extraWaterGrowth += 1;
        extraAirGrowth += 1;
        extraEarthGrowth += 1;
        extraSpecialGrowth += 1;
      }
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
      actor.mana[elem] += g;
    });

    // Astral Guard drain
    board.forEach((c) => {
      if (c && c.card.ability === 'astral_guard_drain_growth_1') {
        activeElements.forEach((elem) => {
          actor.mana[elem] = Math.max(0, actor.mana[elem] - 1);
        });
        this.log(`【${c.card.nameCn}】星界耗蚀，使拥有者每系能量 -1！`, 'damage');
      }
    });

    // 2. Creature turn-start triggers
    board.forEach((creature, idx) => {
      if (!creature) return;

      // Poison
      if (creature.poison > 0) {
        creature.currentLife -= creature.poison;
        this.triggerDamage(who, idx, creature.poison);
        sound.play('poison');
        this.log(`【${creature.card.nameCn}】受到 ${creature.poison} 点毒素伤害！`, 'damage');
      }

      // Regen
      if (creature.regen > 0 && creature.currentLife < creature.maxLife) {
        const heal = Math.min(creature.regen, creature.maxLife - creature.currentLife);
        creature.currentLife += heal;
        this.triggerHeal(who, idx, heal);
        sound.play('heal');
        this.log(`【${creature.card.nameCn}】再生恢复了 ${heal} 点生命。`, 'heal');
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

      // Angel: heal weakest ally 3 HP
      if (creature.card.id === 'holy_angel') {
        let lowestHp = 999;
        let weakestSlot = -1;
        board.forEach((c, sIdx) => {
          if (c && c.currentLife < c.maxLife && c.currentLife < lowestHp) {
            lowestHp = c.currentLife;
            weakestSlot = sIdx;
          }
        });
        if (weakestSlot !== -1 && board[weakestSlot]) {
          const target = board[weakestSlot]!;
          const heal = Math.min(3, target.maxLife - target.currentLife);
          target.currentLife += heal;
          this.triggerHeal(who, weakestSlot, heal);
          sound.play('heal');
          this.log(`【${creature.card.nameCn}】圣疗神光照耀【${target.card.nameCn}】，为其恢复 3 点生命！`, 'heal');
        }
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
        sound.play('lightning');
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
          sound.play('cannonade');
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
          sound.play('stonerain');
          this.log(`【混沌石砲】巨石轰击敌方【${oppBoard[tIdx]!.card.nameCn}】，造成 10 点重创！`, 'damage');
        }
      }

      // Energy Beast: +1 to fire, water, air, earth
      if (creature.card.ability === 'energy_beast_pulse') {
        ['fire', 'water', 'air', 'earth'].forEach((e) => {
          actor.mana[e as ElementType] += 1;
        });
        sound.play('heal');
        this.log(`【${creature.card.nameCn}】灵能涌动，四系基础能量各 +1！`, 'heal');
      }

      // Oracle: deals illusion power to enemy hero
      if (creature.card.ability === 'oracle_illusion_burn') {
        const dmg = Math.max(1, actor.mana.illusion);
        opponent.hp -= dmg;
        this.triggerDamage(who === 'player' ? 'enemy' : 'player', 'hero', dmg);
        sound.play('magic');
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
        sound.play('rats');
        this.log(`【${creature.card.nameCn}】鼠群撕咬全场敌军造成 6 点伤害，牺牲了 3 点 ${chosen.toUpperCase()} 能量！`, 'damage');
      }

      // Basilisk: 4 damage to all enemy creatures with HP <= 8
      if (creature.card.ability === 'basilisk_gaze_4') {
        oppBoard.forEach((opp, oIdx) => {
          if (opp && !opp.spellImmune && opp.currentLife <= 8) {
            opp.currentLife -= 4;
            this.triggerDamage(who === 'player' ? 'enemy' : 'player', oIdx, 4);
            this.log(`【巨蜥】石化凝视，对虚弱的【${opp.card.nameCn}】造成 4 点石化重创！`, 'damage');
          }
        });
        sound.play('gaze');
      }

      // Insanian Lord: 6 damage to opposite creature
      if (creature.card.ability === 'insanian_lord_strike_6') {
        const opp = oppBoard[idx];
        if (opp && !opp.spellImmune) {
          opp.currentLife -= 6;
          this.triggerDamage(who === 'player' ? 'enemy' : 'player', idx, 6);
          sound.play('boom');
          this.log(`【混沌领主】裂地重击对格【${opp.card.nameCn}】，造成 6 点震荡伤害！`, 'damage');
        }
      }

      // Insanian King: summon 4/15 Insanian Guard on random empty slot
      if (creature.card.ability === 'chaos_summon_soldier') {
        const emptyIndices: number[] = [];
        board.forEach((slot, sIdx) => {
          if (slot === null) emptyIndices.push(sIdx);
        });
        if (emptyIndices.length > 0) {
          const spawnIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          board[spawnIdx] = {
            uid: Math.random().toString(36).substring(2, 9),
            card: {
              id: 'chaos_soldier_extra',
              element: 'chaos',
              className: 'chaosmaster',
              name: 'Insanian Guard',
              nameCn: '混沌卫兵',
              type: 'creature',
              cost: 3,
              attack: 4,
              life: 15,
              image: 'InsanianPeacekeeper',
              desc: '混沌卫兵 (4/15)',
              imgUrl: '/cards/InsanianPeacekeeper.jpg',
              imgBigUrl: '/cards/InsanianPeacekeeperBig.jpg',
            },
            owner: who,
            slotIndex: spawnIdx,
            baseAttack: 4,
            currentAttack: 4,
            buffedAttack: false,
            currentLife: 15,
            maxLife: 15,
            isWall: false,
            flying: false,
            spellImmune: false,
            poison: 0,
            regen: 0,
            canAttack: false,
          };
          sound.play('summon');
          this.log(`【混沌君王】号令全场，召唤了一名【混沌卫兵】(4/15) 入驻 [${spawnIdx + 1}号位]！`, 'summon');
        }
      }

      // Enable creature attack
      if (!creature.isWall) {
        creature.canAttack = true;
      }
    });

    this.cleanupDead();
    this.checkWinner();
    this.notify();
  }

  public canPlayCard(who: 'player' | 'enemy', card: CardDef): boolean {
    if (this.gameOver || this.activeTurn !== who || this.isCombatPhase) return false;
    const actor = who === 'player' ? this.player : this.enemy;
    const board = who === 'player' ? this.playerBoard : this.enemyBoard;

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

    if (actor.mana[card.element] < cost) return false;

    if (card.type === 'creature') {
      return board.some((slot) => slot === null);
    }

    if (card.requiresTarget) {
      if (card.id.includes('rescue') || card.id.includes('glory') || card.id.includes('natures_ritual') || card.id.includes('healing_spray') || card.id.includes('haste') || card.id.includes('explosion') || card.id.includes('blood_ritual') || card.id.includes('sacrifice')) {
        return board.some((slot) => slot !== null);
      }
      const opposingBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
      return opposingBoard.some((slot) => slot !== null && !slot.spellImmune);
    }

    return true;
  }

  public async playCard(who: 'player' | 'enemy', card: CardDef, targetSlot?: number): Promise<boolean> {
    if (!this.canPlayCard(who, card)) return false;

    const actor = who === 'player' ? this.player : this.enemy;
    const board = who === 'player' ? this.playerBoard : this.enemyBoard;

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

    actor.mana[card.element] -= finalCost;

    if (who === 'enemy') {
      this.enemyRevealedCardIds.add(card.id);
      if (this.onCardAnnouncement) {
        await this.onCardAnnouncement(who, card);
      }
    } else {
      this.playerRevealedCardIds.add(card.id);
    }

    if (card.type === 'creature') {
      if (targetSlot === undefined || board[targetSlot] !== null) return false;

      if (this.onCardEnterSlot) {
        await this.onCardEnterSlot({ who, card, targetSlot });
      } else {
        sound.play('summon');
      }

      // Check swift aura from neighbors or Merfolk Overlord / Priestess of Moments
      let isSwift = !!card.swift;
      board.forEach((c) => {
        if (c && (c.card.ability === 'double_attack_all_swift' || c.card.ability === 'neighbor_swift')) {
          isSwift = true;
        }
      });

      const initialAtk = (card.attack === -1 && card.ability === 'attack_equal_element_power')
        ? (actor.mana[card.element as ElementType] || 0)
        : (card.attack || 0);

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
        poison: 0,
        regen: card.regen || 0,
        canAttack: isSwift,
      };

      this.lastSummonedUid = creature.uid;
      board[targetSlot] = creature;
      this.recalculateBoardStats();
      this.log(`${actor.name} 在 [${targetSlot + 1}号位] 召唤了【${card.nameCn}】！`, 'summon');
      this.notify();

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

      await this.resolveOnSummon(who, card, targetSlot);
      this.notify();
      await this.delay(450);
      this.cleanupDead();
      this.notify();
    } else {
      if (this.onCardEnterSlot) {
        await this.onCardEnterSlot({ who, card, targetSlot });
      }
      this.log(`${actor.name} 施放了法术【${card.nameCn}】！`, 'info');
      await this.resolveSpell(who, card, targetSlot);
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

  private async resolveOnSummon(who: 'player' | 'enemy', card: CardDef, targetSlot: number): Promise<void> {
    const actor = who === 'player' ? this.player : this.enemy;
    const opponent = who === 'player' ? this.enemy : this.player;
    const opposingSide = who === 'player' ? 'enemy' : 'player';
    const opposingBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
    const myBoard = who === 'player' ? this.playerBoard : this.enemyBoard;
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
              cost: 2,
              attack: 2,
              life: 11,
              poison: 2,
              image: 'GiantSpider',
              imgUrl: './cards/GiantSpider.jpg',
              imgBigUrl: './cards/GiantSpiderBig.jpg',
              desc: '【剧毒】每次造成伤害附加2点中毒。',
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
              poison: 0,
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
        sound.play('flamewave');
        this.log(`【${card.nameCn}】炽烈登场，对敌方英雄与全场敌军各造成 3 点烈焰灼烧！`, 'damage');
        break;
      }
      case 'air_elemental_summon': {
        opponent.hp -= 8;
        this.triggerDamage(opposingSide, 'hero', 8);
        sound.play('thunder');
        this.log(`【${card.nameCn}】雷啸临空，对 ${opponent.name} 造成 8 点狂风重击！`, 'damage');
        break;
      }
      case 'earth_elemental_growth': {
        sound.play('stonerain');
        this.log(`【${card.nameCn}】大地苏醒，使拥有者每回合土系能量成长率 +1！`, 'heal');
        break;
      }
      case 'emissary_sacrifice': {
        const validSacrifices: number[] = [];
        myBoard.forEach((c, idx) => {
          if (c && idx !== targetSlot) validSacrifices.push(idx);
        });
        if (validSacrifices.length > 0) {
          const sacIdx = validSacrifices[0];
          const sac = myBoard[sacIdx]!;
          sac.currentLife = 0;
          this.triggerDamage(who, sacIdx, 999);
          sound.play('cursedfog');
          this.log(`【${card.nameCn}】降临，吞噬献祭了友方【${sac.card.nameCn}】！`, 'damage');
        } else if (myBoard[targetSlot]) {
          myBoard[targetSlot]!.currentLife = 0;
          this.triggerDamage(who, targetSlot, 999);
          this.log(`【${card.nameCn}】由于缺少祭品，无法维持现世形体而湮灭！`, 'damage');
        }
        break;
      }
      case 'damage_all_enemies_5': {
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= 5;
            this.triggerDamage(opposingSide, idx, 5);
          }
        });
        sound.play('flamewave');
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
        sound.play('boom');
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
        sound.play('cursedfog');
        this.log(`【${card.nameCn}】入场冥火轰鸣，对敌方全场生物造成 8 点冥火伤害！`, 'damage');
        break;
      }
      case 'demon_greater_summon': {
        const fireDmg = Math.min(10, Math.max(1, actor.mana.fire));
        opponent.hp -= fireDmg;
        this.triggerDamage(opposingSide, 'hero', fireDmg);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= fireDmg;
            this.triggerDamage(opposingSide, idx, fireDmg);
          }
        });
        sound.play('hellfire');
        this.log(`【${card.nameCn}】深渊降临灭世登场，对敌方英雄及全场生物各造成 ${fireDmg} 点灭世烈焰伤害！`, 'damage');
        break;
      }
      case 'scorpion_stun': {
        const oppSlot = opposingBoard[targetSlot];
        if (oppSlot) {
          oppSlot.canAttack = false;
          sound.play('poison');
          this.log(`【${card.nameCn}】麻痹毒针刺入【${oppSlot.card.nameCn}】，使其麻痹跳过下轮攻击！`, 'damage');
        }
        break;
      }
      case 'angel_holy_3': {
        actor.mana.holy += 3;
        sound.play('heal');
        this.log(`【${card.nameCn}】圣光降临，圣职能量 +3！`, 'heal');
        break;
      }
      case 'timeblazer_teleport': {
        [targetSlot - 1, targetSlot + 1].forEach((sIdx) => {
          if (sIdx >= 0 && sIdx < 6 && myBoard[sIdx]) {
            myBoard[sIdx]!.flying = true;
          }
        });
        sound.play('hasten');
        this.log(`【${card.nameCn}】时空穿梭，赋予两侧相邻友军直击敌方英雄本体的能力！`, 'heal');
        break;
      }
      case 'gain_fire_2': {
        actor.mana.fire += 2;
        sound.play('heal');
        this.log(`【${card.nameCn}】献祭获得火系能量 +2！`, 'heal');
        break;
      }
      case 'water_elemental_summon': {
        actor.hp = Math.min(actor.maxHp, actor.hp + 10);
        this.triggerHeal(who, 'hero', 10);
        sound.play('heal');
        this.log(`【${card.nameCn}】甘霖润泽，为 ${actor.name} 恢复 10 点生命！`, 'heal');
        break;
      }
      case 'griffin_strike': {
        if (actor.mana.air >= 5) {
          opponent.hp -= 5;
          this.triggerDamage(opposingSide, 'hero', 5);
          sound.play('attack');
          this.log(`【${card.nameCn}】气流呼啸，对 ${opponent.name} 造成 5 点直接打击！`, 'damage');
        }
        break;
      }
      case 'faerie_sage_heal': {
        const healAmt = Math.min(10, Math.max(1, actor.mana.earth));
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
          sound.play('thunder');
          this.log(`【${card.nameCn}】重踏落雷，对对格【${oppSlot.card.nameCn}】造成 15 点毁灭打击！`, 'damage');
        }
        break;
      }
      case 'spawn_spiders': {
        [targetSlot - 1, targetSlot + 1].forEach((sIdx) => {
          if (sIdx >= 0 && sIdx < 6 && myBoard[sIdx] === null) {
            myBoard[sIdx] = {
              uid: Math.random().toString(36).substring(2, 9),
              card: {
                id: 'earth_forest_spider',
                element: 'earth',
                name: 'Forest Spider',
                nameCn: '丛林蜘蛛',
                type: 'creature',
                cost: 2,
                attack: 2,
                life: 11,
                image: 'GiantSpider',
                desc: '丛林蜘蛛',
                imgUrl: './cards/GiantSpider.jpg',
                imgBigUrl: './cards/GiantSpiderBig.jpg',
              },
              owner: who,
              slotIndex: sIdx,
              baseAttack: 2,
              currentAttack: 2,
              buffedAttack: false,
              currentLife: 11,
              maxLife: 11,
              isWall: false,
              flying: false,
              spellImmune: false,
              poison: 1,
              regen: 0,
              canAttack: false,
            };
            this.log(`【${card.nameCn}】孵化，在 [${sIdx + 1}号位] 召唤了【地脉土蝼】(2/11)！`, 'summon');
          }
        });
        break;
      }
      case 'banshee_shriek': {
        const opp = opposingBoard[targetSlot];
        if (opp && !opp.spellImmune) {
          const dmg = Math.ceil(opp.currentLife * 0.5);
          opp.currentLife -= dmg;
          this.triggerDamage(opposingSide, targetSlot, dmg);
          sound.play('cursedfog');
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
        sound.play('divineintervention');
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
        sound.play('boom');
        this.log(`【${card.nameCn}】引擎轰鸣碾压进场，对敌方全场生物造成 12 点震荡伤害！`, 'damage');
        break;
      }
      case 'witch_drain_all_2': {
        (['fire', 'water', 'air', 'earth', opponent.specialElement] as ElementType[]).forEach((e) => {
          opponent.mana[e] = Math.max(0, opponent.mana[e] - 2);
        });
        sound.play('cursedfog');
        this.log(`【${card.nameCn}】枯萎诅咒，剥夺敌方各系能量 2 点！`, 'damage');
        break;
      }
      case 'giant_skip_turn': {
        this.skipNextTurn[opposingSide] = true;
        sound.play('stonerain');
        this.log(`【${card.nameCn}】泰山压顶，强制敌方跳过下一个出牌回合！`, 'damage');
        break;
      }
      case 'assassin_strike_12': {
        opponent.hp -= 12;
        this.triggerDamage(opposingSide, 'hero', 12);
        sound.play('attack');
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
        sound.play('boom');
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
        sound.play('chaowave');
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
        sound.play('lightning');
        this.log(`【${card.nameCn}】时空扭转，允许本回合额外打出一张卡牌！`, 'heal');
        break;
      }
      case 'goblin_raider_squad': {
        let spawned = 0;
        myBoard.forEach((slot, sIdx) => {
          if (slot === null && spawned < 2) {
            myBoard[sIdx] = {
              uid: Math.random().toString(36).substring(2, 9),
              card: {
                id: 'goblin_raider_extra',
                element: 'special',
                name: 'Goblin Raider',
                nameCn: '䍶䍶先锋',
                type: 'creature',
                cost: 2,
                attack: 3,
                life: 15,
                image: 'Shanhai_DongDong',
                desc: '䍶䍶先锋',
                imgUrl: './cards/Shanhai_DongDong.jpg',
                imgBigUrl: './cards/Shanhai_DongDongBig.jpg',
              },
              owner: who,
              slotIndex: sIdx,
              baseAttack: 3,
              currentAttack: 3,
              buffedAttack: false,
              currentLife: 15,
              maxLife: 15,
              isWall: false,
              flying: false,
              spellImmune: false,
              poison: 0,
              regen: 0,
              canAttack: false,
            };
            spawned++;
            this.log(`【${card.nameCn}】分队集结，空降至 [${sIdx + 1}号位]！`, 'summon');
          }
        });
        break;
      }
    }
  }

  private async resolveSpell(who: 'player' | 'enemy', card: CardDef, targetSlot?: number) {
    const actor = who === 'player' ? this.player : this.enemy;
    const opponent = who === 'player' ? this.enemy : this.player;
    const opposingSide = who === 'player' ? 'enemy' : 'player';
    const opposingBoard = who === 'player' ? this.enemyBoard : this.playerBoard;
    const myBoard = who === 'player' ? this.playerBoard : this.enemyBoard;

    // Check spell amplifier (Dragon: +50% spell damage)
    let spellAmp = 1.0;
    myBoard.forEach((c) => {
      if (c && c.card.ability === 'spell_damage_50_percent') spellAmp = 1.5;
      if (c && c.card.ability === 'spell_damage_plus_1') spellAmp += 0.2;
    });

    switch (card.spellEffect) {
      case 'damage_all_enemy_creatures_9': {
        const dmg = Math.ceil(9 * spellAmp);
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
        const mainDmg = Math.ceil(18 * spellAmp);
        const aoeDmg = Math.ceil(10 * spellAmp);
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
        const dmg = Math.ceil(15 * spellAmp);
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
          }
        });
        (['fire', 'water', 'air', 'earth', opponent.specialElement] as ElementType[]).forEach((e) => {
          opponent.mana[e] = Math.max(0, opponent.mana[e] - 1);
        });
        this.log(`【${card.nameCn}】腐蚀全场，所有生物受到 ${dmg} 点侵蚀伤害，削减敌方各系能量 1 点！`, 'damage');
        break;
      }
      case 'call_to_thunder_6': {
        const dmg = Math.ceil(6 * spellAmp);
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
        const base = 5 + actor.mana.air;
        const dmg = Math.ceil(base * spellAmp);
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        this.log(`【${card.nameCn}】雷霆呼啸，对 ${opponent.name} 造成 ${dmg} 点直击雷电伤害！`, 'damage');
        break;
      }
      case 'chain_lightning_9': {
        const dmg = Math.ceil(9 * spellAmp);
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
        const healAmt = actor.mana.earth * 2;
        actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
        this.triggerHeal(who, 'hero', healAmt);
        this.log(`【${card.nameCn}】大地回春，为 ${actor.name} 恢复 ${healAmt} 点生命！`, 'heal');
        break;
      }
      case 'stone_rain_25': {
        const dmg = Math.ceil(25 * spellAmp);
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
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
        const mainD = Math.ceil(9 * spellAmp);
        const subD = Math.ceil(6 * spellAmp);
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
        const dmg = Math.ceil(5 * spellAmp);
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
        const burnDmg = Math.ceil(maxVal * spellAmp);
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
            t.currentLife = 0;
            this.triggerDamage(opposingSide, targetSlot, 99);
          }
        }
        const aoe = Math.ceil(11 * spellAmp);
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
          }
        });
        this.log(`【${card.nameCn}】圣辉洗礼，己方全员生命回满且攻击力永久 +3！`, 'heal');
        break;
      }
      case 'dark_ritual_3': {
        const dmg = Math.ceil(3 * spellAmp);
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
        const dmg = Math.ceil(12 * spellAmp);
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !c.spellImmune) c.currentLife -= dmg;
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
          sac.currentLife = 0;
          const aoe = Math.ceil(sacLife * spellAmp);
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
        const blast = Math.ceil(12 * spellAmp);
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && c.slotIndex !== targetSlot && !c.spellImmune) {
            c.currentLife -= blast;
            this.triggerDamage(c.owner, c.slotIndex, blast);
          }
        });
        this.log(`【${card.nameCn}】圣疗目标 12 点生命，神裁轰击全场其它生物造成 12 点圣火暴击！`, 'damage');
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
        const dmg = Math.ceil(19 * spellAmp);
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
          const dmg = Math.ceil(25 * spellAmp);
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
        const base = 8 + actor.mana.fire;
        const dmg = Math.ceil(base * spellAmp);
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            this.triggerDamage(c.owner, c.slotIndex, dmg);
          }
        });
        sound.play('hellfire');
        this.log(`【${card.nameCn}】末日降临，对全场所有生物和 ${opponent.name} 造成 ${dmg} 点毁灭伤害！`, 'damage');
        break;
      }
      case 'tornado_destroy': {
        if (targetSlot !== undefined && opposingBoard[targetSlot]) {
          const t = opposingBoard[targetSlot]!;
          if (!t.spellImmune) {
            t.currentLife = 0;
            this.triggerDamage(opposingSide, targetSlot, 999);
            sound.play('thunder');
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
        const dmg = Math.ceil(totalAtk * spellAmp);
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        sound.play('stonerain');
        this.log(`【${card.nameCn}】汇聚全场至强力量，对 ${opponent.name} 造成 ${dmg} 点自然咆哮伤害！`, 'damage');
        break;
      }
      case 'drain_souls': {
        let killedCount = 0;
        [...myBoard, ...opposingBoard].forEach((c) => {
          if (c && !c.spellImmune) {
            c.currentLife = 0;
            this.triggerDamage(c.owner, c.slotIndex, 999);
            killedCount++;
          }
        });
        const heal = killedCount * 2;
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        if (heal > 0) this.triggerHeal(who, 'hero', heal);
        sound.play('cursedfog');
        this.log(`【${card.nameCn}】收割灵魂消灭 ${killedCount} 个生物，为 ${actor.name} 恢复 ${heal} 点生命！`, 'damage');
        break;
      }
      case 'wrath_of_god': {
        const dmg = Math.ceil(12 * spellAmp);
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
        sound.play('strenghtening');
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
        sound.play('magic');
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
        sound.play('poison');
        this.log(`【${card.nameCn}】剧毒之云笼罩，敌方各系能量 -1，并对敌全场生物造成现存生命 50% 的剧毒重创！`, 'damage');
        break;
      }
      case 'demon_power_chains_12': {
        if (targetSlot !== undefined && opposingBoard[targetSlot]) {
          const t = opposingBoard[targetSlot]!;
          if (!t.spellImmune) {
            const dmg = Math.ceil(12 * spellAmp);
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
        const dmg = Math.ceil(13 * spellAmp);
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
          sac.currentLife = 0;
          this.triggerDamage(who, targetSlot, 999);
          ['fire', 'water', 'air', 'earth'].forEach((e) => {
            actor.mana[e as ElementType] = (actor.mana[e as ElementType] || 0) + 3;
          });
          sound.play('cursedfog');
          this.log(`【${card.nameCn}】献祭友方【${sac.card.nameCn}】，施法者火、水、气、土能量各 +3！`, 'heal');
        }
        break;
      }
      case 'sonic_boom': {
        const dmg = Math.ceil(11 * spellAmp);
        opponent.hp -= dmg;
        this.triggerDamage(opposingSide, 'hero', dmg);
        opposingBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) {
            c.currentLife -= dmg;
            c.canAttack = false;
            this.triggerDamage(opposingSide, idx, dmg);
          }
        });
        sound.play('boom');
        this.log(`【${card.nameCn}】震荡音波重创敌方英雄及全场生物 ${dmg} 点伤害，并使其震晕跳过下轮攻击！`, 'damage');
        break;
      }
      case 'goblin_rescue_heal_5': {
        if (targetSlot !== undefined && myBoard[targetSlot]) {
          const t = myBoard[targetSlot]!;
          t.currentLife = Math.min(t.maxLife, t.currentLife + 5);
          this.triggerHeal(who, targetSlot, 5);
          const emptyIndices: number[] = [];
          myBoard.forEach((slot, idx) => {
            if (slot === null && idx !== targetSlot) emptyIndices.push(idx);
          });
          if (emptyIndices.length > 0) {
            const newSlot = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            myBoard[newSlot] = t;
            myBoard[targetSlot] = null;
            t.slotIndex = newSlot;
            this.log(`【${card.nameCn}】救援撤离【${t.card.nameCn}】至 [${newSlot + 1}号位]，并为其恢复 5 点生命！`, 'heal');
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
    }
  }

  public async passTurn(who: 'player' | 'enemy'): Promise<void> {
    if (this.gameOver || this.activeTurn !== who || this.isCombatPhase) return;
    const actor = who === 'player' ? this.player : this.enemy;
    this.log(`${actor.name} 选择了跳过本轮出牌。`, 'info');

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

    for (let slot = 0; slot < attackerBoard.length; slot++) {
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

      const defender = defenderBoard[slot];

      // 1. Trigger lunge animation callback
      if (this.onAttackLunge) {
        this.onAttackLunge(attackerSide, slot);
      }
      sound.play('attack');
      await this.delay(500);

      // 2. Deliver damage
      const isCleave = attacker.card.ability === 'cleave_all_enemies';

      if (attacker.flying || isCleave) {
        // Direct hero hit or cleave
        let heroDmg = attacker.currentAttack;

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
          this.log(`【${elephant.card.nameCn}】崇高舍身，代替 ${defenderHero.name} 承受了 ${heroDmg} 点伤害！`, 'heal');
        } else {
          defenderHero.hp -= heroDmg;
          this.triggerDamage(defenderSide, 'hero', heroDmg);
          this.log(`【${attacker.card.nameCn}】越过战线，直接对 ${defenderHero.name} 造成 ${heroDmg} 点伤害！`, 'attack');

          if (attacker.card.ability === 'lich_power_drain') {
            const attackerHeroObj = attackerSide === 'player' ? this.player : this.enemy;
            attackerHeroObj.mana.death = (attackerHeroObj.mana.death || 0) + 2;
            this.log(`【巫妖王】吸取死灵精粹，死灵能量 +2！`, 'heal');
          }

          if (attacker.card.ability === 'goblin_burn_card') {
            const elems: ElementType[] = ['fire', 'water', 'air', 'earth', defenderHero.specialElement];
            const chosen = elems[Math.floor(Math.random() * elems.length)];
            defenderHero.mana[chosen] = Math.max(0, defenderHero.mana[chosen] - 2);
            this.log(`【${attacker.card.nameCn}】突袭破坏，削减 ${defenderHero.name} 的 2 点 ${chosen.toUpperCase()} 能量！`, 'damage');
          }
        }

        if (isCleave) {
          defenderBoard.forEach((opp, oIdx) => {
            if (opp) {
              opp.currentLife -= attacker.currentAttack;
              this.triggerDamage(defenderSide, oIdx, attacker.currentAttack);
            }
          });
          this.log(`【${attacker.card.nameCn}】横扫全场，对敌方全线生物造成 ${attacker.currentAttack} 点横扫伤害！`, 'attack');
        }
      } else if (defender) {
        let dmg = attacker.currentAttack;

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
          defender.currentLife -= dmg;
          this.triggerDamage(defenderSide, slot, dmg);
          this.log(`【${attacker.card.nameCn}】重击【${defender.card.nameCn}】，造成 ${dmg} 点伤害！`, 'attack');

          // Wall of Reflection
          if (defender.card.ability === 'reflect_to_hero') {
            const attackerHero = attackerSide === 'player' ? this.player : this.enemy;
            attackerHero.hp -= dmg;
            this.triggerDamage(attackerSide, 'hero', dmg);
            this.log(`【${defender.card.nameCn}】神镜反弹，将 ${dmg} 点伤害如实折射至 ${attackerHero.name}！`, 'damage');
          }

          // Vampirism
          if (attacker.card.ability === 'vampirism') {
            attacker.currentLife = Math.min(attacker.maxLife, attacker.currentLife + dmg);
            this.triggerHeal(attackerSide, slot, dmg);
          }

          // Poison trait: injects poison into the damaged creature
          if (attacker.card.poison && !defender.spellImmune && dmg > 0) {
            defender.poison = (defender.poison || 0) + (attacker.card.poison || 2);
            sound.play('poison');
            this.log(`【${attacker.card.nameCn}】注入剧毒，【${defender.card.nameCn}】身中剧毒（每回合受 ${defender.poison} 点毒素伤害）！`, 'damage');
          }
        }
      } else {
        let heroDmg = attacker.currentAttack;

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
          this.log(`【${elephant.card.nameCn}】舍身庇佑，代替 ${defenderHero.name} 承担了 ${heroDmg} 点直接伤害！`, 'heal');
        } else {
          defenderHero.hp -= heroDmg;
          this.triggerDamage(defenderSide, 'hero', heroDmg);
          this.log(`【${attacker.card.nameCn}】直入中军，对 ${defenderHero.name} 造成 ${heroDmg} 点打击伤害！`, 'attack');

          if (attacker.card.ability === 'lich_power_drain') {
            const attackerHeroObj = attackerSide === 'player' ? this.player : this.enemy;
            attackerHeroObj.mana.death = (attackerHeroObj.mana.death || 0) + 2;
            this.log(`【巫妖王】吸取死灵精粹，死灵能量 +2！`, 'heal');
          }

          if (attacker.card.ability === 'goblin_burn_card') {
            const elems: ElementType[] = ['fire', 'water', 'air', 'earth', defenderHero.specialElement];
            const chosen = elems[Math.floor(Math.random() * elems.length)];
            defenderHero.mana[chosen] = Math.max(0, defenderHero.mana[chosen] - 2);
            this.log(`【${attacker.card.nameCn}】突袭破坏，削减 ${defenderHero.name} 的 2 点 ${chosen.toUpperCase()} 能量！`, 'damage');
          }
        }
      }

      // 3. Card impact visual
      if (this.onCardImpact) {
        this.onCardImpact(defenderSide, defender ? slot : 'hero');
      }

      this.cleanupDead();
      this.notify();
      await this.delay(750);
    }

    // End-of-combat triggers (e.g. Goblin Portal Jumper)
    attackerBoard.forEach((c, slotIdx) => {
      if (c && c.card.ability === 'portal_jumper_stun_jump') {
        const opp = defenderBoard[slotIdx];
        if (opp) {
          opp.canAttack = false;
          this.log(`【${c.card.nameCn}】虚空跃迁掷出闪光弹，使对格敌军致盲跳过下轮攻击！`, 'damage');
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
    });

    this.cleanupDead();
    this.checkWinner();
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

  private triggerDamage(side: 'player' | 'enemy', slot: number | 'hero', amount: number) {
    if (this.onDamageEffect) {
      this.onDamageEffect(side, slot, amount);
    }
    if (this.isLanGame && this.isHost && this.onVfxBroadcast) {
      this.onVfxBroadcast({ type: 'damage', payload: { side, slot, amount } });
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
          if (creature.card.ability === 'demon_lemure_rebirth') {
            board[idx] = {
              ...creature,
              currentAttack: 3,
              currentLife: 6,
              maxLife: 6,
              canAttack: false,
            };
            this.log(`【${creature.card.nameCn}】深渊裂变，重生为【惊恐獦狚】(3/6)！`, 'summon');
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

          if (creature.card.ability === 'phoenix_rebirth' && actor.mana.fire >= 10) {
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
        let totalAtk = (c.card.ability === 'attack_equal_element_power')
          ? (sideHero.mana[c.card.element as ElementType] || 0)
          : c.baseAttack;

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

          // Wolverine: berserk attack +2 when currentLife <= half maxLife
          if (c.card.ability === 'wolverine_berserk_regen' && c.currentLife <= Math.floor(c.maxLife / 2)) {
            totalAtk += 2;
          }
        }

        c.currentAttack = Math.max(0, totalAtk);
        c.buffedAttack = c.currentAttack > c.baseAttack;
      });
    });
  }

  public checkWinner() {
    if (this.enemy.hp <= 0 && this.player.hp <= 0) {
      this.gameOver = true;
      this.winner = 'player';
      sound.play('victory');
      this.log('⚔️ 双方英雄同时力竭，判定玩家获胜！', 'heal');
    } else if (this.enemy.hp <= 0) {
      this.gameOver = true;
      this.winner = 'player';
      sound.play('victory');
      this.log(`🎉 恭喜！你击败了 ${this.enemy.name}，斩获了对决的胜利！`, 'heal');

      // Save campaign level unlock
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
    } else if (this.player.hp <= 0) {
      this.gameOver = true;
      this.winner = 'enemy';
      sound.play('defeat');
      this.log(`💀 你的生命值耗尽，被 ${this.enemy.name} 击败了！`, 'damage');
    }
  }

  private async triggerAiTurn(): Promise<void> {
    if (this.gameOver || this.activeTurn !== 'enemy' || this.isCombatPhase) return;

    const playableCards = this.enemy.hand.filter((c) => this.canPlayCard('enemy', c));
    if (playableCards.length === 0) {
      await this.passTurn('enemy');
      return;
    }

    // Easy difficulty occasional hesitation
    if (this.difficulty === '容易' && Math.random() < 0.3 && this.enemyBoard.some((c) => c !== null)) {
      await this.passTurn('enemy');
      return;
    }

    const emptySlots: number[] = [];
    this.enemyBoard.forEach((slot, idx) => {
      if (slot === null) emptySlots.push(idx);
    });

    let bestSlot = emptySlots[0];
    let maxOpponentThreat = -1;
    emptySlots.forEach((slot) => {
      const opp = this.playerBoard[slot];
      if (opp && opp.currentAttack > maxOpponentThreat) {
        maxOpponentThreat = opp.currentAttack;
        bestSlot = slot;
      }
    });

    // In Hard/Master difficulty, sort playable creatures by stats
    const creatures = playableCards
      .filter((c) => c.type === 'creature')
      .sort((a, b) => {
        if (this.difficulty === '大法师' || this.difficulty === '困难') {
          return ((b.attack || 0) + (b.life || 0)) - ((a.attack || 0) + (a.life || 0));
        }
        return 0;
      });

    const hasEnemyTarget = this.playerBoard.some((c) => c !== null);
    const spell = playableCards.find((c) => c.type === 'spell' && (hasEnemyTarget || !c.requiresTarget));
    const creature = creatures[0];

    const preferSpellThreshold = (this.difficulty === '大法师' || this.difficulty === '困难') ? 0.3 : 0.45;

    if (spell && Math.random() > preferSpellThreshold) {
      let targetSlot = undefined;
      if (spell.requiresTarget) {
        const validTargets: { idx: number; atk: number }[] = [];
        this.playerBoard.forEach((c, idx) => {
          if (c && !c.spellImmune) validTargets.push({ idx, atk: c.currentAttack });
        });
        if (validTargets.length > 0) {
          validTargets.sort((a, b) => b.atk - a.atk);
          targetSlot = validTargets[0].idx;
        }
      }
      await this.playCard('enemy', spell, targetSlot);
    } else if (creature && bestSlot !== undefined) {
      await this.playCard('enemy', creature, bestSlot);
    } else if (playableCards.length > 0) {
      const card = playableCards[0];
      const slot = card.type === 'creature' ? bestSlot : undefined;
      await this.playCard('enemy', card, slot);
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
      'chaosmaster', 'illusionist', 'demonologist', 'beastmaster', 'chronomancer', 'goblin'
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
