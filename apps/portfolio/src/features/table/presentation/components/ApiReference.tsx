import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';
import { memo } from 'react';

import { Button } from '../../../../shared/ui/Button';
import type { TApiSource } from '../apiReference';
import { LOG_API, SNAPSHOT_API } from '../apiReference';
import { tableDemoT } from '../translations';

const ICON_SIZE_PX = 14;

/** A developer's reference for one data source: the contract, quoted from the library, with a note on each part. */
export const ApiReference = memo(({ source }: { readonly source: TApiSource }) => {
  const reference = tableDemoT.apiReference[source];
  const code: Readonly<Record<string, string>> = source === 'snapshot' ? SNAPSHOT_API : LOG_API;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Info size={ICON_SIZE_PX} aria-hidden />
          {tableDemoT.apiReference.open}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 flex max-h-[80vh] w-[38rem] max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto rounded-lg border border-landing-border bg-landing-bg-elev p-5 text-sm text-landing-fg shadow-xl"
        >
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-medium">{reference.title}</h3>
            <p className="text-landing-fg-dim">{reference.intro}</p>
          </div>
          {Object.entries(reference.sections).map(([id, section]) => (
            <section key={id} className="flex flex-col gap-2">
              <h4 className="font-medium">{section.title}</h4>
              <p className="text-landing-fg-dim">{section.text}</p>
              <pre className="overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-landing-fg">
                <code>{code[id]}</code>
              </pre>
            </section>
          ))}
          <Popover.Arrow className="fill-landing-bg-elev" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
