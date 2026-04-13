export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-zinc-500">
        <div className="h-10 w-10 rounded-full border-4 border-zinc-200 border-t-blue-600 animate-spin" />
        <p className="text-sm">Loading…</p>
      </div>
    </div>
  );
}
