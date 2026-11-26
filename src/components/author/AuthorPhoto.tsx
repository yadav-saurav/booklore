"use client";

import { useState } from "react";
import { authorPhotoSrc } from "@/lib/covers";
import { hash01 } from "@/lib/util";
import { Avatar } from "@/components/ui/Avatar";

/** Portrait (3:4). Falls back to a monogram when there is no photo or it fails to load. */
export function AuthorPhoto({ name, photoId, photoUrl, className = "", monogramSize = 96, priority }: {
  name: string; photoId: number | null; photoUrl: string | null; className?: string; monogramSize?: number; priority?: boolean;
}) {
  const src = authorPhotoSrc({ photoId, photoUrl }, monogramSize > 60 ? "L" : "M");
  const [failed, setFailed] = useState(false);
  const hue = Math.round(hash01(name) * 360);
  return (
    <div className={`relative aspect-[3/4] overflow-hidden bg-hair-2 ${className}`}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Photo of ${name}`} loading={priority ? "eager" : "lazy"} decoding="async"
          className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar name={name} hue={hue} size={monogramSize} />
        </div>
      )}
    </div>
  );
}
