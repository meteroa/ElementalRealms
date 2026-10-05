# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-10-05

### Fixed
- **全量卡牌数据与机制 PC 原版 100% 严格对齐（PC Authentic Full 136 Cards Data & Mechanics Alignment）**：
  - **核心费用与攻防生命值校准**：依据 PC 正版《Spectromancer》数据文件 `pc/Inf/Gd.spe` 与 `pc/Language.dic` 重新校准全量 136 张卡牌（4 大基础元素火/水/气/土各 12 张费用 1~12，11 大专精流派各 8 张费用 0~8），彻底纠正医疗大师（恢复 PC 原版 11 费用、3 攻击、34 生命值）、冰雪守卫、远古巨龙等卡牌费用与数值偏移；
  - **正统官方中文译名与技能文本同步**：全量卡牌描述与技能说明均自动对接官方中文语言字典，杜绝非官方非正统描述；
  - **元素使动态攻击力机制（Dynamic Elemental Power Scaling）**：火/水/气/土四大元素使攻击力随拥有者对应元素能量实时动态缩放（卡面标注 `*`，入场与每回合根据能量即时结算攻击力，且每回合提供对应元素能量成长率 +1）；
  - **补全 14 种原版法术与 10 种专属生物特技引擎实现**：
    - 实装末日审判（`armageddon`）、龙卷风（`tornado_destroy`）、自然之怒（`natures_fury`）、灵魂汲取（`drain_souls`）、神之裁决（`wrath_of_god`）、赶制（`overtime`）、催眠术（`hypnosis`）、剧毒之云（`poisonous_cloud`）、能量锁链（`demon_power_chains_12`）、地狱烈焰（`demon_hellfire_13`）、牺牲献祭（`sorcery_sacrifice`）、音爆（`sonic_boom`）、救援行动（`goblin_rescue_heal_5`）、加速（`haste_creature_extra_attack`）；
    - 实装铎拉克使者吞噬献祭（`emissary_sacrifice`）、混沌领主震荡重击（`insanian_lord_strike_6`）、混沌君王卫兵号令（`chaos_summon_soldier`）、远古惧像攻击压制（`horror_fear_aura`）、哥布林爆破者能量破坏（`goblin_burn_card`）、哥布林跃迁者闪光致盲跃迁（`portal_jumper_stun_jump`）、恶果魔自爆扣除全系能量（`demon_drain_all_on_death`）、哥布林拾荒者搜刮充能（`looter_gain_power`）、时空猎人时间能量汲取（`time_gain_on_kill`）、心灵大师与星界守卫能量成长与耗蚀体系；
  - **卡牌攻击力界面展示优化**：在战斗手牌、卡牌图鉴、卡牌构筑库、AI 出牌展示与羊皮纸属性详情中，对动态攻击力卡牌统一呈现为正统星号 `*`，避免出现 `-1` 异常显示。
- **战场法则随从实装与卡牌 ID 校准（Battlefield Scenario Creature Deployment & ID Resolution）**：
  - 修复单局对战在选择场景法则（如“天界圣峰”6号位双方各预置【狮鹫】，“永恒密林”预置【巨型蜘蛛】，“熔岩炼狱”预置【火焰祭司】等）时开局未召唤随从的问题；
  - 校准随从卡牌 ID 映射（修复 `fire_priest_of_fire` 与 `fire_goblin_berserker` 拼写），在对决引擎启动时完整注入双方棋盘指定槽位，并实时记录战场随从入场日志；
  - 完善特殊系能量（`special`）在不同英雄职业（死灵/圣职/机械/混沌/支配/幻术）下的映射充能。
- **弹窗重复渲染与多重叠加修复（Singleton Modal System & Overlay Deduplication）**：
  - 移除战斗界面与各子视图模板内部散落的模态窗调用，将选项设置（`showOptionsModal`）与游戏帮助（`showHelpModal`）统一收拢至根渲染函数单例挂载；
  - 彻底杜绝回放与部分视图下因重复拼接导致的双重弹窗与闪烁，并为各弹窗遮罩层（`options-modal-overlay`、`campaign-treasures-modal-overlay`）添加点击背景快速关闭。
- **单局对战弹窗头像区域紧凑化与下边界溢出修复（Single Duel Modal Avatar Sizing & Boundary Overflow Fix）**：
  - 优化玩家与电脑对手头像选择器尺寸（自适应 `clamp(62px, 7.8vh, 78px)`），精简职业选择栏间距与法则面板下外边距，彻底解决职业选择与齿轮按钮超出弹窗黄色底边框的问题。
- **英雄联赛排行榜标题层级与遮挡修复（League Header Banner Overlap & Layering Fix）**：
  - 针对“容易联赛 常规赛 · 场次 1 / 15”横幅下半截被排行榜表格覆盖的问题，重构两者垂直定位与堆叠上下文：横幅图层提升至 `z-index: 60`，表格顶部自适应下移至 `clamp(66px, 11.2vh, 86px)`，确保排行榜与标题横幅之间具备清晰安全留白。

### Added
- **战役圣物殿堂战利品官方艺术重构（Campaign Relics Hall Authentic Art Aesthetics）**：
  - 废除现代 Emoji 图标（🦅, 🧿, 📖 等）与高亮纯白背景，全面替换为原版官方艺术卡牌与金属浮雕徽章（狮鹫卡牌原画、官方奖励徽章 `R2001.jpg`、`R3001.jpg`、`R4001.jpg`、`R3005.jpg`、`R5000.jpg` 与巨魔原画）；
  - 圣物展示卡片切换为暗黑中世纪金边石板风格，未激活圣物呈现古朴暗灰石雕质感，完美契合《魔幻牌》古典暗黑奇幻美术基调。
- **PC 原版 48+ 全套成就与徽章系统（Authentic PC 48-Achievement Badge System）**：
  - 提取并转换 PC 原版全部 51 张透明成就勋章图片，全面对接 PC `Language.dic` 徽章体系（含 AceBadge、DoubleAceBadge、DragonMaster、StormLord、WideOpen、6 大流派战役与天梯大师勋章等），全面升级成就馆。
- **战役模式 PC 真实圣物殿堂弹窗（Campaign Relics & Treasures System）**：
  - 还原 PC 原版战役随通关解锁圣物的经典机制：伴生驯化狮鹫（关卡 1 解锁）、健康护符（关卡 2 解锁英雄血量 +5）、狮鹫学之书（关卡 3 解锁狮鹫涅槃重生）、元素圣戒（关卡 4 解锁开局四系能量各 +1）、巨魔之血药剂（关卡 5 解锁伴生狮鹫每回合自愈 +2）、全知望远镜（关卡 6 解锁对手手牌洞悉）、铎拉克巨棱镜碎片（通关战役终战解锁）；
  - 全新设计《战役圣物殿堂》石板模态窗，展示各圣物属性、解锁条件与激活状态。
- **战役开局战场随从与特殊法则（Campaign Battlefield Pre-placed Creatures & Rules）**：
  - 关卡 1（德米尔）：玩家开局伴生入场 1 只火焰祭司；解锁驯化狮鹫后在后续所有关卡开局自动召唤 3 号位伴生狮鹫；
  - 关卡 2（闪银）：敌方开局进驻冰霜/水元素守护；
  - 关卡 3（费德米尔）：敌方开局进驻机械/混沌守护者；
  - 关卡 5（维兰娜）：敌方开局直接在棋盘上布置双狂暴哥布林；健康护符（65 生命）与元素圣戒（开局能量各 +1）被动实时生效。
- **英雄联赛对战建议军师锦囊（League Opponent Tactical Advice Modal）**：
  - 操作栏“奖品”按键升级为“对战建议”按键，点击弹出《对战建议战术秘卷》模态窗，深度解析下轮对手的流派核心优势、潜在弱点与破局克制锦囊妙计。
- **英雄联赛赛制自定义与季后淘汰赛制（League Contestant Count & Multi-Phase Tournament）**：
  - 创建新角色时支持配置选手总数（8 / 10 / 12 / 16 人，默认 10 人，最大 16 人对应全 16 种流派）；
  - 动态赛程计算：前 $N-1$ 轮为单循环常规赛，常规赛积分前 4 名晋级四强半决赛（第 $N$ 轮），半决赛胜者晋级巅峰总决赛（第 $N+1$ 轮）决出联赛总冠军；完赛弹出定制荣誉勋章模态窗。
- **战役与英雄联赛对局断点接续（Battle Save & Resume Continuity System）**：
  - 战役地图与英雄联赛排行榜新增【⚔️ 接续战斗】/【⚔️ 接续对决】高亮按钮；当对战中“保存退出”后，重新进入战役或联赛选择对应角色即可一键无缝恢复上次棋盘所有随从、生命、手牌与能量进度。
- **全新羊皮纸/石板风格通用确认弹窗与通知浮层（Custom Stone Confirm Dialog & Toast System）**：
  - 全面取缔所有系统原生 `window.alert()` 与 `window.confirm()`，构建统一的 `openCustomConfirm` 石板确认框与 `showToastNotice` 浮层通知。
- **单局对战难度选择与随机/特殊战场场景系统（Single Duel Difficulty & Battlefield Scenarios System）**：
  - 单局对战面板新增 4 级 AI 难度选择（容易 / 普通 / 困难 / 大法师），高难度下电脑对手具备高优先级的集火斩杀与战局反制决策；
  - 新增战场场景法则选择（支持“🎲 随机奇遇”及星辉圣殿、永恒密林、熔岩炼狱、天界圣峰、幽暗冥河、机械要塞、混沌裂隙 7 大特殊法则），支持特殊初始生命、初始元素充能与动态战场主题；
- **战斗界面“保存退出”按键（Combat Save & Exit Button）**：在战斗左侧快捷操作列中新增“保存退出”按钮，点击即刻完整持久化当前血量、元素能量、战线随从与手牌状态，随时可在主界面一键接续对决。
- **自动记录对战录像配置开关（Auto-Record Battle Replays Setting）**：在游戏选项设置弹窗中添加“自动记录对战录像”开关，允许玩家自由控制是否在对局结束后自动保存完整推演至对战录像馆。

### Changed
- **游戏设置弹窗确定完成勾选按钮重构（Options Modal Confirm Tick & Close Button Symmetry）**：
  - “确定完成”按钮改为绿色高光勾号图标（`✓`），与红色叉号（`×`）关闭按钮对称呼应；
- **单局对战弹窗布局重构与居中对决（Single Duel Centralized VS Action Layout）**：
  - 将 AI 难度与战场场景选择面板移到玩家与电脑对手卡片的正上方；
  - 左右玩家卡片与 AI 卡片之间居中放置动态 `VS` 徽记与【⚔ 开始对决】核心按钮。
- **战场场景与法则组合大扩充（12+ Expanded Battlefield Scenarios & Laws）**：
  - 扩充至 12 种丰富场景法则（星辉圣殿、永恒密林、熔岩炼狱、天界圣峰、机械要塞、极地冰冠、混沌裂隙、宗师擂台、荒古遗迹、幽魂死域、奥术潮汐、随机轮盘），涵盖开局随从、全系充能与 90 血量神仙局。
- **英雄联赛排行榜高亮与全新竞技场背景（League Table Highlight & Arena Background）**：
  - 排行榜同时高亮标记玩家自身（`player-row`，👑）与下轮将要遭遇的对手（`next-opponent-row`，显示 `⚔️ 下轮对手` 橙金徽章）；
  - 联赛主界面背景替换为全新高精度古典竞技场远景大厅图 `Tournament_Bg_New.jpg`。
- **战场规则弹窗关闭按钮高亮醒目化（Battlefield Rules Modal High-Contrast Close Button）**：
  - 对战界面战场规则弹窗右上角关闭按钮扩大至 36x36px，配置鲜艳绯红渐变、亮金描边、纯白加粗叉号与高光阴影。

### Changed
- **回合状态变暗时玩家生命值常驻高亮显示（HP Highlight Isolation During Inactive Turn）**：
  - 移除了父容器上的全局灰阶滤镜，改为仅对头像、名称和能量条做局部变暗与灰阶处理；
  - 强制双方生命值（HP 数字）保持满饱和度、无滤镜，并附带强烈的红/绿霓虹文字光晕阴影，在变暗状态下依然清晰醒目。
- **手牌表头 3 字及以上自动缩放单行排版（Hand Column Header Auto-Scaling）**：
  - 优化元素栏表头文字样式，禁止中文词汇自动折行（`white-space: nowrap`）；
  - 根据文字长度（>=3 字、>=4 字）自适应微调字号，确保“支配者”、“混沌法术”等长文本在单排内与元素图标、能量数值徽章完美并列。
- **信息区高度调优与对手元素能量条完整显现（Opponent Mana Bar & Card Height Optimization）**：
  - 压缩玩家信息区高度至 44px~52px，扩展对手信息区高度至 120px~146px；
  - 彻底修复小屏/低高度媒体查询中错误覆盖高度的问题，确保对手 5 系全宽单行元素能量条在任何分辨率下均完全展示不被裁切。
- **对战录像弹窗列表扩展与头像/名称垂直重构（Replay Modal Header Close & Compact Vertical Layout）**：
  - 关闭按钮（`×`）移至右上角标题栏，移除弹窗底部操作条，列表可视区域大幅扩容；
  - 玩家与对手的姓名由并排横列改为移至头像正下方紧凑排列，中间信息区横向拓宽 120px+；
  - 对战类型徽章与对战结果徽章保持单行水平并列排布，彻底消除标签内部文字竖排拆字换行。
- **英雄联赛排行榜遮挡修复（League Standings Table Visibility & Padding Fix）**：
  - 提升排行榜表格层级（`z-index: 50`）高于底部控制栏，调整底部安全间距与紧凑行内边距；
  - 完整呈现第 1 至第 8 名排位数据，杜绝第 5 名以后被底部面板遮挡问题，并配置古典金色滚动条。
- **全局弹窗关闭与确定按钮标准化（Standardized Modal Header Action Buttons）**：
  - 全面规范所有弹窗（游戏设置、录像馆、成就馆、战场规则、联赛档案、战役档案、战役/联赛创建角色、单局对战面板等）的关闭与确定按钮收归右上角标题栏；
  - 废弃所有弹窗底部的多余按钮行，使弹窗布局统一清爽、高度利用率最大化。
- **对战界面英雄信息区与能量显示重构（Combat Hero Plates & Hand Column Mana Redesign）**：
  - **玩家信息区能量值剥离并移至手牌表头**：移除玩家英雄卡片内的元素能量条，将五系元素能量数值以高对比度金属徽章（`.col-mana-badge`）直观嵌入卡牌手牌区各系列的顶部表头处；
  - **对手信息区单行全宽能量条**：缩减玩家卡片高度让出垂直空间给对手卡片，对手五系能量条彻底摆脱左侧头像区域挤压限制，采用单行全宽横向平铺展示；
  - **英雄名称防溢出截断**：优化双方英雄卡片文字弹性布局，字号智能平滑适配，当出现 3 个及以上汉字姓名时（如“大法师”）彻底消除末尾 `...` 省略号截断。
- **战斗界面回合高亮切换呈现（Active Turn Ambient Highlighting）**：移除战斗界面最左侧操作列顶部冗余的回合状态胶囊按钮，替换为直观的英雄信息区高亮状态切换（己方回合时玩家卡片金色高亮发光、对手卡片灰阶变暗，敌方行动时反之）。
- **战役模式操作按键精简（Campaign Mode Button Streamlining）**：移除战役地图右侧多余的“选项”按钮，规范精简为 4 个核心功能键（开始战斗、角色档案、奖品、主菜单）。
- **游戏帮助整合与卡牌图鉴数值重叠优化（Game Help Codex Consolidation & Stat Badges Fix）**：
  - 将“如何游戏”与“战斗进阶”选项卡深度合并为统一的“如何游戏”专栏，详尽阐述核心规则、四大阶段与从左至右结算铁律；
  - 弹窗关闭按钮移至右上角标题栏，腾出完整纵向滚动空间；
  - 卡牌资料图鉴中重构底部攻防徽章排布（`.codex-card-badges-row`），攻击力与生命值分居左右两端，彻底解决数字重叠覆盖问题。
- **对战录像列表布局与羊皮纸质感优化（Replay Item List Layout & Vintage Parchment Tone）**：将录像卡片中间信息区重构为单列多行纵向排布，决斗模式、胜负结果徽章、回合步数与录制时间逐行规范呈现，避免文字竖排扭曲折行；卡片背景调整为复古暖象牙羊皮纸质感，与弹窗底板无缝融合。

### Fixed
- **游戏设置项点击重复触发弹窗与闪烁动画根治（Options Toggle Re-render & Flash Animation Fix）**：
  - 彻底根治点击 BGM、SFX、自动录像滑块与战场主题时因全局 `render()` 重建 DOM 导致的弹窗二次弹出与闪退重进视觉瑕疵，重构为 DOM 就地无缝更新。
- **系统原生弹窗彻底清零与全平台风格统一（Zero Native Browser Popups Fix）**：
  - 全面清理战役奖品 `alert`、卡组保存 `alert`、删除角色 `confirm`、退出对决 `confirm` 等所有残留原生弹窗，统一收拢为古典羊皮纸模态弹窗与轻量通知浮层。
- **游戏设置自动录像开关无法切换与滑动开关重构（Auto-Record Slide Toggle Switch & Event Binding Fix）**：
  - 修复此前未绑定点击事件监听导致无法切换自动录像设置的 Bug；
  - 将按钮重构为符合现代 UI 规范的丝滑滑动开关（`.slide-toggle-track`），并自动持久化玩家配置。
- **Android x86 模拟器 SIGSEGV 崩溃根治（Chrome_InProcGp SIGSEGV GPU Crash Fix）**：根治 Android 9 x86 模拟器 GPU 进程（`Chrome_InProcGp`）在执行落雷全屏 Canvas 动画时因硬件高斯模糊滤镜（`shadowBlur: 30`）触发 Skia GL 驱动越界崩溃（`Fatal signal 11 code 2 SEGV_ACCERR`）的底层隐患；重构为无硬件滤镜的 3 级多层羽化线宽半透明辉光描边，并增加全局 `try / finally` 节点清理防护。
- **巨型蜘蛛特性逻辑与中毒自伤修复（Giant Spider Poison Trait & Self-Harm Bug Fix）**：
  - 修复入场时错误将卡牌攻击特性中的附加中毒数值（2点）直接赋予自身状态 `creature.poison` 导致蜘蛛登场即自残自损生命的问题，初始化为 0；
  - 在战斗交锋伤害结算中补全【剧毒】特性逻辑，当巨型蜘蛛普通攻击命中生物并造成伤害时，为目标生物注入 2 点中毒状态计数（目标每回合受到对应毒素伤害）；入场触发繁衍在相邻空格孵化 2/11 丛林蜘蛛。
- **自然仪式树木生长动画目标位精准匹配（Nature's Ritual Spell Animation Targeting Alignment）**：引入友方增益法术目标定向识别（`isFriendlyTargetSpell`），修复施法时树木始终错误出现在己方第 1 卡槽的硬编码问题；己方战线槽位在选中友方增益法术时高亮提示施法目标，树木生长与护盾特效精准降临在所选生物槽位坐标中心。
- **神谕使者触发音效校正（Oracle Ability Arcane Sound Alignment）**：纠正神谕使者（Oracle）触发幻术伤害时误用雷霆轰鸣音效的问题，调整为纯正的奥术幻象精神音效（`magic`）。
- **对战回放攻击与法术动画全量呈现（Replay Combat & Spell VFX Rendering）**：重构回放推演执行时序，确保 DOM 状态就绪后再触发攻击阵线突刺突进（`lunge`）、法术视觉特效（`playSpellVFX`）、屏幕震颤与生物召唤光影，彻底解决回放战斗无动画的问题。
- **游戏选项与音频设置弹窗确定按钮失效修复（Options Modal Confirm Button Event Binding）**：为游戏选项与音频设置弹窗底部的“确定完成”按钮（`btn-confirm-options`）绑定独立的窗口关闭与音效事件，彻底解决点击后无法自动关闭弹窗的问题。
- **背景音乐系统彻底重构与多模式专属战斗曲联动（Web Audio Seamless Looping & Mode-Specific BGM Synchronization）**：
  - **根治背景音乐突然中断**：将背景音乐主通道升级为基于 Web Audio API 内存解码的无缝硬件循环架构（`AudioBufferSourceNode.loop = true`），彻底摆脱 5+ 原生 `MediaPlayer` 在单曲循环结束时反复销毁与重建句柄引起的底层 `mediaserver` 资源竞争与死锁静音。
  - **前后台切换自愈与存活看门狗**：新增 `visibilitychange` 页面可见性感知与 2.5 秒周期的 BGM 存活巡检看门狗，设备息屏唤醒或意外中断时毫秒级自动拉起恢复播放。
  - **模式切换动态音乐路由**：打通单人决斗、战役模式、英雄联赛、自组卡牌、对战回放与主界面的音乐联动，解决模式切换时音乐不跟随变更的问题；
    - 单人决斗：自动播放专属激昂战斗曲 `combat1.ogg`；
    - 战役模式：根据讨伐进度智能进阶，第 1~20 关播放 `combat1.ogg`，第 21~45 关播放 `combat2.ogg`，第 46~65 关决战播放 `combat3.ogg`；
    - 英雄联赛：播放激烈锦标赛对决曲 `combat2.ogg`；
    - 自组卡牌与对战回放：根据对决配置播放对应战斗曲；
    - 退出战斗返回大地图、主菜单、卡组工坊或天梯榜单时，平滑切回古典史诗主题曲 `menu1.ogg`。
- **生物卡牌入场附加伤害与专属战斗特技全量生效（Creature On-Summon AOE Damage & Combat Trait Overhaul）**：
  - **入场伤害管线重构与视觉呈现**：将生物召唤入场结算重构为异步阶段，入场直接伤害与 AOE 爆发结算后即时广播状态变化、渲染伤害飘字与清理阵亡生物，杜绝了此前被后续普通攻击逻辑瞬间覆盖掩盖的问题。
  - **霸古魔入场全场 AOE 修复**：修复霸古魔（`damage_all_other_4`）判定时依赖临时 UID 造成的逻辑竞争与自伤问题，严密精准地对全场除自身以外的全部敌我双方生物造成 4 点入场烈焰伤害。
  - **补全缺失的入场机制分支**：
    - **巫妖王**（`death_master_lich` / `lich_burst_8`）：入场引爆敌方当前生命值最低的生物造成 8 点致命冥火伤害；
    - **大恶魔**（`demon_greater_demon` / `demon_greater_summon`）：入场释放灭世黑炎，对敌方随机 2 名生物分别造成 5 点直接伤害；
    - **毒蝎**（`beast_scorpion` / `scorpion_stun`）：入场对正对槽位敌方生物释放剧毒蜇针，赋予 2 回合麻痹无法行动状态；
    - **天使**（`holy_angel` / `angel_summon`）：入场即刻为英雄额外灌注 3 点神圣圣职法力；
    - **时间闪击者**（`timeblazer_teleport`）：入场穿梭至战场最左侧空格。
  - **补全核心生物攻击与被动机制**：
    - **吸血鬼**（`death_vampire`）：正对目标为人类生物时即刻获得 +4 攻击力压制；
    - **哥布林英雄**（`fire_goblin_hero`）：赋予左右相邻友军 +2 攻击力激励光环；
    - **狼獾**（`beast_wolverine`）：生命值受到损伤（低于上限一半）时触发嗜血狂暴，攻击力 +2；
    - **巨蜥**（`beast_basilisk`）：正对生物发动近战反击时附加概率石化判定；
    - **巫妖王与亡灵御守**：巫妖王攻击敌方英雄时等额汲取死灵能量，亡灵御守在任一敌方生物阵亡时汲取死灵能量。

## [Unreleased] - 2026-10-04
- **战役模式多玩家角色创建与档案管理系统（Campaign Character Profile Management System）**：
  - 彻底打通战役模式与英雄联赛的角色管理机制，战役模式现已支持创建与管理多位独立玩家角色；
  - 玩家可在战役中自定义姓名、从 78 款头像中挑选心仪外观、选择 12 大流派职业与战役难度（容易/普通/困难/大法师）；
  - 新增战役角色档案中心（Campaign Profile Hub），支持多角色进度无缝切换、独立记录 65 关讨伐通关进度，并在大地图底部实时呈现当前主角头像与流派勋章。
- **对战界面元素能力值数字边框溢出修复与字号增大（Hero Mana Chip Positioning & Contrast Optimization）**：
  - 微调双方英雄元素能量晶片（`hero-mana-chip`）间距与内边距，移除过紧的右外边距，向左适度内移；
  - 增大各元素数值字体（17px - 24px），纯白粗体搭配 1px 黑色硬描边，彻底解决数字贴边或超出边框的问题，数字饱满清晰。
- **右上角操作提示条移除（Top-Right Prompt Banner Clean Removal）**：
  - 依据用户反馈与 UI 纯净度需求，移除右上角漂浮提示框（`.battlefield-prompt-banner`），还原沉浸式原版对决视野。
- **魔法卡牌施法展示动画屏幕正中居中定位（Spell Presentation Centered over Battlefield Arena）**：
  - 查明并修复此前法术卡牌悬浮于 2 号卡槽上空的几何偏差问题（原逻辑基于窗口 50% 宽度，而横屏下右侧战场占 67%，导致 50% 刚好落在第 2 卡槽位置）；
  - 重构为动态获取战场槽位主容器（`.combat-slots-arena`）的实际渲染包围盒，并在其真实水平与垂直几何中心悬浮展示卡牌放大进入与法术震荡光效，横竖屏下均完美正中 6 槽对战区。
- **对战背景音乐突然消失与循环卡死彻底修复（BGM Leak Protection & Resilient Playback Cycle）**：
  - 查明 5+ 原生播放器在单曲结束调用 `seekTo(0)` 时部分安卓机型底层 MediaPlayer 抛错且未释放句柄导致系统级媒体崩溃的隐患；
  - 在 `onBgmEnd` 回调中对完成播放的原生播放器执行显式 `stop()` 与 `close()` 彻底释放底层句柄，并在 50ms 后重新安全创建新实例接续循环；在 HTML5 备用音频池中增加 `ended` 监听补丁，保障 BGM 永不突然消失中断。
- **屏幕旋转自适应与陀螺仪解锁（Screen Orientation Unlock & Dynamic Responsive Realign）**：
  - 在应用启动及 `plusready` 时自动调用 `plus.screen.unlockOrientation()`，解开底层锁屏限制，允许设备重力传感器在横屏与竖屏之间自由旋转响应；
  - 注册防抖处理的 `resize` 与 `orientationchange` 监听器，手机翻转瞬间即刻毫秒级自动重绘并应用对应横/竖屏布局，无需重新载入应用。
- **胜利音效替换（Triumphant Victory SFX Overhaul）**：
  - 移除了原版类似大象长鸣声的号角音效（`trumpet.ogg`），替换为雄浑庄严、激荡人心的经典法师凯旋礼赞音效（`ritual_of_glory.ogg`）。
- **卡牌技能描述与实际运行机制全量校准（Card Mechanism & Description Alignment Audit）**：
  - 修复 `game.ts` 中多处边界遍历条件 `< 5` 错误导致第 6 槽位（索引 5）被排除在邻格判定之外的致命缺陷（狂暴哥布林范围波及与蛛母邻格幼蛛孕育现已完整覆盖 0~5 全部 6 个槽位）；
  - 全局优化巨龟（`armor_5`）减伤机制与寒冰卫士（`hero_shield_half`）英雄护盾机制，使其对魔法法术伤害同样生效减免；
  - 规范校准狮鹫飞行特技说明（“【飞行】无视对格阻挡直接攻击敌方英雄”），统一天雷召唤（`Call to Thunder`）的中英文译名与伤害描述。
- **竖屏模式全方位体验重构（Comprehensive Portrait Mode Ergonomics）**：
  - **启动界面 Logo 还原**：修复 SVG 缺少视口宽高属性导致在竖屏下列宽紧缩时高度坍塌为 0 的问题，设置高精度固定宽高比，Logo 在竖屏下恢宏居中；
  - **单局对战与选项弹窗边界溢出消除**：重设对战选择框、设置与英雄选择弹窗在竖屏下的宽度上限为 `min(600px, 95vw)`，内边距自适应内敛，弹窗完整居中且不超屏；
  - **对决战场排版重组**：
    - 顶部操作栏各按钮改为上图标、下文字垂直排列，彻底解决文字遮挡看不见的问题；
    - 垂直重排战斗层级：【顶部操作栏】→【敌方英雄全宽行】→【战场 6 槽位阵地】→【我方英雄全宽行（移至卡槽下方、手牌上方）】→【底部 5 系手牌区】；
    - 适度下调手牌区高度占比，恢复卡牌协调的黄金比例，彻底杜绝卡牌细长瘦高失真；
  - **战役模式竖屏优化**：战役大地图限高 38vh 且维持全宽视野，剧情对话与任务信息区移至上方单独成行全宽展现，下方紧凑排列开始战斗、角色档案、难度与操作按钮。
- **对战回放实况动画与震颤反馈增强（Replay Step Animation & Impact Effects）**：
  - 在 `applyReplayStep` 回放执行单步推进时，实时比对前后快照状态：
    - 英雄或生物受到伤害时触发高对比度浮动伤害文字（`-X`）与受击特效；
    - 英雄或生物受到治愈时触发浮动生命恢复文字（`+X`）；
    - 战斗重击与攻击阶段同步激活全屏震颤动效（`screen-shake`）与攻击音效联动，回放过程生动震撼。
- **横屏下卡牌费用被生命值遮挡缺陷修复（Card Cost Gem & Stat Badge Overlap Resolution in Landscape Mode）**：
  - 彻底解决在 2700x1224 等宽屏手机高分辨率横屏下，底部手牌卡牌高度受限（~40-45px）时生物卡牌生命值徽章盖住法力费用徽章的问题。
  - 将手牌中所有卡牌（生物与法术）的法力费用宝石统一右置并垂直居中（`top: 50%; right: 4px; transform: translateY(-50%);`，`z-index: 15`），使各系手牌纵列右侧费用数值整齐划一；
  - 将生物卡牌的攻击力与生命值徽章以 Flex 弹性容器紧凑并排停靠于左下角（`bottom: 2px; left: 2px;`），彻底杜绝费用与生命值在垂直方向上的重叠冲突，卡面立绘与全系攻防费用信息 100% 完整清晰展示。
- **英雄元素法力能量点高对比度重绘与模糊消除（High-Contrast Sharp Mana Counter Rendering）**：
  - 针对小屏或手机横屏下双方英雄元素能量点（🔥、💧、⚡、🌿、🔮）文字过小且带重度发光模糊的问题，全面重构能量晶片（`hero-mana-chip`）。
  - 去除大半径模糊阴影滤镜，数值文字升级为高对比度纯白粗体（`#ffffff`）搭配 1px 黑色锐利轮廓描边（`text-shadow: 1px 1px 0 #000, -1px -1px 0 #000...`），并在媒体查询中保障最低高度与字号，无论在任何高 DPI 屏幕下均一目了然、清晰锐利。
- **安卓端音效资源池与背景音乐中断修复（Web Audio SFX Decoupling & Seamless BGM Looping）**：
  - 查明并彻底解决“背景音乐突然中断、卡牌攻击声没有”的根本原因：此前音效调用 `plus.audio.createPlayer` 为每个音效创建安卓系统原生 `MediaPlayer` 句柄，瞬间耗尽系统底层媒体通道配额并导致底层 `mediaserver` 强杀 BGM 播放器、丢失攻击音效。
  - 彻底解耦音频通路：所有短音效（点击、攻击 `attack.ogg`、召唤、法术等）全部经由低延迟、高并发的 Web Audio API 内存解码播放，零占用系统媒体句柄；5+ 原生播放器仅供背景音乐专属使用，并重构循环播放（`onBgmEnd`）时的无缝重载机制，彻底解决音乐中断与音效丢失。
- **安卓系统状态栏彻底隐藏与沉浸式全屏（True Fullscreen & System Status Bar Hiding）**：
  - 解决左上角显示系统时间、电量、通知图标遮挡游戏顶部操作按钮（“你的回合”及英雄头像）的问题。
  - 在 `manifest.json` 中配置 `"fullscreen": true` 并关闭 `"immersed"` 重叠，同时在应用启动与 `plusready` 生命周期中自动调用 `plus.navigator.setFullscreen(true)` 与 `hideSystemNavigation()`，实现纯净全屏沉浸对决。
- **Vite 开发服务器启动报错修复（Vite Dev Server ESM Compatibility）**：
  - 修复 `vite.config.ts` 中的 `no-module-script` 插件在开发模式下移除 `<script type="module">` 导致控制台报错 `Uncaught SyntaxError: Cannot use import statement outside a module` 的问题，增加 `apply: 'build'` 约束使其仅在生产打包阶段生效，开发模式与生产构建双向完美兼容。
- **全量卡牌立绘、英雄头像与 UI 边框相对路径全面修复（Full Card Art, Hero Avatars & UI Framing Relative Path Normalization）**：
  - 彻底根除在 HBuilderX 模拟器与本地离线 `file://` 协议下卡牌立绘、英雄头像与边框呈现破损裂图（Broken Image）的致命缺陷。
  - 针对原数据中以斜杠开头（如 `/cards/`、`/faces/`、`/ui/`）在本地 WebView 中会被错误解析为安卓操作系统根目录（`file:///cards/...`）的根本原因，全面将 `cards.json`、`campaign.json`、`tournament.json` 以及战斗、卡组构筑、图鉴、回放等全模块中所有图片路径重构为规范相对路径（`./cards/`、`./faces/`、`./ui/`）。
  - 内置 `toRel()` 安全寻址转换器与 `index.html` 全局裂图捕获回退机制，确保在真机 APK、HBuilderX 模拟器基座与标准 Web 端图片均能毫秒级瞬时正常加载显示。
- **HBuilderX 5+App 原生音频通道深度集成与离线多级回退（HBuilderX Native 5+ Audio & Multi-Tier Offline Engine）**：
  - 针对安卓底层 `mediaserver` 进程无法跨权限读取 APK 私有资源目录导致标准 `<audio>` 静音、以及 Chromium 在本地协议下拦截 `fetch()` 的系统级限制，深度重构音频引擎：
  - 首选接入 DCloud 5+App 原生音频播放器 `plus.audio.createPlayer('_www/audio/...')`，绕过所有浏览器媒体沙箱与自动播放阻断，完美解决模拟器无音乐问题；
  - 强化 `plusready` 异步生命周期监听与用户首次触控唤醒机制，并在非 5+ 环境下自动降级至 Web Audio API（基于 XHR 内存 ArrayBuffer 解码）及 HTML5 Audio，彻底保障背景音乐与 93 种原版音效的完美流式播放。
- **音频系统在本地 `file://` 协议下的 Fetch API 拦截修复（Audio Engine Local File Protocol & Scheme Compatibility）**：
  - 针对在 HBuilderX 模拟器本地文件（`file://`）协议下报错 `Fetch API cannot load file:///audio/... URL scheme "file" is not supported` 的问题，彻底重构 [sound.ts](file:///d:/sync/project/Spectromancer/android/src/engine/sound.ts) 中的音频加载链路。
  - 将所有音频资源的硬编码根绝对路径（`/audio/`）重构为相对寻址（`./audio/`），杜绝解析至操作系统根目录；
  - 在检测到 `file:` 协议时，改用支持本地协议的 `XMLHttpRequest (arraybuffer)` 配合 HTML5 Audio 流式加载，彻底废弃 Chromium WebView 下对本地 `file:` 不受支持的 `fetch()` 调用，音效与背景音乐全面恢复正常播放。

### Changed
- **移动端离线 WebView 构建兼容性重塑（Offline WebView Compatibility: Relative Base & IIFE Bundle）**：
  - 配置 `base: './'`，将资源索引路径从绝对路径 `/assets/` 转换为相对路径 `./assets/`，根除 Android WebView 在 `file://` 本地协议下将根路径解析为操作系统根目录导致的资源 404 白屏。
  - 将构建产物重构为 `iife` 传统自执行脚本并自动替换 `type="module"` 为 `defer`，彻底绕开 Chromium WebView 在 `file://` 协议下的 CORS（Origin 为 null）限制与严格 MIME Type 检查，实现 HBuilderX 模拟器与本地 APK 的即开即玩。
- **自组卡牌模式背景视觉重塑（Custom Deck Hub Background & Atmospheric Overhaul）**：
  - 彻底移除此前错误作为全屏壁纸铺贴的原版 PC 弹窗切图（`CustomDeck_Bg.jpg`，该图原本为 PC 版带空框与藤蔓的对话框局部，拉伸后形成突兀的重叠弹窗视觉），消除多余旧版弹窗背景。
  - 背景切换为游戏主视觉高清浮空城堡星空图（`MainMenuBg.jpg`），并叠加 `brightness(0.4) blur(3px)` 柔光景深与径向渐变暗角遮罩，将自组卡牌窗口的视觉焦点清晰突显，标题重塑为尊崇金（`#ffd700`）。
- **启动主界面右下角版本号规范更新（Version Badge Updated to 1.0）**：
  - 将启动主界面右下角显示的 `v 2.0.0` 统一更正为 `v 1.0`（`v 1.0 Mobile · HD`），并将 `package.json` 版本号同步更新为 `1.0.0`。

### Added
- **移动端竖屏自适应响应式布局支持（Adaptive Portrait Mode Responsive Layout）**：
  - 在 `manifest.json` 与 CSS 媒体查询中全面开启竖屏支持（`portrait-primary` / `portrait-secondary`）。
  - 新增完整的 `@media (orientation: portrait)` 响应式架构：
    - 主界面启动页：Logo 与功能卡片自动流式单列垂直排列，适配单手握持；
    - 对决战场：界面自上而下自适应重构为【顶部操作栏 + 双方英雄横向并列 HUD】→【中部 6 槽位战场全宽对阵】→【底部 5 系手牌纵列流式出牌区】，实现无需横放手机即可流畅操控对局；
    - 弹窗与设置面板：全宽自适应填充，保障纵向阅读与触控体验。
- **HBuilderX 5+App 与云打包专属配置文件（HBuilderX 5+App Manifest & Cloud Build Support）**：
  - 新增标准 [manifest.json](file:///d:/sync/project/Spectromancer/android/public/manifest.json)，预置强制全屏横屏展示（`landscape-primary` / `landscape-secondary`）、沉浸式状态栏与应用元数据，支持在 HBuilderX 中直接打开构建产物进行模拟器实时调试与免本地环境的一键云打包 APK。
- **帮助弹窗【卡牌资料】全系图鉴（Comprehensive Cards Codex & Compendium）**：
  - 帮助弹窗中加入“🃏 卡牌资料”分类标签，完整呈现全系 120 张官方卡牌数据（4 大基础元素及 11 大法师流派专属牌）。
  - 支持按系别（全部、火、水、气、土及各流派）快捷筛选过滤，直观浏览卡牌立绘、中英文名称、法力费用、攻防数值徽章、类型与完整技能机制描述。
- **浅雅温润象牙羊皮纸贴图（Light Ivory Antique Parchment Texture）**：
  - 针对原深色贴图色调偏重的问题，重新生成色调淡雅、温暖柔和的象牙米黄色古典羊皮纸贴图（`Paper.png`），去除厚重焦黑斑块，文字阅读舒适明澈，四周柔和微晕全覆盖且绝对杜绝白边。
- **原版官方磅礴史诗主题音乐还原（Restored Epic Authentic Official Soundtrack）**：
  - 恢复搭载正统官方原版完整史诗交响主题曲（`menu1.ogg`），气势浩瀚磅礴、交响乐与合唱女声气象万千，并适度调优播放声响，呈现纯正的大师级视听体验。
- **主界面左上角 Logo 全面做大与字体/副标题重塑（Majestic Typography & Scaled Brand Logo）**：
  - 引入 Google 高端字体家族（`Cinzel Decorative` 与优雅书道宋体），替换原本单薄普通的默认字体，赋予“元素秘境”极具仙魔史诗感的苍劲书法浮雕质感。
  - 下方副标题“✦ 魔 导 对 决 ✦”字号大幅放大至 20px，搭配璀璨金芒椭圆徽章与两翼星钻饰纹，极为醒目抢眼。
  - 整个 Logo 尺寸上限显著放大（高度提升至 `clamp(82px, 13vh, 126px)`，宽度扩至 `640px`），金辉流光四溢，主界面震撼度全面进阶。
- **荣誉成就徽章图标 404 修复（All 12 Authentic Achievement Badges Restored）**：
  - 修正成就数据中指向不存在文件名的图标引用，完整对齐 12 项正统成就官方徽章图片，所有成就 Icon 均完整正常显示。
- **战役模式与联赛模式剧情排版全宽自适应（Full-Width Responsive Campaign & League Narrative Text Flow）**：
  - 解决战役模式与联赛模式底部剧情说明文字只占区块左侧一半的问题。彻底清除从原版数据中提取附带的单硬换行符（`\r\n`），使文字随羊皮纸区块自适应 100% 宽度自然流式换行排版。
- **游戏帮助弹窗顶部标题规范化（Game Help Modal Title Standardization）**：
  - 帮助弹窗顶部标题规范调整为“📖 游戏帮助 (Help)”，去除冗余花哨的前缀与后缀英文。

### Removed
- **英雄联赛主界面多余“帮助”按钮（Clean 4-Button Grid for League Standings）**：
  - 移除英雄联赛右下侧操作栏中冗余的“帮助”按钮，使右侧按钮组恢复为 4 个（开始战斗、角色档案、选项、主菜单），饱满对称对齐 2×2 网格布局。
- **帮助弹窗“制作团队”选项卡与底部来源文字（Streamlined Help Codex Navigation）**：
  - 帮助弹窗中移除“📜 制作团队”Tab 选项，移除左下角多余的“来源：Spectromancer...”说明文字，底部栏仅保留“关闭”按钮。

## [1.0.0] - 2026-09-30

### Added
- **荣誉成就系统原版视觉重构与高对比度易读优化（Authentic PC Achievement Badges & Crystal-Clear High-Contrast UI）**：
  - 彻底解决成就文字与暗色背景混淆模糊、难以辨识的问题。引入羊皮纸底框与清晰明朗的高对比度深墨褐文字与卡片容器。
  - 从 PC 原版（`pc/Images/Rewards/`）完整提取并迁移 40 张官方成就徽章（`R1001.jpg` ~ `R6002.jpg`），替换原本单一的通用奖杯图标，呈现 12 大官方正统成就挑战与进度追踪。
- **游戏帮助原版六章古籍宝典系统（Comprehensive 6-Chapter Help Codex & Lore Tome）**：
  - 依据 PC/Flash 原版（`pc/Help/HowToPlay.help`、`pc/Help/Index.help`、`pc/Help/Credits.help` 及 `pc/指南.txt`）重塑为六大分类官方古籍宝典：
    1. 【如何游戏】：游戏目标、生命值与胜负判定、五大元素法力增长机制详解；
    2. 【战斗进阶】：6战斗槽对位规则、生物攻击力与生命值机制、特技发动、即时法术与穿透伤害；
    3. 【卡组构筑】：20张卡组构筑黄金法则、元素配比策略、同系唯一性约束；
    4. 【16大流派】：原版全16位法师专精特色与核心战术分析；
    5. 【游戏模式】：单场决斗、战役模式、英雄联赛、自组卡牌与对战回放详细指引；
    6. 【制作团队】：Richard Garfield、Skaff Elias、Alexey Stankevich 等原作者致谢与致敬。
- **对战回放直通实况战斗全景播放器（Live Battlefield Direct Replay System）**：
  - 依据 PC 原版（`InitCombat.txt` / `initChooseReplay.txt`）深度挖掘与还原回放运行模式：回放不再使用简易的文本战报窗口，而是**直接载入真实的对决战斗主画面（`renderCombatScreen`）**！
  - 完整呈现双方英雄头像、即时生命值、5系元素法力增长、6个阵位生物召唤、法术出牌与攻防血量变动。
  - 底部浮现专业回放控制器（`replay-battle-controller-dock`）：包含退出回放、开局（⏮）、上一步（◀）、自动播放/暂停（▶/⏸）、下一步（▶）、终局（⏭）及倍速调节（1x / 2x / 4x）。

### Changed
- **羊皮纸背景平铺重复消除与全景拉伸（Full-Bleed Stretched Parchment Texture）**：
  - 全局移除羊皮纸背景的平铺重复（`repeat`），统一采用 `background: ... url('/ui/Paper.png') center / 100% 100% no-repeat !important` 进行整体拉伸贴合，消除拼接缝隙与错位杂色。
- **主界面三大核心功能集成：对战回放、荣誉成就与游戏帮助（Replays, Achievements & Comprehensive Game Help）**：
  - **对战回放馆（Battle Replay System）**：
    - `SpectromancerEngine` 全程自动录制每场对局的每一个战术步骤（`ReplayStep`），记录回合数、行动方、卡牌名称、卡牌立绘、槽位、文字描述及双方生命值实时快照。
    - 主界面顶部新增 `[📼 对战回放]` 按钮，支持保存最近 20 场对战录像并进入全交互式回放播放器（`replay_viewer`），具备步进翻页（第一步/上一步/下一步/最后一步）、自动连续播放/暂停以及 `1x / 2x / 4x` 动态倍速调节。
  - **荣誉成就系统（Achievements System）**：
    - 主界面顶部新增 `[🏆 荣誉成就]` 按钮，展示 10 大核心挑战（初出茅庐、战役先锋、领地征服者、联赛新秀、登顶冠军、构筑大师、坚如磐石、奥术狂潮、远古契约、星灵全才）。
    - 战斗结束或特定条件达成时，自动触发屏幕右上角金色徽章成就提示横幅（`achievement-toast`）并播放胜利音效。
  - **游戏玩法与规则秘典（Game Help Modal）**：
    - 主界面顶部新增 `[📖 游戏帮助]` 按钮，涵盖基础对决规则与胜负判定、五大元素能量自动增长机制、生物特技与即时法术运用、四大精彩模式全景指引。
- **英雄联赛多角色档案与多联赛创建/管理系统（Multi-Profile League Hub & Manager）**：
  - 新增角色档案与联赛列表 Hub（`renderLeagueHubModal`），打破原先只能保留单一角色的限制。玩家可自由创建多个不同职业、不同难度的角色档案并开启独立的 8 轮大师排位赛，支持档案自由切换与确认删除。
  - 8 轮排位赛主界面（`league_table`）右下角新增 `[角色档案]` 按钮，方便玩家在不退出比赛的情况下随时管理档案。

### Changed
- **战役模式大地图底部交互栏布局与比例缩放优化（Campaign Bottom Deck Auto-Fill & Responsive Fluid Typography）**：
  - 彻底去除中间剧情介绍框（`.campaign-deck-center`）的固定最大宽度限制，设置 `flex: 1; min-width: 0;` 自适应填满中间区域，完全消除原先空出的 2/5 留白空间。
  - 剧情框标题（`clamp(18px, 1.45vw, 23px)`）与故事正文（`clamp(15.5px, 1.3vw, 20px)`）全面升级为屏幕比例流式缩放，在不同屏幕与分辨率下均保持饱满易读。
  - 右侧 4 个操作按钮（开始战斗、奖品、选项、主菜单）全面重构，双列网格饱满填充右侧操作区。
- **战场特殊规则弹窗全屏比例缩放（Battlefield Rules Modal Responsive Scaling）**：
  - 扩大 `.combat-rules-modal` 视窗至 `clamp(560px, 58vw, 840px)`，标题字号提升至 `clamp(17px, 1.4vw, 22px)`，正文与特殊战规高亮框提升至 `clamp(16px, 1.3vw, 20px)`，底部关闭按钮同步放大。
- **英雄联赛排位赛排行榜字体全面放大（Enlarged League Standings Table）**：
  - 扩充 `.league-table-container` 宽度至 `clamp(560px, 56vw, 840px)`，表头字号扩至 `clamp(16px, 1.3vw, 21px)`，数据单元格字号扩至 `clamp(15px, 1.25vw, 19.5px)`，玩家金色高亮行更加清晰。
- **自组卡牌 20 张卡组编辑器杜绝重复与尺寸放大（Deck Builder No-Duplicate Enforcement & Scaled Controls）**：
  - 严格限制 20 张卡组内每种卡牌仅能配置 1 张，备选卡池库中已在卡组内的卡牌半透明并打上鲜绿 `✓ 已配置` 徽章，点击已配卡牌提供防重拦截与警示。
  - 顶部操作栏高度增至 `clamp(56px, 7.5vh, 76px)`，卡组名称输入框、职业选择器及 `清空`、`保存`、`退出` 按钮尺寸与字号显著放大。
- **战斗界面左侧“战场规则”专用按钮与弹窗（Battlefield Rules Button & Modal Overlay）**：
  - 在战斗界面左侧快捷功能栏新增“战场规则”卷轴按钮（`.combat-strip-item.btn-rules`）。
  - 点击即可呼出羊皮纸质感的战场特殊战规弹窗（`.combat-rules-modal`），实时解析并展示联赛特殊战规（如敌方特性、随机洗牌惩罚）、战役关卡剧情与首领战规、自组牌组机制或单场快速决斗战规。
- **战役模式世界大地图与分支自选关卡（Authentic Campaign World Map & Branching Stage Selection - 参考图1）**：
  - 提取并引入原版战役大地图底图（`Campaign_Map1.jpg`）与古卷边框布局。
  - 顶栏横幅呈现“选择下一个对手:”，地图上标绘各领地关卡法师头像与金色指针徽记。
  - **首关通关后续关卡精细解锁**：击败第 1 个敌人（奥尔加德）后，精准解锁后续 3 个分支关卡领地（卡珊德拉、巴特拉斯、维特拉克），对齐参考图 1 选关设定。
  - 底部操作栏深度重构：中间剧情介绍框宽度调窄、字体显著放大（字号提升至 17.5px、字重 700），右侧 4 个操作按钮按 2×2 双列布局并大幅放大（高度 48px），提升触控体验。
- **英雄联盟排位赛模式与新角色创建系统（League of Heroes Tournament & Character Creator - 参考图2、图3）**：
  - **“新角色”创建弹窗全面等比放大**：弹窗尺寸扩至 58vw（最大 760px），标题大字、头像视窗、输入栏及职业/难度切换器全面放大，按钮字号升至 21px。
  - **山景排位赛背景重绘去硬编码**：使用真实平滑过渡算法完全消除 `Tournament_Bg.jpg` 原图中心硬编码烘焙的固定排行榜与俄中俄文字体，还原自然连贯的雪山远景与蓝天。
  - **动态联赛排行榜替代原图**：由 DOM 动态生成的 `.league-table-container` 居中替换原背景图表，配备金属雕纹边框，动态计算 10 位竞争对手名次、胜场与积分，当前玩家高亮显示。
- **自组卡牌模式与 20 张卡组编辑器（Custom Deck Mode Hub & 20-Card Deck Builder - 参考图4、图5）**：
  - 搭建自组卡牌主界面（图 5），支持玩家自定义牌组切换、新建、编辑与删除，自由挑选职业、对手等级（学徒至宗师）与指定挑战对手。
  - **移除“全部”标签并仅保留各系过滤**：右侧卡池库彻底移除“全部”通用标签，严格按火系、水系、气系、土系及职业专属系 5 个智能标签过滤。
  - **同系卡牌替换强制约束**：点击卡槽智能切换至对应系别卡池；向卡组添加或替换卡牌时强制限定必须为同系别替换，严格杜绝水系替换火系等跨系错置。

### Changed
- **随从攻击音效 `attack.ogg` 增益回调至适度 1.5 倍（Calibrated Attack SFX Volume to 1.5x）**：
  - 依据听感反馈将随从撞击与战斗攻击音量由 2.2 倍适度下调至 1.5 倍（`volume: 1.5`），既保证肉搏打击沉稳响亮，又避免过度过曝轰鸣。
- **FHD 高分屏与动态分辨率全屏自适应放大（FHD Scaling for Menu & Battle Modals）**：
  - 启动页各模式入口卡片全面应用流式 `clamp` 尺寸扩展，在大屏及 1080P/2K 分辨率下按钮面积与字体饱满舒展，消除小分辨率局促感。
  - 对战结束后的胜负石雕结算弹窗（`.battle-result-stone-dialog`）尺寸大幅扩充，徽章、文字与按钮放大，提升操作便捷度。

### Fixed
- **生物进攻音效缺失修复（Creature Attack Sound & Web Audio API Engine）**：
  - 针对视频 `20260930_133426.mp4` 反映的生物卡牌进攻时音效缺失问题，彻底重构 `SoundManager` 音频内核。
  - 升级为 Web Audio API（`AudioContext`）与预解码 `AudioBuffer` 缓存池，通过用户首触手势全局解锁 AudioContext，彻底规避浏览器因异步延时导致手势令牌失效而静音异步战斗结算与 AI 回合攻击的底层限制。
- **光环数值与战场增益高亮实时刷新（Minotaur / Orc Chieftain Aura & Visual Stat Highlighting）**：
  - 解决牛头人指挥官（全场友军非墙生物攻击力 +1）和兽人酋长（相邻生物攻击力 +2）进场时其它生物攻击力未增加的显示问题。
  - 在 `BoardCreature` 引入 `baseAttack` 与 `buffedAttack` 标识，召唤、死亡及位置变更时自动执行 `recalculateBoardStats()` 重新计算光环加成。
  - 卡槽攻击力数值动态判定增益状态，以高亮鲜绿发光样式（`.card-stat-atk.buffed`）明确展示强化数值。
- **魔法卡牌施法流程与原版“放大进入”对齐（Big Spell Card Presentation）**：
  - 修复此前魔法卡牌缩放入槽的错误表现，重构 `onCardEnterSlot` 施法动画流程。
  - 魔法卡牌施放时以 1.5 倍尺寸流线型放大飞入战场中央展示位（Big Spell Frame），顶部挂载原版 `usecardtextbar.png` 卷轴横幅明确播报 `施放法术：【卡牌名】`，并在法术特效播放完毕后柔和淡出。
- **全系 33 张魔法卡牌专属动画与音效全面校准（Full Overhaul of All 33 Spell VFX & Audio）**：
  - **落雷与闪电系**：重构程序化分支闪电算法（`triggerAuthenticLightning`），结合原版 `lparts.png` 爆裂粒子、全屏电光闪烁与 `lbolt.png` 纹理，还原 `20260930_133854.MP4` 和 Flash 原版的雷暴打击。
  - **火系与恶魔系**：火焰波浪（槽位火柱喷涌）、炼狱爆轰（目标及相邻槽位爆燃）、火球术（飞弹弹道轨迹与爆炸）、地狱烈焰（全场熔岩裂缝地火喷发）、恶魔自爆（高能冲击波爆破）。
  - **水系与治疗系**：冥想（英雄头像环绕湛蓝法能波纹）、酸雨术（全屏酸雾腐蚀环境与 18 道密集酸雨落滴）、雾疗术（相邻友军群裹水愈光盾）。
  - **土系与自然系**：石雨术（利用 `stone.png` 真实 4 帧飞石自天际旋转坠落砸向全场敌方卡槽）、自然仪式（生长出世界之树 `ritforest.png` 与绿荫护盾）、活力恢复（英雄获得治愈古树灵光）。
  - **圣职与惩戒系**：神圣审判（天降白金神圣天谴光柱 `wrath1.png` 与圣光地裂 `wrath2.png`）、神圣干预（英雄圣光壁障）、光荣仪式（己方全槽升起金色光辉天柱）。
  - **死灵系**：黑暗仪式（幽魂幻影 `spirits.png` 盘旋吸取生命）、血祭仪式（绯红献祭光环与血魄飞流至英雄）、诅咒之雾（毒雾迷漫全场与幽魂哀鸣）。
  - **特殊与职业专属系**：精华汲取（紫罗兰魔能光珠跨屏吸入施法者头像）、法力燃烧（敌方头像魔能电涌爆裂）、裂解射线（七彩棱光垂直贯穿目标并瓦解为尘埃）、入狂幻术（目标头上旋转紫色催眠眩晕波纹）、虚弱术（紫暗诅咒符文压制全场敌方生物）、时间停止（黄金时钟沙漏 `timestop.png` 浮空翻转与时空逆转负色波动）、加速术（目标生物脚下飞旋时钟光轨）、救援行动（绿色急救光阵飞升脱险）、鼠群侵袭（多只狂鼠 `rat.png` 沿卡槽列群奔突袭）、能量锁链（炽金锁链封锁槽位）、列炮齐发（连续轰鸣炮击爆破）。
- **闪电魔法音画完全同步与多重冗余播放消除（Lightning VFX-SFX Sync & Deduplication）**：
  - 修复闪电等魔法在 AI 预告弹窗（`onCardAnnouncement`）时过早播发战斗法术音效的问题，将弹窗音效恢复为原生揭示音 `showeff1.ogg`。
  - 清理引擎底层 `resolveSpell` 内的历史遗留回放代码，彻底杜绝闪电法术（预告、动画、结算）重复播放 3 次的严重回音冗余，确保法术音效严格在雷电劈落瞬间单次精准响彻。
- **对决英雄区块高度与视觉布局扩容（Hero Row Height & Layout Expansion）**：
  - 针对玩家与对手英雄区块偏挤的问题，将 `.combat-hero-row` 基础高度由 `68-96px` 大幅调升至 `92-126px`（手机端由 `52px` 提至 `72px`）。
  - 头像尺寸提升至 `62-86px`（内像 `52-74px`），血量大字字阶升至 `30-48px`，英雄名升至 `18-28px`，5 系能量芯片加高至 `28-38px`，全面解除压迫感与局促感。

### Changed
- `spectromancer_web-master` 前端（`index.html`、`app.js`）：将所有面向用户的俄文文本翻译为中文，包括界面标签、导航、游戏日志、提示文字等。

## [2.5.5] - 2026-09-28

### Added
- **PC 原版战斗特效动画与音频管线深度挖掘与移植（Authentic PC Spectromancer Combat VFX & Sound Engine Port）**：
  - **PC 原版音效完全对齐与音频池零延迟机制（100% Faithful PC Audio Alignment & Zero-Latency Audio Pooling）**：
    - 深度挖掘 PC 端 `pc/Sounds.ctl` 核心配置定义，提取全部 91 款原生 `.ogg` 音频与真实音量比例权重（如地狱火 `inferno` 150%、落雷 `lightningbolt` 70%、冥想 `meditation` 35%、神圣干涉 `divineint` 25% 等）。
    - 重构 `android/src/engine/sound.ts`，建立全量法术与生物卡牌 ID 直通音效词典（涵盖雷电、火浪、酸雨、地狱火、落雷、连环闪电、自然祈福、回春术、落石术、暗黑仪式、鲜血仪式、诅咒之雾、灵魂汲取、神圣正义、神圣干涉、加农炮击、虚弱术、末日闪电、混乱狂潮、狂乱术、自爆、锁链、地狱之火、治疗喷雾、火球术、精华窃取、法力燃烧、光辉仪式、音爆、瓦解射线、毒素、狂暴、充能、龙皇吐息、时空停滞、鼠群等 40+ 核心法术与战技原声）。
    - 引入移动端专属 Audio Pool（音频复用池）与核心音频预加载机制，彻底消除移动端连续播放音效卡顿或延迟静音缺陷。
  - **PC 原版战斗动画粒子纹理挖掘与 Web 格式转换（PC Combat Spritesheets & Textures Conversion）**：
    - 从 PC 原版 `pc/Images/Combat` 目录挖掘 18 组核心战斗动画纹理，编写解码算法将原版 `.dds`（DXT3）与 `.tga`（RLE/TrueColor）高保真无损解码并转码为 Web 端可用的高精透明 PNG 保存在 `android/public/ui/vfx/`：
      - `lbolt.png`：PC 原版雷霆闪电光柱纹理（256×64）。
      - `lparts.png`：PC 原版闪电爆裂粒子 5 帧序列帧（320×64）。
      - `wrath1.png`：PC 原版神之天谴降世光柱 4 帧序列帧（256×64）。
      - `wrath2.png`：PC 原版圣光地裂爆破符文（66×94）。
      - `shield.png`：PC 原版神圣护盾光幕（150×150）。
      - `spirits.png`：PC 原版远古怨灵幽魂 3 帧序列帧（381×125）。
      - `rat.png`：PC 原版疯狂鼠群原画（118×115）。
      - `ritforest.png`：PC 原版森林古树生机繁茂图腾（110×134）。
      - `timestop.png`：PC 原版时空停止黄金沙漏（58×83）。
      - `stone.png`：PC 原版落石术崩碎飞石（128×32）。
      - `stunned.png`：PC 原版眩晕飞旋金星（80×80）。
      - `vampire.png`：PC 原版吸血蝙蝠汲血 2 帧序列帧（112×56）。
      - `golem.png`：PC 原版魔像巨拳重砸 2 帧序列帧（112×56）。
      - `rabbits.png`：PC 原版幻术兔子戏法（112×56）。
      - `particles.png`：PC 原版魔法粒子光芒（512×128）。
      - `usecardtextbar.png`：PC 原版操作提示卷轴彩带（308×26）。
      - `forbidden.png`：PC 原版禁止出牌/目标无效印记（80×80）。
  - **基于实战录像（20260928_230026.mp4）的像素级动画与音效还原（High-Fidelity Combat Video Matching）**：
    - **操作提示彩带横幅（Floating Action Banner: 选择位置 / 选择目标）**：1:1 还原原版视频中点击手牌后浮现在槽位上方的古朴石刻彩带，精准根据卡牌类型显示 `选择位置 [生物名]` 或 `选择目标 [法术名]`，取消选择时自然淡出。
    - **落雷术天人合一双重落雷（Call to Thunder Dual Strike）**：精准复刻视频 01:47 关键帧机制——落雷术施法时，一道垂直雷霆劈向目标卡槽生物，**另一道雷霆同时垂直轰击敌方英雄头像**，双槽电弧四溢迸发，雷鸣爆震。
    - **火浪槽位内爆燃火柱（In-Slot Flame Pillars）**：复刻视频 00:36 关键帧——火焰波浪席卷时，**受击的每一个敌方槽位内部同时喷涌出炽烈的橙红烈焰火柱（`.vfx-slot-flame-pillar`）**，而非单纯的全屏蒙版，打击感震撼逼真。
    - **连环闪电英雄贯穿与全场连劈（Chain Lightning Hero & Slot Strike）**：复刻视频 00:50 关键帧——雷电直贯敌方英雄头像并向全场 5 个槽位依次电光奔涌、粒子炸裂。
    - **随从突刺与刀光斩击（Creature Lunge & Slash Impact）**：随从出击前探撞击时，目标受击卡牌或英雄正中心绽放锐利金白交织的斩击刀光（`.vfx-slash-impact`），精准同步 `attack.ogg`。
    - **敌方出牌告示弹窗原版细节对齐（AI Announcement Scroll Modal）**：弹窗顶栏严格对齐视频格式 `[敌方名] 召唤/施法 [卡牌名]`，副标题规范为 `[系别][生物/魔法]，费用 [X]`，底栏统一为原版字样 `按任意键继续`。

## [2.5.4] - 2026-09-28

### Changed
- **对决战场全屏要素高精调优：卡槽加高、英雄栏加宽加高、法术特效动画与移动端防截断（Grand Combat Refinements, Spell VFX, Taller Slots & Mobile Adaptation）**：
  - **英雄信息栏加高与卡牌检视羊皮纸高度紧凑化（Taller Hero Rows & Compact Inspector）**：
    - 英雄状态栏高度大幅提升至 `clamp(68px, calc(60px + 1.8vh), 96px)`，头像放大至 `44-62px`（外框 `52-72px`），血量大字跃升至 `26-42px`，英雄名字提升至 `17-26px`，5 系能量芯片加宽加高至 `24-34px`，数值字号达 `16-24px`。
    - 卡牌检视详细信息羊皮纸高度适度压低至 `flex: 0.82`（最大高度 `140-230px`），大幅减少垂直空间占用，将更多视野留给英雄与战况记录。
    - 战斗实况记录高度相应提升（`flex: 1.18`），标题升至 `16-24px`，播报文字字号升至 `clamp(15px, calc(13.8px + 0.42vw), 22px)`，字体大而清爽。
  - **卡槽高度拉高与挺拔比例升级（Taller Battlefield Slots）**：
    - 战场 6 卡槽由原本偏矮偏扁的 4:3.6 调整为黄金纵向长方形 `aspect-ratio: 3.8 / 4.4`，最大高度提升至 `205px`，槽位在战场上更加挺拔高大、气派恢弘。
    - 卡牌上的费用宝石字阶显著增大至 `clamp(16px, calc(13.8px + 0.45vw), 23px)`（尺寸 `25-38px`）；攻击力（红框）与生命值（绿框）徽章字阶升至 `clamp(15px, calc(13.5px + 0.45vw), 23px)`（尺寸 `25-38px × 23-32px`）。
    - 左侧快捷操作按钮栏宽度拓展至 `64-88px`，按钮图标放大至 `18-28px`，按钮文字放大至 `13-18px`（粗体 900）。
  - **全套魔法卡牌施法特效动画（Full-Blown Spell Casting VFX System）**：
    - 全面修复魔法卡牌施法仅有音效无视觉动画的缺陷，新增 `playSpellVFX` 视效驱动管线：
      - **雷电系法术**：全屏白金色强雷落雷闪光 + 天谴雷霆穿透光柱（`.spell-vfx-bolt`）+ 全屏剧烈震颤（`screen-shake`）+ 目标受击槽位剧烈爆裂。
      - **火焰系法术**：全屏烈焰冲击波爆散（`.spell-vfx-flamewave`）+ 目标受击灼烧爆破 + 震颤。
      - **酸雨/剧毒法术**：从天而降的毒雾与酸蚀绿光雨幕（`.spell-vfx-acidic`）。
      - **特殊/奥术法术**：深紫奥术符文星阵爆裂（`.spell-vfx-arcane`）。
  - **牌桌自然光影色调恢复（Restored Natural Battlefield Lighting）**：
    - 彻底移除战场区域原有的过曝滤镜（`filter: brightness/contrast/saturate`），完全恢复自然柔和的写实景深光效。
  - **魔法卡牌检视原画尺寸与生物卡牌 1:1 统一（Unified Spell & Creature Art Box Scale）**：
    - 彻底移除检视面板中魔法卡牌原画的放大变形（`scale(1.35)`），与生物卡牌统一使用相同的边框规格与投影尺寸，彻底消除两类卡牌图标尺寸不一致的视觉割裂。
  - **小屏手机横屏自适应防截断（Small Mobile Responsive Layout Guard）**：
    - 新增 `@media (max-height: 620px), (max-width: 900px)` 移动设备专属保护规则，自动缩小原画至 42px、标题至 13.5px、描述字号至 11.5px（行高 1.35），杜绝小屏手机下技能描述被裁切截断。
- **FHD（1080P）与超宽大屏战斗界面全局大字号与饱满排版深度升级（Grand Typography & Fluid High-DPI Scaling for FHD/Ultrawide）**：
  - **卡牌技能描述与羊皮纸检视大幅放大（Parchment Card Inspector Scaling）**：
    - 将卡牌技能描述文本字号由原保守上限 18px 全面提升为 `clamp(15.5px, calc(14px + 0.55vw), 23px)`，行高优化至 `1.65` 并采用加粗中明度暖黑字色（`font-weight: 700; color: #231304`），文本在大屏下自然充盈整张羊皮纸，消灭大半张空旷黄底留白。
    - 卡牌标题由最高 22px 提升至 `clamp(18px, calc(16px + 0.6vw), 26px)`；副标题英文提升至 `clamp(13.5px, calc(12px + 0.35vw), 19px)`。
    - 检视原画立绘缩略图尺寸放大至 `clamp(62px, calc(52px + 1.8vw), 100px)`，攻防属性徽标提升至 `15-22px`。
    - 战斗实况记录日志标题提升至 `15-22px`，滚动播报文字字号提升至 `clamp(14px, calc(13px + 0.35vw), 20px)`，远距离与大屏幕下观看战报清晰明朗。
  - **英雄状态栏与能量面板醒目化（Hero Status & Mana Chips Grand Scale）**：
    - 英雄血量数字字阶进一步放大至 `clamp(24px, calc(20px + 0.8vw), 38px)`，红绿神圣光泽更加醒目。
    - 英雄姓名提升至 `clamp(16px, calc(14.5px + 0.45vw), 24px)`，流派标签提升至 `11.5-16px`。
    - 5 系能量槽芯片尺寸增大至高度 `22-32px`，内嵌元素图标与能量数字字阶提升至 `15-22px`。
  - **随从槽位、手牌数值徽章与战场提示（Board Slots, Cost Gems, Atk/Hp & Banner）**：
    - 战场中央阶段提示 Banner 字阶由原 15px 上限跃升至 `clamp(13.5px, calc(12px + 0.45vw), 22px)`，内边距同步延展，阶段切换醒目威严。
    - 战场 6 卡槽空槽编号由最高 24px 提升至 `clamp(20px, calc(16px + 0.7vw), 32px)`，槽位最大限制拓宽至 `220px × 160px`。
    - 随从与手牌的费用水晶（Cost Gem）尺寸放大至 `22-34px`（字号 `14-20px`）；攻击力（ATK）与生命值（HP）徽章放大至 `22-34px × 20-28px`（字号 `13.5-20px`），攻防数值一目了然。
    - 5 列手牌系别表头高度增至 `24-34px`，图标与文字字号提升至 `13.5-20px`。
    - 侧边快捷功能栏按钮文字提升至 `11.5-16px`，图标提升至 `16-24px`。
  - **全系统兼容特殊系 Emoji 呈现（Unicode Compatible Element Icons）**：
    - 将幻术系（Illusion）图标由部分 Windows 字体缺失的单面镜替换为通用 Unicode 6.0 戏剧魅影 `🎭`，彻底根除在大屏或 Windows 环境下偶现的未识别字符白色方块（`▯`）问题。
- **左侧面板 33vw 黄金比例拓宽、右侧战场 100% 满宽与全界面大字号升级（33vw Left Panel, 100% Full-Bleed Right Arena & Grand Typography）**：
  - **右侧 100% 满宽消除水平空旷死区**：彻底移除此前固定 `max-width: 1180px` 导致右侧留出大面积空闲黑绿背景的缺陷。将牌桌槽位区 `.combat-slots-arena` 和手牌区 `.combat-hand-grid` 全面放开为 `width: 100%; max-width: 100%`，5 列手牌与 6 个随从槽位铺满右侧全部水平视宽，在 FHD（1920×1080）与超宽大屏（2000×900）下彻底消除右侧空旷无卡死区。
  - **左侧面板拓宽至黄金三分之一（33vw / 最大 700px）**：左侧面板 `.combat-left-panel` 调整为 `clamp(330px, 33vw, 700px)`，在 1920px 屏幕上自适应展开至 633px、2000px 展开至 660px，形成完美的 1:3:6 黄金分割布局，左侧大幅扩容消除局促。
  - **字号与立绘全面加大放大，解决字小与羊皮纸空旷**：
    - 羊皮纸卡牌立绘缩略图跃升至 `clamp(52px, calc(44px + 1.5vw), 80px)`（FHD 下可达 73px+）。
    - 卡牌标题跃升至 `clamp(16px, calc(14px + 0.4vw), 22px)`，技能描述提升至 `clamp(14px, calc(12.5px + 0.35vw), 18px)`（行高 1.6），丰满充实整张羊皮纸，消灭空旷空白。
    - 英雄生命值升至 `clamp(22px, calc(18px + 0.6vw), 32px)`，能量芯片提升至 20-27px 高（数值 13-18px），字号大而清晰醒目。
    - 卡牌费用水晶与攻防徽章增大至 `clamp(20px, calc(18px + 0.35vw), 28px)`（字号 12-16px），手牌列标题升至 12-16px。
- **开发服务器默认端口固定为 5174（Dev Server Port Fixed to 5174）**：
  - 新增 [vite.config.ts](file:///d:/sync/project/Spectromancer/android/vite.config.ts) 并同步更新 [package.json](file:///d:/sync/project/Spectromancer/android/package.json) 启动脚本，将本地开发服务器和预览端口统一绑定为 `5174`，彻底避免与本地其他服务（如 5173 占用的 SMS 管理系统）产生端口冲突。
- **超宽屏（如 2000×900 / 20:9 比例）多分辨率响应式比例对齐与防过度拉伸约束（Widescreen Layout Alignment & Hand/Slot Cohesive Scaling）**：
  - **左侧面板自适应占比显著拓宽（27vw / 最大 550px）**：将左侧面板 `.combat-left-panel` 宽度调整为 `clamp(310px, 27vw, 550px)`，在 2000px 屏幕上自适应展开至 540px（占屏比由 21% 提升至 27%），彻底解决左侧区域偏小偏窄、右侧留白空旷的问题；操作条相应微增至 56px。
  - **英雄状态与能量芯片放大**：英雄头像放大至 38px（外框 44px），生命值数值字阶增至 22px，5 系能量芯片加宽增高（21px）且数值提升至 14px，更具大作感。
  - **卡牌检视羊皮纸丰满化排版与去空旷**：检视原画缩略图由 44px 提升至 52px，标题提升至 16.5px，技能描述字号提升至 14.5px（行高 1.48）；双层羊皮纸分配比例调整为 0.95 : 1.15，将更多纵向净空留给实况记录滚动列表，消除了原本检视羊皮纸下方大块无文字黄底留白。
  - **核心作战舞台（Playfield）扩展至 1180px**：将牌桌 `.combat-slots-arena` 与手牌区 `.combat-hand-grid` 统一最大宽度由 1080px 扩展至 1180px；单个卡槽最大尺寸由 138×120px 进一步优化至 148×124px，手牌与卡槽居中对称展开，两侧保留 ~140px 黄金留白，兼具视觉气势与克制比例。
- **出牌入场飞行卡牌完整形态与等比缩放重构（Full Card Summoning Flight & Proportional Morphing）**：
  - 彻底修复出牌就位动画（`.flying-card-ghost`）仅显示孤立攻防徽章截断碎片的问题：全面废弃旧版简易文本框结构，统一重构为与在场实体卡牌 100% 一致的完整卡牌（`.board-card.vertical`），完整包含高清全景立绘原画、右上角元素费用宝石与真实攻防数值徽章。
  - 升级飞行形变插值算法：动画起始基于手牌真实尺寸，飞行入槽过程中基于 X/Y 轴分别独立插值缩放（`scale(scaleX, scaleY)`），从手牌起飞、弧线跃升到精准落入卡槽全过程完整缩放呈现，零突变零违和。
- **战场与手牌纵向高度黄金比例微调（Battlefield 45vh & Hand 55vh Rebalance）**：
  - 将上部牌桌战场（`.combat-battlefield-section`）高度上调至 `45vh`，下部手牌区适配调整至 `55vh`，牌桌景深与随从槽位更显宏大通透。
  - 左侧面板（`.combat-left-panel`）宽度微调拓宽至 `clamp(295px, 26.5vw, 355px)`，为 `.combat-info-column`（英雄状态、卡牌检视羊皮纸与战况记录）进一步释放横向排版净空。
- **左侧操作控制柱缩窄与信息展示区拓宽（Action Strip Narrowing & Info Column Widening）**：
  - 将最左侧操作控制柱（`.combat-actions-strip`）宽度进一步缩窄至 `52px`，图标微调为 14px、文本微调为 9.5px（字距 -0.3px），更精致小巧且无横向溢出。
  - 将手牌切换按钮文案由“看对手 / 看自己”优化升级为更直观规范的“对手卡牌 / 己方卡牌”。
- **牌桌随从卡槽上下间距收窄（Tighter Arena Slot Vertical Gap）**：
  - 将牌桌敌我双方 6 槽位之间的上下垂直间距（`.combat-slots-arena` 的 `gap`）由 7px 收紧至 3px，阵线对决感更强，槽位上下金雕装饰衔接更紧凑自然。
- **左侧控制面板适度收缩与右侧主界面拓宽（Combat Left Panel Slimming & Arena Expansion）**：
  - 将 `.combat-left-panel` 宽度由 `clamp(350px, 32vw, 420px)` 收窄调优至 `clamp(280px, 25vw, 335px)`，释放屏幕宽度给右侧核心游戏区域。
  - 右侧战场牌桌（`.combat-slots-arena`）宽度上限扩展至 920px（占比 90%），单个生物槽位（`.combat-board-slot`）最大尺寸由 94×90px 放大至 108×98px，牌桌视觉更宽阔醒目。
  - 手牌区 5 列卡牌随右侧拓宽自适应拉伸加宽，卡片展示面积增大，费用晶石与攻防数值徽标同步清晰化放大（20px/17px）。
- **魔法卡片全景长方形自适应适配（Full-Bleed Rectangular Spell Cards Adaptation）**：
  - 针对原透明圆形光球的 33 张法术卡牌立绘，采用全景铺满长方形适配方案（`object-fit: cover` 与 `scale(1.42)` 铺满卡框），消除原本圆形居中缩小缩进导致四周产生的大面积黑边与空旷感，使炫目魔法特效完整充满整张长方形卡牌，与生物卡牌保持一致的 CCG 卡面质感。
  - 同步优化羊皮纸检视原画（`.parchment-card-art.spell-art`）与出牌特写展示。
- **生物类卡片头部裁剪下移调优（Creature Head Positioning & Top Crop Shift）**：
  - 将生物随从卡牌（手牌、牌桌场上、飞行幽灵卡及出牌特写）默认裁剪基准由 `top center`（0% 顶部）优化为 `center 20%`。
  - 适度裁除插画顶端冗余的空旷天空/背景，使随从生物的面部与头顶更贴近卡牌顶端边框，下端呈现出更丰富的躯干与战斗姿态，大幅增强立绘饱满度。

## [2.5.3] - 2026-09-27

### Fixed
- **魔法卡牌透明通道与全景法球展示（Spell Cards Full PNG Transparency & Centered Framing）**：
  - 彻底修复落雷术、火焰波浪等 33 张法术卡在提取时因转存为 JPEG 导致透明边缘变为刺眼白块的问题，全量重新导出为保留完整 RGBA Alpha 通道的高清 PNG 格式。
  - 法术卡牌立绘改用无裁剪居中展示（`object-fit: contain; object-position: center;`），底层融入奥术紫晶暗色星海，卡面法术圆球与雷电光芒 100% 完整展示，消除了底部被截断和白色背景缺陷。
- **牌桌卡槽增宽调扁与防遮挡优化（Wider, Flatter & Unobstructed 6-Slot Arena）**：
  - 牌桌槽位调整为更加宽厚、适度压低高度的黄金比例（宽度由 84px 增至 94px，高度由 106px 适度缩至 90px，宽高比 4:3.9）。
  - 牌桌下沿留白边距增至 12px，使己方下排卡槽下沿金雕与外框彻底脱离手牌区顶端边缘，杜绝被遮盖现象。

### Added
- **全套战场战斗微动效与打击反馈闭环（Comprehensive Combat & Entrance Animations）**：
  - **生物攻击突刺（Attack Lunges）**：生物攻击时触发动态向前突刺动画，玩家随从向上突刺冲击敌阵（`lungePlayer`），敌方随从向下威压突刺（`lungeEnemy`），配合刀剑劈砍与雷击音效。
  - **受击震颤与红光爆发（Impact Shake & Flare）**：目标随从或英雄受到攻击伤害时剧烈震颤并爆发出血红辉光（`card-impact-hit`），同时向上跃升立体飘动伤害数值（`floating-combat-text.damage`）。
  - **对方使用卡牌特写放大（Opponent Card Magnification）**：敌方出牌时触发金色横幅与黑曜石背景的卡牌放大展屏特写（`ai-announcement-overlay`），并播放对应法术音效。
  - **卡牌入场凌空飞行与落位冲击（Card Entrance Flight & Settle）**：出牌召唤时生成带有发光法力尾迹的实体幽灵卡（`flying-card-ghost`）沿抛物线凌空飞入目标槽位，槽位爆发炫目落位金光（`slot-landing-flash`）、法力波纹扩散（`slot-summon-ripple`）及卡牌弹性就位微动效（`card-summon-settle`）。

## [2.5.2] - 2026-09-26

### Added
- **五系手牌列专属元素边框与彩带标题（Distinct Elemental Column Framing & Banners）**：
  - 手牌区 5 列卡牌（火、水、气、土、特殊专精）均外嵌独立的元素主题发光边框与半透明暗色背景底衬，色彩鲜明极易辨识：
    - 🔥 **火系**：烈焰绯红边框与熔岩红辉光（`#ef4444`）
    - 💧 **水系**：碧海蔚蓝边框与深海蓝辉光（`#0ea5e9`）
    - ⚡ **气系**：雷霆金黄边框与闪电金辉光（`#eab308`）
    - 🌿 **土系**：大地翡翠边框与森林绿辉光（`#22c55e`）
    - 🔮 **特殊系**：奥术紫晶边框与秘法紫辉光（`#a855f7`）
  - 每列顶部新增 20px 紧凑的专属元素标题栏（`.hand-column-header`），标有元素图腾与系列中文名称（如“🔥 火系”、“💧 水系”、“👁️ 支配法师”等）。

### Changed
- **元素能量条无缝整合进英雄头像区块（Elemental Mana Embedded Inside Hero Cards）**：
  - 彻底移除原本悬浮于牌桌上方（敌方）及手牌区上方（己方）的独立能量条，完全消除能量条遮挡或挤压 6 槽位牌桌战场的空间冲突。
  - 将双方的 5 系元素能量（🔥火、💧水、⚡气、🌿土、🔮特技）分别无缝整合进对手与玩家的头像区块内，位于英雄名称/血量下方；职业专精（如“巫术法师”、“支配法师”）则转化为名称旁紧凑的法师徽章标签，既直观紧凑又时刻可见双方全系法力储备。
- **手牌区大幅增高（58vh）与卡牌大幅展屏（Taller CCG Hand Cards）**：
  - 得益于移除原本占用垂直高度的手牌上方能量条，手牌区纵向高度由 52vh 扩展至 58vh，4 行卡牌单张高度跃升至 ~95px–110px（相较此前压缩高度翻倍）。
  - 卡牌画面可展现更为丰富完整的立绘细节（头部、躯干、武器与施法特效尽收眼底）。
- **彻底消除卡费、生命、攻击数值叠加遮挡（Zero-Overlap Card Badges Layout）**：
  - 费用圆形晶石严格锚定于卡牌**右上角**（`top: 3px; right: 3px;`）；
  - 攻击力红色方块严格锚定于卡牌**左下角**（`bottom: 3px; left: 3px;`）；
  - 生命值绿色方块严格锚定于卡牌**右下角**（`bottom: 3px; right: 3px;`）；
  - 随着卡牌高度翻倍，右上角卡费与右下角生命值之间拥有超过 60px 的纵向充裕净空，左下角攻击力与右下角生命值拥有约 60px 的横向净空，彻底解决此前卡面数值互相叠压、无法看清的缺陷。
- **牌桌战场高度与留白优化（Refined 42vh Battlefield Arena）**：
  - 牌桌战场调整为 42vh 居中排布，上方仅保留半透明金纹行动提示横幅，中央 6 槽位对阵阵线更加通透开阔，四周背景雪山与苍穹视野完全解放。

## [2.5.1] - 2026-09-26

### Changed
- **项目目录结构全面整理重构（Repository Architecture Reorganization）**：
  - **PC 端项目归集（`pc/`）**：将原根目录下散落的 PC 原版游戏资源与可执行程序（包括 `Audio`、`Campaign`、`Fonts`、`Help`、`Images`、`Inf`、`Saves`、`Scripts` 目录及 `Spectromancer.exe`、DLL 运行库、配置文件、游戏日志与指南文本）统一归整至独立的 `pc/` 文件夹。
  - **安卓端项目归集（`android/`）**：将原本的 `mobile_game` 目录更名为 `android/`，作为正式的原生安卓独立 App（Capacitor + Vite + TypeScript）项目根目录，并同步重构了脚本中的路径引用与包名规范。

### Removed
- **清理历史测试目录与临时碎片文件（Test & Scratch Cleanup）**：
  - 彻底清理早期基于 Winlator 模拟器的过渡安装目录 `Android_Deployment/`。
  - 彻底清理包含对战录屏视频的 `test/` 目录及解压的临时电子书 `temp_epub/` 目录。
  - 清除项目根目录及各子模块中残留的测试截图和临时图片（如 `battle_hand_crop.jpg` 等）。

## [2.5.0] - 2026-09-26

### Added
- **左侧操控区重构为单列控制条（Far-Left Vertical Action Strip）**：
  - 将当前回合状态胶囊（你的回合/敌方行动）、看对手（切换手牌）、设置、投降、获得建议、结束回合 6 大战术操控项全部规整归集到最左侧垂直单列（`.combat-actions-strip`）。
  - 右侧紧邻英雄信息柱（敌我头像、红/绿巨额血量）与双层羊皮纸（卡牌检视器与实况记录），并将 `.combat-left-panel` 宽度适度拓宽至 `clamp(350px, 32vw, 420px)`，更符合横屏手持大拇指触控操作习惯。

### Changed
- **主菜单模式选项全面水平与垂直居中（Main Menu Mode Options Centering）**：
  - 修复图 1 中启动页菜单卡片向右偏斜的问题，改由弹性居中容器约束（`justify-content: center; align-items: center; margin: 0 auto;`），在各种横屏分辨率下均严格居中呈现。
- **牌桌战场零重叠与留白呼吸布局（Zero-Overlap Centered 6-Slot Arena）**：
  - 彻底消除图 2 中战场卡槽与双方元素能量条发生空间挤压重叠的缺陷：槽位区域宽度约束至 76%（上限 740px），卡槽采用 `max-width: 84px; max-height: 106px; aspect-ratio: 3/4` 严谨尺寸，与顶部敌方能量条及底部玩家能量条之间预留充裕的呼吸间隔，绝不遮盖对战牌桌背景。
  - 彻底移除双方能量条上多余的“己方能量”和“敌方能量”侧标文字徽章，纯粹保留 5 块拱形元素玄石神坛与霓虹晶石法力值，整体更加通透干练。
  - 调优战场背景亮度和色彩饱和度（`brightness(1.2) contrast(1.05) saturate(1.15)`），呈现更为明亮通透的苍穹奇幻对决景致。
- **卡牌原画顶部对齐裁剪与攻防费用全量明示（Top-Cropped Card Art & Full Stat Visibility）**：
  - 随从与手牌立绘统一切换为顶部向下裁剪渲染（`object-position: top center; object-fit: cover;`），完整呈现角色头部、神冠、容貌与上半身，消除被腰斩的问题。
  - 费用晶石（右上角）、攻击红方块（左下角）与生命绿方块（右下角）统一提升至顶层 `z-index: 10`，并采用高对比度雕纹与阴影，保证卡牌攻防费用 100% 清晰直观、绝不遮挡。

### Fixed
- **修复 12 处资源文件名大小写 404 导致卡牌损坏的问题（Case-Sensitive Asset Loader Fix）**：
  - 彻底修复 `KeeperofDeath.jpg` / `KeeperOfDeath.jpg` 等 12 处因移动端大小写敏感导致原画加载失败的问题，补齐资源镜像与数据对应。

## [2.4.0] - 2026-09-26

### Added
- **经典 6 槽位牌桌战场与留白呼吸布局（6-Slot Centered Battlefield Arena）**：
  - 牌桌槽位由 5 个正式升级为官方原版正统的 6 个槽位（双方各 6 格，共 12 战斗槽位）。对决冲锋对撞、生物对线攻击与相邻溅射/光环技能全面适配 6 格阵线逻辑。
  - 槽位区域不再横向铺满边缘，而是以精致的金雕阵列居中呈现（宽度收敛至 82% 并居中），四周留出宽裕的苍穹雪山与草木留白空间。
  - 还原了原版上下金雕镂空花纹（`Topslot.png` 与 `Bottomslot.png`），空槽位保持半透明透光质感，使背景自然通透。

### Changed
- **全面恢复经典竖版集换式卡牌（Authentic Vertical Portrait CCG Cards）**：
  - 战场驻留随从与手牌区 20 张卡牌全面回归经典标准竖版比例（Vertical Portrait，约 3:4 比例）。
  - 彻底移除原本遮挡立绘的横向卡名条，原汁原味还原原版卡面：右上角内嵌圆形晶石费用，生物左下角为红色攻击方块、右下角为翠绿生命方块，法术卡保持纯净法术图腾；点击卡牌时由左侧羊皮纸完整呈现卡牌详尽战术技能与属性。

## [2.3.0] - 2026-09-26

### Added
- **战场即时存档与主菜单读档恢复（Battle Auto-Save & Resume System）**：
  - 在“设置”弹窗中新增“💾 保存战斗并返回主菜单”功能，点击后自动将当前双方血量、五系能量、场上随从及手牌完整持久化至本地存储，并带有金色浮动 Toast 提示。
  - 主菜单顶部功能栏新增“读取存档”状态按钮，内容区新增高亮发光的“⚡ 发现进行中的对战存档”快捷卡片，一键即时载入历史战局继续博弈。
- **独立醒目的古神符文元素神坛（Standalone Grand Elemental Mana Altars）**：
  - 双方元素能量区域彻底脱离传统控件风格，升级为独立的玄石雕纹神坛（Altar），左侧分别配有猩红“敌方能量”与深蓝“己方能量”立体阵营徽标。
  - 各元素神坛槽位内嵌五系专属发光符文图腾与 20px 霓虹辉光晶石数字，视觉对比强烈且极易识别。

### Changed
- **卡片原画全景铺满与超采样高清画质增强（Full-Bleed Card Artwork & HD Sharpening）**：
  - 全量 331 张卡牌原画资源经由双三次 Lanczos 超采样与微锐化优化，画面精度大幅提升且完整保留细节。
  - 战场槽位与手牌区卡牌全面升级为全景铺满（Full-Bleed，`object-fit: cover`），彻底杜绝非等比拉伸变形；卡名浮雕横幅与攻防属性栏以浮层形式自适应悬浮于原画上下端。
- **左上角双列并列模块化重构（Left-Top Duo Section Layout）**：
  - 移除原先冗余的“规则”与“菜单”按钮，精简对决界面干扰项。
  - 将左上角划分为两大紧凑并列的独立区块：
    1. **对决双方角色柱（Heroes Stack）**：对手与玩家头像/血量/职业卡垂直上下堆叠；
    2. **战术指令控制柱（Controls Stack）**：当前回合指示胶囊、查看对手手牌键、设置键、投降认输键自上而下对齐排布，形成规整的长方形控制阵列。
- **战斗记录微调与全游戏字号普调增大（Combat Log Scale & Universal +2px Font Scaling）**：
  - 战斗实况记录（Combat Log Chronicle）羊皮纸高度微调缩减（flex 0.95），腾出充裕的卡牌技能检视空间。
  - 战况日志文字、卡牌检视名称与描述、英雄数值、神坛法力值及所有弹窗说明字号整体上调至少 2px，并全面保持响应式屏幕尺寸自适应。

## [2.2.0] - 2026-09-26

### Added
- **远古符文元素能量神坛（Grand Elemental Mana Altars）**：
  - 彻底淘汰原本平庸简陋的扁平芯片样式，战场上方（敌方）与手牌区上方（己方）均升级为厚重雕纹玄石神坛。
  - 刻印五大元素专属发光图腾符文（🔥火、💧水、⚡气、🌿土、🔮特技），内嵌 16.5px 粗体霓光水晶晶石能量数值，与普通按钮及其他界面完全区隔，醒目霸气。

### Changed
- **标准长方形集换式卡牌重构（Rectangular Hand Cards CCG Redesign）**：
  - 彻底告别被压缩扁平的条形列表样式，卡牌全面重塑为端正的长方形（尺寸略小于上方召唤槽位），完整保留卡面全部内容。
  - 卡片与卡片之间间距收缩至 2px 极小缝隙，紧凑精致，消除空隙，保证 5 列 20 张手牌全景完整展示无遮挡。
  - 全量升级卡牌原画资源，采用 150×150 高清大图（`imgBigUrl`）与高清插画抗锯齿渲染，画面清晰度成倍提升。
  - 卡面布局优化：左上角元素琉璃费用封印、顶部半透明金边卡名飘带、底部金黄 ⚔️ 攻击与翡翠 ❤️ 生命（或紫光 ✨ 法术）属性底栏。
- **敌我法师头像区域风格差异化（Differentiated Hero Aesthetic Themes）**：
  - 对手头像区：采用暗夜玄石、深渊血晶底色与血红锋芒外框，猩红发光生命值与“敌”字战意徽标。
  - 玩家头像区：采用皇家星海午夜深蓝与璀璨鎏金外框，翡翠辉光生命值与“我”字守护徽标。
- **对战核心交互控制重排与放大（Relocated & Enlarged Combat Controls）**：
  - 将“查看对手手牌”按键直接移至**对手头像卡片右侧**，尺寸增大并强化铜铁立体质感与切换微光。
  - 将“你的回合 / 敌方行动”回合指示徽标直接移至**玩家头像卡片右侧**，尺寸增大并赋予金辉呼吸律动光效。

## [2.1.0] - 2026-09-26

### Added
- **多战役战场背景自由切换（Multi-Battlefield Sceneries）**：
  - 新增并部署了 4 种风格迥异的高清对决战场背景（星辉圣殿 `battlefield_citadel.jpg`、天界圣峰 `battlefield_sky.jpg`、熔岩炼狱 `battlefield_volcano.jpg`、永恒密林 `battlefield_forest.jpg`）。
  - 在“设置”弹窗中新增战场背景切换器，支持实时无缝换景并自动持久化存储。
- **对决左上角功能操作条全幅重构（Enlarged Combat Utility Bar）**：
  - 彻底淘汰原先挤在对手头像侧边的 28px 迷你图标列，重塑为顶部独立横贯的 4 枚大尺寸金边石雕功能键（📖 规则、⚙️ 设置、🏠 菜单、🏳️ 投降），图文双显、拇指触控热区大幅提升。

### Changed
- **卡片由竖版重构为横板布局（Horizontal Card Dimensions）**：
  - 手牌与槽位卡牌全面重构为横板宽幅卡（手牌自适应宽矩形，战场槽位 `aspect-ratio: 4/3`），左侧内嵌正方形卡牌原画与费用徽记，右侧清晰排布卡名与攻防数值，彻底消除多余空隙。
- **对战攻击与召唤动画平滑放缓（Slower & Clearer Combat Animations）**：
  - 冲锋突刺动画时长延长至 0.75s，受击震颤延长至 0.6s，入场飞行动画延长至 0.72s，回合轮转延迟增至 0.9s，给玩家充分的战况阅读与博弈反应时间。
- **主界面奇幻圣殿背景全面部署（Start Menu Background Redesign）**：
  - 剔除山海经国风背景，全面部署 16:9 欧美高清奇幻浮空城堡圣殿与元素风暴背景（`MainMenuBg.jpg`），与全新矢量 Logo 完美契合。
- **启动背景音乐自启与全触控解锁（Launch BGM Auto-Play & Unlocking）**：
  - 优化音频管理器初始化逻辑，启动即加载 `menu1.ogg`，全渠道监听触摸与交互事件，解决移动端与浏览器初启无音乐的问题。
- **战斗败北与胜利模态框全面重铸（Redesigned Battle Defeat/Victory Dialog）**：
  - 彻底移除简陋文本框，采用专属暗黑玄石雕纹模态窗口（`.battle-result-stone-dialog`），搭配血红/金光动态神印徽标、详尽战局战报统计与高对比度立体大按键（整军再战、返回主菜单、进军下一关）。

## [2.0.0] - 2026-09-26

### Added
- **全新原创矢量游戏 Logo（Brand New Vector Game Logo）**：
  - 彻底停用原图 `SpectromancerLogo.png`，全新设计并集成高清自适应矢量 Logo（`game_logo.svg`），由五大元素法阵徽记（火、水、气、土、奥术宝石）与立体鎏金字效组成，适配高分率手机屏幕。
- **全新游戏品牌名称《元素秘境：魔导对决》（Elemental Realms）**：
  - 游戏正式定名为《元素秘境》（Elemental Realms），全面同步更新主标题、HTML 页面标题、移动端应用配置（Capacitor `appName` 与 Android `strings.xml`）及对决规则指南。

### Changed
- **版本号全面升级至 v 2.0.0**：
  - 同步升级主菜单页脚版本文本、`package.json` 项目版本至 `2.0.0`。
- **移除冗余全屏切换按钮（Android Immersive Fullscreen）**：
  - 鉴于安卓系统天然默认全屏沉浸式运行，彻底移除主界面顶部快捷栏的全屏按钮及设置面板中的全屏切换选项与对应事件。
- **原版卡牌原画与经典音效音乐保持 100% 官方复刻**：
  - 全量恢复并严格使用官方 120 张原版卡牌数据（无缺失插画）与全部 94 首原版 `.ogg` 战斗/菜单配乐及技能音效。

## [Unreleased] - 2026-09-26

### Added
- 全新 16:9 奇幻移动端启动背景（High-Fantasy 16:9 Widescreen Mobile Launch Background）：
  - 重新绘制并生成超高清 16:9 宽屏启动背景（`MainMenuBg.jpg`）：云端悬浮魔法圣殿城堡、极光雷鸣、深邃星空与元素能量旋涡，搭配前景金色符文法阵古祭坛，彻底告别 4:3 老画幅两端拉伸裁切。

### Changed
- 安卓手机端启动界面与菜单交互全面重构（Android Touch-Ergonomic Launch Menu Redesign）：
  - 彻底摒弃 2008 年 PC 桌面端生硬狭窄的垂直灰色药丸按钮列，重塑为现代化、拇指易触达的 2×2 大尺寸玻璃拟态战术模式卡片（Game Mode Cards）：
    1. ⚔️ 单局对战（主推荐金光高亮大卡：自定义 12 大流派与 78 款头像，人机快速博弈）；
    2. 🗺️ 战役模式（剧情蓝光卡：7 大篇章 · 65 关剧情挑战与领地首领讨伐）；
    3. 🏆 英雄联赛（紫光竞技卡：大师阶梯对抗，全职业大师切磋试炼）；
    4. 🎴 自组卡组（翡翠秘典卡：120 张官方正版卡牌与特技秘典）。
  - 顶部导航栏一体化布局：左上角经典发光标题 Logo 徽标与副标题，右上角集成移动端悬浮快捷胶囊键（📖 玩法规则弹窗、⚙️ 游戏选项与音效设置、⛶ 全屏切换）。
  - 底部增加动态游戏小贴士与移动端高清版本号，全面契合现代安卓横屏 CCG 手游视觉与触控体验。

## [0.2.0] - 2026-09-25

### Changed
- 移动端战斗界面视觉与交互体验深度调优（Mobile Combat UI & Visual Refinements）：
  - **调整双层羊皮纸高度比例与文字字号**：将卡牌检视羊皮纸调整为紧凑型（flex 0.72，最大高度 120px），战斗实况记录高度显著扩充（flex 1.28，最小高度 120px），战报滚动字号增大至 12.5px（行高 1.45），卡牌名称放大至 16px、描述文字放大至 14px，大幅改善对决信息可读性。
  - **修复手牌卡片扁平拉伸与图像失真**：严格锁定手牌卡片为标准 3:4 竖版卡牌比例（`aspect-ratio: 3/4`），卡牌原画居中填充，彻底消除因列宽拉伸导致的扁平长方形变形；同时微调战场区（45vh）与手牌区（55vh）高度分配，使 20 张手牌尺寸更大更舒展。
  - **重塑牌桌随从攻防徽章配色与造型**：彻底移除突兀的纯红/橙色圆形气泡底色，改用暗青铜深色浮雕矩形铭牌（`rgba(24, 18, 14, 0.95)`）搭配微倒角金边，攻击力呈现耀眼亮金（`#ffd700`），生命值呈现翠绿辉光（`#4ade80`），与石质对局牌桌完美融合。
  - **修复生物入场召唤动画底部闪烁消失缺陷**：排查并修复了飞行卡牌类名不匹配（`.card-flying-ghost` vs `.flying-card-ghost`）导致的脱离视口与流式错位问题，加入严格的 `position: fixed` 与坐标保护，恢复平滑立体的 3D 抛物线飞行动画、落槽金色冲击波与震颤反馈。
  - **精确校准电脑出牌中央弹窗与原版底图边框位置**：依据正版 `CardDescBg.png`（530×310）天然内嵌的左右两扇羊皮纸雕花框，将敌方出牌立绘精确居中置入左侧卡牌框，卡牌名称、类别、属性与技能说明自适应填充右侧文本框，标题与轻触跳过提示外置悬浮，消除文字溢出与立绘偏移。
  - **放大双方英雄名称与生命值字体**：英雄生命值字体增大至 19px 粗体红光发光字体，英雄名称放大至 15.5px 亮金字，副职业标签同步优化，关键战况数值一目了然。
  - **强化战场、法力石槽与手牌选牌区三层立体石刻间隔**：在对决战场槽位与手牌区之间加入 4px 青铜金边立体浮雕分割梁（带有深邃阴影与金边内发光），在五系法力符文石与下方 5 列手牌之间增设石刻横贯分割线，三个交互区域层级清晰分明。
- 彻底解决移动端背景空洞与全屏自适应布局（Mobile Fullscreen Landscape Adaptation & Rich Scenic Backgrounds）：
  - **告别纯黑虚空背景，全面融入正版奇幻全景**：
    - 主菜单全景：采用 1024×768 高清原画作为 100vw/100vh 覆盖背景（金色浮空大法师、云端奇幻白石城堡、暮光苍穹与一体化 Spectromancer 徽标），右侧悬浮石雕菜单药丸列与浮动金色法术尘埃粒子，无生硬裁切黑框，纯粹沉浸。
    - 对决战场分层全景：上半区（52vh）采用高山苍穹与飞瀑常春藤全景底图（`battlefield_sky.jpg`），容纳双方 10 个平行战斗卡槽与对手能量指示；下半区（48vh）采用雕花花岗岩祭坛石板底图（`table_stone.jpg`），铺满玩家五系法力符文石与 5 列 × 4 张 = 20 张对战手牌，彻底杜绝任何黑边或虚空断层。
  - **手机横屏全比例动态自适应（16:9 ~ 20:9）**：
    - 采用双列弹性视口流式布局：左侧控制区（28vw，240px~320px）集成顶部对手头像行、中部玩家头像行与回合脉冲符文、底部古典羊皮纸卡牌检视器（字体 ≥15px，高对比深棕黑字，带缩略图与类型标签）及大尺寸金边“结束回合”指令键。
    - 右侧战斗区（72vw）上下分层，战场槽位与 20 张手牌网格基于弹性比例与视口自适应，零无效留白，触控热区舒适饱满。
- 重构界面为现代原生响应式排版（Native Responsive UI Overhaul - 参考原版图示自建而非照搬背景贴图）：
  - 彻底移除对低清固定比例位图背景（`MainMenuBg.jpg`、`Singleduel1.png`、`CombatBackground.png`）的生硬平铺依赖，改由现代化纯 CSS 矢量渐变、微毛玻璃（Glassmorphism）、双层仿古青铜与流光金边构建。
  - **参考图1·主菜单重塑**：暗夜星空与浮动金色法术尘埃粒子背景、黄金微光呼吸 Logo 徽标与副标题、石刻浮雕药丸按钮列与单人/多人游戏分组。
  - **参考图2·单局对战设置窗口重塑**：现代暗金浮雕石框模态窗口、玩家与电脑对手双侧对称头像框（支持 `<` 与 `>` 顺畅轮播 78 张高清头像并附带序号标尺）、12 大流派职业轮播器与九宫格快捷选择面板（`⚙` 快速面板）。
  - **参考图3·对局战斗界面重塑**：
    - 左侧垂直工具栏（帮助指南、音频设置、返回菜单、认输投降）；
    - 英雄状态区（双方头像框、生命值、职业标牌）与中央回合状态符文脉冲指示；
    - 顶部对手 5 系能量石碑横向对齐；
    - 中央 5v5 生物对决战槽（支持点击任意在场生物实时检视其详尽技能说明，出牌时对应空槽金色微光呼吸提示）；
    - 左下角古卷羊皮纸检视面板（包含大尺寸原画缩略图、费用徽章、大字号攻防数值与大于 15px 的高对比度技能长文本描述，彻底杜绝眯眼费力）；
    - 右下角玩家 5 系能量石碑与“5 列元素 × 4 张卡牌 = 20 张手牌全阵列布局”（卡牌按费用梯级排列，可出牌金色光环提拉，能量不足置灰，选中绿色荧光轮廓）。

### Added
- 原版录屏全功能深度复刻（Full In-Game Feature Parity from Gameplay Recording）：
  - **对手手牌透视与切换（Show Opponent Hand）**：在双方英雄之间新增经典手牌切换卷轴按钮（`Showcardsbutton.png`），点击后可实时在底部 5×4 手牌区切换查看电脑对手的 20 张手牌；未揭示卡牌显示原版石龙卡背（`Cardslotfon.png`）与元素符文，已施放/明示卡牌面朝上显示，支持随时点击检视敌方技能。
  - **双层羊皮纸面板（Double Parchment Layout）**：左侧面板完整还原原版双层古卷设计，上层为卡牌详尽检视器（大图、攻防徽章、大字号技能描述），下层为实时对战战报史记（`Battle Log Chronicle`，自动滚动记录每一轮召唤、攻击、受创与阵亡事件）。
  - **AI 出牌中央特写公告（Center Summon Announcement Modal）**：敌方召唤生物或释放强力法术时，屏幕中央弹出原版石藤金边卡牌特写横幅（`CardDescBg.png`），清晰展示卡牌原画、名称与完整效果，伴随“轻触任意位置继续”提示，极大提高对战博弈信息清晰度。
  - **战术建议助手（Tactical Advice Engine）**：底部新增“获得建议”按键，基于场上局势、双方生物攻击威胁与法力情况，智能推荐最佳出牌与放置槽位并在手牌中以光环高亮。
  - **原生投降确认模态框（In-Game Surrender Modal）**：点击左侧认输旗帜时弹出古典石雕确认对话框（“您真的要投降吗？”与 [是] / [否] 选项），杜绝系统原生弹窗的违和感。
  - **战场提示横幅（Battlefield Dynamic Prompt Banner）**：出牌选牌时在 5v5 槽位正上方浮现动态金色提示（如“请点击己方空槽位以召唤【哥布林狂战士】”），并伴随目标槽位金色光环高亮。
- 原汁原味主启动菜单（Main Menu Reproduction）：
  - 完美复刻原版主界面背景（`MainMenuBg.jpg`：金光浮空法师与云端奇幻白石城堡）、高清纯正黄金宝石标题徽标（`SpectromancerLogo.png`）。
  - 还原经典石质药丸浮雕按钮列（`Menubtn2.png`、`Menubar.png`），实现单人游戏（单局对战、战役模式、英雄联盟、自组卡牌、轮抽联赛）、更多设置与全屏切换，循环播放原版经典主菜单背景音乐 `menu1.ogg`。
- 原版复古单局对战设置面板（Single Duel Setup Modal）：
  - 完整复刻原版石刻藤蔓边框弹窗（`Singleduel1.png`）。
  - 左右双侧对决者自定义：玩家与电脑对手均可使用原版双向浮雕箭头（`Heroslotbutton.png`）在 78 款经典英雄立绘中循环切换。
  - 支持 12 大法术流派（随机、巫术、死灵、圣职、机械、支配、混沌、幻术、恶魔、兽王、时空、哥布林）独立配置，并配备扳手快速选择器。
- 经典全景原版战斗对决界面（Authentic Battle Interface）：
  - 采用原版高山苍穹全景战场底图（`CombatBackground.png`）与黄金浮雕卡槽（`Topslot.png`、`Bottomslot.png`）。
  - 左侧边栏集成原版 4 大石雕功能按钮（帮助、设置、主菜单退出确认、认输投降）。
  - 左右英雄区呈现原版青铜浮雕头像框（`Portraitramka.png`）与即时生命值。
  - 右侧布局完全还原 PC 原版精髓：顶部对手五系能量石碑、底部玩家五系能量石碑，以及经典的“5 列元素 × 4 张卡牌 = 20 张手牌全阵列布局”，能量充足时泛起元素辉光，不足时呈现石化置灰。
  - 左下角古卷羊皮纸（`Paper.png`）实时检视面板，动态显示选中卡牌的高清大图、属性与大号高对比度技能说明，并配备原版石雕“结束回合”指令键（`Endturnbutton.png`）。
- 全量 120 张官方正版卡牌库与机制系统（120 Cards Full Expansion）：
  - 4 大基础元素（火、水、气、土）全面扩充至各 10 张经典核心卡牌。
  - 扩展至 11 大职业流派（新增恶魔召唤师、自然兽王、时空法师、哥布林酋长等及其专属机制）。
  - 完整实现原版 Richard Garfield 规则核心：每局对战从火、水、气、土与特殊系各随机抽取 4 张卡牌，构建独一无二的 20 张对战手牌，千局千面。
  - 将原版 122 张特殊 Alpha 通道 TGA 魔法原画完整转码适配为移动端高清纹理。
- 完整 65 关单人战役系统（Full Campaign Mode Integration）：
  - 深度解析原版 70 篇关卡档案（`Campaign/Desc/Opp01.txt` ~ `Opp70.txt`）与官方中文语言包（`Language.dic`），构建全量 65 关完整战役数据库（`campaign.json`）。
  - 新增战役 7 大章节标签页切换系统（学徒复仇、元素之争、巨兽狂王、混沌国度、黑暗远征、镜像阴谋、巫妖议会），支持查看每一关对手真实名称、头像画像、血量、敌方职业流派与剧情介绍，并可一键启动关卡挑战。
- 扩展 7 大经典流派与 44 张卡牌（7 Hero Classes & Expanded Cards）：
  - 在巫术、死灵、圣职基础上，新增机械师（Mechanician）、支配者（Dominator）、混沌大师（Chaosmaster）、幻术师（Illusionist）4 个经典扩展流派。
  - 导入 16 张专属流派卡牌与机制（包含拦截装甲、电磁护盾、精神镜像反弹、自爆地雷等），同步将原版 330 张卡牌原画资源完整归集。
  - 全面适配机械（Mechanics）、支配（Control）、混沌（Chaos）、幻术（Illusion）的专属元素宝石徽记、施法消耗角标、鬼影轨迹与动态粒子光效。
- 新增卡牌进入槽位动画系统（Card Entering Slot Animation）：
  - 玩家召唤生物时，卡牌从手牌位置浮起并以 3D 弧线抛物线轨迹高速滑入目标战场槽位（缓动平滑飞行与元素动态辉光）。
  - AI 对手召唤生物时，卡牌从敌方英雄头像处顺畅飞向选定槽位，让对手动作与意图清晰可见。
  - 目标槽位着陆冲击波光环（`slot-summon-ripple`，匹配各系元素特征色与震荡波），并播放原版沉浸落槽音效 `summondrop.ogg`。
  - 新生物入场弹性缓冲定型演出（`card-summon-settle`：落地瞬间膨胀发光并弹性回弹至标准卡槽）。
  - 法术卡牌释放演出：指向性法术飞向受击槽位产生能量爆裂，全场法术飞入战场中央绽放光芒后再接全屏法术特效。
  - 新增手牌出牌离手微暗态（`card-flying-out`）与动作并发防抖锁（`isActionPending`），杜绝连点或误触造成的逻辑混乱。
- 新增原版战斗背景音乐系统（BGM，循环播放经典对局原声 `combat1.ogg`，支持音效与音乐独立开关）。
- 新增全量音效库映射（包含施法、雷电、烈焰、召唤 `summon1.ogg`、胜利号角 `trumpet.ogg` 等 91 个原版音效）。
- 重构异步回合战斗时序管道（Asynchronous Combat Pipeline）：彻底解决此前战斗在 0 毫秒瞬间结算导致动画被覆盖的问题，实现槽位逐个冲锋、撞击受创闪烁（Card Impact）、鲜红浮字（Floating Text）与死亡淡出的真实战斗演出。
- 新增全屏法术特效层（实现火焰波浪冲击波、连锁闪电全屏电光、酸雨腐蚀等粒子覆盖）。
- 新增方案 B 移动端原生重制工程 `mobile_game`（基于现代 Vite + Vanilla TypeScript + CSS + Capacitor 架构）。
- 新增对战打击感与动态视觉特效系统：实现生物冲锋撞击动画（Lunge Attack）、浮动伤害/治疗飘字（Floating Combat Text）、重创屏幕震颤（Screen Shake）与阵亡特效。
- 新增《魔幻牌》核心卡牌与高精度素材库（完整双语属性与技能说明）。
- 新增移动端回合制 5 槽位战斗状态机与智能 AI 决策器（实现五系能量成长、单向攻击、飞行越墙、伤害法术与战报记录）。
- 新增移动端自适应宽屏（19.5:9 / 20:9）UI 与触控手势系统（轻触选牌/出牌、长按 250ms 呼出高清卡牌大图技能面板）。
- 新增原生 Android Studio 工程配置（`mobile_game/android`），锁定传感器横屏（`sensorLandscape`）与沉浸式全屏。
- 新增安卓部署套件目录 `Android_Deployment`（提供路线 A 的 Winlator 11.2 APK、预处理游戏包与触控映射）。

### Changed
- 优化战斗与召唤动画节奏（Animation Pacing & Delays）：
  - 将召唤卡牌入槽抛物线飞行时长从 360ms 放缓至 520ms，落地冲击波延长至 650ms，缓动曲线平滑度提高，让下牌动势清晰稳健。
  - 召唤着陆定型缓冲延迟提升至 380ms，使落地变形与光效有充足时间被视觉接收。
  - 战斗冲锋与打击间隔放缓（槽位攻击间隔从 350ms 调至 450ms），确保每次冲锋、受创震颤与飘字清晰可见。
- 全面放大卡牌文字与技能说明（Card Readability Optimization）：
  - 放大卡牌详情弹窗（`card-inspect-modal`）：宽度扩至 580px（92% 视口宽），卡牌名称放大至 22px，属性增至 16px。
  - 技能描述文字（`modal-desc`）放大至 15px，行高提升至 1.65，配以半透明黑金衬底背景框与高对比度文字，解决移动端文字辨识困难问题。
  - 增大手牌尺寸（102x136px）及字号（名称 13px、法力消耗 13px 加大圆角徽章）、战场槽位卡牌名称（12px）与攻防数值徽章（14px 特粗）。
- 修改 `Game.ctl` 配置：关闭 PC 开屏视频（`showsplash OFF`），防止安卓端冷启动时视频解码卡顿与黑屏，加速移动端启动。
