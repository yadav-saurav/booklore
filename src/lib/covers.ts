export type CoverSize = "S" | "M" | "L";

/** Cover image URL for a book row (Open Library cover id, or absolute url from another source). */
export function coverSrc(b: { coverId?: number | null; coverUrl?: string | null }, size: CoverSize = "M"): string | null {
  if (b.coverId) return `https://covers.openlibrary.org/b/id/${b.coverId}-${size}.jpg`;
  if (b.coverUrl) return size === "L" ? b.coverUrl.replace("zoom=1", "zoom=2") : b.coverUrl;
  return null;
}

export function authorPhotoSrc(a: { photoId?: number | null; photoUrl?: string | null }, size: CoverSize = "M"): string | null {
  if (a.photoId) return `https://covers.openlibrary.org/a/id/${a.photoId}-${size}.jpg`;
  return a.photoUrl ?? null;
}
