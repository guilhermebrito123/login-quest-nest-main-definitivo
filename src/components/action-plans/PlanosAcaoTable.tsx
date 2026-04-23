import { Link } from "react-router-dom";

import { ActionPlanStatusBadge } from "@/components/action-plans/ActionPlanStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PlanoAcaoListItem } from "@/hooks/usePlanosAcao";
import {
  formatActionPlanDateTime,
  getActionPlanClassLabel,
  isActionPlanOverdue,
} from "@/lib/action-plans";
import { cn } from "@/lib/utils";

type PlanosAcaoTableProps = {
  plans: PlanoAcaoListItem[];
  isLoading?: boolean;
  showTeam?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function PlanosAcaoTable({
  plans,
  isLoading = false,
  showTeam = true,
  emptyTitle = "Nenhum plano encontrado",
  emptyDescription = "Ajuste os filtros ou crie um novo plano de ação.",
}: PlanosAcaoTableProps) {
  const columnCount = showTeam ? 6 : 5;

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plano</TableHead>
            {showTeam ? <TableHead>Equipe</TableHead> : null}
            <TableHead>Status</TableHead>
            <TableHead>Classe</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`loading-${index}`}>
                  <TableCell>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-3 w-60" />
                    </div>
                  </TableCell>
                  {showTeam ? (
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Skeleton className="h-6 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-9 w-20" />
                  </TableCell>
                </TableRow>
              ))
            : null}

          {!isLoading && !plans.length ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-12 text-center">
                <div className="space-y-1">
                  <p className="font-medium">{emptyTitle}</p>
                  <p className="text-sm text-muted-foreground">{emptyDescription}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : null}

          {!isLoading
            ? plans.map((plan) => {
                const overdue = isActionPlanOverdue(plan.prazo_em, plan.status);

                return (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {plan.nao_conformidades_resumo}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {plan.instance?.titulo_snapshot ?? "Instância de origem não disponível"}
                        </p>
                      </div>
                    </TableCell>
                    {showTeam ? (
                      <TableCell>{plan.team?.nome ?? "Sem equipe"}</TableCell>
                    ) : null}
                    <TableCell>
                      <ActionPlanStatusBadge status={plan.status} />
                    </TableCell>
                    <TableCell>
                      {getActionPlanClassLabel(plan.classe_nao_conformidade)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          overdue && "font-medium text-destructive",
                        )}
                      >
                        {formatActionPlanDateTime(plan.prazo_em)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/planos-acao/${plan.id}`}>Abrir</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            : null}
        </TableBody>
      </Table>
    </div>
  );
}
