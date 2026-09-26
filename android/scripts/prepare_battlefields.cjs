const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createBattlefields() {
  const uiDir = path.join(__dirname, '../public/ui');

  // 1. Citadel Battlefield (from MainMenuBg upper vista)
  const menuBg = path.join(uiDir, 'MainMenuBg.jpg');
  if (fs.existsSync(menuBg)) {
    await sharp(menuBg)
      .extract({ left: 0, top: 0, width: 1376, height: 580 })
      .resize(1280, 540)
      .jpeg({ quality: 90 })
      .toFile(path.join(uiDir, 'battlefield_citadel.jpg'));
    console.log('Created battlefield_citadel.jpg');
  }

  // 2. Volcano Battlefield: Dark volcanic basalt, glowing crimson magma & embers
  const volcanoSvg = Buffer.from(`
    <svg width="1280" height="540" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="magmaCenter" cx="50%" cy="80%" r="60%">
          <stop offset="0%" stop-color="#ff4500" stop-opacity="0.9" />
          <stop offset="35%" stop-color="#b22222" stop-opacity="0.7" />
          <stop offset="70%" stop-color="#3a0d0d" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#0e0404" stop-opacity="1" />
        </radialGradient>
        <linearGradient id="volcanoSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1a0505" />
          <stop offset="45%" stop-color="#380c07" />
          <stop offset="75%" stop-color="#731808" />
          <stop offset="100%" stop-color="#b82f07" />
        </linearGradient>
        <radialGradient id="lavaRift1" cx="30%" cy="90%" r="40%">
          <stop offset="0%" stop-color="#fff5cc" />
          <stop offset="25%" stop-color="#ff8c00" />
          <stop offset="60%" stop-color="#b22222" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="lavaRift2" cx="75%" cy="95%" r="45%">
          <stop offset="0%" stop-color="#ffe4b5" />
          <stop offset="30%" stop-color="#ff4500" />
          <stop offset="70%" stop-color="#8b0000" stop-opacity="0" />
        </radialGradient>
      </defs>
      <!-- Base Sky -->
      <rect width="100%" height="100%" fill="url(#volcanoSky)" />
      <!-- Distant Mountain Ridges -->
      <polygon points="0,320 180,240 320,290 500,210 680,270 880,190 1080,260 1280,220 1280,540 0,540" fill="#1f0707" />
      <polygon points="0,370 240,280 440,330 640,260 840,310 1020,270 1280,310 1280,540 0,540" fill="#2d0b09" opacity="0.8" />
      <!-- Glowing Magma Chasms -->
      <rect width="100%" height="100%" fill="url(#magmaCenter)" />
      <rect width="100%" height="100%" fill="url(#lavaRift1)" />
      <rect width="100%" height="100%" fill="url(#lavaRift2)" />
      <!-- Embers Overlay -->
      <circle cx="210" cy="180" r="3" fill="#ffd700" opacity="0.8" />
      <circle cx="280" cy="140" r="2" fill="#ff7f50" opacity="0.7" />
      <circle cx="620" cy="160" r="4" fill="#ffd700" opacity="0.9" />
      <circle cx="780" cy="120" r="2.5" fill="#ff4500" opacity="0.75" />
      <circle cx="940" cy="150" r="3" fill="#ffe4b5" opacity="0.8" />
      <circle cx="1120" cy="190" r="2" fill="#ff8c00" opacity="0.6" />
    </svg>
  `);
  await sharp(volcanoSvg)
    .jpeg({ quality: 90 })
    .toFile(path.join(uiDir, 'battlefield_volcano.jpg'));
  console.log('Created battlefield_volcano.jpg');

  // 3. Forest Battlefield: Ancient enchanted emerald forest with glowing spirit orbs
  const forestSvg = Buffer.from(`
    <svg width="1280" height="540" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="forestSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#04120a" />
          <stop offset="50%" stop-color="#0a2618" />
          <stop offset="85%" stop-color="#144229" />
          <stop offset="100%" stop-color="#1e5c39" />
        </linearGradient>
        <radialGradient id="sunShaft" cx="50%" cy="10%" r="70%">
          <stop offset="0%" stop-color="#bbf7d0" stop-opacity="0.35" />
          <stop offset="40%" stop-color="#4ade80" stop-opacity="0.15" />
          <stop offset="80%" stop-color="#04120a" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="40%" stop-color="#86efac" />
          <stop offset="100%" stop-color="#22c55e" stop-opacity="0" />
        </radialGradient>
      </defs>
      <!-- Base Canopy -->
      <rect width="100%" height="100%" fill="url(#forestSky)" />
      <!-- Forest Trees Silhouette Layers -->
      <polygon points="0,260 120,180 200,240 340,160 480,230 620,150 780,220 920,170 1060,230 1200,160 1280,220 1280,540 0,540" fill="#061910" />
      <polygon points="0,320 160,240 280,300 420,230 560,290 740,210 880,280 1020,220 1160,280 1280,230 1280,540 0,540" fill="#0b2e1e" opacity="0.85" />
      <!-- Sun Shafts -->
      <rect width="100%" height="100%" fill="url(#sunShaft)" />
      <!-- Glowing Fairy Spirit Orbs -->
      <circle cx="280" cy="220" r="14" fill="url(#orbGlow)" />
      <circle cx="640" cy="180" r="22" fill="url(#orbGlow)" />
      <circle cx="880" cy="250" r="16" fill="url(#orbGlow)" />
      <circle cx="1060" cy="190" r="12" fill="url(#orbGlow)" />
      <circle cx="450" cy="270" r="10" fill="url(#orbGlow)" />
    </svg>
  `);
  await sharp(forestSvg)
    .jpeg({ quality: 90 })
    .toFile(path.join(uiDir, 'battlefield_forest.jpg'));
  console.log('Created battlefield_forest.jpg');
}

createBattlefields().catch(console.error);
