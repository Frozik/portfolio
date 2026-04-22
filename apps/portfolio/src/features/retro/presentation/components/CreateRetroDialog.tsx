import { useFunction } from '@frozik/components';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { memo, useState } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { Slider } from '../../../../shared/ui/Slider';
import type { ICreateRoomParams } from '../../application/RetroLobbyStore';
import { RETRO_TEMPLATES } from '../../domain/templates';
import { retroT as t } from '../translations';

const MIN_VOTES = 1;
const MAX_VOTES = 10;
const DEFAULT_VOTES = 5;

interface CreateRetroDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (params: ICreateRoomParams) => void;
}

const DEFAULT_TEMPLATE_ID = RETRO_TEMPLATES[0]?.id ?? '';

const CreateRetroDialogComponent = ({ open, onClose, onCreate }: CreateRetroDialogProps) => {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [votesPerParticipant, setVotesPerParticipant] = useState(DEFAULT_VOTES);

  const handleOpenChange = useFunction((nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  });

  const handleNameChange = useFunction((event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  });

  const handleTemplateChange = useFunction((value: string) => {
    setTemplate(value);
  });

  const handleVotesChange = useFunction((value: number) => {
    setVotesPerParticipant(value);
  });

  const handleSubmit = useFunction((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const finalName = trimmedName.length > 0 ? trimmedName : t.create.namePlaceholderFallback;

    onCreate({ name: finalName, template, votesPerParticipant });
    onClose();
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm ' +
            'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
          }
        />
        <DialogPrimitive.Content
          className={
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 ' +
            'rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl ' +
            'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 ' +
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95'
          }
        >
          <DialogPrimitive.Title className="text-lg font-semibold text-text">
            {t.create.dialogTitle}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-text-secondary">
            {t.create.dialogDescription}
          </DialogPrimitive.Description>

          <form className="mt-4 flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text" htmlFor="retro-name-input">
                {t.create.nameLabel}
              </label>
              <input
                id="retro-name-input"
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder={t.create.namePlaceholderFallback}
                className={
                  'h-9 rounded-md border border-border bg-surface px-3 text-sm text-text ' +
                  'placeholder:text-text-secondary ' +
                  'focus:outline-none focus:ring-2 focus:ring-brand-500'
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text">{t.create.templateLabel}</span>
              <RadioGroupPrimitive.Root
                value={template}
                onValueChange={handleTemplateChange}
                className="flex flex-col gap-2"
              >
                {RETRO_TEMPLATES.map(templateConfig => {
                  const radioId = `retro-template-${templateConfig.id}`;

                  return (
                    <label
                      key={templateConfig.id}
                      htmlFor={radioId}
                      className={
                        'flex cursor-pointer items-start gap-3 rounded-lg border border-border ' +
                        'bg-surface p-3 transition-colors hover:bg-surface-overlay ' +
                        'has-[[data-state=checked]]:border-brand-500 ' +
                        'has-[[data-state=checked]]:bg-surface-overlay'
                      }
                    >
                      <RadioGroupPrimitive.Item
                        id={radioId}
                        value={templateConfig.id}
                        className={
                          'mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border bg-surface ' +
                          'data-[state=checked]:border-brand-500'
                        }
                      >
                        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
                          <span className="block h-2 w-2 rounded-full bg-brand-500" />
                        </RadioGroupPrimitive.Indicator>
                      </RadioGroupPrimitive.Item>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-text">{templateConfig.name}</span>
                        <span className="text-xs text-text-secondary">
                          {templateConfig.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </RadioGroupPrimitive.Root>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text">{t.create.votesLabel}</span>
                <span className="text-sm text-text-secondary">{votesPerParticipant}</span>
              </div>
              <Slider
                min={MIN_VOTES}
                max={MAX_VOTES}
                value={votesPerParticipant}
                onChange={handleVotesChange}
              />
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="secondary">
                  {t.create.cancel}
                </Button>
              </DialogPrimitive.Close>
              <Button type="submit" variant="primary">
                {t.create.submit}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export const CreateRetroDialog = memo(CreateRetroDialogComponent);

export type { CreateRetroDialogProps };
