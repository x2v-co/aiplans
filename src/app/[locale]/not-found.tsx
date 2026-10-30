import Link from 'next/link';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: { absolute: locale === 'zh' ? '页面不存在 | aiplans' : 'Page not found | aiplans' },
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  };
}

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-zinc-500">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
