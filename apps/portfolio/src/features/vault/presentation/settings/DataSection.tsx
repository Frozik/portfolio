import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { CardFrame } from '../../../../shared/ui/CardFrame';
import type { VaultFeatureStore } from '../../application/VaultFeatureStore';
import type { VaultSession } from '../../application/VaultSession';
import { dataT } from '../translations/data';
import { translateTemplateKey } from '../translations/template-texts';
import { ExportPanel } from './ExportPanel';
import { ImportPanel } from './ImportPanel';

/** Import and export; their forms live as long as the settings screen. */
export const DataSection = observer(
  ({ store, session }: { readonly store: VaultFeatureStore; readonly session: VaultSession }) => {
    const [importing] = useState(() => store.importInto(session, translateTemplateKey));
    const [exporting] = useState(() => store.exportOf(session));
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
  }
);
