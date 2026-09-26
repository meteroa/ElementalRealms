import os
import json
import shutil
from PIL import Image

src_cards_dir = r'd:\sync\project\Spectromancer\pc\Images\Cards'
dest_cards_dir = r'd:\sync\project\Spectromancer\android\public\cards'
os.makedirs(dest_cards_dir, exist_ok=True)

cards_def = [
    # Fire
    {
        'id': 'fire_goblin_berserker',
        'element': 'fire',
        'name': 'Goblin Berserker',
        'nameCn': '哥布林狂战士',
        'type': 'creature',
        'cost': 2,
        'attack': 4,
        'life': 16,
        'image': 'GoblinBerserker',
        'desc': '每回合开始阶段，对相邻格子的友方或敌方生物造成2点伤害。',
        'ability': 'berserk'
    },
    {
        'id': 'fire_wall_of_fire',
        'element': 'fire',
        'name': 'Wall of Fire',
        'nameCn': '火墙',
        'type': 'creature',
        'cost': 3,
        'attack': 0,
        'life': 15,
        'isWall': True,
        'image': 'WallOfFire',
        'desc': '【城墙】无法主动攻击。被召唤时，对敌方所有生物造成5点伤害。',
        'onSummon': 'damage_all_enemies_5'
    },
    {
        'id': 'fire_drake',
        'element': 'fire',
        'name': 'Fire Drake',
        'nameCn': '火迅龙',
        'type': 'creature',
        'cost': 4,
        'attack': 3,
        'life': 17,
        'swift': True,
        'image': 'FireDrake',
        'desc': '【冲锋】上场的回合即可立即发起攻击。'
    },
    {
        'id': 'fire_flame_wave',
        'element': 'fire',
        'name': 'Flame Wave',
        'nameCn': '火焰波浪',
        'type': 'spell',
        'cost': 5,
        'image': 'FlameWave',
        'desc': '对敌方所有生物造成9点火焰伤害。',
        'spellEffect': 'damage_all_enemy_creatures_9'
    },

    # Water
    {
        'id': 'water_sea_sprite',
        'element': 'water',
        'name': 'Sea Sprite',
        'nameCn': '海妖',
        'type': 'creature',
        'cost': 2,
        'attack': 3,
        'life': 14,
        'image': 'SeaSprite',
        'desc': '每当己方回合开始阶段，反噬自身英雄2点伤害。',
        'ability': 'backfire_2'
    },
    {
        'id': 'water_merfolk_apostate',
        'element': 'water',
        'name': 'Merfolk Apostate',
        'nameCn': '人鱼变节者',
        'type': 'creature',
        'cost': 3,
        'attack': 2,
        'life': 13,
        'image': 'MerfolkApostate',
        'desc': '被召唤时，立即为己方增加2点火系能量。',
        'onSummon': 'gain_fire_2'
    },
    {
        'id': 'water_ice_golem',
        'element': 'water',
        'name': 'Ice Golem',
        'nameCn': '寒冰傀儡',
        'type': 'creature',
        'cost': 4,
        'attack': 4,
        'life': 20,
        'spellImmune': True,
        'image': 'IceGolem',
        'desc': '【魔免】完全免疫一切敌我法术与直接伤害技能。'
    },
    {
        'id': 'water_acidic_rain',
        'element': 'water',
        'name': 'Acidic Rain',
        'nameCn': '酸雨术',
        'type': 'spell',
        'cost': 6,
        'image': 'AcidicRain',
        'desc': '对全场所有生物造成15点伤害，并削减敌方全部5系能量各1点。',
        'spellEffect': 'acidic_rain'
    },

    # Air
    {
        'id': 'air_faerie_apprentice',
        'element': 'air',
        'name': 'Faerie Apprentice',
        'nameCn': '仙灵学徒',
        'type': 'creature',
        'cost': 2,
        'attack': 2,
        'life': 12,
        'image': 'FaerieApprentice',
        'desc': '在场时，己方所有法术牌造成的伤害额外+2。',
        'ability': 'spell_power_2'
    },
    {
        'id': 'air_call_to_thunder',
        'element': 'air',
        'name': 'Call to Thunder',
        'nameCn': '落雷术',
        'type': 'spell',
        'cost': 3,
        'requiresTarget': True,
        'image': 'CalltoThunder',
        'desc': '对选中的敌方生物造成6点伤害，同时对敌方英雄造成6点伤害。',
        'spellEffect': 'thunder_target_and_hero_6'
    },
    {
        'id': 'air_griffin',
        'element': 'air',
        'name': 'Griffin',
        'nameCn': '狮鹫',
        'type': 'creature',
        'cost': 5,
        'attack': 5,
        'life': 19,
        'flying': True,
        'image': 'Griffin',
        'desc': '【飞行】直接越过正面阻挡生物，直接攻击敌方英雄本体。'
    },
    {
        'id': 'air_chain_lightning',
        'element': 'air',
        'name': 'Chain Lightning',
        'nameCn': '连锁闪电',
        'type': 'spell',
        'cost': 6,
        'image': 'ChainLightning',
        'desc': '对敌方英雄和敌方所有场上生物造成9点连锁电击伤害。',
        'spellEffect': 'chain_lightning_9'
    },

    # Earth
    {
        'id': 'earth_giant_spider',
        'element': 'earth',
        'name': 'Giant Spider',
        'nameCn': '巨蜘蛛',
        'type': 'creature',
        'cost': 2,
        'attack': 2,
        'life': 13,
        'poison': 2,
        'image': 'GiantSpider',
        'desc': '攻击带有剧毒，被击中的目标每回合开始受到2点毒素持续伤害。'
    },
    {
        'id': 'earth_troll',
        'element': 'earth',
        'name': 'Troll',
        'nameCn': '巨魔',
        'type': 'creature',
        'cost': 4,
        'attack': 4,
        'life': 20,
        'regen': 3,
        'image': 'Troll',
        'desc': '【再生】每当己方回合开始阶段，自身自动恢复3点生命值。'
    },
    {
        'id': 'earth_stone_rain',
        'element': 'earth',
        'name': 'Stone Rain',
        'nameCn': '落石术',
        'type': 'spell',
        'cost': 5,
        'image': 'StoneRain',
        'desc': '引发地脉震动与落石，对战场上所有非飞行生物造成12点伤害。',
        'spellEffect': 'damage_ground_12'
    },
    {
        'id': 'earth_elemental',
        'element': 'earth',
        'name': 'Earth Elemental',
        'nameCn': '土元素',
        'type': 'creature',
        'cost': 6,
        'attack': 4,
        'life': 25,
        'image': 'EarthElemental',
        'desc': '召唤入场时，使己方土系能量每回合的成长率永久+1。',
        'onSummon': 'growth_earth_1'
    },

    # Special / Sorcery
    {
        'id': 'special_sorceror_apprentice',
        'element': 'special',
        'name': "Sorcerer's Apprentice",
        'nameCn': '巫师学徒',
        'type': 'creature',
        'cost': 2,
        'attack': 2,
        'life': 12,
        'image': 'SorcerorsApprentice',
        'desc': '使己方的专属巫术系能量每回合成长率额外+2。',
        'onSummon': 'growth_special_2'
    },
    {
        'id': 'special_steal_essence',
        'element': 'special',
        'name': 'Steal Essence',
        'nameCn': '精华汲取',
        'type': 'spell',
        'cost': 3,
        'requiresTarget': True,
        'image': 'StealEssence',
        'desc': '对目标生物造成5点伤害。若成功击杀该生物，己方专属能量+4。',
        'spellEffect': 'steal_essence_5'
    },
    {
        'id': 'special_meditation',
        'element': 'special',
        'name': 'Meditation',
        'nameCn': '冥想术',
        'type': 'spell',
        'cost': 3,
        'image': 'Meditation',
        'desc': '聚精凝神，立即让己方的火系、气系、土系能量各增加1点。',
        'spellEffect': 'meditation_1'
    },
    {
        'id': 'special_mind_master',
        'element': 'special',
        'name': 'Mind Master',
        'nameCn': '心灵导师',
        'type': 'creature',
        'cost': 5,
        'attack': 4,
        'life': 22,
        'image': 'MindMaster',
        'desc': '入场时震撼敌方心智，削减敌方最高一项能量3点。',
        'onSummon': 'drain_highest_enemy_mana_3'
    }
]

# Convert and copy images
for card in cards_def:
    img_base = card['image']
    found_std = None
    found_big = None
    for ext in ['.jpg', '.tga']:
        p = os.path.join(src_cards_dir, img_base + ext)
        if os.path.exists(p):
            found_std = p
        pb = os.path.join(src_cards_dir, img_base + 'Big' + ext)
        if os.path.exists(pb):
            found_big = pb
    
    if found_std:
        std_out = os.path.join(dest_cards_dir, img_base + '.jpg')
        im = Image.open(found_std).convert('RGB')
        im.save(std_out, 'JPEG', quality=90)
        card['imgUrl'] = f'/cards/{img_base}.jpg'
    else:
        print(f'Warning: Std image not found for {img_base}')

    if found_big:
        big_out = os.path.join(dest_cards_dir, img_base + 'Big.jpg')
        im = Image.open(found_big).convert('RGB')
        im.save(big_out, 'JPEG', quality=95)
        card['imgBigUrl'] = f'/cards/{img_base}Big.jpg'
    else:
        card['imgBigUrl'] = card.get('imgUrl', '')

data_dir = r'd:\sync\project\Spectromancer\android\src\data'
os.makedirs(data_dir, exist_ok=True)
json_path = os.path.join(data_dir, 'cards.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(cards_def, f, ensure_ascii=False, indent=2)

print(f'Successfully processed and saved {len(cards_def)} cards!')
