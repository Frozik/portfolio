import type { ReactNode } from 'react';
import { useId } from 'react';

/** A settings panel as a region named by its heading: screen readers and tests find a field by the panel it is in. */
export function PanelSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h4 id={headingId} className="text-[15px] font-medium text-landing-fg">
        {title}
      </h4>
      {children}
    </section>
  );
}
