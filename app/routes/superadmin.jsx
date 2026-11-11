import { Form, Link, Outlet, data, redirect, useLoaderData, useLocation } from "react-router";
import superadminStyles from "../styles/superadmin.css?url";
import toastStyles from "../styles/toast.css?url";
import { SeoToastViewport } from "../components/toast-viewport";
import {
  destroySuperAdminSession,
  getSuperAdminCookieMigrationHeaders,
  requireSuperAdmin,
} from "../services/superadmin-auth.server";

export const links = () => [
  { rel: "stylesheet", href: superadminStyles },
  { rel: "stylesheet", href: toastStyles },
];

export const headers = ({ loaderHeaders }) => loaderHeaders;

function buildCookieResponseHeaders(cookies) {
  const headers = new Headers();
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }
  return headers;
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  if (url.pathname === "/superadmin/login") {
    return { isLoginRoute: true, user: null };
  }

  const user = await requireSuperAdmin(request);
  const migrationCookies = getSuperAdminCookieMigrationHeaders(request);
  if (migrationCookies.length > 0) {
    return data(
      { isLoginRoute: false, user },
      { headers: buildCookieResponseHeaders(migrationCookies) },
    );
  }
  return { isLoginRoute: false, user };
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "logout") {
    const clearCookies = await destroySuperAdminSession(request);
    return redirect("/superadmin/login", {
      headers: buildCookieResponseHeaders(clearCookies),
    });
  }

  return null;
};

export default function SuperAdminLayout() {
  const { isLoginRoute, user } = useLoaderData();
  const location = useLocation();

  if (isLoginRoute) {
    return (
      <>
        <Outlet />
        <SeoToastViewport />
      </>
    );
  }

  const pathname = location.pathname;

  return (
    <div className="sa-shell">
      <header className="sa-topbar">
        <div className="sa-topbar-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <Link to="/superadmin" className="sa-brand">
              <span>Ecom SEO</span>
              <span className="sa-brand-badge">SuperAdmin</span>
            </Link>

            <nav className="sa-nav">
              <Link
                to="/superadmin"
                className={`sa-nav-link ${pathname === "/superadmin" ? "active" : ""}`}
              >
                Stores &amp; Access
              </Link>
              <Link
                to="/superadmin/ai"
                className={`sa-nav-link ${pathname === "/superadmin/ai" ? "active" : ""}`}
              >
                Global AI Credentials
              </Link>
              <Link
                to="/superadmin/users"
                className={`sa-nav-link ${pathname === "/superadmin/users" ? "active" : ""}`}
              >
                Admin Users
              </Link>
            </nav>
          </div>

          <div className="sa-user-bar">
            <span>
              <strong>{user?.name}</strong>{" "}
              <small style={{ color: "#94a3b8" }}>({user?.role})</small>
            </span>
            <Form method="post">
              <input type="hidden" name="intent" value="logout" />
              <button type="submit" className="sa-btn ghost-dark">
                Sign Out
              </button>
            </Form>
          </div>
        </div>
      </header>

      <main className="sa-main">
        <Outlet />
      </main>
      <SeoToastViewport />
    </div>
  );
}

