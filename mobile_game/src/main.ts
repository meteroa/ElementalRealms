import './style.css';
import { SpectromancerEngine } from './engine/game';
import type { CardDef, ElementType, HeroClass, CampaignLevel } from './types';
import campaignData from './data/campaign.json';
import { sound } from './engine/sound';

type ViewMode = 'menu' | 'single_duel_setup' | 'campaign' | 'battle';

let currentView: ViewMode = 'menu';

// Single Duel Setup State
let playerFaceIndex = 0; // Face1
let playerClassIndex = 0; // 0 = 随机, 1..11 = classes
let aiFaceIndex = 5; // Face6 (Archmage)
let aiClassIndex = 0; // 0 = 随机
let showClassGridPickerFor: 'player' | 'ai' | null = null;
let showHelpModal: boolean = false;
let showOptionsModal: boolean = false;
let showSurrenderModal: boolean = false;
let showOpponentHand: boolean = false;
let aiAnnouncedCard: CardDef | null = null;

const HERO_CLASSES: { id: HeroClass | 'random'; nameCn: string; icon: string; desc: string }[] = [
  { id: 'random', nameCn: '随机', icon: '🎲', desc: '随机选择一个强大的法师流派' },
  { id: 'sorcery', nameCn: '巫术', icon: '🔮', desc: '经典巫术大师，拥有控制与伤害法术，掌握冥想与心智震撼' },
  { id: 'necromancer', nameCn: '死灵', icon: '💀', desc: '召唤哀嚎女妖、吸血鬼与巫妖领主，吸取敌人生命转化为己用' },
  { id: 'cleric', nameCn: '圣职', icon: '✨', desc: '召唤圣骑士、十字军与大天使，擅长神圣护盾与群体圣疗' },
  { id: 'mechanician', nameCn: '机械', icon: '⚙️', desc: '部署矮人工匠、火枪手、扑翼轰炸机与重型蒸汽坦克' },
  { id: 'dominator', nameCn: '支配', icon: '👁️', desc: '操控萨满与阻尼塔削减敌方能量，召唤远古女巫与窃心魔' },
  { id: 'chaosmaster', nameCn: '混沌', icon: '🌀', desc: '操控混沌维和者、狂战士、混沌投石机与死棘，极具爆发力' },
  { id: 'illusionist', nameCn: '幻术', icon: '🪞', desc: '操纵镜面反射之墙、幻像勇士与幽幻刺客，虚实转换制敌' },
  { id: 'demonologist', nameCn: '恶魔', icon: '🔥', desc: '役使劣魔、恶果魔与大恶魔，施放自爆与地狱烈焰' },
  { id: 'beastmaster', nameCn: '兽王', icon: '🐺', desc: '统御魔法仓鼠、狼獾、死亡之隼与远古巨龙，掌控全系野性灵能' },
  { id: 'chronomancer', nameCn: '时空', icon: '⏳', desc: '操纵时空猎人、时间闪击者、时间停止与时间之龙，掌控额外行动回合' },
  { id: 'goblin', nameCn: '哥布林', icon: '👺', desc: '统御哥布林英雄、爆破者、鼠疫入侵与袭掠军，战术机动与牌库破坏' },
];

let engine = new SpectromancerEngine('sorcery');

let selectedCard: CardDef | null = null;
let inspectedCard: CardDef | null = null;
let selectedCampaignChapter = 1;
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
  citadel: '/ui/battlefield_citadel.jpg',
  sky: '/ui/battlefield_sky.jpg',
  volcano: '/ui/battlefield_volcano.jpg',
  forest: '/ui/battlefield_forest.jpg',
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

    if (data.currentBattlefieldTheme) {
      currentBattlefieldTheme = data.currentBattlefieldTheme;
    }

    selectedCard = null;
    inspectedCard = null;
    showOpponentHand = false;
    return true;
  } catch (err) {
    console.error('Failed to load saved battle:', err);
    return false;
  }
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

  let destEl: HTMLElement | null = null;
  if (card.type === 'creature' && targetSlot !== undefined) {
    destEl = document.querySelector(`.combat-board-slot[data-side="${who}"][data-slot-index="${targetSlot}"]`);
  } else if (card.type === 'spell' && targetSlot !== undefined) {
    const oppSide = who === 'player' ? 'enemy' : 'player';
    destEl = document.querySelector(`.combat-board-slot[data-side="${oppSide}"][data-slot-index="${targetSlot}"]`);
  } else {
    destEl = document.querySelector('.combat-battlefield-section');
  }

  let sLeft = window.innerWidth * 0.5;
  let sTop = window.innerHeight * 0.85;
  let sWidth = 48;
  let sHeight = 64;

  if (sourceEl) {
    const sRect = sourceEl.getBoundingClientRect();
    if (sRect.width > 0 && sRect.height > 0) {
      sLeft = sRect.left;
      sTop = sRect.top;
      sWidth = sRect.width;
      sHeight = sRect.height;
    }
    sourceEl.classList.add('card-flying-out');
  }

  let dLeft = window.innerWidth * 0.5;
  let dTop = window.innerHeight * 0.35;
  let dWidth = 55;
  let dHeight = 75;

  if (destEl) {
    const dRect = destEl.getBoundingClientRect();
    if (dRect.width > 0 && dRect.height > 0) {
      dLeft = dRect.left;
      dTop = dRect.top;
      dWidth = dRect.width;
      dHeight = dRect.height;
    }
  }

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
    <div class="flying-card-inner">
      <img src="${card.imgUrl}" class="flying-card-img" alt="${card.nameCn}" />
      <div class="flying-card-name">${card.nameCn}</div>
      ${card.type === 'creature' ? `
        <div class="flying-card-stats">
          <span class="flying-stat-atk">⚔️ ${card.attack}</span>
          <span class="flying-stat-hp">❤️ ${card.life}</span>
        </div>
      ` : ''}
    </div>
  `;
  document.body.appendChild(ghost);

  const deltaX = (dLeft + dWidth / 2) - (sLeft + sWidth / 2);
  const deltaY = (dTop + dHeight / 2) - (sTop + sHeight / 2);
  const arcApexY = deltaY * 0.45 + (who === 'player' ? -50 : 40);
  const scaleEnd = sWidth > 0 ? (dWidth / sWidth) : 1;

  try {
    const animation = ghost.animate(
      [
        { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', opacity: 0.95 },
        { transform: `translate(${deltaX * 0.4}px, ${arcApexY}px) scale(1.18) rotate(${who === 'player' ? -8 : 8}deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleEnd}) rotate(0deg)`, opacity: 0.95 }
      ],
      {
        duration: 720,
        easing: 'cubic-bezier(0.22, 0.85, 0.32, 1)',
        fill: 'forwards'
      }
    );
    await animation.finished;
  } catch {
    // Graceful catch if animation cancelled
  } finally {
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

function setupEngineCallbacks() {
  engine.onCardAnnouncement = async (_who, card) => {
    aiAnnouncedCard = card;
    render();
    sound.play('click');
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
      setTimeout(() => targetEl?.classList.remove('card-impact-hit'), 450);
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
          <img src="/ui/game_logo.svg" class="mobile-menu-logo" alt="元素秘境" />
        </div>

        <div class="mobile-menu-util-bar">
          <button class="menu-util-btn ${hasSavedBattle ? 'has-save-highlight' : ''}" id="btn-menu-load-save" title="${hasSavedBattle ? '读取并继续上次保存的对战进度' : '当前暂无对战存档'}">
            <span class="util-icon">💾</span>
            <span class="util-label">${hasSavedBattle ? '读取存档' : '暂无存档'}</span>
          </button>
          <button class="menu-util-btn" id="btn-menu-help" title="游戏玩法与规则">
            <span class="util-icon">📖</span>
            <span class="util-label">玩法规则</span>
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
              <div class="mode-card-desc">自定义 12 大流派与 78 款头像，人机快速博弈</div>
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
              <div class="mode-card-desc">查阅 120 张官方正版卡牌与特技秘典</div>
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
        <div class="menu-version-text">v 2.0.0 Mobile · HD</div>
      </div>
    </div>
  `;
}

function renderSingleDuelSetup(): string {
  const pClassObj = HERO_CLASSES[playerClassIndex];
  const aiClassObj = HERO_CLASSES[aiClassIndex];

  const pFaceUrl = `/faces/Face${playerFaceIndex + 1}.jpg`;
  const aiFaceUrl = `/faces/Face${aiFaceIndex + 1}.jpg`;

  return `
    <div class="main-menu-view" style="filter: brightness(0.4) blur(4px);"></div>
    <div class="single-duel-overlay" id="single-duel-overlay">
      <div class="single-duel-frame">
        <div class="single-duel-title-banner">
          <div class="single-duel-title">单局对战</div>
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
                ${pClassObj.icon} ${pClassObj.nameCn}
              </div>
              <button class="duel-mini-arrow" id="btn-player-class-next">▶</button>
              <button class="duel-wrench-btn" id="btn-player-class-grid" title="打开职业列表">⚙</button>
            </div>
            <div class="duel-class-desc">${pClassObj.desc}</div>
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
                ${aiClassObj.icon} ${aiClassObj.nameCn}
              </div>
              <button class="duel-mini-arrow" id="btn-ai-class-next">▶</button>
              <button class="duel-wrench-btn" id="btn-ai-class-grid" title="打开职业列表">⚙</button>
            </div>
            <div class="duel-class-desc">${aiClassObj.desc}</div>
          </div>
        </div>

        <!-- BOTTOM BUTTONS -->
        <div class="duel-actions-row">
          <button class="duel-stone-action-btn start" id="btn-start-duel">⚔ 开始对决</button>
          <button class="duel-stone-action-btn close" id="btn-close-duel">关闭</button>
        </div>
      </div>
    </div>
    ${showClassGridPickerFor ? renderClassGridPickerModal(showClassGridPickerFor) : ''}
  `;
}

function renderClassGridPickerModal(target: 'player' | 'ai'): string {
  const currentIdx = target === 'player' ? playerClassIndex : aiClassIndex;
  return `
    <div class="class-grid-modal-overlay" id="class-grid-overlay">
      <div class="class-grid-card">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(198,155,63,0.3); padding-bottom:8px;">
          <h3 style="color:#ffd700; font-size:17px; font-weight:900;">选择【${target === 'player' ? '玩家' : '电脑对手'}】职业流派</h3>
          <button class="modal-close-btn" id="btn-close-class-grid" style="position:static; width:28px; height:28px;">×</button>
        </div>
        <div class="class-grid-list">
          ${HERO_CLASSES.map((cls, idx) => `
            <div class="class-grid-item ${currentIdx === idx ? 'active' : ''}" data-target="${target}" data-class-index="${idx}">
              <div class="class-grid-icon">${cls.icon}</div>
              <div class="class-grid-name">${cls.nameCn}</div>
              <div style="font-size:10px; color:#cbd5e1; text-align:center; line-height:1.3;">${cls.desc.substring(0, 22)}...</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderHelpModal(): string {
  return `
    <div class="modal-overlay" id="help-modal-overlay">
      <div class="campaign-modal" style="max-width:540px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(198,155,63,0.3); padding-bottom:6px;">
          <h2 style="font-size:18px; color:#ffd700; font-weight:900;">📖 《元素秘境：魔导对决》指南</h2>
          <button class="modal-close-btn" id="btn-close-help" style="position:static; width:28px; height:28px;">×</button>
        </div>
        <div style="font-size:13.5px; line-height:1.6; color:#e2e8f0; display:flex; flex-direction:column; gap:10px; overflow-y:auto; max-height:60vh; padding-right:6px;">
          <div>
            <strong style="color:#f59e0b;">一、能量与卡组机制：</strong><br/>
            由《万智牌》创始人理查·加菲设计。双方每局从 5 大系（火、水、气、土 + 所选专精职业）各抽取 4 张卡，共 20 张手牌。<br/>
            每回合各系能量自动增长 1 点，无需洗牌或摸牌。
          </div>
          <div>
            <strong style="color:#38bdf8;">二、槽位召唤与法术：</strong><br/>
            战场由双方各 5 个平行槽位构成。点击手牌中已激活的生物卡，再点击己方空槽位即可召唤。点击法术卡可对敌方生物或英雄施放。
          </div>
          <div>
            <strong style="color:#4ade80;">三、冲锋与决战胜负：</strong><br/>
            回合结束时，己方生物自动冲锋攻击正对面的敌方生物。若正对面为空槽，则伤害将全部直击敌方英雄！先将对方英雄生命降至 0 者获胜！
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderOptionsModal(): string {
  return `
    <div class="modal-overlay" id="options-modal-overlay">
      <div class="campaign-modal" style="max-width:400px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid rgba(198,155,63,0.3); padding-bottom:6px;">
          <h2 style="font-size:18px; color:#ffd700; font-weight:900;">⚙️ 游戏选项与音频</h2>
          <button class="modal-close-btn" id="btn-close-options" style="position:static; width:28px; height:28px;">×</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; color:#f1f5f9;">背景音乐 (BGM)</span>
            <button class="duel-stone-action-btn close" id="btn-toggle-bgm" style="padding:5px 16px; font-size:12px;">
              ${sound.bgmEnabled ? '🔊 已开启' : '🔇 已静音'}
            </button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; color:#f1f5f9;">战斗音效 (SFX)</span>
            <button class="duel-stone-action-btn close" id="btn-toggle-sfx" style="padding:5px 16px; font-size:12px;">
              ${sound.enabled ? '🔔 已开启' : '🔕 已静音'}
            </button>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:14px; color:#f1f5f9;">对战战场背景</span>
              <span style="font-size:12px; color:#ffd700; font-weight:800;">${getThemeName(currentBattlefieldTheme)}</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px;">
              <button class="duel-stone-action-btn ${currentBattlefieldTheme === 'citadel' ? 'start' : 'close'}" id="btn-theme-citadel" style="padding:4px 2px; font-size:11px; text-align:center;">星辉圣殿</button>
              <button class="duel-stone-action-btn ${currentBattlefieldTheme === 'sky' ? 'start' : 'close'}" id="btn-theme-sky" style="padding:4px 2px; font-size:11px; text-align:center;">天界圣峰</button>
              <button class="duel-stone-action-btn ${currentBattlefieldTheme === 'volcano' ? 'start' : 'close'}" id="btn-theme-volcano" style="padding:4px 2px; font-size:11px; text-align:center;">熔岩炼狱</button>
              <button class="duel-stone-action-btn ${currentBattlefieldTheme === 'forest' ? 'start' : 'close'}" id="btn-theme-forest" style="padding:4px 2px; font-size:11px; text-align:center;">永恒密林</button>
            </div>
          </div>
          ${currentView === 'battle' ? `
            <div class="options-save-quit-box" style="border-top:1px solid rgba(198,155,63,0.3); padding-top:12px; margin-top:2px; display:flex; flex-direction:column; gap:6px;">
              <button class="duel-stone-action-btn start" id="btn-options-save-quit" style="width:100%; height:40px; font-size:14.5px; font-weight:900; background:linear-gradient(180deg, #c2410c 0%, #7c2d12 100%); border-color:#ffd700; color:#fff;">
                💾 保存战斗并返回主菜单
              </button>
              <div style="font-size:11.5px; color:#cbd5e1; text-align:center; opacity:0.85;">
                自动保存当前血量、能量、场上与手牌数据，主菜单可随时读取恢复
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
  return `
    <div class="ai-announcement-overlay" id="ai-announcement-overlay">
      <div class="ai-announcement-wrapper">
        <div class="ai-announcement-header">👑 ${engine.enemy.name} 正在施放 / 召唤</div>
        <div class="ai-announcement-card-frame">
          <!-- Left: Card in slot -->
          <div class="ai-announcement-card-slot">
            <img src="${card.imgUrl}" class="ai-announcement-card-art" alt="${card.nameCn}" />
            <div class="ai-card-cost">${card.cost}</div>
            <div class="ai-card-name">${card.nameCn}</div>
            ${card.type === 'creature' ? `
              <div class="ai-card-footer">
                <span class="badge-atk">${card.attack}</span>
                <span class="badge-hp">${card.life}</span>
              </div>
            ` : ''}
          </div>
          <!-- Right: Parchment Description -->
          <div class="ai-announcement-desc-slot">
            <div class="ai-desc-title">${card.nameCn} (${card.cost}费)</div>
            <div class="ai-desc-sub">${clsName} · ${card.type === 'creature' ? '生物' : '法术'} · ${card.name}</div>
            ${card.type === 'creature' ? `
              <div class="ai-desc-stats">⚔️ 攻击: ${card.attack} ｜ ❤️ 生命: ${card.life}</div>
            ` : ''}
            <div class="ai-desc-text">${card.desc}</div>
          </div>
        </div>
        <div class="ai-announcement-footer">轻触屏幕任意位置继续 ⏩</div>
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
      <!-- 1. LEFT PANEL: DUO TOP SECTION (HEROES + CONTROLS), DOUBLE PARCHMENT & ACTIONS -->
      <div class="combat-left-panel">
        <!-- TOP DUO SECTION: Block 1 (Heroes Stack) + Block 2 (Controls Stack) Side-by-Side -->
        <div class="combat-top-duo-section">
          <!-- Block 1: Opponent & Player Hero Stack (上下排列的对手与玩家信息) -->
          <div class="combat-heroes-column">
            <!-- Opponent Hero Card: Sinister Demonic Theme -->
            <div class="combat-hero-row opponent">
              <div class="combat-hero-portrait-wrap">
                <img src="${e.face}" class="combat-hero-avatar combat-hero-portrait-frame top" alt="${e.name}" />
                <img src="/ui/Portraitramka.png" class="combat-hero-ramka" alt="Frame" />
                <span class="combat-hero-badge-tag enemy">敌</span>
              </div>
              <div class="combat-hero-info">
                <div class="combat-hero-name-plate">
                  <span class="combat-hero-hp enemy">${e.hp}</span>
                  <span class="combat-hero-name" title="${e.name}">${e.name}</span>
                </div>
                <div class="combat-hero-sub">${eSpecialName}法师 · 敌方</div>
              </div>
            </div>

            <!-- Player Hero Card: Radiant Celestial Theme -->
            <div class="combat-hero-row player">
              <div class="combat-hero-portrait-wrap">
                <img src="${p.face}" class="combat-hero-avatar combat-hero-portrait-frame bottom" alt="${p.name}" />
                <img src="/ui/Portraitramka.png" class="combat-hero-ramka" alt="Frame" />
                <span class="combat-hero-badge-tag player">我</span>
              </div>
              <div class="combat-hero-info">
                <div class="combat-hero-name-plate">
                  <span class="combat-hero-hp player">${p.hp}</span>
                  <span class="combat-hero-name" title="${p.name}">${p.name}</span>
                </div>
                <div class="combat-hero-sub">${pSpecialName}法师 · 己方</div>
              </div>
            </div>
          </div>

          <!-- Block 2: Actions & Turn Status Stack (上下排列的回合、看对手卡片、设置、投降按钮) -->
          <div class="combat-controls-column">
            <!-- 1. 当前回合 -->
            <div class="combat-ctrl-pill turn-badge ${engine.activeTurn === 'player' ? 'active' : 'waiting'}" id="status-combat-turn" title="当前行动阶段">
              <span class="ctrl-icon">${engine.activeTurn === 'player' ? '👑' : '⏳'}</span>
              <span class="ctrl-text">${engine.activeTurn === 'player' ? '你的回合' : '敌方行动'}</span>
            </div>

            <!-- 2. 看对手卡片 -->
            <button class="combat-ctrl-pill btn-toggle-cards ${showOpponentHand ? 'viewing-opponent' : ''}" id="btn-toggle-show-cards" title="切换对手/己方手牌视图">
              <span class="ctrl-icon">👁️</span>
              <span class="ctrl-text">${showOpponentHand ? '看自己' : '看对手'}</span>
            </button>

            <!-- 3. 设置 (内含返回主菜单并自动保存功能) -->
            <button class="combat-ctrl-pill btn-options" id="btn-combat-options" title="音效、背景与主菜单设置">
              <span class="ctrl-icon">⚙️</span>
              <span class="ctrl-text">设置</span>
            </button>

            <!-- 4. 投降 -->
            <button class="combat-ctrl-pill btn-surrender surrender" id="btn-combat-surrender" title="认输投降">
              <span class="ctrl-icon">🏳️</span>
              <span class="ctrl-text">投降</span>
            </button>
          </div>
        </div>

        <!-- Double Parchment Container -->
        <div class="combat-double-parchment-container">
          <!-- 1. Upper: Card Inspection Parchment -->
          <div class="combat-inspect-parchment">
            ${previewCard ? `
              <div class="parchment-card-top-row">
                <img src="${previewCard.imgBigUrl || previewCard.imgUrl}" class="parchment-card-art" alt="${previewCard.nameCn}" />
                <div class="parchment-card-meta">
                  <div class="parchment-card-title">${previewCard.nameCn} (${previewCard.cost}费)</div>
                  <div class="parchment-card-sub">
                    ${previewCard.className ? (HERO_CLASSES.find(c => c.id === previewCard.className)?.nameCn || '特殊') : (elemNames[previewCard.element] || '特殊')} · ${previewCard.type === 'creature' ? '生物' : '法术'} · ${previewCard.name}
                  </div>
                  ${previewCard.type === 'creature' ? `
                    <div class="parchment-card-stats-row">
                      <span class="stat-badge atk">⚔️ 攻击: ${previewCard.attack}</span>
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

          <!-- 2. Lower: Combat Log Chronicle (Slightly reduced height, larger font) -->
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

        <!-- Bottom Action Buttons Row -->
        <div class="combat-actions-bar">
          <button class="combat-action-btn advice" id="btn-get-advice" ${engine.activeTurn !== 'player' || engine.isCombatPhase ? 'disabled' : ''}>
            💡 获得建议
          </button>
          <button class="combat-action-btn end-turn" id="btn-end-turn" ${engine.activeTurn !== 'player' || engine.isCombatPhase ? 'disabled' : ''}>
            ${engine.activeTurn === 'player' ? '⚔️ 结束回合' : '⏳ 敌方思考中'}
          </button>
        </div>
      </div>

      <!-- 2. RIGHT PANEL: UPPER BATTLEFIELD + LOWER 20-CARD HAND -->
      <div class="combat-right-panel">
        <!-- UPPER BATTLEFIELD: Multiple selectable scenic vistas + 10 Summon Slots -->
        <div class="combat-battlefield-section combat-center-battlefield" style="background-image: url('${battlefieldBgs[currentBattlefieldTheme] || battlefieldBgs.citadel}');">
          <!-- Enemy Grand Elemental Mana Altar (Arched Elemental Tabs) -->
          <div class="combat-mana-altar enemy-altar">
            <div class="mana-altar-side-badge enemy">敌方能量</div>
            <div class="mana-altar-shrines-row">
              ${['fire', 'water', 'air', 'earth', e.specialElement].map((elem, idx) => {
                const label = idx === 4 ? eSpecialName : elemNames[elem as ElementType];
                const elemIcons: Record<string, string> = { fire: '🔥', water: '💧', air: '⚡', earth: '🌿', special: '🔮', death: '💀', holy: '✨', mechanics: '⚙️', control: '👁️', chaos: '🌀', illusion: '🪞' };
                const icon = elemIcons[elem] || '🔮';
                const manaVal = e.mana[elem as ElementType] || 0;
                return `
                  <div class="mana-altar-tablet elem-${elem}" title="${label}能量: ${manaVal}">
                    <div class="mana-altar-glyph">
                      <span class="mana-altar-icon">${icon}</span>
                      <span class="mana-altar-name">${label}</span>
                    </div>
                    <div class="mana-altar-gem">
                      <span class="mana-altar-num">${manaVal}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Prompt Banner -->
          <div class="battlefield-prompt-banner ${selectedCard ? 'active' : ''}">
            ${selectedCard
              ? (selectedCard.type === 'creature'
                  ? `👉 请点击己方空槽位以召唤【${selectedCard.nameCn}】`
                  : (selectedCard.requiresTarget ? `👉 请选择受击生物以施放【${selectedCard.nameCn}】` : `👉 再次点击以直接释放【${selectedCard.nameCn}】`))
              : (engine.activeTurn === 'player' ? '👑 你的行动阶段：请选择手牌施法或结束回合' : `⏳ ${engine.enemy.name} 正在行动决策...`)}
          </div>

          <!-- 6 Slots Arena (Centered, leaving generous breathing space around scenery) -->
          <div class="combat-slots-arena">
            <!-- Enemy 6 Slots Row -->
            <div class="combat-slots-lane enemy-lane">
              ${engine.enemyBoard.map((c, idx) => {
                const isTarget = selectedCard?.type === 'spell' && selectedCard.requiresTarget && c !== null;
                return `
                  <div class="combat-board-slot top-slot ${isTarget ? 'active-target' : ''}" data-side="enemy" data-slot-index="${idx}">
                    <div class="slot-filigree top"></div>
                    ${c ? `
                      <div class="board-card vertical ${c.flying ? 'flying' : ''} ${c.uid === engine.lastSummonedUid ? 'card-summon-settle' : ''}">
                        <img src="${c.card.imgBigUrl || c.card.imgUrl}" class="board-card-art" alt="${c.card.nameCn}" />
                        <div class="card-cost-gem">${c.card.cost}</div>
                        <div class="card-stat-atk" title="攻击力: ${c.currentAttack}">${c.currentAttack}</div>
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
                const isTarget = selectedCard?.type === 'creature' && c === null;
                return `
                  <div class="combat-board-slot bottom-slot ${isTarget ? 'active-target' : ''}" data-side="player" data-slot-index="${idx}">
                    <div class="slot-filigree top"></div>
                    ${c ? `
                      <div class="board-card vertical ${c.flying ? 'flying' : ''} ${c.uid === engine.lastSummonedUid ? 'card-summon-settle' : ''}">
                        <img src="${c.card.imgBigUrl || c.card.imgUrl}" class="board-card-art" alt="${c.card.nameCn}" />
                        <div class="card-cost-gem">${c.card.cost}</div>
                        <div class="card-stat-atk" title="攻击力: ${c.currentAttack}">${c.currentAttack}</div>
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

        <!-- LOWER HAND SECTION: Player Mana Altar + 5 Columns of 4 Vertical Cards -->
        <div class="combat-hand-section">
          <!-- Player (or Viewed Opponent) Grand Elemental Mana Altar -->
          <div class="combat-mana-altar ${showOpponentHand ? 'viewing-enemy' : 'player-altar'}">
            <div class="mana-altar-side-badge ${showOpponentHand ? 'enemy' : 'player'}">${showOpponentHand ? '敌方能量' : '己方能量'}</div>
            <div class="mana-altar-shrines-row">
              ${elementsOrder.map((elem, idx) => {
                const currentManaMap = showOpponentHand ? e.mana : p.mana;
                const currentSpecialName = showOpponentHand ? eSpecialName : pSpecialName;
                const label = idx === 4 ? currentSpecialName : elemNames[elem];
                const elemIcons: Record<string, string> = { fire: '🔥', water: '💧', air: '⚡', earth: '🌿', special: '🔮', death: '💀', holy: '✨', mechanics: '⚙️', control: '👁️', chaos: '🌀', illusion: '🪞' };
                const icon = elemIcons[elem] || '🔮';
                const manaVal = currentManaMap[elem] || 0;
                return `
                  <div class="mana-altar-tablet elem-${elem}" title="${showOpponentHand ? '敌方' : '己方'}${label}能量: ${manaVal}">
                    <div class="mana-altar-glyph">
                      <span class="mana-altar-icon">${icon}</span>
                      <span class="mana-altar-name">${label}</span>
                    </div>
                    <div class="mana-altar-gem">
                      <span class="mana-altar-num">${manaVal}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 5-Column 20-Card Grid (Original Vertical CCG Cards) -->
          <div class="combat-hand-grid">
            ${elementsOrder.map((elem) => {
              const targetHand = showOpponentHand ? e.hand : p.hand;
              const targetSpecialElem = showOpponentHand ? e.specialElement : p.specialElement;
              const cardsOfElem = targetHand.filter((c) => c.element === elem || (elem === targetSpecialElem && c.element === 'special'));

              return `
                <div class="hand-column">
                  ${cardsOfElem.map((card) => {
                    const cardImg = card.imgBigUrl || card.imgUrl;
                    if (showOpponentHand) {
                      const isRevealed = engine.enemyRevealedCardIds.has(card.id);
                      const isSelected = selectedCard?.id === card.id || inspectedCard?.id === card.id;

                      if (isRevealed) {
                        return `
                          <div class="combat-hand-card-item hand-card-cell vertical revealed ${isSelected ? 'selected' : ''}" data-card-id="${card.id}" data-is-opponent="true">
                            <img src="${cardImg}" class="hand-card-art" alt="${card.nameCn}" />
                            <div class="card-cost-gem elem-${card.element}">${card.cost}</div>
                            ${card.type === 'creature' ? `
                              <div class="card-stat-atk" title="攻击力: ${card.attack}">${card.attack}</div>
                              <div class="card-stat-hp" title="生命值: ${card.life}">${card.life}</div>
                            ` : ''}
                          </div>
                        `;
                      } else {
                        return `
                          <div class="combat-hand-card-item hand-card-cell vertical face-down ${isSelected ? 'selected' : ''}" data-card-id="${card.id}" data-is-opponent="true" title="敌方手牌（未明示）">
                            <div class="face-down-inner">
                              <div class="face-down-dragon-seal">${elem === 'fire' ? '🔥' : elem === 'water' ? '💧' : elem === 'air' ? '⚡' : elem === 'earth' ? '🌿' : '✨'}</div>
                              <div class="face-down-label">未知</div>
                            </div>
                          </div>
                        `;
                      }
                    } else {
                      const canAfford = p.mana[card.element] >= card.cost;
                      const isSelected = selectedCard?.id === card.id;
                      return `
                        <div class="combat-hand-card-item hand-card-cell vertical ${canAfford ? 'playable' : 'disabled'} ${isSelected ? 'selected' : ''}" data-card-id="${card.id}">
                          <img src="${cardImg}" class="hand-card-art" alt="${card.nameCn}" />
                          <div class="card-cost-gem elem-${card.element}">${card.cost}</div>
                          ${card.type === 'creature' ? `
                            <div class="card-stat-atk" title="攻击力: ${card.attack}">${card.attack}</div>
                            <div class="card-stat-hp" title="生命值: ${card.life}">${card.life}</div>
                          ` : ''}
                        </div>
                      `;
                    }
                  }).join('')}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
    ${showHelpModal ? renderHelpModal() : ''}
    ${showOptionsModal ? renderOptionsModal() : ''}
    ${showSurrenderModal ? renderSurrenderModal() : ''}
    ${aiAnnouncedCard ? renderAiAnnouncementModal(aiAnnouncedCard) : ''}
  `;
}

function renderCampaignModal(): string {
  const levels = campaignData as CampaignLevel[];
  let unlocked: number[] = [1];
  try {
    unlocked = JSON.parse(localStorage.getItem('unlocked_campaigns') || '[1]');
  } catch {}

  const chapters = [
    { id: 1, name: '第1章: 学徒复仇' },
    { id: 2, name: '第2章: 元素之争' },
    { id: 3, name: '第3章: 巨兽狂王' },
    { id: 4, name: '第4章: 混沌国度' },
    { id: 5, name: '第5章: 黑暗远征' },
    { id: 6, name: '第6章: 镜像阴谋' },
    { id: 7, name: '第7章: 巫妖议会' },
  ];

  const currentLevels = levels.filter((lvl) => (lvl.chapter || Math.ceil(lvl.id / 10)) === selectedCampaignChapter);

  return `
    <div class="modal-overlay" id="campaign-overlay">
      <div class="campaign-modal">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h2 style="font-size:20px; color:#ffd700; font-weight:900;">📜 战役模式 · 65 关史诗征程</h2>
          <button class="modal-close-btn" id="close-campaign-btn" style="position:static;">×</button>
        </div>
        <p style="font-size:13px; color:#cbd5e1; margin-bottom:10px;">
          体验原汁原味的单人史诗剧情，征服各领地强大法师与传奇首领！
        </p>

        <!-- CHAPTER TABS -->
        <div class="chapter-tabs-row">
          ${chapters.map((ch) => `
            <button class="chapter-tab-btn ${selectedCampaignChapter === ch.id ? 'active' : ''}" data-chapter-id="${ch.id}">
              ${ch.name}
            </button>
          `).join('')}
        </div>

        <!-- LEVEL LIST -->
        <div style="display:flex; flex-direction:column; gap:8px; overflow-y:auto; flex:1; max-height:55vh; padding-right:4px;">
          ${currentLevels.map((lvl) => {
            const isUnlocked = unlocked.includes(lvl.id);
            return `
              <div class="campaign-level-card ${!isUnlocked ? 'locked' : ''}" data-level-id="${lvl.id}">
                <img src="${lvl.face}" class="campaign-opp-face" alt="${lvl.oppName}" />
                <div style="flex:1;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:900; color:${isUnlocked ? '#ffd700' : '#64748b'}; font-size:14px;">
                      ${lvl.title} ${isUnlocked ? '🔓' : '🔒 未解锁'}
                    </span>
                    <span style="font-size:12px; color:#f43f5e; font-weight:bold;">生命值: ${lvl.enemyHp}</span>
                  </div>
                  <div style="font-size:12px; color:#e2e8f0; margin-top:4px; line-height:1.45;">
                    ${lvl.story.substring(0, 95)}...
                  </div>
                  ${lvl.rules ? `
                    <div style="font-size:11px; color:#94a3b8; margin-top:4px; border-left:2px solid #ffd700; padding-left:6px;">
                      规则：${lvl.rules.replace(/\r?\n/g, ' ')}
                    </div>
                  ` : ''}
                </div>
                ${isUnlocked ? `
                  <button class="btn-end-turn btn-start-campaign" data-level-id="${lvl.id}" style="padding:6px 14px; font-size:12px; white-space:nowrap; align-self:center;">
                    开战
                  </button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderGameOverModal(): string {
  const isWin = engine.winner === 'player';
  const hasNextStage = engine.currentCampaign && engine.currentCampaign.id < 65;

  return `
    <div class="modal-overlay" id="game-over-modal-overlay">
      <div class="battle-result-stone-dialog ${isWin ? 'win' : 'defeat'}">
        <!-- Top Emblem & Banner -->
        <div class="battle-result-crest-wrap">
          <div class="battle-result-crest">${isWin ? '🏆' : '💀'}</div>
          <div class="battle-result-title-banner ${isWin ? 'win' : 'defeat'}">
            <h2 class="battle-result-title">${isWin ? '决 战 胜 利' : '战 局 败 北'}</h2>
            <div class="battle-result-subtitle">${isWin ? '✦ VICTORY ACHIEVED ✦' : '✦ DEFEAT IN BATTLE ✦'}</div>
          </div>
        </div>

        <!-- Combat Summary Narrative -->
        <div class="battle-result-body">
          <p class="battle-result-desc">
            ${isWin
              ? (hasNextStage
                  ? `恭喜大捷！第 <strong>${engine.currentCampaign!.id}</strong> 关已告捷，下一战区关卡已被唤醒解锁！`
                  : '你以超凡的五系元素调和之力彻底瓦解了强敌，赢得了这场史诗对决的荣耀！')
              : '英雄生命力耗尽，战场符文暗淡……但真正的魔导师在沉寂中洞察生机，总结克敌之道，再次问鼎巅峰！'}
          </p>
          <div class="battle-result-stats-pill">
            <span>战局博弈: <strong>${engine.turnCount}</strong> 回合</span>
            <span>双方领主: <strong>${engine.player.name}</strong> vs <strong>${engine.enemy.name}</strong></span>
          </div>
        </div>

        <!-- Action Buttons (Prominent, High-Contrast Stone Buttons) -->
        <div class="battle-result-actions-row">
          ${isWin && hasNextStage ? `
            <button class="battle-result-btn next" id="btn-next-campaign-level">
              <span class="btn-icon">⚔️</span>
              <span>进军下一关</span>
            </button>
          ` : ''}
          <button class="battle-result-btn restart" id="btn-restart">
            <span class="btn-icon">🔄</span>
            <span>${isWin ? '再次对战' : '整军再战'}</span>
          </button>
          <button class="battle-result-btn menu" id="btn-return-menu">
            <span class="btn-icon">🏠</span>
            <span>返回主菜单</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function render() {
  if (currentView === 'menu') {
    app.innerHTML = renderMainMenu();
    if (showOptionsModal) {
      app.innerHTML += renderOptionsModal();
    }
    if (showHelpModal) {
      app.innerHTML += renderHelpModal();
    }
  } else if (currentView === 'single_duel_setup') {
    app.innerHTML = renderSingleDuelSetup();
  } else if (currentView === 'campaign') {
    app.innerHTML = renderMainMenu() + renderCampaignModal();
  } else if (currentView === 'battle') {
    app.innerHTML = renderCombatScreen();
    if (engine.gameOver) {
      app.innerHTML += renderGameOverModal();
    }
  }

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

  document.getElementById('btn-menu-campaign')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'campaign';
    render();
  });

  document.getElementById('btn-menu-league')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'single_duel_setup';
    render();
  });

  document.getElementById('btn-menu-custom-deck')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'single_duel_setup';
    render();
  });

  document.getElementById('btn-menu-help')?.addEventListener('click', () => {
    sound.play('click');
    showHelpModal = true;
    render();
  });

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

  document.querySelectorAll('.class-grid-item').forEach((item) => {
    item.addEventListener('click', () => {
      sound.play('click');
      const target = (item as HTMLElement).dataset.target;
      const clsIdx = parseInt((item as HTMLElement).dataset.classIndex || '0');
      if (target === 'player') {
        playerClassIndex = clsIdx;
      } else {
        aiClassIndex = clsIdx;
      }
      showClassGridPickerFor = null;
      render();
    });
  });

  document.getElementById('btn-start-duel')?.addEventListener('click', () => {
    sound.play('click');
    sound.playBgm('combat1');

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

    engine = new SpectromancerEngine(pClass, undefined, {
      playerName: '玩家',
      playerFace: `/faces/Face${playerFaceIndex + 1}.jpg`,
      enemyName: '大法师',
      enemyFace: `/faces/Face${aiFaceIndex + 1}.jpg`,
      enemyClass: eClass,
      enemyHp: 60,
    });

    setupEngineCallbacks();
    selectedCard = null;
    inspectedCard = null;
    showHelpModal = false;
    showOptionsModal = false;
    currentView = 'battle';
    render();
  });

  // ===================================
  // CAMPAIGN ACTIONS
  // ===================================
  document.getElementById('close-campaign-btn')?.addEventListener('click', () => {
    sound.play('click');
    currentView = 'menu';
    render();
  });

  document.querySelectorAll('.chapter-tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.play('click');
      selectedCampaignChapter = parseInt((btn as HTMLElement).dataset.chapterId || '1');
      render();
    });
  });

  document.querySelectorAll('.btn-start-campaign').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lvlId = parseInt((btn as HTMLElement).dataset.levelId || '1');
      const lvl = (campaignData as CampaignLevel[]).find((l) => l.id === lvlId);
      if (lvl) {
        sound.play('click');
        sound.playBgm('combat1');
        engine = new SpectromancerEngine('sorcery', lvl);
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
    if (confirm('确定要返回主菜单吗？当前战局将退出。')) {
      sound.playBgm('menu1');
      showHelpModal = false;
      showOptionsModal = false;
      currentView = 'menu';
      render();
    }
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

  document.getElementById('btn-combat-options')?.addEventListener('click', () => {
    sound.play('click');
    showOptionsModal = true;
    render();
  });

  document.getElementById('btn-close-options')?.addEventListener('click', () => {
    sound.play('click');
    showOptionsModal = false;
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
      sound.playBgm('battle1');
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
    render();
  });

  document.getElementById('btn-toggle-sfx')?.addEventListener('click', () => {
    sound.play('click');
    sound.toggleMute();
    render();
  });

  document.getElementById('btn-theme-citadel')?.addEventListener('click', () => {
    sound.play('click');
    currentBattlefieldTheme = 'citadel';
    localStorage.setItem('battlefield_theme', 'citadel');
    render();
  });

  document.getElementById('btn-theme-sky')?.addEventListener('click', () => {
    sound.play('click');
    currentBattlefieldTheme = 'sky';
    localStorage.setItem('battlefield_theme', 'sky');
    render();
  });

  document.getElementById('btn-theme-volcano')?.addEventListener('click', () => {
    sound.play('click');
    currentBattlefieldTheme = 'volcano';
    localStorage.setItem('battlefield_theme', 'volcano');
    render();
  });

  document.getElementById('btn-theme-forest')?.addEventListener('click', () => {
    sound.play('click');
    currentBattlefieldTheme = 'forest';
    localStorage.setItem('battlefield_theme', 'forest');
    render();
  });


  document.getElementById('btn-combat-surrender')?.addEventListener('click', () => {
    sound.play('click');
    showSurrenderModal = true;
    render();
  });

  document.getElementById('btn-confirm-surrender')?.addEventListener('click', () => {
    sound.play('click');
    showSurrenderModal = false;
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

      if (side === 'player' && selectedCard.type === 'creature' && engine.playerBoard[slotIdx] === null) {
        isActionPending = true;
        const cardToPlay = selectedCard;
        try {
          await engine.playCard('player', cardToPlay, slotIdx);
        } finally {
          selectedCard = null;
          isActionPending = false;
        }
      } else if (side === 'enemy' && selectedCard.type === 'spell' && selectedCard.requiresTarget) {
        if (engine.enemyBoard[slotIdx] && !engine.enemyBoard[slotIdx]!.spellImmune) {
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

  // Game over buttons
  document.getElementById('btn-next-campaign-level')?.addEventListener('click', () => {
    sound.play('click');
    if (engine.currentCampaign) {
      const nextLvl = (campaignData as CampaignLevel[]).find((l) => l.id === engine.currentCampaign!.id + 1);
      if (nextLvl) {
        engine = new SpectromancerEngine('sorcery', nextLvl);
        setupEngineCallbacks();
        selectedCard = null;
        inspectedCard = null;
        render();
        return;
      }
    }
    currentView = 'campaign';
    render();
  });

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

render();

