"use client";

import { createAdminUser, updateAdminUser } from "./actions";
import { useMemo, useState } from "react";

type UserItem = {
  id: string;
  displayName: string | null;
  email: string;
  createdAt: Date;
};

type UsersClientProps = {
  users: UserItem[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function UserFormFields({
  user,
  requirePassword,
}: {
  user?: UserItem;
  requirePassword: boolean;
}) {
  return (
    <>
      {user ? <input type="hidden" name="id" value={user.id} /> : null}
      <label className="field">
        <span>Name</span>
        <input
          name="displayName"
          defaultValue={user?.displayName ?? ""}
          required
          placeholder="Max Mustermann"
        />
      </label>
      <label className="field">
        <span>E-Mail</span>
        <input
          name="email"
          type="email"
          defaultValue={user?.email ?? ""}
          required
          placeholder="user@example.com"
        />
      </label>
      <label className="field">
        <span>{requirePassword ? "Passwort" : "Neues Passwort (optional)"}</span>
        <input
          name="password"
          type="password"
          minLength={8}
          required={requirePassword}
          placeholder={requirePassword ? "Mind. 8 Zeichen" : "Leer lassen = unverändert"}
        />
      </label>
    </>
  );
}

export function UsersClient({ users }: UsersClientProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const search = normalize(searchValue);

  const filteredUsers = useMemo(() => {
    if (!search) {
      return users;
    }

    return users.filter((user) =>
      `${user.displayName ?? ""} ${user.email}`.toLowerCase().includes(search),
    );
  }, [users, search]);

  const editingUser = useMemo(
    () => users.find((user) => user.id === editingUserId) ?? null,
    [users, editingUserId],
  );

  return (
    <main className="admin-page-stack">
      <header className="admin-page-head">
        <div>
          <h1 className="page-title" style={{ fontSize: "1.7rem" }}>
            Benutzerverwaltung
          </h1>
          <p className="muted">Admins koennen Benutzer mit Name, E-Mail und Passwort anlegen und bearbeiten.</p>
        </div>

        <button
          type="button"
          className="admin-plus-button"
          onClick={() => setIsCreateOpen(true)}
        >
          + Neu
        </button>
      </header>

      <section className="admin-toolbar">
        <label className="field admin-toolbar-search">
          <span>Suche</span>
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Name oder E-Mail..."
          />
        </label>
      </section>

      <section className="admin-list-stack">
        {filteredUsers.length === 0 ? (
          <p className="muted">Keine Benutzer gefunden.</p>
        ) : (
          filteredUsers.map((user) => (
            <article key={user.id} className="admin-list-card">
              <div className="admin-list-card-head">
                <div className="admin-list-title-wrap">
                  <h2>{user.displayName ?? "Ohne Namen"}</h2>
                  <p className="muted">{user.email}</p>
                </div>
                <span className="role-pill">
                  seit {new Date(user.createdAt).toLocaleDateString("de-DE")}
                </span>
              </div>

              <div className="admin-card-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditingUserId(user.id)}
                >
                  Bearbeiten
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {isCreateOpen ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Benutzer erstellen</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              action={createAdminUser}
              className="form-grid"
              style={{ maxWidth: "100%" }}
              onSubmit={() => setIsCreateOpen(false)}
            >
              <UserFormFields requirePassword />
              <button type="submit">Speichern</button>
            </form>
          </div>
        </div>
      ) : null}

      {editingUser ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setEditingUserId(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Benutzer bearbeiten</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setEditingUserId(null)}
              >
                ×
              </button>
            </div>

            <form
              action={updateAdminUser}
              className="form-grid"
              style={{ maxWidth: "100%" }}
              onSubmit={() => setEditingUserId(null)}
            >
              <UserFormFields user={editingUser} requirePassword={false} />
              <button type="submit">Aktualisieren</button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
