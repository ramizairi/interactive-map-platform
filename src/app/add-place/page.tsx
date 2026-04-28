import Link from "next/link";
import { redirect } from "next/navigation";
import { AddPlaceWorkflow } from "@/components/account/AddPlaceWorkflow";
import { getCurrentUser } from "@/lib/auth";

export default async function AddPlacePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/signin");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-7xl">
        <Link href="/dashboard" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Back to dashboard
        </Link>
        <header className="my-5">
          <h1 className="text-3xl font-semibold tracking-tight">Add a place</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Submit a place for Nabeul. It will appear on the map after admin approval.
          </p>
        </header>
        <AddPlaceWorkflow />
      </div>
    </main>
  );
}
