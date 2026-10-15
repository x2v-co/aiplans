import { NonLlmPage, nonLlmMetadata } from '@/components/non-llm-pages';

type Props = { params: Promise<{ locale: string; slug: string }> };
export function generateMetadata({ params }: Props) {
  return nonLlmMetadata('image-model', params);
}
export default function Page({ params }: Props) {
  return <NonLlmPage kind="image-model" params={params} />;
}
