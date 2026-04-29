import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
      return toast.error("Please put valid email address");
    }
    
    try {
      const result = await login(email, password);
      if (result.requiresTwoFactor) {
        sessionStorage.setItem('pendingLoginEmail', result.email ?? email);
        toast.success('OTP sent to your email.');
        navigate('/login-verification', { state: { email: result.email ?? email } });
        return;
      }

      toast.success('Welcome back, Agent.');
      navigate('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md glass rounded-2xl p-8">
        <div className="text-center mb-8">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold">Agent Login</h1>
          <p className="text-sm text-muted-foreground mt-1">Access the threat defense network</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="agent@osa.net" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 bg-secondary/50 border-border/50" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 bg-secondary/50 border-border/50" />
          </div>
          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <Button type="submit" variant="cyber" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? 'Authenticating...' : <><LogIn className="h-4 w-4" /> Sign In</>}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          New agent? <Link to="/register" className="text-primary hover:underline">Join the Network</Link>
        </p>
      </div>
    </div>
  );
}
