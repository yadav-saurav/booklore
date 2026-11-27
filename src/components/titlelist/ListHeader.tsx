import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/util";
import { ShareButton } from "./ShareButton";

/** IMDb list header band: kicker, big title, owner line, privacy pill, Share / Edit, one-line description. */
export function ListHeader({
  kicker, title, owner, editedAt, isPublic, description, editHref, editLabel = "Edit", sharePath, extra, stats,
}: {
  kicker: string; title: string; owner?: { name: string; username: string; hue: number } | null; editedAt?: number | null;
  isPublic: boolean; description?: string | null; editHref?: string | null; editLabel?: string; sharePath?: string;
  extra?: React.ReactNode; stats?: React.ReactNode;
}) {
  return (
    <header className="border-b border-hair bg-sheet">
      <div className="page py-7 md:py-9">
        <p className="lbl text-cobalt">{kicker}</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] md:text-[40px]">{title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-ink-2">
              {owner && (
                <Link href={`/user/${owner.username}`} className="group inline-flex items-center gap-2">
                  <Avatar name={owner.name} hue={owner.hue} size={26} />
                  <span>by <span className="font-semibold text-ink group-hover:text-cobalt group-hover:underline">{owner.name}</span></span>
                </Link>
              )}
              {editedAt ? <><span aria-hidden className="text-muted">·</span><span className="text-muted">Edited {timeAgo(editedAt)}</span></> : null}
              <span className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold ${isPublic ? "border-cobalt/40 text-cobalt" : "border-hair text-muted"}`}>
                {isPublic ? (
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><circle cx="8" cy="8" r="6.2" /><path d="M1.8 8h12.4M8 1.8c2 2.2 2 10.2 0 12.4M8 1.8c-2 2.2-2 10.2 0 12.4" /></svg>
                ) : (
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>
                )}
                {isPublic ? "Public" : "Private"}
              </span>
              {stats}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {extra}
            <ShareButton path={sharePath} />
            {editHref && (
              <Link href={editHref} className="btn btn-outline btn-sm gap-2">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M11 2.5l2.5 2.5L6 12.5H3.5V10z" strokeLinejoin="round" /></svg>
                {editLabel}
              </Link>
            )}
          </div>
        </div>
        {description && <p className="mt-4 line-clamp-2 max-w-3xl text-[15px] text-ink-2">{description}</p>}
      </div>
    </header>
  );
}
