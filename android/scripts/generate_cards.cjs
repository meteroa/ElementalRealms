const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const gdPath = path.join(rootDir, 'pc/Inf/Gd.spe');
const dicPath = path.join(rootDir, 'pc/Language.dic');
const destCardsJson = path.join(rootDir, 'android/src/data/cards.json');
const pubCardsDir = path.join(rootDir, 'android/public/cards');

const gdContent = fs.readFileSync(gdPath, 'utf-8');
const lines = gdContent.split(/\r?\n/);
const dicContent = fs.readFileSync(dicPath, 'utf-8');

const dicMap = {};
dicContent.split(/\r?\n/).forEach(l => {
  const m = l.match(/^\^([^\^]+)\^\s*=\s*\^([^\^]+)\^$/);
  if (m) dicMap[m[1].trim()] = m[2].trim();
});

function translateToken(k) {
  return dicMap[k.trim()] || k;
}

function getCardDesc(name) {
  const marker = '^' + name + '^';
  const idx = gdContent.indexOf(marker);
  if (idx === -1) return '';
  const after = gdContent.slice(idx + marker.length).trim();
  const nextMatch = after.search(/\r?\n\^[A-Z][A-Za-z0-9' -]+\^\r?\n/);
  const block = nextMatch !== -1 ? after.slice(0, nextMatch) : after.slice(0, 500);

  const tokens = [];
  const re = /\^([^\^]+)\^/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    tokens.push(match[1]);
  }

  const descTokens = tokens.filter(t => {
    const s = t.trim();
    const sl = s.toLowerCase();
    if (sl.endsWith('creature') || sl.endsWith('spell') || sl === 'beast' || sl === 'goblin') return false;
    if (sl === 'cost' || sl === 'attack' || sl === 'life') return false;
    if (sl.startsWith('attack is equal') || sl.startsWith('cost is equal')) return false;
    if (s.toLowerCase() === name.toLowerCase()) return false;
    return true;
  });

  return descTokens.map(t => translateToken(t)).join(' ').replace(/~/g, '').trim();
}

const pubCards = fs.readdirSync(pubCardsDir);
const lowerPub = new Map();
pubCards.forEach(f => lowerPub.set(f.toLowerCase(), f));

function getImgUrls(imgBase) {
  let std = null;
  for (const ext of ['.jpg', '.png']) {
    if (lowerPub.has((imgBase + ext).toLowerCase())) {
      std = lowerPub.get((imgBase + ext).toLowerCase());
      break;
    }
  }
  let big = null;
  for (const ext of ['.jpg', '.png']) {
    if (lowerPub.has((imgBase + 'big' + ext).toLowerCase())) {
      big = lowerPub.get((imgBase + 'big' + ext).toLowerCase());
      break;
    }
  }
  return {
    imgUrl: '/cards/' + (std || (imgBase + '.jpg')),
    imgBigUrl: '/cards/' + (big || std || (imgBase + 'Big.jpg'))
  };
}

function getNumericCard(numIdx) {
  const start = (numIdx - 1) * 11;
  return {
    elemId: parseInt(lines[start], 10),
    cost: parseInt(lines[start + 1], 10),
    attack: parseInt(lines[start + 2], 10),
    life: parseInt(lines[start + 3], 10),
    p1: parseInt(lines[start + 4], 10),
    p2: parseInt(lines[start + 5], 10),
    p3: parseInt(lines[start + 6], 10),
    p4: parseInt(lines[start + 7], 10),
  };
}

// 136 Authentic Spectromancer Cards
const cardSpecs = [
  // ==================== FIRE (火系) ====================
  { num: 1, id: 'fire_goblin_berserker', elem: 'fire', name: 'Goblin Berserker', type: 'creature', img: 'GoblinBerserker', ability: 'berserk' },
  { num: 2, id: 'fire_wall_of_fire', elem: 'fire', name: 'Wall of Fire', type: 'creature', img: 'WallOfFire', isWall: true, onSummon: 'damage_all_enemies_5' },
  { num: 3, id: 'fire_priest_of_fire', elem: 'fire', name: 'Priest of Fire', type: 'creature', img: 'PriestOfFire', ability: 'fire_growth_1' },
  { num: 4, id: 'fire_drake', elem: 'fire', name: 'Fire Drake', type: 'creature', img: 'FireDrake', swift: true },
  { num: 5, id: 'fire_orc_chieftain', elem: 'fire', name: 'Orc Chieftain', type: 'creature', img: 'OrcChieftain', ability: 'neighbor_attack_2' },
  { num: 6, id: 'fire_flame_wave', elem: 'fire', name: 'Flame Wave', type: 'spell', img: 'FlameWave', spellEffect: 'damage_all_enemy_creatures_9' },
  { num: 7, id: 'fire_minotaur_commander', elem: 'fire', name: 'Minotaur Commander', type: 'creature', img: 'MinotaurCommander', ability: 'all_friendly_attack_1' },
  { num: 8, id: 'fire_bargul', elem: 'fire', name: 'Bargul', type: 'creature', img: 'Bargul', onSummon: 'damage_all_other_4' },
  { num: 9, id: 'fire_inferno', elem: 'fire', name: 'Inferno', type: 'spell', img: 'Inferno', requiresTarget: true, spellEffect: 'inferno_18_10' },
  { num: 10, id: 'fire_fire_elemental', elem: 'fire', name: 'Fire Elemental', type: 'creature', img: 'FireElemental', ability: 'attack_equal_element_power', onSummon: 'fire_elemental_summon' },
  { num: 11, id: 'fire_armageddon', elem: 'fire', name: 'Armageddon', type: 'spell', img: 'Armageddon', spellEffect: 'armageddon' },
  { num: 12, id: 'fire_dragon', elem: 'fire', name: 'Dragon', type: 'creature', img: 'Dragon', flying: true, ability: 'spell_damage_50_percent' },

  // ==================== WATER (水系) ====================
  { num: 13, id: 'water_meditation', elem: 'water', name: 'Meditation', type: 'spell', img: 'Meditation', spellEffect: 'meditation_boost' },
  { num: 14, id: 'water_sea_sprite', elem: 'water', name: 'Sea Sprite', type: 'creature', img: 'SeaSprite', ability: 'backfire_2' },
  { num: 15, id: 'water_merfolk_apostate', elem: 'water', name: 'Merfolk Apostate', type: 'creature', img: 'MerfolkApostate', onSummon: 'gain_fire_2' },
  { num: 16, id: 'water_ice_golem', elem: 'water', name: 'Ice Golem', type: 'creature', img: 'IceGolem', spellImmune: true },
  { num: 17, id: 'water_merfolk_elder', elem: 'water', name: 'Merfolk Elder', type: 'creature', img: 'MerfolkElder', ability: 'air_growth_1' },
  { num: 18, id: 'water_ice_guard', elem: 'water', name: 'Ice Guard', type: 'creature', img: 'IceGuard', ability: 'hero_shield_half' },
  { num: 19, id: 'water_giant_turtle', elem: 'water', name: 'Giant Turtle', type: 'creature', img: 'GiantTurtle', ability: 'armor_5' },
  { num: 20, id: 'water_acidic_rain', elem: 'water', name: 'Acidic Rain', type: 'spell', img: 'AcidicRain', spellEffect: 'acidic_rain_15' },
  { num: 21, id: 'water_merfolk_overlord', elem: 'water', name: 'Merfolk Overlord', type: 'creature', img: 'MerfolkOverlord', ability: 'neighbor_swift' },
  { num: 22, id: 'water_water_elemental', elem: 'water', name: 'Water Elemental', type: 'creature', img: 'WaterElemental', ability: 'attack_equal_element_power', onSummon: 'water_elemental_summon' },
  { num: 23, id: 'water_mind_master', elem: 'water', name: 'Mind Master', type: 'creature', img: 'MindMaster', ability: 'mind_master_all_growth_1' },
  { num: 24, id: 'water_astral_guard', elem: 'water', name: 'Astral Guard', type: 'creature', img: 'AstralGuard', ability: 'astral_guard_drain_growth_1' },

  // ==================== AIR (气系) ====================
  { num: 25, id: 'air_faerie_apprentice', elem: 'air', name: 'Faerie Apprentice', type: 'creature', img: 'FaerieApprentice', ability: 'spell_damage_plus_1' },
  { num: 26, id: 'air_griffin', elem: 'air', name: 'Griffin', type: 'creature', img: 'Griffin', flying: true, onSummon: 'griffin_strike' },
  { num: 27, id: 'air_call_to_thunder', elem: 'air', name: 'Call to Thunder', type: 'spell', img: 'CalltoThunder', requiresTarget: true, spellEffect: 'call_to_thunder_6' },
  { num: 28, id: 'air_faerie_sage', elem: 'air', name: 'Faerie Sage', type: 'creature', img: 'FaerieSage', onSummon: 'faerie_sage_heal' },
  { num: 29, id: 'air_wall_of_lightning', elem: 'air', name: 'Wall of Lightning', type: 'creature', img: 'WallOfLightning', isWall: true, ability: 'wall_lightning_burn' },
  { num: 30, id: 'air_lightning_bolt', elem: 'air', name: 'Lightning Bolt', type: 'spell', img: 'LightningBolt', spellEffect: 'lightning_bolt_scaled' },
  { num: 31, id: 'air_phoenix', elem: 'air', name: 'Phoenix', type: 'creature', img: 'Phoenix', flying: true, ability: 'phoenix_rebirth' },
  { num: 32, id: 'air_chain_lightning', elem: 'air', name: 'Chain Lightning', type: 'spell', img: 'ChainLightning', spellEffect: 'chain_lightning_9' },
  { num: 33, id: 'air_lightning_cloud', elem: 'air', name: 'Lightning Cloud', type: 'creature', img: 'LightningCloud', flying: true, ability: 'cleave_all_enemies' },
  { num: 34, id: 'air_tornado', elem: 'air', name: 'Tornado', type: 'spell', img: 'Tornado', requiresTarget: true, spellEffect: 'tornado_destroy' },
  { num: 35, id: 'air_air_elemental', elem: 'air', name: 'Air Elemental', type: 'creature', img: 'AirElemental', ability: 'attack_equal_element_power', onSummon: 'air_elemental_summon' },
  { num: 36, id: 'air_titan', elem: 'air', name: 'Titan', type: 'creature', img: 'Titan', onSummon: 'titan_strike_15' },

  // ==================== EARTH (土系) ====================
  { num: 37, id: 'earth_elvish_healer', elem: 'earth', name: 'Elven Healer', type: 'creature', img: 'ElvenHealer', ability: 'heal_hero_3' },
  { num: 38, id: 'earth_natures_ritual', elem: 'earth', name: "Nature's Ritual", type: 'spell', img: 'NaturesRitual', requiresTarget: true, spellEffect: 'natures_ritual_heal_8' },
  { num: 39, id: 'earth_forest_sprite', elem: 'earth', name: 'Forest Sprite', type: 'creature', img: 'ForestSprite', flying: true, ability: 'cleave_all_enemies' },
  { num: 40, id: 'earth_rejuvenation', elem: 'earth', name: 'Rejuvenation', type: 'spell', img: 'Rejuvenation', spellEffect: 'rejuvenation_scaled' },
  { num: 41, id: 'earth_elf_hermit', elem: 'earth', name: 'Elf Hermit', type: 'creature', img: 'ElfHermit', ability: 'earth_growth_2' },
  { num: 42, id: 'earth_natures_fury', elem: 'earth', name: "Nature's Fury", type: 'spell', img: 'NaturesFury', spellEffect: 'natures_fury' },
  { num: 43, id: 'earth_giant_spider', elem: 'earth', name: 'Giant Spider', type: 'creature', img: 'GiantSpider', poison: 2, onSummon: 'spawn_spiders' },
  { num: 44, id: 'earth_troll', elem: 'earth', name: 'Troll', type: 'creature', img: 'Troll', regen: 4 },
  { num: 45, id: 'earth_stone_rain', elem: 'earth', name: 'Stone Rain', type: 'spell', img: 'StoneRain', spellEffect: 'stone_rain_25' },
  { num: 46, id: 'earth_earth_elemental', elem: 'earth', name: 'Earth Elemental', type: 'creature', img: 'EarthElemental', ability: 'attack_equal_element_power', onSummon: 'earth_elemental_growth' },
  { num: 47, id: 'earth_master_healer', elem: 'earth', name: 'Master Healer', type: 'creature', img: 'MasterHealer', ability: 'heal_all_allies_3' },
  { num: 48, id: 'earth_hydra', elem: 'earth', name: 'Hydra', type: 'creature', img: 'Hydra', regen: 4, ability: 'cleave_all_enemies' },

  // ==================== NECROMANCER (死灵法师) ====================
  { num: 49, id: 'death_dark_ritual', elem: 'death', cls: 'necromancer', name: 'Dark Ritual', type: 'spell', img: 'DarkRitual', spellEffect: 'dark_ritual_3' },
  { num: 50, id: 'death_cursed_fog', elem: 'death', cls: 'necromancer', name: 'Cursed Fog', type: 'spell', img: 'CursedFog', spellEffect: 'cursed_fog_12' },
  { num: 51, id: 'death_banshee', elem: 'death', cls: 'necromancer', name: 'Banshee', type: 'creature', img: 'Banshee', onSummon: 'banshee_shriek' },
  { num: 52, id: 'death_emissary_of_dorlak', elem: 'death', cls: 'necromancer', name: 'Emissary of Dorlak', type: 'creature', img: 'EmissaryofDorlak', onSummon: 'emissary_sacrifice' },
  { num: 53, id: 'death_blood_ritual', elem: 'death', cls: 'necromancer', name: 'Blood Ritual', type: 'spell', img: 'BloodRitual', requiresTarget: true, spellEffect: 'blood_ritual_sacrifice' },
  { num: 54, id: 'death_keeper_of_death', elem: 'death', cls: 'necromancer', name: 'Keeper of Death', type: 'creature', img: 'KeeperofDeath', ability: 'death_power_on_kill' },
  { num: 55, id: 'death_drain_souls', elem: 'death', cls: 'necromancer', name: 'Drain Souls', type: 'spell', img: 'DrainSouls', spellEffect: 'drain_souls' },
  { num: 56, id: 'death_master_lich', elem: 'death', cls: 'necromancer', name: 'Master Lich', type: 'creature', img: 'MasterLich', ability: 'lich_power_drain', onSummon: 'lich_burst_8' },

  // ==================== CLERIC (神圣牧师) ====================
  { num: 57, id: 'holy_paladin', elem: 'holy', cls: 'cleric', name: 'Paladin', type: 'creature', img: 'Paladin', onSummon: 'paladin_bless_4' },
  { num: 58, id: 'holy_monk', elem: 'holy', cls: 'cleric', name: 'Monk', type: 'creature', img: 'Monk', ability: 'holy_power_on_death' },
  { num: 59, id: 'holy_guard', elem: 'holy', cls: 'cleric', name: 'Holy Guard', type: 'creature', img: 'HolyGuard', ability: 'neighbor_armor_2' },
  { num: 60, id: 'holy_divine_justice', elem: 'holy', cls: 'cleric', name: 'Divine Justice', type: 'spell', img: 'DivineJustice', requiresTarget: true, spellEffect: 'divine_justice_heal_12_blast' },
  { num: 61, id: 'holy_divine_intervention', elem: 'holy', cls: 'cleric', name: 'Divine Intervention', type: 'spell', img: 'DivineIntervention', spellEffect: 'divine_intervention_boost' },
  { num: 62, id: 'holy_wrath_of_god', elem: 'holy', cls: 'cleric', name: 'Wrath of God', type: 'spell', img: 'WrathOfGod', spellEffect: 'wrath_of_god' },
  { num: 63, id: 'holy_angel', elem: 'holy', cls: 'cleric', name: 'Angel', type: 'creature', img: 'Angel', onSummon: 'angel_holy_3' },
  { num: 64, id: 'holy_archangel', elem: 'holy', cls: 'cleric', name: 'Archangel', type: 'creature', img: 'ArchAngel', onSummon: 'archangel_full_heal' },

  // ==================== MECHANICIAN (机械师) ====================
  { num: 65, id: 'mech_overtime', elem: 'mechanics', cls: 'mechanician', name: 'Overtime', type: 'spell', img: 'Overtime', spellEffect: 'overtime' },
  { num: 66, id: 'mech_dwarven_rifleman', elem: 'mechanics', cls: 'mechanician', name: 'Dwarven Rifleman', type: 'creature', img: 'DwarvenRifleman', ability: 'intercept_4' },
  { num: 67, id: 'mech_dwarven_craftsman', elem: 'mechanics', cls: 'mechanician', name: 'Dwarven Craftsman', type: 'creature', img: 'DwarvenCraftsman', ability: 'mechanics_growth_1' },
  { num: 68, id: 'mech_ornithopter', elem: 'mechanics', cls: 'mechanician', name: 'Ornithopter', type: 'creature', img: 'Ornithopter', flying: true, ability: 'bomb_2' },
  { num: 69, id: 'mech_steel_golem', elem: 'mechanics', cls: 'mechanician', name: 'Steel Golem', type: 'creature', img: 'SteelGolem', spellImmune: true, ability: 'armor_1' },
  { num: 70, id: 'mech_cannon', elem: 'mechanics', cls: 'mechanician', name: 'Cannon', type: 'creature', img: 'Cannon', ability: 'cannon_highest_hp_8' },
  { num: 71, id: 'mech_cannonade', elem: 'mechanics', cls: 'mechanician', name: 'Cannonade', type: 'spell', img: 'Cannonade', spellEffect: 'cannonade_19' },
  { num: 72, id: 'mech_steam_tank', elem: 'mechanics', cls: 'mechanician', name: 'Steam Tank', type: 'creature', img: 'SteamTank', onSummon: 'tank_steam_12' },

  // ==================== ILLUSIONIST (幻术师) ====================
  { num: 73, id: 'illus_madness', elem: 'illusion', cls: 'illusionist', name: 'Madness', type: 'spell', img: 'Madness', spellEffect: 'madness_attack_damage' },
  { num: 74, id: 'illus_phantom_warrior', elem: 'illusion', cls: 'illusionist', name: 'Phantom Warrior', type: 'creature', img: 'PhantomWarrior', ability: 'shield_to_1' },
  { num: 75, id: 'illus_hypnosis', elem: 'illusion', cls: 'illusionist', name: 'Hypnosis', type: 'spell', img: 'Hypnosis', spellEffect: 'hypnosis' },
  { num: 76, id: 'illus_wall_of_reflection', elem: 'illusion', cls: 'illusionist', name: 'Wall of Reflection', type: 'creature', img: 'WallOfReflection', isWall: true, ability: 'reflect_to_hero' },
  { num: 77, id: 'illus_spectral_assassin', elem: 'illusion', cls: 'illusionist', name: 'Spectral Assassin', type: 'creature', img: 'SpectralAssassin', onSummon: 'assassin_strike_12' },
  { num: 78, id: 'illus_spectral_mage', elem: 'illusion', cls: 'illusionist', name: 'Spectral Mage', type: 'creature', img: 'SpectralMage', onSummon: 'mage_cost_damage' },
  { num: 79, id: 'illus_oracle', elem: 'illusion', cls: 'illusionist', name: 'Oracle', type: 'creature', img: 'Oracle', ability: 'oracle_illusion_burn' },
  { num: 80, id: 'illus_hypnotist', elem: 'illusion', cls: 'illusionist', name: 'Hypnotist', type: 'creature', img: 'Hypnotist', ability: 'illusion_growth_1', onSummon: 'hypnotist_aoe_5' },

  // ==================== DOMINATOR (支配者) ====================
  { num: 82, id: 'ctrl_goblin_shaman', elem: 'control', cls: 'dominator', name: 'Goblin Shaman', type: 'creature', img: 'GoblinShaman', ability: 'spell_cost_plus_1' },
  { num: 83, id: 'ctrl_weakness', elem: 'control', cls: 'dominator', name: 'Weakness', type: 'spell', img: 'Weakness', requiresTarget: true, spellEffect: 'weakness_curse' },
  { num: 84, id: 'ctrl_damping_tower', elem: 'control', cls: 'dominator', name: 'Damping Tower', type: 'creature', img: 'DampingTower', isWall: true, ability: 'all_card_cost_plus_1' },
  { num: 85, id: 'ctrl_ancient_horror', elem: 'control', cls: 'dominator', name: 'Ancient Horror', type: 'creature', img: 'AncientHorror', ability: 'horror_fear_aura' },
  { num: 86, id: 'ctrl_poisonous_cloud', elem: 'control', cls: 'dominator', name: 'Poisonous Cloud', type: 'spell', img: 'PoisonousCloud', spellEffect: 'poisonous_cloud' },
  { num: 87, id: 'ctrl_ancient_witch', elem: 'control', cls: 'dominator', name: 'Ancient Witch', type: 'creature', img: 'AncientWitch', onSummon: 'witch_drain_all_2' },
  { num: 88, id: 'ctrl_mindstealer', elem: 'control', cls: 'dominator', name: 'Mindstealer', type: 'creature', img: 'Mindstealer', ability: 'mindsteal_self_damage' },
  { num: 89, id: 'ctrl_ancient_giant', elem: 'control', cls: 'dominator', name: 'Ancient Giant', type: 'creature', img: 'AncientGiant', onSummon: 'giant_skip_turn' },

  // ==================== CHAOSMASTER (混沌术士) ====================
  { num: 90, id: 'chaos_peacekeeper', elem: 'chaos', cls: 'chaosmaster', name: 'Insanian Peacekeeper', type: 'creature', img: 'InsanianPeacekeeper', ability: 'chaos_heal_1_6' },
  { num: 91, id: 'chaos_berserker', elem: 'chaos', cls: 'chaosmaster', name: 'Insanian Berserker', type: 'creature', img: 'InsanianBerserker', ability: 'chaos_damage_1_6' },
  { num: 92, id: 'chaos_doom_bolt', elem: 'chaos', cls: 'chaosmaster', name: 'Doom Bolt', type: 'spell', img: 'DoomBolt', requiresTarget: true, spellEffect: 'doom_bolt_25' },
  { num: 93, id: 'chaos_wave', elem: 'chaos', cls: 'chaosmaster', name: 'Chaotic Wave', type: 'spell', img: 'ChaoticWave', spellEffect: 'chaotic_wave_effect' },
  { num: 94, id: 'chaos_shaman', elem: 'chaos', cls: 'chaosmaster', name: 'Insanian Shaman', type: 'creature', img: 'InsanianShaman', ability: 'chaos_drain_power_2' },
  { num: 95, id: 'chaos_insanian_lord', elem: 'chaos', cls: 'chaosmaster', name: 'Insanian Lord', type: 'creature', img: 'InsanianLord', ability: 'insanian_lord_strike_6' },
  { num: 96, id: 'chaos_catapult', elem: 'chaos', cls: 'chaosmaster', name: 'Insanian Catapult', type: 'creature', img: 'InsanianCatapult', ability: 'chaos_stone_10' },
  { num: 97, id: 'chaos_king', elem: 'chaos', cls: 'chaosmaster', name: 'Insanian King', type: 'creature', img: 'InsanianKing', ability: 'chaos_summon_soldier' },

  // ==================== DEMONOLOGIST (恶魔术士) ====================
  { num: 155, id: 'demon_lemure', elem: 'special', cls: 'demonologist', name: 'Lemure', type: 'creature', img: 'Lemure', ability: 'demon_lemure_rebirth' },
  { num: 156, id: 'demon_explosion', elem: 'special', cls: 'demonologist', name: 'Explosion', type: 'spell', img: 'Explosion', requiresTarget: true, spellEffect: 'demon_explosion_28' },
  { num: 157, id: 'demon_power_chains', elem: 'special', cls: 'demonologist', name: 'Power Chains', type: 'spell', img: 'PowerChains', requiresTarget: true, spellEffect: 'demon_power_chains_12' },
  { num: 158, id: 'demon_ergodemon', elem: 'special', cls: 'demonologist', name: 'Ergodemon', type: 'creature', img: 'Ergodemon', ability: 'demon_drain_all_on_death' },
  { num: 159, id: 'demon_quartermaster', elem: 'special', cls: 'demonologist', name: 'Demon Quartermaster', type: 'creature', img: 'DemonQuartermaster', ability: 'demon_quartermaster_growth' },
  { num: 160, id: 'demon_hellfire', elem: 'special', cls: 'demonologist', name: 'Hellfire', gdName: 'HellFire', type: 'spell', img: 'Hellfire', spellEffect: 'demon_hellfire_13' },
  { num: 161, id: 'demon_three_headed', elem: 'special', cls: 'demonologist', name: 'Three-headed Demon', gdName: 'Three-headed demon', type: 'creature', img: 'ThreeHeadedDemon', ability: 'cleave_all_enemies' },
  { num: 162, id: 'demon_greater_demon', elem: 'special', cls: 'demonologist', name: 'Greater Demon', type: 'creature', img: 'GreaterDemon', onSummon: 'demon_greater_summon' },

  // ==================== SORCERY (纯法术系) ====================
  { num: 165, id: 'special_healing_spray', elem: 'special', cls: 'sorcery', name: 'Healing Spray', type: 'spell', img: 'HealingSpray', requiresTarget: true, spellEffect: 'healing_spray_9_6' },
  { num: 166, id: 'special_fireball', elem: 'special', cls: 'sorcery', name: 'Fireball', type: 'spell', img: 'Fireball', requiresTarget: true, spellEffect: 'fireball_9_6' },
  { num: 167, id: 'special_steal_essence', elem: 'special', cls: 'sorcery', name: 'Steal Essence', type: 'spell', img: 'StealEssence', requiresTarget: true, spellEffect: 'steal_essence_5' },
  { num: 168, id: 'special_sacrifice', elem: 'special', cls: 'sorcery', name: 'Sacrifice', type: 'spell', img: 'Sacrifice', requiresTarget: true, spellEffect: 'sorcery_sacrifice' },
  { num: 169, id: 'special_ritual_of_glory', elem: 'special', cls: 'sorcery', name: 'Ritual of Glory', type: 'spell', img: 'RitualOfGlory', spellEffect: 'ritual_of_glory_buff' },
  { num: 170, id: 'special_mana_burn', elem: 'special', cls: 'sorcery', name: 'Mana Burn', type: 'spell', img: 'ManaBurn', spellEffect: 'mana_burn_effect' },
  { num: 171, id: 'special_sonic_boom', elem: 'special', cls: 'sorcery', name: 'Sonic Boom', type: 'spell', img: 'SonicBoom', requiresTarget: true, spellEffect: 'sonic_boom' },
  { num: 172, id: 'special_disintegrate', elem: 'special', cls: 'sorcery', name: 'Disintegrate', type: 'spell', img: 'Disintegrate', requiresTarget: true, spellEffect: 'disintegrate_kill_and_11' },

  // ==================== BEASTMASTER (兽王) ====================
  { num: 173, id: 'beast_magic_hamster', elem: 'special', cls: 'beastmaster', name: 'Magic Hamster', type: 'creature', img: 'MagicHamster', onSummon: 'hamster_heal_10' },
  { num: 174, id: 'beast_scorpion', elem: 'special', cls: 'beastmaster', name: 'Scorpion', type: 'creature', img: 'Scorpion', onSummon: 'scorpion_stun' },
  { num: 175, id: 'beast_wolverine', elem: 'special', cls: 'beastmaster', name: 'Wolverine', type: 'creature', img: 'Wolverine', ability: 'wolverine_berserk_regen' },
  { num: 176, id: 'beast_energy_beast', elem: 'special', cls: 'beastmaster', name: 'Energy Beast', type: 'creature', img: 'EnergyBeast', ability: 'energy_beast_pulse' },
  { num: 177, id: 'beast_death_falcon', elem: 'special', cls: 'beastmaster', name: 'Death Falcon', type: 'creature', img: 'DeathFalcon', flying: true, onSummon: 'falcon_strike_4' },
  { num: 178, id: 'beast_white_elephant', elem: 'special', cls: 'beastmaster', name: 'White Elephant', type: 'creature', img: 'WhiteElephant', ability: 'elephant_shield_hero' },
  { num: 179, id: 'beast_basilisk', elem: 'special', cls: 'beastmaster', name: 'Basilisk', type: 'creature', img: 'Basilisk', ability: 'basilisk_gaze_4' },
  { num: 180, id: 'beast_ancient_dragon', elem: 'special', cls: 'beastmaster', name: 'Ancient Dragon', type: 'creature', img: 'AncientDragon', flying: true, onSummon: 'dragon_breath_10' },

  // ==================== GOBLIN CHIEFTAIN (哥布林酋长) ====================
  { num: 199, id: 'goblin_rescue_operation', elem: 'special', cls: 'goblin', name: 'Rescue Operation', gdName: 'Rescue operation', type: 'spell', img: 'RescueOperation', requiresTarget: true, spellEffect: 'goblin_rescue_heal_5' },
  { num: 200, id: 'goblin_hero', elem: 'special', cls: 'goblin', name: 'Goblin Hero', type: 'creature', img: 'GoblinHero', ability: 'goblin_hero_synergy' },
  { num: 201, id: 'goblin_saboteur', elem: 'special', cls: 'goblin', name: 'Goblin Saboteur', type: 'creature', img: 'GoblinSaboteur', ability: 'goblin_burn_card' },
  { num: 202, id: 'goblin_army_of_rats', elem: 'special', cls: 'goblin', name: 'Army of Rats', type: 'spell', img: 'ArmyOfRats', spellEffect: 'army_of_rats_12' },
  { num: 203, id: 'goblin_portal_jumper', elem: 'special', cls: 'goblin', name: 'Portal Jumper', type: 'creature', img: 'PortalJumper', ability: 'portal_jumper_stun_jump' },
  { num: 204, id: 'goblin_looter', elem: 'special', cls: 'goblin', name: 'Goblin Looter', type: 'creature', img: 'GoblinLooter', ability: 'looter_gain_power' },
  { num: 205, id: 'goblin_raider', elem: 'special', cls: 'goblin', name: 'Goblin Raider', type: 'creature', img: 'GoblinRaider', onSummon: 'goblin_raider_squad' },
  { num: 206, id: 'goblin_ratmaster', elem: 'special', cls: 'goblin', name: 'Ratmaster', type: 'creature', img: 'Ratmaster', ability: 'ratmaster_pulse_6' },

  // ==================== CHRONOMANCER (时空法师) ====================
  { num: 217, id: 'time_chrono_hunter', elem: 'special', cls: 'chronomancer', name: 'Chrono Hunter', type: 'creature', img: 'ChronoHunter', ability: 'time_gain_on_kill' },
  { num: 218, id: 'time_timeblazer', elem: 'special', cls: 'chronomancer', name: 'Timeblazer', type: 'creature', img: 'TimeBlazer', swift: true, onSummon: 'timeblazer_teleport' },
  { num: 219, id: 'time_hasten', elem: 'special', cls: 'chronomancer', name: 'Haste', gdName: 'Hasten', type: 'spell', img: 'Hasten', requiresTarget: true, spellEffect: 'haste_creature_extra_attack' },
  { num: 220, id: 'time_time_stop', elem: 'special', cls: 'chronomancer', name: 'Time Stop', type: 'spell', img: 'TimeStop', spellEffect: 'time_stop_freeze' },
  { num: 221, id: 'time_timeweaver', elem: 'special', cls: 'chronomancer', name: 'Timeweaver', type: 'creature', img: 'TimeWeaver', ability: 'spell_cost_minus_1' },
  { num: 222, id: 'time_priestess_of_moments', elem: 'special', cls: 'chronomancer', name: 'Priestess of Moments', type: 'creature', img: 'PriestessOfMoments', ability: 'double_attack_all_swift' },
  { num: 223, id: 'time_chrono_engine', elem: 'special', cls: 'chronomancer', name: 'Chrono Engine', type: 'creature', img: 'ChronoEngine', ability: 'time_growth_2' },
  { num: 224, id: 'time_time_dragon', elem: 'special', cls: 'chronomancer', name: 'Time Dragon', type: 'creature', img: 'TimeDragon', flying: true, swift: true, onSummon: 'time_dragon_extra_card' }
];

const cards = cardSpecs.map(spec => {
  const numData = getNumericCard(spec.num);
  const searchName = spec.gdName || spec.name;
  const nameCn = dicMap[searchName] || dicMap[spec.name] || spec.name;
  let desc = getCardDesc(searchName);
  if (!desc) {
    if (spec.name === 'Fire Drake') desc = '【火迅龙】可以在上场的回合内就进行攻击。';
    else if (spec.name === 'Ice Golem') desc = '【寒冰傀儡】不会受到任何魔法和技能的伤害。';
  }
  const urls = getImgUrls(spec.img);

  const card = {
    id: spec.id,
    element: spec.elem,
    ...(spec.cls ? { className: spec.cls } : {}),
    name: spec.name,
    nameCn,
    type: spec.type,
    cost: numData.cost,
    ...(spec.type === 'creature' ? {
      attack: numData.attack,
      life: numData.life,
      ...(spec.isWall ? { isWall: true } : {}),
      ...(spec.swift ? { swift: true } : {}),
      ...(spec.flying ? { flying: true } : {}),
      ...(spec.spellImmune ? { spellImmune: true } : {}),
      ...(spec.poison ? { poison: spec.poison } : {}),
      ...(spec.regen ? { regen: spec.regen } : (numData.p1 === 3 && spec.name === 'Hydra' ? { regen: 4 } : (spec.name === 'Troll' ? { regen: 4 } : {}))),
    } : {}),
    image: spec.img,
    imgUrl: urls.imgUrl,
    imgBigUrl: urls.imgBigUrl,
    desc,
    ...(spec.requiresTarget ? { requiresTarget: true } : {}),
    ...(spec.ability ? { ability: spec.ability } : {}),
    ...(spec.onSummon ? { onSummon: spec.onSummon } : {}),
    ...(spec.spellEffect ? { spellEffect: spec.spellEffect } : {})
  };
  return card;
});

fs.writeFileSync(destCardsJson, JSON.stringify(cards, null, 2), 'utf-8');
console.log(`Successfully generated ${cards.length} cards into ${destCardsJson}`);
