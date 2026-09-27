import type { IColumnWindow } from '../../extensions/grid-view/column-window';

export interface ISpacerTrack {
  readonly spacer: 'left' | 'right';
  readonly width: number;
}

export type TTrack<TRow> = IColumnWindow<TRow>['columns'][number] | ISpacerTrack;

export function isSpacer<TRow>(track: TTrack<TRow>): track is ISpacerTrack {
  return 'spacer' in track;
}

/** The cells of a row in DOM order; the two spacers stand in for the skipped centre columns. */
export function rowTracks<TRow>(window: IColumnWindow<TRow>): readonly TTrack<TRow>[] {
  const tracks: TTrack<TRow>[] = [];
  const left: ISpacerTrack = { spacer: 'left', width: window.leftSpacer };
  const right: ISpacerTrack = { spacer: 'right', width: window.rightSpacer };
  let leftPlaced = false;
  let rightPlaced = false;
  for (const layout of window.columns) {
    if (layout.section !== 'left' && !leftPlaced) {
      tracks.push(left);
      leftPlaced = true;
    }
    if (layout.section === 'right' && !rightPlaced) {
      tracks.push(right);
      rightPlaced = true;
    }
    tracks.push(layout);
  }
  if (!leftPlaced) {
    tracks.push(left);
  }
  if (!rightPlaced) {
    tracks.push(right);
  }
  return tracks;
}

/** `grid-template-columns` matching `rowTracks`. */
export function gridTemplate<TRow>(window: IColumnWindow<TRow>): string {
  return rowTracks(window)
    .map(track => `${track.width}px`)
    .join(' ');
}
