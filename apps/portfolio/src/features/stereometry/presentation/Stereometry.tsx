import { isNil } from 'lodash-es';
import { memo } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { getPuzzleById } from '../domain/puzzles/registry';
import { StereometrySolver } from './components/StereometrySolver';

export const Stereometry = memo(() => {
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const puzzle = getPuzzleById(puzzleId);

  if (isNil(puzzle)) {
    return <Navigate to="/stereometry" replace />;
  }

  return <StereometrySolver puzzle={puzzle} />;
});
