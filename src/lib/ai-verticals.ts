import { Code2, Film, Globe2, ImageIcon, Music2, Sparkles, WandSparkles, type LucideIcon } from 'lucide-react';

export type AiVerticalKind = 'agent' | 'creative-plan' | 'video-model' | 'music-model' | 'world-model';

export interface VerticalCard {
  title: string;
  description: string;
  href?: string;
  tags: string[];
  icon: LucideIcon;
}

export interface VerticalPageCopy {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  cardsTitle: string;
  cardsDescription: string;
  cards: VerticalCard[];
  metricsTitle: string;
  metrics: string[];
  examplesTitle: string;
  examples: Array<{
    name: string;
    provider: string;
    note: string;
    tags: string[];
  }>;
  noteTitle: string;
  note: string;
}

export const AI_VERTICALS = {
  agent: {
    href: '/agents',
    label: { en: 'Agents', zh: 'Agent 套餐' },
    sitemapPriority: 0.86,
  },
  creativePlan: {
    href: '/creative-plans',
    label: { en: 'Creative Plans', zh: '创作套餐' },
    sitemapPriority: 0.82,
  },
  videoModels: {
    href: '/video-models',
    label: { en: 'Video Models', zh: '视频模型' },
    sitemapPriority: 0.84,
  },
  musicModels: {
    href: '/music-models',
    label: { en: 'Music Models', zh: '音乐模型' },
    sitemapPriority: 0.8,
  },
  worldModels: {
    href: '/world-models',
    label: { en: 'World Models', zh: '世界模型' },
    sitemapPriority: 0.78,
  },
} as const;

export function verticalPageCopy(kind: AiVerticalKind, locale: string): VerticalPageCopy {
  const isZh = locale === 'zh';

  if (kind === 'agent') {
    return isZh
      ? {
          eyebrow: '套餐类别',
          title: 'AI Agent 与 Coding Agent 套餐对比',
          description:
            '比较 Devin、Claude Code、Codex、Replit Agent、Manus、Genspark 等以任务完成为核心的 AI Agent 套餐。重点不只是月费，而是并发、长任务、浏览器、代码执行、文件系统和人工审批能力。',
          primaryCta: '查看套餐总览',
          secondaryCta: '对比文本模型',
          cardsTitle: 'Agent 套餐应该按能力比较',
          cardsDescription: 'Agent 产品卖的是完成任务，不是单纯 token。V1 先沉淀分类和页面入口，后续接入人工 curated 数据与 scraper。',
          cards: [
            {
              title: 'Coding Agents',
              description: 'IDE、CLI、repo indexing、terminal 执行、PR 修改和后台任务。适合 Cursor、Windsurf、Copilot、Claude Code、Codex、Replit Agent。',
              tags: ['IDE / CLI', 'Repo context', 'Shell access'],
              icon: Code2,
            },
            {
              title: 'Autonomous Agents',
              description: '可自主浏览网页、拆解任务、运行工具并在必要时请求审批。适合 Devin、Manus、Genspark、ChatGPT Agent。',
              tags: ['Browser', 'Long task', 'Approvals'],
              icon: Sparkles,
            },
            {
              title: 'Workflow Agents',
              description: '面向运营、销售、研究和内部自动化。重点看第三方集成、触发器、日志、权限和人工交接。',
              tags: ['Integrations', 'Handoff', 'Audit log'],
              icon: WandSparkles,
            },
          ],
          metricsTitle: '计划追踪字段',
          metrics: ['月费 / 年费 / seat', 'included credits 或 compute hours', '并发 agent 数', '浏览器与文件系统权限', '代码执行与部署能力', '人工审批与企业权限'],
          examplesTitle: '优先收录对象',
          examples: [
            { name: 'Devin', provider: 'Cognition', note: '自主软件工程 agent，重点看 task capacity、concurrency、approval flow。', tags: ['Coding', 'Autonomous'] },
            { name: 'Claude Code', provider: 'Anthropic', note: 'CLI coding agent，和 Claude Pro / Max / Team Premium 的套餐关系需要拆清。', tags: ['CLI', 'Repo'] },
            { name: 'OpenAI Codex', provider: 'OpenAI', note: '编程 agent 与 ChatGPT paid tiers 的绑定关系。', tags: ['Coding', 'ChatGPT'] },
            { name: 'Manus', provider: 'Manus', note: '通用任务 agent，重点看 credits、浏览器、文件和长任务。', tags: ['General agent', 'Credits'] },
          ],
          noteTitle: '为什么单独成类',
          note: 'Agent 套餐的核心单位是任务、credit、compute hour 或 seat。把它硬塞进通用聊天套餐会误导用户，所以它应是 Plans 下的独立垂直方向。',
        }
      : {
          eyebrow: 'Plan category',
          title: 'AI Agent and Coding Agent Plans Compared',
          description:
            'Compare task-oriented AI agent plans such as Devin, Claude Code, Codex, Replit Agent, Manus and Genspark. The useful comparison is not just monthly price. It is concurrency, long-running work, browser access, code execution, filesystem access and human approval flow.',
          primaryCta: 'Browse plans',
          secondaryCta: 'Compare text models',
          cardsTitle: 'Agent plans should be compared by capability',
          cardsDescription: 'Agent products sell completed work, not just tokens. V1 adds the category and surfaces; curated data and scrapers can follow without disturbing API pricing.',
          cards: [
            {
              title: 'Coding Agents',
              description: 'IDE, CLI, repo indexing, terminal execution, PR edits and background tasks for Cursor, Windsurf, Copilot, Claude Code, Codex and Replit Agent.',
              tags: ['IDE / CLI', 'Repo context', 'Shell access'],
              icon: Code2,
            },
            {
              title: 'Autonomous Agents',
              description: 'Agents that browse, plan, call tools and ask for approval when needed. Useful for Devin, Manus, Genspark and ChatGPT Agent style products.',
              tags: ['Browser', 'Long task', 'Approvals'],
              icon: Sparkles,
            },
            {
              title: 'Workflow Agents',
              description: 'Automation agents for ops, sales, research and internal workflows. The comparison is integrations, triggers, logs, permissions and handoff.',
              tags: ['Integrations', 'Handoff', 'Audit log'],
              icon: WandSparkles,
            },
          ],
          metricsTitle: 'Fields to track',
          metrics: ['Monthly / annual / seat price', 'Included credits or compute hours', 'Concurrent agents', 'Browser and filesystem access', 'Code execution and deployment', 'Human approvals and enterprise controls'],
          examplesTitle: 'Priority products',
          examples: [
            { name: 'Devin', provider: 'Cognition', note: 'Autonomous software engineering agent. Track task capacity, concurrency and approval flow.', tags: ['Coding', 'Autonomous'] },
            { name: 'Claude Code', provider: 'Anthropic', note: 'CLI coding agent. The plan relationship with Claude Pro / Max / Team Premium must be explicit.', tags: ['CLI', 'Repo'] },
            { name: 'OpenAI Codex', provider: 'OpenAI', note: 'Coding agent bundled with paid ChatGPT tiers and developer workflows.', tags: ['Coding', 'ChatGPT'] },
            { name: 'Manus', provider: 'Manus', note: 'General-purpose task agent. Track credits, browser, files and long-running work.', tags: ['General agent', 'Credits'] },
          ],
          noteTitle: 'Why this is its own vertical',
          note: 'Agent plans are sold by tasks, credits, compute hours or seats. Folding them into chatbot subscriptions would hide the thing buyers actually compare.',
        };
  }

  if (kind === 'creative-plan') {
    return isZh
      ? {
          eyebrow: '套餐类别',
          title: 'AI 视频、图片、音乐创作套餐对比',
          description:
            '创作类 AI 的价格单位通常是 credit、秒数、生成次数或分钟数。这里统一对比 Runway、Kling、Pika、Luma、Suno、Udio、Midjourney、Ideogram 等产品的套餐权益。',
          primaryCta: '查看套餐总览',
          secondaryCta: '查看视频模型',
          cardsTitle: '创作套餐不能按 token 看',
          cardsDescription: '视频、图片、音乐各自有不同单位。先建立统一入口，再逐步补充价格、额度、版权和 API 能力。',
          cards: [
            {
              title: 'Video Generation Plans',
              description: '按秒数、生成次数、分辨率、队列速度、水印、商用授权和 API 访问对比。',
              tags: ['Seconds', 'Resolution', 'Watermark'],
              icon: Film,
            },
            {
              title: 'Image Generation Plans',
              description: '按图片数量、最大分辨率、编辑能力、风格控制、一致性、私有生成和版权对比。',
              tags: ['Images', 'Editing', 'License'],
              icon: ImageIcon,
            },
            {
              title: 'Music / Audio Plans',
              description: '按歌曲长度、生成次数、stem 导出、人声、商用权、声音克隆和 API 访问对比。',
              tags: ['Minutes', 'Vocals', 'Stems'],
              icon: Music2,
            },
          ],
          metricsTitle: '计划追踪字段',
          metrics: ['included credits', '每月视频秒数 / 音频分钟数', '生成次数', '最大分辨率 / 时长', '商用授权', 'API 与团队协作'],
          examplesTitle: '优先收录对象',
          examples: [
            { name: 'Runway', provider: 'Runway', note: '视频生成套餐，按 credits、分辨率、队列速度和商用权对比。', tags: ['Video', 'Credits'] },
            { name: 'Kling', provider: 'Kuaishou', note: '视频生成与图片生视频套餐，国内外价格可能分开。', tags: ['Video', 'China'] },
            { name: 'Suno', provider: 'Suno', note: '音乐生成套餐，重点看歌曲数量、商用权和音频时长。', tags: ['Music', 'Commercial'] },
            { name: 'Midjourney', provider: 'Midjourney', note: '图片生成套餐，重点看 fast hours、relax mode、隐私和授权。', tags: ['Image', 'GPU hours'] },
          ],
          noteTitle: '落地策略',
          note: '先用 curated 数据覆盖主流产品，价格单位统一成“官方公布单位 + 可选折算”。不要用 token 价格表强行表达创作模型。',
        }
      : {
          eyebrow: 'Plan category',
          title: 'AI Video, Image and Music Creation Plans Compared',
          description:
            'Creative AI products are priced in credits, seconds, generations or minutes. Compare plan allowances across Runway, Kling, Pika, Luma, Suno, Udio, Midjourney, Ideogram and similar products.',
          primaryCta: 'Browse plans',
          secondaryCta: 'View video models',
          cardsTitle: 'Creative plans are not token plans',
          cardsDescription: 'Video, image and music products use different units. This vertical gives them a clean surface before curated pricing and scrapers are added.',
          cards: [
            {
              title: 'Video Generation Plans',
              description: 'Compare seconds, generations, resolution, queue speed, watermarking, commercial rights and API access.',
              tags: ['Seconds', 'Resolution', 'Watermark'],
              icon: Film,
            },
            {
              title: 'Image Generation Plans',
              description: 'Compare image quotas, max resolution, editing, style control, consistency, private generation and licensing.',
              tags: ['Images', 'Editing', 'License'],
              icon: ImageIcon,
            },
            {
              title: 'Music / Audio Plans',
              description: 'Compare song length, generation count, stems, vocals, commercial rights, voice cloning and API availability.',
              tags: ['Minutes', 'Vocals', 'Stems'],
              icon: Music2,
            },
          ],
          metricsTitle: 'Fields to track',
          metrics: ['Included credits', 'Video seconds / audio minutes per month', 'Generation count', 'Max resolution / duration', 'Commercial rights', 'API and team collaboration'],
          examplesTitle: 'Priority products',
          examples: [
            { name: 'Runway', provider: 'Runway', note: 'Video generation plans. Compare credits, resolution, queue speed and commercial rights.', tags: ['Video', 'Credits'] },
            { name: 'Kling', provider: 'Kuaishou', note: 'Video and image-to-video plans. China and global pricing may need separate rows.', tags: ['Video', 'China'] },
            { name: 'Suno', provider: 'Suno', note: 'Music generation plans. Track song count, commercial rights and audio duration.', tags: ['Music', 'Commercial'] },
            { name: 'Midjourney', provider: 'Midjourney', note: 'Image generation plans. Track fast hours, relax mode, privacy and licensing.', tags: ['Image', 'GPU hours'] },
          ],
          noteTitle: 'Implementation stance',
          note: 'Start with curated data for the major products. Store the vendor-published unit first, then add optional normalized estimates. Do not force creative models through token pricing.',
        };
  }

  if (kind === 'music-model') {
    return isZh
      ? {
          eyebrow: '新增模型类别',
          title: 'AI 音乐与音频模型对比',
          description:
            '对比 Suno、Udio、Stable Audio、ElevenLabs、MiniMax Audio、Seed Audio 等音乐和音频生成模型。重点看生成时长、人声、伴奏、stem 导出、声音克隆、商用授权和 API 可用性。',
          primaryCta: '查看创作套餐',
          secondaryCta: '查看视频模型',
          cardsTitle: '音乐模型的比较维度',
          cardsDescription: '音乐模型的单位通常是歌曲、分钟、credit 或订阅额度，和文本 token 完全不同。',
          cards: [
            { title: 'Text-to-Music', description: '从提示词生成歌曲，重点看人声、风格控制、歌词、歌曲长度和商用权。', tags: ['Song', 'Vocals', 'Lyrics'], icon: Music2 },
            { title: 'Audio Generation', description: '生成音效、背景音乐、配音和音频片段，重点看时长、格式和 API。', tags: ['SFX', 'BGM', 'API'], icon: WandSparkles },
            { title: 'Voice / Stems', description: '声音克隆、stem 导出、编辑和二次创作能力决定专业工作流价值。', tags: ['Voice', 'Stems', 'Editing'], icon: Sparkles },
          ],
          metricsTitle: '计划追踪字段',
          metrics: ['价格单位：歌曲 / 分钟 / credit', '最大歌曲长度', '人声与伴奏支持', '歌词与风格控制', 'stem 导出和声音克隆', '商用许可与版权限制'],
          examplesTitle: '优先收录对象',
          examples: [
            { name: 'Suno', provider: 'Suno', note: '音乐生成头部产品，按歌曲数量、credit 和商用权对比。', tags: ['Music', 'Songs'] },
            { name: 'Udio', provider: 'Udio', note: '音乐生成与编辑，重点看输出时长、续写和下载权益。', tags: ['Music', 'Editing'] },
            { name: 'ElevenLabs Music', provider: 'ElevenLabs', note: '语音和音乐能力可能跨多个套餐，需要拆清音频分钟和授权。', tags: ['Audio', 'Voice'] },
            { name: 'Stable Audio', provider: 'Stability AI', note: '音乐与音效生成，适合纳入 API/创作套餐双视角。', tags: ['Audio', 'API'] },
          ],
          noteTitle: '为什么单独成类',
          note: '音乐模型用户关心的是可发布歌曲、版权、stem 和音频长度。用文本模型的 benchmark 或 token 价格衡量会失真。',
        }
      : {
          eyebrow: 'New model category',
          title: 'AI Music and Audio Models Compared',
          description:
            'Compare music and audio generation models such as Suno, Udio, Stable Audio, ElevenLabs, MiniMax Audio and Seed Audio. Track duration, vocals, instrumentals, stems, voice cloning, commercial rights and API availability.',
          primaryCta: 'View creative plans',
          secondaryCta: 'View video models',
          cardsTitle: 'What makes music models different',
          cardsDescription: 'Music models are priced in songs, minutes, credits or subscription allowances, not text tokens.',
          cards: [
            { title: 'Text-to-Music', description: 'Generate songs from prompts. Compare vocals, style control, lyrics, song length and commercial rights.', tags: ['Song', 'Vocals', 'Lyrics'], icon: Music2 },
            { title: 'Audio Generation', description: 'Generate sound effects, background music, voiceover and audio clips. Compare duration, formats and API access.', tags: ['SFX', 'BGM', 'API'], icon: WandSparkles },
            { title: 'Voice / Stems', description: 'Voice cloning, stem export, editing and remix ability determine professional workflow value.', tags: ['Voice', 'Stems', 'Editing'], icon: Sparkles },
          ],
          metricsTitle: 'Fields to track',
          metrics: ['Pricing unit: song / minute / credit', 'Max song length', 'Vocals and instrumental support', 'Lyrics and style control', 'Stem export and voice cloning', 'Commercial rights and copyright limits'],
          examplesTitle: 'Priority products',
          examples: [
            { name: 'Suno', provider: 'Suno', note: 'Leading music generator. Compare song counts, credits and commercial rights.', tags: ['Music', 'Songs'] },
            { name: 'Udio', provider: 'Udio', note: 'Music generation and editing. Track duration, extension and download rights.', tags: ['Music', 'Editing'] },
            { name: 'ElevenLabs Music', provider: 'ElevenLabs', note: 'Voice and music may span plans. Separate audio minutes from rights.', tags: ['Audio', 'Voice'] },
            { name: 'Stable Audio', provider: 'Stability AI', note: 'Music and sound generation. Useful in both API and creative-plan views.', tags: ['Audio', 'API'] },
          ],
          noteTitle: 'Why this is its own category',
          note: 'Music buyers care about publishable songs, rights, stems and audio duration. Text-model benchmarks and token prices do not answer that purchase question.',
        };
  }

  if (kind === 'world-model') {
    return isZh
      ? {
          eyebrow: '新增模型类别',
          title: 'AI 世界模型与仿真模型追踪',
          description:
            '追踪 Genie、World Labs、Cosmos、JEPA 类模型，以及面向 3D、游戏环境和机器人仿真的世界模型。早期重点不是价格，而是可用性、交互性、物理一致性和输出形态。',
          primaryCta: '查看视频模型',
          secondaryCta: '查看模型对比',
          cardsTitle: '世界模型的比较维度',
          cardsDescription: '世界模型市场还早。先把 research preview、API、产品化和开源权重区分清楚。',
          cards: [
            { title: 'Interactive Worlds', description: '可交互视频或 3D 场景，重点看控制、连续性、状态保持和延迟。', tags: ['Interactive', 'State', 'Control'], icon: Globe2 },
            { title: 'Simulation Models', description: '机器人、自动驾驶和物理仿真场景，重点看物理一致性和环境覆盖。', tags: ['Robotics', 'Physics', 'Sim'], icon: Sparkles },
            { title: 'Game / 3D Generation', description: '生成游戏场景、资产或可探索环境，重点看 3D 输出、编辑和引擎集成。', tags: ['3D', 'Games', 'Assets'], icon: WandSparkles },
          ],
          metricsTitle: '计划追踪字段',
          metrics: ['可用性：研究 / preview / API / 产品', '输入：文本 / 图像 / 视频 / 状态', '输出：视频 / 3D / 仿真环境', '是否可交互', '物理一致性', '延迟、帧率和控制能力'],
          examplesTitle: '优先收录对象',
          examples: [
            { name: 'Genie / Genie 2', provider: 'Google DeepMind', note: '从图像或提示生成可交互环境，偏 research tracking。', tags: ['Research', 'Interactive'] },
            { name: 'World Labs', provider: 'World Labs', note: '3D 世界生成方向，先追踪产品可用性和输出格式。', tags: ['3D', 'World'] },
            { name: 'Cosmos', provider: 'NVIDIA', note: '机器人与物理世界基础模型，适合按仿真和开发者 API 追踪。', tags: ['Robotics', 'Simulation'] },
            { name: 'JEPA-style models', provider: 'Meta / research', note: '世界建模研究线，更多是能力追踪而非套餐比价。', tags: ['Research', 'Planning'] },
          ],
          noteTitle: '落地策略',
          note: '世界模型公开价格和标准 benchmark 都不成熟。先做 tracker 和解释页，等 API 与商业套餐稳定后再进入价格对比表。',
        }
      : {
          eyebrow: 'New model category',
          title: 'AI World Models and Simulation Models Tracked',
          description:
            'Track world models such as Genie, World Labs, Cosmos, JEPA-style research lines, 3D environment generation and robotics simulation models. Early comparison should focus on availability, interactivity, physical consistency and output format before pricing.',
          primaryCta: 'View video models',
          secondaryCta: 'Compare models',
          cardsTitle: 'What makes world models different',
          cardsDescription: 'The category is early. Separate research previews, APIs, productized tools and open weights before forcing a price table.',
          cards: [
            { title: 'Interactive Worlds', description: 'Interactive video or 3D scenes. Compare control, continuity, persistent state and latency.', tags: ['Interactive', 'State', 'Control'], icon: Globe2 },
            { title: 'Simulation Models', description: 'Robotics, autonomous driving and physical simulation. Compare physics consistency and environment coverage.', tags: ['Robotics', 'Physics', 'Sim'], icon: Sparkles },
            { title: 'Game / 3D Generation', description: 'Generate game scenes, assets or explorable spaces. Compare 3D output, editing and engine integration.', tags: ['3D', 'Games', 'Assets'], icon: WandSparkles },
          ],
          metricsTitle: 'Fields to track',
          metrics: ['Availability: research / preview / API / product', 'Input: text / image / video / state', 'Output: video / 3D / simulated environment', 'Interactivity', 'Physical consistency', 'Latency, frame rate and control'],
          examplesTitle: 'Priority products',
          examples: [
            { name: 'Genie / Genie 2', provider: 'Google DeepMind', note: 'Interactive environment generation from prompts or images. Mostly research tracking today.', tags: ['Research', 'Interactive'] },
            { name: 'World Labs', provider: 'World Labs', note: '3D world generation direction. Track availability and output format first.', tags: ['3D', 'World'] },
            { name: 'Cosmos', provider: 'NVIDIA', note: 'Physical world foundation models for robotics and simulation. Track developer APIs.', tags: ['Robotics', 'Simulation'] },
            { name: 'JEPA-style models', provider: 'Meta / research', note: 'World-model research line. More capability tracking than plan comparison today.', tags: ['Research', 'Planning'] },
          ],
          noteTitle: 'Implementation stance',
          note: 'World-model pricing and benchmarks are not standardized yet. Start as a tracker and explainer surface; promote it into pricing tables when commercial APIs settle.',
        };
  }

  return isZh
    ? {
        eyebrow: '新增模型类别',
        title: 'AI 视频模型对比',
        description:
          '对比 Sora、Veo、Kling、Runway、Pika、Luma、Hailuo、Seedance、Wan 等视频生成模型。重点看输入方式、最大时长、分辨率、镜头控制、一致性、价格单位和 API 可用性。',
        primaryCta: '查看 API 价格',
        secondaryCta: '查看创作套餐',
        cardsTitle: '视频模型的比较维度',
        cardsDescription: '视频模型不是“上下文窗口 + token 价格”。需要按产物能力和生成成本建立新维度。',
        cards: [
          {
            title: 'Text-to-Video',
            description: '从提示词生成视频，重点看语义跟随、镜头控制、时长、分辨率和物理一致性。',
            tags: ['Prompt', 'Camera', 'Physics'],
            icon: Film,
          },
          {
            title: 'Image-to-Video',
            description: '从首帧或参考图生成视频，重点看角色一致性、动作控制和风格稳定性。',
            tags: ['Reference image', 'Character', 'Motion'],
            icon: ImageIcon,
          },
          {
            title: 'World Models',
            description: '面向可交互场景、3D、机器人仿真和游戏环境。早期先追踪可用性和能力，不强行标价。',
            tags: ['Simulation', '3D', 'Interactive'],
            icon: Globe2,
          },
        ],
        metricsTitle: '计划追踪字段',
        metrics: ['价格单位：秒 / 次 / credit', '最大时长与分辨率', '文生视频 / 图生视频 / 视频生视频', '镜头控制与角色一致性', 'API 可用性', '商用许可与地区可用性'],
        examplesTitle: '优先收录对象',
        examples: [
          { name: 'Sora', provider: 'OpenAI', note: 'OpenAI 视频生成模型，重点看 ChatGPT 套餐权益和未来 API 价格。', tags: ['Text-to-video', 'OpenAI'] },
          { name: 'Veo', provider: 'Google', note: 'Google 视频模型，需区分 Gemini App、Vertex AI 和 Ultra 权益。', tags: ['Video', 'Google'] },
          { name: 'Kling', provider: 'Kuaishou', note: '国内外都有使用入口，价格单位可能按 credits 和会员权益混合。', tags: ['China', 'Credits'] },
          { name: 'Runway Gen-4', provider: 'Runway', note: '成熟创作产品，适合优先补齐套餐、seconds 和 resolution。', tags: ['Creative', 'API'] },
        ],
        noteTitle: '为什么先做视频',
        note: '视频模型搜索需求增长快，公开模型和套餐正在快速增加。它是从文本 LLM 扩展到多模态模型对比的最佳第一步。',
      }
    : {
        eyebrow: 'New model category',
        title: 'AI Video Models Compared',
        description:
          'Compare video generation models such as Sora, Veo, Kling, Runway, Pika, Luma, Hailuo, Seedance and Wan. The useful fields are input modes, max duration, resolution, camera control, consistency, pricing unit and API availability.',
        primaryCta: 'View API pricing',
        secondaryCta: 'View creative plans',
        cardsTitle: 'What makes video models different',
        cardsDescription: 'Video models are not context-window-plus-token-price products. They need output capability and generation-cost fields.',
        cards: [
          {
            title: 'Text-to-Video',
            description: 'Generate video from prompts. Compare prompt following, camera control, duration, resolution and physical consistency.',
            tags: ['Prompt', 'Camera', 'Physics'],
            icon: Film,
          },
          {
            title: 'Image-to-Video',
            description: 'Generate from a first frame or reference image. Compare character consistency, motion control and style stability.',
            tags: ['Reference image', 'Character', 'Motion'],
            icon: ImageIcon,
          },
          {
            title: 'World Models',
            description: 'Track interactive scenes, 3D, robotics simulation and game environments. Early pages should track availability before forcing price tables.',
            tags: ['Simulation', '3D', 'Interactive'],
            icon: Globe2,
          },
        ],
        metricsTitle: 'Fields to track',
        metrics: ['Pricing unit: second / generation / credit', 'Max duration and resolution', 'Text-to-video / image-to-video / video-to-video', 'Camera control and character consistency', 'API availability', 'Commercial license and region availability'],
        examplesTitle: 'Priority models',
        examples: [
          { name: 'Sora', provider: 'OpenAI', note: 'OpenAI video generation model. Track ChatGPT plan allowance and future API pricing.', tags: ['Text-to-video', 'OpenAI'] },
          { name: 'Veo', provider: 'Google', note: 'Google video model. Separate Gemini App, Vertex AI and Ultra plan access.', tags: ['Video', 'Google'] },
          { name: 'Kling', provider: 'Kuaishou', note: 'Global and China access may diverge. Pricing can mix credits and membership allowances.', tags: ['China', 'Credits'] },
          { name: 'Runway Gen-4', provider: 'Runway', note: 'Mature creative product. Good first target for plans, seconds and resolution fields.', tags: ['Creative', 'API'] },
        ],
        noteTitle: 'Why video first',
        note: 'Video model demand is rising fast and the provider set is now large enough to compare. It is the best first step from text LLM comparison into multimodal models.',
      };
}
