import { useState, useEffect, type FormEvent } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";
const TOKEN_STORAGE_KEY = "guardian_mobile_access_token";
const MOBILE_ALLOWED_ROLE = "STUDENT";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  first_login: boolean;
};

function App() {
  const [email, setEmail] = useState("student@guardian.com");
  const [password, setPassword] = useState("student123");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [status, setStatus] = useState<"IN" | "OUT">("OUT");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);

  const hasMobileAccess = (user: Pick<AuthUser, "role">) =>
    user.role === MOBILE_ALLOWED_ROLE;

  const applySession = (accessToken: string, user?: AuthUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setToken(accessToken);
    if (user) {
      setAuthUser(user);
    }
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setAuthUser(null);
    setIsScanning(false);
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
    if (!hasMobileAccess(data.user)) {
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

  const fetchMe = async (accessToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Session expired. Please log in again.");
    }

    const data = await response.json();
    setAuthUser(data.user);
    return data.user as AuthUser;
  };

  useEffect(() => {
    const bootstrapSession = async () => {
      if (!token) {
        return;
      }
      try {
        setIsLoadingAuth(true);
        const sessionUser = await fetchMe(token);
        if (!hasMobileAccess(sessionUser)) {
          setAuthError("This account is not allowed to access the mobile scanner");
          clearSession();
          return;
        }
      } catch (_error) {
        const refreshedToken = await refreshSession();
        if (!refreshedToken) {
          clearSession();
          return;
        }
        await fetchMe(refreshedToken);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    void bootstrapSession();
  }, [token]);

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
        body: JSON.stringify({ email, password, client: "mobile" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.message || "Unable to login");
        return;
      }

      if (!hasMobileAccess(data.user)) {
        setAuthError("This account is not allowed to access the mobile scanner");
        return;
      }

      applySession(data.access_token, data.user);
    } catch (_error) {
      setAuthError("Unable to connect to API server");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    if (!token || !authUser || !isScanning) {
      return;
    }

    let isHandled = false;
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false,
    );

    scanner.render(onScanSuccess, onScanFailure);

    async function onScanSuccess(decodedText: string) {
      if (isHandled) {
        return;
      }
      isHandled = true;

      try {
        setIsSubmittingScan(true);
        setScanError(null);
        setScanMessage(null);

        const response = await fetch(`${API_BASE_URL}/api/v1/scan/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ token: decodedText }),
        });

        if (response.status === 401 || response.status === 403) {
          const refreshedToken = await refreshSession();
          if (!refreshedToken) {
            clearSession();
            return;
          }

          const retryResponse = await fetch(`${API_BASE_URL}/api/v1/scan/submit`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${refreshedToken}`,
            },
            body: JSON.stringify({ token: decodedText }),
          });

          const retryData = await retryResponse.json();

          if (!retryResponse.ok || retryData.success === false) {
            setScanError(retryData.message || "Scan validation failed");
            return;
          }

          setLastScan(new Date(retryData.timestamp).toLocaleTimeString());
          setStatus(retryData.action_type === "ENTRY" ? "IN" : "OUT");
          setScanMessage(retryData.message || "Scan recorded");
          return;
        }

        const data = await response.json();

        if (!response.ok || data.success === false) {
          setScanError(data.message || "Scan validation failed");
          return;
        }

        setLastScan(new Date(data.timestamp).toLocaleTimeString());
        setStatus(data.action_type === "ENTRY" ? "IN" : "OUT");
        setScanMessage(data.message || "Scan recorded");
      } catch (_error) {
        setScanError("Unable to submit scan");
      } finally {
        setIsSubmittingScan(false);
        setIsScanning(false);
        void scanner.clear();
      }
    }

    function onScanFailure(_error: unknown) {
      // handle scan failure, usually better to ignore and keep scanning
    }

    return () => {
      scanner
        .clear()
        .catch((error) => console.error("Failed to clear scanner", error));
    };
  }, [isScanning, token, authUser]);

  if (!token || !authUser) {
    return (
      <div className="hc-mobile-shell hc-app-shell" style={{ display: "grid", placeItems: "center" }}>
        <form
          className="hc-glass-panel"
          style={{ width: "100%", maxWidth: "420px" }}
          onSubmit={handleLogin}
        >
          <h1 className="hc-title-gradient" style={{ marginTop: 0 }}>
            Guardian App Login
          </h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            Sign in to start secure QR scanning.
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
    <div className="hc-mobile-shell hc-app-shell" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <header
        style={{
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 0",
        }}
      >
        <div>
          <h1
            className="hc-title-gradient"
            style={{ fontSize: "1.5rem", margin: 0 }}
          >
            Guardian App
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              margin: 0,
            }}
          >
            {authUser.name} • {authUser.role}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div className="badge badge-info">Verified</div>
          <button className="hc-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main
        style={{
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          marginTop: "2rem",
        }}
      >
        <section className="hc-glass-panel" style={{ textAlign: "center", background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)" }}>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
            }}
          >
            CURRENT STATUS
          </p>
          <h2
            style={{
              fontSize: "3.5rem",
              margin: "1rem 0",
              color:
                status === "IN"
                  ? "var(--accent-success)"
                  : "var(--accent-danger)",
            }}
          >
            {status}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
            Last Activity: {lastScan || "No recent scans"}
          </p>
        </section>

        {!isScanning ? (
          <button
            className="hc-button btn-accent"
            style={{ height: "70px", fontSize: "1.2rem" }}
            onClick={() => setIsScanning(true)}
          >
            Start Scan
          </button>
        ) : (
          <div className="hc-glass-panel" style={{ padding: "1rem" }}>
            <div
              id="reader"
              style={{
                width: "100%",
                borderRadius: "0.5rem",
                overflow: "hidden",
              }}
            ></div>
            <button
              className="hc-button"
              style={{ width: "100%", marginTop: "1rem" }}
              disabled={isSubmittingScan}
              onClick={() => setIsScanning(false)}
            >
              {isSubmittingScan ? "Validating..." : "Cancel"}
            </button>
          </div>
        )}

        {scanMessage ? (
          <div className="badge badge-success" style={{ textAlign: "center" }}>
            {scanMessage}
          </div>
        ) : null}
        {scanError ? (
          <div className="badge badge-danger" style={{ textAlign: "center" }}>
            {scanError}
          </div>
        ) : null}

        <section>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              fontWeight: 600,
              marginBottom: "1rem",
            }}
          >
            RECENT HISTORY
          </p>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <div
              className="hc-glass-panel"
              style={{
                padding: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ fontWeight: 600, display: "block" }}>
                  Campus Entry
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Today, 09:00 AM
                </span>
              </div>
              <span className="badge badge-success">SUCCESS</span>
            </div>
            <div
              className="hc-glass-panel"
              style={{
                padding: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ fontWeight: 600, display: "block" }}>
                  Campus Exit
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Yesterday, 05:30 PM
                </span>
              </div>
              <span className="badge badge-warning">RECORDED</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
