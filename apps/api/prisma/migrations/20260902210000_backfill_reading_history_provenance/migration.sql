-- Records one canonical reading-history cutover instant for this environment and derives,
-- for every existing user, the first calendar day in their own timezone that is fully covered
-- by the new non-destructive reading-activity write path. Rerunning is a no-op: the insert
-- skips users that already carry a state row, and no existing row is ever refreshed.
INSERT INTO user_reading_history_state (
  user_id,
  activity_reliable_from,
  cycle_history_cutover_at,
  created_at,
  updated_at
)
SELECT
  u.id,
  ((now() AT TIME ZONE COALESCE(s.timezone, 'Europe/Kyiv'))::date + 1),
  now(),
  now(),
  now()
FROM users u
LEFT JOIN user_profile_settings s ON s.user_id = u.id
ON CONFLICT (user_id) DO NOTHING;

-- Conservative legacy reading-cycle backfill. Every book whose mutable progress snapshot still
-- holds a reliable finish date contributes at most one finished cycle, carrying only facts that
-- already exist: the known start date, the known rating, and the book metadata as it stands now.
-- The metadata is marked legacy_current_metadata because nobody can know what it was on the day
-- the book was actually finished, and it is frozen from here on. Erased rereads are not invented.
-- legacy_source_key makes the insert idempotent: a rerun collides and skips.
INSERT INTO book_reading_cycles (
  id,
  user_id,
  book_id,
  state,
  started_at,
  finished_at,
  rating,
  completion_metadata,
  first_completion_reliability,
  legacy_source_key,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  b.user_id,
  p.book_id,
  'finished',
  CASE WHEN p.started_at IS NOT NULL AND p.started_at <= p.finished_at THEN p.started_at END,
  p.finished_at,
  p.rating,
  jsonb_build_object(
    'version', 1,
    'provenance', 'legacy_current_metadata',
    'book', jsonb_build_object(
      'title', b.title,
      'pagesCount', b.pages_count,
      'language', b.language,
      'genres', to_jsonb(b.genres)
    ),
    'authors', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('authorId', a.id, 'name', a.name) ORDER BY ba.position)
        FROM book_authors ba
        JOIN authors a ON a.id = ba.author_id
        WHERE ba.book_id = b.id
      ),
      '[]'::jsonb
    ),
    'publisher', CASE
      WHEN pub.id IS NULL THEN 'null'::jsonb
      ELSE jsonb_build_object('publisherId', pub.id, 'name', pub.name)
    END,
    'series', CASE
      WHEN ser.id IS NULL THEN 'null'::jsonb
      ELSE jsonb_build_object(
        'seriesId', ser.id,
        'name', ser.name,
        'partNumber', b.part_number,
        'status', ser.status,
        'totalBooks', ser.total_books,
        'knownBooksCount', (
          SELECT COUNT(*)::int
          FROM books sib
          WHERE sib.series_id = ser.id
            AND sib.user_id = b.user_id
            AND sib.deleted_at IS NULL
        )
      )
    END
  ),
  'first_known_only',
  'book-reading-progress-snapshot:' || p.book_id::text,
  now(),
  now()
FROM book_reading_progress p
JOIN books b ON b.id = p.book_id
LEFT JOIN publishers pub ON pub.id = b.publisher_id
LEFT JOIN series ser ON ser.id = b.series_id
WHERE p.finished_at IS NOT NULL
ON CONFLICT (legacy_source_key) DO NOTHING;

-- Point every count-based reading goal at the canonical finished cycle that qualified its book,
-- so a later reread cannot silently move or drop an already counted book.
UPDATE reading_goal_books goal_book
SET qualified_reading_cycle_id = (
  SELECT cycle.id
  FROM book_reading_cycles cycle
  JOIN reading_goals goal ON goal.id = goal_book.goal_id
  WHERE cycle.book_id = goal_book.book_id
    AND cycle.user_id = goal.user_id
    AND cycle.state = 'finished'
    AND cycle.finished_at IS NOT NULL
    AND cycle.finished_at >= (goal.created_at AT TIME ZONE 'UTC')::date
    AND cycle.finished_at <= goal.deadline
  ORDER BY cycle.finished_at ASC, cycle.id ASC
  LIMIT 1
)
WHERE goal_book.qualified_finished_at IS NOT NULL
  AND goal_book.qualified_reading_cycle_id IS NULL;
