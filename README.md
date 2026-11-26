# BOOKLORE

A book discovery and recommendation platform. It follows IMDb's information architecture (charts, title pages, ratings, reviews, author pages, lists and a watchlist) and uses a "curved shelf archive" visual design.

## Quick start
```bash
npm install
npm run db:seed      # builds data/booklore.db: 227 books, 206 authors, sample community
npm run dev          # http://localhost:3000
```
- Demo account: **demo@booklore.app / booklore123**. Or register a new account.
- Behind an HTTPS proxy, start Node with `NODE_USE_ENV_PROXY=1` so live Open Library and Google Books calls go through it.

Production: `npm run build && npm start`. Optional environment variables:

| Variable | Purpose |
|---|---|
| `DATABASE_PATH` | SQLite file location (default `data/booklore.db`) |
| `GOOGLE_BOOKS_API_KEY` | Higher free Google Books quota. Keyless works at low volume. |
| `BOOKLORE_DISABLE_OPENLIBRARY=1`, `BOOKLORE_DISABLE_GOOGLE=1` | Turn a source off |

## Features
- **Homepage:** an interactive 3D curved shelf. Drag, scroll, use the arrow keys or click the timeline. Clicking the centre book opens a detail sheet. Below the hero are rails: personalised picks, your Reading List, fan favorites, trending, new books, genres, authors born today, featured lists, latest reviews and a Top 250 preview.
- **Book pages:** rating cluster (BOOKLORE rating, your rating, BookMeter rank), Reading List states, add-to-list, top reviews, "More like this", author details, ratings breakdown, and lists containing the book.
  - Reviews page: sort, filter, spoiler handling, helpful votes and reports.
  - Ratings histogram page.
- **Charts:**
  - Top 250: IMDb's Bayesian weighted rating, minimum 25 votes.
  - BookMeter: popularity from 7 days of views, ratings, reviews and shelf adds, with movement arrows.
  - New & Notable.
- **Search:** typeahead, find results (local catalog plus live Open Library, Google Books and ISBN), and advanced search with every filter in the URL.
- **Authors and genres:** author pages (bio and photo filled in from Open Library, bibliography, more works), popular authors, born today, a genre index and genre browse.
- **Personal:** Reading List (want, reading or read, with progress), Your Ratings, profiles with follows, public and private lists, and recommendations with onboarding.
- **Recommendations:** a hybrid model combining item–item collaborative filtering (adjusted cosine with shrinkage) and content similarity (genres, subject TF-IDF, author, era), diversified with MMR and explained with reasons.
- **Community:** latest reviews and top reviewers.

## Adding your own books
- **From the interface:** search any title. Opening an Open Library or Google Books result imports it into the catalog.
- **In bulk:** add entries to `scripts/seed-data/books-input.json`, then:
  - run `NODE_USE_ENV_PROXY=1 node scripts/seed-data/fetch-catalog.mjs`
  - run `node scripts/seed-data/build-catalog.mjs` (books need a synopsis in `data/seed/synopses.json`)
  - run `npm run db:seed`
- **New data source:** implement `BookProvider` in `src/lib/providers/` and register it in `registry.ts`.

## Development
- `npm run typecheck` and `npm test` (vitest: recommender math, the advanced search query builder, birth-date parsing).
- Architecture, data model and conventions are described in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Notes
Book metadata and covers come from Open Library, with Google Books as an optional second source. Synopses and author bios in the seed are original summaries. All users, ratings, reviews and lists in the seed are generated sample data.
