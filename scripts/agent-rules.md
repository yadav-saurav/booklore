# Rules for parallel workstreams (read fully)

Several agents are working in /home/user/booklore at the same time.
1. Read ARCHITECTURE.md first, then the shared files you'll use (src/db/schema.ts, src/lib/queries/books.ts, src/components/book/*, src/components/ui/*, src/app/globals.css). Reuse them; don't duplicate them.
2. Only create or edit files inside YOUR owned paths, which are listed in your task. Don't edit shared foundation files.
   - If a shared file truly blocks you, make the smallest additive change (a new export, an optional prop) and mention it in your final report.
   - Never rewrite or reformat shared files.
3. Don't run `npm install` or add dependencies, don't run `npm run db:seed`, don't delete `data/booklore.db`, and don't run git commit/stash/checkout/reset. The lead handles git.
4. The database is seeded by the lead. Before any runtime test, wait until `data/.seeded` exists. Check it with plain `ls data/.seeded` and keep writing code until it appears; don't busy-loop with sleep.
5. Dev server: use YOUR assigned port and dist dir, e.g. `NODE_USE_ENV_PROXY=1 NEXT_DIST_DIR=.next-<name> npx next dev -p <port>`. Run it in the background and kill it when done (`pkill -f "next dev -p <port>"`). Never run `next build`. Never touch other agents' ports.
6. Next.js is v16: `params` and `searchParams` are Promises. Server Components by default. Server actions go in "use server" files. When unsure, read node_modules/next/dist/docs/.
7. Verify for real:
   - `npx tsc --noEmit` must show no errors in YOUR files. Ignore errors in files you don't own.
   - Fetch your pages with curl and check for status 200 and no error text.
   - Look at layouts with Playwright screenshots at 1440×900 and 390×844 (deviceScaleFactor 1). Save them under /tmp/claude-0/-home-user/f2381cf3-360d-5d0f-a533-57eb43867c17/scratchpad/shots/<name>/, view them, and fix what looks wrong.
8. Cover images can't load inside this container (the archive.org redirect is blocked), so `<BookCover>` shows generated covers in screenshots. That's expected and fine; in real browsers the real covers load.
9. Demo account: demo@booklore.app / booklore123. To test signed-in flows, POST the /signin form with Playwright (fill and submit the form).
10. Design: follow the "Design rules" in ARCHITECTURE.md and the tokens. The site follows IMDb's information architecture and layout patterns, dressed in the BOOKLORE archive look (paper, ink, cobalt). Don't use IMDb's name, logo or yellow. Aim for polish: spacing rhythm, alignment, hover and focus states, empty states, loading states (`loading.tsx` with `.skeleton`), and `not-found` handling.
11. Copyright: all copy you write is original. Never reproduce text from books.
12. Final report: under 150 words. List the routes and files you created, what you verified, and any changes to shared files. Don't paste code.
