import { cn } from '@frozik/components/components/cn';
import { memo } from 'react';

import type { IPasswordStrength } from '@frozik/vault-app/keys/domain/master-password';
import { isWeak } from '@frozik/vault-app/keys/domain/master-password';
import { vaultT } from '../texts/vault';

const SEGMENTS = [0, 1, 2, 3] as const;

/** The zxcvbn verdict: a bar, its word, the offline attack time and the library's own advice. */
export const StrengthMeter = memo(({ strength }: { readonly strength: IPasswordStrength }) => {
  const t = vaultT.create.strength;
  const weak = isWeak(strength);
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {SEGMENTS.map(segment => (
          <span
            key={segment}
            className={cn(
              'h-1 flex-1 rounded-full',
              segment < strength.score
                ? weak
                  ? 'bg-warning'
                  : 'bg-success'
                : 'bg-landing-border-soft'
            )}
          />
        ))}
      </div>
      <span className="text-[12px] text-landing-fg-dim">
        {t.label}: {t.scores[strength.score]}. {t.crackTime(strength.offlineCrackTime)}
      </span>
      {weak && <span className="text-[12px] text-warning">{t.weak}</span>}
      {strength.warning !== null && (
        <span className="text-[12px] text-landing-fg-faint">{strength.warning}</span>
      )}
    </div>
  );
});
