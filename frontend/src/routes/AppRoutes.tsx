import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import AppShell from '../layouts/AppShell';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import DashboardPage from '../pages/DashboardPage';
import ProcurementListPage from '../pages/ProcurementListPage';
import ProcurementCreatePage from '../pages/ProcurementCreatePage';
import ProcurementEditPage from '../pages/ProcurementEditPage';
import ProcurementDetailPage from '../pages/ProcurementDetailPage';
import InvitationsPage from '../pages/InvitationsPage';
import BiddingRoomPage from '../pages/BiddingRoomPage';
import EvaluationPage from '../pages/EvaluationPage';
import ApprovalsPage from '../pages/ApprovalsPage';
import ResultsPage from '../pages/ResultsPage';
import ResultDetailPage from '../pages/ResultDetailPage';
import VendorsPage from '../pages/VendorsPage';
import AuditPage from '../pages/AuditPage';
import SubmissionsPage from '../pages/SubmissionsPage';
import ReportingPage from '../pages/ReportingPage';
import VendorAnalyticsPage from '../pages/VendorAnalyticsPage';
import ChangePasswordPage from '../pages/ChangePasswordPage';

const ROLE_ROUTES: Record<string, string[]> = {
  // CenBidding Platform - role-based route access control
  ADMIN: ['*'],
  APPROVER: ['dashboard', 'procurements', 'approvals', 'audit', 'reporting'],
  LEAD_EVALUATOR: ['dashboard', 'procurements', 'evaluation', 'results'],
  EVALUATOR: ['dashboard', 'procurements', 'evaluation', 'results'],
  PROCUREMENT: ['dashboard', 'procurements', 'vendors', 'invitations', 'audit', 'reporting', 'bidding', 'approvals', 'results', 'evaluation'],
  VENDOR: ['dashboard', 'procurements', 'submissions', 'bidding', 'results', 'analytics', 'invitations'],
  REQUESTER: ['dashboard', 'procurements'],
};

function hasAccess(role: string, path: string): boolean {
  const allowed = ROLE_ROUTES[role];
  if (!allowed) return false;
  if (allowed.includes('*')) return true;
  const segment = path.replace(/^\//, '').split('/')[0] || 'dashboard';
  return allowed.includes(segment);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">Loading...</Typography>
    </Box>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  if (!user) return <Navigate to="/login" replace />;
  useEffect(() => {
    if (!hasAccess(user.role, path)) {
      setShowAccessDenied(true);
      const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 3000);
      return () => clearTimeout(timer);
    }
  }, [user, path, navigate]);
  if (showAccessDenied) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 2 }}>
        <Alert severity="warning" sx={{ maxWidth: 400 }}>
          You don't have permission to access this page. Redirecting to dashboard...
        </Alert>
      </Box>
    );
  }
  if (!hasAccess(user.role, path)) return null;
  return <>{children}</>;
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 2 }}>
      <Typography variant="h1" fontWeight={700} color="text.secondary">404</Typography>
      <Typography color="text.secondary">Page not found</Typography>
      <Button variant="contained" onClick={() => navigate('/dashboard')} sx={{ mt: 2 }}>Go to Dashboard</Button>
    </Box>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="procurements" element={<RoleGuard path="/procurements"><ProcurementListPage /></RoleGuard>} />
            <Route path="procurements/new" element={<RoleGuard path="/procurements"><ProcurementCreatePage /></RoleGuard>} />
            <Route path="procurements/:id" element={<RoleGuard path="/procurements"><ProcurementDetailPage /></RoleGuard>} />
            <Route path="procurements/:id/edit" element={<RoleGuard path="/procurements"><ProcurementEditPage /></RoleGuard>} />
            <Route path="invitations" element={<RoleGuard path="/invitations"><InvitationsPage /></RoleGuard>} />
            <Route path="bidding" element={<RoleGuard path="/bidding"><BiddingRoomPage /></RoleGuard>} />
            <Route path="evaluation" element={<RoleGuard path="/evaluation"><EvaluationPage /></RoleGuard>} />
            <Route path="approvals" element={<RoleGuard path="/approvals"><ApprovalsPage /></RoleGuard>} />
            <Route path="results" element={<RoleGuard path="/results"><ResultsPage /></RoleGuard>} />
            <Route path="results/:id" element={<RoleGuard path="/results"><ResultDetailPage /></RoleGuard>} />
            <Route path="vendors" element={<RoleGuard path="/vendors"><VendorsPage /></RoleGuard>} />
            <Route path="audit" element={<RoleGuard path="/audit"><AuditPage /></RoleGuard>} />
            <Route path="reporting" element={<RoleGuard path="/reporting"><ReportingPage /></RoleGuard>} />
            <Route path="analytics" element={<RoleGuard path="/analytics"><VendorAnalyticsPage /></RoleGuard>} />
            <Route path="change-password" element={<ChangePasswordPage />} />
            <Route path="submissions" element={<RoleGuard path="/submissions"><SubmissionsPage /></RoleGuard>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
