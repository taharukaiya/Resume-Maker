"use client";
import type { ListedSite } from "@/modules/portfolios/service";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  FileEdit,
  Globe,
  PanelsTopLeft,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "./studio-shell";
import { NavigationLink } from "./navigation-link";
import { PageLoading } from "./page-loading";
import { DeletePortfolio } from "./delete-portfolio";
import {
  api,
  Badge,
  Button,
  dateTime,
  Empty,
  Feedback,
  Field,
  Modal,
  useFeedback,
} from "./ui";
type Client = {
  id: string;
  name: string;
  email: string;
  role: string;
  disabled: boolean;
};
export function PortfolioList({ overview = false }: { overview?: boolean }) {
  const user = useUser(),
    router = useRouter(),
    feedback = useFeedback();
  const [sites, setSites] = useState<ListedSite[]>([]),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [creating, setCreating] = useState(false),
    [deleteTarget, setDeleteTarget] = useState<ListedSite | null>(null),
    [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [clientId, setClientId] = useState(""),
    [clients, setClients] = useState<Client[]>([]);
  useEffect(() => {
    api<{ sites: ListedSite[] }>("sites")
      .then((data) => setSites(data.sites))
      .catch((e) => feedback.setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  function openCreate() {
    setCreating(true);
    if (user.role === "admin")
      api<{ users: Client[] }>("users")
        .then((data) =>
          setClients(
            data.users.filter((u) => u.role === "client" && !u.disabled),
          ),
        )
        .catch((e) => feedback.setError(e.message));
  }
  const visible = sites.filter(
    (s) =>
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.slug.includes(search.toLowerCase())) &&
      (filter === "all" ||
        (filter === "incomplete"
          ? (s.completion?.percentage ?? 100) < 100
          : s.status === filter)),
  );
  const metrics = [
    {
      label: "Total portfolios",
      value: sites.length,
      note: "Academic stories in your care",
      icon: PanelsTopLeft,
    },
    {
      label: "Published websites",
      value: sites.filter((s) => s.published_release_id).length,
      note: "Available to the world",
      icon: Globe,
    },
    {
      label: "Awaiting review",
      value: sites.filter((s) => s.status === "review").length,
      note: "Client changes to consider",
      icon: Clock,
    },
    {
      label: "Draft portfolios",
      value: sites.filter((s) => !s.published_release_id).length,
      note: "Taking shape behind the scenes",
      icon: FileEdit,
    },
  ];
  return (
    <>
      <Feedback {...feedback} />
      {overview ? (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR RESEARCH WORKSPACE</div>
              <h1>Good to see you, {user.name.split(" ")[0]}.</h1>
              <p>A little perspective on the portfolios you’re shaping.</p>
            </div>
            <span className="muted" style={{ fontSize: 10 }}>
              {new Intl.DateTimeFormat(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              }).format(new Date())}
            </span>
          </div>
          <section className="welcome-card">
            <div>
              <span className="eyebrow">
                BIG IDEAS. BRIGHTER POSSIBILITIES.
              </span>
              <h1>
                A home for every
                <br />
                research journey.
              </h1>
              <p>
                Bring academic achievements together in a portfolio that opens
                doors to what comes next.
              </p>
              {user.role === "admin" ? (
                <Button onClick={openCreate}>
                  Create a portfolio <Plus size={14} />
                </Button>
              ) : (
                <NavigationLink href="/studio/portfolios" className="button">
                  Your portfolios <ArrowRight size={14} />
                </NavigationLink>
              )}
            </div>
            <div className="welcome-art" aria-hidden="true">
              <div className="art-orbit" />
              <div className="art-paper back" />
              <div className="art-paper">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <span className="art-spark">✳</span>
            </div>
          </section>
          <div className="metrics">
            {metrics.map(({ label, value, note, icon: Icon }) => (
              <div className="metric" key={label}>
                <div className="metric-label">
                  {label}
                  <Icon size={16} />
                </div>
                <div className="metric-value">
                  {loading ? "—" : String(value).padStart(2, "0")}
                </div>
                <div className="metric-foot">{note}</div>
              </div>
            ))}
          </div>
          <div className="section-title">
            <h2>Recent portfolios</h2>
            <NavigationLink href="/studio/portfolios">
              View all portfolios <ArrowRight size={13} />
            </NavigationLink>
          </div>
        </>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">ACADEMIC STORIES</div>
              <h1>Your portfolios.</h1>
              <p>
                {user.role === "admin"
                  ? "Create, refine, and publish a home for every researcher."
                  : "Update the fields your administrator has made available to you."}
              </p>
            </div>
            {user.role === "admin" && (
              <Button onClick={openCreate}>
                <Plus size={15} /> Create portfolio
              </Button>
            )}
          </div>
          <div className="toolbar">
            <div className="search-box">
              <Search size={16} />
              <input
                aria-label="Search portfolios"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or address"
              />
            </div>
            <select
              aria-label="Filter portfolio status"
              style={{ maxWidth: 170 }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All portfolios</option>
              <option value="incomplete">Needs work</option>
              <option value="published">Published</option>
              <option value="review">Awaiting review</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </>
      )}
      {loading ? (
        <PageLoading label="Loading your workspace…" />
      ) : visible.length ? (
        <div className="portfolio-grid">
          {(overview ? visible.slice(0, 6) : visible).map((site) => (
            <article
              key={site.id}
              className="portfolio-card"
              aria-label={site.name}
            >
              <NavigationLink
                prefetchOnIntent
                href={`/studio/portfolios/${site.id}`}
                className="portfolio-card-link"
              >
                <div className="portfolio-thumb">
                  <span className="portfolio-monogram">
                    {site.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div className="portfolio-lines" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <span style={{ position: "absolute", right: 13, top: 12 }}>
                    <Badge value={site.status} />
                  </span>
                </div>
                <div className="portfolio-card-content">
                  <h3>{site.name}</h3>
                  <p>{site.publishedUrl || `/portfolio/${site.slug}`}</p>
                  {site.completion && (
                    <div className="portfolio-list-progress">
                      <div className="spread wrap">
                        <strong>{site.completion.percentage}% complete</strong>
                        <span>Saved draft</span>
                      </div>
                      <progress
                        aria-label={`Completion for ${site.name}`}
                        max={100}
                        value={site.completion.percentage}
                      />
                    </div>
                  )}
                  <div className="card-bottom">
                    <span>Updated {dateTime(site.updated_at)}</span>
                    <ArrowUpRight size={14} />
                  </div>
                </div>
              </NavigationLink>
              {user.role === "admin" && site.completion && (
                <div className="portfolio-list-missing">
                  {site.completion.missing.length ? (
                    <details>
                      <summary>
                        What’s missing ({site.completion.missing.length})
                      </summary>
                      <ul>
                        {site.completion.missing.map((item) => (
                          <li key={item.id}>
                            <NavigationLink
                              href={`/studio/portfolios/${site.id}?complete=${encodeURIComponent(item.id)}`}
                              prefetchOnIntent
                            >
                              {item.label} <span aria-hidden="true">→</span>
                            </NavigationLink>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <span>
                      All content areas complete · Publishing is separate
                    </span>
                  )}
                </div>
              )}
              {user.role === "admin" && (
                <div className="portfolio-card-actions">
                  <NavigationLink
                    className="button secondary small"
                    href={`/studio/portfolios/${site.id}`}
                  >
                    <FileEdit size={14} /> Edit portfolio
                  </NavigationLink>
                  <Button
                    variant="danger small"
                    aria-label={`Delete portfolio for ${site.name}`}
                    onClick={() => setDeleteTarget(site)}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<PanelsTopLeft size={24} />}
          title={
            search ? "No matching portfolios." : "The next chapter starts here."
          }
          description={
            user.role === "admin"
              ? "Create your first researcher portfolio, add their work, and publish when it’s ready."
              : "Your administrator will assign your portfolio here. Once assigned, you can edit the fields they’ve unlocked."
          }
        >
          {user.role === "admin" && !search && (
            <Button onClick={openCreate}>
              <Plus size={14} /> Create your first portfolio
            </Button>
          )}
        </Empty>
      )}
      {overview && (
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <h3>Make it personal</h3>
            <p>
              Shape a considered profile around each researcher’s work and
              ambitions.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">02</div>
            <h3>Refine every detail</h3>
            <p>
              Review content, select a design, and choose exactly what clients
              can edit.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">03</div>
            <h3>Ready for the world</h3>
            <p>
              Publish an approved version that loads quickly and reads
              beautifully.
            </p>
          </div>
        </div>
      )}
      {creating && (
        <Modal
          title="A new research journey."
          onClose={() => setCreating(false)}
        >
          <Feedback {...feedback} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void feedback.run(async () => {
                const result = await api<{ id: string }>("sites", {
                  method: "POST",
                  body: JSON.stringify({ name, slug, clientId }),
                });
                router.push(`/studio/portfolios/${result.id}`);
              });
            }}
            className="stack"
          >
            <Field label="Researcher’s name">
              <input
                required
                autoFocus
                maxLength={120}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .normalize("NFKD")
                      .replace(/[^a-z0-9\s-]/g, "")
                      .trim()
                      .replace(/[\s-]+/g, "-"),
                  );
                }}
              />
            </Field>
            <Field
              label="Portfolio address"
              hint="Lowercase letters, numbers, and hyphens. This address stays stable after creation."
            >
              <input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={60}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </Field>
            <Field
              label="Client account"
              hint="You can assign an account later in the Permissions tab."
            >
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Managed by the agency</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.email}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
              <Button type="submit" busy={feedback.busy}>
                Create portfolio <ArrowRight size={14} />
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {user.role === "admin" && deleteTarget && (
        <DeletePortfolio
          id={deleteTarget.id}
          name={deleteTarget.name}
          slug={deleteTarget.slug}
          revision={deleteTarget.revision}
          published={!!deleteTarget.published_release_id}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setSites((current) =>
              current.filter((site) => site.id !== deleteTarget.id),
            );
            setDeleteTarget(null);
            feedback.setError("");
            feedback.setMessage(
              `${deleteTarget.name}’s portfolio was deleted.`,
            );
          }}
        />
      )}
    </>
  );
}
