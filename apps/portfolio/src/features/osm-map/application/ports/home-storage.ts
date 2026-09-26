import type { LonLat } from '../../domain/mercator';

/** Where the map last found the user, kept between visits so the next one opens there at once. */
export interface HomeStorage {
  read(): LonLat | undefined;
  write(position: LonLat): void;
}
