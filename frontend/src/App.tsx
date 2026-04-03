import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePage from "./pages/HomePage";
import DashboardLayout from "./pages/DashboardLayout";
import StudentLayout from "./pages/StudentLayout";
import NotFound from "./pages/NotFound";
import { lazy, Suspense } from "react";
import StudentLoginPage from "./pages/StudentLoginPage";
import WardenLoginPage from "./pages/WardenLoginPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminSignupPage from "./pages/AdminSignupPage";
import ForcePasswordChangePage from "./pages/ForcePasswordChangePage";

// Student pages
const StudentDashboard = lazy(() => import("./features/student/StudentDashboard"));
const StudentProfilePage = lazy(() => import("./features/student/StudentProfilePage"));
const StudentAttendancePage = lazy(() => import("./features/student/StudentAttendancePage"));
const StudentNotificationsPage = lazy(() => import("./features/student/StudentNotificationsPage"));
const ParcelPage = lazy(() => import("./features/student/ParcelPage"));
const GuestPage = lazy(() => import("./features/student/GuestPage"));
const NightLeavePage = lazy(() => import("./features/student/NightLeavePage"));
const MedicalPage = lazy(() => import("./features/student/MedicalPage"));
const SuggestionPage = lazy(() => import("./features/student/SuggestionPage"));
const MessPage = lazy(() => import("./features/student/MessPage"));
const EventsPage = lazy(() => import("./features/student/EventsPage"));
const MaintenancePage = lazy(() => import("./features/student/MaintenancePage"));
const HousekeepingPage = lazy(() => import("./features/student/HousekeepingPage"));
const EmergencyPage = lazy(() => import("./features/student/EmergencyPage"));
const RoomDetailsPage = lazy(() => import("./features/student/RoomDetailsPage"));
const ContactPage = lazy(() => import("./features/student/ContactPage"));
const RequestHistoryPage = lazy(() => import("./features/student/RequestHistoryPage"));
const NoticesPage = lazy(() => import("./features/student/NoticesPage"));
const MissingReportsPage = lazy(() => import("./features/student/missing-reports/MissingReportsPage"));

// Admin/Warden pages
const OverviewPage = lazy(() => import("./features/dashboard/overview/OverviewPage"));
const StudentsPage = lazy(() => import("./features/dashboard/students/StudentsPage"));
const WardensPage = lazy(() => import("./features/dashboard/wardens/WardensPage"));
const AttendancePage = lazy(() => import("./features/dashboard/attendance/AttendancePage"));
const NotificationsPage = lazy(() => import("./features/dashboard/notifications/NotificationsPage"));
const ProfilePage = lazy(() => import("./features/dashboard/profile/ProfilePage"));
const SettingsPage = lazy(() => import("./features/dashboard/settings/SettingsPage"));
const RequestsPage = lazy(() => import("./features/dashboard/requests/RequestsPage"));
const ReportsPage = lazy(() => import("./features/dashboard/reports/ReportsPage"));
const AdminLeaveRequestsPage = lazy(() => import("./features/dashboard/leave-requests/AdminLeaveRequestsPage"));
const AdminGuestEntriesPage = lazy(() => import("./features/dashboard/guest-entries/AdminGuestEntriesPage"));
const AdminParcelsPage = lazy(() => import("./features/dashboard/parcels/AdminParcelsPage"));
const AdminMedicalPage = lazy(() => import("./features/dashboard/medical/AdminMedicalPage"));
const AdminMaintenancePage = lazy(() => import("./features/dashboard/maintenance/AdminMaintenancePage"));
const AdminHousekeepingPage = lazy(() => import("./features/dashboard/housekeeping/AdminHousekeepingPage"));
const AdminMessPage = lazy(() => import("./features/dashboard/mess/AdminMessPage"));
const AdminPaymentsPage = lazy(() => import("./features/dashboard/payments/AdminPaymentsPage"));
const AdminEventsPage = lazy(() => import("./features/dashboard/events/AdminEventsPage"));
const AdminSuggestionsPage = lazy(() => import("./features/dashboard/suggestions/AdminSuggestionsPage"));
const AdminNoticesPage = lazy(() => import("./features/dashboard/notices/AdminNoticesPage"));
const AdminEmergencyPage = lazy(() => import("./features/dashboard/emergency/AdminEmergencyPage"));
const AdminUsersPage = lazy(() => import("./features/dashboard/users/AdminUsersPageEnhanced"));
const AdminMissingReportsPage = lazy(() => import("./features/dashboard/missing-reports/AdminMissingReportsPage"));
const QRCenterPage = lazy(() => import("./features/dashboard/qr-center/QRCenterPage"));

const queryClient = new QueryClient();

const Loading = () => (
  <div className="flex items-center justify-center h-64">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login/student" element={<StudentLoginPage />} />
            <Route path="/login/warden" element={<WardenLoginPage />} />
            <Route path="/login/admin" element={<AdminLoginPage />} />
            <Route path="/signup/admin" element={<AdminSignupPage />} />
            <Route path="/auth/change-password" element={<ForcePasswordChangePage />} />

            {/* Student mobile-first routes */}
            <Route path="/student" element={<StudentLayout />}>
              <Route index element={<StudentDashboard />} />
              <Route path="profile" element={<StudentProfilePage />} />
              <Route path="qr-scan" element={<QRCenterPage />} />
              <Route path="attendance" element={<StudentAttendancePage />} />
              <Route path="notifications" element={<StudentNotificationsPage />} />
              <Route path="parcels" element={<ParcelPage />} />
              <Route path="guest" element={<GuestPage />} />
              <Route path="night-leave" element={<NightLeavePage />} />
              <Route path="medical" element={<MedicalPage />} />
              <Route path="suggestions" element={<SuggestionPage />} />
              <Route path="mess" element={<MessPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="maintenance" element={<MaintenancePage />} />
              <Route path="housekeeping" element={<HousekeepingPage />} />
              <Route path="emergency" element={<EmergencyPage />} />
              <Route path="room" element={<RoomDetailsPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="request-history" element={<RequestHistoryPage />} />
              <Route path="notices" element={<NoticesPage />} />
              <Route path="missing-reports" element={<MissingReportsPage />} />
            </Route>

            {/* Admin/Warden sidebar routes */}
            <Route path="/admin" element={<DashboardLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="qr-center" element={<QRCenterPage />} />
              <Route path="wardens" element={<WardensPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="requests" element={<RequestsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="leave-requests" element={<AdminLeaveRequestsPage />} />
              <Route path="guest-entries" element={<AdminGuestEntriesPage />} />
              <Route path="parcels" element={<AdminParcelsPage />} />
              <Route path="medical" element={<AdminMedicalPage />} />
              <Route path="maintenance" element={<AdminMaintenancePage />} />
              <Route path="housekeeping" element={<AdminHousekeepingPage />} />
              <Route path="mess" element={<AdminMessPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="events" element={<AdminEventsPage />} />
              <Route path="suggestions" element={<AdminSuggestionsPage />} />
              <Route path="notices" element={<AdminNoticesPage />} />
              <Route path="emergency" element={<AdminEmergencyPage />} />
              <Route path="missing-reports" element={<AdminMissingReportsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
