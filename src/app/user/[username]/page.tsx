import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getMemberByUsername, getProfileStats, getFollowCounts, isFollowing, getUserRatings, getReviews, countReviews,
  getShelf, getShelfCounts, getProfileInsights, getBadges,
} from "@/lib/queries/users";
import { getUserLists } from "@/lib/queries/lists";
import { Avatar } from "@/components/ui/Avatar";
import { SectionHeader } from "@/components/ui/Section";
import { FollowButton } from "@/components/user/FollowButton";
import { BadgeRow, CoverRail, EmptyNote, Insights, MosaicListCard, ProfileReviewCard } from "@/components/profile/Profile";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const m = await getMemberByUsername((await params).username);
  return { title: m ? `${m.displayName} (@${m.username})` : "Member" };
}

export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  const member = await getMemberByUsername(username);
  if (!member) notFound();
  const me = await getCurrentUser();
  const isSelf = me?.id === member.id;

  const [stats, follows, following, badges, insights, ratings, reviews, reviewCount, shelfCounts, wantList, lists] = await Promise.all([
    getProfileStats(member.id, isSelf),
    getFollowCounts(member.id),
    me && !isSelf ? isFollowing(me.id, member.id) : Promise.resolve(false),
    getBadges(member.id),
    getProfileInsights(member.id),
    getUserRatings(member.id, { sort: "date", limit: 18 }),
    getReviews({ userId: member.id, limit: 10 }),
    countReviews({ userId: member.id }),
    getShelfCounts(member.id),
    isSelf ? getShelf(member.id, "want") : Promise.resolve([]),
    getUserLists(member.id, isSelf),
  ]);
  const joined = new Date(member.createdAt * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const scores = new Map(ratings.map((r) => [r.id, r.yourRating]));
  const first = member.displayName.split(" ")[0];

  return (
    <div className="pb-16">
      {/* Header band */}
      <header className="border-b border-hair bg-sheet">
        <div className="page flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:gap-8 md:py-12">
          <Avatar name={member.displayName} hue={member.avatarHue} size={120} className="!text-[46px] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="lbl font-jp text-cobalt">読者 · Member{member.isMock ? " · sample" : ""}</p>
            <h1 className="mt-2 break-words text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[40px]">{member.displayName}</h1>
            <p className="mt-2 text-[14.5px] text-muted">
              @{member.username} · Joined {joined}{member.location ? ` · ${member.location}` : ""}
            </p>
            {member.bio && <p className="prose-serif mt-3 max-w-2xl text-ink-2">{member.bio}</p>}
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
              <span><b className="tabular-nums">{follows.followers.toLocaleString("en-US")}</b> <span className="text-muted">{follows.followers === 1 ? "follower" : "followers"}</span></span>
              <span><b className="tabular-nums">{follows.following.toLocaleString("en-US")}</b> <span className="text-muted">following</span></span>
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            {isSelf ? (
              <>
                <Link href="/settings" className="btn btn-outline">Edit profile</Link>
                <Link href="/you" className="btn btn-ghost">Your activity</Link>
              </>
            ) : (
              <FollowButton targetId={member.id} username={member.username} initial={following} />
            )}
          </div>
        </div>
        {badges.length > 0 && <div className="page pb-6"><BadgeRow badges={badges} /></div>}
      </header>

      <div className="page grid gap-x-12 gap-y-10 pt-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <section className="pt-8">
            <SectionHeader title="Ratings" count={stats.ratings} href={isSelf ? "/you/ratings" : undefined}
              subtitle={isSelf ? "Your most recent ratings" : `${first}'s most recent ratings`} />
            {ratings.length ? <CoverRail label="Ratings" books={ratings} score={(b) => scores.get(b.id) ?? null} />
              : <EmptyNote href={isSelf ? "/chart/top" : undefined} cta="Rate from the Top 250">No ratings yet.</EmptyNote>}
          </section>

          <section className="pt-8">
            <SectionHeader title="Reading List" count={shelfCounts.want} href={isSelf ? "/readinglist" : undefined} />
            {isSelf ? (
              wantList.length ? <CoverRail label="Reading List" books={wantList.slice(0, 18)} />
                : <EmptyNote href="/chart/bookmeter" cta="Browse popular books">Your Reading List is empty.</EmptyNote>
            ) : (
              <p className="text-[15px] text-muted">{first}&apos;s Reading List is private · {shelfCounts.want.toLocaleString("en-US")} books saved, {shelfCounts.read.toLocaleString("en-US")} read.</p>
            )}
          </section>

          <section className="pt-8">
            <SectionHeader title="Lists" count={lists.length} href={`/user/${member.username}/lists`} />
            {lists.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{lists.slice(0, 4).map((l) => <MosaicListCard key={l.id} list={l} />)}</div>
            ) : (
              <EmptyNote href={isSelf ? "/list/new" : undefined} cta="Create a list">{isSelf ? "You haven't made a list yet." : "No public lists yet."}</EmptyNote>
            )}
          </section>

          <section id="reviews" className="scroll-mt-24 pt-8">
            <SectionHeader title="Reviews" count={reviewCount} />
            {reviews.length ? <div className="grid grid-cols-[minmax(0,1fr)] gap-4">{reviews.map((r) => <ProfileReviewCard key={r.reviewId} r={r} />)}</div>
              : <EmptyNote>No reviews yet.</EmptyNote>}
          </section>
        </div>

        <div className="lg:pt-8"><div className="lg:sticky lg:top-24"><Insights data={insights} /></div></div>
      </div>
    </div>
  );
}
