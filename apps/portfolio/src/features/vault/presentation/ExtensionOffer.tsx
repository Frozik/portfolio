import { memo, useState } from 'react';
import { useLocalStorage } from 'usehooks-ts';

import { isDesktopChromium } from '../../../shared/lib/isDesktopChromium';
import { REPOSITORY_URL } from '../../../shared/lib/repository';
import { Button } from '../../../shared/ui/Button';
import { CardFrame } from '../../../shared/ui/CardFrame';
import { vaultT } from './translations';

const DISMISSED_KEY = 'pwv:extension-offer-dismissed';
const LATEST_RELEASE_URL = `${REPOSITORY_URL}/releases/latest`;

/**
 * Where the Chrome extension comes from and how it goes in: shown only in a
 * browser that takes it, until hidden. It is not in the Chrome Web Store, and
 * Chrome lets no page install an extension, so the page can only point the way.
 */
export const ExtensionOffer = memo(() => {
  const t = vaultT.extension;
  const [supported] = useState(isDesktopChromium);
  const [dismissed, setDismissed] = useLocalStorage(DISMISSED_KEY, false);
  if (!supported || dismissed) {
    return null;
  }
  return (
    <CardFrame className="flex flex-col gap-3 p-6">
      <h2 className="text-[16px] font-medium text-landing-fg">{t.title}</h2>
      <p className="text-[13px] text-landing-fg-dim">{t.text}</p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] text-landing-fg-dim">
        <li>
          {t.downloadStep.before}
          <a
            href={LATEST_RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-landing-fg underline"
          >
            {t.downloadStep.link}
          </a>
          {t.downloadStep.after}
        </li>
        {t.steps.map(step => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={LATEST_RELEASE_URL} target="_blank" rel="noreferrer">
            {t.download}
          </a>
        </Button>
        <Button type="button" variant="ghost" onClick={() => setDismissed(true)}>
          {t.dismiss}
        </Button>
      </div>
    </CardFrame>
  );
});
