import { NonLlmPage, nonLlmMetadata } from '@/components/non-llm-pages';

type Props = { params: Promise<{ locale: string }> };
export function generateMetadata({ params }: Props) {
  return nonLlmMetadata('voice-model', params);
}
export default function Page({ params }: Props) {
  return <NonLlmPage kind="voice-model" params={params} />;
}
