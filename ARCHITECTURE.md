# BOOKLORE: architecture and contracts

BOOKLORE is a book discovery platform modelled on IMDb's information architecture: charts, title pages, ratings, reviews, people pages, lists and a watchlist. Its visual language comes from the "curved VHS archive" reference: warm paper, ink, cobalt and halftone kanji, with mask, clip and scale reveals instead of opacity fades.

## Stack
- **Next.js 16 (App Router, React 19, TypeScript)**. Server Components by default; client components only for interaction.
  - Next 16 has breaking changes versus older docs: `params`/`searchParams` are Promises (`const { id } = await params`).
  - When unsure, read `node_modules/next/dist/docs/`.
- **Tailwind CSS v4**. Design tokens live in `src/app/globals.css` (`@theme inline`). Use the tokens (`bg-paper`, `text-cobalt`, `border-hair`, …), never raw hex values.
- **Postgres**, provider-agnostic (Neon, Supabase, Render, any 14+), via a small async layer in `src/db/index.ts`: `db.all/get/run/exec/tx` with `?` placeholders and camelCase aliases auto-quoted. It uses postgres.js when `DATABASE_URL` is set and embedded **PGlite** otherwise. Migrations (`src/db/migrations.ts`) apply automatically on first connection. Search uses a weighted `tsvector` in `books_search`. Row types live in `src/db/schema.ts`. Dialect notes: `scripts/pg-migration.md`.
- **Auth:** scrypt password hashes plus a DB session cookie (`src/lib/auth.ts`). `getCurrentUser()` is memoised per request.
- **Providers:** `src/lib/providers/*`. `BookProvider` interface; Open Library is primary, Google Books secondary. Responses are cached in `api_cache`. To add a source, write one file and register it in `registry.ts`.

## Running
```
npm run db:seed                       # wipe + reseed from data/seed/*.json (db:prepare = only if empty)
NODE_USE_ENV_PROXY=1 npm run dev      # NODE_USE_ENV_PROXY only needed behind an HTTPS proxy
```
Demo login: `demo@booklore.app` / `booklore123`.

## Data model (see schema.ts)
- `books` (slug id) ↔ `book_authors` ↔ `authors`; `book_genres` → `genres` (23 fixed slugs).
- Engagement:
  - `ratings` (1–10, one per user and book)
  - `reviews` (one per user and book; helpful/unhelpful counts; `review_votes`, `review_reports`)
  - `shelf` (status `want` | `reading` | `read`; "want" is the Watchlist equivalent, shown as **Reading List**)
  - `lists` + `list_items` + `list_likes`
  - `follows`
  - `book_views` (daily counts)
- Cached aggregates on `books`: `rating_avg`, `rating_count`, `weighted_score` (IMDb Bayesian formula, m=25), `review_count`, `shelf_count`, `popularity_score`/`popularity_rank`/`prev_popularity_rank` (BookMeter). After writes, call `recomputeBook(id)`; `maybeRefreshRankings()` refreshes the charts at most once an hour.

## External books
- External results use the id `<source>:<externalId>`, e.g. `openlibrary:OL45883W`.
- They link to `/book/<encodeURIComponent(ref)>`. The book page calls `resolveExternalRef()` (src/lib/catalog.ts), which imports the book into the database and then `redirect()`s to the local slug.

## Shared building blocks (reuse; do not fork)
| Need | Use |
|---|---|
| Card data | `BookCard` type, `CARD_COLUMNS`, `queryCards()`, `getCardsByIds()`, `getUserStates()` in `src/lib/queries/books.ts` |
| Cover | `<BookCover book size>` (falls back to `<GeneratedCover>`) |
| Poster card / row | `<BookCard book state rank>`, `<BookRow>` in `components/book/BookCard.tsx` |
| Ratings UI | `<RatingInline>`, `<StarIcon>`, `<RankDelta>`, `<RateButton>` |
| Reading list ribbon | `<ShelfRibbon>`; server actions `rateBook`, `setShelf` in `app/actions/engagement.ts` |
| Auth-gated client action | `useAuthAction()` (redirects to /signin?next=…) |
| Rails / headings | `<Rail label>`, `<SectionHeader title href subtitle count kanji>`, `<Section>` |
| Avatar | `<Avatar name hue size>` |
| Search | `searchLocalBooks`, `searchLocalAuthors` (src/lib/search.ts); `searchExternal` (providers/registry) |
| Recommendations | `getRecommendationsForUser`, `getSimilarBooks`, `getBecauseYouRated` (src/lib/recommend.ts) |
| Formatting | `compact`, `fmtRating`, `plural`, `timeAgo`, `fmtDate`, `slugify` (src/lib/util.ts) |

CSS primitives in globals.css: `.page` (1280px container), `.lbl`, `.box`, `.sec-title`, `.btn` (`-primary`, `-outline`, `-ghost`, `-sm`), `.field`, `.chip[data-active]`, `.mask`, `.rail`, `.prose-serif`, `.skeleton`, `.rise`.

## Route map
| Route | Purpose (IMDb analogue) |
|---|---|
| `/` | Curved-shelf hero, then IMDb home rails |
| `/book/[id]` | Title page; `/reviews`, `/ratings` subpages |
| `/author/[id]`, `/authors` | Name pages, popular authors, born today |
| `/genres`, `/genre/[slug]` | Genre index and genre browse |
| `/chart/top`, `/chart/bookmeter`, `/chart/new` | Top 250, MOVIEmeter → BookMeter, new releases |
| `/search`, `/search/advanced` | Find results and advanced title search |
| `/recommendations` | Personalised picks and onboarding |
| `/readinglist`, `/you/ratings` | Watchlist and your ratings |
| `/user/[username]`, `/user/[username]/lists` | Profile |
| `/lists`, `/list/[id]`, `/list/new`, `/list/[id]/edit` | User lists |
| `/reviews`, `/community` | Latest reviews, top reviewers |
| `/signin`, `/register`, `/settings`, `/about` | Account |

## Design rules
- Paper background, ink text, cobalt for interactive elements; the gold `text-star` is used only for rating stars.
- Section headings use `.sec-title` (cobalt bar). Small caps labels use `.lbl`. Use Japanese kanji only as decorative accents (`font-jp`).
- No opacity fade-ins for content reveals: use mask slides (`.mask` + `.rise`), clip-path wipes, or scale.
- Mobile first. No horizontal page scroll at 375px. Rails scroll horizontally.
- Accessibility: real buttons and links, `aria-label` on icon buttons, visible focus rings, respect `prefers-reduced-motion`.
