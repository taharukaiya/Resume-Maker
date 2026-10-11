"use client";
import type { PublicUser } from "@/modules/auth/service";
import {
  Activity,
  ArrowUpRight,
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
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { api } from "./ui";
import { BrandLogo } from "./brand-logo";
import { NavigationLink } from "./navigation-link";
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
  const drawer = useRef<HTMLElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setMobile(query.matches);
      if (!query.matches) setOpen(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    if (workspace.current) workspace.current.inert = true;
    drawer.current?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
        drawer.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled)",
        ) || [],
      );
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    window.document.addEventListener("keydown", key);
    return () => {
      window.document.body.style.overflow = previousOverflow;
      if (workspace.current) workspace.current.inert = false;
      window.document.removeEventListener("keydown", key);
      menuButton.current?.focus();
    };
  }, [open, mobile]);
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
        {open && mobile && (
          <button
            className="navigation-backdrop"
            aria-label="Dismiss navigation"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          ref={drawer}
          id="workspace-navigation"
          className={`sidebar ${open ? "open" : ""}`}
          inert={mobile && !open}
          role={open && mobile ? "dialog" : undefined}
          aria-modal={open && mobile ? true : undefined}
          aria-label={open && mobile ? "Workspace navigation" : undefined}
        >
          <NavigationLink
            href="/studio"
            className="brand-lockup"
            onNavigate={() => setOpen(false)}
          >
            <BrandLogo />
          </NavigationLink>
          <button
            className="mobile-close icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
          <div className="nav-caption">WORKSPACE</div>
          <nav aria-label="Workspace navigation">
            {links.map(({ url, label, icon: Icon }) => (
              <NavigationLink
                key={url}
                href={url}
                onNavigate={() => setOpen(false)}
                aria-current={
                  (
                    url === "/studio"
                      ? pathname === url
                      : pathname.startsWith(url)
                  )
                    ? "page"
                    : undefined
                }
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
              </NavigationLink>
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
        <div ref={workspace} className="workspace">
          <header className="workspace-header">
            <button
              ref={menuButton}
              className="mobile-menu icon-button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
              aria-controls="workspace-navigation"
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
