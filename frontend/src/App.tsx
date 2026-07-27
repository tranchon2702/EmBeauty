import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Index from "./pages/Index";
import Tick from "./pages/Tick";
import About from "./pages/About";
import EmployeeLogin from "./pages/EmployeeLogin";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import InvoiceCreate from "./pages/InvoiceCreate";
import EmployeeStats from "./pages/EmployeeStats";
import EmployeeManagement from "./pages/EmployeeManagement";

const App = () => {
  return (
    <>
      <Toaster
        position="bottom-center"
        richColors
        closeButton
        duration={3500}
        gap={8}
        offset={20}
        toastOptions={{
          style: {
            fontFamily: "'Outfit', system-ui, sans-serif",
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          {/* ── Customer Facing Routes ── */}
          <Route path="/" element={<Index />} />
          <Route path="/tick" element={<Tick />} />
          <Route path="/about" element={<About />} />

          {/* ── Internal Staff Portal — primary route ── */}
          <Route path="/staff" element={<EmployeeLogin />} />
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="/employee/invoice/create" element={<InvoiceCreate />} />
          <Route path="/employee/stats" element={<EmployeeStats />} />
          <Route path="/employee/management" element={<EmployeeManagement />} />

          {/* Redirect old paths to new /staff */}
          <Route path="/noi-bo" element={<Navigate to="/staff" replace />} />
          <Route path="/employee" element={<Navigate to="/staff" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default App;
