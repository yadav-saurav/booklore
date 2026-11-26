import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMemberByUsername } from "@/lib/queries/users";
import { getUserLists } from "@/lib/queries/lists";
import { SectionHeader } from "@/components/ui/Section";
import { ListCard } from "@/components/lists/ListCard";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const m = getMemberByUsername((await params).username);
  return { title: m ? `Lists by ${m.displayName}` : "Lists" };
}

export default async function UserListsPage({ params }: Params) {
  const { username } = await params;
  const member = getMemberByUsername(username);
  if (!member) notFound();
  const me = await getCurrentUser();
  const isSelf = me?.id === member.id;
  const lists = getUserLists(member.id, isSelf);

  return (
    <div className="page py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeader as="h1" kanji="リスト · Lists" title={isSelf ? "Your lists" : `Lists by ${member.displayName}`}
          subtitle={isSelf ? "Public and private lists are both shown here, only to you." : undefined} count={lists.length} />
        <div className="mb-4 flex gap-3">
          <Link href={`/user/${member.username}`} className="btn btn-ghost btn-sm">← Profile</Link>
          {isSelf && <Link href="/list/new" className="btn btn-primary">Create a list</Link>}
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="border border-dashed border-hair py-16 text-center">
          <p className="text-[15px] text-muted">{isSelf ? "You haven't made a list yet." : "No public lists yet."}</p>
          {isSelf && <Link href="/list/new" className="btn btn-outline mt-5">Make your first list</Link>}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
          {lists.map((l) => <li key={l.id}><ListCard list={l} /></li>)}
        </ul>
      )}
    </div>
  );
}
