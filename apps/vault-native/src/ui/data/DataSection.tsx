import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { useAppModel } from '../app-model';
import { useTemplateTranslator } from '../texts';
import { useSession } from '../vault/session-context';
import { ExportSection } from './ExportSection';
import { ImportSection } from './ImportSection';

/** Into the vault from elsewhere, and out of it through the share sheet. */
export const DataSection = observer(function DataSection() {
  const session = useSession();
  const translate = useTemplateTranslator();
  const [importing] = useState(() => session.flows.importInto(translate));
  const [exporting] = useState(() => session.flows.exportOf());
  const { pendingImport } = useAppModel();
  const { vaultKey } = session;
  const waiting = pendingImport.awaits(vaultKey);
  useEffect(() => {
    const file = waiting ? pendingImport.takeFor(vaultKey) : null;
    if (file !== null) {
      void importing.choose(file.bytes);
    }
  }, [waiting, pendingImport, importing, vaultKey]);
  useEffect(
    () => () => {
      importing.dispose();
      exporting.dispose();
    },
    [importing, exporting]
  );
  return (
    <>
      <ImportSection flow={importing} />
      <ExportSection flow={exporting} />
    </>
  );
});
