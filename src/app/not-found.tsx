import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Page not found | aiplans' },
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

/** Root fallback for invalid locale segments; the locale layout is not rendered. */
export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>404</h1>
          <p>The page you are looking for does not exist.</p>
          <Link href="/en">Back to home</Link>
        </main>
      </body>
    </html>
  );
}
