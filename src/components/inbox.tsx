"use client";
import { Check, Inbox as InboxIcon, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { PageLoading } from "./page-loading";
import {
  api,
  Badge,
  Button,
  dateTime,
  Empty,
  Feedback,
  useFeedback,
} from "./ui";
type Inquiry = {
  id: string;
  site_name: string;
  name: string;
  email: string;
  message: string;
  read_at: string | null;
  created_at: string;
};
export function Inbox() {
  const feedback = useFeedback();
  const [items, setItems] = useState<Inquiry[]>([]),
    [loading, setLoading] = useState(true),
    [filter, setFilter] = useState("all");
  async function load() {
    const result = await api<{ inquiries: Inquiry[] }>("inquiries");
    setItems(result.inquiries);
  }
  useEffect(() => {
    void feedback.run(load).finally(() => setLoading(false));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">NEW CONNECTIONS</div>
          <h1>Your inbox.</h1>
          <p>
            Research collaborations and inquiries from published portfolios.
          </p>
        </div>
        <select
          aria-label="Filter inquiries"
          style={{ maxWidth: 160 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All messages</option>
          <option value="unread">Unread messages</option>
        </select>
      </div>
      <Feedback {...feedback} />
      {loading && <PageLoading label="Loading messages…" />}
      {items
        .filter((i) => filter === "all" || !i.read_at)
        .map((item) => (
          <article
            className={`message-card ${item.read_at ? "" : "unread"}`}
            key={item.id}
          >
            <div className="spread wrap">
              <div>
                <strong>{item.name}</strong>
                <div className="message-meta">
                  {item.email} · {item.site_name}
                </div>
              </div>
              <div className="row">
                <span className="message-meta">
                  {dateTime(item.created_at)}
                </span>
                {!item.read_at && <Badge value="new" />}
              </div>
            </div>
            <p>{item.message}</p>
            <div className="row">
              <a
                className="button secondary small"
                href={`mailto:${encodeURIComponent(item.email)}`}
              >
                <Mail size={13} /> Reply by email
              </a>
              {!item.read_at && (
                <Button
                  variant="ghost small"
                  onClick={() =>
                    void feedback.run(async () => {
                      await api(`inquiries/${item.id}`, { method: "PATCH" });
                      await load();
                    })
                  }
                >
                  <Check size={13} /> Mark read
                </Button>
              )}
            </div>
          </article>
        ))}
      {!loading &&
        !feedback.error &&
        !items.some((i) => filter === "all" || !i.read_at) && (
          <Empty
            icon={<InboxIcon />}
            title="Room for a new connection."
            description="Messages sent through a portfolio’s contact form will appear here."
          />
        )}
    </>
  );
}
