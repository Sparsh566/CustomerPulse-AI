import { Navigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { Loader2, Clock, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole | AppRole[];
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, roles, hasRole, hasAnyRole, isApproved, signOut } = useAuth();
  const toastShown = useRef(false);

  const hasAccess = !requiredRole
    ? true
    : Array.isArray(requiredRole)
      ? hasAnyRole(...requiredRole)
      : hasRole(requiredRole);

  useEffect(() => {
    if (!loading && user && !hasAccess && !toastShown.current) {
      toastShown.current = true;
      toast.error('You do not have permission to access this page');
    }
  }, [loading, user, hasAccess]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 border border-border text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mx-auto mb-4">
            <Clock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Account Pending Approval</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Your account has been created but is waiting for a manager to approve it. You'll be able to access the dashboard once approved.
          </p>
          <Button variant="outline" onClick={() => signOut()} className="gap-2">
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </Card>
      </div>
    );
  }

  if (!hasAccess) return <Navigate to="/" replace />;

  return <>{children}</>;
}
