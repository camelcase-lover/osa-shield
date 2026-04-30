import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match.'); return; }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const nameRegex = /^[a-zA-Z\s]+$/;

    if(!nameRegex.test(name.trim())){
      return toast.error("Eww! Only letters and spaces.");
    }
    if(!emailRegex.test(email)){
      return toast.error("Please provide valid email address");
    }
    if(password && !strongPasswordRegex.test(password) ){ 
      toast.error("Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters.");
      return;
      }
      
    try {
      const message = await register(name, email, password);
      toast.success(message);
      navigate(`/verification?pending=1&email=${encodeURIComponent(email)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed.';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md glass rounded-2xl p-8">
        <div className="text-center mb-8">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold">Join the Network</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your agent profile</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Agent Name</Label>
            <Input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 bg-secondary/50 border-border/50" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="agent@osa.net" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 bg-secondary/50 border-border/50" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 bg-secondary/50 border-border/50" />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input id="confirm" type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="mt-1 bg-secondary/50 border-border/50" />
          </div>
          <Button type="submit" variant="cyber" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? 'Creating profile...' : <><UserPlus className="h-4 w-4" /> Create Account</>}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already an agent? <Link to="/login" className="text-primary hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
