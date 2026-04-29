import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';

type LocationState = {
  email?: string;
};

export default function LoginVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyLoginOtp, isLoading } = useAuthStore();
  const [email] = useState(
    () => (location.state as LocationState | null)?.email ?? sessionStorage.getItem('pendingLoginEmail') ?? '',
  );
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!email) {
      navigate('/login', { replace: true });
    }
  }, [email, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(code.trim())) {
      toast.error('Enter the 6-digit OTP from your email.');
      return;
    }

    try {
      await verifyLoginOtp(email, code.trim());
      sessionStorage.removeItem('pendingLoginEmail');
      toast.success('Welcome back, Agent.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'OTP verification failed.');
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <div className="mb-8 text-center">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="font-display text-2xl font-bold">Login Verification</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the OTP sent to {email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="otp">OTP Code</Label>
            <Input
              id="otp"
              inputMode="numeric"
              maxLength={6}
              placeholder=""
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              className="mt-1 border-border/50 bg-secondary/50 text-center font-mono text-lg tracking-[0.35em]"
            />
          </div>

          <Button type="submit" variant="cyber" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? (
              'Verifying...'
            ) : (
              <>
                <KeyRound className="h-4 w-4" /> Verify Login
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Wrong account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
