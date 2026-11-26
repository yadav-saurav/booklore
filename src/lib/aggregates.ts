import { db, type Db } from "@/db";

/**
 * Cached aggregates on `books`. Call recomputeBook() after any rating/review/shelf write;
 * recomputeRankings() refreshes the charts (seed, or the throttled maybeRefreshRankings()).
 *
 * Weighted score is IMDb's published Bayesian formula:
 *   WR = (v / (v + m)) · R + (m / (v + m)) · C
 * v = votes for the book, R = its mean, m = minimum votes to be listed, C = mean across the catalog.
 */
export const TOP_MIN_VOTES = 25;

async function globalMean(d: Db = db): Promise<number> {
  const r = await d.get<{ m: number | null }>(`SELECT avg(score) m FROM ratings`);
  return r?.m ?? 7;
}

export async function recomputeBook(bookId: string, d: Db = db) {
  const C = await globalMean(d);
  await d.run(
    `UPDATE books SET
       rating_avg = s.r, rating_count = s.v, review_count = s.rv, shelf_count = s.sh,
       weighted_score = CASE WHEN s.v > 0 THEN (s.v::float8 / (s.v + ?)) * s.ravg + (?::float8 / (s.v + ?)) * ? END
     FROM (SELECT
       (SELECT round(avg(score)::numeric, 1) FROM ratings WHERE book_id = ?) r,
       (SELECT avg(score) FROM ratings WHERE book_id = ?) ravg,
       (SELECT count(*) FROM ratings WHERE book_id = ?) v,
       (SELECT count(*) FROM reviews WHERE book_id = ?) rv,
       (SELECT count(*) FROM shelf WHERE book_id = ? AND status = 'want') sh) s
     WHERE books.id = ?`,
    TOP_MIN_VOTES, TOP_MIN_VOTES, TOP_MIN_VOTES, C, bookId, bookId, bookId, bookId, bookId, bookId,
  );
}

/**
 * BookMeter popularity: recent activity over the last 7 days (views, ratings, reviews, shelf adds)
 * plus a small long-term prior (Open Library want-to-read counts) so the chart is never empty.
 */
export async function recomputeRankings(d: Db = db) {
  const C = await globalMean(d);
  const m = TOP_MIN_VOTES;
  await d.tx(async (t) => {
    await t.run(
      `WITH s AS (
         SELECT b.id,
           (SELECT avg(score) FROM ratings r WHERE r.book_id = b.id) ravg,
           (SELECT count(*) FROM ratings r WHERE r.book_id = b.id) v,
           (SELECT count(*) FROM reviews r WHERE r.book_id = b.id) rv,
           (SELECT count(*) FROM shelf s WHERE s.book_id = b.id AND s.status = 'want') sh
         FROM books b)
       UPDATE books SET rating_avg = round(s.ravg::numeric, 1), rating_count = s.v, review_count = s.rv, shelf_count = s.sh,
         weighted_score = CASE WHEN s.v > 0 THEN (s.v::float8 / (s.v + ?)) * s.ravg + (?::float8 / (s.v + ?)) * ? END
       FROM s WHERE s.id = books.id`,
      m, m, m, C,
    );
    await t.exec(`
      UPDATE books SET popularity_score =
          coalesce((SELECT sum(count) FROM book_views v WHERE v.book_id = books.id AND v.day >= current_date - 7), 0) * 1.0
        + coalesce((SELECT count(*) FROM ratings r WHERE r.book_id = books.id AND r.created_at >= unixepoch() - 7*86400), 0) * 6.0
        + coalesce((SELECT count(*) FROM reviews r WHERE r.book_id = books.id AND r.created_at >= unixepoch() - 7*86400), 0) * 10.0
        + coalesce((SELECT count(*) FROM shelf s WHERE s.book_id = books.id AND s.added_at >= unixepoch() - 7*86400), 0) * 4.0
        + ln(1 + ol_want_to_read) * 3.0
        + ln(1 + rating_count) * 2.0;
      UPDATE books SET prev_popularity_rank = popularity_rank;
      UPDATE books SET popularity_rank = x.rnk
        FROM (SELECT id, row_number() OVER (ORDER BY popularity_score DESC, id) rnk FROM books) x WHERE x.id = books.id;
      UPDATE authors SET popularity = coalesce((
        SELECT sum(b.popularity_score) FROM book_authors ba JOIN books b ON b.id = ba.book_id WHERE ba.author_id = authors.id), 0);
    `);
    await t.run(
      `INSERT INTO api_cache (key, value, expires_at) VALUES ('rankings:at', ?, 0)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      String(Date.now()),
    );
  });
}

let refreshing: Promise<void> | null = null;
/** Recompute the charts at most once an hour – cheap enough to call from page renders. */
export async function maybeRefreshRankings() {
  const r = await db.get<{ value: string }>(`SELECT value FROM api_cache WHERE key = 'rankings:at'`);
  if (r && Date.now() - Number(r.value) < 3600_000) return;
  refreshing ??= recomputeRankings().finally(() => { refreshing = null; });
  await refreshing;
}

export async function recordView(bookId: string) {
  await db.run(
    `INSERT INTO book_views (book_id, day, count) VALUES (?, current_date, 1)
     ON CONFLICT (book_id, day) DO UPDATE SET count = book_views.count + 1`,
    bookId,
  );
}
