import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import CalendarHome from "./pages/calendar/CalendarHome.tsx";
import EventDetail from "./pages/calendar/EventDetail.tsx";
import SubmitEvent from "./pages/calendar/SubmitEvent.tsx";
import Organizers from "./pages/calendar/Organizers.tsx";
import OrganizerDetail from "./pages/calendar/OrganizerDetail.tsx";
import CalendarAuth from "./pages/calendar/CalendarAuth.tsx";
import Dashboard from "./pages/calendar/Dashboard.tsx";
import CalendarAdmin from "./pages/calendar/CalendarAdmin.tsx";
import Highlights from "./pages/calendar/Highlights.tsx";
import About from "./pages/calendar/About.tsx";
// import Subscribe from "./pages/calendar/Subscribe.tsx";
import AccountTypes from "./pages/calendar/AccountTypes.tsx";
import CheckoutReturn from "./pages/calendar/CheckoutReturn.tsx";
import { DioceseProvider } from "./context/DioceseContext.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Diocese-scoped calendar: /catholic-calendar/d/:dioceseSlug is a
              shareable per-city view of the same calendar. */}
          <Route
            path="/*"
            element={
              <DioceseProvider>
                <Routes>
                  <Route path="/" element={<Navigate to="/catholic-calendar" replace />} />
                  <Route path="/catholic-calendar" element={<CalendarHome />} />
                  <Route path="/catholic-calendar/d/:dioceseSlug" element={<CalendarHome />} />
                  <Route path="/catholic-calendar/highlights" element={<Highlights />} />
                  <Route path="/catholic-calendar/about" element={<About />} />
                  <Route path="/catholic-calendar/event/:id" element={<EventDetail />} />
                  <Route path="/catholic-calendar/submit" element={<SubmitEvent />} />
                  <Route path="/catholic-calendar/organizers" element={<Organizers />} />
                  <Route path="/catholic-calendar/organizers/:userId" element={<OrganizerDetail />} />
                  <Route path="/catholic-calendar/auth" element={<CalendarAuth />} />
                  <Route path="/catholic-calendar/dashboard" element={<Dashboard />} />
                  <Route path="/catholic-calendar/admin" element={<CalendarAdmin />} />
                  <Route path="/catholic-calendar/accounts" element={<AccountTypes />} />
                  {/* Plans/subscribe hidden while payments are disabled — kept as redirect so links don't 404. */}
                  <Route path="/catholic-calendar/subscribe" element={<Navigate to="/catholic-calendar/dashboard" replace />} />
                  <Route path="/catholic-calendar/checkout/return" element={<CheckoutReturn />} />
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </DioceseProvider>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
