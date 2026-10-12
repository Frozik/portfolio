import type { ChangeEvent, ReactNode } from 'react';
import { memo } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '../cn';
import controlTokens from '../control-tokens.module.css';
import styles from './styles.module.css';

/** The native checkbox with the family's tokens: lighter and more accessible than a custom one. */
export const Checkbox = memo(
  ({
    className,
    checked,
    onCheckedChange,
    children,
    disabled = false,
    'aria-describedby': ariaDescribedBy,
  }: {
    readonly className?: string;
    readonly checked: boolean;
    readonly onCheckedChange?: (checked: boolean) => void;
    /** The label, clickable with the box. */
    readonly children?: ReactNode;
    readonly disabled?: boolean;
    readonly 'aria-describedby'?: string;
  }) => {
    const handleChange = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
      onCheckedChange?.(event.target.checked)
    );
    return (
      <label className={cn(controlTokens.tokens, styles.checkbox, className)}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          aria-describedby={ariaDescribedBy}
        />
        {children}
      </label>
    );
  }
);
