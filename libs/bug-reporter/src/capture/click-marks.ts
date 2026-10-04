export const CLICK_MARK_LAYER_CLASS = 'bug-click-marks';
export const CLICK_MARK_CLASS = 'bug-click-mark';

/**
 * Tab capture does not draw the pointer, so a recording would never show
 * where the person clicked; this paints a short ripple at every pointer-down
 * inside `container`, which is what the recording sees.
 */
export function showClickMarks(container: HTMLElement): () => void {
  const layer = document.createElement('div');
  layer.className = CLICK_MARK_LAYER_CLASS;
  container.append(layer);
  const onPointerDown = (event: PointerEvent) => {
    const mark = document.createElement('span');
    mark.className = CLICK_MARK_CLASS;
    mark.style.left = `${event.clientX}px`;
    mark.style.top = `${event.clientY}px`;
    mark.addEventListener('animationend', () => mark.remove());
    layer.append(mark);
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    layer.remove();
  };
}
