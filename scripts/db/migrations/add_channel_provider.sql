-- 为 channels 表添加 provider_id 以便获取 logo
ALTER TABLE channels ADD COLUMN IF NOT EXISTS provider_id INTEGER;

-- 更新现有 channels 关联到对应的 provider
-- 根据渠道名称匹配 provider

-- OpenAI 相关
UPDATE channels SET provider_id = 1 WHERE slug LIKE '%openai%' OR name LIKE '%OpenAI%';

-- Anthropic 相关
UPDATE channels SET provider_id = 2 WHERE slug LIKE '%anthropic%' OR name LIKE '%Anthropic%';

-- DeepSeek 相关
UPDATE channels SET provider_id = 3 WHERE slug LIKE '%deepseek%' OR name LIKE '%DeepSeek%';

-- Google 相关
UPDATE channels SET provider_id = 4 WHERE slug LIKE '%google%' OR slug LIKE '%gemini%' OR name LIKE '%Google%' OR name LIKE '%Gemini%';

-- Meta 相关
UPDATE channels SET provider_id = 5 WHERE slug LIKE '%meta%' OR name LIKE '%Meta%';

-- Mistral 相关
UPDATE channels SET provider_id = 6 WHERE slug LIKE '%mistral%' OR name LIKE '%Mistral%';

-- X.AI / Grok 相关
UPDATE channels SET provider_id = 11 WHERE slug LIKE '%grok%' OR slug LIKE '%xai%' OR name LIKE '%Grok%' OR name LIKE '%X.AI%';

-- Together AI 相关
UPDATE channels SET provider_id = 1 WHERE slug = 'together-ai' OR name = 'Together AI';

-- SiliconFlow 相关
UPDATE channels SET provider_id = 7 WHERE slug = 'siliconflow' OR name = 'SiliconFlow';

-- 验证更新结果
SELECT
  c.name as channel_name,
  p.name as provider_name,
  p.logo_url
FROM channels c
LEFT JOIN providers p ON c.provider_id = p.id
ORDER BY c.name;
