import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Toaster } from '@/components/ui/toaster'
import { PushModal } from '@/components/push-modal'

import LoginPage from '@/pages/auth/login'
import RegisterPage from '@/pages/auth/register'
import ForgotPasswordPage from '@/pages/auth/forgot-password'
import ResetPasswordPage from '@/pages/auth/reset-password'
import AppLayout from '@/components/layout/app-layout'
import DashboardPage from '@/pages/dashboard'
import CasesPage from '@/pages/cases'
import CaseDetailPage from '@/pages/cases/detail'
import NewCasePage from '@/pages/cases/new'
import FinancialPage from '@/pages/financial'
import SellerPage from '@/pages/seller'
import AdminUsersPage from '@/pages/admin/users'
import AdminServicesPage from '@/pages/admin/services'
import AdminPushPage from '@/pages/admin/push'
import AdminModulesPage from '@/pages/admin/modules'
import AdminSettingsPage from '@/pages/admin/settings'
import ProfilePage from '@/pages/profile'
import PlanningCenterPage from '@/pages/workflow/planning-center'
import { PrintingPage, LaboratoryPage, ExpeditionPage } from '@/pages/workflow/workflow-stages'
import PatientsPage from '@/pages/patients'
import NewPatientPage from '@/pages/patients/new'
import PatientDetailPage from '@/pages/patients/detail'
import DentistsPage from '@/pages/dentists'
import DentistDetailPage from '@/pages/dentists/detail'
import CompletionFormPage from '@/pages/patients/forms/completion'
import OtherServicesFormPage from '@/pages/patients/forms/other-services'
import NewClinicalRecordPage from '@/pages/patients/forms/clinical-record'

const WORKFLOW_ROLES = ['LAB_TECH', 'ADMIN', 'FINANCIAL']
const PATIENT_ROLES = ['DENTIST', 'LAB_TECH', 'ADMIN', 'FINANCIAL']

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { user, pendingPushes, clearPushes } = useAuthStore()

  return (
    <BrowserRouter>
      {user && pendingPushes.length > 0 && (
        <PushModal pushes={pendingPushes} onClose={clearPushes} />
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />

          <Route path="patients" element={<ProtectedRoute roles={PATIENT_ROLES}><PatientsPage /></ProtectedRoute>} />
          <Route path="patients/new" element={<ProtectedRoute roles={PATIENT_ROLES}><NewPatientPage /></ProtectedRoute>} />
          <Route path="patients/:id" element={<ProtectedRoute roles={PATIENT_ROLES}><PatientDetailPage /></ProtectedRoute>} />
          <Route path="patients/:id/edit" element={<ProtectedRoute roles={PATIENT_ROLES}><NewPatientPage /></ProtectedRoute>} />
          <Route path="patients/:patientId/forms/completion/new" element={<ProtectedRoute roles={PATIENT_ROLES}><CompletionFormPage /></ProtectedRoute>} />
          <Route path="patients/:patientId/forms/other-services/new" element={<ProtectedRoute roles={PATIENT_ROLES}><OtherServicesFormPage /></ProtectedRoute>} />
          <Route path="patients/:patientId/clinical-records/new" element={<ProtectedRoute roles={PATIENT_ROLES}><NewClinicalRecordPage /></ProtectedRoute>} />

          <Route path="dentists" element={<ProtectedRoute roles={['ADMIN','LAB_TECH','FINANCIAL']}><DentistsPage /></ProtectedRoute>} />
          <Route path="dentists/:id" element={<ProtectedRoute roles={['ADMIN','LAB_TECH','FINANCIAL']}><DentistDetailPage /></ProtectedRoute>} />

          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/new" element={<ProtectedRoute roles={['DENTIST']}><NewCasePage /></ProtectedRoute>} />
          <Route path="cases/:id" element={<CaseDetailPage />} />

          <Route path="workflow/planning-center" element={<ProtectedRoute roles={WORKFLOW_ROLES}><PlanningCenterPage /></ProtectedRoute>} />
          <Route path="workflow/printing" element={<ProtectedRoute roles={WORKFLOW_ROLES}><PrintingPage /></ProtectedRoute>} />
          <Route path="workflow/laboratory" element={<ProtectedRoute roles={WORKFLOW_ROLES}><LaboratoryPage /></ProtectedRoute>} />
          <Route path="workflow/expedition" element={<ProtectedRoute roles={WORKFLOW_ROLES}><ExpeditionPage /></ProtectedRoute>} />

          <Route path="financial" element={<ProtectedRoute roles={['FINANCIAL','ADMIN']}><FinancialPage /></ProtectedRoute>} />
          <Route path="seller" element={<ProtectedRoute roles={['SELLER']}><SellerPage /></ProtectedRoute>} />

          <Route path="admin/users" element={<ProtectedRoute roles={['ADMIN']}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="admin/services" element={<ProtectedRoute roles={['ADMIN']}><AdminServicesPage /></ProtectedRoute>} />
          <Route path="admin/push" element={<ProtectedRoute roles={['ADMIN','SELLER']}><AdminPushPage /></ProtectedRoute>} />
          <Route path="admin/modules" element={<ProtectedRoute roles={['ADMIN']}><AdminModulesPage /></ProtectedRoute>} />
          <Route path="admin/settings" element={<ProtectedRoute roles={['ADMIN']}><AdminSettingsPage /></ProtectedRoute>} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
