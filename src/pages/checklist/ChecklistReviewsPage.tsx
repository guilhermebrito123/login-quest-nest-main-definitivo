import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import {
  ChecklistAccessStateCard,
  ChecklistModuleLayout,
} from "@/components/checklist/ChecklistModuleLayout";
import {
  EmptyState,
  EntityTable,
  FilterBar,
  PanelToggleButton,
  SectionCard,
  SidePanel,
} from "@/components/checklist/ChecklistMvp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  canViewChecklistReviews,
  checklistInstanceStatusLabels,
  checklistReviewDecisionLabels,
  filterChecklistReviewsByScope,
  getChecklistPermissionMessage,
  isChecklistPermissionError,
} from "@/lib/checklist-module";
import {
  useChecklistReviewItems,
  useChecklistReviews,
  useChecklistSupervisorScope,
} from "@/modules/checklist/hooks";

type DecisionFilter = "all" | "approved" | "rejected" | "needs_action_plan" | "needs_adjustment";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

export default function ChecklistReviewsPage() {
  const { supervisorContext } = useChecklistSupervisorScope();
  const {
    data: reviews = [],
    isLoading,
    error,
    refetch,
  } = useChecklistReviews();
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const scopedReviews = useMemo(
    () => filterChecklistReviewsByScope(reviews, supervisorContext),
    [reviews, supervisorContext],
  );

  const filteredReviews = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return scopedReviews.filter((review) => {
      const matchesSearch =
        !normalized ||
        review.instance?.titulo_snapshot?.toLowerCase().includes(normalized) ||
        review.reviewer?.full_name?.toLowerCase().includes(normalized) ||
        review.reviewer?.email?.toLowerCase().includes(normalized) ||
        review.comentario_avaliacao?.toLowerCase().includes(normalized);

      const matchesDecision = decisionFilter === "all" || review.decisao === decisionFilter;
      return matchesSearch && matchesDecision;
    });
  }, [decisionFilter, scopedReviews, search]);

  const selectedReview =
    filteredReviews.find((review) => review.id === selectedReviewId) ??
    filteredReviews[0] ??
    null;

  const {
    data: reviewItems = [],
    isLoading: reviewItemsLoading,
    error: reviewItemsError,
  } = useChecklistReviewItems(selectedReview?.id ?? "");

  useEffect(() => {
    if (!selectedReview) {
      setSelectedReviewId("");
      setMobileDetailOpen(false);
      return;
    }

    setSelectedReviewId((current) => {
      if (!current) return selectedReview.id;
      return filteredReviews.some((review) => review.id === current) ? current : selectedReview.id;
    });
  }, [filteredReviews, selectedReview]);

  const loadError = error ?? reviewItemsError;

  return (
    <ChecklistModuleLayout
      title="Avaliações"
      description="Lista de revisões com leitura rápida e detalhe contextual."
      currentPath="/checklists/avaliacoes"
      canAccessPage={canViewChecklistReviews}
      actions={
        <Button variant="outline" onClick={() => void refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      }
    >
      {loadError && isChecklistPermissionError(loadError) ? (
        <ChecklistAccessStateCard
          title="Leitura bloqueada pelo banco"
          description={getChecklistPermissionMessage("carregar as avaliações")}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SectionCard
            title="Avaliações registradas"
            description="Use a lista para localizar rapidamente a revisão desejada."
          >
            <div className="space-y-4">
              <FilterBar>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por instância, avaliador ou comentário"
                />
                <Select
                  value={decisionFilter}
                  onValueChange={(value: DecisionFilter) => setDecisionFilter(value)}
                >
                  <SelectTrigger className="w-full md:w-56">
                    <SelectValue placeholder="Decisão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as decisões</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Reprovado</SelectItem>
                    <SelectItem value="needs_action_plan">Exige plano de ação</SelectItem>
                    <SelectItem value="needs_adjustment">Precisa de ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </FilterBar>

              <EntityTable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instância</TableHead>
                    <TableHead>Decisão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Avaliador</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Carregando avaliações...
                      </TableCell>
                    </TableRow>
                  ) : filteredReviews.length ? (
                    filteredReviews.map((review) => (
                      <TableRow key={review.id} className={review.id === selectedReview?.id ? "bg-muted/40" : undefined}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{review.instance?.titulo_snapshot || "Instância sem título"}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(review.avaliado_em ?? review.created_at)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{checklistReviewDecisionLabels[review.decisao]}</Badge>
                        </TableCell>
                        <TableCell>
                          {review.instance?.status ? checklistInstanceStatusLabels[review.instance.status] : "-"}
                        </TableCell>
                        <TableCell>{review.reviewer?.full_name || review.reviewer?.email || "-"}</TableCell>
                        <TableCell className="text-right">
                          <PanelToggleButton
                            label="Ver detalhe"
                            onClick={() => {
                              setSelectedReviewId(review.id);
                              setMobileDetailOpen(true);
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="p-4">
                        <EmptyState
                          title="Sem avaliações"
                          description="Nenhuma avaliação encontrada com os filtros atuais."
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </EntityTable>
            </div>
          </SectionCard>

          <SidePanel
            open={!!selectedReview && mobileDetailOpen}
            onOpenChange={setMobileDetailOpen}
            title={selectedReview ? "Detalhe da avaliação" : "Detalhe"}
            description="Resumo da revisão e itens avaliados."
          >
            {selectedReview ? (
              <div className="space-y-4">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{checklistReviewDecisionLabels[selectedReview.decisao]}</Badge>
                    <Badge variant="outline">
                      {selectedReview.plano_acao_necessario ? "Plano obrigatório" : "Sem plano"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                    <div>Instância: {selectedReview.instance?.titulo_snapshot || "-"}</div>
                    <div>Avaliador: {selectedReview.reviewer?.full_name || selectedReview.reviewer?.email || "-"}</div>
                    <div>
                      Status da instância:{" "}
                      {selectedReview.instance?.status
                        ? checklistInstanceStatusLabels[selectedReview.instance.status]
                        : "-"}
                    </div>
                    <div>Avaliada em: {formatDateTime(selectedReview.avaliado_em ?? selectedReview.created_at)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Comentário geral</p>
                  <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
                    {selectedReview.comentario_avaliacao || "Sem comentário registrado."}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Itens avaliados</p>
                    <Badge variant="secondary">{reviewItems.length}</Badge>
                  </div>

                  {reviewItemsLoading ? (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      Carregando itens da avaliação...
                    </div>
                  ) : reviewItems.length ? (
                    <div className="space-y-3">
                      {reviewItems.map((item) => (
                        <div key={item.id} className="rounded-2xl border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{item.task?.titulo_snapshot || "Tarefa sem título"}</p>
                              <p className="text-xs text-muted-foreground">Ordem {item.task?.ordem ?? "-"}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{item.resultado_conformidade}</Badge>
                              <Badge variant="secondary">Nota {item.nota != null ? item.nota : "-"}</Badge>
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground">
                            {item.feedback || "Sem feedback registrado para este item."}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Sem itens"
                      description="Esta avaliação ainda não possui itens detalhados."
                      className="min-h-[120px]"
                    />
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Selecione uma avaliação"
                description="Abra uma linha da lista para inspecionar a revisão e os itens avaliados."
                className="min-h-[220px]"
              />
            )}
          </SidePanel>
        </div>
      )}
    </ChecklistModuleLayout>
  );
}
