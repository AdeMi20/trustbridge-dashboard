"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { LayoutDashboard, Moon, Settings, Sun, UserPlus } from "lucide-react";
import { useTheme } from "next-themes";

import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { SignInButton } from "@/components/SignInButton";

import { Button } from "@/components/ui/button";

export function Header() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)] backdrop-blur-lg">
      <div className="grid h-16 w-full grid-cols-[1fr_auto_1fr] items-center px-6 sm:px-8">
        {/* Left — logo at the edge */}
        <div className="justify-self-start">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-stellar-purple to-stellar-cyan text-sm font-semibold text-white">
              TB
            </span>
            <span className="tracking-tight">TrustBridge</span>
          </Link>
        </div>

        {/* Center — nav links stay centered, unchanged */}
        <nav
          aria-label="Main"
          className="hidden items-center gap-6 text-sm font-medium md:flex"
        >
          <Link
            href="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Home
          </Link>
          {session ? (
            <Link
              href="/register"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Register
            </Link>
          ) : (
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => signIn("github", { callbackUrl: "/register" })}
            >
              Register
            </button>
          )}
          {session?.user?.isMaintainer && (
            <Link
              href="/dashboard"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
          )}
          {session?.user?.isMaintainer && (
            <Link
              href="/dashboard/settings"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Settings
            </Link>
          )}
        </nav>

        {/* Right — actions at the edge */}
        <div className="flex items-center justify-self-end gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {session ? (
            <div className="flex items-center gap-1.5">
              <span className="hidden px-1.5 text-sm text-muted-foreground sm:inline">
                @{session.user.githubUsername}
              </span>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          ) : (
            <SignInButton
              variant="stellar"
              size="sm"
              callbackUrl="/register"
            >
              <GitHubIcon className="h-4 w-4" />
              Sign in with GitHub
            </SignInButton>
          )}

          {session ? (
            <Button asChild variant="cyan" size="sm" className="hidden sm:inline-flex">
              <Link href="/register">
                <UserPlus className="h-4 w-4" />
                Register
              </Link>
            </Button>
          ) : (
            <SignInButton
              variant="cyan"
              size="sm"
              className="hidden sm:inline-flex"
              callbackUrl="/register"
            >
              <UserPlus className="h-4 w-4" />
              Register
            </SignInButton>
          )}

          {session?.user?.isMaintainer && (
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          )}
          {session?.user?.isMaintainer && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/dashboard/settings">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
