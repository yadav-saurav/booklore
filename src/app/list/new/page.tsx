import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SectionHeader } from "@/components/ui/Section";
import { ListForm } from "@/components/lists/ListForm";

export const metadata: Metadata = { title: "Create a list" };

export default async function NewListPage() {
  if (!(await getCurrentUser())) redirect("/signin?next=/list/new");
  return (
    <div className="page py-10 md:py-14">
      <div className="mx-auto max-w-2xl">
        <SectionHeader as="h1" kanji="新しいリスト · New list" title="Create a list"
          subtitle="Name it and describe it. You'll add books on the next step." />
        <ListForm />
      </div>
    </div>
  );
}
