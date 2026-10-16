export interface AiModelConfig {
  enabled: boolean;
  provider: 'deepseek' | 'siliconflow' | 'ollama' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
  applyModes: {
    duel: boolean;
    league: boolean;
    campaign: boolean;
    custom_deck: boolean;
  };
}

export const PROVIDER_PRESETS: Record<AiModelConfig['provider'], { name: string; baseUrl: string; model: string }> = {
  deepseek: {
    name: 'DeepSeek (官方推荐 · 性价比之王)',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  siliconflow: {
    name: '硅基流动 SiliconFlow (多模型支持)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
  },
  ollama: {
    name: '本地 Ollama (完全免费 · 离线私有)',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
  },
  custom: {
    name: '自定义 OpenAI 兼容接口',
    baseUrl: '',
    model: '',
  },
};

const AI_STORAGE_KEY = 'setting_ai_model_config';

export function getAiConfig(): AiModelConfig {
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawModes = parsed.applyModes || {};
      return {
        enabled: Boolean(parsed.enabled),
        provider: parsed.provider || 'deepseek',
        apiKey: parsed.apiKey || '',
        baseUrl: parsed.baseUrl || PROVIDER_PRESETS.deepseek.baseUrl,
        model: parsed.model || PROVIDER_PRESETS.deepseek.model,
        applyModes: {
          duel: rawModes.duel !== false,
          league: rawModes.league !== false,
          campaign: rawModes.campaign !== false,
          custom_deck: rawModes.custom_deck !== false,
        },
      };
    }
  } catch {}

  return {
    enabled: false,
    provider: 'deepseek',
    apiKey: '',
    baseUrl: PROVIDER_PRESETS.deepseek.baseUrl,
    model: PROVIDER_PRESETS.deepseek.model,
    applyModes: {
      duel: true,
      league: true,
      campaign: true,
      custom_deck: true,
    },
  };
}

export function isAiEnabledForBattle(mode?: string): boolean {
  const config = getAiConfig();
  if (!config.enabled) return false;
  if (!mode || mode === 'ai_duel') return true;
  if (mode === 'lan') return false;
  const modes = config.applyModes || { duel: true, league: true, campaign: true, custom_deck: true };
  if (mode === 'duel') return modes.duel !== false;
  if (mode === 'league') return modes.league !== false;
  if (mode === 'campaign') return modes.campaign !== false;
  if (mode === 'custom_deck') return modes.custom_deck !== false;
  return true;
}

export function saveAiConfig(config: AiModelConfig): void {
  try {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save AI config to localStorage:', err);
  }
}

// Quick connection test
export async function testAiConnection(config: AiModelConfig): Promise<{ success: boolean; latencyMs?: number; message?: string }> {
  if (!config.baseUrl) {
    return { success: false, message: '请配置有效的接口地址 (Base URL)' };
  }

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const startTime = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model.trim() || 'deepseek-chat',
        messages: [
          { role: 'user', content: 'Say Ready in one word.' }
        ],
        max_tokens: 10,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        latencyMs,
        message: `HTTP ${res.status}: ${errText.slice(0, 100) || res.statusText}`,
      };
    }

    const data = await res.json().catch(() => null);
    if (data && data.choices && data.choices.length > 0) {
      // Auto-enable when test succeeds!
      config.enabled = true;
      saveAiConfig(config);
      return { success: true, latencyMs };
    }
    config.enabled = true;
    saveAiConfig(config);
    return { success: true, latencyMs, message: '响应正常' };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { success: false, message: '连接超时 (超过 8 秒未响应)' };
    }
    return { success: false, message: err.message || '网络连接失败' };
  }
}

export interface CombatAiLogEntry {
  timestamp?: string;
  source?: string;
  enemyName: string;
  enemyClass: string;
  enemyHp: number;
  playerHp: number;
  actionDesc: string;
  provider: string;
  baseUrl: string;
  model: string;
  status: string;
  latencyMs: number;
  systemPrompt: string;
  userPrompt: string;
  responseContent?: string;
  error?: string | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
}

// 格式化结构化对战文本日志块
export function formatCombatAiLog(entry: CombatAiLogEntry): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const nowStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const divider = '='.repeat(82);
  const subDivider = '-'.repeat(82);

  return [
    divider,
    `【记录时间】${entry.timestamp || nowStr}  (耗时: ${entry.latencyMs || 0}ms)`,
    `【记录来源】${entry.source || '游戏真实对决 (Live In-Game Battle)'}`,
    `【对战态势】`,
    `  - 对手名称: ${entry.enemyName} (职业: ${entry.enemyClass})`,
    `  - 双方血量: 电脑对手 ${entry.enemyHp} HP  VS  玩家 ${entry.playerHp} HP`,
    `  - 触发行动: ${entry.actionDesc}`,
    `【接口调用信息】`,
    `  - 服务提供商: ${entry.provider} (模型: ${entry.model})`,
    `  - 接口地址: ${entry.baseUrl}`,
    `  - 响应状态: ${entry.status}`,
    subDivider,
    `--- [REQUEST PAYLOAD 发送请求] ---`,
    `  [System Prompt]:`,
    `    ${entry.systemPrompt}`,
    `  [User Prompt]:`,
    `    ${entry.userPrompt}`,
    subDivider,
    `--- [RESPONSE RESULT 响应结果] ---`,
    ...(entry.error ? [`  [异常失败]: ${entry.error}`] : []),
    ...(entry.responseContent ? [`  [返回内容]: "${entry.responseContent}"`] : []),
    ...(!entry.error && !entry.responseContent ? [`  [返回内容]: (空)`] : []),
    `  [Token 消耗]: Prompt: ${entry.usage?.prompt_tokens ?? '--'}, Completion: ${entry.usage?.completion_tokens ?? '--'}, Total: ${entry.usage?.total_tokens ?? '--'}`,
    divider,
  ].join('\n');
}

// 将实战日志保存到 tools 采集器 (端口 3928) 与本地持久化
export function recordCombatAiTelemetry(entry: CombatAiLogEntry): void {
  const formattedText = formatCombatAiLog(entry);

  // 1. 本地 localStorage 缓存 (保留最近 50 条)
  try {
    const raw = localStorage.getItem('battle_ai_latest_logs');
    const logs: any[] = raw ? JSON.parse(raw) : [];
    logs.unshift({ ...entry, formattedText });
    if (logs.length > 50) logs.length = 50;
    localStorage.setItem('battle_ai_latest_logs', JSON.stringify(logs));
  } catch {}

  // 2. 尝试向 tools/test_combat_api.js 实时服务 (端口 3928) 发送
  fetch('http://127.0.0.1:3928/record-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    mode: 'cors',
  }).catch(() => {
    // 3. 若 3928 未启动，则尝试向 Vite 开发服务器中间件发送
    fetch('/api/record-ai-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logText: formattedText }),
    }).catch(() => {});
  });
}

if (typeof window !== 'undefined') {
  (window as any).__exportCombatAiLogs = () => {
    try {
      const raw = localStorage.getItem('battle_ai_latest_logs');
      if (!raw) return '暂无对战 AI 记录';
      const list = JSON.parse(raw);
      return list.map((item: any) => item.formattedText).join('\n\n');
    } catch {
      return '';
    }
  };
}

// Session safeguard: max 20 calls per battle to guarantee zero bill shock
let currentBattleBanterCalls = 0;

export function resetBattleBanterSession(): void {
  currentBattleBanterCalls = 0;
  console.log('[AI Banter] Battle banter session reset');
}

export interface CharacterPersona {
  title: string;
  personality: string;
  speechStyle: string;
  strategicPreference: string;
}

export const CHARACTER_PERSONAS: Record<string, CharacterPersona> = {
  '阿特朗': {
    title: '幽冥死灵导师',
    personality: '阴冷沉寂，视生命为过客，唯白骨与墓土永恒',
    speechStyle: '冰冷短促，伴随叹息与对死亡的赞美',
    strategicPreference: '偏好墓园苏生、死气侵蚀与生物持续消耗战',
  },
  '阿姆哈特': {
    title: '原初奥法狂尊',
    personality: '极度自负与傲慢的高阶巫师，视对手如学徒或蝼蚁',
    speechStyle: '辞藻华丽、居高临下、喜欢评价对手的微末技俩',
    strategicPreference: '偏好高爆发元素法术轰击、法术共鸣与强攻从者',
  },
  '巴特拉斯': {
    title: '苍穹圣殿骑士',
    personality: '庄严威武、恪守古老戒律的神圣卫士，不屑诡计与暗箭',
    speechStyle: '声音洪亮、正义凛然、宛如圣堂宣判',
    strategicPreference: '偏好神圣结界、庇护治疗与厚甲从者稳扎稳打',
  },
  '魁塔纳': {
    title: '天工机枢大师',
    personality: '完全理性与冰冷的机械师，毫无情感波动',
    speechStyle: '数据化、概率化，使用齿轮与机械运转的术语',
    strategicPreference: '偏好机械连携、齿轮增殖与算无遗漏的护甲阵地',
  },
  '迪莫夫': {
    title: '心灵深渊支配者',
    personality: '优雅残忍的心智大师，享受洞悉对手绝望思绪的快感',
    speechStyle: '低语戏谑、优雅从容、常常点破对手的心理软肋',
    strategicPreference: '偏好控制对手从者、剥夺能量与心智穿刺',
  },
  '杜斯坦': {
    title: '原初混沌狂徒',
    personality: '疯癫狂躁、喜怒无常，追求战局彻底陷入失控与连锁爆炸',
    speechStyle: '大笑、癫狂破碎，充满感叹号与不可预料的欢呼',
    strategicPreference: '偏好高风险随机法术、混沌过载与全场无差别毁灭',
  },
  '伊格波特': {
    title: '幻世星宫主宰',
    personality: '狡黠莫测的诡道幻术师，虚实相生，玩弄视觉与感知',
    speechStyle: '轻佻幽默、反讽戏耍，嘲弄对手打在空气上的愚钝',
    strategicPreference: '偏好镜像幻象、闪避转移与假动作消耗',
  },
  '埃尔加': {
    title: '深渊焦土恶魔学者',
    personality: '凶残嗜血的契约者，渴望以烈火与折磨吞噬生灵灵魂',
    speechStyle: '残忍嘶吼、散发硫磺与灰烬气息的恐吓',
    strategicPreference: '偏好恶魔突袭、痛苦献祭与毁灭之焰',
  },
  '弗沃尔': {
    title: '天灵蜂皇兽主',
    personality: '暴戾嗜战的蛮荒蜂群统治者，崇尚弱肉强食与集群突袭',
    speechStyle: '嗡鸣震颤、野性狂啸，充满对新鲜花粉与血肉的饥渴',
    strategicPreference: '偏好低费群蜂铺场、高速蜂刺与狂风暴击',
  },
  '富塔克': {
    title: '岁月时空编织者',
    personality: '苍老淡漠的永恒行者，洞察千万种时间分支的因果',
    speechStyle: '沧桑悠远、缓慢从容，将对手视作必将消逝的飞沙',
    strategicPreference: '偏好时钟倒流、额外出牌轮次与时间停滞',
  },
  '斯哈克': {
    title: '哥布林匪帮首领',
    personality: '卑鄙狡猾、贪婪多疑，仰仗数量与阴险暗器取胜',
    speechStyle: '尖酸刻薄、奸笑连连，叫嚣着围殴与抢夺财宝',
    strategicPreference: '偏好人多势众、自爆陷阱与不择手段的骚扰',
  },
  '欧拉夏': {
    title: '远古苍翠德鲁伊',
    personality: '古林巨木的守护者，沉着肃穆，与林中百兽共鸣',
    speechStyle: '自然威严、如林涛呼啸，带着草木生长的沉雄生机',
    strategicPreference: '偏好庞大林地巨兽、自然再生与丛林缠绕',
  },
  '古斯塔夫': {
    title: '巨神原核重构者',
    personality: '坚不可摧的古泰坦核心，沉默寡言，每一步令大地碎裂',
    speechStyle: '字字如万吨钢铁撞击，厚重无匹，没有丝毫废话',
    strategicPreference: '偏好超重甲泰坦魔像、无法摧毁的城墙与撼地重击',
  },
  '奥尔格德': {
    title: '终焉血祀大祭司',
    personality: '沉迷以己之血换取毁灭的狂信徒，越是伤痕累累越是狂怒',
    speechStyle: '狂热祈祷、嗜血咏唱，在痛苦中爆发刺耳狂笑',
    strategicPreference: '偏好自残换伤、残血狂暴与绝境同归于尽',
  },
  '弗拉德': {
    title: '猩红暗夜血皇',
    personality: '典雅傲岸的纯血贵族，视对手的鲜血为杯中甘酿',
    speechStyle: '贵族腔调、冷傲高贵，带着戏谑与嗜血的礼仪感',
    strategicPreference: '偏好生命偷取、血族撕咬与暗夜帷幕',
  },
  '大法师': {
    title: '元素秘境守望者',
    personality: '身经百战的传奇魔导长者，运筹帷幄，统御四大自然元素',
    speechStyle: '古老威严、胸有成竹，对魔导力量的运用返璞归真',
    strategicPreference: '水火风地四系平衡周转，见招拆招，控杀一体',
  },
};

// 提取魔导师人设档案（彻底与职业解耦：个性属于魔导师自身，法术为其所用流派）
export function getCharacterPersona(enemyName: string, enemyClassCn: string): CharacterPersona {
  if (enemyName && CHARACTER_PERSONAS[enemyName]) {
    return CHARACTER_PERSONAS[enemyName];
  }
  // 模糊匹配包含
  for (const [name, persona] of Object.entries(CHARACTER_PERSONAS)) {
    if (enemyName && enemyName.includes(name)) {
      return persona;
    }
  }

  // 基于对手名字哈希采样丰富的魔导大师人格，永不千人一面
  const personaKeys = Object.keys(CHARACTER_PERSONAS);
  if (enemyName && personaKeys.length > 0) {
    let hash = 0;
    for (let i = 0; i < enemyName.length; i++) {
      hash = (hash << 5) - hash + enemyName.charCodeAt(i);
      hash |= 0;
    }
    const sampled = CHARACTER_PERSONAS[personaKeys[Math.abs(hash) % personaKeys.length]];
    return {
      title: sampled.title,
      personality: sampled.personality,
      speechStyle: sampled.speechStyle,
      strategicPreference: `运用【${enemyClassCn}】的特色法则，${sampled.strategicPreference}`,
    };
  }

  // 兜底职业人设
  const classDefaultMap: Record<string, CharacterPersona> = {
    '死灵术士': {
      title: '亡灵收割者',
      personality: '阴鸷残忍，视死亡为生命的终极升华',
      speechStyle: '幽冷刺骨、低沉森然',
      strategicPreference: '偏好死者复苏与持续吸血',
    },
    '巫术法师': {
      title: '秘法毁灭者',
      personality: '醉心于奥术与元素毁灭性威力的求知狂人',
      speechStyle: '高傲自信、语调宏大',
      strategicPreference: '偏好法术轰击与爆发伤害',
    },
    '荒野驯兽': {
      title: '荒蛮群兽之王',
      personality: '崇尚尖牙与利爪的自然法则，痛恨文明造物',
      speechStyle: '野性咆哮、言语凶残',
      strategicPreference: '偏好野兽铺场与猛烈撕咬',
    },
    '机械工匠': {
      title: '钢铁发明家',
      personality: '以绝对理性和齿轮逻辑运转，厌恶不可控因素',
      speechStyle: '冰冷精算、毫无情感',
      strategicPreference: '偏好护甲机械与协同增殖',
    },
    '圣殿骑士': {
      title: '神圣守望先锋',
      personality: '恪守教条的光明执剑者，誓死驱逐异端',
      speechStyle: '庄重威严、铿锵有力',
      strategicPreference: '偏好圣光庇护与防守反击',
    },
  };

  return classDefaultMap[enemyClassCn] || {
    title: `${enemyClassCn}魔导师`,
    personality: '沉着老练，战术诡谲多变',
    speechStyle: '沉稳自信，洞悉战局',
    strategicPreference: '根据场面灵活应对，追求最高价值出牌',
  };
}

// 健壮的 JSON 解析器（从 Markdown、推理思维链或不规则文本中剥离提取有效决策）
export function parseAiDecisionJson<T = any>(rawText: string): T | null {
  if (!rawText) return null;

  // 1. 彻底剔除大模型可能输出的思维链标签 <think>...</think>，若 </think> 缺失则截断至 <think>
  let clean = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (clean.includes('<think>')) {
    clean = clean.replace(/<think>[\s\S]*$/gi, '').trim();
  }

  // 2. 优先匹配标准的 Markdown 代码块 ```json ... ``` 或 ``` ... ```
  const mdMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (mdMatch && mdMatch[1]) {
    try {
      return JSON.parse(mdMatch[1].trim()) as T;
    } catch {}
    clean = mdMatch[1].trim();
  }

  // 3. 从末尾向前寻找匹配的花括号（大模型常常在最后一段给出最终有效 JSON）
  const lastCloseIdx = clean.lastIndexOf('}');
  if (lastCloseIdx !== -1) {
    let depth = 0;
    let matchedOpenIdx = -1;
    for (let i = lastCloseIdx; i >= 0; i--) {
      if (clean[i] === '}') depth++;
      else if (clean[i] === '{') {
        depth--;
        if (depth === 0) {
          matchedOpenIdx = i;
          break;
        }
      }
    }
    if (matchedOpenIdx !== -1) {
      const candidate = clean.slice(matchedOpenIdx, lastCloseIdx + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch {
        try {
          const sanitized = candidate
            .replace(/,\s*([}\]])/g, '$1') // 移除末尾多余逗号
            .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // 补全缺失的 key 引号
            .replace(/:\s*'([^']*)'/g, ':"$1"'); // 单引号转双引号
          return JSON.parse(sanitized) as T;
        } catch {}
      }
    }
  }

  // 4. 正则终极容灾提取（支持中文冒号、无引号、单引号、非标格式）
  try {
    const actionMatch = clean.match(/(?:["']?action["']?)\s*[:：]\s*["']?([a-zA-Z_]+)["']?/i);
    const cardIdMatch = clean.match(/(?:["']?cardId["']?)\s*[:：]\s*["']?([a-zA-Z0-9_]+)["']?/i);
    const targetSlotMatch = clean.match(/(?:["']?targetSlot["']?)\s*[:：]\s*["']?(\d+|null)["']?/i);
    const thoughtMatch = clean.match(/(?:["']?thought["']?)\s*[:：]\s*["']?([^"'\n\r]+)["']?/i);
    const banterMatch = clean.match(/(?:["']?banter["']?)\s*[:：]\s*["']?([^"'\n\r]+)["']?/i);

    let action = actionMatch ? actionMatch[1].toLowerCase() : '';
    const cardId = cardIdMatch && cardIdMatch[1] !== 'null' ? cardIdMatch[1] : undefined;

    if (!action) {
      if (/pass|跳过/i.test(clean)) {
        action = 'pass';
      } else if (cardId) {
        action = 'play_card';
      }
    }

    if (action === 'play_card' || action === 'pass') {
      return {
        action: action as any,
        cardId: action === 'play_card' ? cardId : undefined,
        targetSlot: targetSlotMatch && targetSlotMatch[1] !== 'null' ? parseInt(targetSlotMatch[1], 10) : undefined,
        thought: thoughtMatch ? thoughtMatch[1].trim() : '',
        banter: banterMatch ? banterMatch[1].trim() : '',
      } as any;
    }
  } catch {}

  return null;
}

// ==============================================================================
// 🎯 核心下棋战略决策接口 (AI Combat Action Decision)
// ==============================================================================

export interface AiCombatDecisionRequest {
  enemyName: string;
  enemyClassCn: string;
  difficulty?: string;
  enemyHp: number;
  playerHp: number;
  enemyMana: Record<string, number>;
  playerMana: Record<string, number>;
  enemyBoard: Array<{ slot: number; name: string; attack: number; life: number; desc?: string } | null>;
  playerBoard: Array<{ slot: number; name: string; attack: number; life: number; desc?: string } | null>;
  playableCards: Array<{
    id: string;
    name: string;
    cost: number;
    element: string;
    type: 'creature' | 'spell';
    attack?: number;
    life?: number;
    desc: string;
    validSlots: number[];
  }>;
}

export interface AiCombatDecisionResponse {
  thought: string;
  action: 'play_card' | 'pass';
  cardId?: string;
  targetSlot?: number;
  banter: string;
}

export async function decideAiTurnAction(
  request: AiCombatDecisionRequest
): Promise<AiCombatDecisionResponse | null> {
  const config = getAiConfig();
  if (!config.enabled || !config.baseUrl) {
    return null;
  }

  // Cap at 20 calls per match
  if (currentBattleBanterCalls >= 20) {
    return null;
  }
  currentBattleBanterCalls++;

  const controller = new AbortController();
  // 允许大模型 8.5 秒时间进行深思与下棋推演
  const timer = setTimeout(() => controller.abort(), 8500);
  const startTime = Date.now();

  const persona = getCharacterPersona(request.enemyName, request.enemyClassCn);

  // 难度阶梯动态指引
  const difficultyRules: Record<string, string> = {
    '容易': '【难度要求：新手对练】\n你的战术风格应宽容温和、富有娱乐性。多打出有趣的卡牌展示效果，不要进行严苛的斩杀算计或针对性封锁，偶尔留出空档给玩家翻盘与体验卡组魅力的机会。',
    '普通': '【难度要求：常规试炼】\n稳扎稳打，兼顾攻守平衡。合理分配各系能量，依据主流从者与法术进行常规联动配合。',
    '困难': '【难度要求：宗师博弈】\n高阶竞技思维。严密计算双方下一回合的斩杀线（Lethal）、精确控制能量积蓄（适时憋高费杀招）、优先解场与反制核心随从、针对性卡位，给玩家强烈的对局压迫感。',
    '大师': '【难度要求：神级魔导（巅峰死斗 · 最高难度）】\n顶尖职业电竞级神级算力，追求全局理论最优解（Alpha-Beta 极值博弈思维）！精确卡死玩家节奏与能量空窗期、预判玩家下轮动作并提前布控防线、算尽血量差与场面滚雪球收益，步步为营、招招致命，不给玩家留下任何翻盘破绽！',
  };
  const diffInstruction = difficultyRules[request.difficulty || '普通'] || difficultyRules['普通'];

  const systemPrompt = `你是对战卡牌游戏《元素秘境》中具备顶级牌技与深沉城府的电脑魔导师【${request.enemyName}】。
【你的人设身份】${persona.title}
【你的性格特征】${persona.personality}
【你的台词风格】${persona.speechStyle}
【你的战斗战术】${persona.strategicPreference}
【当前支配流派】${request.enemyClassCn}

${diffInstruction}

【极速决策原则】：
请根据当前牌桌双方血量、5系能量、6个槽位攻防站位与可用手牌，评估对手威胁与己方最优解。推演过程请极度精炼（30字以内得出结论），果断做出这一轮的【出牌或跳过下棋决策】，并即兴说出一句极具你人设魅力的战斗对白！

【规则要求】：
1. 必须输出严格合法的 JSON 对象，不要输出任何多余解说文字。
2. JSON 结构规范如下：
{
  "thought": "用简明扼要的一句话阐述局势分析与下棋理由（30字以内）",
  "action": "play_card", // 选 "play_card" 出牌，或选 "pass" 跳过本回合出牌以积攒能量
  "cardId": "选定要打出的卡牌ID，若pass则填 null",
  "targetSlot": 0, // 0 到 5 的槽位编号，若卡牌无需指定槽位或pass则填 null
  "banter": "一句符合你人设的生动战意台词/心理战挑衅（10~25字，不要引号）"
}`;

  const enemyBoardDesc = request.enemyBoard.map((c, i) => c ? `[槽位${i}]: ${c.name}(攻${c.attack}/血${c.life})` : `[槽位${i}]: 空`).join(' | ');
  const playerBoardDesc = request.playerBoard.map((c, i) => c ? `[槽位${i}]: ${c.name}(攻${c.attack}/血${c.life})` : `[槽位${i}]: 空`).join(' | ');
  const cardsDesc = request.playableCards.map((c, i) => 
    `${i + 1}. [${c.name}] (ID: ${c.id}, 消耗: ${c.cost} ${c.element}系, 类型: ${c.type === 'creature' ? `从者·攻${c.attack}/血${c.life}` : '法术'}, 效果: ${c.desc}, 可选槽位: [${c.validSlots.join(',')}])`
  ).join('\n');

  const userPrompt = `【当前对决战局快照】
- 当前对局难度: ${request.difficulty || '普通'}
- 己方魔导师: ${request.enemyName}，当前生命值: ${request.enemyHp}，当前能量储备: ${JSON.stringify(request.enemyMana)}
- 玩家对手: 当前生命值: ${request.playerHp}，当前能量储备: ${JSON.stringify(request.playerMana)}
- 己方场上从者(6个槽位): ${enemyBoardDesc}
- 玩家场上从者(6个槽位): ${playerBoardDesc}
- 己方当前手牌中所有合法可打出的卡牌选项:
${cardsDesc || '(当前手牌无可用卡牌)'}

请你代入【${request.enemyName}】的心态与人设，返回下棋决策与战斗台词 JSON：`;

  try {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }

    console.log(`[AI Strategy #${currentBattleBanterCalls}] Requesting move decision from ${config.provider} (${config.model})...`);
    const reqBody: any = {
      model: config.model.trim() || 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.3, // 0.3 快速聚焦收敛，消除漫无目的的长篇思考
    };

    // DeepSeek / OpenAI / SiliconFlow / Ollama JSON 格式约束支持
    if (!config.model.includes('vision')) {
      reqBody.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[AI Strategy] API error HTTP', res.status, errText);
      recordCombatAiTelemetry({
        enemyName: request.enemyName,
        enemyClass: request.enemyClassCn,
        enemyHp: request.enemyHp,
        playerHp: request.playerHp,
        actionDesc: '下棋决策请求',
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        status: `HTTP ${res.status} Error`,
        latencyMs,
        systemPrompt,
        userPrompt,
        error: errText.slice(0, 200) || res.statusText,
      });
      return null;
    }

    const data = await res.json().catch(() => null);
    const rawContent = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning_content || '';
    if (!rawContent) {
      console.warn('[AI Strategy] Empty response:', data);
      recordCombatAiTelemetry({
        enemyName: request.enemyName,
        enemyClass: request.enemyClassCn,
        enemyHp: request.enemyHp,
        playerHp: request.playerHp,
        actionDesc: '下棋决策请求',
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        status: `HTTP ${res.status} (Empty Response)`,
        latencyMs,
        systemPrompt,
        userPrompt,
        error: 'Model returned empty content and reasoning',
      });
      return null;
    }

    const parsed = parseAiDecisionJson<any>(rawContent);
    if (!parsed) {
      console.warn('[AI Strategy] Failed to parse JSON from:', rawContent);
      recordCombatAiTelemetry({
        enemyName: request.enemyName,
        enemyClass: request.enemyClassCn,
        enemyHp: request.enemyHp,
        playerHp: request.playerHp,
        actionDesc: '下棋决策请求',
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        status: `HTTP 200 (JSON Parse Fail)`,
        latencyMs,
        systemPrompt,
        userPrompt,
        responseContent: rawContent.slice(0, 300),
        error: 'Failed to extract JSON decision',
      });
      return null;
    }

    let banter = (parsed.banter || '').replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
    if (banter.length > 40) banter = banter.slice(0, 38) + '…';

    const actionSummary = parsed.action === 'pass' 
      ? '选择跳过出牌以蓄力能量' 
      : `打出卡牌 [${parsed.cardId}] 于槽位 ${parsed.targetSlot ?? '默认'}`;

    console.log(`[AI Strategy #${currentBattleBanterCalls}] Action: ${actionSummary} | Banter: "${banter}" (${latencyMs}ms)`);

    recordCombatAiTelemetry({
      enemyName: request.enemyName,
      enemyClass: request.enemyClassCn,
      enemyHp: request.enemyHp,
      playerHp: request.playerHp,
      actionDesc: `${actionSummary} (推演: ${parsed.thought || '无'})`,
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      status: `200 OK (下棋指令生效)`,
      latencyMs,
      systemPrompt,
      userPrompt,
      responseContent: `【决策指令】${JSON.stringify({ action: parsed.action, cardId: parsed.cardId, targetSlot: parsed.targetSlot })}\n【思考推演】${parsed.thought || ''}\n【战斗台词】"${banter}"`,
      usage: data.usage || null,
    });

    return {
      thought: parsed.thought || '',
      action: parsed.action || 'play_card',
      cardId: parsed.cardId,
      targetSlot: parsed.targetSlot,
      banter,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;
    console.warn('[AI Strategy] Timed out or failed:', err?.message);
    recordCombatAiTelemetry({
      enemyName: request.enemyName,
      enemyClass: request.enemyClassCn,
      enemyHp: request.enemyHp,
      playerHp: request.playerHp,
      actionDesc: '下棋决策请求',
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      status: err.name === 'AbortError' ? 'TIMEOUT (8.5s)' : 'NETWORK_ERROR',
      latencyMs,
      systemPrompt,
      userPrompt,
      error: err?.message || 'Unknown network error',
    });
    return null;
  }
}

export async function generateEnemyBanter(
  enemyName: string,
  enemyClassCn: string,
  enemyHp: number,
  playerHp: number,
  actionDesc: string,
  mode?: string
): Promise<string | null> {
  if (!isAiEnabledForBattle(mode)) {
    console.log('[AI Banter] Skipped: AI mode is disabled for mode:', mode);
    return null;
  }
  const config = getAiConfig();
  if (!config.baseUrl) {
    console.log('[AI Banter] Skipped: baseUrl is missing');
    return null;
  }

  // Safeguard: cap at 20 calls per match
  if (currentBattleBanterCalls >= 20) {
    console.log('[AI Banter] Session call limit reached (20 calls)');
    return null;
  }
  currentBattleBanterCalls++;

  const controller = new AbortController();
  // Allow up to 7.5s for LLM generation
  const timer = setTimeout(() => controller.abort(), 7500);
  const startTime = Date.now();

  const persona = getCharacterPersona(enemyName, enemyClassCn);

  const systemPrompt = `你是对战卡牌游戏《元素秘境》里的电脑魔导师【${enemyName}】。
【你的人设身份】${persona.title}
【你的性格特征】${persona.personality}
【你的说话风格】${persona.speechStyle}

请根据当前战况即兴说一句短小精炼、符合你人设魅力的魔导战斗对白（嘲讽、施法台词、挑衅或战意宣言）。
规则：字数控制在 10 到 25 个汉字以内，不要问候语、不要解释、不要引号，直接输出台词本身。`;

  const userPrompt = `己方血量: ${enemyHp}，对手血量: ${playerHp}。己方行动: ${actionDesc}。`;

  try {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }

    console.log(`[AI Banter #${currentBattleBanterCalls}] Requesting banter from ${config.provider} (${config.model})...`);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model.trim() || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048, // 放开至 2048 Token，保障思考模型正常输出
        temperature: 0.85,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[AI Banter] API error HTTP', res.status, errText);
      recordCombatAiTelemetry({
        enemyName,
        enemyClass: enemyClassCn,
        enemyHp,
        playerHp,
        actionDesc,
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        status: `HTTP ${res.status} Error`,
        latencyMs,
        systemPrompt,
        userPrompt,
        error: errText.slice(0, 200) || res.statusText,
      });
      return null;
    }

    const data = await res.json().catch(() => null);
    // 兼容推理模型（DeepSeek-R1 / flash）：若 content 为空，回退提取 reasoning_content 的结论
    let content = (data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning_content || '').trim();
    if (!content) {
      console.warn('[AI Banter] Empty response data:', data);
      recordCombatAiTelemetry({
        enemyName,
        enemyClass: enemyClassCn,
        enemyHp,
        playerHp,
        actionDesc,
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        status: `HTTP ${res.status} (Empty Content)`,
        latencyMs,
        systemPrompt,
        userPrompt,
        error: 'Model output was empty',
      });
      return null;
    }

    content = content.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
    if (content.length > 40) content = content.slice(0, 38) + '…';
    console.log(`[AI Banter #${currentBattleBanterCalls}] Success: "${content}"`);

    recordCombatAiTelemetry({
      enemyName,
      enemyClass: enemyClassCn,
      enemyHp,
      playerHp,
      actionDesc,
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      status: `200 OK`,
      latencyMs,
      systemPrompt,
      userPrompt,
      responseContent: content,
      usage: data.usage || null,
    });

    return content;
  } catch (err: any) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;
    console.warn('[AI Banter] Request timed out or failed:', err?.message);
    recordCombatAiTelemetry({
      enemyName,
      enemyClass: enemyClassCn,
      enemyHp,
      playerHp,
      actionDesc,
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      status: err.name === 'AbortError' ? 'TIMEOUT (7.5s)' : 'NETWORK_ERROR',
      latencyMs,
      systemPrompt,
      userPrompt,
      error: err?.message || 'Unknown network error',
    });
    return null;
  }
}

// ==============================================================================
// 🗺️ AI 战场场景创世生成器 (AI Scenario Generator)
// ==============================================================================

export interface AiGeneratedScenarioData {
  id: string;
  name: string;
  icon: string;
  theme: string;
  playerHp: number;
  enemyHp: number;
  rule: string;
  extraPlayerMana?: Record<string, number>;
  extraEnemyMana?: Record<string, number>;
  initialPlayerCreatures?: Array<{ slot: number; cardId: string }>;
  initialEnemyCreatures?: Array<{ slot: number; cardId: string }>;
}

const VALID_BATTLEFIELD_THEMES = ['citadel', 'sky', 'volcano', 'forest', 'abyss', 'tundra', 'desert', 'shrine'];

export function parseAiScenarioJson(rawText: string, fallbackPrompt?: string): any {
  if (!rawText) return null;

  // 1. Strip completed think blocks
  let clean = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (clean.includes('</think>')) {
    clean = clean.split('</think>').pop()!.trim();
  }
  if (clean.includes('<think>')) {
    clean = clean.replace(/<think>[\s\S]*$/gi, '').trim();
  }

  // 2. Try markdown code block
  const mdMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (mdMatch && mdMatch[1]) {
    try {
      const res = JSON.parse(mdMatch[1].trim());
      if (res && typeof res === 'object') return res;
    } catch {}
    clean = mdMatch[1].trim();
  }

  // 3. Try outermost { ... }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = clean.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        const sanitized = candidate
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
          .replace(/:\s*'([^']*)'/g, ':"$1"');
        return JSON.parse(sanitized);
      } catch {}
    }
  }

  // 4. Regex extraction fallback
  const nameMatch = clean.match(/(?:["']?name["']?)\s*[:：]\s*["']([^"'\n\r]+)["']/i) ||
                    rawText.match(/(?:["']?name["']?)\s*[:：]\s*["']([^"'\n\r]+)["']/i);
  const themeMatch = clean.match(/(?:["']?theme["']?)\s*[:：]\s*["']?([a-zA-Z]+)["']?/i) ||
                     rawText.match(/(?:["']?theme["']?)\s*[:：]\s*["']?([a-zA-Z]+)["']?/i);
  const iconMatch = clean.match(/(?:["']?icon["']?)\s*[:：]\s*["']?([^"',\s}\n\r]+)["']?/i);
  const ruleMatch = clean.match(/(?:["']?rule["']?)\s*[:：]\s*["']([^"'\n\r]+)["']/i) ||
                    rawText.match(/(?:["']?rule["']?)\s*[:：]\s*["']([^"'\n\r]+)["']/i);
  const playerHpMatch = clean.match(/(?:["']?playerHp["']?)\s*[:：]\s*(\d+)/i);
  const enemyHpMatch = clean.match(/(?:["']?enemyHp["']?)\s*[:：]\s*(\d+)/i);

  let extractedName = nameMatch ? nameMatch[1].trim() : '';
  let extractedTheme = themeMatch ? themeMatch[1].toLowerCase() : '';
  let extractedIcon = iconMatch ? iconMatch[1].trim() : '';
  let extractedRule = ruleMatch ? ruleMatch[1].trim() : '';

  // 5. Ultimate natural language fallback
  if (!extractedName) {
    const titleMatch = rawText.match(/【([^】]+)】/) || rawText.match(/“([^”]+)”/) || rawText.match(/《([^》]+)》/);
    if (titleMatch) {
      extractedName = titleMatch[1].trim();
    } else if (fallbackPrompt) {
      extractedName = `✨ ${fallbackPrompt.slice(0, 10).trim()}`;
    } else {
      extractedName = '✨ 秘境对决';
    }
  }

  if (!extractedTheme) {
    const fullText = (rawText + ' ' + (fallbackPrompt || '')).toLowerCase();
    if (/雪|冰|寒|霜|冬|极地|tundra/.test(fullText)) extractedTheme = 'tundra';
    else if (/火|熔岩|炎|地心|灼|烈|volcano/.test(fullText)) extractedTheme = 'volcano';
    else if (/雷|电|风|天空|苍穹|云|sky/.test(fullText)) extractedTheme = 'sky';
    else if (/林|树|森|自然|木|藤|forest/.test(fullText)) extractedTheme = 'forest';
    else if (/暗|深渊|冥|死|虚空|黑|abyss/.test(fullText)) extractedTheme = 'abyss';
    else if (/沙|荒漠|漠|尘|遗迹|desert/.test(fullText)) extractedTheme = 'desert';
    else if (/神庙|圣殿|殿|光|圣|誓|shrine/.test(fullText)) extractedTheme = 'shrine';
    else extractedTheme = 'citadel';
  }

  if (!extractedIcon) {
    const themeIcons: Record<string, string> = {
      citadel: '🏛️', sky: '⚡', volcano: '🌋', forest: '🌲',
      abyss: '💀', tundra: '❄️', desert: '🏜️', shrine: '🔮'
    };
    extractedIcon = themeIcons[extractedTheme] || '✨';
  }

  if (!extractedRule) {
    const sentences = clean.split(/[。\n!！]/).map(s => s.trim()).filter(s => s.length > 5 && !s.includes('{') && !s.includes('}'));
    extractedRule = sentences[0] || (fallbackPrompt ? `受【${fallbackPrompt}】法则影响，双方在此展开激烈元素对决。` : '自创场景法则：双方进行魔导对决。');
  }

  return {
    name: extractedName,
    icon: extractedIcon,
    theme: extractedTheme,
    playerHp: playerHpMatch ? parseInt(playerHpMatch[1], 10) : 60,
    enemyHp: enemyHpMatch ? parseInt(enemyHpMatch[1], 10) : 60,
    rule: extractedRule
  };
}

export async function generateAiBattlefieldScenario(
  userPromptText: string
): Promise<AiGeneratedScenarioData | null> {
  const config = getAiConfig();
  if (!config.enabled || !config.baseUrl) {
    throw new Error('请先在「系统设置 - 大模型配置」中开启并配置 AI 接口');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000); // 30s 宽裕容灾

  const systemPrompt = `你是对战卡牌游戏《元素秘境》的战场创世神（Battlefield Scenario Architect）。
根据玩家提供的构想描述，构筑一个符合游戏世界观的特殊对战场景数据。

【极速与格式要求】：
1. 请保持思考极短（或直接输出），直接返回合法的 JSON 对象，不要输出任何多余解说文字。
2. JSON 结构规范：
{
  "name": "战场中文名称（如：❄️ 霜雪王座、🌋 远古地心锻炉、⚡ 狂雷禁地，附带合适Emoji）",
  "icon": "单个契合的Emoji表情（如 ❄️, 🌋, ⚡, 🌲, 🔮, 💀, 🏛️, 🏜️）",
  "theme": "必须是以下英文键之一：citadel, sky, volcano, forest, abyss, tundra, desert, shrine",
  "playerHp": 50到80之间的整数（默认60）,
  "enemyHp": 50到80之间的整数（默认60）,
  "rule": "一段生动的场景法则描述（50字以内），阐明对局环境、开局增益或特殊机制",
  "extraPlayerMana": { "fire": 0, "water": 0, "air": 0, "earth": 0, "special": 0 }, // 某系初始能量额外+1~3（可选）
  "extraEnemyMana": { "fire": 0, "water": 0, "air": 0, "earth": 0, "special": 0 }, // 某系初始能量额外+1~3（可选）
  "initialPlayerCreatures": [ { "slot": 2, "cardId": "water_ice_guard" } ], // 开局预置守卫生物（槽位0~5，可选，例如 earth_giant_spider, water_ice_guard, fire_goblin_berserker, air_griffin 等）
  "initialEnemyCreatures": [ { "slot": 2, "cardId": "water_ice_guard" } ] // 开局预置守卫生物（槽位0~5，可选）
}`;

  const userPrompt = `玩家构想场景描述：${userPromptText.trim() || '一个神秘的古代元素圣殿，四周充满自然魔力'}`;

  try {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }

    const reqBody: any = {
      model: config.model.trim() || 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 3072,
      temperature: 0.7,
    };
    // DeepSeek Reasoner, R1, and vision models do not support response_format: json_object
    const isReasonerOrVision = /reason|r1|vision/i.test(config.model);
    if (!isReasonerOrVision) {
      reqBody.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`API 响应错误 HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    const data = await res.json().catch(() => null);
    const rawContent = data?.choices?.[0]?.message?.content || 
                       data?.choices?.[0]?.message?.reasoning_content || 
                       data?.choices?.[0]?.text || '';
    if (!rawContent) {
      throw new Error('模型返回内容为空');
    }

    const parsed = parseAiScenarioJson(rawContent, userPromptText);
    if (!parsed || !parsed.name) {
      throw new Error('未能从模型返回中提取有效场景数据');
    }

    let theme = String(parsed.theme || 'citadel').toLowerCase();
    if (!VALID_BATTLEFIELD_THEMES.includes(theme)) {
      theme = 'citadel';
    }

    const playerHp = Math.max(30, Math.min(100, Number(parsed.playerHp) || 60));
    const enemyHp = Math.max(30, Math.min(100, Number(parsed.enemyHp) || 60));

    return {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: parsed.name || '✨ 自定义秘境',
      icon: parsed.icon || '✨',
      theme,
      playerHp,
      enemyHp,
      rule: parsed.rule || '自创场景法则：双方进行魔导对决。',
      extraPlayerMana: parsed.extraPlayerMana || undefined,
      extraEnemyMana: parsed.extraEnemyMana || undefined,
      initialPlayerCreatures: Array.isArray(parsed.initialPlayerCreatures) ? parsed.initialPlayerCreatures : undefined,
      initialEnemyCreatures: Array.isArray(parsed.initialEnemyCreatures) ? parsed.initialEnemyCreatures : undefined,
    };
  } catch (err: any) {
    clearTimeout(timer);
    console.warn('[AI Scenario] Creation failed:', err?.message);
    throw err;
  }
}


