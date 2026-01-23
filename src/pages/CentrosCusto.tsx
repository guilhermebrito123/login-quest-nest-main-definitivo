import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, RefreshCw } from "lucide-react";

const CentrosCusto = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);
  const syncUrl =
    import.meta.env.VITE_CONVENIA_COST_CENTER_SYNC_URL ||
    (import.meta.env.VITE_LOVABLE_FUNCTIONS_URL
      ? `${import.meta.env.VITE_LOVABLE_FUNCTIONS_URL.replace(/\/$/, "")}/sync-convenia-cost-centers`
      : "https://jcsmwkkytigomvibwsnb.supabase.co/functions/v1/sync-convenia-cost-centers");

  const {
    data: costCenters = [],
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_center")
        .select("id, convenia_id, name, created_at, updated_at")
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredCenters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return costCenters;
    return costCenters.filter((center: any) => {
      const name = center.name?.toLowerCase() || "";
      const conveniaId = center.convenia_id?.toLowerCase() || "";
      return name.includes(term) || conveniaId.includes(term);
    });
  }, [costCenters, searchTerm]);

  const handleSync = async () => {
    if (!syncUrl) {
      toast.error(
        "Configure VITE_CONVENIA_COST_CENTER_SYNC_URL ou VITE_LOVABLE_FUNCTIONS_URL para sincronizar."
      );
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          data?.error ||
          data?.message ||
          `Erro ao sincronizar (status ${response.status})`;
        throw new Error(message);
      }

      const synced = data?.summary?.synced ?? data?.synced;
      const total = data?.summary?.total ?? data?.total;
      const errors = data?.summary?.errors ?? data?.errors;

      if (errors) {
        toast.error(`Sincronizacao concluida com ${errors} erro(s).`);
      } else {
        toast.success(
          typeof synced === "number"
            ? `Sincronizacao concluida: ${synced}/${total ?? synced}`
            : "Sincronizacao concluida com sucesso."
        );
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao sincronizar centros de custo.");
    } finally {
      setSyncing(false);
      await refetch();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Centros de Custo</h1>
            <p className="text-sm text-muted-foreground">
              Lista de centros de custo sincronizados do Convenia.
            </p>
          </div>
          <Button
            onClick={handleSync}
            className="w-full md:w-auto"
            disabled={syncing}
          >
            <RefreshCw className={syncing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            {syncing ? "Sincronizando..." : "Sincronizar Convenia"}
          </Button>
        </div>

        <div className="rounded-md border bg-card">
          <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-semibold">
              {filteredCenters.length} {filteredCenters.length === 1 ? "centro" : "centros"}
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou ID do Convenia"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>ID Convenia</TableHead>
                <TableHead>Atualizado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCenters.length ? (
                filteredCenters.map((center: any) => (
                  <TableRow key={center.id}>
                    <TableCell className="font-medium">{center.name || "-"}</TableCell>
                    <TableCell>{center.convenia_id || "-"}</TableCell>
                    <TableCell>
                      {center.updated_at ? new Date(center.updated_at).toLocaleString() : "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                    {isFetching
                      ? "Carregando centros de custo..."
                      : "Nenhum centro de custo encontrado."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CentrosCusto;
