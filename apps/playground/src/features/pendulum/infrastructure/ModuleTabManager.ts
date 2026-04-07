import type { AddPanelOptions, DockviewApi } from 'dockview';
import { isNil } from 'lodash-es';
import { BehaviorSubject, firstValueFrom, tap } from 'rxjs';
import { first } from 'rxjs/operators';

export interface TModuleTabManager {
  registerApi(api: DockviewApi): void;
  resetApi(): void;
  openTab(options: AddPanelOptions<{ title: string }>): Promise<void>;
}

export function createTabManagerModule(): TModuleTabManager {
  const apiSubject = new BehaviorSubject<DockviewApi | undefined>(undefined);

  return {
    registerApi(api: DockviewApi) {
      apiSubject.next(api);
    },
    resetApi() {
      apiSubject.next(undefined);
    },
    async openTab(options: AddPanelOptions<{ title: string }>): Promise<void> {
      await firstValueFrom(
        apiSubject.pipe(
          first(api => !isNil(api)),
          tap(api => api.addPanel(options))
        )
      );
    },
  };
}
