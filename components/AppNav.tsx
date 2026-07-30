import Link from "next/link";

export function AppNav({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-sage/20">
      <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-display text-lg">
          Failsafe
        </Link>
        <div className="flex items-center gap-4">
          {email && <span className="text-xs text-ash hidden sm:inline">{email}</span>}
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="text-sm text-parchment/70 hover:text-parchment"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
