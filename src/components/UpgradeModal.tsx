import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { subscriptionService } from '@/services/subscription.service';
import { useState } from 'react';

interface UpgradeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  requiredPlan: 'PRO' | 'ENTERPRISE';
}

/**
 * Modal to prompt Free users to upgrade to Pro
 */
export function UpgradeModal({
  isOpen,
  onOpenChange,
  feature,
  requiredPlan,
}: UpgradeModalProps) {
  const navigate = useNavigate();
  const { subscription } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleUpgradeClick = async () => {
    try {
      setIsLoading(true);
      const targetPlanKey = requiredPlan === 'ENTERPRISE' ? 'enterprise' : 'pro';
      const redirectUrl = await subscriptionService.startUpgrade(targetPlanKey);
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
      // Fallback to subscriptions page
      navigate('/dashboard/subscriptions');
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPlans = () => {
    navigate('/dashboard/subscriptions');
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <button
          onClick={() => onOpenChange(false)}
          className="float-right text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Unlock {feature.replace(/_/g, ' ')}</h2>
          <p className="text-gray-600">
            This feature is available exclusively for {requiredPlan} members.
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-3 text-blue-900">{requiredPlan} Plan includes:</h3>
          <ul className="space-y-2 text-sm text-blue-900">
            <li>✓ Workflow Automation</li>
            <li>✓ Analytics Dashboard</li>
            <li>✓ 100K voice minutes/month</li>
            <li>✓ Priority support</li>
          </ul>
        </div>

        {subscription && (
          <div className="mb-6 p-3 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">
              Current Plan: <span className="font-semibold">{subscription.plan.name}</span>
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleViewPlans}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            View Plans
          </button>
          <button
            onClick={handleUpgradeClick}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Upgrade Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
