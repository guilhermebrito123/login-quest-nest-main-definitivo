import { DashboardLayout } from "@/components/DashboardLayout";
import { DiariasTemporariasLogs } from "./DiariasTemporariasLogs";

const DiariasTemporariasLogsPage = () => (
  <DashboardLayout>
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-wide">Diárias</p>
        <h1 className="text-3xl font-bold">Logs</h1>
        <p className="text-sm text-muted-foreground">Histórico de operações registradas.</p>
      </div>
      <DiariasTemporariasLogs />
    </div>
  </DashboardLayout>
);

export default DiariasTemporariasLogsPage;
