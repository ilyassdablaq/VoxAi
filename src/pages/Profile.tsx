import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { userService } from "@/services/user.service";
import { useAuth } from "@/hooks/use-auth";
import { subscriptionService } from "@/services/subscription.service";

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, subscription, refreshSubscription } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancelPlan, setConfirmCancelPlan] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => userService.getMyProfile(),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => userService.deleteMyAccount(),
    onSuccess: () => {
      logout();
      toast({
        title: "Account deleted",
        description: "Your account and related data have been removed.",
      });
      navigate("/sign-up", { replace: true });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unable to delete account",
        variant: "destructive",
      });
    },
  });

  const cancelPlanMutation = useMutation({
    mutationFn: () => subscriptionService.cancelToFreePlan(),
    onSuccess: async () => {
      await refreshSubscription();
      setConfirmCancelPlan(false);
      toast({
        title: "Cancellation scheduled",
        description: "Your paid plan remains active until the current billing period ends.",
      });
      navigate("/dashboard/subscriptions");
    },
    onError: (error) => {
      toast({
        title: "Cancellation failed",
        description: error instanceof Error ? error.message : "Unable to cancel subscription",
        variant: "destructive",
      });
    },
  });

  return (
    <DashboardShell title="Profile" description="Manage your account information and security actions.">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">First Name</p>
                  <p className="text-sm font-medium">{profile?.firstName || "-"}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Last Name</p>
                  <p className="text-sm font-medium">{profile?.lastName || "-"}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{profile?.email || "-"}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Current Subscription</p>
              <p className="text-sm font-medium">
                {subscription?.plan ?? "FREE"}
                {subscription?.isOverride ? " (effective override active)" : ""}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {subscription?.plan !== "FREE" ? (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmCancelPlan(true)}
                  disabled={cancelPlanMutation.isPending}
                >
                  {cancelPlanMutation.isPending ? "Cancelling..." : "Cancel Subscription (Back to Free)"}
                </Button>
              ) : (
                <Button variant="secondary" disabled>
                  You are already on the Free plan
                </Button>
              )}

              <Button variant="outline" onClick={logout}>Logout</Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={deleteAccountMutation.isPending}
              >
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmCancelPlan} onOpenChange={setConfirmCancelPlan}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel at period end?</AlertDialogTitle>
            <AlertDialogDescription>
              Your paid subscription will stay active until the current billing period ends, then your account will move to the Free plan automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelPlanMutation.isPending}>Keep current plan</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelPlanMutation.isPending}
              onClick={() => cancelPlanMutation.mutate()}
            >
              {cancelPlanMutation.isPending ? "Scheduling..." : "Confirm cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent. Your profile, conversations, subscriptions, and usage history will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAccountMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteAccountMutation.isPending}
              onClick={() => deleteAccountMutation.mutate()}
            >
              {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
