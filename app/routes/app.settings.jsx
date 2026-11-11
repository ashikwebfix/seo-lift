import { redirect } from "react-router";

// AI credentials are managed centrally by SuperAdmin (/superadmin/ai).
// Merchants do not configure AI provider credentials.
export const loader = async () => {
  return redirect("/app");
};

export default function SettingsRemovedRoute() {
  return null;
}
