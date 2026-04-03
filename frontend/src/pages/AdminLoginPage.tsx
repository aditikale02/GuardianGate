import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import Logo from '@/components/Brand/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getHomePathForRole, loginWithCredentials, shouldForcePasswordChange } from '@/lib/session';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setError(null);
    setIsSubmitting(true);

    try {
      const session = await loginWithCredentials('admin', email.trim(), password);
      if (session.role !== 'admin') {
        setError('This account cannot access the admin portal');
        return;
      }

      if (shouldForcePasswordChange(session.user)) {
        navigate('/auth/change-password');
        return;
      }

      navigate(getHomePathForRole(session.role));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to sign in as admin'));
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-card">
          <div className="mb-6 flex items-center justify-between">
            <Logo size="sm" />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blush">
              <Shield className="h-5 w-5 text-primary" />
            </div>
          </div>

          <h1 className="font-display text-2xl font-semibold text-foreground">Admin Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use administrator credentials to manage the entire platform.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@college.edu"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Need a new admin account for development/testing?{' '}
              <button
                type="button"
                onClick={() => navigate('/signup/admin')}
                className="font-medium text-primary hover:underline"
              >
                Sign up here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
