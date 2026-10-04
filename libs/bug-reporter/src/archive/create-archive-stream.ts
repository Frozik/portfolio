import { makeZip } from 'client-zip';

import { layoutArchive } from '../core/archive-layout';
import type { TArchiveBuilder } from '../core/ports';

/**
 * The report as a zip stream. Entries are stored, not deflated: the video and
 * PNGs are already compressed and the text is small, so the archive can flow
 * straight to disk without buffering.
 */
export const createArchiveStream: TArchiveBuilder = report =>
  makeZip(
    layoutArchive(report).map(entry => ({
      name: entry.name,
      input: entry.data,
      lastModified: report.createdAt,
    })),
    { buffersAreUTF8: true }
  );
