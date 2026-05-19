import { Dashboard } from "@/src/components/dashboard";
import { getDashboardInitialData } from "@/src/product/dashboardInitialData";

export const dynamic = "force-dynamic";

export default async function Ideas() {
  return <Dashboard initialPage="ideas" initialData={await getDashboardInitialData()} />;
}
