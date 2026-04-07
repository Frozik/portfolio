import { makeAutoObservable } from 'mobx';

export interface IMenuAction {
  icon?: string;
  name: string;
  callback: () => void;
  tooltip?: string;
}

export class CommonStore {
  menuActions: IMenuAction[] = [];

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setMenuActions(actions: IMenuAction[]): void {
    this.menuActions = actions;
  }

  clearMenuActions(): void {
    this.menuActions = [];
  }
}
