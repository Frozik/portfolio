export enum EFieldType {
  Fixed = 'fixed',
  Guess = 'guess',
}

export enum ECellStatus {
  Unknown = 'unknown',
  Wrong = 'wrong',
}

export interface IFieldCell {
  type: EFieldType;
  value: number | undefined;
  notes: number[];
  status: ECellStatus;
}

export interface IField {
  size: number;
  cells: IFieldCell[];
}

export enum EToolType {
  None = 'none',
  Pen = 'pen',
  Notes = 'notes',
}

export type TTool =
  | { type: EToolType.None; value: undefined }
  | { type: EToolType.Pen | EToolType.Notes; value: number };
