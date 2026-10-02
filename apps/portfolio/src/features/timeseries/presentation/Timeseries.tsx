import { cn } from '@frozik/components/components/cn';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';

import { TopNavCenterPortal } from '../../../app/components/TopNavCenterContext';
import { Button } from '../../../shared/ui/Button';
import type { TDemoPage } from '../application/TimeseriesDemoStore';
import { DEMO_PAGES } from '../application/TimeseriesDemoStore';
import { useTimeseriesDemoStore } from '../application/useTimeseriesDemoStore';
import { PageInfo } from './components/PageInfo';
import { LivePage } from './pages/LivePage';
import { MarksPage } from './pages/MarksPage';
import { OverviewPage } from './pages/OverviewPage';
import { SnapshotPage } from './pages/SnapshotPage';
import { SyncPage } from './pages/SyncPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { timeseriesT } from './translations';

const PAGE_MENU_ID = 'timeseries-page-menu';

function pageOf(page: TDemoPage): ReactNode {
  switch (page) {
    case 'overview':
      return <OverviewPage />;
    case 'workspace':
      return <WorkspacePage />;
    case 'marks':
      return <MarksPage />;
    case 'live':
      return <LivePage />;
    case 'snapshot':
      return <SnapshotPage />;
    case 'sync':
      return <SyncPage />;
    default:
      return assertNever(page);
  }
}

export const Timeseries = observer(() => {
  const store = useTimeseriesDemoStore();

  return (
    <div className="flex h-full w-full flex-col">
      <TopNavCenterPortal>
        <Button
          size="sm"
          variant="ghost"
          className="select-none"
          aria-expanded={store.isPageMenuOpen}
          aria-controls={PAGE_MENU_ID}
          aria-label={timeseriesT.pageMenu}
          onClick={store.togglePageMenu}
        >
          {timeseriesT.pages[store.page]}
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              store.isPageMenuOpen && 'rotate-180'
            )}
          />
        </Button>
      </TopNavCenterPortal>
      {store.isPageMenuOpen && (
        <nav
          id={PAGE_MENU_ID}
          className="flex shrink-0 select-none flex-wrap items-center gap-1 px-2 py-1"
        >
          {DEMO_PAGES.map(page => (
            <div key={page} className="flex items-center">
              <Button
                size="sm"
                variant={store.page === page ? 'primary' : 'ghost'}
                onClick={() => store.setPage(page)}
              >
                {timeseriesT.pages[page]}
              </Button>
              <PageInfo caption={timeseriesT.captions[page]} />
            </div>
          ))}
        </nav>
      )}
      <div className="relative min-h-0 flex-1">{pageOf(store.page)}</div>
    </div>
  );
});
