import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { io } from "socket.io-client";
import QRCode from "qrcode";

type Role = "STUDENT" | "ADMIN" | "WARDEN";
type AuthMode = "LOGIN" | "SIGNUP";
type AppView = "HOME" | "AUTH" | "DASHBOARD";
type SidebarSection =
  | "overview"
  | "qr"
  | "students"
  | "wardens"
  | "attendance"
  | "logs"
  | "requests"
  | "notifications"
  | "reports"
  | "settings"
  | "profile";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  first_login: boolean;
};

type ScanLog = {
  id: string;
  time: string;
  name: string;
  hostel_id: string;
  dir: "IN" | "OUT";
  method: string;
  gate_id?: string | null;
  request_id?: string;
};

type InvalidScan = {
  id: string;
  time: string;
  name: string;
  hostel_id: string;
  gate_id?: string | null;
  reason: string;
  request_id?: string;
};

type OverviewResponse = {
  stats: {
    total: number;
    in: number;
    out: number;
  };
  logs: ScanLog[];
  security: {
    invalid_total: number;
    recent_invalid_scans: InvalidScan[];
  };
};

type AttendanceRow = {
  id: string;
  name: string;
  room: string;
  status: "PRESENT" | "ON_LEAVE" | "ABSENT" | "LATE_RETURN" | "UNVERIFIED";
  remarks: string;
};

type RequestItem = {
  id: string;
  student: string;
  type: "LEAVE" | "GUEST";
  submittedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

type StudentRow = {
  id: string;
  name: string;
  room: string;
  status: "IN" | "OUT";
  hostel_id: string;
};

type WardenRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  shift: string;
};

type ReportData = {
  weekly_attendance_percent: number;
  monthly_attendance_percent: number;
  late_returns: number;
  invalid_scans: number;
};

type SettingsData = {
  default_gate: string;
  attendance_cutoff_time: string;
  alert_email: string;
};

type ProfileData = {
  id: string;
  name: string;
  email: string;
  role: string;
  first_login: boolean;
  is_active: boolean;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  level: "INFO" | "WARNING" | "CRITICAL";
  at: string;
  read: boolean;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";
const LOGO_CANDIDATE_PATHS = [
  "/guardian-gate-logo.png",
  "/guardian-gate-logo.svg",
  "/logo.png",
  "/logo.svg",
  "/logo.jpg",
  "/logo.jpeg",
  "/logo.webp",
];
const TOKEN_STORAGE_KEY = "guardian_portal_access_token";
const SELECTED_ROLE_KEY = "guardian_portal_selected_role";
const LIVE_LOG_LIMIT = 20;
const PAGE_SIZE = 8;

const HOME_ROLE_OPTIONS: Array<{ role: Role; title: string; subtitle: string }> = [
  {
    role: "STUDENT",
    title: "Student Login",
    subtitle: "Access attendance, scan history, and notifications.",
  },
  {
    role: "ADMIN",
    title: "Admin Login",
    subtitle: "Manage hostel operations, logs, and system settings.",
  },
  {
    role: "WARDEN",
    title: "Warden Login",
    subtitle: "Monitor movement, attendance, and pending requests.",
  },
];

const HOME_FEATURES: Array<{ icon: string; title: string; description: string }> = [
  {
    icon: "🔐",
    title: "Secure QR Entry",
    description: "Signed gate tokens with validation checks for trusted access.",
  },
  {
    icon: "📊",
    title: "Attendance Tracking",
    description: "Live attendance and movement records aligned to hostel operations.",
  },
  {
    icon: "🧭",
    title: "Role-Based Dashboards",
    description: "Focused workspaces for students, wardens, and administrators.",
  },
  {
    icon: "🛰️",
    title: "Real-Time Monitoring",
    description: "Instant updates on entry logs, alerts, and critical events.",
  },
  {
    icon: "🗂️",
    title: "Request Management",
    description: "Structured workflows for approvals, reviews, and follow-up.",
  },
];

const SECTION_LABELS: Record<SidebarSection, string> = {
  overview: "Overview",
  qr: "QR Center",
  students: "Students",
  wardens: "Wardens",
  attendance: "Attendance",
  logs: "Logs",
  requests: "Requests",
  notifications: "Notifications",
  reports: "Reports",
  settings: "Settings",
  profile: "Profile",
};

const ROLE_NAV: Record<Role, SidebarSection[]> = {
  ADMIN: [
    "overview",
    "qr",
    "students",
    "wardens",
    "attendance",
    "logs",
    "requests",
    "notifications",
    "reports",
    "settings",
  ],
  WARDEN: [
    "overview",
    "qr",
    "attendance",
    "logs",
    "requests",
    "notifications",
    "reports",
    "settings",
  ],
  STUDENT: ["overview", "qr", "attendance", "notifications", "profile"],
};

function App() {
  const [view, setView] = useState<AppView>("HOME");
  const [selectedRole, setSelectedRole] = useState<Role>(() => {
    const remembered = localStorage.getItem(SELECTED_ROLE_KEY);
    return remembered === "STUDENT" || remembered === "WARDEN"
      ? remembered
      : "ADMIN";
  });
  const [authMode, setAuthMode] = useState<AuthMode>("LOGIN");

  const [email, setEmail] = useState("admin@guardian.com");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [stats, setStats] = useState({ total: 0, in: 0, out: 0 });
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [invalidTotal, setInvalidTotal] = useState(0);
  const [invalidScans, setInvalidScans] = useState<InvalidScan[]>([]);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState({
    present: 0,
    on_leave: 0,
    absent: 0,
    late_return: 0,
  });

  const [requestRows, setRequestRows] = useState<RequestItem[]>([]);
  const [requestSummary, setRequestSummary] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [wardenRows, setWardenRows] = useState<WardenRow[]>([]);

  const [reportData, setReportData] = useState<ReportData>({
    weekly_attendance_percent: 0,
    monthly_attendance_percent: 0,
    late_returns: 0,
    invalid_scans: 0,
  });

  const [settingsData, setSettingsData] = useState<SettingsData>({
    default_gate: "G-01",
    attendance_cutoff_time: "22:00",
    alert_email: "alerts@guardian.com",
  });

  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const [collapsedSidebar, setCollapsedSidebar] = useState(false);
  const [activeSection, setActiveSection] =
    useState<SidebarSection>("overview");

  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [attendanceRoomFilter, setAttendanceRoomFilter] = useState("ALL");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("ALL");

  const [qrGateId, setQrGateId] = useState("G-01");
  const [qrTokenValue, setQrTokenValue] = useState("");
  const [qrTokenExpiresAt, setQrTokenExpiresAt] = useState<string | null>(null);
  const [qrImageDataUrl, setQrImageDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const [scanTokenInput, setScanTokenInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [logSearch, setLogSearch] = useState("");
  const [logDirectionFilter, setLogDirectionFilter] = useState<"ALL" | "IN" | "OUT">(
    "ALL",
  );
  const [logGateFilter, setLogGateFilter] = useState("ALL");
  const [logPage, setLogPage] = useState(1);
  const currentViewRef = useRef<AppView>("HOME");
  const hasCheckedSessionOnLoadRef = useRef(false);

  const resolvedRole: Role = useMemo(() => {
    if (authUser?.role === "STUDENT") return "STUDENT";
    if (authUser?.role === "WARDEN") return "WARDEN";
    return "ADMIN";
  }, [authUser]);

  const currentNav = ROLE_NAV[resolvedRole];

  const filteredAttendance = useMemo(() => {
    return attendanceRows.filter((row) => {
      const roomOk = attendanceRoomFilter === "ALL" || row.room.startsWith(attendanceRoomFilter);
      const statusOk = attendanceStatusFilter === "ALL" || row.status === attendanceStatusFilter;
      return roomOk && statusOk;
    });
  }, [attendanceRows, attendanceRoomFilter, attendanceStatusFilter]);

  const allGates = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.gate_id) {
        set.add(log.gate_id);
      }
    });
    return Array.from(set);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const search = logSearch.trim().toLowerCase();
    return logs.filter((log) => {
      const directionOk = logDirectionFilter === "ALL" || log.dir === logDirectionFilter;
      const gateOk = logGateFilter === "ALL" || log.gate_id === logGateFilter;
      const searchOk =
        !search ||
        log.name.toLowerCase().includes(search) ||
        log.hostel_id.toLowerCase().includes(search);
      return directionOk && gateOk && searchOk;
    });
  }, [logs, logDirectionFilter, logGateFilter, logSearch]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = useMemo(() => {
    const safePage = Math.min(logPage, totalLogPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, logPage, totalLogPages]);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  useEffect(() => {
    currentViewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (logPage > totalLogPages) {
      setLogPage(totalLogPages);
    }
  }, [logPage, totalLogPages]);

  useEffect(() => {
    const renderQr = async () => {
      if (!qrTokenValue) {
        setQrImageDataUrl(null);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(qrTokenValue, {
          width: 240,
          margin: 1,
          color: {
            dark: "#102a43",
            light: "#ffffff",
          },
        });
        setQrImageDataUrl(dataUrl);
      } catch (_error) {
        setQrImageDataUrl(null);
        setQrError("Unable to render QR image.");
      }
    };

    void renderQr();
  }, [qrTokenValue]);

  const applySession = (
    accessToken: string,
    user?: AuthUser,
    options?: { redirectToDashboard?: boolean },
  ) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setToken(accessToken);
    setSessionNotice(null);
    setIsRestoringSession(false);
    if (user) {
      setAuthUser(user);
      const userRole: Role =
        user.role === "STUDENT"
          ? "STUDENT"
          : user.role === "WARDEN"
            ? "WARDEN"
            : "ADMIN";
      setSelectedRole(userRole);
      localStorage.setItem(SELECTED_ROLE_KEY, userRole);
      if (options?.redirectToDashboard) {
        setView("DASHBOARD");
        setActiveSection("overview");
      }
    }
  };

  const clearSession = (nextView: AppView = "HOME") => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setAuthUser(null);
    setIsRestoringSession(false);
    setStats({ total: 0, in: 0, out: 0 });
    setLogs([]);
    setInvalidTotal(0);
    setInvalidScans([]);
    setView(nextView);
  };

  const roleToClient = (role: Role): "web" | "mobile" =>
    role === "STUDENT" ? "mobile" : "web";

  const passwordStrength = useMemo(() => {
    if (!signupPassword) {
      return "";
    }
    if (signupPassword.length < 8) return "Weak";
    if (signupPassword.length < 12) return "Medium";
    return "Strong";
  }, [signupPassword]);

  const fetchMe = async (
    accessToken: string,
    options?: { redirectToDashboard?: boolean },
  ) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error("Session expired");
    }

    const data = (await response.json()) as { user: AuthUser };
    setAuthUser(data.user);
    const userRole: Role =
      data.user.role === "STUDENT"
        ? "STUDENT"
        : data.user.role === "WARDEN"
          ? "WARDEN"
          : "ADMIN";
    setSelectedRole(userRole);
    localStorage.setItem(SELECTED_ROLE_KEY, userRole);
    if (options?.redirectToDashboard) {
      setView("DASHBOARD");
      setActiveSection("overview");
    }
    return data.user;
  };

  const refreshSession = async (
    options?: { redirectToDashboard?: boolean },
  ): Promise<string | null> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      setSessionNotice("Session expired. Please sign in again.");
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      user: AuthUser;
    };
    applySession(data.access_token, data.user, {
      redirectToDashboard: options?.redirectToDashboard ?? false,
    });
    return data.access_token;
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (_error) {
    } finally {
      clearSession();
    }
  };

  const fetchJsonWithAuth = async <T,>(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: unknown,
  ): Promise<T | null> => {
    if (!token) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    if (response.status === 401 || response.status === 403) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        clearSession();
        return null;
      }

      const retry = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${refreshed}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
      });

      if (!retry.ok) {
        return null;
      }

      return (await retry.json()) as T;
    }

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (hasCheckedSessionOnLoadRef.current) {
        return;
      }

      hasCheckedSessionOnLoadRef.current = true;

      if (!token) {
        return;
      }

      try {
        setIsRestoringSession(true);
        await fetchMe(token, { redirectToDashboard: true });
      } catch (_error) {
        const refreshedToken = await refreshSession({
          redirectToDashboard: true,
        });
        if (!refreshedToken) {
          clearSession(
            currentViewRef.current === "AUTH" ? "AUTH" : "HOME",
          );
          return;
        }

        try {
          await fetchMe(refreshedToken, { redirectToDashboard: true });
        } catch (_verifyError) {
          clearSession(
            currentViewRef.current === "AUTH" ? "AUTH" : "HOME",
          );
        }
      } finally {
        setIsRestoringSession(false);
      }
    };

    void bootstrap();
  }, [token]);

  useEffect(() => {
    const fetchOverview = async () => {
      if (!token || !authUser || !["ADMIN", "WARDEN"].includes(authUser.role)) {
        return;
      }

      try {
        setOverviewError(null);
        const response = await fetch(`${API_BASE_URL}/api/v1/dashboard/overview`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401 || response.status === 403) {
          const refreshed = await refreshSession();
          if (!refreshed) {
            clearSession();
            return;
          }

          const retry = await fetch(`${API_BASE_URL}/api/v1/dashboard/overview`, {
            headers: { Authorization: `Bearer ${refreshed}` },
          });

          if (!retry.ok) {
            throw new Error("Failed to load dashboard data");
          }

          const retryData = (await retry.json()) as OverviewResponse;
          setStats(retryData.stats);
          setLogs(retryData.logs);
          setInvalidTotal(retryData.security.invalid_total);
          setInvalidScans(retryData.security.recent_invalid_scans);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load dashboard data");
        }

        const data = (await response.json()) as OverviewResponse;
        setStats(data.stats);
        setLogs(data.logs);
        setInvalidTotal(data.security.invalid_total);
        setInvalidScans(data.security.recent_invalid_scans);
      } catch (_error) {
        setOverviewError("Unable to load dashboard overview");
      }
    };

    void fetchOverview();
  }, [token, authUser]);

  useEffect(() => {
    if (!token || !authUser || !["ADMIN", "WARDEN"].includes(authUser.role)) {
      return;
    }

    const socket = io(API_BASE_URL, {
      transports: ["websocket"],
      auth: { token },
    });

    const onScanRecorded = (eventLog: ScanLog) => {
      setLogs((previousLogs) => [eventLog, ...previousLogs].slice(0, LIVE_LOG_LIMIT));
      setStats((currentStats) => {
        if (eventLog.dir === "IN") {
          return {
            ...currentStats,
            in: currentStats.in + 1,
            out: Math.max(0, currentStats.out - 1),
          };
        }

        return {
          ...currentStats,
          in: Math.max(0, currentStats.in - 1),
          out: currentStats.out + 1,
        };
      });
    };

    const onScanInvalid = (event: InvalidScan) => {
      setInvalidTotal((current) => current + 1);
      setInvalidScans((current) => [event, ...current].slice(0, 5));
    };

    socket.on("scan:recorded", onScanRecorded);
    socket.on("scan:invalid", onScanInvalid);

    return () => {
      socket.off("scan:recorded", onScanRecorded);
      socket.off("scan:invalid", onScanInvalid);
      socket.disconnect();
    };
  }, [token, authUser]);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!token || !authUser) {
        return;
      }

      const query = new URLSearchParams({
        date: attendanceDate,
        room_prefix: attendanceRoomFilter,
        status: attendanceStatusFilter,
      }).toString();

      const data = await fetchJsonWithAuth<{
        summary: { present: number; on_leave: number; absent: number; late_return: number };
        rows: AttendanceRow[];
      }>(`/api/v1/dashboard/attendance?${query}`);

      if (!data) {
        return;
      }

      setAttendanceSummary(data.summary);
      setAttendanceRows(data.rows);
    };

    void fetchAttendance();
  }, [token, authUser, attendanceDate, attendanceRoomFilter, attendanceStatusFilter]);

  useEffect(() => {
    const fetchModuleData = async () => {
      if (!token || !authUser) {
        return;
      }

      if (["ADMIN", "WARDEN"].includes(authUser.role)) {
        const [studentsData, wardensData, requestsData, reportsData, settingsApi] = await Promise.all([
          fetchJsonWithAuth<{ rows: StudentRow[] }>("/api/v1/dashboard/students"),
          fetchJsonWithAuth<{ rows: WardenRow[] }>("/api/v1/dashboard/wardens"),
          fetchJsonWithAuth<{
            summary: { pending: number; approved: number; rejected: number };
            rows: Array<{ id: string; student: string; type: "LEAVE" | "GUEST"; submitted_at: string; status: "PENDING" | "APPROVED" | "REJECTED" }>;
          }>("/api/v1/dashboard/requests"),
          fetchJsonWithAuth<ReportData>("/api/v1/dashboard/reports"),
          fetchJsonWithAuth<SettingsData>("/api/v1/dashboard/settings"),
        ]);

        if (studentsData) {
          setStudentRows(studentsData.rows);
        }

        if (wardensData) {
          setWardenRows(wardensData.rows);
        }

        if (requestsData) {
          setRequestSummary(requestsData.summary);
          setRequestRows(
            requestsData.rows.map((row) => ({
              id: row.id,
              student: row.student,
              type: row.type,
              submittedAt: row.submitted_at,
              status: row.status,
            })),
          );
        }

        if (reportsData) {
          setReportData(reportsData);
        }

        if (settingsApi) {
          setSettingsData(settingsApi);
        }
      }

      const [notificationsData, profileApi] = await Promise.all([
        fetchJsonWithAuth<{ unread: number; rows: NotificationItem[] }>("/api/v1/dashboard/notifications"),
        fetchJsonWithAuth<ProfileData>("/api/v1/dashboard/profile"),
      ]);

      if (notificationsData) {
        setNotifications(notificationsData.rows);
      }

      if (profileApi) {
        setProfileData(profileApi);
      }

      if (["ADMIN", "WARDEN"].includes(authUser.role)) {
        const logsData = await fetchJsonWithAuth<{
          rows: ScanLog[];
        }>("/api/v1/dashboard/logs?page=1&page_size=200");

        if (logsData) {
          setLogs(logsData.rows);
        }
      }
    };

    void fetchModuleData();
  }, [token, authUser]);

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    localStorage.setItem(SELECTED_ROLE_KEY, role);
    setAuthMode("LOGIN");
    setAuthError(null);
    setSessionNotice(null);
    setForgotMessage(null);
    setShowForgot(false);

    if (role === "STUDENT") {
      setEmail("student@guardian.com");
      setPassword("student123");
    } else {
      setEmail("admin@guardian.com");
      setPassword("admin123");
    }

    setView("AUTH");
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    if (!email.trim() || !password.trim()) {
      setAuthError("Email and password are required.");
      setAuthLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          client: roleToClient(selectedRole),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.message || "Invalid credentials");
        return;
      }

      applySession(data.access_token, data.user, {
        redirectToDashboard: true,
      });
    } catch (_error) {
      setAuthError("Unable to connect to API server.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    if (!signupName.trim() || !signupEmail.trim()) {
      setAuthError("Name and email are required.");
      setAuthLoading(false);
      return;
    }

    if (signupPassword.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      setAuthLoading(false);
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setAuthError("Password confirmation does not match.");
      setAuthLoading(false);
      return;
    }

    try {
      const registerResponse = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
          role: "ADMIN",
        }),
      });

      const registerData = await registerResponse.json();
      if (!registerResponse.ok) {
        setAuthError(registerData.message || "Unable to sign up.");
        return;
      }

      const loginResponse = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          client: "web",
        }),
      });

      const loginData = await loginResponse.json();
      if (!loginResponse.ok) {
        setAuthError(loginData.message || "Sign up succeeded, login failed.");
        return;
      }

      applySession(loginData.access_token, loginData.user, {
        redirectToDashboard: true,
      });
    } catch (_error) {
      setAuthError("Unable to connect to API server.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotSubmit = () => {
    if (!forgotEmail.trim()) {
      setForgotMessage("Please enter your email to continue.");
      return;
    }
    setForgotMessage(
      "Password reset request noted. Please contact hostel administration to complete reset.",
    );
  };

  const markNotificationRead = async (id: string) => {
    const previous = notifications;

    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );

    const response = await fetchJsonWithAuth<{ id: string; read: boolean }>(
      `/api/v1/dashboard/notifications/${id}/read`,
      "POST",
    );

    if (!response) {
      setNotifications(previous);
    }
  };

  const markAllNotificationsRead = async () => {
    if (notifications.every((item) => item.read)) {
      return;
    }

    const previous = notifications;
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));

    const response = await fetchJsonWithAuth<{ updated: number }>(
      "/api/v1/dashboard/notifications/read-all",
      "POST",
    );

    if (!response) {
      setNotifications(previous);
    }
  };

  const handleGenerateGateToken = async () => {
    const gateId = qrGateId.trim() || "G-01";
    setQrLoading(true);
    setQrError(null);
    setQrTokenValue("");
    setQrTokenExpiresAt(null);
    setQrImageDataUrl(null);

    try {
      const query = encodeURIComponent(gateId);
      const data = await fetchJsonWithAuth<{
        token: string;
        gate_id: string;
        expires_at: string;
      }>(`/api/v1/qr/gate-token?gate_id=${query}`);

      if (!data) {
        setQrError("Unable to generate gate token.");
        return;
      }

      setQrGateId(data.gate_id);
      setQrTokenValue(data.token);
      setQrTokenExpiresAt(data.expires_at);
    } finally {
      setQrLoading(false);
    }
  };

  const handleStudentScanSubmit = async () => {
    const tokenValue = scanTokenInput.trim();
    if (!tokenValue) {
      setScanError("Paste or enter a token before submitting.");
      return;
    }

    setScanLoading(true);
    setScanError(null);
    setScanMessage(null);

    try {
      const data = await fetchJsonWithAuth<{
        success: boolean;
        message: string;
      }>("/api/v1/scan/submit", "POST", { token: tokenValue });

      if (!data || !data.success) {
        setScanError(data?.message || "Scan failed.");
        return;
      }

      setScanMessage(data.message || "Scan submitted successfully.");
      setScanTokenInput("");
    } finally {
      setScanLoading(false);
    }
  };

  const renderHome = () => (
    <div className="hc-page-shell hc-app-shell">
      {/** HOME TOP ANCHOR */}
      <div id="home-top" />
      <header className="hc-home-nav">
        <BrandMark />
        <div className="hc-home-nav-links">
          <button className="hc-button" onClick={() => setView("AUTH")}>Login</button>
          <button className="hc-button btn-accent" onClick={() => setView(authUser ? "DASHBOARD" : "AUTH")}>Dashboard</button>
        </div>
      </header>

      <section className="hc-home-hero">
        <div className="hc-home-hero-panel">
          <div className="hc-home-hero-split">
            <div className="hc-home-hero-copy">
              <p className="hc-kicker">Secure Hostel Operations Platform</p>
              <h1 className="hc-title-gradient" style={{ margin: 0, fontSize: "2.2rem", lineHeight: 1.14 }}>
                GuardianGate for
                <br />
                Students, Wardens, and Admins
              </h1>
              <p className="hc-home-description" style={{ margin: "0.75rem 0 0" }}>
                A calm, modern interface for QR-based gate access, attendance monitoring,
                notifications, and operational control across your hostel system.
              </p>
              <div className="hc-home-hero-actions">
                <button className="hc-button btn-accent" onClick={() => setView("AUTH")}>Get Started</button>
                <button className="hc-button" onClick={() => {
                  const el = document.getElementById("home-features");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}>Explore Features</button>
              </div>
            </div>
            <div className="hc-home-hero-visual" aria-hidden>
              <div className="hc-home-hero-blob" />
              <div className="hc-home-hero-brand">
                <BrandLogo size="large" />
                <p style={{ margin: "0.6rem 0 0", fontWeight: 700, color: "var(--text-primary)" }}>
                  Trusted QR Validation
                </p>
                <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.83rem" }}>
                  Real-time gate token flow
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="home-access" className="hc-home-panel">
        <div className="hc-access-grid">
          {HOME_ROLE_OPTIONS.map((option) => (
            <button
              key={option.role}
              onClick={() => handleSelectRole(option.role)}
              className={`hc-button hc-access-item hc-access-${option.role.toLowerCase()}`}
            >
              <span style={{ fontSize: "0.97rem", fontWeight: 700 }}>{option.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section id="home-features" className="hc-home-section">
        <h3 className="hc-section-title">Core Features</h3>
        <p style={{ color: "var(--text-muted)", marginTop: "0.35rem" }}>
          Built for daily hostel operations with secure, structured workflows.
        </p>
        <div className="hc-feature-grid">
          {HOME_FEATURES.map((feature) => (
            <article key={feature.title} className="hc-feature-card">
              <div className="hc-feature-icon">{feature.icon}</div>
              <h4 style={{ margin: 0, fontSize: "0.95rem" }}>{feature.title}</h4>
              <p style={{ margin: "0.42rem 0 0", color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="home-docs" className="hc-home-section" style={{ display: "grid", gap: "0.75rem" }}>
        <div className="hc-card" style={{ padding: "0.95rem" }}>
          <h3 className="hc-section-title">How it works</h3>
          <p style={{ color: "var(--text-muted)", marginTop: "0.35rem" }}>
            A straightforward process from scan to attendance record.
          </p>
          <div className="hc-flow-grid">
            <div className="hc-flow-step"><strong>1. QR Scan</strong><p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>Student scans secure gate token.</p></div>
            <div className="hc-flow-step"><strong>2. Validation</strong><p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>System verifies token integrity and time.</p></div>
            <div className="hc-flow-step"><strong>3. Logging</strong><p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>Entry/exit event is recorded instantly.</p></div>
            <div className="hc-flow-step"><strong>4. Attendance</strong><p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>Dashboards update attendance and alerts.</p></div>
          </div>
        </div>

        <div className="hc-stat-row">
          <div className="hc-stat-tile"><strong>Secure System</strong><p style={{ margin: "0.32rem 0 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>Token-signed scan validation</p></div>
          <div className="hc-stat-tile"><strong>Real-Time Monitoring</strong><p style={{ margin: "0.32rem 0 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>Live dashboards and notifications</p></div>
          <div className="hc-stat-tile"><strong>Centralized Management</strong><p style={{ margin: "0.32rem 0 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>Unified control for all roles</p></div>
        </div>
      </section>

      <footer className="hc-home-footer">
        <section>
          <BrandMark />
          <p style={{ marginTop: "0.45rem", lineHeight: 1.55 }}>
            A hostel monitoring and attendance system using QR validation and role-based dashboards.
          </p>
        </section>
        <section>
          <h4>Quick Links</h4>
          <div style={{ display: "grid", gap: "0.38rem", marginTop: "0.45rem", justifyItems: "start" }}>
            <button
              className="hc-button"
              onClick={() => {
                const el = document.getElementById("home-top");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
              Home
            </button>
            <button className="hc-button" onClick={() => setView("AUTH")}>Login</button>
            <button className="hc-button" onClick={() => setView(authUser ? "DASHBOARD" : "AUTH")}>Dashboard</button>
            <button
              className="hc-button"
              onClick={() => {
                const el = document.getElementById("home-docs");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
              Docs
            </button>
          </div>
        </section>
        <section>
          <h4>Developed by</h4>
          <p style={{ marginTop: "0.45rem", lineHeight: 1.55 }}>
            GuardianGate Team
            <br />
            © {new Date().getFullYear()} GuardianGate
          </p>
        </section>
      </footer>
    </div>
  );

  const renderAuth = () => (
    <div className="hc-auth-layout hc-app-shell">
      <section className="hc-auth-brand">
        <BrandMark large />
        <p style={{ color: "var(--text-secondary)", marginTop: "0.8rem" }}>
          Unified authentication portal for Student, Admin, and Warden access.
        </p>

        <ul style={{ marginTop: "1.5rem", color: "var(--text-muted)", lineHeight: 1.7, paddingLeft: "1.1rem" }}>
          <li>Secure entry and exit tracking with signed QR tokens.</li>
          <li>Real-time movement visibility for operational teams.</li>
          <li>Attendance insights and monitoring workflows.</li>
        </ul>

        <button
          className="hc-button"
          style={{ width: "fit-content", marginTop: "1.5rem" }}
          onClick={() => setView("HOME")}
        >
          Back to role selection
        </button>
      </section>

      <section className="hc-auth-form-wrap">
        <div className="hc-card hc-auth-card">
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
                {selectedRole} Authentication
              </h2>
              {selectedRole === "ADMIN" ? (
                <div className="hc-auth-toggle">
                  <button
                    className={`hc-button ${authMode === "LOGIN" ? "active" : ""}`}
                    style={{ padding: "0.35rem 0.7rem" }}
                    aria-pressed={authMode === "LOGIN"}
                    onClick={() => setAuthMode("LOGIN")}
                    type="button"
                  >
                    Login
                  </button>
                  <button
                    className={`hc-button ${authMode === "SIGNUP" ? "active" : ""}`}
                    style={{ padding: "0.35rem 0.7rem" }}
                    aria-pressed={authMode === "SIGNUP"}
                    onClick={() => setAuthMode("SIGNUP")}
                    type="button"
                  >
                    Sign Up
                  </button>
                </div>
              ) : null}
            </div>
            <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>
              Use your assigned credentials to access your workspace.
            </p>
            {isRestoringSession ? (
              <p style={{ marginBottom: 0, marginTop: "0.45rem", color: "var(--accent-secondary)" }}>
                Restoring session securely...
              </p>
            ) : null}
            {sessionNotice ? (
              <p style={{ marginBottom: 0, marginTop: "0.45rem", color: "var(--accent-warning)" }}>
                {sessionNotice}
              </p>
            ) : null}
          </div>

          {authMode === "LOGIN" || selectedRole !== "ADMIN" ? (
            <form onSubmit={handleLogin}>
              <label>Role</label>
              <select
                className="hc-select"
                value={selectedRole}
                onChange={(event) => {
                  const role = event.target.value as Role;
                  setSelectedRole(role);
                  localStorage.setItem(SELECTED_ROLE_KEY, role);
                  setAuthMode("LOGIN");
                }}
                style={{ marginTop: "0.4rem", marginBottom: "0.8rem" }}
              >
                <option value="STUDENT">Student</option>
                <option value="ADMIN">Admin</option>
                <option value="WARDEN">Warden</option>
              </select>

              <label>Email or Username</label>
              <input
                className="hc-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@hostel.edu"
                style={{ marginTop: "0.4rem", marginBottom: "0.8rem" }}
              />

              <label>Password</label>
              <div style={{ position: "relative", marginTop: "0.4rem" }}>
                <input
                  className="hc-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  style={{ paddingRight: "5rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  style={{
                    position: "absolute",
                    right: "0.4rem",
                    top: "0.32rem",
                    border: "none",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <div style={{ marginTop: "0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  style={{ border: "none", background: "transparent", color: "var(--accent-primary)", cursor: "pointer", padding: 0 }}
                  onClick={() => {
                    setShowForgot((previous) => !previous);
                    setForgotMessage(null);
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {showForgot ? (
                <div className="hc-glass-panel" style={{ marginTop: "0.85rem", padding: "0.85rem" }}>
                  <label>Recovery Email</label>
                  <input
                    className="hc-input"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    style={{ marginTop: "0.35rem", marginBottom: "0.6rem" }}
                    placeholder="name@hostel.edu"
                  />
                  <button className="hc-button" type="button" onClick={handleForgotSubmit}>
                    Request Reset
                  </button>
                  {forgotMessage ? (
                    <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>{forgotMessage}</p>
                  ) : null}
                </div>
              ) : null}

              {authError ? <p style={{ color: "var(--accent-danger)", marginTop: "0.8rem" }}>{authError}</p> : null}

              <button className="hc-button btn-accent" type="submit" style={{ marginTop: "0.9rem", width: "100%" }} disabled={authLoading}>
                {authLoading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminSignup}>
              <label>Name</label>
              <input
                className="hc-input"
                value={signupName}
                onChange={(event) => setSignupName(event.target.value)}
                style={{ marginTop: "0.35rem", marginBottom: "0.7rem" }}
              />

              <label>Email</label>
              <input
                className="hc-input"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                style={{ marginTop: "0.35rem", marginBottom: "0.7rem" }}
              />

              <label>Password</label>
              <input
                className="hc-input"
                type="password"
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                style={{ marginTop: "0.35rem", marginBottom: "0.35rem" }}
              />
              {passwordStrength ? (
                <p style={{ color: "var(--text-muted)", marginTop: 0, marginBottom: "0.6rem", fontSize: "0.85rem" }}>
                  Strength: {passwordStrength}
                </p>
              ) : null}

              <label>Confirm Password</label>
              <input
                className="hc-input"
                type="password"
                value={signupConfirmPassword}
                onChange={(event) => setSignupConfirmPassword(event.target.value)}
                style={{ marginTop: "0.35rem", marginBottom: "0.8rem" }}
              />

              {authError ? <p style={{ color: "var(--accent-danger)", marginTop: 0 }}>{authError}</p> : null}

              <button className="hc-button btn-accent" type="submit" style={{ width: "100%" }} disabled={authLoading}>
                {authLoading ? "Creating account..." : "Create Admin Account"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );

  const renderOverviewByRole = () => {
    if (resolvedRole === "STUDENT") {
      return (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="hc-card" style={{ padding: "1rem" }}>
            <h3 className="hc-section-title">Welcome, {authUser?.name}</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>
              Current status: <span className="badge badge-neutral">Inside/Outside status available after scan sync</span>
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
            <MetricCard label="Attendance" value={92} hint="Last 30 days %" tone="success" />
            <MetricCard label="Scans this week" value={12} hint="Movement events" />
            <MetricCard label="Unread Notices" value={unreadNotifications} hint="Needs attention" tone="warning" />
          </div>
          <div className="hc-card" style={{ padding: "1rem" }}>
            <h3 className="hc-section-title">Quick Actions</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "0.8rem" }}>
              <button className="hc-button" onClick={() => setActiveSection("attendance")}>View Attendance</button>
              <button className="hc-button" onClick={() => setActiveSection("notifications")}>View Notifications</button>
              <button className="hc-button">Request Leave</button>
            </div>
          </div>
        </div>
      );
    }

    const pendingApprox = requestSummary.pending;
    const lateReturnApprox = attendanceSummary.late_return;

    return (
      <>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <MetricCard label="Total Students" value={stats.total} hint="Registered" />
          <MetricCard label="Currently Inside" value={stats.in} hint="Live count" tone="success" />
          <MetricCard label="Currently Outside" value={stats.out} hint="Live count" tone="warning" />
          <MetricCard label="Invalid Scans" value={invalidTotal} hint="Security events" tone="danger" />
          {resolvedRole === "WARDEN" ? (
            <>
              <MetricCard label="Pending Requests" value={pendingApprox} hint="Needs review" />
              <MetricCard label="Late Returns" value={lateReturnApprox} hint="Operational" tone="warning" />
            </>
          ) : null}
        </section>

        {overviewError ? (
          <div className="hc-card" style={{ padding: "0.8rem", marginBottom: "0.8rem", borderColor: "#fecaca" }}>
            <span style={{ color: "var(--accent-danger)" }}>{overviewError}</span>
          </div>
        ) : null}

        <section className="hc-card" style={{ overflow: "hidden", marginBottom: "1rem" }}>
          <div style={{ padding: "0.9rem 1rem", borderBottom: "var(--border-default)" }}>
            <h3 className="hc-section-title">Recent Entry and Exit Logs</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="hc-data-table" style={{ minWidth: "700px" }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Student</th>
                  <th>Hostel ID</th>
                  <th>Direction</th>
                  <th>Gate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 6).map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.time).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{log.name}</td>
                    <td>{log.hostel_id}</td>
                    <td>
                      <span className={`badge ${log.dir === "IN" ? "badge-success" : "badge-warning"}`}>{log.dir}</span>
                    </td>
                    <td>{log.gate_id || "-"}</td>
                    <td>
                      <span className="badge badge-neutral">{log.method}</span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "0.8rem 1rem", color: "var(--text-muted)" }}>
                      No records available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="hc-card" style={{ padding: "1rem" }}>
          <h3 className="hc-section-title">Invalid Scan Alerts</h3>
          {invalidScans.length === 0 ? (
            <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>No invalid scan attempts recorded.</p>
          ) : (
            <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.55rem" }}>
              {invalidScans.map((scan) => (
                <div
                  key={scan.id}
                  style={{
                    border: "var(--border-default)",
                    borderRadius: "10px",
                    padding: "0.7rem 0.8rem",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{scan.name}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                      {scan.hostel_id} · {new Date(scan.time).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="badge badge-warning">{scan.reason}</span>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "0.35rem" }}>
                      {scan.gate_id ? `Gate ${scan.gate_id}` : "Gate N/A"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    );
  };

  const renderStudents = () => (
    <section className="hc-card" style={{ padding: "1rem" }}>
      <h3 className="hc-section-title">Student Directory</h3>
      <p style={{ color: "var(--text-muted)", marginTop: "0.3rem" }}>
        Current resident index with room assignment and attendance flags.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: "720px" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              <th style={{ padding: "0.65rem" }}>Name</th>
              <th style={{ padding: "0.65rem" }}>Room</th>
              <th style={{ padding: "0.65rem" }}>Status</th>
              <th style={{ padding: "0.65rem" }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {studentRows.map((student) => (
              <tr key={student.id}>
                <td style={{ padding: "0.65rem", fontWeight: 600 }}>{student.name}</td>
                <td style={{ padding: "0.65rem" }}>{student.room}</td>
                <td style={{ padding: "0.65rem" }}>
                  <span className={`badge ${student.status === "IN" ? "badge-success" : "badge-warning"}`}>
                    {student.status}
                  </span>
                </td>
                <td style={{ padding: "0.65rem", color: "var(--text-muted)" }}>{student.hostel_id}</td>
              </tr>
            ))}
            {studentRows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "0.65rem", color: "var(--text-muted)" }}>
                  No student records available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderWardens = () => (
    <section className="hc-card" style={{ padding: "1rem" }}>
      <h3 className="hc-section-title">Warden Roster</h3>
      <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.8rem" }}>
        {wardenRows.map((warden) => (
          <div key={warden.name} className="hc-glass-panel" style={{ padding: "0.8rem" }}>
            <div style={{ fontWeight: 700 }}>{warden.name}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {warden.shift} · {warden.email}
            </div>
          </div>
        ))}
        {wardenRows.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            No warden records available.
          </div>
        ) : null}
      </div>
    </section>
  );

  const renderAttendance = () => {
    const present = attendanceSummary.present;
    const onLeave = attendanceSummary.on_leave;
    const absent = attendanceSummary.absent;
    const late = attendanceSummary.late_return;

    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.7rem" }}>
          <MetricCard label="Present" value={present} hint="Today" tone="success" />
          <MetricCard label="On Leave" value={onLeave} hint="Approved" tone="info" />
          <MetricCard label="Absent" value={absent} hint="No records" tone="danger" />
          <MetricCard label="Late Return" value={late} hint="After curfew" tone="warning" />
        </section>

        <section className="hc-card" style={{ padding: "1rem" }}>
          <div className="hc-filter-grid">
            <div>
              <label>Date</label>
              <input className="hc-input" type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} />
            </div>
            <div>
              <label>Room</label>
              <select className="hc-select" value={attendanceRoomFilter} onChange={(event) => setAttendanceRoomFilter(event.target.value)}>
                <option value="ALL">All</option>
                <option value="A-">Block A</option>
                <option value="B-">Block B</option>
                <option value="C-">Block C</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select className="hc-select" value={attendanceStatusFilter} onChange={(event) => setAttendanceStatusFilter(event.target.value)}>
                <option value="ALL">All</option>
                <option value="PRESENT">Present</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="ABSENT">Absent</option>
                <option value="LATE_RETURN">Late Return</option>
                <option value="UNVERIFIED">Unverified</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="hc-data-table" style={{ minWidth: "640px" }}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Room</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: "0.65rem", fontWeight: 600 }}>{row.name}</td>
                    <td style={{ padding: "0.65rem" }}>{row.room}</td>
                    <td style={{ padding: "0.65rem" }}><AttendanceBadge status={row.status} /></td>
                    <td style={{ padding: "0.65rem", color: "var(--text-muted)" }}>{row.remarks}</td>
                  </tr>
                ))}
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "0.7rem", color: "var(--text-muted)" }}>
                      No attendance records for selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  };

  const renderQrCenter = () => {
    if (resolvedRole === "STUDENT") {
      return (
        <section className="hc-card" style={{ padding: "1rem" }}>
          <h3 className="hc-section-title">Student QR Scanner</h3>
          <p style={{ color: "var(--text-muted)", marginTop: "0.35rem" }}>
            Submit scanned QR token directly from your dashboard without opening another login.
          </p>

          <label style={{ display: "block", marginTop: "0.75rem" }}>Scanned Token</label>
          <textarea
            className="hc-input"
            rows={4}
            value={scanTokenInput}
            onChange={(event) => setScanTokenInput(event.target.value)}
            placeholder="Paste scanned token"
            style={{ marginTop: "0.35rem" }}
          />

          {scanError ? (
            <p style={{ color: "var(--accent-danger)", marginBottom: 0 }}>{scanError}</p>
          ) : null}
          {scanMessage ? (
            <p style={{ color: "var(--accent-success)", marginBottom: 0 }}>{scanMessage}</p>
          ) : null}

          <button
            className="hc-button btn-accent"
            style={{ marginTop: "0.8rem" }}
            onClick={() => void handleStudentScanSubmit()}
            disabled={scanLoading}
          >
            {scanLoading ? "Submitting..." : "Submit Scan"}
          </button>
        </section>
      );
    }

    return (
      <section className="hc-card" style={{ padding: "1rem" }}>
        <h3 className="hc-section-title">Gate QR Generator</h3>
        <p style={{ color: "var(--text-muted)", marginTop: "0.35rem" }}>
          Generate gate token directly inside your dashboard without a separate QR login.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 220px) auto", gap: "0.55rem", alignItems: "end", marginTop: "0.75rem" }}>
          <div>
            <label>Gate ID</label>
            <input
              className="hc-input"
              value={qrGateId}
              onChange={(event) => setQrGateId(event.target.value)}
              placeholder="G-01"
            />
          </div>
          <button
            className="hc-button btn-accent"
            onClick={() => void handleGenerateGateToken()}
            disabled={qrLoading}
            style={{ width: "fit-content" }}
          >
            {qrLoading ? "Generating..." : "Generate Token"}
          </button>
        </div>

        {qrError ? <p style={{ color: "var(--accent-danger)" }}>{qrError}</p> : null}

        {qrTokenValue ? (
          <div className="hc-surface-soft" style={{ marginTop: "0.75rem", padding: "0.75rem" }}>
            <p style={{ marginTop: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
              Token {qrTokenExpiresAt ? `• Expires ${new Date(qrTokenExpiresAt).toLocaleTimeString()}` : ""}
            </p>
            {qrImageDataUrl ? (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <img
                  src={qrImageDataUrl}
                  alt={`Gate QR for ${qrGateId}`}
                  style={{
                    width: "240px",
                    height: "240px",
                    borderRadius: "12px",
                    border: "var(--border-default)",
                    background: "#ffffff",
                    padding: "0.45rem",
                    boxShadow: "var(--shadow-sm)",
                  }}
                />
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>
                Preparing QR preview...
              </p>
            )}
          </div>
        ) : null}
      </section>
    );
  };

  const renderLogs = () => (
    <section className="hc-card" style={{ padding: "1rem" }}>
      <h3 className="hc-section-title">Logs and Monitoring</h3>
      <div className="hc-filter-grid">
        <input
          className="hc-input"
          placeholder="Search student/hostel ID"
          value={logSearch}
          onChange={(event) => {
            setLogSearch(event.target.value);
            setLogPage(1);
          }}
        />
        <select
          className="hc-select"
          value={logDirectionFilter}
          onChange={(event) => {
            setLogDirectionFilter(event.target.value as "ALL" | "IN" | "OUT");
            setLogPage(1);
          }}
        >
          <option value="ALL">All directions</option>
          <option value="IN">IN</option>
          <option value="OUT">OUT</option>
        </select>
        <select
          className="hc-select"
          value={logGateFilter}
          onChange={(event) => {
            setLogGateFilter(event.target.value);
            setLogPage(1);
          }}
        >
          <option value="ALL">All gates</option>
          {allGates.map((gate) => (
            <option key={gate} value={gate}>{gate}</option>
          ))}
        </select>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="hc-data-table" style={{ minWidth: "760px" }}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Student</th>
              <th>Hostel ID</th>
              <th>Direction</th>
              <th>Gate</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            {pagedLogs.map((log) => (
              <tr key={log.id}>
                <td style={{ padding: "0.65rem" }}>{new Date(log.time).toLocaleString()}</td>
                <td style={{ padding: "0.65rem", fontWeight: 600 }}>{log.name}</td>
                <td style={{ padding: "0.65rem" }}>{log.hostel_id}</td>
                <td style={{ padding: "0.65rem" }}>
                  <span className={`badge ${log.dir === "IN" ? "badge-success" : "badge-warning"}`}>{log.dir}</span>
                </td>
                <td style={{ padding: "0.65rem" }}>{log.gate_id || "-"}</td>
                <td style={{ padding: "0.65rem" }}>{log.method}</td>
              </tr>
            ))}
            {pagedLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "0.7rem", color: "var(--text-muted)" }}>
                  No logs matching selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.84rem" }}>
          Page {Math.min(logPage, totalLogPages)} of {totalLogPages}
        </span>
        <div style={{ display: "flex", gap: "0.45rem" }}>
          <button className="hc-button" disabled={logPage <= 1} onClick={() => setLogPage((current) => Math.max(1, current - 1))}>
            Previous
          </button>
          <button className="hc-button" disabled={logPage >= totalLogPages} onClick={() => setLogPage((current) => Math.min(totalLogPages, current + 1))}>
            Next
          </button>
        </div>
      </div>
    </section>
  );

  const renderRequests = () => (
    <section className="hc-card" style={{ padding: "1rem" }}>
      <h3 className="hc-section-title">Pending Requests</h3>
      <div style={{ overflowX: "auto", marginTop: "0.7rem" }}>
        <table className="hc-data-table" style={{ minWidth: "680px" }}>
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Student</th>
              <th>Type</th>
              <th>Submitted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {requestRows.map((request) => (
              <tr key={request.id}>
                <td style={{ padding: "0.65rem", fontWeight: 600 }}>{request.id}</td>
                <td style={{ padding: "0.65rem" }}>{request.student}</td>
                <td style={{ padding: "0.65rem" }}>{request.type}</td>
                <td style={{ padding: "0.65rem" }}>{new Date(request.submittedAt).toLocaleString()}</td>
                <td style={{ padding: "0.65rem" }}>
                  <span className={`badge ${request.status === "APPROVED" ? "badge-success" : request.status === "REJECTED" ? "badge-danger" : "badge-warning"}`}>
                    {request.status}
                  </span>
                </td>
              </tr>
            ))}
            {requestRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "0.65rem", color: "var(--text-muted)" }}>
                  No requests available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderNotifications = () => (
    <section className="hc-card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem" }}>
        <h3 className="hc-section-title">Notifications and Alerts</h3>
        <button
          className="hc-button"
          onClick={() => void markAllNotificationsRead()}
          disabled={unreadNotifications === 0}
        >
          Mark all read
        </button>
      </div>
      <div style={{ marginTop: "0.8rem", display: "grid", gap: "0.6rem" }}>
        {notifications.map((notification) => (
          <div
            key={notification.id}
            style={{
              border: "var(--border-default)",
              borderRadius: "10px",
              padding: "0.75rem 0.85rem",
              background: notification.read ? "#fff" : "#f8fbff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{notification.title}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  {notification.message}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  className={`badge ${notification.level === "CRITICAL" ? "badge-danger" : notification.level === "WARNING" ? "badge-warning" : "badge-neutral"}`}
                >
                  {notification.level}
                </span>
                <div style={{ color: "var(--text-muted)", fontSize: "0.76rem", marginTop: "0.35rem" }}>
                  {new Date(notification.at).toLocaleString()}
                </div>
                {!notification.read ? (
                  <button className="hc-button" style={{ marginTop: "0.45rem", padding: "0.3rem 0.55rem" }} onClick={() => void markNotificationRead(notification.id)}>
                    Mark read
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const renderReports = () => (
    <section className="hc-card" style={{ padding: "1rem" }}>
      <h3 className="hc-section-title">Attendance Reports</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.7rem", marginTop: "0.75rem" }}>
        <MetricCard label="Weekly Attendance" value={reportData.weekly_attendance_percent} hint="Average %" tone="success" />
        <MetricCard label="Monthly Attendance" value={reportData.monthly_attendance_percent} hint="Average %" tone="success" />
        <MetricCard label="Late Returns" value={reportData.late_returns} hint="Current month" tone="warning" />
        <MetricCard label="Invalid Scans" value={reportData.invalid_scans} hint="Current month" tone="danger" />
      </div>
      <div className="hc-glass-panel" style={{ marginTop: "0.8rem" }}>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          Export and trend visualization modules can plug into this section using the same card and table layout.
        </p>
      </div>
    </section>
  );

  const renderSettings = () => (
    <section className="hc-card" style={{ padding: "1rem" }}>
      <h3 className="hc-section-title">System Settings</h3>
      <div style={{ marginTop: "0.8rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.8rem" }}>
        <div>
          <label>Default Gate</label>
          <input className="hc-input" value={settingsData.default_gate} readOnly />
        </div>
        <div>
          <label>Attendance Cutoff Time</label>
          <input className="hc-input" value={settingsData.attendance_cutoff_time} readOnly />
        </div>
        <div>
          <label>Alert Email</label>
          <input className="hc-input" value={settingsData.alert_email} readOnly />
        </div>
      </div>
      <button className="hc-button btn-accent" style={{ marginTop: "0.85rem" }}>
        Save Settings
      </button>
    </section>
  );

  const renderProfile = () => (
    <section className="hc-card" style={{ padding: "1rem" }}>
      <h3 className="hc-section-title">Student Profile</h3>
      <div style={{ marginTop: "0.7rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.8rem" }}>
        <div className="hc-glass-panel">
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Name</p>
          <h4 style={{ marginBottom: 0 }}>{profileData?.name ?? authUser?.name}</h4>
        </div>
        <div className="hc-glass-panel">
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Email</p>
          <h4 style={{ marginBottom: 0 }}>{profileData?.email ?? authUser?.email}</h4>
        </div>
        <div className="hc-glass-panel">
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Role</p>
          <h4 style={{ marginBottom: 0 }}>{profileData?.role ?? resolvedRole}</h4>
        </div>
      </div>
    </section>
  );

  const renderSectionContent = () => {
    if (activeSection === "overview") return renderOverviewByRole();
    if (activeSection === "qr") return renderQrCenter();
    if (activeSection === "students") return renderStudents();
    if (activeSection === "wardens") return renderWardens();
    if (activeSection === "attendance") return renderAttendance();
    if (activeSection === "logs") return renderLogs();
    if (activeSection === "requests") return renderRequests();
    if (activeSection === "notifications") return renderNotifications();
    if (activeSection === "reports") return renderReports();
    if (activeSection === "settings") return renderSettings();
    return renderProfile();
  };

  const renderDashboardShell = () => (
    <div
      className="hc-dashboard-shell hc-app-shell"
      style={{ gridTemplateColumns: collapsedSidebar ? "76px 1fr" : "258px 1fr" }}
    >
      <aside className="hc-sidebar">
        <div style={{ padding: "0 0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {!collapsedSidebar ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", color: "#f3f9ff" }}>
              <BrandLogo />
              <strong style={{ color: "#f3f9ff" }}>GuardianGate</strong>
            </div>
          ) : <strong style={{ color: "#f3f9ff" }}>GG</strong>}
          <button className="hc-button" onClick={() => setCollapsedSidebar((previous) => !previous)} style={{ padding: "0.28rem 0.5rem", borderColor: "rgba(220, 231, 244, 0.2)", color: "#dce7f4" }}>
            {collapsedSidebar ? ">" : "<"}
          </button>
        </div>

        <nav style={{ display: "grid", gap: "0.35rem" }}>
          {currentNav.map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`hc-button ${activeSection === section ? "active" : ""}`}
              style={{
                justifyContent: collapsedSidebar ? "center" : "flex-start",
              }}
            >
              {collapsedSidebar ? SECTION_LABELS[section].slice(0, 1) : SECTION_LABELS[section]}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", borderTop: "1px solid rgba(220, 231, 244, 0.2)", paddingTop: "0.8rem", display: "grid", gap: "0.4rem" }}>
          {!collapsedSidebar ? (
            <div style={{ padding: "0 0.45rem", color: "#dce7f4", fontSize: "0.85rem" }}>
              {authUser?.name}
              <div style={{ fontSize: "0.76rem", opacity: 0.82 }}>{resolvedRole}</div>
            </div>
          ) : null}
          <button className="hc-button" onClick={handleLogout} style={{ justifyContent: collapsedSidebar ? "center" : "flex-start", color: "#f7fbff" }}>
            Logout
          </button>
        </div>
      </aside>

      <main className="hc-dashboard-main">
        <header className="hc-card hc-topbar">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{SECTION_LABELS[activeSection]}</h2>
            <p style={{ margin: "0.15rem 0 0", color: "var(--text-muted)", fontSize: "0.86rem" }}>
              {resolvedRole} workspace
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span className="badge badge-info">Notifications {unreadNotifications}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{authUser?.email}</span>
          </div>
        </header>

        {renderSectionContent()}
      </main>
    </div>
  );

  if (view === "HOME") {
    return renderHome();
  }

  if (view === "AUTH") {
    return renderAuth();
  }

  return renderDashboardShell();
}

type MetricCardProps = {
  label: string;
  value: number;
  hint: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

function MetricCard({ label, value, hint, tone = "default" }: MetricCardProps) {
  const color =
    tone === "success"
      ? "#166534"
      : tone === "info"
        ? "#315f86"
      : tone === "warning"
        ? "#92400e"
        : tone === "danger"
          ? "#991b1b"
          : "var(--text-primary)";

  return (
    <div className="hc-card" style={{ padding: "0.9rem" }}>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
        {label}
      </p>
      <h3 style={{ margin: "0.42rem 0", fontSize: "1.45rem", color }}>{value}</h3>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.76rem" }}>
        {hint}
      </p>
    </div>
  );
}

function BrandLogo({ size = "small" }: { size?: "small" | "large" }) {
  const [index, setIndex] = useState(0);
  const src = LOGO_CANDIDATE_PATHS[index];

  if (!src) {
    return null;
  }

  return (
    <img
      src={src}
      alt="GuardianGate logo"
      className={`hc-brand-logo ${size === "small" ? "small" : ""}`.trim()}
      onError={() => {
        setIndex((current) => current + 1);
      }}
    />
  );
}

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <div className="hc-brand">
      <BrandLogo size={large ? "large" : "small"} />
      <div className="hc-brand-text">
        <div className="hc-wordmark">GuardianGate</div>
      </div>
    </div>
  );
}

function AttendanceBadge({ status }: { status: AttendanceRow["status"] }) {
  const className =
    status === "PRESENT"
      ? "badge-success"
      : status === "ON_LEAVE"
        ? "badge-info"
      : status === "ABSENT"
        ? "badge-danger"
        : status === "UNVERIFIED"
          ? "badge-neutral"
        : "badge-warning";

  return <span className={`badge ${className}`}>{status}</span>;
}

export default App;