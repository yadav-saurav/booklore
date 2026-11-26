import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page py-24 text-center">
      <p className="lbl mb-3 text-cobalt">No such shelf</p>
      <h1 className="text-4xl font-semibold tracking-tight">That genre isn’t in the archive</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">Every genre BOOKLORE carries is listed on the genres index.</p>
      <Link href="/genres" className="btn btn-primary mt-8">All genres</Link>
    </div>
  );
}
