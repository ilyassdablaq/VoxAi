import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

/**
 * PlanBadge component - displays current plan in header/nav
 */
export function PlanBadge() {
  const { subscription, isPro } = useAuth();

  if (!subscription) {
    return <div className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">Loading...</div>;
  }

  return (
    <div
      className={cn(
        'px-3 py-1 text-sm font-semibold rounded',
        isPro
          ? 'bg-blue-100 text-blue-700'
          : 'bg-gray-100 text-gray-700'
      )}
    >
      {subscription.effectivePlan}{subscription.isOverride ? " (override)" : ""}
    </div>
  );
}
