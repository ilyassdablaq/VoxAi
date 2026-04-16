import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { trackEvent } from '@/lib/product-analytics';
import { Seo } from '@/components/Seo';

export function StripeSuccess() {
  const navigate = useNavigate();
  const { refreshSubscription } = useAuth();
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const handleSuccess = async () => {
      try {
        // Refresh subscription to get updated plan from webhook writes.
        await refreshSubscription();
        trackEvent('plan_upgraded', {
          flow: 'stripe_redirect',
        });
        setTimeout(() => {
          navigate('/dashboard');
        }, 1800);
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : 'Unable to sync subscription status.');
      }
    };

    handleSuccess();
  }, [refreshSubscription, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Seo
        title="Checkout Successful"
        description="Your payment was successful. VoxAI is syncing your subscription and redirecting you to the dashboard."
        path="/stripe-success"
        noindex
      />
      <div className="text-center">
        <div className="mb-4">
          <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upgrade Successful!</h1>
        {syncError ? (
          <>
            <p className="text-gray-600 mb-4">Payment was successful, but we could not refresh your account automatically.</p>
            <p className="text-sm text-red-600 mb-6">{syncError}</p>
            <button
              onClick={() => navigate('/dashboard/subscriptions')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Open Subscriptions
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-4">Your subscription is active. Redirecting to dashboard...</p>
            <div className="animate-spin">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
