import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'agent' | 'manager'>('agent');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName, selectedRole);
        if (error) throw error;
        if (selectedRole === 'manager') {
          toast.success('Account created! A manager must approve your account before you can sign in. Check your email to verify.');
        } else {
          toast.success('Account created! Check your email to verify.');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 border border-border shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-3">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">CustomerPulse AI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSignUp ? 'Create your account' : 'Sign in to your dashboard'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name" required />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <RadioGroup value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'agent' | 'manager')} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="agent" id="role-agent" />
                    <Label htmlFor="role-agent" className="text-sm cursor-pointer">Agent</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="manager" id="role-manager" />
                    <Label htmlFor="role-manager" className="text-sm cursor-pointer">Manager</Label>
                  </div>
                </RadioGroup>
                {selectedRole === 'manager' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ⚠️ Manager accounts require approval from an existing manager before activation.
                  </p>
                )}
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="agent@bank.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-primary hover:underline"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => navigate('/track')}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              🔍 Track your complaint status
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
