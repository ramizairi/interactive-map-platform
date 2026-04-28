import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminModeration } from "@/components/account/AdminModeration";
import { getCurrentUser } from "@/lib/auth";
import { listPendingPlaceRequests } from "@/lib/place-requests";

export default async function AdminPlacesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/signin");
  }

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const requests = await listPendingPlaceRequests();

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Back to dashboard
        </Link>
        <header className="my-5">
          <h1 className="text-3xl font-semibold tracking-tight">Pending places</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Review user submissions with Gemini verification before they appear on the public map.
          </p>
        </header>
        <AdminModeration requests={requests} />
      </div>
    </main>
  );
}
