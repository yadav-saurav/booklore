"use client";

import { useState } from "react";
import { coverSrc, type CoverSize } from "@/lib/covers";
import { GeneratedCover } from "./GeneratedCover";

type Props = {
  book: { id: string; title: string; coverId?: number | null; coverUrl?: string | null; authorName?: string | null };
  size?: CoverSize;
  className?: string;
  priority?: boolean;
};

/** Real cover when available, generated archive cover when missing or broken. Always 2:3. */
export function BookCover({ book, size = "M", className = "", priority }: Props) {
  const src = coverSrc(book, size);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative aspect-[2/3] overflow-hidden bg-hair-2 ${className}`}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${book.title} cover`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            // Open Library returns a 1×1 gif for unknown ids.
            if ((e.currentTarget as HTMLImageElement).naturalWidth < 5) setFailed(true);
          }}
        />
      ) : (
        <GeneratedCover id={book.id} title={book.title} author={book.authorName} className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
}
