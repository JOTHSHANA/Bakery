import {
  HashRouter,
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import ProtectedRoute from "./components/utils/ProtectedRoute";
import AppLayout from "./components/appLayout/Layout";
import ToastMessage from "./components/toast/toast";
import ThemeProviderWrapper from "./components/appLayout/theme/toggleTheme";

import Scan from "./pages/bill/Scan";
import Dashboard from "./pages/Dashboard/Dashboard";
import QRForm from "./pages/GenerateQR/generateQR";
import History from "./pages/history/history";
import Products from "./pages/products/products";
import Register from "./pages/loginPage/register";
import Login from "./pages/loginPage/loginPage";
import Attendance from "./pages/Attendance/AttendancePage";
import AttendanceForm from "./components/table/AttendanceForm";

import "./App.css";

const isElectron =
  window?.process?.versions?.electron ||
  window.navigator.userAgent.includes("Electron");

const Router = isElectron ? HashRouter : BrowserRouter;

console.log(
  "isElectron:",
  isElectron,
  "Router:",
  isElectron ? "HashRouter" : "BrowserRouter"
);

function App() {
  return (
    <ThemeProviderWrapper>
      <Router>
        <ToastMessage />

        <Routes>

          {/* PUBLIC ROUTES */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* PROTECTED ROUTES */}
          <Route
            path="/scan"
            element={
              <ProtectedRoute>
                <AppLayout body={<Scan />} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout body={<Dashboard />} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <AppLayout body={<History />} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/qr"
            element={
              <ProtectedRoute>
                <AppLayout body={<QRForm />} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <AppLayout body={<Products />} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <AppLayout body={<Attendance />} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance-form"
            element={
              <ProtectedRoute>
                <AppLayout body={<AttendanceForm />} />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<div>404 - Page Not Found</div>} />

        </Routes>
      </Router>
    </ThemeProviderWrapper>
  );
}

export default App;