import { useRouter } from 'expo-router';

/** Back where the user came from; a screen opened with nothing before it (a link, a restored reload) goes to `fallback`. */
export function useBack(fallback: string): () => void {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace(fallback));
}
