/* eslint-disable @next/next/no-img-element */
/**
 * Shared JSX template for Open Graph images emitted via Next.js
 * opengraph-image.tsx files. Each OG image file should:
 *
 *   import { ImageResponse } from 'next/og';
 *   import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';
 *
 *   export const size = OG_SIZE;
 *   export const contentType = OG_CONTENT_TYPE;
 *   export const runtime = 'edge';
 *
 *   export default async function Image({ params }: { params: ... }) {
 *     return new ImageResponse(
 *       ogTemplate({ kicker: 'API Pricing', title: 'GPT-4o', subtitle: '...' }),
 *       size,
 *     );
 *   }
 *
 * The template uses only inline styles + system fonts so no custom font
 * download / subset is needed. Keep it that way — every extra byte in the
 * edge runtime costs build time.
 */
import React from 'react';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png' as const;

interface OgTemplateInput {
  kicker: string;                 // Top-right tag e.g. "API Pricing" / "Compare Plans"
  title: string;                  // Big headline, usually model/provider name
  subtitle?: string;              // Secondary line below title
  stats?: { label: string; value: string }[]; // Up to 3 stat chips at bottom
  accent?: string;                // CSS color for the accent bar, default blue
  locale?: 'en' | 'zh';
}

export function ogTemplate(input: OgTemplateInput): React.ReactElement {
  const {
    kicker,
    title,
    subtitle,
    stats = [],
    accent = '#2563eb',
    locale = 'en',
  } = input;

  const isZh = locale === 'zh';
  const siteTag = isZh ? '全网 AI 价格对比' : 'AI Pricing Comparison';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        padding: '64px',
        position: 'relative',
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '8px',
          background: accent,
        }}
      />

      {/* Top row: logo + kicker */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '36px' }}>💰</div>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>aiplans.dev</div>
        </div>
        <div
          style={{
            fontSize: '20px',
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontWeight: 600,
          }}
        >
          {kicker}
        </div>
      </div>

      {/* Main title — large, centered-ish */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          marginTop: '24px',
        }}
      >
        <div
          style={{
            fontSize: title.length > 30 ? '56px' : title.length > 20 ? '72px' : '88px',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#f8fafc',
            maxWidth: '1100px',
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: '20px',
              fontSize: '32px',
              color: '#cbd5e1',
              lineHeight: 1.3,
              maxWidth: '1100px',
              fontWeight: 400,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {/* Bottom row: stats + site tag */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          marginTop: '32px',
        }}
      >
        <div style={{ display: 'flex', gap: '16px' }}>
          {stats.slice(0, 3).map((stat, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '14px 22px',
                background: 'rgba(37, 99, 235, 0.15)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '18px', color: '#64748b' }}>{siteTag}</div>
      </div>
    </div>
  );
}
