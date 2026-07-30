import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center rounded-md px-5 py-3 font-body font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-gold text-ink hover:bg-gold/90",
    secondary: "bg-sage text-ink hover:bg-sage/90",
    ghost: "bg-transparent text-parchment border border-parchment/30 hover:bg-parchment/10",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-parchment/90 mb-1.5">
      {children}
    </label>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md bg-ink border border-sage/50 px-3.5 py-2.5 text-parchment placeholder:text-ash focus:border-gold outline-none ${className}`}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-md bg-ink border border-sage/50 px-3.5 py-2.5 text-parchment placeholder:text-ash outline-none focus:border-gold ${className}`}
      {...props}
    />
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-ash">{children}</p>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-2 text-sm text-ember">{children}</p>;
}
