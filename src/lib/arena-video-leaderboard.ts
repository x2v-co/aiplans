import type { AiCatalogItem } from '@/lib/ai-vertical-catalog';

export interface ArenaVideoLeaderboardEntry {
  rank: number;
  modelDisplayName: string;
  rating: number;
  ratingUpper: number;
  ratingLower: number;
  votes: number;
  modelOrganization: string;
  modelUrl?: string | null;
  license?: string | null;
}

export const ARENA_TEXT_TO_VIDEO_URL = 'https://arena.ai/leaderboard/text-to-video';

// Source: arena.ai/leaderboard/text-to-video public leaderboard.entries payload,
// verified 2026-09-15. These are version-level leaderboard entries, not family
// rows; do not collapse gemini-omni-1.1-flash into Veo or wan3.0 into Wan.
export const ARENA_TEXT_TO_VIDEO_LEADERBOARD: ArenaVideoLeaderboardEntry[] = [
  {"rank": 1, "modelDisplayName": "gemini-omni-1.1-flash", "rating": 1514.597143292216, "ratingUpper": 1530.0666339947888, "ratingLower": 1499.1276525896433, "votes": 1777, "modelOrganization": "Google", "modelUrl": "https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-omni-1-1-flash/", "license": "Proprietary"},
  {"rank": 2, "modelDisplayName": "gemini-omni-flash", "rating": 1511.4416920761478, "ratingUpper": 1520.948648312532, "ratingLower": 1501.9347358397636, "votes": 21934, "modelOrganization": "Google", "modelUrl": "https://deepmind.google/models/gemini-omni/", "license": "Proprietary"},
  {"rank": 3, "modelDisplayName": "wan3.0", "rating": 1494.3428809079605, "ratingUpper": 1513.7039452063468, "ratingLower": 1474.9818166095743, "votes": 1167, "modelOrganization": "Alibaba", "modelUrl": "https://www.alibabacloud.com/blog/wan3-0-30-second-ai-video-generation-from-any-input_603452", "license": "Proprietary"},
  {"rank": 4, "modelDisplayName": "flux-3-video", "rating": 1493.8040842194478, "ratingUpper": 1511.1155609174207, "ratingLower": 1476.4926075214748, "votes": 1290, "modelOrganization": "Black Forest Labs", "modelUrl": "https://bfl.ai/models/flux-3", "license": "Proprietary"},
  {"rank": 5, "modelDisplayName": "grok-imagine-video-1.5-agent", "rating": 1491.26322726435, "ratingUpper": 1509.7892737202833, "ratingLower": 1472.7371808084167, "votes": 1195, "modelOrganization": "SpaceXAI", "modelUrl": "https://x.com/grok/status/2096298105213952178", "license": "Proprietary"},
  {"rank": 6, "modelDisplayName": "dreamina-seedance-2.5-720p", "rating": 1481.983747851711, "ratingUpper": 1494.2277706968266, "ratingLower": 1469.7397250065956, "votes": 4066, "modelOrganization": "Bytedance", "modelUrl": "https://seed.bytedance.com/en/seedance2_5", "license": "Proprietary"},
  {"rank": 7, "modelDisplayName": "dreamina-seedance-2.0-720p", "rating": 1479.017816079664, "ratingUpper": 1487.4610439533244, "ratingLower": 1470.5745882060032, "votes": 52864, "modelOrganization": "Bytedance", "modelUrl": "https://seed.bytedance.com/en/seedance2_0", "license": "Proprietary"},
  {"rank": 8, "modelDisplayName": "minimax-h3", "rating": 1461.78019176288, "ratingUpper": 1471.5463163514246, "ratingLower": 1452.0140671743347, "votes": 7648, "modelOrganization": "MiniMax", "modelUrl": "https://app.notion.com/p/MiniMax-H3-The-Next-Gen-Open-Weight-Multimodal-Generation-Model-5cdd99c3d331822397f18130e7b480a8", "license": "minimax-h3-community-license-agreement"},
  {"rank": 9, "modelDisplayName": "muse-video", "rating": 1456.2786270846568, "ratingUpper": 1470.9837396957496, "ratingLower": 1441.573514473564, "votes": 2178, "modelOrganization": "Meta", "modelUrl": "https://ai.meta.com/blog/introducing-muse-image-muse-video-msl/", "license": "Proprietary"},
  {"rank": 10, "modelDisplayName": "happyhorse-1.0", "rating": 1427.403188202753, "ratingUpper": 1439.9446139746578, "ratingLower": 1414.861762430848, "votes": 22116, "modelOrganization": "Alibaba-ATH", "modelUrl": "https://x.com/happyhorseath/status/2044974356577611861?s=46", "license": "Proprietary"},
  {"rank": 11, "modelDisplayName": "sora-2-pro", "rating": 1366.5517880630687, "ratingUpper": 1373.4856652872231, "ratingLower": 1359.6179108389147, "votes": 50415, "modelOrganization": "OpenAI", "modelUrl": "https://platform.openai.com/docs/models/sora-2-pro", "license": "Proprietary"},
  {"rank": 12, "modelDisplayName": "veo-3.1-audio", "rating": 1364.1097581509985, "ratingUpper": 1378.5078840793162, "ratingLower": 1349.7116322226807, "votes": 13703, "modelOrganization": "Google", "modelUrl": "https://developers.googleblog.com/en/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/", "license": "Proprietary"},
  {"rank": 13, "modelDisplayName": "veo-3.1-audio-1080p", "rating": 1362.566978944138, "ratingUpper": 1372.9175459834455, "ratingLower": 1352.2164119048307, "votes": 24979, "modelOrganization": "Google", "modelUrl": "https://developers.googleblog.com/en/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/", "license": "Proprietary"},
  {"rank": 14, "modelDisplayName": "veo-3.1-fast-audio", "rating": 1361.5998750554163, "ratingUpper": 1372.0631691725603, "ratingLower": 1351.1365809382723, "votes": 39373, "modelOrganization": "Google", "modelUrl": "https://developers.googleblog.com/en/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/", "license": "Proprietary"},
  {"rank": 15, "modelDisplayName": "veo-3.1-fast-audio-1080p", "rating": 1357.9053272923693, "ratingUpper": 1367.9485447936522, "ratingLower": 1347.862109791086, "votes": 25770, "modelOrganization": "Google", "modelUrl": "https://developers.googleblog.com/en/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/", "license": "Proprietary"},
  {"rank": 16, "modelDisplayName": "veo-3-fast-audio", "rating": 1347.6531330720368, "ratingUpper": 1358.941965220607, "ratingLower": 1336.3643009234665, "votes": 25169, "modelOrganization": "Google", "modelUrl": "https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation", "license": "Proprietary"},
  {"rank": 17, "modelDisplayName": "grok-imagine-video-720p", "rating": 1342.9164080341457, "ratingUpper": 1349.6041304295463, "ratingLower": 1336.2286856387454, "votes": 159930, "modelOrganization": "SpaceXAI", "modelUrl": "https://docs.x.ai/docs/guides/video-generations", "license": "Proprietary"},
  {"rank": 18, "modelDisplayName": "sora-2", "rating": 1341.8839135367716, "ratingUpper": 1348.126485790472, "ratingLower": 1335.6413412830711, "votes": 67388, "modelOrganization": "OpenAI", "modelUrl": "https://platform.openai.com/docs/models/sora-2", "license": "Proprietary"},
  {"rank": 19, "modelDisplayName": "wan2.7-t2v", "rating": 1341.164338711853, "ratingUpper": 1348.8740989228031, "ratingLower": 1333.4545785009032, "votes": 23025, "modelOrganization": "Alibaba", "modelUrl": "https://www.alibabacloud.com/blog/alibaba-unveils-wan2-7-video-to-elevate-creators-from-executors-to-directors_603009", "license": "Proprietary"},
  {"rank": 20, "modelDisplayName": "veo-3-audio", "rating": 1339.8569785007517, "ratingUpper": 1352.451487583363, "ratingLower": 1327.26246941814, "votes": 18941, "modelOrganization": "Google", "modelUrl": "https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation", "license": "Proprietary"},
  {"rank": 21, "modelDisplayName": "wan2.6-t2v", "rating": 1327.6445860281299, "ratingUpper": 1335.3598862838912, "ratingLower": 1319.9292857723685, "votes": 49348, "modelOrganization": "Alibaba", "modelUrl": "https://modelstudio.console.alibabacloud.com/?tab=api#/api/?type=model&url=2865250", "license": "Proprietary"},
  {"rank": 22, "modelDisplayName": "seedance-v1.5-pro", "rating": 1255.8783379460754, "ratingUpper": 1262.5566993999055, "ratingLower": 1249.1999764922452, "votes": 75891, "modelOrganization": "Bytedance", "modelUrl": "https://seed.bytedance.com/en/seedance1_5_pro", "license": "Proprietary"},
  {"rank": 23, "modelDisplayName": "veo-3", "rating": 1253.2991637816729, "ratingUpper": 1264.5715866917499, "ratingLower": 1242.0267408715958, "votes": 14951, "modelOrganization": "Google", "modelUrl": "https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation", "license": "Proprietary"},
  {"rank": 24, "modelDisplayName": "veo-3-fast", "rating": 1248.376164573081, "ratingUpper": 1260.2786594668614, "ratingLower": 1236.473669679301, "votes": 15225, "modelOrganization": "Google", "modelUrl": "https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation", "license": "Proprietary"},
  {"rank": 25, "modelDisplayName": "wan2.5-t2v-preview", "rating": 1246.410548109307, "ratingUpper": 1255.2719116666226, "ratingLower": 1237.5491845519916, "votes": 32461, "modelOrganization": "Alibaba", "modelUrl": "https://modelstudio.console.alibabacloud.com/?tab=api#/api/?type=model&url=2865250", "license": "Proprietary"},
  {"rank": 26, "modelDisplayName": "pixverse-v5.6", "rating": 1239.4548000604318, "ratingUpper": 1250.008838938205, "ratingLower": 1228.9007611826587, "votes": 32289, "modelOrganization": "", "modelUrl": "https://app.pixverse.ai/onboard", "license": "Proprietary"},
  {"rank": 27, "modelDisplayName": "runway-gen-4.5", "rating": 1224.3288623616345, "ratingUpper": 1233.1467888623001, "ratingLower": 1215.5109358609689, "votes": 43610, "modelOrganization": "Runway", "modelUrl": "https://runwayml.com/research/introducing-runway-gen-4.5", "license": "Proprietary"},
  {"rank": 28, "modelDisplayName": "kling-2.5-turbo-1080p", "rating": 1219.374454524227, "ratingUpper": 1236.8161078291405, "ratingLower": 1201.9328012193141, "votes": 2100, "modelOrganization": "KlingAI", "modelUrl": "https://app.klingai.com/global/image-to-video/frame-mode/new?ra=4", "license": "Proprietary"},
  {"rank": 29, "modelDisplayName": "kling-2.6-pro", "rating": 1216.3334153168928, "ratingUpper": 1223.075178389025, "ratingLower": 1209.5916522447606, "votes": 73062, "modelOrganization": "KlingAI", "modelUrl": "https://app.klingai.com/global/release-notes/c605hp1tzd?type=dialog", "license": "Proprietary"},
  {"rank": 30, "modelDisplayName": "p-video", "rating": 1207.2171275241467, "ratingUpper": 1222.8888698727178, "ratingLower": 1191.5453851755756, "votes": 7049, "modelOrganization": "", "modelUrl": "https://www.pruna.ai/p-video", "license": "Proprietary"},
  {"rank": 31, "modelDisplayName": "ray-3", "rating": 1205.3945113442267, "ratingUpper": 1227.7662721762058, "ratingLower": 1183.0227505122475, "votes": 1129, "modelOrganization": "Luma AI", "modelUrl": "https://lumalabs.ai/ray", "license": "Proprietary"},
  {"rank": 32, "modelDisplayName": "hailuo-2.3", "rating": 1205.332677108679, "ratingUpper": 1211.481223949102, "ratingLower": 1199.184130268256, "votes": 82971, "modelOrganization": "MiniMax", "modelUrl": "https://hailuoai.video/", "license": "Proprietary"},
  {"rank": 33, "modelDisplayName": "kling-o1-pro", "rating": 1204.9075516702478, "ratingUpper": 1231.5612184301326, "ratingLower": 1178.2538849103628, "votes": 1191, "modelOrganization": "KlingAI", "modelUrl": "https://app.klingai.com/global/release-notes/zipxp988c2?type=dialog", "license": "Proprietary"},
  {"rank": 34, "modelDisplayName": "hailuo-02-pro", "rating": 1198.2411718225517, "ratingUpper": 1210.7502217242964, "ratingLower": 1185.732121920807, "votes": 9363, "modelOrganization": "MiniMax", "modelUrl": "https://www.minimax.io/news/minimax-hailuo-02", "license": "Proprietary"},
  {"rank": 35, "modelDisplayName": "seedance-v1-pro", "rating": 1190.308867305303, "ratingUpper": 1201.7438372399433, "ratingLower": 1178.8738973706631, "votes": 12120, "modelOrganization": "Bytedance", "modelUrl": "https://seed.bytedance.com/en/seedance", "license": "Proprietary"},
  {"rank": 36, "modelDisplayName": "hailuo-02-standard", "rating": 1180.622072076257, "ratingUpper": 1192.691330752266, "ratingLower": 1168.552813400248, "votes": 9330, "modelOrganization": "MiniMax", "modelUrl": "https://www.minimax.io/news/minimax-hailuo-02", "license": "Proprietary"},
  {"rank": 37, "modelDisplayName": "kandinsky-5.0-t2v-pro", "rating": 1171.9568801679932, "ratingUpper": 1192.181811888786, "ratingLower": 1151.7319484472005, "votes": 2015, "modelOrganization": "Kandinsky", "modelUrl": "https://github.com/kandinskylab/kandinsky-5/#kandinsky-50-video-pro", "license": "MIT"},
  {"rank": 38, "modelDisplayName": "hunyuan-video-1.5", "rating": 1169.1075574004349, "ratingUpper": 1185.397479353599, "ratingLower": 1152.8176354472703, "votes": 4278, "modelOrganization": "Tencent", "modelUrl": "https://hunyuan.tencent.com/video/en?tabIndex=0", "license": "tencent-hunyuan-community"},
  {"rank": 39, "modelDisplayName": "veo-2", "rating": 1163.959836844847, "ratingUpper": 1180.3023176983775, "ratingLower": 1147.6173559913163, "votes": 6501, "modelOrganization": "Google", "modelUrl": "https://cloud.google.com/vertex-ai/generative-ai/docs/models/veo/2-0-generate-001", "license": "Proprietary"},
  {"rank": 40, "modelDisplayName": "kling-v2.1-master", "rating": 1162.4577975907291, "ratingUpper": 1172.3396954620625, "ratingLower": 1152.5758997193957, "votes": 14048, "modelOrganization": "KlingAI", "modelUrl": "https://fal.ai/models/fal-ai/kling-video/v2.1/master/text-to-video", "license": "Proprietary"},
  {"rank": 41, "modelDisplayName": "ltx-2-19b", "rating": 1154.1489209549836, "ratingUpper": 1161.9924780401393, "ratingLower": 1146.305363869828, "votes": 70324, "modelOrganization": "", "modelUrl": "https://huggingface.co/Lightricks/LTX-2", "license": "ltx-2-community-license-agreement"},
  {"rank": 42, "modelDisplayName": "wan-v2.2-a14b", "rating": 1132.0574761793312, "ratingUpper": 1147.2597203523787, "ratingLower": 1116.8552320062836, "votes": 10396, "modelOrganization": "Alibaba", "modelUrl": "https://huggingface.co/Wan-AI/Wan2.2-T2V-A14B", "license": "Apache 2.0"},
  {"rank": 43, "modelDisplayName": "kandinsky-5.0-t2v-lite", "rating": 1113.2363914962443, "ratingUpper": 1131.118009013423, "ratingLower": 1095.3547739790656, "votes": 1468, "modelOrganization": "Kandinsky", "modelUrl": "https://github.com/kandinskylab/kandinsky-5/?tab=readme-ov-file#kandinsky-50-video-lite", "license": "MIT"},
  {"rank": 44, "modelDisplayName": "seedance-v1-lite", "rating": 1112.3262330149287, "ratingUpper": 1121.9146160415307, "ratingLower": 1102.7378499883268, "votes": 16176, "modelOrganization": "Bytedance", "modelUrl": "https://seed.bytedance.com/en/seedance", "license": "Proprietary"},
  {"rank": 45, "modelDisplayName": "sora", "rating": 1068.8736967221344, "ratingUpper": 1085.188858896171, "ratingLower": 1052.5585345480981, "votes": 4069, "modelOrganization": "OpenAI", "modelUrl": "https://ai.azure.com/catalog/models/sora", "license": "Proprietary"},
  {"rank": 46, "modelDisplayName": "ray2", "rating": 1064.7278474018783, "ratingUpper": 1082.1227711497863, "ratingLower": 1047.3329236539703, "votes": 5222, "modelOrganization": "Luma AI", "modelUrl": "https://lumalabs.ai/ray", "license": "Proprietary"},
  {"rank": 47, "modelDisplayName": "pika-v2.2", "rating": 1008.6508482802657, "ratingUpper": 1024.0009586545605, "ratingLower": 993.3007379059709, "votes": 5727, "modelOrganization": "Pika", "modelUrl": "https://fal.ai/models/fal-ai/pika/v2.2/text-to-video", "license": "Proprietary"},
  {"rank": 48, "modelDisplayName": "mochi-v1", "rating": 1006.0897593230476, "ratingUpper": 1022.7618023336631, "ratingLower": 989.4177163124319, "votes": 5851, "modelOrganization": "Genmo AI", "modelUrl": "https://huggingface.co/genmo/mochi-1-preview", "license": "Apache 2.0"},
];

const ORG_PROVIDER_SLUG: Record<string, string> = {
  Google: 'google',
  Alibaba: 'qwen',
  Bytedance: 'volcengine',
  OpenAI: 'openai',
  Runway: 'runway',
  KlingAI: 'kuaishou',
  'Luma AI': 'luma-ai',
  MiniMax: 'minimax-china',
  Pika: 'pika',
  Meta: 'meta',
  'Black Forest Labs': 'bfl',
  SpaceXAI: 'xai',
  'Genmo AI': 'genmo',
  Tencent: 'tencent',
  Kandinsky: 'kandinsky',
  'Alibaba-ATH': 'qwen',
};

export function arenaVideoSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function arenaVideoLeaderboardCatalogItems(): AiCatalogItem[] {
  return ARENA_TEXT_TO_VIDEO_LEADERBOARD.map((entry) => ({
    kind: 'video-model',
    slug: arenaVideoSlug(entry.modelDisplayName),
    name: entry.modelDisplayName,
    provider: entry.modelOrganization || 'Unknown',
    providerSlug: ORG_PROVIDER_SLUG[entry.modelOrganization],
    status: 'available',
    pricing: 'See source model/provider pricing; leaderboard entry is version-level.',
    unit: 'rank, Elo, votes',
    capabilities: ['leaderboard-version', 'text-to-video'],
    bestFor: `Version-level text-to-video leaderboard entry from Arena AI rank #${entry.rank}.`,
    url: entry.modelUrl ?? ARENA_TEXT_TO_VIDEO_URL,
    modelCategory: 'video',
    inputModalities: ['text'],
    outputModalities: ['video'],
    access: ['consumer-app'],
    pricingUnit: 'source-dependent',
    pricingConfidence: 'unknown',
    sourceUrls: [
      { label: 'Arena AI text-to-video leaderboard', url: ARENA_TEXT_TO_VIDEO_URL, publisher: 'Arena AI' },
      ...(entry.modelUrl ? [{ label: 'Model source', url: entry.modelUrl, publisher: entry.modelOrganization || 'Provider' }] : []),
    ],
    lastVerified: '2026-09-15',
    notes: `Arena AI rank #${entry.rank}; Elo ${entry.rating.toFixed(1)}; votes ${entry.votes}. This is a leaderboard version row, not a family-level model mapping.`,
    benchmarkSummaries: [
      { benchmarkSlug: 'arena-ai-text-to-video', benchmarkName: 'Arena AI T2V', taskName: 'Text-to-video leaderboard', metricName: 'ARENA_RANK', unit: 'rank', value: entry.rank, officialUrl: ARENA_TEXT_TO_VIDEO_URL },
      { benchmarkSlug: 'arena-ai-text-to-video', benchmarkName: 'Arena AI T2V', taskName: 'Text-to-video leaderboard', metricName: 'ARENA_ELO', unit: 'elo', value: entry.rating, officialUrl: ARENA_TEXT_TO_VIDEO_URL },
      { benchmarkSlug: 'arena-ai-text-to-video', benchmarkName: 'Arena AI T2V', taskName: 'Text-to-video leaderboard', metricName: 'VOTES', unit: 'count', value: entry.votes, officialUrl: ARENA_TEXT_TO_VIDEO_URL },
    ],
  }));
}
