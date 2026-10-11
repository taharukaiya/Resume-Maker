"use client";
import { useEffect, useState } from "react";
import { api, dateTime, Feedback, useFeedback } from "./ui";
import { PageLoading } from "./page-loading";
type Event = {
  id: string;
  actor: string | null;
  site_name: string | null;
  action: string;
  created_at: string;
  details: Record<string, unknown>;
};
export function Activity() {
  const feedback = useFeedback();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void feedback
      .run(async () => {
        const result = await api<{ events: Event[] }>("audit");
        setEvents(result.events);
      })
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A CLEAR RECORD</div>
          <h1>Workspace activity.</h1>
          <p>
            Account changes, content revisions, and publishing events. Latest
            200 events.
          </p>
        </div>
      </div>
      <Feedback {...feedback} />
      {loading ? (
        <PageLoading label="Loading workspace activity…" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Person</th>
                <th>Portfolio</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    {event.action.replaceAll(".", " · ").replaceAll("_", " ")}
                    {typeof event.details.revision === "number" && (
                      <small>Revision {event.details.revision}</small>
                    )}
                  </td>
                  <td>{event.actor || "Publishing service"}</td>
                  <td>{event.site_name || "Workspace"}</td>
                  <td>{dateTime(event.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
