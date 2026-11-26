import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getListDetail, getListItems } from "@/lib/queries/lists";
import { SectionHeader } from "@/components/ui/Section";
import { ListForm } from "@/components/lists/ListForm";
import { ListItemsEditor } from "@/components/lists/ListItemsEditor";
import { DeleteListButton } from "@/components/lists/DeleteListButton";

export const metadata: Metadata = { title: "Edit list" };

export default async function EditListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lid = Number(id);
  if (!Number.isInteger(lid) || lid < 1) notFound();
  const me = await getCurrentUser();
  if (!me) redirect(`/signin?next=/list/${lid}/edit`);
  const list = await getListDetail(lid);
  if (!list) notFound();
  if (list.ownerId !== me.id) redirect(`/list/${lid}`);

  const items = (await getListItems(lid, me.id)).map((i) => ({
    id: i.id, title: i.title, authorName: i.authorName, year: i.year, coverId: i.coverId, coverUrl: i.coverUrl, pages: i.pages, note: i.note,
  }));

  return (
    <div className="page py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <SectionHeader as="h1" kanji="編集 · Edit list" title={list.title} subtitle={`Editing ${list.isPublic ? "a public" : "a private"} list`} />
        <Link href={`/list/${lid}`} className="btn btn-outline mb-4">View list</Link>
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section aria-labelledby="details-h" className="h-fit lg:sticky lg:top-24">
          <h2 id="details-h" className="lbl mb-5 border-b border-hair pb-3 text-cobalt">Details</h2>
          <ListForm listId={lid} initial={{ title: list.title, description: list.description, isPublic: list.isPublic }} />
          <div className="mt-10 border-t border-hair pt-6">
            <p className="lbl mb-3 text-muted">Danger zone</p>
            <DeleteListButton listId={lid} />
          </div>
        </section>
        <ListItemsEditor listId={lid} initialItems={items} />
      </div>
    </div>
  );
}
