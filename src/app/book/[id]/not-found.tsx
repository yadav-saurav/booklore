import Link from "next/link";

export default function BookNotFound() {
  return (
    <div className="page flex min-h-[60svh] flex-col items-center justify-center py-20 text-center">
      <p className="font-jp text-[88px] font-extrabold leading-none text-cobalt/15" aria-hidden>欠本</p>
      <p className="lbl mt-4 text-cobalt">404 · Missing from the shelf</p>
      <h1 className="mt-3 text-[32px] font-semibold tracking-tight md:text-[40px]">We couldn&apos;t find that book</h1>
      <p className="mt-3 max-w-md text-[15px] text-muted">
        The link may be out of date, or the title was never catalogued. Try searching the archive, or browse the charts.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/search" className="btn btn-primary">Search books</Link>
        <Link href="/chart/top" className="btn btn-outline">Top 250</Link>
      </div>
    </div>
  );
}
