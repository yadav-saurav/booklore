import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page py-24 text-center">
      <p className="lbl mb-3 text-cobalt">Not in the archive</p>
      <h1 className="text-4xl font-semibold tracking-tight">We couldn’t find that author</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">The name may have changed or never been catalogued. Browse the popular authors instead.</p>
      <Link href="/authors" className="btn btn-primary mt-8">Popular authors</Link>
    </div>
  );
}
