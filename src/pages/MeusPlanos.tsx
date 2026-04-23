import { Link } from "react-router-dom";

import { PlanosAcaoTable } from "@/components/action-plans/PlanosAcaoTable";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlanosAcao } from "@/hooks/usePlanosAcao";
import { useSession } from "@/hooks/useSession";
import { canManageActionPlans } from "@/lib/checklist-module";
import { useChecklistSupervisorScope } from "@/modules/checklist/hooks";

export default function MeusPlanos() {
  const { session } = useSession();
  const { supervisorContext } = useChecklistSupervisorScope();
  const planosQuery = usePlanosAcao({ assignedUserId: session?.user?.id ?? null });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Meus planos de ação</CardTitle>
              <CardDescription>
                Acompanhe os planos em que você está atribuído como responsável ativo.
              </CardDescription>
            </div>
            {canManageActionPlans(supervisorContext) ? (
              <Button asChild variant="outline">
                <Link to="/planos-acao">Abrir gestão</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {planosQuery.error ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Não foi possível carregar seus planos de ação.
              </div>
            ) : (
              <PlanosAcaoTable
                plans={planosQuery.data ?? []}
                isLoading={planosQuery.isLoading}
                showTeam={true}
                emptyTitle="Nenhum plano atribuído"
                emptyDescription="Quando você for atribuído a um plano de ação, ele aparecerá aqui."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
