import { chatGptVoiceRetirement } from '@/lib/chatgpt-voice-retirement';

export function ChatGptVoiceNote({ slug, locale }: { slug?: string | null; locale: string }) {
  const note = chatGptVoiceRetirement(slug, locale);
  if (!note) return null;
  return (
    <p className="my-3 text-xs text-amber-700 dark:text-amber-400" data-plan-notice="chatgpt-voice-retirement">
      {note.text}{' '}
      <a className="underline" href={note.url} target="_blank" rel="noopener noreferrer">{note.source}</a>
    </p>
  );
}
