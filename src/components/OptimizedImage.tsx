'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad'> {
  lazy?: boolean;
  priority?: boolean;
}

/**
 * OptimizedImage - Performance-optimized image component
 * - Uses native lazy loading when possible
 * - Provides blur placeholder for better UX
 * - Handles loading states gracefully
 */
export function OptimizedImage({
  src,
  alt,
  lazy = true,
  priority = false,
  className,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className={`relative ${className}`}>
      {/* Placeholder - shows during loading */}
      {isLoading && (
        <div
          className="absolute inset-0 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded"
          aria-hidden="true"
        />
      )}
      <Image
        src={src}
        alt={alt}
        loading={priority ? 'eager' : lazy ? 'lazy' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        onLoad={() => setIsLoading(false)}
        className={`${className} transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        {...props}
      />
    </div>
  );
}

/**
 * Preconnect - Hint browser to establish early connections
 */
export function Preconnect() {
  return (
    <>
      <link rel="preconnect" href="https://aiplans.dev" />
      <link rel="dns-prefetch" href="https://aiplans.dev" />
    </>
  );
}

/**
 * CriticalCSS - Inline critical styles for above-the-fold content
 * This helps improve First Contentful Paint (FCP)
 */
export const criticalCSS = `
  /* Critical above-the-fold styles */
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  .hero { min-height: 80vh; display: flex; align-items: center; justify-content: center; }
  .hero h1 { font-size: clamp(2rem, 5vw, 4rem); font-weight: 700; }
`;

/**
 * Script to defer non-critical JavaScript
 * Helps improve Total Blocking Time (TBT)
 */
export const deferScript = `
  // Defer non-critical scripts
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      console.log('Deferred execution');
    }, { timeout: 2000 });
  }
`;
