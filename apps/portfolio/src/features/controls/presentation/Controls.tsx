import { memo } from 'react';

import { DatePage } from './components/DatePage';
import { NumberPage } from './components/NumberPage';

export const Controls = memo(() => {
  return (
    <div className="h-full w-full md:pb-20">
      <NumberPage />
      <DatePage />
    </div>
  );
});
