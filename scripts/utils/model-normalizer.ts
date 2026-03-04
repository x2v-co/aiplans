/**
 * Model Name Normalizer
 * 标准化的目标：
 * 1. 基础模型名称一致（如 "gpt-4o" 就是 "gpt-4o"）
 * 2. 版本号单独记录（如 "gpt-4o-mini"）
 * 3. 代号/变体统一（如 "flash", "turbo"）
 * 4. 厂商正确识别
 */

// 基础模型名称映射表 - 将各种变体统一为标准名称
const MODEL_ALIASES: Record<string, string> = {
  // GPT 系列
  'gpt-4': 'gpt-4',
  'gpt-4-turbo': 'gpt-4-turbo',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-3.5-turbo': 'gpt-3.5-turbo',

  // Claude 系列
  'claude-opus-4.6': 'claude-opus-4.6',
  'claude-sonnet-4.6': 'claude-sonnet-4.6',
  'claude-3-opus': 'claude-3-opus',
  'claude-3-sonnet': 'claude-3-sonnet',
  'claude-3.5-sonnet': 'claude-3.5-sonnet',
  'claude-3-5-sonnet': 'claude-3.5-sonnet',  // hyphen variant
  'claude-3.5-haiku': 'claude-3.5-haiku',
  'claude-3-5-haiku': 'claude-3.5-haiku',  // hyphen variant
  'claude-3-haiku': 'claude-3-haiku',
  'claude-haiku-4-5': 'claude-haiku-4-5',

  // Gemini 系列
  'gemini-1.5-pro': 'gemini-1.5-pro',
  'gemini-1-5-pro': 'gemini-1.5-pro',  // hyphen variant
  'gemini-1.5-flash': 'gemini-1.5-flash',
  'gemini-1-5-flash': 'gemini-1.5-flash',  // hyphen variant
  'gemini-1.0-pro': 'gemini-1.0-pro',
  'gemini-2.0-flash-exp': 'gemini-2.0-flash-exp',
  'gemini-2-0-flash-exp': 'gemini-2.0-flash-exp',  // hyphen variant

  // Llama 系列
  'llama-3.1-405b': 'llama-3.1-405b',
  'llama-3-1-405b': 'llama-3.1-405b',  // hyphen variant
  'llama-3.1-70b': 'llama-3.1-70b',
  'llama-3-1-70b': 'llama-3.1-70b',  // hyphen variant
  'llama-3.1-8b': 'llama-3.1-8b',
  'llama-3-1-8b': 'llama-3.1-8b',  // hyphen variant
  'llama-3.3-70b': 'llama-3.3-70b',
  'llama-3-3-70b': 'llama-3.3-70b',  // hyphen variant

  // Qwen 系列
  'qwen-max': 'qwen-max',
  'qwen-plus': 'qwen-plus',
  'qwen-turbo': 'qwen-turbo',
  'qwen-2.5-72b': 'qwen-2.5-72b',
  'qwen-2-5-72b': 'qwen-2.5-72b',  // hyphen variant
  'qwen-2.5-32b': 'qwen-2.5-32b',
  'qwen-2-5-32b': 'qwen-2.5-32b',  // hyphen variant
  'qwen-2.5-14b': 'qwen-2.5-14b',
  'qwen-2-5-14b': 'qwen-2.5-14b',  // hyphen variant
  'qwen-2.5-7b': 'qwen-2.5-7b',
  'qwen-2-5-7b': 'qwen-2.5-7b',  // hyphen variant
  'qwen-long': 'qwen-long',

  // GLM 系列
  'glm-4': 'glm-4',
  'glm-3-turbo': 'glm-3-turbo',
  'glm-4-flash': 'glm-4-flash',
  'glm-4-air': 'glm-4-air',

  // Moonshot 系列
  'moonshot-v1-8k': 'moonshot-v1-8k',
  'moonshot-v1-32k': 'moonshot-v1-32k',
  'moonshot-v1-128k': 'moonshot-v1-128k',

  // DeepSeek 系列
  'deepseek-v3': 'deepseek-v3',
  'deepseek-chat': 'deepseek-chat',
  'deepseek-coder-v2': 'deepseek-coder-v2',

  // Mistral 系列
  'mistral-large-latest': 'mistral-large',
  'mistral-large-2': 'mistral-large-2',
  'mistral-nemo': 'mistral-nemo',
  'mistral-small-latest': 'mistral-small',
  'mixtral-8x7b': 'mixtral-8x7b',
  'mixtral-8x22b': 'mixtral-8x22b',

  // Hunyuan 系列
  'hunyuan-pro': 'hunyuan-pro',
  'hunyuan-standard': 'hunyuan-standard',
  'hunyuan-lite': 'hunyuan-lite',

  // ERNIE 系列
  'ernie-4.0': 'ernie-4.0',
  'ernie-3.5': 'ernie-3.5',
  'ernie-speed': 'ernie-speed',
  'ernie-lite': 'ernie-lite',

  // Doubao 系列
  'doubao-pro-32k': 'doubao-pro-32k',
  'doubao-pro-4k': 'doubao-pro-4k',

  // StepFun 系列
  'step-1-8k': 'step-1-8k',
  'step-1-32k': 'step-1-32k',
  'step-1v': 'step-1v',
  'step-2-16k': 'step-2-16k',

  // MiniMax 系列
  'minimax-text-01': 'minimax-text-01',
  'minimax-text-01-pro': 'minimax-text-01-pro',

  // Seed 系列
  'seed-llm': 'seed-llm',
  'seed-llm-turbo': 'seed-llm-turbo',

  // Grok 系列
  'grok-2': 'grok-2',
  'grok-beta': 'grok-beta',
  'grok-vision-beta': 'grok-vision-beta',

  // O 系列
  'o1-preview': 'o1-preview',
  'o1-mini': 'o1-mini',
  'o3-mini': 'o3-mini',

  // Yi 系列
  'yi-1.5-34b-chat': 'yi-1.5-34b-chat',
  'yi-1.5-9b-chat': 'yi-1.5-9b-chat',
};

// 提取基础模型名称的正则表达式
function extractBaseModel(name: string): string {
  const lower = name.toLowerCase().replace(/\s+/g, '-');

  // 去掉常见的版本后缀 (按顺序处理，避免冲突)
  let withoutVersion = lower
    .replace(/-(\d{8}|v\d+(\.\d+)?(-\d+k)?|latest|exp|beta|preview|mini)$/g, '')
    .replace(/-(\d{4})$/g, '') // 去掉年份后缀如 2024
    .replace(/-(\d+k)$/g, '')  // 去掉上下文大小如 8k, 32k (但保留 2.5 这种版本号)
    .replace(/-chat$/g, '')    // 去掉 chat 后缀
    .replace(/-instruct$/g, '') // 去掉 instruct 后缀
    .replace(/^qwen\/qwen-?/g, 'qwen-') // qwen/Qwen2.5-72B -> qwen-2.5-72b
    .replace(/^thudm\/glm/g, 'glm')
    .replace(/^deepseek-ai\//g, '')
    .replace(/^mistralai\//g, '')
    .replace(/^meta-llama\//g, '')
    .replace(/^anthropic\./g, '')
    .replace(/^amazon\./g, '')
    .replace(/^fireworks-/g, '')
    .replace(/^codestral-/g, '')
    .replace(/^pixtral-/g, '')
    .replace(/^open-mistral-/g, '')
    .replace(/^ministral-/g, '')
    .replace(/^01-ai\/yi-/g, 'yi-');

  return withoutVersion;
}

// 标准化模型名称
export function normalizeModelName(name: string): string {
  let lower = name.toLowerCase().replace(/\s+/g, '-');

  // 统一版本号格式：将 3-5 转换为 3.5, 2-5 转换为 2.5 等
  // 匹配类似 claude-3-5-sonnet, gpt-4-0-mini, gemini-1-5-pro 等模式
  // 正则解释：在两个数字之间的连字符（后跟另一个连字符或版本结束）替换为点
  lower = lower.replace(/-(\d)-(\d)(?=-|_|\/|$)/g, '-$1.$2');

  // 尝试直接匹配
  if (MODEL_ALIASES[lower]) {
    return MODEL_ALIASES[lower];
  }

  // 提取基础模型并匹配
  const base = extractBaseModel(name);

  // 常见模式匹配
  if (lower.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (lower.includes('gpt-4o') && !lower.includes('mini')) return 'gpt-4o';
  if (lower.includes('gpt-4-turbo')) return 'gpt-4-turbo';
  if (lower.includes('gpt-4') && !lower.includes('turbo') && !lower.includes('o') && !lower.includes('mini')) return 'gpt-4';
  if (lower.includes('gpt-35-turbo') || lower.includes('gpt-3.5-turbo')) return 'gpt-3.5-turbo';

  if (lower.includes('claude-opus-4')) return 'claude-opus-4.6';
  if (lower.includes('claude-sonnet-4')) return 'claude-sonnet-4.6';
  if (lower.includes('claude-3.5-sonnet') || lower.includes('claude-3-5-sonnet')) return 'claude-3.5-sonnet';
  if (lower.includes('claude-3.5-haiku') || lower.includes('claude-3-5-haiku')) return 'claude-3.5-haiku';
  if (lower.includes('claude-3-opus')) return 'claude-3-opus';
  if (lower.includes('claude-3-sonnet')) return 'claude-3-sonnet';
  if (lower.includes('claude-3-haiku')) return 'claude-3-haiku';
  if (lower.includes('claude-haiku-4')) return 'claude-haiku-4-5';

  if (lower.includes('gemini-2.0-flash') || lower.includes('gemini-2-0-flash')) return 'gemini-2.0-flash-exp';
  if (lower.includes('gemini-1.5-pro') || lower.includes('gemini-1-5-pro')) return 'gemini-1.5-pro';
  if (lower.includes('gemini-1.5-flash-8b')) return 'gemini-1.5-flash-8b';
  if (lower.includes('gemini-1.5-flash') || lower.includes('gemini-1-5-flash')) return 'gemini-1.5-flash';
  if (lower.includes('gemini-1.0-pro')) return 'gemini-1.0-pro';

  if (lower.includes('llama-3.3-70b') || lower.includes('llama-3-3-70b')) return 'llama-3.3-70b';
  if (lower.includes('llama-3.1-405b') || lower.includes('llama-3-1-405b')) return 'llama-3.1-405b';
  if (lower.includes('llama-3.1-70b') || lower.includes('llama-3-1-70b')) return 'llama-3.1-70b';
  if (lower.includes('llama-3.1-8b') || lower.includes('llama-3-1-8b')) return 'llama-3.1-8b';

  if (lower.includes('qwen-max')) return 'qwen-max';
  if (lower.includes('qwen-plus')) return 'qwen-plus';
  if (lower.includes('qwen-turbo')) return 'qwen-turbo';
  if (lower.includes('qwen-long')) return 'qwen-long';
  if (lower.includes('qwen-2.5-72b') || lower.includes('qwen-2-5-72b')) return 'qwen-2.5-72b';
  if (lower.includes('qwen-2.5-32b') || lower.includes('qwen-2-5-32b')) return 'qwen-2.5-32b';
  if (lower.includes('qwen-2.5-14b') || lower.includes('qwen-2-5-14b')) return 'qwen-2.5-14b';
  if (lower.includes('qwen-2.5-7b') || lower.includes('qwen-2-5-7b')) return 'qwen-2.5-7b';

  if (lower.includes('glm-4-flash')) return 'glm-4-flash';
  if (lower.includes('glm-4-air')) return 'glm-4-air';
  if (lower.includes('glm-4') && !lower.includes('flash') && !lower.includes('air')) return 'glm-4';
  if (lower.includes('glm-3-turbo')) return 'glm-3-turbo';

  if (lower.includes('moonshot-v1-128k')) return 'moonshot-v1-128k';
  if (lower.includes('moonshot-v1-32k')) return 'moonshot-v1-32k';
  if (lower.includes('moonshot-v1-8k')) return 'moonshot-v1-8k';

  if (lower.includes('deepseek-v3')) return 'deepseek-v3';
  if (lower.includes('deepseek-coder-v2')) return 'deepseek-coder-v2';
  if (lower.includes('deepseek-chat')) return 'deepseek-chat';

  if (lower.includes('mistral-large-2')) return 'mistral-large-2';
  if (lower.includes('mistral-large')) return 'mistral-large';
  if (lower.includes('mistral-nemo')) return 'mistral-nemo';
  if (lower.includes('mistral-small')) return 'mistral-small';
  if (lower.includes('mixtral-8x22b')) return 'mixtral-8x22b';
  if (lower.includes('mixtral-8x7b')) return 'mixtral-8x7b';

  if (lower.includes('hunyuan-pro')) return 'hunyuan-pro';
  if (lower.includes('hunyuan-standard')) return 'hunyuan-standard';
  if (lower.includes('hunyuan-lite')) return 'hunyuan-lite';

  if (lower.includes('ernie-4.0')) return 'ernie-4.0';
  if (lower.includes('ernie-3.5')) return 'ernie-3.5';
  if (lower.includes('ernie-speed')) return 'ernie-speed';
  if (lower.includes('ernie-lite')) return 'ernie-lite';

  if (lower.includes('doubao-pro-32k')) return 'doubao-pro-32k';
  if (lower.includes('doubao-pro-4k')) return 'doubao-pro-4k';

  if (lower.includes('step-2-')) return 'step-2-16k';
  if (lower.includes('step-1v')) return 'step-1v';
  if (lower.includes('step-1-32k')) return 'step-1-32k';
  if (lower.includes('step-1-8k')) return 'step-1-8k';

  if (lower.includes('minimax-text-01-pro')) return 'minimax-text-01-pro';
  if (lower.includes('minimax-text-01')) return 'minimax-text-01';

  if (lower.includes('seed-llm-turbo')) return 'seed-llm-turbo';
  if (lower.includes('seed-llm')) return 'seed-llm';

  if (lower.includes('grok-2-vision')) return 'grok-2-vision-1212';
  if (lower.includes('grok-2')) return 'grok-2';
  if (lower.includes('grok-beta')) return 'grok-beta';
  if (lower.includes('grok-vision')) return 'grok-vision-beta';

  if (lower.includes('o1-preview')) return 'o1-preview';
  if (lower.includes('o1-mini')) return 'o1-mini';
  if (lower.includes('o3-mini')) return 'o3-mini';

  if (lower.includes('yi-1.5-34b')) return 'yi-1.5-34b-chat';
  if (lower.includes('yi-1.5-9b')) return 'yi-1.5-9b-chat';

  // 如果都匹配不到，返回清理后的名称
  return base || lower;
}

// 获取模型显示名称
export function getModelDisplayName(name: string): string {
  const normalized = normalizeModelName(name);

  // 添加空格使名称更易读，同时保持版本号格式
  return normalized
    .replace(/(\d)\.(\d)/g, '$1.$2') // 保持版本号格式如 1.5, 2.5
    .replace(/(\d)k/gi, '$1K') // 32K 格式
    .replace(/(\d)b/gi, '$1B') // 70B 格式
    .replace(/-/g, ' ') // 用空格替换连字符
    .replace(/gpt(\d)/g, 'GPT-$1')
    .replace(/glm(\d)/g, 'GLM-$1')
    .replace(/qwen/g, 'Qwen')
    .replace(/llama/g, 'Llama')
    .replace(/gemini/g, 'Gemini')
    .replace(/claude/g, 'Claude')
    .replace(/deepseek/g, 'DeepSeek')
    .replace(/mistral/g, 'Mistral')
    .replace(/mixtral/g, 'Mixtral')
    .replace(/hunyuan/g, 'Hunyuan')
    .replace(/ernie/g, 'ERNIE')
    .replace(/moonshot/g, 'Moonshot')
    .replace(/doubao/g, 'Doubao')
    .replace(/step/g, 'Step')
    .replace(/minimax/g, 'MiniMax')
    .replace(/seed/g, 'Seed')
    .replace(/grok/g, 'Grok')
    .replace(/yi/g, 'Yi');
}

// 标准化 slug (确保格式一致)
export function normalizeSlug(name: string): string {
  return normalizeModelName(name).toLowerCase().replace(/\s+/g, '-');
}

// CLI 测试
if (require.main === module) {
  const testNames = [
    'gpt-4o', 'GPT-4o', 'gpt-4o-mini', 'GPT-4o Mini',
    'claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'claude-3.5-sonnet-20241022',
    'gemini-1.5-pro', 'Gemini 1.5 Pro', 'gemini-1.5-pro-002',
    'llama-3.1-70b', 'meta-llama-3.1-70b-instruct', 'Llama 3.1 70B',
    'qwen-2.5-72b', 'Qwen/Qwen2.5-72B-Instruct', 'qwen-max',
    'deepseek-v3', 'deepseek-ai/DeepSeek-V3',
    'doubao-pro-32k', 'Doubao-pro-32k',
    'hunyuan-pro', 'hunyuan-standard',
  ];

  console.log('\n=== Model Name Normalization Test ===\n');
  for (const name of testNames) {
    console.log(`${name.padEnd(40)} => ${normalizeModelName(name).padEnd(25)} (${getModelDisplayName(name)})`);
  }
}
