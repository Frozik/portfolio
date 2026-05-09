export interface IVerifierHealth {
  getJwksFetchHealth(): {
    lastSuccessAtMs: number | null;
    lastFailureAtMs: number | null;
    consecutiveFailures: number;
  };
}
