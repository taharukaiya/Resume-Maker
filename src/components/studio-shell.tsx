"use client";
import type { PublicUser } from "@/modules/auth/service";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelsTopLeft,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "./ui";
const UserContext = createContext<PublicUser | null>(null);
export function useUser() {
  return useContext(UserContext)!;
}
export function StudioShell({
  user,
  children,
}: {
  user: PublicUser;
  children: ReactNode;
}) {
  const pathname = usePathname(),
    router = useRouter(),
    [open, setOpen] = useState(false),
    [logoutError, setLogoutError] = useState("");
  const links = [
    { url: "/studio", label: "Overview", icon: LayoutDashboard },
    { url: "/studio/portfolios", label: "Portfolios", icon: PanelsTopLeft },
    ...(user.role === "admin"
      ? [{ url: "/studio/clients", label: "People & access", icon: Users }]
      : []),
    { url: "/studio/inbox", label: "Inbox", icon: Inbox },
    ...(user.role === "admin"
      ? [{ url: "/studio/activity", label: "Activity log", icon: Activity }]
      : []),
    { url: "/studio/settings", label: "Settings & security", icon: Settings },
  ];
  return (
    <UserContext.Provider value={user}>
      <div className="studio">
        <aside className={`sidebar ${open ? "open" : ""}`}>
          <Link href="/studio" className="brand-lockup">
            <span className="brand-symbol">
              <BookOpen size={24} />
            </span>
            <span>
              Brilliancy<span className="brand-sub">RESEARCH STUDIO</span>
            </span>
          </Link>
          <button
            className="mobile-close icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
          <div className="nav-caption">WORKSPACE</div>
          <nav>
            {links.map(({ url, label, icon: Icon }) => (
              <Link
                key={url}
                href={url}
                onClick={() => setOpen(false)}
                className={
                  (
                    url === "/studio"
                      ? pathname === url
                      : pathname.startsWith(url)
                  )
                    ? "active"
                    : ""
                }
              >
                <Icon size={18} />
                {label}
                {url === "/studio/portfolios" && (
                  <ArrowUpRight className="nav-end" size={14} />
                )}
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="small-orbit">✳</span>
            <h4>
              Research deserves
              <br />a remarkable home.
            </h4>
            <p>
              A thoughtful portfolio.
              <br />A world of possibilities.
            </p>
          </div>
          <div className="sidebar-bottom">
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <span>
                {user.role === "admin" ? "Administrator" : "Client account"}
              </span>
            </div>
            <button
              title="Sign out"
              aria-label="Sign out"
              className="icon-button"
              onClick={async () => {
                try {
                  await api("auth/logout", { method: "POST" });
                  router.push("/login");
                  router.refresh();
                } catch {
                  setLogoutError("Could not sign out. Please try again.");
                }
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
          {logoutError && <p role="alert">{logoutError}</p>}
        </aside>
        <div className="workspace">
          <header className="workspace-header">
            <button
              className="mobile-menu icon-button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
            <span>
              <span className="muted">Workspace</span>
              <span className="breadcrumb-slash">/</span>
              {pathname.startsWith("/studio/portfolios/")
                ? "Portfolio editor"
                : links.find((l) => l.url === pathname)?.label || "Overview"}
            </span>
            <div className="workspace-status">
              <span className="status-dot" />
              {user.role === "admin" ? "Admin workspace" : "Client workspace"}
              <ShieldCheck size={16} />
            </div>
          </header>
          <main className="workspace-main">{children}</main>
          <footer className="workspace-footer">
            <span>Brilliancy Research</span>
            <span>Made for the next chapter.</span>
          </footer>
        </div>
      </div>
    </UserContext.Provider>
  );
}
