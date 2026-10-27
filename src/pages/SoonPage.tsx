import { useLocation } from "react-router-dom";
import { soonTitle } from "../components/layout/navItems";

/** Any LEDGERS menu page this prototype doesn't build: its name, so the menu can be clicked through end to end. */
export function SoonPage() {
  const { pathname } = useLocation();
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-foreground">{soonTitle(pathname)}</h1>
      <p className="text-sm text-muted-foreground">Not part of this prototype.</p>
    </div>
  );
}
