import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

export function StripeSuccess() {
  const navigate = useNavigate();
  const { refreshSubscription } = useAuth();

  useEffect(() => {
    const handleSuccess = async () => {
      // Refresh subscription to get updated plan
      await refreshSubscription();
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    };

    handleSuccess();
  }, [refreshSubscription, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upgrade Successful!</h1>
        <p className="text-gray-600 mb-4">Your subscription has been activated. Redirecting to dashboard...</p>
        <div className="animate-spin">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    </div>
  );
}
