import { ReactNode, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureAccess } from '@/hooks/use-feature-access';
import { UpgradeModal } from './UpgradeModal';

interface ProFeatureRouteProps {
  featureName: string;
  requiredPlan?: 'PRO' | 'ENTERPRISE';
  children: ReactNode;
}

/**
 * Guard component that restricts access to Pro features
 * Shows upgrade modal if user is not Pro
 */
export function ProFeatureRoute({
  featureName,
  requiredPlan = 'PRO',
  children,
}: ProFeatureRouteProps) {
  useAuth();
  const { canAccess } = useFeatureAccess();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const hasAccess = canAccess(featureName);

  if (!hasAccess) {
    return (
      <>
        <UpgradeModal
          isOpen={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          feature={featureName}
          requiredPlan={requiredPlan}
        />
        <div className="flex flex-col items-center justify-center min-h-96 gap-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">This feature requires {requiredPlan} Plan</h2>
            <p className="text-gray-600 mb-4">
              Upgrade to unlock {featureName} and other advanced features
            </p>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
