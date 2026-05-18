"use client";

import Link from "next/link";
import { LogIn, UserPlus, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BRAND_NAME } from "@/lib/brand";

export function PublicHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
      <Link href="/" className="flex items-center gap-2 font-bold">
        <Zap className="h-6 w-6 text-cyan-500" />
        <span className="neon-text text-lg">{BRAND_NAME}</span>
      </Link>
      <nav className="hidden items-center gap-4 text-sm sm:flex">
        <Link href="/" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          Home
        </Link>
        <Link href="/services" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          All services
        </Link>
      </nav>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium transition hover:bg-[var(--glass)]"
        >
          <LogIn className="h-3.5 w-3.5" />
          Login
        </Link>
        <Link href="/sign-up" className="btn-primary inline-flex items-center gap-1 px-2.5 py-1 text-xs">
          <UserPlus className="h-3.5 w-3.5" />
          Sign up
        </Link>
      </div>
    </header>
  );
}
