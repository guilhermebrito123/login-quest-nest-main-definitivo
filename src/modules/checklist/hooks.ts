import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccessContext } from "@/hooks/useAccessContext";
import { buildChecklistSupervisorContext } from "@/modules/checklist/permissions";
import {
  checklistActionPlansService,
  checklistFeedbacksService,
  checklistInstanceTasksService,
  checklistInstancesService,
  checklistLookupsService,
  checklistOverviewService,
  checklistResponsibilitiesService,
  checklistResponsesService,
  checklistReviewsService,
  checklistTeamMembersService,
  checklistTeamsService,
  checklistTemplateTasksService,
  checklistTemplatesService,
} from "@/modules/checklist/services";

export const checklistQueryKeys = {
  overview: ["checklist", "overview"] as const,
  teams: ["checklist", "teams"] as const,
  teamMembers: (teamId: string, costCenterId?: string) =>
    ["checklist", "team-members", teamId, costCenterId ?? "all"] as const,
  templates: ["checklist", "templates"] as const,
  templateTasks: (templateId: string) => ["checklist", "template-tasks", templateId] as const,
  instances: ["checklist", "instances"] as const,
  instanceTasks: (instanceId: string) => ["checklist", "instance-tasks", instanceId] as const,
  responsibilities: ["checklist", "responsibilities"] as const,
  archivedResponsibilities: ["checklist", "responsibilities", "archived"] as const,
  responsibilityHistory: (instanceId: string) =>
    ["checklist", "responsibilities", "history", instanceId] as const,
  response: (responsibilityId: string) => ["checklist", "responses", responsibilityId] as const,
  reviews: ["checklist", "reviews"] as const,
  review: (instanceId: string) => ["checklist", "review", instanceId] as const,
  reviewItems: (reviewId: string) => ["checklist", "review-items", reviewId] as const,
  feedbacks: ["checklist", "feedbacks"] as const,
  actionPlans: ["checklist", "action-plans"] as const,
  costCenters: ["checklist", "cost-centers"] as const,
  locais: ["checklist", "locais"] as const,
  internalCostCenters: (userId?: string | null) =>
    ["checklist", "internal-cost-centers", userId ?? "anon"] as const,
  usersPublic: ["checklist", "users-public"] as const,
  eligibleCollaborators: (costCenterId?: string) =>
    ["checklist", "eligible-collaborators", costCenterId ?? "none"] as const,
};

export function useChecklistSupervisorScope() {
  const { accessContext, accessLoading, refetchAccessContext } = useAccessContext();
  const internalCostCentersQuery = useInternalCostCenters(accessContext.userId);

  const scopeLoading =
    accessLoading ||
    (accessContext.accessLevel === "supervisor" && internalCostCentersQuery.isLoading);

  const supervisorContext = useMemo(
    () =>
      buildChecklistSupervisorContext(
        accessContext,
        internalCostCentersQuery.data ?? [],
        scopeLoading,
      ),
    [accessContext, internalCostCentersQuery.data, scopeLoading],
  );

  return {
    supervisorContext,
    scopeLoading,
    refetchSupervisorScope: async () => {
      await Promise.all([refetchAccessContext(), internalCostCentersQuery.refetch()]);
    },
  };
}

export function useChecklistOverviewStats() {
  return useQuery({
    queryKey: checklistQueryKeys.overview,
    queryFn: checklistOverviewService.loadStats,
  });
}

export function useChecklistTeams() {
  return useQuery({
    queryKey: checklistQueryKeys.teams,
    queryFn: checklistTeamsService.list,
  });
}

export function useChecklistTeamMembers(teamId: string, costCenterId?: string) {
  return useQuery({
    queryKey: checklistQueryKeys.teamMembers(teamId, costCenterId),
    queryFn: () => checklistTeamMembersService.list(teamId, costCenterId),
    enabled: !!teamId,
  });
}

export function useEligibleChecklistCollaborators(costCenterId?: string) {
  return useQuery({
    queryKey: checklistQueryKeys.eligibleCollaborators(costCenterId),
    queryFn: () => checklistTeamMembersService.listEligibleCollaborators(costCenterId!),
    enabled: !!costCenterId,
  });
}

export function useChecklistTemplates() {
  return useQuery({
    queryKey: checklistQueryKeys.templates,
    queryFn: checklistTemplatesService.list,
  });
}

export function useChecklistTemplateTasks(templateId: string) {
  return useQuery({
    queryKey: checklistQueryKeys.templateTasks(templateId),
    queryFn: () => checklistTemplateTasksService.list(templateId),
    enabled: !!templateId,
  });
}

export function useChecklistInstances() {
  return useQuery({
    queryKey: checklistQueryKeys.instances,
    queryFn: checklistInstancesService.list,
  });
}

export function useChecklistInstanceTasks(instanceId: string) {
  return useQuery({
    queryKey: checklistQueryKeys.instanceTasks(instanceId),
    queryFn: () => checklistInstanceTasksService.list(instanceId),
    enabled: !!instanceId,
  });
}

export function useChecklistResponsibilities() {
  return useQuery({
    queryKey: checklistQueryKeys.responsibilities,
    queryFn: checklistResponsibilitiesService.listActive,
  });
}

export function useArchivedChecklistResponsibilities() {
  return useQuery({
    queryKey: checklistQueryKeys.archivedResponsibilities,
    queryFn: checklistResponsibilitiesService.listArchived,
  });
}

export function useChecklistResponsibilityHistory(instanceId: string) {
  return useQuery({
    queryKey: checklistQueryKeys.responsibilityHistory(instanceId),
    queryFn: () => checklistResponsibilitiesService.listHistoryByInstance(instanceId),
    enabled: !!instanceId,
  });
}

export function useChecklistLatestResponse(responsibilityId: string) {
  return useQuery({
    queryKey: checklistQueryKeys.response(responsibilityId),
    queryFn: () => checklistResponsesService.getLatestByResponsibility(responsibilityId),
    enabled: !!responsibilityId,
  });
}

export function useChecklistReviews() {
  return useQuery({
    queryKey: checklistQueryKeys.reviews,
    queryFn: checklistReviewsService.list,
  });
}

export function useChecklistReview(instanceId: string) {
  return useQuery({
    queryKey: checklistQueryKeys.review(instanceId),
    queryFn: () => checklistReviewsService.getByInstance(instanceId),
    enabled: !!instanceId,
  });
}

export function useChecklistReviewItems(reviewId: string) {
  return useQuery({
    queryKey: checklistQueryKeys.reviewItems(reviewId),
    queryFn: () => checklistReviewsService.listItems(reviewId),
    enabled: !!reviewId,
  });
}

export function useChecklistFeedbacks() {
  return useQuery({
    queryKey: checklistQueryKeys.feedbacks,
    queryFn: checklistFeedbacksService.listAll,
  });
}

export function useChecklistActionPlans() {
  return useQuery({
    queryKey: checklistQueryKeys.actionPlans,
    queryFn: checklistActionPlansService.list,
  });
}

export function useChecklistCostCenters() {
  return useQuery({
    queryKey: checklistQueryKeys.costCenters,
    queryFn: checklistLookupsService.getCostCenters,
  });
}

export function useChecklistLocais() {
  return useQuery({
    queryKey: checklistQueryKeys.locais,
    queryFn: checklistLookupsService.getLocais,
  });
}

export function useInternalCostCenters(userId?: string | null) {
  return useQuery({
    queryKey: checklistQueryKeys.internalCostCenters(userId),
    queryFn: () => checklistLookupsService.getAllowedInternalCostCenters(userId),
    enabled: !!userId,
  });
}

export function useChecklistUsersPublic() {
  return useQuery({
    queryKey: checklistQueryKeys.usersPublic,
    queryFn: checklistLookupsService.getUsersPublic,
  });
}

export function useChecklistModuleMutations() {
  const queryClient = useQueryClient();

  const invalidateModule = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["checklist"] }),
      queryClient.invalidateQueries({ queryKey: ["access-context"] }),
    ]);
  };

  return {
    invalidateModule,
    templates: useMutation({
      mutationFn: checklistTemplatesService.create,
      onSuccess: invalidateModule,
    }),
  };
}
