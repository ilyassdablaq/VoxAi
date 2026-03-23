import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Features from "./pages/Features";
import HowItWorks from "./pages/HowItWorks";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import DataSources from "./pages/DataSources";
import ConversationChat from "./pages/ConversationChat";
import Subscriptions from "./pages/Subscriptions";
import Integrations from "./pages/Integrations";
import Workflows from "./pages/Workflows";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import VoiceSettings from "./pages/VoiceSettings";
import DeveloperPortal from "./pages/DeveloperPortal";
import NotFound from "./pages/NotFound";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/features" element={<Features />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/sign-in" element={<SignIn />} />
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
                <Workflows />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsDashboard />
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
            path="/conversation/:id"
            element={
              <ProtectedRoute>
                <ConversationChat />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  </TooltipProvider>
);

export default App;
