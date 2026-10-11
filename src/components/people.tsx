"use client";
import { Copy, Plus, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "./studio-shell";
import { PageLoading } from "./page-loading";
import {
  api,
  Badge,
  Button,
  Empty,
  Feedback,
  Field,
  Modal,
  useFeedback,
} from "./ui";
type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  disabled: boolean;
  mfa_enabled: boolean;
};
export function People() {
  const user = useUser(),
    feedback = useFeedback();
  const [users, setUsers] = useState<Account[]>([]),
    [loading, setLoading] = useState(true),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("client"),
    [invitation, setInvitation] = useState("");
  async function load() {
    const result = await api<{ users: Account[] }>("users");
    setUsers(result.users);
  }
  useEffect(() => {
    if (user.role === "admin")
      void feedback.run(load).finally(() => setLoading(false));
  }, []);
  if (user.role !== "admin")
    return (
      <Empty
        icon={<ShieldCheck />}
        title="Administrator access required."
        description="Your administrator manages accounts and permissions."
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORKING TOGETHER</div>
          <h1>People & access.</h1>
          <p>
            Invite researchers and give your team the right level of access.
          </p>
        </div>
        <Button
          onClick={() => {
            setOpen(true);
            setInvitation("");
          }}
        >
          <Plus size={15} /> Invite a person
        </Button>
      </div>
      <Feedback {...feedback} />
      {invitation && !open && (
        <div className="panel">
          <h3>Secure access link</h3>
          <p className="panel-description">
            Share this link privately with the account owner. It expires in 48
            hours and can be used once.
          </p>
          <div className="code-box">{invitation}</div>
          <Button
            variant="secondary"
            onClick={() =>
              void feedback.run(
                () => navigator.clipboard.writeText(invitation),
                "Link copied.",
              )
            }
          >
            <Copy size={14} /> Copy link
          </Button>
        </div>
      )}
      {loading ? (
        <PageLoading label="Loading people and access…" />
      ) : users.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Status</th>
                <th>Security</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id}>
                  <td>
                    <strong>{account.name}</strong>
                    <small>{account.email}</small>
                  </td>
                  <td>{account.role}</td>
                  <td>
                    <Badge value={account.disabled ? "disabled" : "active"} />
                  </td>
                  <td>{account.mfa_enabled ? "2FA enabled" : "Password"}</td>
                  <td>
                    <div className="row wrap">
                      {!account.disabled && (
                        <Button
                          variant="secondary small"
                          onClick={() =>
                            void feedback.run(async () => {
                              const result = await api<{ link: string }>(
                                `users/${account.id}/invite`,
                                { method: "POST" },
                              );
                              setInvitation(result.link);
                            })
                          }
                        >
                          New access link
                        </Button>
                      )}
                      {account.id !== user.id && (
                        <Button
                          variant={
                            account.disabled
                              ? "secondary small"
                              : "danger small"
                          }
                          onClick={() =>
                            void feedback.run(
                              async () => {
                                await api(`users/${account.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({
                                    disabled: !account.disabled,
                                  }),
                                });
                                await load();
                              },
                              account.disabled
                                ? "Account enabled."
                                : "Account disabled and sessions revoked.",
                            )
                          }
                        >
                          {account.disabled ? "Enable" : "Disable"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={<Users />}
          title="Bring your people together."
          description="Invited people will appear here."
        />
      )}
      {open && (
        <Modal
          title="Invite someone to the studio."
          onClose={() => setOpen(false)}
        >
          <Feedback {...feedback} />
          {invitation ? (
            <>
              <p className="panel-description">
                The account has been created. Share this single-use link
                privately with the invited person.
              </p>
              <div className="code-box">{invitation}</div>
              <div className="form-actions">
                <Button
                  variant="secondary"
                  onClick={() =>
                    void feedback.run(
                      () => navigator.clipboard.writeText(invitation),
                      "Copied.",
                    )
                  }
                >
                  <Copy size={14} /> Copy link
                </Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </div>
            </>
          ) : (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void feedback.run(async () => {
                  const result = await api<{ link: string; emailed: boolean }>(
                    "users",
                    {
                      method: "POST",
                      body: JSON.stringify({ name, email, role }),
                    },
                  );
                  setInvitation(result.link);
                  setName("");
                  setEmail("");
                  await load();
                  feedback.setMessage(
                    result.emailed
                      ? "Invitation email sent."
                      : "Email is not connected. You can share the invitation link directly.",
                  );
                });
              }}
            >
              <Field label="Full name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
              </Field>
              <Field label="Email address">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Access level"
                hint="Administrators can manage all portfolios, accounts, and publishing."
              >
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="client">
                    Client — assigned portfolios only
                  </option>
                  <option value="admin">
                    Administrator — full workspace access
                  </option>
                </select>
              </Field>
              <Button type="submit" busy={feedback.busy}>
                Create invitation
              </Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
