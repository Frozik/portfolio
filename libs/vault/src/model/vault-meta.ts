/**
 * What the vault keeps for itself and never shows: work done once, so neither this device nor
 * another does it again. Each section is a cache — losing it costs a recount, never data.
 */
export interface IVaultMeta {
  /**
   * Password strength scores (0–4) by the meter that gave them, then by the password's SHA-256
   * in hex: a meter with other dictionaries or rules keeps a section of its own, and a password
   * gone from every card leaves no trace once the next scores are written.
   */
  readonly strength: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

export const EMPTY_VAULT_META: IVaultMeta = { strength: new Map() };

/**
 * The meter's new scores in, and every section cut down to the passwords the vault still holds:
 * the cache never outgrows the vault, nor remembers a password that was replaced.
 */
export function withStrengthScores(
  meta: IVaultMeta,
  meter: string,
  scores: ReadonlyMap<string, number>,
  held: ReadonlySet<string>
): IVaultMeta {
  const strength = new Map<string, ReadonlyMap<string, number>>();
  for (const [name, section] of meta.strength) {
    strength.set(name, new Map([...section].filter(([hash]) => held.has(hash))));
  }
  const own = new Map(strength.get(meter) ?? []);
  for (const [hash, score] of scores) {
    if (held.has(hash)) {
      own.set(hash, score);
    }
  }
  strength.set(meter, own);
  return {
    strength: new Map([...strength].filter(([, section]) => section.size > 0)),
  };
}

/** Both devices' scores: one meter gives one password one score, so a union never conflicts. */
export function mergeVaultMeta(local: IVaultMeta, remote: IVaultMeta): IVaultMeta {
  const strength = new Map<string, ReadonlyMap<string, number>>(remote.strength);
  for (const [meter, section] of local.strength) {
    strength.set(meter, new Map([...(remote.strength.get(meter) ?? []), ...section]));
  }
  return { strength };
}
