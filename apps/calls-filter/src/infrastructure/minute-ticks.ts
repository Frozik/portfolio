const MINUTE_MS = 60_000;

export function everyMinute(tick: () => void): () => void {
  const timer = setInterval(tick, MINUTE_MS);
  return () => clearInterval(timer);
}
