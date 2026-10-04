export function listen<TType extends keyof WindowEventMap>(
  target: Window,
  type: TType,
  handler: (event: WindowEventMap[TType]) => void,
  capture?: boolean
): () => void;
export function listen<TType extends keyof DocumentEventMap>(
  target: Document,
  type: TType,
  handler: (event: DocumentEventMap[TType]) => void,
  capture?: boolean
): () => void;
export function listen(
  target: EventTarget,
  type: string,
  handler: EventListener,
  capture = false
): () => void {
  target.addEventListener(type, handler, capture);
  return () => target.removeEventListener(type, handler, capture);
}
