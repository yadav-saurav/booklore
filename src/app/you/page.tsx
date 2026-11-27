import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getActivity, getProfileStats, getReviews, getShelf, getShelfCounts, getUserRatings } from "@/lib/queries/users";
import { SectionHeader } from "@/components/ui/Section";
import { Avatar } from "@/components/ui/Avatar";
import { ActivityTimeline, CoverRail, EmptyNote, ProfileReviewCard, ProgressRail, QuickTiles } from "@/components/profile/Profile";

export const metadata: Metadata = { title: "Your activity" };
export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function YouPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="page py-16">
        <div className="mx-auto max-w-lg border border-hair bg-card px-6 py-12 text-center">
          <p className="lbl font-jp text-cobalt">あなたの記録 · Your activity</p>
          <h1 className="mt-3 text-[30px] font-semibold tracking-tight">Sign in to see your activity</h1>
          <p className="mt-2 text-[15px] text-muted">Your ratings, Reading List, lists and reviews, all in one place.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/signin?next=/you" className="btn btn-primary">Sign in</Link>
            <Link href="/register?next=/you" className="btn btn-outline">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  const [stats, shelfCounts, rated, wanted, reading, reviews, events] = await Promise.all([
    getProfileStats(user.id, true),
    getShelfCounts(user.id),
    getUserRatings(user.id, { sort: "date", limit: 18 }),
    getShelf(user.id, "want"),
    getShelf(user.id, "reading"),
    getReviews({ userId: user.id, limit: 3 }),
    getActivity(user.id, 20),
  ]);
  const scores = new Map(rated.map((r) => [r.id, r.yourRating]));

  return (
    <div className="pb-16">
      <header className="border-b border-hair bg-sheet">
        <div className="page flex items-center gap-5 py-10">
          <Avatar name={user.displayName} hue={user.avatarHue} size={72} className="!text-[28px] shrink-0" />
          <div className="min-w-0">
            <p className="lbl font-jp text-cobalt">あなたの記録 · Your activity</p>
            <h1 className="mt-1.5 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">{greeting()}, {user.displayName.split(" ")[0]}</h1>
            <Link href={`/user/${user.username}`} className="text-[14px] text-cobalt hover:underline">View your public profile →</Link>
          </div>
        </div>
      </header>

      <div className="page">
        <section className="pt-8">
          <QuickTiles tiles={[
            { label: "Ratings", kanji: "評価", href: "/you/ratings", count: stats.ratings },
            { label: "Reading List", kanji: "読書", href: "/readinglist", count: shelfCounts.want },
            { label: "Lists", kanji: "目録", href: `/user/${user.username}/lists`, count: stats.lists },
            { label: "Reviews", kanji: "書評", href: `/user/${user.username}#reviews`, count: stats.reviews },
            { label: "Recommendations", kanji: "推薦", href: "/recommendations", count: null },
          ]} />
        </section>

        <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <section className="pt-10">
              <SectionHeader title="Recently rated" count={stats.ratings} href="/you/ratings" />
              {rated.length ? <CoverRail label="Recently rated" books={rated} score={(b) => scores.get(b.id) ?? null} />
                : <EmptyNote href="/chart/top" cta="Rate from the Top 250">You haven&apos;t rated anything yet.</EmptyNote>}
            </section>

            <section className="pt-10">
              <SectionHeader title="Recently added to Reading List" count={shelfCounts.want} href="/readinglist" />
              {wanted.length ? <CoverRail label="Recently added to Reading List" books={wanted.slice(0, 18)} />
                : <EmptyNote href="/chart/bookmeter" cta="Browse popular books">Your Reading List is empty.</EmptyNote>}
            </section>

            <section className="pt-10">
              <SectionHeader title="Continue reading" count={shelfCounts.reading} href="/readinglist?status=reading" />
              {reading.length ? <ProgressRail items={reading} />
                : <EmptyNote>Nothing in progress. Mark a book &ldquo;Reading&rdquo; to track it here.</EmptyNote>}
            </section>

            <section className="pt-10">
              <SectionHeader title="Your reviews" count={stats.reviews} href={`/user/${user.username}`} />
              {reviews.length ? <div className="grid grid-cols-[minmax(0,1fr)] gap-4">{reviews.map((r) => <ProfileReviewCard key={r.reviewId} r={r} />)}</div>
                : <EmptyNote>You haven&apos;t written a review yet.</EmptyNote>}
            </section>
          </div>

          <section className="pt-10">
            <SectionHeader title="Activity" subtitle="Your latest 20 events" />
            <ActivityTimeline events={events} />
          </section>
        </div>
      </div>
    </div>
  );
}
