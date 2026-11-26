import Link from "next/link";

export default function ListNotFound() {
  return (
    <div className="page py-24 text-center">
      <p className="lbl text-cobalt font-jp">見つかりません</p>
      <h1 className="mt-3 text-3xl font-semibold">This list isn&apos;t available</h1>
      <p className="mt-3 text-[15px] text-muted">It may be private, or it may have been deleted.</p>
      <Link href="/lists" className="btn btn-outline mt-7">Browse lists</Link>
    </div>
  );
}
