/**
 * /analytics root — redirects to /analytics/overview.
 */
import { redirect } from "next/navigation";

export default function AnalyticsPage() {
  redirect("/analytics/overview");
}
