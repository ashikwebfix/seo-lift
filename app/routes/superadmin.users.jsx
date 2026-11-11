import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import {
  createSuperAdminUser,
  deleteSuperAdminUser,
  listSuperAdminUsers,
  requireSuperAdmin,
  toggleSuperAdminStatus,
} from "../services/superadmin-auth.server";

export const loader = async ({ request }) => {
  const currentUser = await requireSuperAdmin(request);
  const users = await listSuperAdminUsers();
  return { currentUser, users };
};

export const action = async ({ request }) => {
  const actingUser = await requireSuperAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  try {
    if (intent === "createUser") {
      const name = String(formData.get("name") || "");
      const username = String(formData.get("username") || formData.get("email") || "");
      const password = String(formData.get("password") || "");
      const role = String(formData.get("role") || "ADMIN");

      const created = await createSuperAdminUser({ name, username, password, role });
      return { ok: true, message: `Created new ${created.role} user: ${created.email}` };
    }

    if (intent === "toggleStatus") {
      const targetUserId = String(formData.get("targetUserId") || "");
      const nextActive = formData.get("nextActive") === "true";
      const updated = await toggleSuperAdminStatus({
        targetUserId,
        actingUserId: actingUser.id,
        isActive: nextActive,
      });
      return {
        ok: true,
        message: `${updated.email} is now ${updated.isActive ? "Active" : "Disabled"}.`,
      };
    }

    if (intent === "deleteUser") {
      const targetUserId = String(formData.get("targetUserId") || "");
      await deleteSuperAdminUser({
        targetUserId,
        actingUserId: actingUser.id,
      });
      return { ok: true, message: "Admin user removed." };
    }

    return { ok: false, error: "Unsupported action." };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to update admin users.",
    };
  }
};

export default function SuperAdminUsersPage() {
  const { currentUser, users } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="sa-grid">
      {actionData?.error ? <div className="sa-alert error">{actionData.error}</div> : null}
      {actionData?.ok && actionData?.message ? <div className="sa-alert success">{actionData.message}</div> : null}

      {/* ─── Create New Admin User ─── */}
      <div className="sa-card sa-grid">
        <div>
          <h3 style={{ margin: 0 }}>Create New Admin User</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sa-muted)" }}>
            Create additional SuperAdmin accounts using a username or email address. The fixed primary owner account cannot be removed or disabled.
          </p>
        </div>

        <Form method="post" className="sa-grid">
          <input type="hidden" name="intent" value="createUser" />

          <div className="sa-grid-2">
            <div className="sa-field">
              <label>Full Name</label>
              <input name="name" type="text" required placeholder="Jane Doe" className="sa-input" />
            </div>

            <div className="sa-field">
              <label>Username or Email</label>
              <input
                name="username"
                type="text"
                required
                placeholder="teamadmin or jane@yourdomain.com"
                className="sa-input"
              />
            </div>

            <div className="sa-field">
              <label>Password (min 8 chars)</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Strong password"
                className="sa-input"
              />
            </div>

            <div className="sa-field">
              <label>Role</label>
              <select name="role" className="sa-select" defaultValue="ADMIN">
                <option value="ADMIN">ADMIN</option>
                <option value="OWNER">OWNER</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="sa-btn" disabled={isSubmitting}>
              {isSubmitting ? "Creating User..." : "+ Create Admin User"}
            </button>
          </div>
        </Form>
      </div>

      {/* ─── Existing Admin Users Table ─── */}
      <div className="sa-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--sa-border-soft)" }}>
          <h3 style={{ margin: 0 }}>SuperAdmin Users ({users.length})</h3>
        </div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username / Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>{" "}
                      {isSelf ? <span className="sa-pill info">You</span> : null}{" "}
                      {u.isFixed ? <span className="sa-pill super">Fixed</span> : null}
                    </td>
                    <td><code>{u.email}</code></td>
                    <td>
                      <span className={`sa-pill ${u.role === "OWNER" ? "super" : "info"}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className={`sa-pill ${u.isActive ? "good" : "bad"}`}>
                        {u.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                    <td>
                      {isSelf || u.isFixed ? (
                        <small style={{ color: "var(--sa-muted)" }}>
                          {u.isFixed ? "Protected fixed owner" : "Current session"}
                        </small>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <Form method="post">
                            <input type="hidden" name="intent" value="toggleStatus" />
                            <input type="hidden" name="targetUserId" value={u.id} />
                            <input type="hidden" name="nextActive" value={String(!u.isActive)} />
                            <button type="submit" className="sa-btn secondary" style={{ padding: "5px 10px", fontSize: 12 }}>
                              {u.isActive ? "Disable" : "Enable"}
                            </button>
                          </Form>
                          <Form method="post">
                            <input type="hidden" name="intent" value="deleteUser" />
                            <input type="hidden" name="targetUserId" value={u.id} />
                            <button type="submit" className="sa-btn danger" style={{ padding: "5px 10px", fontSize: 12 }}>
                              Delete
                            </button>
                          </Form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
