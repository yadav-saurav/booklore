import type { Metadata } from "next";
import { getGenreTiles } from "@/lib/queries/genres";
import { GenreTileCard } from "@/components/genre/GenreTile";
import { SectionHeader } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Genres",
  description: "Every genre in the BOOKLORE archive, with book counts and a sample of covers.",
};

export default async function GenresPage() {
  const tiles = await getGenreTiles();
  return (
    <div className="page pb-16 pt-8 md:pt-12">
      <SectionHeader as="h1" title="Genres" kanji="ジャンル" count={tiles.length}
        subtitle="Browse the archive by shelf. Each genre sorts its books by popularity, rating or date." />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((g) => (
          <li key={g.slug}><GenreTileCard g={g} /></li>
        ))}
      </ul>
    </div>
  );
}
