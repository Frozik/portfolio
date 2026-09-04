import { useFunction } from '@frozik/components/hooks/useFunction';
import { ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Dropdown, DropdownItem } from '../../../shared/ui/Dropdown';
import { useBinanceViewStore } from '../application/useBinanceViewStore';
import type { InstrumentSymbol } from '../domain/instruments';
import { CURATED_INSTRUMENTS } from '../domain/instruments';

import { instrumentRoute } from './instrument-route';

const CHEVRON_SIZE = 12;

const InstrumentOption = memo(
  ({
    symbol,
    isSelected,
    onSelect,
  }: {
    readonly symbol: InstrumentSymbol;
    readonly isSelected: boolean;
    readonly onSelect: (symbol: InstrumentSymbol) => void;
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
  const navigate = useNavigate();

  const handleSelect = useFunction((symbol: InstrumentSymbol) => {
    void navigate(instrumentRoute(symbol));
  });

  const symbols = CURATED_INSTRUMENTS.some(option => option.symbol === store.instrument)
    ? CURATED_INSTRUMENTS.map(option => option.symbol)
    : [store.instrument, ...CURATED_INSTRUMENTS.map(option => option.symbol)];

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
      {symbols.map(symbol => (
        <InstrumentOption
          key={symbol}
          symbol={symbol}
          isSelected={symbol === store.instrument}
          onSelect={handleSelect}
        />
      ))}
    </Dropdown>
  );
});
