import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Filter, PlusCircle } from "lucide-react";

import { ActionPlanClassCombobox } from "@/components/action-plans/ActionPlanClassCombobox";
import { NovoPlanoDialog } from "@/components/action-plans/NovoPlanoDialog";
import { PlanosAcaoTable } from "@/components/action-plans/PlanosAcaoTable";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlanosAcao } from "@/hooks/usePlanosAcao";
import {
  actionPlanStatusOptionList,
  getActionPlanStatusLabel,
} from "@/lib/action-plans";
import {
  canManageActionPlans,
  filterChecklistTeamsByScope,
} from "@/lib/checklist-module";
import { useChecklistSupervisorScope, useChecklistTeams } from "@/modules/checklist/hooks";
import type { ActionPlanNonconformityClass, ActionPlanStatus } from "@/modules/checklist/types";

type FilterState = {
  status: ActionPlanStatus | "all";
  classe: ActionPlanNonconformityClass | "all";
  equipeId: string | "all";
  prazoDe: string;
  prazoAte: string;
};

const initialFilters: FilterState = {
  status: "all",
  classe: "all",
  equipeId: "all",
  prazoDe: "",
  prazoAte: "",
};

export default function PlanosAcao() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [novoDialogOpen, setNovoDialogOpen] = useState(false);
  const { supervisorContext } = useChecklistSupervisorScope();
  const teamsQuery = useChecklistTeams();

  const canManage = canManageActionPlans(supervisorContext);

  const availableTeams = useMemo(
    () => filterChecklistTeamsByScope(teamsQuery.data ?? [], supervisorContext),
    [supervisorContext, teamsQuery.data],
  );

  const planosQuery = usePlanosAcao({
    status: filters.status,
    classe: filters.classe,
    equipeId: filters.equipeId,
    prazoDe: filters.prazoDe || undefined,
    prazoAte: filters.prazoAte || undefined,
  });
  const allPlansQuery = usePlanosAcao({}, { enabled: canManage });

  if (!canManage) {
    return <Navigate to="/meus-planos" replace />;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Gestão de planos de ação</CardTitle>
              <CardDescription>
                Filtre os planos dos centros de custo do seu escopo e acompanhe a execução.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/meus-planos">Minha visão</Link>
              </Button>
              <Button onClick={() => setNovoDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo plano
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
            <CardDescription>
              Status, classe, equipe e intervalo de prazo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value: ActionPlanStatus | "all") =>
                  setFilters((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {actionPlanStatusOptionList.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getActionPlanStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Classe</Label>
              <ActionPlanClassCombobox
                value={filters.classe === "all" ? null : filters.classe}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, classe: value }))
                }
                placeholder="Todas as classes"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs"
                onClick={() =>
                  setFilters((current) => ({ ...current, classe: "all" }))
                }
              >
                Limpar classe
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Equipe</Label>
              <Select
                value={filters.equipeId}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, equipeId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as equipes</SelectItem>
                  {availableTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazo-de">Prazo de</Label>
              <Input
                id="prazo-de"
                type="date"
                value={filters.prazoDe}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, prazoDe: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazo-ate">Prazo até</Label>
              <Input
                id="prazo-ate"
                type="date"
                value={filters.prazoAte}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, prazoAte: event.target.value }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Planos encontrados</CardTitle>
            <CardDescription>
              Resultados filtrados pela RLS e pelo seu escopo de supervisão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {planosQuery.error ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Não foi possível carregar os planos de ação.
              </div>
            ) : (
              <PlanosAcaoTable
                plans={planosQuery.data ?? []}
                isLoading={planosQuery.isLoading}
                showTeam
              />
            )}
          </CardContent>
        </Card>
      </div>

      <NovoPlanoDialog
        open={novoDialogOpen}
        onOpenChange={setNovoDialogOpen}
        existingPlans={allPlansQuery.data ?? []}
      />
    </DashboardLayout>
  );
}
