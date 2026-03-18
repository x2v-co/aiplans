import { redirect } from 'next/navigation';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirect to default locale (en)
  redirect('/en');
}

export const metadata = {
  title: 'aiplans.dev - AI Pricing Comparison',
  description: 'Compare AI pricing across providers',
};