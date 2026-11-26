import type { Metadata } from "next";
import Link from "next/link";
import { listAuthors, listBornOn, getNationalities, type AuthorListItem } from "@/lib/queries/authors";
import { todayMonthDay } from "@/components/author/birthdate";
import { AuthorListRow } from "@/components/author/AuthorListRow";
import { ChipRow } from "@/components/genre/ChipRow";
import { Pager } from "@/components/genre/Pager";
import { flatParams, hrefWith } from "@/components/genre/href";
import { SectionHeader } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Popular authors",
  description: "The most popular authors on BOOKLORE, ranked, with filters for nationality and birthdays.",
};

const PAGE_SIZE = 25;
const PATH = "/authors";

export default async function AuthorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = flatParams(await searchParams);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const nat = sp.nat || undefined;
  const bornToday = sp.born === "today";
  const today = todayMonthDay();
  const nationalities = getNationalities(12);

  let rows: AuthorListItem[];
  let total: number;
  if (bornToday) {
    const all = listBornOn(today.month, today.day, nat);
    total = all.length;
    rows = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    ({ rows, total } = listAuthors({ nat, page, pageSize: PAGE_SIZE }));
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = { nat, born: bornToday ? "today" : undefined, page: undefined };
  const base = (page - 1) * PAGE_SIZE;

  return (
    <div className="page pb-16 pt-8 md:pt-12">
      <SectionHeader as="h1" title={bornToday ? "Born today" : "Popular authors"} kanji="人気の作家"
        subtitle={bornToday
          ? `Authors whose birthday is ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}, in any year.`
          : "Ranked by popularity across BOOKLORE. Ranks update as readers engage."} />

      <div className="flex flex-col gap-4 border-b border-hair pb-5">
        <ChipRow label="Born"
          items={[{ label: "Any day", href: hrefWith(PATH, current, { born: undefined }), active: !bornToday },
            { label: "Born today", href: hrefWith(PATH, current, { born: "today" }), active: bornToday }]} />
        {nationalities.length > 0 && (
          <ChipRow label="Nationality"
            items={[{ label: "All", href: hrefWith(PATH, current, { nat: undefined }), active: !nat },
              ...nationalities.map((n) => ({ label: n.name, href: hrefWith(PATH, current, { nat: n.name }), active: nat === n.name }))]} />
        )}
      </div>

      {rows.length ? (
        <>
          <p className="mt-4 text-[14px] text-muted">{total.toLocaleString("en-US")} {total === 1 ? "author" : "authors"}</p>
          <ol className="mt-2 divide-y divide-hair">
            {rows.map((a, i) => <AuthorListRow key={a.id} rank={base + i + 1} a={a} />)}
          </ol>
          <Pager path={PATH} current={current} page={page} pages={pages} />
        </>
      ) : (
        <div className="mt-10 border border-dashed border-hair p-10 text-center">
          <p className="text-lg font-semibold">{bornToday ? "No authors share today’s birthday" : "No authors match these filters"}</p>
          <p className="mt-1 text-muted">{bornToday ? "Birth dates are often incomplete, so this list grows as records are added." : "Try another nationality."}</p>
          <Link href={PATH} className="btn btn-outline btn-sm mt-5">Show all authors</Link>
        </div>
      )}
    </div>
  );
}
