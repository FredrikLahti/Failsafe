import Link from "next/link";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center font-display text-xl mb-8">
          Failsafe
        </Link>
        <h1 className="font-display text-2xl text-center mb-8">{title}</h1>
        {children}
      </div>
    </div>
  );
}
