import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModulePageHeader } from "@/components/checklist/ChecklistMvp";
import { useChecklistSupervisorScope } from "@/modules/checklist/hooks";
import type { ChecklistSupervisorContext } from "@/modules/checklist/types";
import {
  canAccessChecklistModule,
  getChecklistModuleAccessMessage,
  getChecklistVisibleSections,
} from "@/lib/checklist-module";
import { cn } from "@/lib/utils";

type ChecklistModuleLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  currentPath: string;
  actions?: ReactNode;
  canAccessPage?: (context: ChecklistSupervisorContext) => boolean;
  unauthorizedTitle?: string;
  unauthorizedDescription?: string;
};

function defaultPageAccess() {
  return true;
}

export function ChecklistAccessStateCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function ChecklistModuleLayout({
  title,
  description,
  children,
  currentPath,
  actions,
  canAccessPage = defaultPageAccess,
  unauthorizedTitle = "Sem permissao para esta secao",
  unauthorizedDescription,
}: ChecklistModuleLayoutProps) {
  const { supervisorContext, scopeLoading } = useChecklistSupervisorScope();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1600px] p-4 md:p-6">
        <div className="space-y-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6 lg:space-y-0">
          <aside className="space-y-4">
            <div className="lg:sticky lg:top-6">
              <div className="hidden rounded-2xl border bg-card p-3 shadow-sm lg:block">
                <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Checklist MVP
                </p>
                <div className="space-y-1">
                  {getChecklistVisibleSections(supervisorContext).map((section) => {
                    const isActive =
                      currentPath === section.path || currentPath.startsWith(`${section.path}/`);

                    return (
                      <NavLink
                        key={section.key}
                        to={section.path}
                        className={cn(
                          "flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          isActive && "bg-primary text-primary-foreground hover:bg-primary",
                        )}
                      >
                        {section.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <ModulePageHeader title={title} description={description} actions={actions} />

            <div className="overflow-x-auto rounded-2xl border bg-card lg:hidden">
              <div className="flex min-w-max gap-2 p-2">
                {getChecklistVisibleSections(supervisorContext).map((section) => {
                  const isActive =
                    currentPath === section.path || currentPath.startsWith(`${section.path}/`);

                  return (
                    <NavLink
                      key={section.key}
                      to={section.path}
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        isActive &&
                          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      )}
                    >
                      {section.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {scopeLoading ? (
              <ChecklistAccessStateCard
                title="Carregando escopo do supervisor"
                description="A interface esta validando o escopo de acesso antes de liberar as ações do módulo."
              />
            ) : !canAccessChecklistModule(supervisorContext) ? (
              <ChecklistAccessStateCard
                title="Acesso indisponivel"
                description={getChecklistModuleAccessMessage(supervisorContext)}
              />
            ) : canAccessPage(supervisorContext) ? (
              <div className="space-y-6">{children}</div>
            ) : (
              <ChecklistAccessStateCard
                title={unauthorizedTitle}
                description={
                  unauthorizedDescription ?? "Seu perfil nao possui acesso a esta area do modulo checklist."
                }
              />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
