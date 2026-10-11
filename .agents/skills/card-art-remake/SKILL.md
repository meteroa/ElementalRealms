---
name: card-art-remake
description: >-
  Use this skill when you need to redraw, stylize, modernise, or redesign card illustrations while keeping original theme and character essence.
---

# Card Art Remake (画风重绘与风格化改造)

This skill provides the standard workflow for upgrading retro/legacy card graphics into high-fidelity modern digital art.

## Workflow Pipeline

1. **Card Metadata Analysis**:
   - Inspect the card's definition in `android/extract_cards.py` or `cards_def` (element, name, attack/life, creature vs spell, special ability).
   - Read the original card image from `pc/Images/Cards/<ImageName>.jpg`.

2. **Crafting the Redraw Prompt**:
   - **生物卡核心构图规范（强制）**：
     * **经典胸像/半身构图 (Bust / Upper-Body Portrait)，禁止展示全身或拉远景**；
     * **头部面积约占画面的 1/3 (Head occupies approximately 1/3 of image area)**：黄金比例兼顾微观与宏观——既保证在手机端 80×80 手牌上五官神态、眼神、牙齿/面部特征清晰锐利，又能完整展示颈部、胸铠、肩膀肩甲、服饰配饰与角色上身姿态轮廓，避免过度贴脸挤压装备特征，亦杜绝拉远景导致角色缩微；
     * **姿态与朝向多样性（多角度动态构图）**：**禁止千篇一律的死板正面证件照！立绘姿势应具备多样性，灵活涵盖侧面像 (Side Profile)、3/4 侧脸、侧身回眸/侧身戒备 (Side-Body / Over-the-Shoulder Turn)、微仰视/微俯视动态等**；根据角色特性与战斗动势量身定制朝向（如刺客变节者侧身潜行斜视、巨龙侧颜昂首吐息、战士侧身架盾回防等），大幅增强画面的故事感、构图动感与卡牌性格多样性。
   - **城墙类生物规范**：
     * 必须清晰体现「防御城垛、厚重城墙、堡垒屏障 (Fortified Wall / Rampart)」的建筑与阻挡特征，不能画成纯粹的自然灾害风暴。
   - **魔法卡构图规范**：
     * 必须全域铺满 (Full-Bleed 1:1)，禁止在中间出现弧形/圆形残留构图；
     * 根据单体与群体法术严格区分特效形式（如单体爆发用天罚光柱/深渊裂隙，全场清场用漫天陨石雨/末日风暴）。
   - **画风、色彩与构图风格规范（核心修正）**：
     * **写实古典奇幻油画质感 (Realistic Fantasy Oil Painting / MTG Style)**：严禁 3D CGI、迪士尼/皮克斯动漫风、塑料平滑皮肤或夸张卡通大眼！采用经典万智牌 (Magic: The Gathering) 与 D&D 奇幻插画笔触，呈现真实的骨骼结构、皮肤毛孔与肌理、真实金属与皮革做旧磨损质感；
     * **色彩明亮通透，杜绝死黑暗沉 (Bright Natural Lighting & Clean Palette)**：提高环境采光通透度（如自然日光、金色朝霞、明亮水光、清澈天光），暗部必须具备通透细节，杜绝大面积死黑泥泞背景与阴暗死角；
     * **元素构成精简干净 (Clean & Focused Composition)**：主体轮廓鲜明，背景简洁并带有柔和景深，杜绝在小卡面上过度堆砌凌乱的漂浮粒子、符文环、乱窜电弧等杂乱干扰特效。
   - Set aspect ratio to `1:1` square.

3. **Generation & Verification**:
   - Call generation pipeline (SenseNova or native tool) with the crafted prompt.
   - Automatically blend out any corner watermarks.
   - Export exact game sizes:
     * Creatures: `XBig.webp` (150×150 或 300×300) 与 `X.webp` (80×80)
     * Spells: `XBig.webp` / `XBig_square.webp` (300×300) 与 `X.webp` / `X_square.webp` (80×80)
   - Save master assets to `android/public/cards/<Name>_master.png`.

