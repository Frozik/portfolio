import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { useIsCoarsePointer } from '@frozik/components/hooks/useIsCoarsePointer';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { PanelRight, Settings } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo, useState } from 'react';

import { Alert } from '../../../shared/ui/Alert';
import { Button } from '../../../shared/ui/Button';
import { Drawer } from '../../../shared/ui/Drawer';
import type { SitePlannerStore } from '../application/SitePlannerStore';
import { useSitePlannerStore } from '../application/useSitePlannerStore';
import { attachPlanPointerInput } from '../infrastructure/plan-pointer-input';
import { ClearSiteButton } from './components/ClearSiteButton';
import { ExportMenu } from './components/ExportMenu';
import { HistoryControls } from './components/HistoryControls';
import { ModeBar } from './components/ModeBar';
import { OverlayModeToggle } from './components/OverlayModeToggle';
import { PlanCanvas } from './components/PlanCanvas';
import { PlanSidePanels } from './components/PlanSidePanels';
import { SaveStatus } from './components/SaveStatus';
import { SceneCanvas } from './components/SceneCanvas';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { StatusBarShell } from './components/StatusBarShell';
import { SunStudyToggle } from './components/SunStudyToggle';
import { ToolbarIconButton } from './components/ToolbarIconButton';
import { ToolPalette } from './components/ToolPalette';
import { ViewModeToggle } from './components/ViewModeToggle';
import { useViewModeHotkey } from './hooks/useViewModeHotkey';
import { sitePlannerT } from './translations';

/** The 3D view: the canvas fills the workspace, the navigation hint sits under it. */
const SceneWorkspace = memo(({ store }: { readonly store: SitePlannerStore }) => (
  <>
    <SceneCanvas store={store} />
    <StatusBarShell>
      <span className="truncate">{sitePlannerT.scene.navigationHint}</span>
    </StatusBarShell>
  </>
));

/**
 * The 2D editor: tools on the left, the plan in the middle, the plan tree on the
 * right. On a touch screen the tools lie across the top and the panels move into
 * a drawer, leaving the canvas the whole width it needs to be drawn on.
 */
const PlanWorkspace = memo(
  ({ store, isCompact }: { readonly store: SitePlannerStore; readonly isCompact: boolean }) => (
    <>
      <div className={cn('flex min-h-0 flex-1 gap-3', isCompact && 'flex-col')}>
        <ToolPalette store={store} orientation={isCompact ? 'horizontal' : 'vertical'} />
        <PlanCanvas store={store} attachPointerInput={attachPlanPointerInput} />
        {isCompact ? undefined : (
          <aside className="flex w-66 shrink-0 flex-col gap-2.5 overflow-y-auto">
            <PlanSidePanels store={store} />
          </aside>
        )}
      </div>
      <StatusBar store={store} isCompact={isCompact} />
    </>
  )
);

const ViewContent = observer(
  ({ store, isCompact }: { readonly store: SitePlannerStore; readonly isCompact: boolean }) => {
    switch (store.viewMode) {
      case 'plan':
        return <PlanWorkspace store={store} isCompact={isCompact} />;
      case 'scene':
        return <SceneWorkspace store={store} />;
      default:
        return assertNever(store.viewMode);
    }
  }
);

/** What went wrong with the last plan file; it stays until dismissed or retried. */
const FileIssueAlert = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const { fileIssue } = store;

  if (isNil(fileIssue)) {
    return undefined;
  }

  return (
    <Alert
      type="error"
      className="items-center py-2 text-xs"
      message={sitePlannerT.file.issues[fileIssue]}
      description={
        <Button variant="ghost" size="sm" onClick={store.dismissFileIssue}>
          {sitePlannerT.file.dismissIssue}
        </Button>
      }
    />
  );
});

export const SitePlanner = observer(() => {
  const store = useSitePlannerStore();
  const isCompact = useIsCoarsePointer();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [arePanelsOpen, setArePanelsOpen] = useState(false);

  useViewModeHotkey(store);

  const handleOpenSettings = useFunction(() => setIsSettingsOpen(true));
  const handleCloseSettings = useFunction(() => setIsSettingsOpen(false));
  const handleOpenPanels = useFunction(() => setArePanelsOpen(true));
  const handleClosePanels = useFunction(() => setArePanelsOpen(false));

  const hasPanelsButton = isCompact && store.viewMode === 'plan';

  return (
    <section aria-label={sitePlannerT.title} className="flex h-full w-full flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
        <ViewModeToggle viewMode={store.viewMode} onChange={store.setViewMode} />
        <ModeBar store={store} />
        <HistoryControls store={store} />
        <OverlayModeToggle store={store} />
        <SunStudyToggle store={store} />
        <ToolbarIconButton
          icon={Settings}
          label={sitePlannerT.settings.toggle}
          isActive={isSettingsOpen}
          onActivate={handleOpenSettings}
        />
        <ExportMenu store={store} />
        <ClearSiteButton store={store} />
        {hasPanelsButton ? (
          <ToolbarIconButton
            icon={PanelRight}
            label={sitePlannerT.panels.toggle}
            isActive={arePanelsOpen}
            onActivate={handleOpenPanels}
          />
        ) : undefined}
        <div className="ml-auto">
          <SaveStatus store={store} />
        </div>
      </div>

      <FileIssueAlert store={store} />

      <ViewContent store={store} isCompact={isCompact} />

      <SettingsPanel store={store} open={isSettingsOpen} onClose={handleCloseSettings} />

      {hasPanelsButton ? (
        <Drawer title={sitePlannerT.panels.title} open={arePanelsOpen} onClose={handleClosePanels}>
          <div className="flex flex-col gap-2.5">
            <PlanSidePanels store={store} />
          </div>
        </Drawer>
      ) : undefined}
    </section>
  );
});
