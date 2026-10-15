import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { Select } from '@frozik/components/components/select/Select';
import type { TFieldKind } from '@frozik/vault/model/card';
import type { TGroupId, TTemplateId } from '@frozik/vault/model/ids';
import type {
  ISmartGroupCondition,
  TConditionKind,
  TMatchMode,
} from '@frozik/vault/model/smart-group-builder';
import { CONDITION_KINDS } from '@frozik/vault/model/smart-group-builder';
import { BUILTIN_TEMPLATES } from '@frozik/vault/model/templates/registry';
import { isNil } from 'lodash-es';
import { X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import { RadioGroup } from '@frozik/components/ui/RadioGroup';
import type { SmartGroupBuilder } from '@frozik/vault-app/document/application/SmartGroupBuilder';
import { FIELD_KIND_CHOICES } from '@frozik/vault-app/document/domain/field-kind-choices';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { editorT } from '../texts/editor';
import { LANGUAGE } from '../texts/language';
import { translateTemplateKey } from '../texts/templates';
import { vaultT } from '../texts/vault';

const ICON_SIZE = 14;
const MODES: readonly TMatchMode[] = ['all', 'any'];

/** The one parameter a condition has, if any: which expiry, template, field kind or group. */
const ConditionParameter = observer(
  ({
    builder,
    session,
    index,
    condition,
  }: {
    readonly builder: SmartGroupBuilder;
    readonly session: VaultSession;
    readonly index: number;
    readonly condition: ISmartGroupCondition;
  }) => {
    const t = vaultT.smartGroups;
    const locale = LANGUAGE;
    const { rule } = condition;
    switch (rule.kind) {
      case 'expiry':
        return (
          <Select<'soon' | 'expired'>
            aria-label={t.kinds.expiry}
            options={[
              { value: 'soon', label: t.expirySoon },
              { value: 'expired', label: t.expired },
            ]}
            value={rule.status}
            onValueChange={status => builder.setRule(index, { kind: 'expiry', status })}
            locale={locale}
          />
        );
      case 'template':
        return (
          <Select<TTemplateId>
            aria-label={t.kinds.template}
            options={[
              ...BUILTIN_TEMPLATES.map(template => ({
                value: template.id,
                label: translateTemplateKey(template.nameKey),
              })),
              ...session.view.userTemplates.map(template => ({
                value: template.id,
                label: template.name,
              })),
            ]}
            value={rule.templateIds[0]}
            onValueChange={id => builder.setRule(index, { kind: 'template', templateIds: [id] })}
            locale={locale}
          />
        );
      case 'has-field':
        return (
          <Select<TFieldKind>
            aria-label={t.kinds['has-field']}
            options={FIELD_KIND_CHOICES.map(kind => ({
              value: kind,
              label: editorT.kinds[kind],
            }))}
            value={rule.fieldKind}
            onValueChange={fieldKind => builder.setRule(index, { kind: 'has-field', fieldKind })}
            locale={locale}
          />
        );
      case 'in-group':
        return (
          <Select<TGroupId>
            aria-label={t.kinds['in-group']}
            options={[...session.document.groups.values()].map(group => ({
              value: group.id,
              label: group.name,
            }))}
            value={rule.groupId}
            onValueChange={groupId => builder.setRule(index, { kind: 'in-group', groupId })}
            locale={locale}
          />
        );
      default:
        return null;
    }
  }
);

/**
 * Builds a smart group of the user's own: a name, all or any
 * of the conditions, each of which "not" turns around.
 */
export const SmartGroupDialog = observer(
  ({
    builder,
    session,
    onSaved,
    onDeleted,
    onClose,
  }: {
    readonly builder: SmartGroupBuilder;
    readonly session: VaultSession;
    readonly onSaved: (groupId: TGroupId) => void;
    readonly onDeleted: (groupId: TGroupId) => void;
    readonly onClose: () => void;
  }) => {
    const t = vaultT.smartGroups;
    const locale = LANGUAGE;
    const hasGroups = session.document.groups.size > 0;
    const save = useEventCallback(() => {
      const saved = builder.save();
      if (!isNil(saved)) {
        onSaved(saved);
        onClose();
      }
    });
    const remove = useEventCallback(() => {
      const deleted = builder.delete();
      if (!isNil(deleted)) {
        onDeleted(deleted);
      }
      onClose();
    });

    return (
      <DialogShell
        open
        onClose={onClose}
        title={builder.isEditing ? t.edit : t.create}
        footer={
          <div className="flex justify-between gap-2">
            {builder.isEditing ? (
              <Button type="button" variant="danger" onClick={remove}>
                {t.delete}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {vaultT.menu.cancel}
              </Button>
              <Button type="button" disabled={!builder.canSave} onClick={save}>
                {t.save}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <TextEditor aria-label={t.name} value={builder.name} onValueChange={builder.setName} />
          <RadioGroup
            options={MODES.map(mode => ({ value: mode, label: t.modes[mode] }))}
            value={builder.mode}
            onChange={builder.setMode}
          />
          {builder.conditions.map((condition, index) => (
            <div key={condition.key} className="flex flex-wrap items-center gap-2">
              <Checkbox
                checked={condition.negated}
                onCheckedChange={negated => builder.setNegated(index, negated)}
              >
                {t.not}
              </Checkbox>
              <Select<TConditionKind>
                aria-label={t.condition}
                options={CONDITION_KINDS.filter(kind => kind !== 'in-group' || hasGroups).map(
                  kind => ({ value: kind, label: t.kinds[kind] })
                )}
                value={condition.rule.kind}
                onValueChange={kind => builder.setKind(index, kind)}
                locale={locale}
              />
              <ConditionParameter
                builder={builder}
                session={session}
                index={index}
                condition={condition}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t.removeCondition}
                disabled={builder.conditions.length === 1}
                onClick={() => builder.removeCondition(index)}
              >
                <X size={ICON_SIZE} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={builder.addCondition}
          >
            {t.addCondition}
          </Button>
        </div>
      </DialogShell>
    );
  }
);
