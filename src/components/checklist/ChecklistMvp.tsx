import type { ReactNode } from "react";
import { ChevronRight, Inbox, PanelRightOpen } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

type PageAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export function ModulePageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {description ? (
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function ModuleToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-center", className)}>{children}</div>
  );
}

export function EmptyState({
  title = "Nada por aqui",
  description,
  action,
  className,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 py-8 text-center",
        className,
      )}
    >
      <Inbox className="mb-3 h-5 w-5 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  title,
  value,
  description,
  icon,
  action,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  action?: PageAction;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardDescription>{title}</CardDescription>
          <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
        </div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </CardHeader>
      {description || action ? (
        <CardContent className="space-y-3">
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          {action ? (
            <Button
              type="button"
              variant="ghost"
              className="h-auto px-0 text-sm"
              onClick={action.onClick}
              asChild={!!action.href}
            >
              {action.href ? (
                <a href={action.href}>
                  {action.label}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </a>
              ) : (
                <span>
                  {action.label}
                  <ChevronRight className="ml-1 inline h-4 w-4" />
                </span>
              )}
            </Button>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("rounded-2xl shadow-sm", className)}>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function EntityTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border", className)}>
      <div className="overflow-x-auto">
        <Table>{children}</Table>
      </div>
    </div>
  );
}

type OverlayShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  desktopClassName?: string;
};

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  desktopClassName,
}: OverlayShellProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          <ScrollArea className="max-h-[calc(90vh-88px)] px-4 pb-6">{children}</ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("w-full overflow-y-auto sm:max-w-2xl", desktopClassName)}>
        <SheetHeader className="pr-8">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function DetailDrawer(props: OverlayShellProps) {
  return <FormDrawer {...props} desktopClassName={cn("sm:max-w-xl", props.desktopClassName)} />;
}

export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: OverlayShellProps & { className?: string }) {
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  if (isDesktop) {
    return (
      <Card className={cn("sticky top-6 hidden h-fit rounded-2xl shadow-sm xl:block", className)}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    );
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {children}
    </DetailDrawer>
  );
}

export function StatusBadge({
  children,
  variant = "outline",
  className,
}: {
  children: ReactNode;
  variant?: BadgeProps["variant"];
  className?: string;
}) {
  return <Badge variant={variant} className={className}>{children}</Badge>;
}

export function KanbanCard({
  title,
  subtitle,
  responsible,
  dueLabel,
  badges,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  responsible?: string;
  dueLabel?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full rounded-2xl border bg-card p-4 shadow-sm", className)}>
      <div className="space-y-1">
        <p className="font-medium leading-tight">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        {responsible ? <p className="text-xs text-muted-foreground">Responsável: {responsible}</p> : null}
        {dueLabel ? <p className="text-xs text-muted-foreground">{dueLabel}</p> : null}
      </div>
      {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
      {actions ? <div className="mt-3">{actions}</div> : null}
    </div>
  );
}

export function TimelineList({
  items,
  emptyMessage,
}: {
  items: Array<{ id: string; title: string; meta?: string; body?: ReactNode; badge?: ReactNode }>;
  emptyMessage: string;
}) {
  if (!items.length) {
    return <EmptyState title="Sem histórico" description={emptyMessage} className="min-h-[120px]" />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="rounded-2xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium">{item.title}</p>
              {item.meta ? <p className="text-xs text-muted-foreground">{item.meta}</p> : null}
            </div>
            {item.badge}
          </div>
          {item.body ? <div className="mt-3 text-sm text-muted-foreground">{item.body}</div> : null}
          {index < items.length - 1 ? <Separator className="mt-4" /> : null}
        </div>
      ))}
    </div>
  );
}

export function AssignmentList({
  items,
  emptyMessage,
}: {
  items: Array<{
    id: string;
    title: string;
    subtitle?: string | null;
    badge?: ReactNode;
    actions?: ReactNode;
  }>;
  emptyMessage: string;
}) {
  if (!items.length) {
    return <EmptyState title="Sem responsáveis" description={emptyMessage} className="min-h-[120px]" />;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
          <div className="space-y-1">
            <p className="font-medium">{item.title}</p>
            {item.subtitle ? <p className="text-xs text-muted-foreground">{item.subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {item.badge}
            {item.actions}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedbackList({
  items,
  emptyMessage,
}: {
  items: Array<{
    id: string;
    title: string;
    message: string;
    meta?: ReactNode;
    unread?: boolean;
    footer?: ReactNode;
  }>;
  emptyMessage: string;
}) {
  if (!items.length) {
    return <EmptyState title="Inbox vazia" description={emptyMessage} className="min-h-[120px]" />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "rounded-2xl border p-4 shadow-sm transition-colors",
            item.unread ? "border-primary/30 bg-primary/5" : "bg-card",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{item.title}</p>
                {item.unread ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
              </div>
              {item.meta}
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{item.message}</p>
          {item.footer ? <div className="mt-4">{item.footer}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function ActionPlanSummary({
  title,
  status,
  meta,
  description,
  footer,
}: {
  title: string;
  status?: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          {meta}
        </div>
        {status}
      </div>
      {description ? <div className="mt-3 text-sm text-muted-foreground">{description}</div> : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}

export function PanelToggleButton({
  onClick,
  label = "Abrir detalhes",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <PanelRightOpen className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
