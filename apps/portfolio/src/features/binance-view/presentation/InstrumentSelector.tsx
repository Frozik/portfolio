import { useFunction } from '@frozik/components/hooks/useFunction';
import { ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Dropdown, DropdownItem } from '../../../shared/ui/Dropdown';
import { useBinanceViewStore } from '../application/useBinanceViewStore';
import { BINANCE_INSTRUMENTS } from '../domain/instruments';

const CHEVRON_SIZE = 12;

export const InstrumentSelector = observer(() => {
  const store = useBinanceViewStore();

  const handleSelect = useFunction((symbol: string) => {
    void store.setInstrument(symbol);
  });

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2 py-0.5 font-mono text-[10px] font-semibold text-text-secondary hover:text-text"
        >
          {store.instrument}
          <ChevronDown size={CHEVRON_SIZE} />
        </button>
      }
    >
      {BINANCE_INSTRUMENTS.map(option => (
        <DropdownItem
          key={option.symbol}
          onSelect={() => handleSelect(option.symbol)}
          className={
            option.symbol === store.instrument
              ? 'font-mono text-xs text-landing-accent'
              : 'font-mono text-xs'
          }
        >
          {option.symbol}
        </DropdownItem>
      ))}
    </Dropdown>
  );
});
