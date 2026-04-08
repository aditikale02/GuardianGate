import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import Logo from '@/components/Brand/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getHomePathForRole, signupAdmin } from '@/lib/session';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const strongPassword = (value: string) => {
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter';
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter';
  if (!/[0-9]/.test(value)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include a special character';
  return null;
};

const AdminSignupPage = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const passwordError = strongPassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await signupAdmin(fullName.trim(), email.trim(), password);
      navigate(getHomePathForRole(session.role));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to sign up admin'));
    } finally {
      setIsSubmitting(false);
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
          </div>

          <h1 className="font-display text-2xl font-semibold text-foreground">Admin Sign-Up</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create an admin account for local development and testing.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-signup-name">Full Name</Label>
              <Input id="admin-signup-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-signup-email">Email</Label>
              <Input id="admin-signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-signup-password">Password</Label>
              <Input id="admin-signup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-signup-confirm">Confirm Password</Label>
              <Input id="admin-signup-confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create Admin Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminSignupPage;
