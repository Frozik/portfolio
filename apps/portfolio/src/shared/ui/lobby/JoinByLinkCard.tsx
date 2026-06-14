import { Link2 } from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { memo } from 'react';

import { CardFrame } from '../CardFrame';
import { MonoKicker } from '../MonoKicker';

interface JoinByLinkCardProps {
  /** Unique input id — distinct per feature so labels never collide. */
  readonly inputId: string;
  readonly value: string;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly kicker: string;
  readonly pasteHint: string;
  readonly placeholder: string;
  readonly submitLabel: string;
}

/**
 * Shared "join by link" lobby card: paste a room URL or id and submit. The
 * submit button disables on empty input. Identical between retro and conf.
 */
const JoinByLinkCardComponent = ({
  inputId,
  value,
  onChange,
  onSubmit,
  kicker,
  pasteHint,
  placeholder,
  submitLabel,
}: JoinByLinkCardProps) => (
  <CardFrame>
    <form onSubmit={onSubmit} className="flex flex-col gap-3 px-6 py-5">
      <div className="flex items-center gap-2">
        <Link2 size={14} className="text-landing-accent" />
        <MonoKicker tone="faint">{kicker}</MonoKicker>
      </div>
      <MonoKicker tone="faint" className="text-[10px]">
        {pasteHint}
      </MonoKicker>
      <div className="flex items-center gap-3">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="flex-1 border-0 border-b border-landing-border bg-transparent py-2 font-mono text-[15px] text-landing-fg placeholder:text-landing-fg-faint focus:border-landing-accent/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={value.trim().length === 0}
          className="shrink-0 border-0 bg-landing-accent px-4 py-2 font-mono text-xs font-medium text-landing-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitLabel} →
        </button>
      </div>
    </form>
  </CardFrame>
);

export const JoinByLinkCard = memo(JoinByLinkCardComponent);
