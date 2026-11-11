import { Form, redirect, useActionData, useNavigation } from "react-router";
import superadminStyles from "../styles/superadmin.css?url";
import {
  authenticateSuperAdmin,
  createSuperAdminSession,
  ensureFixedSuperAdmin,
  getAuthenticatedSuperAdmin,
} from "../services/superadmin-auth.server";

export const links = () => [{ rel: "stylesheet", href: superadminStyles }];

export const loader = async ({ request }) => {
  await ensureFixedSuperAdmin();
  const currentUser = await getAuthenticatedSuperAdmin(request);
  if (currentUser) {
    throw redirect("/superadmin");
  }
  return {};
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");

  try {
    const user = await authenticateSuperAdmin({ username, password });
    const cookie = await createSuperAdminSession(user.id, request);
    return redirect("/superadmin", {
      headers: { "Set-Cookie": cookie },
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Authentication failed.",
    };
  }
};

export default function SuperAdminLoginPage() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="sa-auth-page">
      <div className="sa-auth-card">
        <div>
          <span className="sa-pill super" style={{ marginBottom: 10 }}>
            Restricted Control Plane
          </span>
          <h1 style={{ margin: "6px 0 4px", fontSize: 24, fontFamily: "Space Grotesk, sans-serif" }}>
            SuperAdmin Sign In
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "#475569" }}>
            Sign in to manage Shopify stores, feature access, tokens, and shared Gemini AI credentials.
          </p>
        </div>

        {actionData?.error ? <div className="sa-alert error">{actionData.error}</div> : null}

        <Form method="post" className="sa-grid">
          <div className="sa-field">
            <label htmlFor="sa-username">Username or Email</label>
            <input
              id="sa-username"
              name="username"
              type="text"
              required
              autoComplete="username"
              placeholder="ecomfixr"
              className="sa-input"
            />
          </div>

          <div className="sa-field">
            <label htmlFor="sa-password">Password</label>
            <input
              id="sa-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter password"
              className="sa-input"
            />
          </div>

          <button
            type="submit"
            className="sa-btn"
            style={{ width: "100%", padding: "12px", fontSize: 14 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing In..." : "Sign In to SuperAdmin"}
          </button>
        </Form>
      </div>
    </div>
  );
}
