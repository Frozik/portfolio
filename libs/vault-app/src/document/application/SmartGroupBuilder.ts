import type { TGroupId } from '@frozik/vault/model/ids';
import type {
  ISmartGroupCondition,
  TConditionKind,
  TConditionRule,
  TMatchMode,
} from '@frozik/vault/model/smart-group-builder';
import {
  conditionsOfRule,
  newCondition,
  ruleOfConditions,
} from '@frozik/vault/model/smart-group-builder';
import {
  createSmartGroup,
  deleteSmartGroup,
  updateSmartGroup,
} from '@frozik/vault/model/smart-group-edits';
import { BUILTIN_TEMPLATES } from '@frozik/vault/model/templates/registry';
import type { IUserSmartGroup, IVaultDocument } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { TTransact } from './transact';

const FIRST_FIELD_KIND = 'otp';
const FIRST_CONDITION: ISmartGroupCondition = { negated: false, rule: { kind: 'favorite' } };

/** A condition row of the dialog: its key stays while the row is edited, so the row keeps its focus. */
export type TConditionRow = ISmartGroupCondition & { readonly key: number };

/**
 * A smart group being built or changed: a name, all or any of
 * the conditions, each of which may be negated. Nothing reaches the vault
 * before "Save".
 */
export class SmartGroupBuilder {
  name: string;
  mode: TMatchMode;
  conditions: readonly TConditionRow[];

  private nextKey = 0;

  constructor(
    private readonly dependencies: {
      readonly document: () => IVaultDocument;
      readonly transact: TTransact;
      readonly random: IRandom;
    },
    private readonly editing: IUserSmartGroup | null
  ) {
    const flat = isNil(editing) ? null : conditionsOfRule(editing.rule);
    this.name = editing?.name ?? '';
    this.mode = flat?.mode ?? 'all';
    this.conditions = (flat?.conditions ?? [FIRST_CONDITION]).map(this.row);
    makeAutoObservable<SmartGroupBuilder, 'dependencies' | 'editing' | 'nextKey' | 'row'>(
      this,
      { dependencies: false, editing: false, nextKey: false, row: false },
      { autoBind: true }
    );
  }

  get isEditing(): boolean {
    return !isNil(this.editing);
  }

  get canSave(): boolean {
    return this.name.trim() !== '' && this.conditions.length > 0;
  }

  setName(name: string): void {
    this.name = name;
  }

  setMode(mode: TMatchMode): void {
    this.mode = mode;
  }

  addCondition(): void {
    this.conditions = [...this.conditions, this.row(FIRST_CONDITION)];
  }

  private readonly row = (condition: ISmartGroupCondition): TConditionRow => {
    this.nextKey += 1;
    return { ...condition, key: this.nextKey };
  };

  removeCondition(index: number): void {
    this.conditions = this.conditions.filter((_, position) => position !== index);
  }

  /** A new kind starts from the first choice of each parameter; a kind with nothing to choose from is refused. */
  setKind(index: number, kind: TConditionKind): void {
    const [firstGroup] = this.dependencies.document().groups.keys();
    const [firstTemplate] = BUILTIN_TEMPLATES;
    const rule = isNil(firstTemplate)
      ? null
      : newCondition(kind, {
          templateId: firstTemplate.id,
          groupId: firstGroup ?? null,
          fieldKind: FIRST_FIELD_KIND,
        });
    if (!isNil(rule)) {
      this.setRule(index, rule);
    }
  }

  setRule(index: number, rule: TConditionRule): void {
    this.conditions = this.conditions.map((condition, position) =>
      position === index ? { ...condition, rule } : condition
    );
  }

  setNegated(index: number, negated: boolean): void {
    this.conditions = this.conditions.map((condition, position) =>
      position === index ? { ...condition, negated } : condition
    );
  }

  save(): TGroupId | null {
    if (!this.canSave) {
      return null;
    }
    const { editing } = this;
    const change = { name: this.name, rule: ruleOfConditions(this.mode, this.conditions) };
    return this.dependencies.transact((document, at) => {
      if (!isNil(editing)) {
        return { document: updateSmartGroup(document, editing.id, change, at), result: editing.id };
      }
      const created = createSmartGroup(
        document,
        change.name,
        change.rule,
        at,
        this.dependencies.random
      );
      return { document: created.document, result: created.groupId };
    });
  }

  /** The id of the group that is gone, `null` when there was none to delete. */
  delete(): TGroupId | null {
    const { editing } = this;
    if (isNil(editing)) {
      return null;
    }
    return this.dependencies.transact((document, at) => ({
      document: deleteSmartGroup(document, editing.id, at),
      result: editing.id,
    }));
  }
}
