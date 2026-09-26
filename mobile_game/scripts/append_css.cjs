const fs = require('fs');

const cssAppend = `
/* ========================================================
   AUTHENTIC SPECTROMANCER 1.34 UI REPRODUCTION STYLES
   ======================================================== */

/* SCREEN 1: MAIN MENU */
.main-menu-view {
  width: 100vw;
  height: 100vh;
  position: relative;
  background: url('/ui/MainMenuBg.jpg') center/cover no-repeat;
  display: flex;
  overflow: hidden;
}

.menu-logo-container {
  position: absolute;
  top: 4vh;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 5;
  pointer-events: none;
}

.menu-logo-img {
  max-width: 520px;
  width: 48vw;
  filter: drop-shadow(0 6px 14px rgba(0,0,0,0.85));
}

.menu-buttons-sidebar {
  position: absolute;
  right: 5vw;
  top: 50%;
  transform: translateY(-44%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  z-index: 10;
}

.menu-header-pill {
  width: 196px;
  height: 44px;
  background: url('/ui/Menubar.png') center/100% 100% no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 900;
  color: #fff4d0;
  text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 6px rgba(198,155,63,0.5);
  margin-bottom: 2px;
}

.menu-pill-btn {
  width: 180px;
  height: 38px;
  background: url('/ui/Menubtn2.png') center/100% 100% no-repeat;
  border: none;
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #f7e6c4;
  text-shadow: 0 1px 3px rgba(0,0,0,0.9);
  transition: all 0.15s ease;
}

.menu-pill-btn:hover {
  background: url('/ui/Menubtn2_over.png') center/100% 100% no-repeat;
  color: #ffffff;
  filter: brightness(1.15);
  transform: scale(1.02);
}

.menu-pill-btn:active {
  background: url('/ui/Menubtn2_down.png') center/100% 100% no-repeat;
  transform: scale(0.98);
}

.menu-version-text {
  position: absolute;
  bottom: 8px;
  right: 14px;
  font-size: 13px;
  font-family: serif;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 0 1px 2px #000;
}

/* SCREEN 2: SINGLE DUEL SETUP MODAL */
.single-duel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.2s ease;
}

.single-duel-frame {
  width: 580px;
  max-width: 95vw;
  height: 480px;
  max-height: 94vh;
  position: relative;
  background: url('/ui/Singleduel1.png') center/contain no-repeat;
  display: flex;
  flex-direction: column;
  padding: 30px 42px 24px;
  color: #fce7b0;
}

.single-duel-title {
  text-align: center;
  font-size: 19px;
  font-weight: 900;
  color: #f7dfa5;
  text-shadow: 0 2px 5px rgba(0,0,0,0.95);
  margin-top: 10px;
  margin-bottom: 22px;
}

.duel-combatants-row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  flex: 1;
}

.duel-combatant-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.duel-name-plate {
  width: 100%;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
  color: #ffe6a3;
  margin-bottom: 8px;
  text-shadow: 0 1px 3px #000;
}

.duel-avatar-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.duel-arrow-btn {
  width: 24px;
  height: 120px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
  transition: opacity 0.15s, transform 0.1s;
}

.duel-arrow-btn img {
  width: 100%;
  height: auto;
}

.duel-arrow-btn:hover {
  opacity: 1;
  transform: scale(1.08);
}

.duel-arrow-btn:active {
  transform: scale(0.94);
}

.duel-avatar-img {
  width: 100px;
  height: 128px;
  object-fit: cover;
  border: 2px solid #5a482d;
  box-shadow: 0 4px 12px rgba(0,0,0,0.8);
}

.duel-class-picker {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.duel-class-badge {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(198, 155, 63, 0.4);
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 800;
  color: #ffd700;
  min-width: 80px;
  text-align: center;
  cursor: pointer;
}

.duel-mini-arrow {
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  cursor: pointer;
}

.duel-mini-arrow img {
  width: 100%;
  height: 100%;
}

.duel-config-wrench {
  width: 18px;
  height: 18px;
  cursor: pointer;
  margin-left: 2px;
}

.duel-actions-row {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 14px;
}

.duel-stone-action-btn {
  width: 110px;
  height: 32px;
  background: url('/ui/Combatbutton.png') center/100% 100% no-repeat;
  border: none;
  font-size: 13px;
  font-weight: 900;
  color: #f7dfa5;
  cursor: pointer;
  text-shadow: 0 1px 3px #000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.duel-stone-action-btn:hover {
  background: url('/ui/Combatbutton_Over.png') center/100% 100% no-repeat;
  filter: brightness(1.15);
  color: #ffffff;
}

.duel-stone-action-btn:active {
  background: url('/ui/Combatbutton_Down.png') center/100% 100% no-repeat;
  transform: scale(0.96);
}

/* SCREEN 3: AUTHENTIC COMBAT INTERFACE */
.combat-view-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  background: url('/ui/CombatBackground.png') center/cover no-repeat;
  display: flex;
  overflow: hidden;
}

/* Left Toolbar Icons */
.combat-left-nav {
  position: absolute;
  top: 10px;
  left: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 20;
}

.combat-nav-icon-btn {
  width: 48px;
  height: 48px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  border: none;
  cursor: pointer;
  transition: transform 0.15s;
}

.combat-nav-icon-btn:hover {
  transform: scale(1.08);
  filter: brightness(1.2);
}

.combat-nav-icon-btn:active {
  transform: scale(0.95);
}

/* Heroes column on Left */
.combat-heroes-sidebar {
  position: absolute;
  top: 6px;
  left: 64px;
  width: 190px;
  height: calc(100vh - 12px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 15;
  pointer-events: none;
}

.combat-hero-card {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  background: rgba(18, 14, 10, 0.75);
  border: 1px solid rgba(198, 155, 63, 0.4);
  border-radius: 4px;
}

.combat-hero-portrait-frame {
  width: 68px;
  height: 84px;
  border: 2px solid #c69b3f;
  box-shadow: 0 0 8px rgba(0,0,0,0.8);
  object-fit: cover;
}

.combat-hero-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.combat-hero-name {
  font-size: 13px;
  font-weight: 900;
  color: #ffd700;
  text-shadow: 0 1px 3px #000;
}

.combat-hero-hp-badge {
  font-size: 15px;
  font-weight: 900;
  color: #ef4444;
  text-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
}

/* Center Battlefield (10 Slots: 5 enemy, 5 player) */
.combat-center-battlefield {
  position: absolute;
  top: 14px;
  left: 260px;
  right: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  z-index: 10;
}

.combat-slots-row {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.combat-board-slot {
  width: 82px;
  height: 106px;
  background: rgba(0, 0, 0, 0.45);
  border: 1.5px solid rgba(198, 155, 63, 0.6);
  border-radius: 4px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.combat-board-slot.active-target {
  border-color: #ffd700;
  box-shadow: 0 0 16px rgba(255, 215, 0, 0.6);
  animation: pulseSlot 1s infinite alternate;
}

/* Top Right: Opponent Mana Tablets */
.combat-enemy-mana-bar {
  position: absolute;
  top: 8px;
  right: 14px;
  display: flex;
  gap: 6px;
  z-index: 15;
}

.combat-mana-tablet {
  padding: 4px 10px;
  background: rgba(18, 14, 10, 0.85);
  border: 1px solid rgba(198, 155, 63, 0.5);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #fff;
  text-shadow: 0 1px 2px #000;
}

/* Bottom Right: 5-column 20-card grid */
.combat-card-grid-container {
  position: absolute;
  right: 14px;
  bottom: 8px;
  display: flex;
  flex-direction: column;
  z-index: 20;
}

.combat-player-mana-header {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}

.combat-cards-columns-row {
  display: flex;
  gap: 6px;
}

.combat-cards-column {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.combat-hand-card-item {
  width: 62px;
  height: 78px;
  border-radius: 3px;
  position: relative;
  cursor: pointer;
  border: 1px solid rgba(198, 155, 63, 0.4);
  box-shadow: 0 2px 6px rgba(0,0,0,0.7);
  transition: all 0.15s ease;
  overflow: hidden;
  background: #12100d;
}

.combat-hand-card-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.combat-hand-card-item.playable {
  border-color: #ffd700;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
}

.combat-hand-card-item.playable:hover {
  transform: scale(1.08) translateY(-4px);
  z-index: 25;
}

.combat-hand-card-item.selected {
  outline: 2px solid #10b981;
  box-shadow: 0 0 14px #10b981;
  transform: scale(1.1) translateY(-6px);
  z-index: 30;
}

.combat-hand-card-item.disabled {
  filter: grayscale(0.8) brightness(0.5);
  opacity: 0.65;
  cursor: not-allowed;
}

.combat-card-cost-corner {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 18px;
  height: 18px;
  background: rgba(0,0,0,0.85);
  border: 1px solid #ffd700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 900;
  color: #ffd700;
}

.combat-card-atk-corner {
  position: absolute;
  bottom: 1px;
  left: 1px;
  font-size: 11px;
  font-weight: 900;
  color: #ff9800;
  text-shadow: 0 1px 2px #000;
  background: rgba(0,0,0,0.7);
  padding: 0 2px;
  border-radius: 2px;
}

.combat-card-hp-corner {
  position: absolute;
  bottom: 1px;
  right: 1px;
  font-size: 11px;
  font-weight: 900;
  color: #f43f5e;
  text-shadow: 0 1px 2px #000;
  background: rgba(0,0,0,0.7);
  padding: 0 2px;
  border-radius: 2px;
}

/* Bottom Left: Inspection Parchment & End Turn */
.combat-bottom-left-area {
  position: absolute;
  left: 64px;
  bottom: 8px;
  width: 250px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 15;
}

.combat-inspect-parchment {
  width: 100%;
  height: 160px;
  background: url('/ui/Paper.png') center/100% 100% no-repeat;
  padding: 10px 14px;
  color: #2b1f14;
  display: flex;
  flex-direction: column;
  font-family: serif;
  box-shadow: 0 4px 12px rgba(0,0,0,0.6);
  border-radius: 4px;
}

.inspect-parchment-header {
  font-size: 14px;
  font-weight: 900;
  color: #5c2005;
  border-bottom: 1px solid rgba(92, 32, 5, 0.3);
  padding-bottom: 3px;
  margin-bottom: 4px;
}

.inspect-parchment-body {
  font-size: 13px;
  line-height: 1.5;
  color: #3b2716;
  overflow-y: auto;
  flex: 1;
}

.combat-end-turn-btn {
  width: 100%;
  height: 38px;
  background: url('/ui/Endturnbutton.png') center/100% 100% no-repeat;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 900;
  color: #fce7b0;
  text-shadow: 0 1px 3px #000;
  transition: all 0.15s ease;
}

.combat-end-turn-btn:hover {
  background: url('/ui/Endturnbutton_Over.png') center/100% 100% no-repeat;
  filter: brightness(1.15);
}

.combat-end-turn-btn:active {
  background: url('/ui/Endturnbutton_Down.png') center/100% 100% no-repeat;
  transform: scale(0.97);
}
`;

fs.appendFileSync('d:/sync/project/Spectromancer/mobile_game/src/style.css', cssAppend, 'utf-8');
console.log('Successfully appended authentic UI styles to style.css!');
