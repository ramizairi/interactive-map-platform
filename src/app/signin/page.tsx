import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,143,114,0.16),transparent_38%),#f8faf9] px-4 py-8 text-zinc-950 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,143,114,0.12),transparent_38%),#09090b] dark:text-zinc-50">
      <Link href="/" className="mx-auto mb-8 block max-w-md text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        Back to map
      </Link>
      <div className="flex justify-center">
        <AuthForm mode="signin" />
      </div>
    </main>
  );
}
