import { useNavigate } from 'react-router-dom';
import { Seo } from '@/components/Seo';

export function StripeCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Seo
        title="Checkout Canceled"
        description="Stripe checkout was canceled or payment was not confirmed. Your current VoxAI plan remains unchanged."
        path="/stripe-cancel"
        noindex
      />
      <div className="text-center">
        <div className="mb-4">
          <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upgrade Canceled</h1>
        <p className="text-gray-600 mb-2">You did not complete checkout, or the payment could not be confirmed.</p>
        <p className="text-sm text-gray-500 mb-6">No charge is applied until Stripe confirms payment. Your current plan remains unchanged.</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate('/dashboard/subscriptions')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
