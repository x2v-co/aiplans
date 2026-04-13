import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-zinc-500">The page you're looking for doesn't exist.</p>
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
