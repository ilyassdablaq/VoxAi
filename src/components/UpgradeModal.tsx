import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { subscriptionService } from '@/services/subscription.service';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UpgradeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  requiredPlan: 'PRO' | 'ENTERPRISE';
  onClose?: () => void;
}

/**
 * Modal to prompt Free users to upgrade to Pro
 */
export function UpgradeModal({
  isOpen,
  onOpenChange,
  feature,
  requiredPlan,
  onClose,
}: UpgradeModalProps) {
  const navigate = useNavigate();
  const { subscription } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const closeModal = () => {
    onOpenChange(false);
    onClose?.();
  };

  const handleUpgradeClick = async () => {
    try {
      setIsLoading(true);

      // Resolve the best purchasable plan key from API so key naming stays backend-driven.
      const plans = await subscriptionService.listPlans();
      const targetPlan = plans
        .filter((plan) => plan.type === requiredPlan)
        .sort((a, b) => {
          if (a.interval === b.interval) {
            return a.priceCents - b.priceCents;
          }
          return a.interval === 'MONTHLY' ? -1 : 1;
        })[0];

      const targetPlanKey = targetPlan?.key ?? (requiredPlan === 'ENTERPRISE' ? 'enterprise' : 'pro');
      const upgrade = await subscriptionService.startUpgrade(targetPlanKey);
      if (upgrade.url) {
        window.location.href = upgrade.url;
        return;
      }

      navigate('/dashboard/subscriptions');
      closeModal();
    } catch (error) {
      console.error('Upgrade failed:', error);
      navigate('/dashboard/subscriptions');
      closeModal();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>This feature requires Pro Plan</DialogTitle>
          <DialogDescription>
            Upgrade to access {feature.replace(/_/g, ' ')} and continue without limits.
          </DialogDescription>
        </DialogHeader>

        {subscription && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Current effective plan: <span className="font-medium text-foreground">{subscription.effectivePlan}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={closeModal} disabled={isLoading}>
            Close
          </Button>
          <Button onClick={handleUpgradeClick} disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Upgrade Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
