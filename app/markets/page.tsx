import { Dashboard } from "@/src/components/dashboard";
import { getDashboardInitialData } from "@/src/product/dashboardInitialData";

export const dynamic = "force-dynamic";

export default async function Markets() {
  return <Dashboard initialPage="markets" initialData={await getDashboardInitialData()} />;
}
