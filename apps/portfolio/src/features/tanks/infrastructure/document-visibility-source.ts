import type { IVisibilitySource } from '../domain/ports/visibility-source';

export function createDocumentVisibilitySource(): IVisibilitySource {
  return {
    onHidden(listener: VoidFunction): VoidFunction {
      const handleVisibilityChange = (): void => {
        if (document.hidden) {
          listener();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    },
  };
}
