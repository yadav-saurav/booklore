"use client";

import { useEffect } from "react";
import { pushRecent, type RecentBook } from "./store";

/** Records the current book in the visitor's Recently viewed history. Renders nothing. */
export function TrackRecentlyViewed({ book }: { book: RecentBook }) {
  const { id, title, coverId, coverUrl, authorName, year } = book;
  useEffect(() => {
    pushRecent({ id, title, coverId, coverUrl, authorName, year });
  }, [id, title, coverId, coverUrl, authorName, year]);
  return null;
}
