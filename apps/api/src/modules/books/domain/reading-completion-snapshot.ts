import type { Nullable, ValueOf } from "@app/shared";

import { BookLanguageSchema } from "@app/shared";
import { z } from "zod";

import { READING_CYCLE_METADATA_PROVENANCE } from "./reading-cycle.js";

export type ReadingCompletionMetadataProvenance = ValueOf<typeof READING_CYCLE_METADATA_PROVENANCE>;

export type ReadingCompletionSnapshotSource = {
  authors: { author: { id: string; name: string } }[];
  genres: string[];
  language: string;
  pagesCount: Nullable<number>;
  partNumber: Nullable<number>;
  publisher: Nullable<{ id: string; name: string }>;
  series: Nullable<{ id: string; name: string; status: string; totalBooks: Nullable<number> }>;
  title: string;
};

export const READING_COMPLETION_SNAPSHOT_VERSION = 1;

export const ReadingCompletionSnapshotSchema = z.object({
  authors: z.array(z.object({ authorId: z.uuid(), name: z.string() })),
  book: z.object({
    genres: z.array(z.string()),
    language: BookLanguageSchema.nullable(),
    pagesCount: z.number().int().nonnegative().nullable(),
    title: z.string(),
  }),
  provenance: z.enum([
    READING_CYCLE_METADATA_PROVENANCE.trackedAtCompletion,
    READING_CYCLE_METADATA_PROVENANCE.legacyCurrentMetadata,
  ]),
  publisher: z.object({ name: z.string(), publisherId: z.uuid() }).nullable(),
  series: z
    .object({
      knownBooksCount: z.number().int().nonnegative(),
      name: z.string(),
      partNumber: z.number().int().nullable(),
      seriesId: z.uuid(),
      status: z.string(),
      totalBooks: z.number().int().nullable(),
    })
    .nullable(),
  version: z.literal(READING_COMPLETION_SNAPSHOT_VERSION),
});

export type ReadingCompletionSnapshot = z.infer<typeof ReadingCompletionSnapshotSchema>;

export function buildReadingCompletionSnapshot({
  provenance,
  seriesKnownBooksCount,
  source,
}: {
  provenance: ReadingCompletionMetadataProvenance;
  seriesKnownBooksCount: number;
  source: ReadingCompletionSnapshotSource;
}): ReadingCompletionSnapshot {
  const language = BookLanguageSchema.safeParse(source.language);

  return {
    authors: source.authors.map(({ author }) => ({ authorId: author.id, name: author.name })),
    book: {
      genres: source.genres,
      language: language.success ? language.data : null,
      pagesCount: source.pagesCount,
      title: source.title,
    },
    provenance,
    publisher:
      source.publisher === null
        ? null
        : { name: source.publisher.name, publisherId: source.publisher.id },
    series:
      source.series === null
        ? null
        : {
            knownBooksCount: seriesKnownBooksCount,
            name: source.series.name,
            partNumber: source.partNumber,
            seriesId: source.series.id,
            status: source.series.status,
            totalBooks: source.series.totalBooks,
          },
    version: READING_COMPLETION_SNAPSHOT_VERSION,
  };
}

export function parseReadingCompletionSnapshot(
  value: unknown,
): Nullable<ReadingCompletionSnapshot> {
  const parsed = ReadingCompletionSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
