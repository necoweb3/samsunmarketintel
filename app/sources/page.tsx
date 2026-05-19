import { Dashboard } from "@/src/components/dashboard";
import { getDashboardInitialData } from "@/src/product/dashboardInitialData";

export const dynamic = "force-dynamic";

export default async function Sources() {
  return <Dashboard initialPage="sources" initialData={await getDashboardInitialData()} />;
}
