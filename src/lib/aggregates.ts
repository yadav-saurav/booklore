import { sqlite } from "@/db";

/**
 * Cached aggregates on `books`. Call recomputeBook() after any rating/review/shelf write,
 * and recomputeRankings() periodically (seed, or the cheap throttled call in maybeRefreshRankings).
 *
 * Weighted score is IMDb's published Bayesian formula:
 *   WR = (v / (v + m)) · R + (m / (v + m)) · C
 * v = votes for the book, R = its mean, m = minimum votes to be listed, C = mean across the catalog.
 */
export const TOP_MIN_VOTES = 25;

function globalMean(): number {
  const r = sqlite.prepare(`SELECT avg(score) m FROM ratings`).get() as { m: number | null };
  return r.m ?? 7;
}

export function recomputeBook(bookId: string, C = globalMean()) {
  const r = sqlite.prepare(`SELECT count(*) v, avg(score) R FROM ratings WHERE book_id = ?`).get(bookId) as { v: number; R: number | null };
  const reviews = (sqlite.prepare(`SELECT count(*) n FROM reviews WHERE book_id = ?`).get(bookId) as { n: number }).n;
  const shelfN = (sqlite.prepare(`SELECT count(*) n FROM shelf WHERE book_id = ? AND status = 'want'`).get(bookId) as { n: number }).n;
  const m = TOP_MIN_VOTES;
  const wr = r.v ? (r.v / (r.v + m)) * r.R! + (m / (r.v + m)) * C : null;
  sqlite
    .prepare(`UPDATE books SET rating_avg = ?, rating_count = ?, weighted_score = ?, review_count = ?, shelf_count = ? WHERE id = ?`)
    .run(r.R == null ? null : Math.round(r.R * 10) / 10, r.v, wr, reviews, shelfN, bookId);
}

/**
 * BookMeter popularity: recent activity over the last 7 days (views, ratings, reviews, shelf adds)
 * plus a small long-term prior (Open Library want-to-read counts) so the chart is never empty.
 */
export function recomputeRankings() {
  const C = globalMean();
  const ids = sqlite.prepare(`SELECT id FROM books`).all() as { id: string }[];
  const tx = sqlite.transaction(() => {
    for (const { id } of ids) recomputeBook(id, C);
    sqlite.exec(`
      UPDATE books SET popularity_score = (
        coalesce((SELECT sum(count) FROM book_views v WHERE v.book_id = books.id AND v.day >= date('now','-7 days')), 0) * 1.0
        + coalesce((SELECT count(*) FROM ratings r WHERE r.book_id = books.id AND r.created_at >= unixepoch() - 7*86400), 0) * 6.0
        + coalesce((SELECT count(*) FROM reviews r WHERE r.book_id = books.id AND r.created_at >= unixepoch() - 7*86400), 0) * 10.0
        + coalesce((SELECT count(*) FROM shelf s WHERE s.book_id = books.id AND s.added_at >= unixepoch() - 7*86400), 0) * 4.0
        + ln(1 + ol_want_to_read) * 3.0
        + ln(1 + rating_count) * 2.0
      );
      UPDATE books SET prev_popularity_rank = popularity_rank;
      UPDATE books SET popularity_rank = (
        SELECT rnk FROM (SELECT id, row_number() OVER (ORDER BY popularity_score DESC, id) rnk FROM books) x WHERE x.id = books.id
      );
      UPDATE authors SET popularity = coalesce((
        SELECT sum(b.popularity_score) FROM book_authors ba JOIN books b ON b.id = ba.book_id WHERE ba.author_id = authors.id
      ), 0);
    `);
    sqlite.prepare(`INSERT INTO api_cache (key, value, expires_at) VALUES ('rankings:at', ?, 0)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(Date.now()));
  });
  tx();
}

/** Recompute the charts at most once an hour – cheap enough to call from page renders. */
export function maybeRefreshRankings() {
  const r = sqlite.prepare(`SELECT value FROM api_cache WHERE key = 'rankings:at'`).get() as { value: string } | undefined;
  if (!r || Date.now() - Number(r.value) > 3600_000) recomputeRankings();
}

export function recordView(bookId: string) {
  sqlite
    .prepare(`INSERT INTO book_views (book_id, day, count) VALUES (?, date('now'), 1)
      ON CONFLICT(book_id, day) DO UPDATE SET count = count + 1`)
    .run(bookId);
}
