import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = sql`(unixepoch())`;

/* ───────────── Catalog ───────────── */

export const authors = sqliteTable("authors", {
  id: text("id").primaryKey(), // url slug
  olKey: text("ol_key").unique(), // e.g. OL23919A
  name: text("name").notNull(),
  birthDate: text("birth_date"),
  deathDate: text("death_date"),
  photoId: integer("photo_id"), // Open Library author photo id
  photoUrl: text("photo_url"), // for non-OL sources
  bio: text("bio"),
  nationality: text("nationality"),
  source: text("source").notNull().default("seed"), // seed | openlibrary | google | user
  // cached aggregates
  popularity: real("popularity").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now),
});

export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(), // url slug
    olWorkKey: text("ol_work_key").unique(), // e.g. OL45883W
    googleId: text("google_id").unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    firstPublishYear: integer("first_publish_year"),
    coverId: integer("cover_id"), // Open Library cover id
    coverUrl: text("cover_url"), // for non-OL sources
    isbn13: text("isbn13"),
    pages: integer("pages"),
    publisher: text("publisher"),
    language: text("language"),
    synopsis: text("synopsis"),
    subjects: text("subjects", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    source: text("source").notNull().default("seed"),
    // external priors (used to seed popularity)
    olRatingAvg: real("ol_rating_avg"),
    olRatingCount: integer("ol_rating_count").notNull().default(0),
    olWantToRead: integer("ol_want_to_read").notNull().default(0),
    // cached aggregates – maintained by src/lib/aggregates.ts
    ratingAvg: real("rating_avg"), // 1–10
    ratingCount: integer("rating_count").notNull().default(0),
    weightedScore: real("weighted_score"), // Bayesian, for Top 250
    reviewCount: integer("review_count").notNull().default(0),
    shelfCount: integer("shelf_count").notNull().default(0), // want-to-read adds
    popularityScore: real("popularity_score").notNull().default(0),
    popularityRank: integer("popularity_rank"),
    prevPopularityRank: integer("prev_popularity_rank"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("books_year_idx").on(t.firstPublishYear),
    index("books_pop_idx").on(t.popularityRank),
    index("books_weighted_idx").on(t.weightedScore),
  ],
);

export const bookAuthors = sqliteTable(
  "book_authors",
  {
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => authors.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.authorId] }), index("ba_author_idx").on(t.authorId)],
);

export const genres = sqliteTable("genres", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  kanji: text("kanji"), // decorative label used in the archive aesthetic
  position: integer("position").notNull().default(0),
});

export const bookGenres = sqliteTable(
  "book_genres",
  {
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    genreSlug: text("genre_slug").notNull().references(() => genres.slug, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.genreSlug] }), index("bg_genre_idx").on(t.genreSlug)],
);

/* ───────────── People ───────────── */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  bio: text("bio").notNull().default(""),
  location: text("location"),
  avatarHue: integer("avatar_hue").notNull().default(220),
  isMock: integer("is_mock", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(now),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
});

export const follows = sqliteTable(
  "follows",
  {
    followerId: integer("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followeeId: integer("followee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] })],
);

/* ───────────── Engagement ───────────── */

export const ratings = sqliteTable(
  "ratings",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    score: integer("score").notNull(), // 1–10
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] }), index("ratings_book_idx").on(t.bookId), index("ratings_created_idx").on(t.createdAt)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    headline: text("headline").notNull(),
    body: text("body").notNull(),
    spoiler: integer("spoiler", { mode: "boolean" }).notNull().default(false),
    helpfulCount: integer("helpful_count").notNull().default(0),
    unhelpfulCount: integer("unhelpful_count").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("reviews_user_book").on(t.userId, t.bookId), index("reviews_book_idx").on(t.bookId)],
);

export const reviewVotes = sqliteTable(
  "review_votes",
  {
    reviewId: integer("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    helpful: integer("helpful", { mode: "boolean" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.reviewId, t.userId] })],
);

export const reviewReports = sqliteTable("review_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reviewId: integer("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: integer("created_at").notNull().default(now),
});

/** Reading status – "want" is BOOKLORE's equivalent of IMDb's Watchlist. */
export const shelf = sqliteTable(
  "shelf",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["want", "reading", "read"] }).notNull(),
    progress: integer("progress"), // pages read
    addedAt: integer("added_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] }), index("shelf_book_idx").on(t.bookId)],
);

export const lists = sqliteTable("lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
  likeCount: integer("like_count").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const listItems = sqliteTable(
  "list_items",
  {
    listId: integer("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.listId, t.bookId] }), index("li_book_idx").on(t.bookId)],
);

export const listLikes = sqliteTable(
  "list_likes",
  {
    listId: integer("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.listId, t.userId] })],
);

/** Daily page views – feeds the BookMeter popularity score. */
export const bookViews = sqliteTable(
  "book_views",
  {
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYY-MM-DD
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.day] })],
);

/** Key/value cache for external API responses. */
export const apiCache = sqliteTable("api_cache", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export type Book = typeof books.$inferSelect;
export type Author = typeof authors.$inferSelect;
export type User = typeof users.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type List = typeof lists.$inferSelect;
export type ShelfStatus = "want" | "reading" | "read";
