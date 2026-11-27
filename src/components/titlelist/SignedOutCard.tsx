import Link from "next/link";

/** IMDb's signed-out Watchlist card, for the Reading List and Your Ratings. */
export function SignedOutCard({ next, title, body, kicker }: { next: string; title: string; body: string; kicker: string }) {
  const q = encodeURIComponent(next);
  return (
    <div className="page py-12 md:py-16">
      <div className="mx-auto flex max-w-2xl flex-col items-center border border-hair bg-sheet px-6 py-12 text-center shadow-card sm:px-12">
        <svg viewBox="0 0 64 88" className="h-20 w-[58px] text-cobalt" aria-hidden>
          <path d="M0 0h64v88L32 72 0 88z" fill="currentColor" />
          <path d="M32 26v28M18 40h28" stroke="var(--cobalt-ink)" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
        <p className="lbl mt-6 text-cobalt">{kicker}</p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-md text-[15px] text-muted">{body}</p>
        <div className="mt-7 flex w-full max-w-xs flex-col gap-3">
          <Link href={`/signin?next=${q}`} className="btn btn-primary h-11">Sign in</Link>
          <Link href={`/register?next=${q}`} className="btn btn-outline h-11">Create an account</Link>
        </div>
        <Link href="/chart/top" className="mt-6 text-[14px] font-semibold text-cobalt hover:underline">Browse popular books →</Link>
      </div>
    </div>
  );
}
