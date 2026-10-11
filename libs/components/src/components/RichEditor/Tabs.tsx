import * as TabsPrimitive from '@radix-ui/react-tabs';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';

import { cn } from '../cn';
import styles from './styles.module.css';

export interface ITab<TId extends string> {
  readonly id: TId;
  readonly label: ReactNode;
  readonly content: ReactNode;
}

/**
 * A card's tabs: Radix for the roles and arrow keys, the
 * RichEditor tokens for the look. Generic in the id so the change handler
 * receives the caller's id type; not memoised, `memo` erases the type parameter.
 */
export function Tabs<TId extends string>({
  className,
  tabs,
  value,
  onValueChange,
  actions,
  'aria-label': ariaLabel,
}: {
  readonly className?: string;
  readonly tabs: readonly ITab<TId>[];
  readonly value: TId;
  readonly onValueChange: (id: TId) => void;
  /** Controls at the end of the tab bar, outside the tab list (adding a tab). */
  readonly actions?: ReactNode;
  readonly 'aria-label'?: string;
}) {
  const handleValueChange = (next: string) => {
    const tab = tabs.find(candidate => candidate.id === next);
    if (!isNil(tab)) {
      onValueChange(tab.id);
    }
  };
  return (
    <TabsPrimitive.Root
      className={cn(styles.tabs, className)}
      value={value}
      onValueChange={handleValueChange}
    >
      <div className={styles.tabsBar}>
        <TabsPrimitive.List className={styles.tabsList} aria-label={ariaLabel}>
          {tabs.map(tab => (
            <TabsPrimitive.Trigger key={tab.id} className={styles.tabsTrigger} value={tab.id}>
              {tab.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {!isNil(actions) && <div className={styles.tabsActions}>{actions}</div>}
      </div>
      {tabs.map(tab => (
        <TabsPrimitive.Content key={tab.id} value={tab.id}>
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
