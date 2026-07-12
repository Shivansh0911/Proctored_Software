import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export function AppNav({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">{title}</span>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
