import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Download } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';

import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import { exportPlanJson, exportPlanPng } from '../../application/plan-export';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { PLAN_LABELS } from '../planLabels';
import { sitePlannerT } from '../translations';
import { toolbarIconButtonClass } from './ToolbarIconButton';

const ICON_SIZE_PX = 16;
const JSON_FILE_ACCEPT = 'application/json,.json';

/**
 * The ⬇ of the toolbar: the plan out as data or as a sheet, and back in as data.
 * The file picker is a control of its own rather than a menu item — a menu item
 * cannot be a file input — so the item opens it and the input stays hidden.
 */
export const ExportMenu = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleExportJson = useFunction(() => exportPlanJson(store.document.snapshot));

  const handleExportPng = useFunction(() => {
    exportPlanPng({ store, labels: PLAN_LABELS })
      .then(hasExported => {
        if (!hasExported) {
          store.persistence.reportExportFailure();
        }
      })
      .catch(() => store.persistence.reportExportFailure());
  });

  const handlePickFile = useFunction(() => fileInputRef.current?.click());

  const handleFileChange = useFunction((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Resetting the control is what lets the very same file be picked again
    // after an import that did not work out.
    event.target.value = '';

    if (!isNil(file)) {
      void store.persistence.importPlanFile(file);
    }
  });

  return (
    <>
      {/* An open menu silences the tooltip: hovering the items kept the
          trigger's tooltip up, and it stood over the menu it named. */}
      <Tooltip
        title={sitePlannerT.file.menu}
        placement="bottom"
        open={isMenuOpen ? false : undefined}
      >
        <span className="inline-flex">
          <Dropdown
            onOpenChange={setIsMenuOpen}
            trigger={
              <button
                type="button"
                aria-label={sitePlannerT.file.menu}
                className={toolbarIconButtonClass()}
              >
                <Download size={ICON_SIZE_PX} aria-hidden />
              </button>
            }
          >
            <DropdownItem onSelect={handleExportJson}>{sitePlannerT.file.exportJson}</DropdownItem>
            <DropdownItem onSelect={handlePickFile}>{sitePlannerT.file.importJson}</DropdownItem>
            <DropdownItem onSelect={handleExportPng}>{sitePlannerT.file.exportPng}</DropdownItem>
          </Dropdown>
        </span>
      </Tooltip>

      <input
        ref={fileInputRef}
        type="file"
        accept={JSON_FILE_ACCEPT}
        aria-label={sitePlannerT.file.importJson}
        className="sr-only"
        onChange={handleFileChange}
      />
    </>
  );
});
