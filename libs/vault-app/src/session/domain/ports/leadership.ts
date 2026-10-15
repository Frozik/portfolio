/**
 * One tab per vault syncs with the cloud: `onLeader` runs once
 * this tab holds the vault's lock (at once, or when the tab holding it
 * closes). Returns the release.
 */
export type TAcquireLeadership = (vaultKey: string, onLeader: () => void) => () => void;
