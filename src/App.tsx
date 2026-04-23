import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/hooks/useSession";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Dashboard24h from "./pages/Dashboard24h";
import UserManagement from "./pages/UserManagement";
import ResetPassword from "./pages/ResetPassword";
import RecuperarAcesso from "./pages/RecuperarAcesso";
import RecuperacoesAdmin from "./pages/RecuperacoesAdmin";
import Chamados from "./pages/Chamados";
import ChamadosHistorico from "./pages/ChamadosHistorico";
import Contratos from "./pages/Contratos";
import MesaOperacoes from "./pages/MesaOperacoes";
import OrdensServico from "./pages/OrdensServico";
import Colaboradores from "./pages/Colaboradores";
import CentrosCusto from "./pages/CentrosCusto";
import LocaisCentroCusto from "./pages/LocaisCentroCusto";
import PostosServico from "./pages/PostosServico";
import Escalas from "./pages/Escalas";
import Ativos from "./pages/Ativos";
import Estoque from "./pages/Estoque";
import Diaristas from "./pages/Diaristas";
import DiaristasRestritos from "./pages/DiaristasRestritos";
import DiaristasLogs from "./pages/DiaristasLogs";
import {
  DiariasAguardandoPage,
  DiariasConfirmadasPage,
  DiariasAprovadasPage,
  DiariasLancadasPage,
  DiariasReprovadasPage,
  DiariasCanceladasPage,
  DiariasPagasPage,
} from "./pages/diarias/DiariasStatusPages";
import {
  Diarias2AguardandoPage,
  Diarias2ConfirmadasPage,
  Diarias2AprovadasPage,
  Diarias2LancadasPage,
  Diarias2ReprovadasPage,
  Diarias2CanceladasPage,
  Diarias2PagasPage,
} from "./pages/diarias/DiariasStatusPages2";
import DiariasTemporariasLogsPage from "./pages/diarias/DiariasTemporariasLogsPage";
import Diarias from "./pages/Diarias";
import Diarias2 from "./pages/Diarias2";
import Faltas from "./pages/Faltas";
import Controladoria from "./pages/Controladoria";
import HoraExtra from "./pages/hora-extra/HoraExtra";
import {
  HoraExtraPendentesPage,
  HoraExtraConfirmadasPage,
  HoraExtraAprovadasPage,
  HoraExtraReprovadasPage,
  HoraExtraCanceladasPage,
  HoraExtraDashboardPage,
} from "./pages/hora-extra/HoraExtraStatusPages";
import Inspecao from "./pages/Inspecao";
import ChecklistActionPlansPage from "./pages/checklist/ChecklistActionPlansPage";
import ChecklistAuditPage from "./pages/checklist/ChecklistAuditPage";
import ChecklistInstancesPage from "./pages/checklist/ChecklistInstancesPage";
import ChecklistKanbanPage from "./pages/checklist/ChecklistKanbanPage";
import ChecklistOverviewPage from "./pages/checklist/ChecklistOverviewPage";
import ChecklistReviewsPage from "./pages/checklist/ChecklistReviewsPage";
import ChecklistFeedbacksPage from "./pages/checklist/ChecklistFeedbacksPage";
import ChecklistTeamsPage from "./pages/checklist/ChecklistTeamsPage";
import ChecklistTemplatesPage from "./pages/checklist/ChecklistTemplatesPage";
import MeusPlanos from "./pages/MeusPlanos";
import NotFound from "./pages/NotFound";
import MinhaConta from "./pages/MinhaConta";
import PlanoAcaoDetalhe from "./pages/PlanoAcaoDetalhe";
import PlanosAcao from "./pages/PlanosAcao";
import DadosEmpresariais from "./pages/DadosEmpresariais";
import CandidatoCadastro from "./pages/CandidatoCadastro";
import Notificacoes from "./pages/Notificacoes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />
            <Route path="/recuperar-acesso/:token" element={<RecuperarAcesso />} />
            <Route path="/admin/recuperacoes" element={<ProtectedRoute><RecuperacoesAdmin /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard-24h" element={<ProtectedRoute><Dashboard24h /></ProtectedRoute>} />
            <Route path="/minha-conta" element={<ProtectedRoute><MinhaConta /></ProtectedRoute>} />
            <Route path="/dados-empresariais" element={<ProtectedRoute><DadosEmpresariais /></ProtectedRoute>} />
            <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/candidatos" element={<CandidatoCadastro />} />
            <Route path="/chamados" element={<ProtectedRoute><Chamados /></ProtectedRoute>} />
            <Route path="/chamados/historico" element={<ProtectedRoute><ChamadosHistorico /></ProtectedRoute>} />
            <Route path="/contratos" element={<ProtectedRoute><Contratos /></ProtectedRoute>} />
            <Route path="/mesa-operacoes" element={<ProtectedRoute><MesaOperacoes /></ProtectedRoute>} />
            <Route path="/ordens-servico" element={<ProtectedRoute><OrdensServico /></ProtectedRoute>} />
            <Route path="/colaboradores" element={<ProtectedRoute><Colaboradores /></ProtectedRoute>} />
            <Route path="/centros-custo" element={<ProtectedRoute><CentrosCusto /></ProtectedRoute>} />
            <Route path="/locais-centro-custo" element={<ProtectedRoute><LocaisCentroCusto /></ProtectedRoute>} />
            <Route path="/postos-servico" element={<ProtectedRoute><PostosServico /></ProtectedRoute>} />
            <Route path="/escalas" element={<ProtectedRoute><Escalas /></ProtectedRoute>} />
            <Route path="/ativos" element={<ProtectedRoute><Ativos /></ProtectedRoute>} />
            <Route path="/estoque" element={<ProtectedRoute><Estoque /></ProtectedRoute>} />
            <Route path="/diaristas" element={<ProtectedRoute><Diaristas /></ProtectedRoute>} />
            <Route path="/diaristas-restritos" element={<ProtectedRoute><DiaristasRestritos /></ProtectedRoute>} />
            <Route path="/diaristas/logs" element={<ProtectedRoute><DiaristasLogs /></ProtectedRoute>} />
            <Route path="/diarias/aguardando" element={<ProtectedRoute><DiariasAguardandoPage /></ProtectedRoute>} />
            <Route path="/diarias/confirmadas" element={<ProtectedRoute><DiariasConfirmadasPage /></ProtectedRoute>} />
            <Route path="/diarias/aprovadas" element={<ProtectedRoute><DiariasAprovadasPage /></ProtectedRoute>} />
            <Route path="/diarias/lancadas" element={<ProtectedRoute><DiariasLancadasPage /></ProtectedRoute>} />
            <Route path="/diarias/reprovadas" element={<ProtectedRoute><DiariasReprovadasPage /></ProtectedRoute>} />
            <Route path="/diarias/pagas" element={<ProtectedRoute><DiariasPagasPage /></ProtectedRoute>} />
            <Route path="/diarias/canceladas" element={<ProtectedRoute><DiariasCanceladasPage /></ProtectedRoute>} />
            <Route path="/diarias" element={<ProtectedRoute><Diarias /></ProtectedRoute>} />
            <Route path="/diarias2/aguardando" element={<ProtectedRoute><Diarias2AguardandoPage /></ProtectedRoute>} />
            <Route path="/diarias2/confirmadas" element={<ProtectedRoute><Diarias2ConfirmadasPage /></ProtectedRoute>} />
            <Route path="/diarias2/aprovadas" element={<ProtectedRoute><Diarias2AprovadasPage /></ProtectedRoute>} />
            <Route path="/diarias2/lancadas" element={<ProtectedRoute><Diarias2LancadasPage /></ProtectedRoute>} />
            <Route path="/diarias2/reprovadas" element={<ProtectedRoute><Diarias2ReprovadasPage /></ProtectedRoute>} />
            <Route path="/diarias2/canceladas" element={<ProtectedRoute><Diarias2CanceladasPage /></ProtectedRoute>} />
            <Route path="/diarias2/pagas" element={<ProtectedRoute><Diarias2PagasPage /></ProtectedRoute>} />
            <Route path="/diarias2/logs" element={<ProtectedRoute><DiariasTemporariasLogsPage /></ProtectedRoute>} />
            <Route path="/diarias2" element={<ProtectedRoute><Diarias2 /></ProtectedRoute>} />
            <Route path="/cobertura/diarias/aguardando" element={<ProtectedRoute><Diarias2AguardandoPage /></ProtectedRoute>} />
            <Route path="/cobertura/diarias/confirmadas" element={<ProtectedRoute><Diarias2ConfirmadasPage /></ProtectedRoute>} />
            <Route path="/cobertura/diarias/aprovadas" element={<ProtectedRoute><Diarias2AprovadasPage /></ProtectedRoute>} />
            <Route path="/cobertura/diarias/lancadas" element={<ProtectedRoute><Diarias2LancadasPage /></ProtectedRoute>} />
            <Route path="/cobertura/diarias/reprovadas" element={<ProtectedRoute><Diarias2ReprovadasPage /></ProtectedRoute>} />
            <Route path="/cobertura/diarias/canceladas" element={<ProtectedRoute><Diarias2CanceladasPage /></ProtectedRoute>} />
            <Route path="/cobertura/diarias/pagas" element={<ProtectedRoute><Diarias2PagasPage /></ProtectedRoute>} />
            <Route path="/cobertura/diarias/logs" element={<ProtectedRoute><DiariasTemporariasLogsPage /></ProtectedRoute>} />
            <Route path="/cobertura/diarias" element={<ProtectedRoute><Diarias2 /></ProtectedRoute>} />
            <Route path="/hora-extra" element={<ProtectedRoute><HoraExtra /></ProtectedRoute>} />
            <Route path="/hora-extra/dashboard" element={<ProtectedRoute><HoraExtraDashboardPage /></ProtectedRoute>} />
            <Route path="/hora-extra/pendentes" element={<ProtectedRoute><HoraExtraPendentesPage /></ProtectedRoute>} />
            <Route path="/hora-extra/confirmadas" element={<ProtectedRoute><HoraExtraConfirmadasPage /></ProtectedRoute>} />
            <Route path="/hora-extra/aprovadas" element={<ProtectedRoute><HoraExtraAprovadasPage /></ProtectedRoute>} />
            <Route path="/hora-extra/reprovadas" element={<ProtectedRoute><HoraExtraReprovadasPage /></ProtectedRoute>} />
            <Route path="/hora-extra/canceladas" element={<ProtectedRoute><HoraExtraCanceladasPage /></ProtectedRoute>} />
            <Route path="/cobertura/hora-extra" element={<ProtectedRoute><HoraExtra /></ProtectedRoute>} />
            <Route path="/cobertura/hora-extra/dashboard" element={<ProtectedRoute><HoraExtraDashboardPage /></ProtectedRoute>} />
            <Route path="/cobertura/hora-extra/pendentes" element={<ProtectedRoute><HoraExtraPendentesPage /></ProtectedRoute>} />
            <Route path="/cobertura/hora-extra/confirmadas" element={<ProtectedRoute><HoraExtraConfirmadasPage /></ProtectedRoute>} />
            <Route path="/cobertura/hora-extra/aprovadas" element={<ProtectedRoute><HoraExtraAprovadasPage /></ProtectedRoute>} />
            <Route path="/cobertura/hora-extra/reprovadas" element={<ProtectedRoute><HoraExtraReprovadasPage /></ProtectedRoute>} />
            <Route path="/cobertura/hora-extra/canceladas" element={<ProtectedRoute><HoraExtraCanceladasPage /></ProtectedRoute>} />
            <Route path="/faltas" element={<ProtectedRoute><Faltas /></ProtectedRoute>} />
            <Route path="/controladoria" element={<ProtectedRoute><Controladoria /></ProtectedRoute>} />
            <Route path="/inspecao" element={<ProtectedRoute><Inspecao /></ProtectedRoute>} />
            <Route path="/planos-acao" element={<ProtectedRoute><PlanosAcao /></ProtectedRoute>} />
            <Route path="/meus-planos" element={<ProtectedRoute><MeusPlanos /></ProtectedRoute>} />
            <Route path="/planos-acao/:id" element={<ProtectedRoute><PlanoAcaoDetalhe /></ProtectedRoute>} />
            <Route path="/checklists" element={<ProtectedRoute><ChecklistOverviewPage /></ProtectedRoute>} />
            <Route path="/checklists/equipes" element={<ProtectedRoute><ChecklistTeamsPage /></ProtectedRoute>} />
            <Route path="/checklists/templates" element={<ProtectedRoute><ChecklistTemplatesPage /></ProtectedRoute>} />
            <Route path="/checklists/instancias" element={<ProtectedRoute><ChecklistInstancesPage /></ProtectedRoute>} />
            <Route path="/checklists/avaliacoes" element={<ProtectedRoute><ChecklistReviewsPage /></ProtectedRoute>} />
            <Route path="/checklists/tarefas" element={<Navigate to="/checklists/instancias" replace />} />
            <Route path="/checklists/kanban" element={<ProtectedRoute><ChecklistKanbanPage /></ProtectedRoute>} />
            <Route path="/checklists/feedbacks" element={<ProtectedRoute><ChecklistFeedbacksPage /></ProtectedRoute>} />
            <Route path="/checklists/planos-acao" element={<ProtectedRoute><ChecklistActionPlansPage /></ProtectedRoute>} />
            <Route path="/checklists/auditoria" element={<ProtectedRoute><ChecklistAuditPage /></ProtectedRoute>} />
            <Route path="/checklist-itens" element={<ProtectedRoute><ChecklistTemplatesPage /></ProtectedRoute>} />
            <Route path="/checklist-execucoes" element={<ProtectedRoute><ChecklistInstancesPage /></ProtectedRoute>} />
            <Route path="/checklist-respostas" element={<Navigate to="/checklists/instancias" replace />} />
            <Route path="/checklist-respostas-lista" element={<Navigate to="/checklists/instancias" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
