import { useState, useEffect, useRef, type FormEvent } from "react";
import QRCode from "qrcode";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";
const GATE_ID = "G-01";
const TOKEN_STORAGE_KEY = "guardian_kiosk_access_token";
const KIOSK_ALLOWED_ROLES = ["SECURITY_GUARD", "ADMIN"];

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  first_login: boolean;
};

function App() {
  const [email, setEmail] = useState("guard@guardian.com");
  const [password, setPassword] = useState("guard123");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [token, setToken] = useState("");
  const [expiresAtMs, setExpiresAtMs] = useState<number>(Date.now() + 30_000);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const hasKioskAccess = (user: Pick<AuthUser, "role">) =>
    KIOSK_ALLOWED_ROLES.includes(user.role);

  const applySession = (accessToken: string, user?: AuthUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setAuthToken(accessToken);
    if (user) {
      setAuthUser(user);
    }
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setToken("");
  };

  const fetchMe = async (accessToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Session expired");
    }

    const data = await response.json();
    setAuthUser(data.user);
    return data.user as AuthUser;
  };

  const refreshSession = async (): Promise<string | null> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!hasKioskAccess(data.user)) {
      return null;
    }

    applySession(data.access_token, data.user);
    return data.access_token as string;
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

  useEffect(() => {
    const bootstrapSession = async () => {
      if (!authToken) {
        return;
      }

      try {
        setIsLoadingAuth(true);
        const sessionUser = await fetchMe(authToken);
        if (!hasKioskAccess(sessionUser)) {
          setAuthError("This account is not allowed to access kiosk terminal");
          clearSession();
        }
      } catch (_error) {
        const refreshedToken = await refreshSession();
        if (!refreshedToken) {
          clearSession();
          return;
        }
        const refreshedUser = await fetchMe(refreshedToken);
        if (!hasKioskAccess(refreshedUser)) {
          setAuthError("This account is not allowed to access kiosk terminal");
          clearSession();
        }
      } finally {
        setIsLoadingAuth(false);
      }
    };

    void bootstrapSession();
  }, [authToken]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setIsLoadingAuth(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, client: "kiosk" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.message || "Unable to login");
        return;
      }

      if (!hasKioskAccess(data.user)) {
        setAuthError("This account is not allowed to access kiosk terminal");
        return;
      }

      applySession(data.access_token, data.user);
    } catch (_error) {
      setAuthError("Unable to connect to API server");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const refreshToken = async () => {
    if (!authToken) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/qr/gate-token?gate_id=${encodeURIComponent(GATE_ID)}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      if (response.status === 401 || response.status === 403) {
        const refreshedToken = await refreshSession();
        if (!refreshedToken) {
          clearSession();
          return;
        }

        const retryResponse = await fetch(
          `${API_BASE_URL}/api/v1/qr/gate-token?gate_id=${encodeURIComponent(GATE_ID)}`,
          {
            headers: {
              Authorization: `Bearer ${refreshedToken}`,
            },
          },
        );

        if (!retryResponse.ok) {
          throw new Error("Token refresh failed");
        }

        const retryData = await retryResponse.json();
        setToken(retryData.token);
        setExpiresAtMs(new Date(retryData.expires_at).getTime());
        setTimeLeft(30);
        return;
      }

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      setToken(data.token);
      setExpiresAtMs(new Date(data.expires_at).getTime());
      setTimeLeft(30);
    } catch (_error) {
      setError("Unable to refresh gate token");
    }
  };

  useEffect(() => {
    if (authToken && authUser) {
      void refreshToken();
    }
  }, [authToken, authUser]);

  useEffect(() => {
    if (!authToken || !authUser) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(() => {
        const remainingSeconds = Math.max(
          0,
          Math.ceil((expiresAtMs - Date.now()) / 1000),
        );

        if (remainingSeconds <= 1) {
          void refreshToken();
          return 1;
        }

        return remainingSeconds;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAtMs, authToken, authUser]);

  useEffect(() => {
    if (token && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, token, {
        width: 320,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#f8fafc",
        },
      });
    }
  }, [token]);

  if (!authToken || !authUser) {
    return (
      <div className="hc-kiosk-shell hc-app-shell" style={{ display: "grid", placeItems: "center" }}>
        <form
          className="hc-glass-panel"
          style={{ width: "100%", maxWidth: "440px" }}
          onSubmit={handleLogin}
        >
          <h1 className="hc-title-gradient" style={{ marginTop: 0 }}>
            GuardianGate Kiosk Login
          </h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            Sign in to generate secure gate QR tokens for scanning.
          </p>

          <label style={{ display: "block", marginBottom: "0.5rem" }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="hc-input"
            style={{ marginBottom: "1rem" }}
            required
          />

          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="hc-input"
            style={{ marginBottom: "1rem" }}
            required
          />

          {authError ? (
            <p style={{ color: "var(--accent-danger)", marginBottom: "1rem" }}>
              {authError}
            </p>
          ) : null}

          <button
            className="hc-button btn-accent"
            type="submit"
            style={{ width: "100%" }}
            disabled={isLoadingAuth}
          >
            {isLoadingAuth ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="hc-kiosk-shell hc-app-shell" style={{ display: "grid", placeItems: "center" }}>
      <div
        className="hc-glass-panel hc-kiosk-panel"
        style={{
          textAlign: "center",
          padding: "2.3rem",
        }}
      >
        <header style={{ marginBottom: "1.8rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.9rem",
            }}
          >
            <div className="badge badge-info">{authUser.role}</div>
            <button className="hc-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
          <h1
            className="hc-title-gradient"
            style={{ fontSize: "2.1rem", margin: 0 }}
          >
            Gatekeeper Terminal
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.82rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: "0.75rem",
            }}
          >
            Gate {GATE_ID} • Scan this QR with Guardian mobile app
          </p>
        </header>

        <div
          style={{
            background: "#f8fafc",
            padding: "1.5rem",
            borderRadius: "1rem",
            display: "inline-block",
            boxShadow: "var(--shadow-premium)",
            position: "relative",
            marginBottom: "1rem",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          <canvas ref={canvasRef} style={{ borderRadius: "0.5rem" }}></canvas>
          <div
            style={{
              width: "100%",
              height: "4px",
              background: "rgba(15, 23, 42, 0.12)",
              borderRadius: "2px",
              marginTop: "1rem",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg, var(--accent-primary), var(--accent-teal))",
                width: `${(timeLeft / 30) * 100}%`,
                transition: "width 1s linear",
              }}
            ></div>
          </div>
        </div>

        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.84rem",
            fontWeight: 600,
          }}
        >
          {error ? error : `TOKEN REFRESH IN ${timeLeft}s`}
        </div>
      </div>

      <div
        style={{
          marginTop: "0.9rem",
        }}
      >
        <div
          className="hc-glass-panel"
          style={{
            padding: "0.75rem 2rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--accent-success)",
              boxShadow: "0 0 10px rgba(47, 108, 85, 0.5)",
            }}
          ></div>
          <span
            style={{
              fontWeight: 600,
              fontSize: "0.82rem",
              letterSpacing: "0.05em",
            }}
          >
            System Ready • Waiting For Scan
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
