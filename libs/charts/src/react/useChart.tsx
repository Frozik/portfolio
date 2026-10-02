import { useState } from 'react';

/**
 * One chart model for the life of the component. A model off the stage holds
 * no subscriptions and no requests, so there is nothing to dispose of when
 * the component goes: it is collected with it.
 */
export function useChart<TChart>(create: () => TChart): TChart {
  const [chart] = useState(create);
  return chart;
}
