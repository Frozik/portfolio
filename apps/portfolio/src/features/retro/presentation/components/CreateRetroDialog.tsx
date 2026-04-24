import { useFunction } from '@frozik/components/hooks/useFunction';
import { Check } from 'lucide-react';
import { memo, useState } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import { Slider } from '../../../../shared/ui/Slider';
import type { ICreateRoomParams } from '../../application/RetroLobbyStore';
import { RETRO_TEMPLATES } from '../../domain/templates';
import type { ITemplateConfig } from '../../domain/types';
import { retroT as t } from '../translations';

const MIN_VOTES = 1;
const MAX_VOTES = 10;
const DEFAULT_VOTES = 5;
const CHECK_ICON_SIZE_PX = 12;

interface CreateRetroDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (params: ICreateRoomParams) => void;
}

const DEFAULT_TEMPLATE_ID = RETRO_TEMPLATES[0].id;

interface TemplateCardProps {
  readonly template: ITemplateConfig;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}

const TemplateCard = memo(({ template, selected, onSelect }: TemplateCardProps) => {
  const handleClick = useFunction(() => {
    onSelect(template.id);
  });

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={selected}
      className={cn(
        'w-full text-left transition-colors',
        'focus:outline-none focus-visible:outline-none'
      )}
    >
      <CardFrame
        hoverable
        className={cn(
          'p-3.5 transition-colors',
          selected ? 'border-landing-accent bg-landing-accent/10' : 'hover:border-landing-accent/40'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[13.5px] font-medium text-landing-fg">{template.name}</span>
            <span className="text-[12px] font-light text-landing-fg-dim">
              {template.description}
            </span>
          </div>
          {selected && (
            <span
              aria-hidden="true"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-landing-accent text-landing-bg"
            >
              <Check size={CHECK_ICON_SIZE_PX} strokeWidth={3} />
            </span>
          )}
        </div>
      </CardFrame>
    </button>
  );
});

const CreateRetroDialogComponent = ({ open, onClose, onCreate }: CreateRetroDialogProps) => {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [votesPerParticipant, setVotesPerParticipant] = useState(DEFAULT_VOTES);

  const handleNameChange = useFunction((event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  });

  const handleTemplateSelect = useFunction((nextId: string) => {
    setTemplate(nextId);
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

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          'px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
          'text-landing-fg-dim hover:text-landing-fg'
        )}
      >
        {t.create.cancel}
      </button>
      <button
        type="submit"
        form="retro-create-form"
        className={cn(
          'inline-flex items-center gap-1.5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
          'border-0 bg-landing-accent text-landing-bg hover:bg-landing-accent/90'
        )}
      >
        {t.create.submit}
      </button>
    </>
  );

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      kicker={t.create.kicker}
      title={t.create.dialogTitle}
      description={t.create.dialogDescription}
      closeLabel={t.create.cancel}
      footer={footer}
    >
      <form id="retro-create-form" className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label className="block" htmlFor="retro-name-input">
            <MonoKicker tone="faint">{t.create.nameLabel}</MonoKicker>
          </label>
          <input
            id="retro-name-input"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder={t.create.namePlaceholderFallback}
            className={cn(
              'w-full border-0 border-b border-dashed border-landing-border-soft bg-transparent',
              'px-0 py-1 text-[14px] leading-[1.5] text-landing-fg',
              'placeholder:text-landing-fg-faint',
              'focus:border-landing-accent focus:outline-none'
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <MonoKicker tone="faint">{t.create.templateLabel}</MonoKicker>
          <div className="flex flex-col gap-2">
            {RETRO_TEMPLATES.map(templateConfig => (
              <TemplateCard
                key={templateConfig.id}
                template={templateConfig}
                selected={templateConfig.id === template}
                onSelect={handleTemplateSelect}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <MonoKicker tone="faint">{t.create.votesLabel}</MonoKicker>
            <span className="font-mono text-[12px] text-landing-fg">{votesPerParticipant}</span>
          </div>
          <Slider
            min={MIN_VOTES}
            max={MAX_VOTES}
            value={votesPerParticipant}
            onChange={handleVotesChange}
          />
        </div>
      </form>
    </DialogShell>
  );
};

export const CreateRetroDialog = memo(CreateRetroDialogComponent);

export type { CreateRetroDialogProps };
