import { cn } from '@frozik/components/components/cn';
import type { ReactNode } from 'react';

/** A phone-first column inside the safe areas; the open vault adds its bottom tabs below. */
export function ScreenFrame({
  header,
  children,
  footer,
  className,
  'data-testid': testId,
}: {
  readonly header?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly 'data-testid'?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col" data-testid={testId}>
      {header}
      <main
        className={cn(
          'flex flex-1 flex-col gap-5 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6',
          className
        )}
      >
        {children}
      </main>
      {footer}
    </div>
  );
}
