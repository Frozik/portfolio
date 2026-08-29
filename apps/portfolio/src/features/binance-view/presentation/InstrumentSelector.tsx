import { useFunction } from '@frozik/components/hooks/useFunction';
import { ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Dropdown, DropdownItem } from '../../../shared/ui/Dropdown';
import { useBinanceViewStore } from '../application/useBinanceViewStore';
import { BINANCE_INSTRUMENTS } from '../domain/instruments';

const CHEVRON_SIZE = 12;

const InstrumentOption = memo(
  ({
    symbol,
    isSelected,
    onSelect,
  }: {
    readonly symbol: string;
    readonly isSelected: boolean;
    readonly onSelect: (symbol: string) => void;
  }) => {
    const handleSelect = useFunction(() => {
      onSelect(symbol);
    });

    return (
      <DropdownItem
        onSelect={handleSelect}
        className={isSelected ? 'font-mono text-xs text-landing-accent' : 'font-mono text-xs'}
      >
        {symbol}
      </DropdownItem>
    );
  }
);

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
        <InstrumentOption
          key={option.symbol}
          symbol={option.symbol}
          isSelected={option.symbol === store.instrument}
          onSelect={handleSelect}
        />
      ))}
    </Dropdown>
  );
});
