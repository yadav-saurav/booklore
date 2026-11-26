import Link from "next/link";

export default function MemberNotFound() {
  return (
    <div className="page py-24 text-center">
      <p className="lbl text-cobalt font-jp">不明</p>
      <h1 className="mt-3 text-3xl font-semibold">No member by that name</h1>
      <p className="mt-3 text-[15px] text-muted">The profile may have been removed, or the address is mistyped.</p>
      <Link href="/community" className="btn btn-outline mt-7">Browse the community</Link>
    </div>
  );
}
