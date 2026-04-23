import { useEffect } from 'react';
import { useMatches } from 'react-router-dom';

import { getCurrentLanguage } from '../../shared/i18n';
import { appT } from '../translations';

interface IRouteHandle {
  readonly title?: string;
}

/**
 * Keeps `document.title` in sync with the deepest matched route's `handle.title`
 * and sets `document.documentElement.lang` from the current i18n locale.
 *
 * Used by the layout components (LandingLayout / InnerLayout) so that both
 * branches share identical title/lang behavior — previously lived in Root.tsx.
 */
export function useDocumentTitle(): void {
  const matches = useMatches();
  const lastMatch = matches[matches.length - 1];
  const pageTitle = (lastMatch?.handle as IRouteHandle | undefined)?.title;

  useEffect(() => {
    document.documentElement.lang = getCurrentLanguage();
  }, []);

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — ${appT.appTitle}` : appT.appTitle;
  }, [pageTitle]);
}
