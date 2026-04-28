import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { BarChart3, Camera, MapPinPlus, ShieldCheck, Star, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listUserPlaceRequests } from "@/lib/place-requests";
import { SignOutButton } from "@/components/account/SignOutButton";
import { ProfileEditor } from "@/components/account/ProfileEditor";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/signin");
  }

  const requests = await listUserPlaceRequests(user.id);
  const pendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 rounded-lg border border-black/10 bg-white/86 p-5 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt="" fill sizes="56px" unoptimized className="object-cover" />
              ) : (
                <UserRound size={26} />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Dashboard
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">@{user.username}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-3 text-sm font-semibold text-white dark:bg-white dark:text-zinc-950">
              Open map
            </Link>
            <Link href={`/u/${user.username}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white/80 px-3 text-sm font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
              Public profile
            </Link>
            <SignOutButton />
          </div>
        </header>

        <section className="mt-5 grid gap-3 md:grid-cols-4">
          <Stat icon={<BarChart3 size={19} />} label="Visitors" value={user.stats.visitors} />
          <Stat icon={<MapPinPlus size={19} />} label="Places added" value={user.stats.placesAdded} />
          <Stat icon={<Star size={19} />} label="Reviews" value={user.stats.reviews} />
          <Stat icon={<Camera size={19} />} label="Reactions" value={user.stats.reactions} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="rounded-lg border border-black/10 bg-white/86 p-5 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Place submissions</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{pendingCount} pending admin approval</p>
              </div>
              <Link href="/add-place" className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white">
                Add place
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {requests.length ? (
                requests.map((request) => (
                  <article key={request.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{request.name}</p>
                        <p className="text-sm capitalize text-zinc-500">{request.category}</p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold capitalize text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                        {request.status}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">
                  No submissions yet.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-5">
            <ProfileEditor user={user} />
            <aside className="rounded-lg border border-black/10 bg-white/86 p-5 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
              <ShieldCheck className="text-emerald-700 dark:text-emerald-300" size={24} />
              <h2 className="mt-3 text-lg font-semibold">Contribution status</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Submitted places stay pending until an admin approves them. Approved places appear on the public map and count toward your profile.
              </p>
              {user.role === "admin" ? (
                <Link href="/admin/places" className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-red-700 px-3 text-sm font-semibold text-white">
                  Review pending places
                </Link>
              ) : null}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white/86 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 text-emerald-700 dark:text-emerald-300">{icon}</div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{label}</p>
    </div>
  );
}
