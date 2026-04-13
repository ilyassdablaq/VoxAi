import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProFeatureRoute } from "./components/ProFeatureRoute";
import { AdminRoute } from "./components/AdminRoute";

const Index = lazy(() => import("./pages/Index.tsx"));
const Features = lazy(() => import("./pages/Features"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Contact = lazy(() => import("./pages/Contact"));
const Faq = lazy(() => import("./pages/Faq"));
const SignUp = lazy(() => import("./pages/SignUp"));
const SignIn = lazy(() => import("./pages/SignIn"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DataSources = lazy(() => import("./pages/DataSources"));
const ConversationChat = lazy(() => import("./pages/ConversationChat"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Workflows = lazy(() => import("./pages/Workflows"));
const AnalyticsDashboard = lazy(() => import("./pages/AnalyticsDashboard"));
const VoiceSettings = lazy(() => import("./pages/VoiceSettings"));
const DeveloperPortal = lazy(() => import("./pages/DeveloperPortal"));
const DashboardFaq = lazy(() => import("./pages/DashboardFaq"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const StripeSuccess = lazy(() => import("./pages/StripeSuccess").then((module) => ({ default: module.StripeSuccess })));
const StripeCancel = lazy(() => import("./pages/StripeCancel").then((module) => ({ default: module.StripeCancel })));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const routeFallback = (
  <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
    Loading...
  </div>
);

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={routeFallback}>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/features" element={<Features />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/sign-up" element={<SignUp />} />
              <Route path="/sign-in" element={<SignIn />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/stripe-success" element={<StripeSuccess />} />
              <Route path="/stripe-cancel" element={<StripeCancel />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/data-sources"
                element={
                  <ProtectedRoute>
                    <DataSources />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/subscriptions"
                element={
                  <ProtectedRoute>
                    <Subscriptions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/integrations"
                element={
                  <ProtectedRoute>
                    <Integrations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/workflows"
                element={
                  <ProtectedRoute>
                    <ProFeatureRoute featureName="workflows" requiredPlan="PRO">
                      <Workflows />
                    </ProFeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/analytics"
                element={
                  <ProtectedRoute>
                    <ProFeatureRoute featureName="analytics" requiredPlan="PRO">
                      <AnalyticsDashboard />
                    </ProFeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/voice"
                element={
                  <ProtectedRoute>
                    <VoiceSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/developer"
                element={
                  <ProtectedRoute>
                    <DeveloperPortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/faq"
                element={
                  <ProtectedRoute>
                    <DashboardFaq />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/admin"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <Admin />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/conversation/:id"
                element={
                  <ProtectedRoute>
                    <ConversationChat />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AppErrorBoundary>
      </TooltipProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
