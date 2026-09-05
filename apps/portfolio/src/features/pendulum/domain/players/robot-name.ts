/** The single source of robot identity; names must be unique across a competition lineage. */
export function createRobotName(): string {
  return crypto.randomUUID();
}
