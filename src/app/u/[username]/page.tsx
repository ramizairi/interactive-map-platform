import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BarChart3, Camera, MapPinPlus, Star, UserRound } from "lucide-react";
import { getPublicProfile } from "@/lib/auth";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getPublicProfile(username);

  if (!user) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Back to map
        </Link>
        <section className="mt-5 rounded-lg border border-black/10 bg-white/86 p-6 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt="" fill sizes="64px" unoptimized className="object-cover" />
              ) : (
                <UserRound size={30} />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{user.name}</h1>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">@{user.username}</p>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {user.bio || "Map contributor for Nabeul. Public activity and trusted contributions appear here."}
          </p>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-4">
          <Stat icon={<BarChart3 size={19} />} label="Visitors" value={user.stats.visitors} />
          <Stat icon={<MapPinPlus size={19} />} label="Places added" value={user.stats.placesAdded} />
          <Stat icon={<Star size={19} />} label="Reviews" value={user.stats.reviews} />
          <Stat icon={<Camera size={19} />} label="Reactions" value={user.stats.reactions} />
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
