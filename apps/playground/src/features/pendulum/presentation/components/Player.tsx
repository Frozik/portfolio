import { useFunction } from '@frozik/components';
import { memo } from 'react';

import { Badge, Button } from '../../../../shared/ui';

export const Player = memo(
  ({
    className,
    name,
    modelUrl,
    score,
    onSelect,
  }: {
    className?: string;
    name: string;
    modelUrl: string;
    score: number;
    onSelect?: (name: string, modelUrl: string) => void;
  }) => {
    const handleClick = useFunction(() => onSelect?.(name, modelUrl));

    return (
      <Button className={className} variant="secondary" onClick={handleClick}>
        <Badge count={Number(score.toFixed(0))}>{name}</Badge>
      </Button>
    );
  }
);
