import Link from "next/link";

/** Shown in place of a page that needs an account. Keeps the archive look and returns the visitor afterwards. */
export function SignInPrompt({ next, title, body }: { next: string; title: string; body: string }) {
  const q = encodeURIComponent(next);
  return (
    <div className="border border-hair bg-sheet px-6 py-12 text-center sm:px-12">
      <p className="lbl text-cobalt font-jp">会員限定</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-[15px] text-muted">{body}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href={`/signin?next=${q}`} className="btn btn-primary">Sign in</Link>
        <Link href={`/register?next=${q}`} className="btn btn-outline">Create an account</Link>
      </div>
    </div>
  );
}
