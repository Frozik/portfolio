import { cn } from '@frozik/components/components/cn';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { Spinner } from './Spinner';

function ListInner<T>({
  dataSource,
  renderItem,
  rowKey,
  loading = false,
  className,
}: {
  dataSource: T[];
  renderItem: (item: T, index: number) => ReactNode;
  rowKey?: (item: T, index: number) => string | number;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <ul className={cn('divide-y divide-border', className)}>
      {dataSource.map((item, index) => (
        <li
          key={rowKey ? rowKey(item, index) : String(index)}
          className="py-3 first:pt-0 last:pb-0"
        >
          {renderItem(item, index)}
        </li>
      ))}
    </ul>
  );
}

export const List = memo(ListInner) as typeof ListInner;
