import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="flex justify-between items-center w-full pt-8">
      <Logo />
      <ThemeToggle />
    </header>
  );
}
