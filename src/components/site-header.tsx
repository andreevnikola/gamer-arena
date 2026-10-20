import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
      <span className="font-heading text-lg font-semibold tracking-tight">
        Gamer<span className="text-primary">Arena</span>
      </span>
      <ThemeToggle />
    </header>
  );
}
