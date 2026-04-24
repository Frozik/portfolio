import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { getCurrentLanguage } from '../../shared/i18n/locale';
import { appT } from '../translations';

const PATH_SEGMENT_TO_TITLE_KEY: Record<string, keyof typeof appT.pageTitles> = {
  '': 'cv',
  pendulum: 'pendulum',
  sudoku: 'sudoku',
  sun: 'sun',
  graphics: 'graphics',
  timeseries: 'timeseries',
  binance: 'binance',
  stereometry: 'stereometry',
  controls: 'controls',
  retro: 'retro',
  conf: 'conf',
};

function resolveTitle(pathname: string): string | undefined {
  const firstSegment = pathname.split('/')[1] ?? '';
  const key = PATH_SEGMENT_TO_TITLE_KEY[firstSegment];
  return key ? appT.pageTitles[key] : undefined;
}

/**
 * Keeps `document.title` in sync with the current pathname and sets
 * `document.documentElement.lang` from the i18n locale.
 */
export function useDocumentTitle(): void {
  const { pathname } = useLocation();
  const pageTitle = resolveTitle(pathname);

  useEffect(() => {
    document.documentElement.lang = getCurrentLanguage();
  }, []);

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — ${appT.appTitle}` : appT.appTitle;
  }, [pageTitle]);
}
