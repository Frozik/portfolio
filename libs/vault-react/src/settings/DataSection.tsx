import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { CardFrame } from '@frozik/components/ui/CardFrame';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { dataT } from '../texts/data';
import { translateTemplateKey } from '../texts/templates';
import { ExportPanel } from './ExportPanel';
import { ImportPanel } from './ImportPanel';

/** Import and export; their forms live as long as the settings screen. */
export const DataSection = observer(({ session }: { readonly session: VaultSession }) => {
  const [importing] = useState(() => session.flows.importInto(translateTemplateKey));
  const [exporting] = useState(() => session.flows.exportOf());
  useEffect(
    () => () => {
      importing.dispose();
      exporting.dispose();
    },
    [importing, exporting]
  );

  return (
    <CardFrame className="flex flex-col gap-6 p-6">
      <h3 className="text-[16px] font-medium text-landing-fg">{dataT.title}</h3>
      <ImportPanel flow={importing} />
      <ExportPanel flow={exporting} />
    </CardFrame>
  );
});
