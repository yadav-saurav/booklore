import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getMemberByUsername, getProfileStats, getFollowCounts, isFollowing, favoriteGenres,
  getUserRatings, getReviews, ratingHistogram,
} from "@/lib/queries/users";
import { getUserLists, type ListSummary } from "@/lib/queries/lists";
import { Avatar } from "@/components/ui/Avatar";
import { Rail } from "@/components/ui/Rail";
import { Section } from "@/components/ui/Section";
import { BookCover } from "@/components/book/BookCover";
import { StarIcon } from "@/components/book/Rating";
import { FollowButton } from "@/components/user/FollowButton";
import { Histogram } from "@/components/user/Histogram";
import { ReviewCard } from "@/components/user/ReviewCard";
import { StatStrip } from "@/components/user/StatStrip";
import { ListCard } from "@/components/lists/ListCard";
import { plural } from "@/lib/util";

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

  const stats = await getProfileStats(member.id, isSelf);
  const counts = await getFollowCounts(member.id);
  const following = me && !isSelf ? await isFollowing(me.id, member.id) : false;
  const hist = await ratingHistogram(member.id);
  const recentRatings = await getUserRatings(member.id, { sort: "date", limit: 14 });
  const recentReviews = await getReviews({ userId: member.id, limit: 4 });
  const genres = await favoriteGenres(member.id, 6);
  const lists: ListSummary[] = (await getUserLists(member.id, isSelf)).slice(0, 4);
  const joined = new Date(member.createdAt * 1000).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="page py-10 md:py-14">
      <header className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
        <Avatar name={member.displayName} hue={member.avatarHue} size={112} className="!text-[44px]" />
        <div className="min-w-0 flex-1">
          <p className="lbl text-cobalt font-jp">読者 · Member{member.isMock ? " · sample" : ""}</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{member.displayName}</h1>
          <p className="mt-1 text-[15px] text-muted">@{member.username}</p>
          {member.bio && <p className="prose-serif mt-4 max-w-2xl text-ink-2">{member.bio}</p>}
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
            {member.location && <span>{member.location}</span>}
            <span>Member since {joined}</span>
          </p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
            <span><span className="font-semibold text-ink tabular-nums">{counts.followers.toLocaleString("en-US")}</span> <span className="text-muted">{counts.followers === 1 ? "follower" : "followers"}</span></span>
            <span><span className="font-semibold text-ink tabular-nums">{counts.following.toLocaleString("en-US")}</span> <span className="text-muted">following</span></span>
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          {isSelf ? (
            <Link href="/settings" className="btn btn-outline">Edit profile</Link>
          ) : (
            <FollowButton targetId={member.id} username={member.username} initial={following} />
          )}
        </div>
      </header>

      <div className="mt-10">
        <StatStrip items={[
          { label: "Ratings", value: stats.ratings },
          { label: "Reviews", value: stats.reviews },
          { label: "Lists", value: stats.lists },
          { label: "Books read", value: stats.read },
        ]} />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-12">
          <Section className="!py-0">
            <h2 className="sec-title mb-6 text-[20px]">Rating distribution</h2>
            <div className="max-w-xl">
              <Histogram data={hist} caption={stats.ratings ? `${plural(stats.ratings, "rating")} across the archive` : "No ratings yet."} />
            </div>
          </Section>

          {recentRatings.length > 0 && (
            <Section className="!py-0">
              <div className="mb-5 flex items-baseline justify-between">
                <h2 className="sec-title text-[20px]">Recent ratings</h2>
                {isSelf ? (
                  <Link href="/you/ratings" className="text-[13px] font-semibold text-cobalt hover:underline">See all {stats.ratings}</Link>
                ) : (
                  <span className="text-[13px] text-muted">{plural(stats.ratings, "rating")}</span>
                )}
              </div>
              <Rail label="Recent ratings">
                {recentRatings.map((r) => (
                  <div key={r.id} role="listitem" className="w-[120px] shrink-0">
                    <Link href={`/book/${r.id}`} className="block"><BookCover book={r} size="S" /></Link>
                    <Link href={`/book/${r.id}`} className="mt-2 line-clamp-2 block text-[13px] font-semibold leading-snug hover:text-cobalt">{r.title}</Link>
                    <p className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold">
                      <StarIcon className="h-3 w-3 text-star" />{r.yourRating}<span className="font-normal text-muted">/10</span>
                    </p>
                  </div>
                ))}
              </Rail>
            </Section>
          )}

          <Section className="!py-0">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="sec-title text-[20px]">Recent reviews</h2>
              <span className="text-[13px] text-muted">{plural(stats.reviews, "review")}</span>
            </div>
            {recentReviews.length === 0 ? (
              <p className="border border-dashed border-hair py-10 text-center text-[15px] text-muted">{member.displayName} hasn&apos;t written a review yet.</p>
            ) : (
              <div>{recentReviews.map((r) => <ReviewCard key={r.reviewId} review={r} />)}</div>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-10">
          {genres.length > 0 && (
            <section aria-labelledby="fav-h">
              <h2 id="fav-h" className="lbl mb-4 border-b border-hair pb-3 text-cobalt">Favourite genres</h2>
              <ul className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <li key={g.slug}><Link href={`/genre/${g.slug}`} className="chip">{g.name}<span className="text-muted">{g.count}</span></Link></li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="lists-h">
            <div className="mb-4 flex items-baseline justify-between border-b border-hair pb-3">
              <h2 id="lists-h" className="lbl text-cobalt">{isSelf ? "Your lists" : "Lists"}</h2>
              <Link href={`/user/${member.username}/lists`} className="text-[13px] font-semibold text-cobalt hover:underline">All {stats.lists}</Link>
            </div>
            {lists.length === 0 ? (
              <p className="text-[14px] text-muted">{isSelf ? "You haven't made a list yet." : "No public lists yet."}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-4">
                {lists.map((l) => <li key={l.id}><ListCard list={l} /></li>)}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
