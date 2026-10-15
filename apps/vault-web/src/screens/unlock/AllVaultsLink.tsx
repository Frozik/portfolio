import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { vaultT } from '@frozik/vault-react/texts/vault';
import { paths } from '../paths';

const ICON_SIZE = 18;

/** From a locked vault back to every vault this device knows. */
export function AllVaultsLink() {
  return (
    <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <Link
        to={paths.start()}
        data-testid="all-vaults"
        className="inline-flex min-h-11 items-center gap-1 text-[15px] text-fg-dim no-underline hover:text-fg"
      >
        <ChevronLeft size={ICON_SIZE} aria-hidden />
        {vaultT.phone.allVaults}
      </Link>
    </div>
  );
}
