/** The campaign's best score is the one thing that survives a reload. */
export interface IBestScoreStorage {
  read(): number;
  write(score: number): void;
}
