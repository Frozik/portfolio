import { memo } from 'react';

export const PanelRow = memo(
  ({ label, value }: { readonly label: string; readonly value: string }) => (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-neutral-400">{label}</dt>
      <dd className="text-right break-words">{value}</dd>
    </div>
  )
);
