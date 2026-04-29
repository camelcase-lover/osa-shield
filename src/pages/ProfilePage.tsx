import { useEffect, useState } from 'react';
import { Shield, Activity, FileText, User, MapPin, Send, CheckCircle2, Settings, Zap} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiFetch, type ProfileActivity } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<ProfileActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [postingScanId, setPostingScanId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const loadActivity = async () => {
      try {
        const data = await apiFetch<{ activities: ProfileActivity[] }>('/profile/activity');
        if (!ignore) {
          setHistory(data.activities);
        }
      } catch (error) {
        if (!ignore) {
          toast.error(error instanceof Error ? error.message : 'Could not load activity history.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void loadActivity();

    return () => {
      ignore = true;
    };
  }, []);

  const postScanToCommunity = async (scanId: string) => {
    setPostingScanId(scanId);

    try {
      const data = await apiFetch<{
        message: string;
        scam: { id: string };
      }>(`/scans/${scanId}/community`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      setHistory((current) =>
        current.map((item) =>
          item.id === scanId
            ? {
                ...item,
                canPostToCommunity: false,
                postedToCommunity: true,
                communityScamId: data.scam.id,
              }
            : item,
        ),
      );
      toast.success(data.message || 'Posted to community.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post scan to community.');
    } finally {
      setPostingScanId(null);
    }
  };

const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const [mfaEnabled, setMfaEnabled] = useState(false);
const [isMfaSaving, setIsMfaSaving] = useState(false);

useEffect(() => {
  let ignore = false;

  const loadTwoFactorSetting = async () => {
    try {
      const data = await apiFetch<{ is_2fa_enabled: boolean }>('/two-factor');
      if (!ignore) {
        setMfaEnabled(Boolean(data.is_2fa_enabled));
      }
    } catch (error) {
      if (!ignore) {
        toast.error(error instanceof Error ? error.message : 'Could not load MFA setting.');
      }
    }
  };

  void loadTwoFactorSetting();

  return () => {
    ignore = true;
  };
}, []);

const toggleMFA = async () => {
  setIsMfaSaving(true);

  try {
    const data = await apiFetch<{ message: string; is_2fa_enabled: boolean }>('/two-factor', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    setMfaEnabled(Boolean(data.is_2fa_enabled));
    toast.success(data.message);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not update MFA setting.');
  } finally {
    setIsMfaSaving(false);
  }
};



  return (
    <>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setIsSettingsOpen(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/20 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" /> Account Settings
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Zap className="h-5 w-5 rotate-45" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/30 p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-medium">
                    <Shield className="h-4 w-4 text-primary" />
                    MFA Authentication
                  </div>
                  <p className="text-xs text-muted-foreground">Recommended setting, OTP 2FA send to email.</p>
                </div>

                <button
                  onClick={toggleMFA}
                  disabled={isMfaSaving}
                  className={`relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none ${
                    mfaEnabled ? 'bg-primary' : 'bg-secondary'
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
                      mfaEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
                <p className="text-xs leading-relaxed text-warning/80">
                  Enabling Multi-Factor Authentication on every login attempt otp will be send to email for verification.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <Button
                variant="cyber"
                className="w-full"
                onClick={() => setIsSettingsOpen(false)}
              >
                Save Configuration
              </Button>
            </div>
          </motion.div>
        </div>
      )}

    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Profile card */}
      <div className="glass rounded-2xl p-8 mb-6">
        <div className="flex items-center gap-5 mb-6">
          <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center">
            <User className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">{user?.name || 'Agent'}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {user?.location && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {user.location}
              </p>
            )}
          </div>

          <Button 
          variant='ghost'
          size='icon'
          className="text-muted-foreground hover:text-primary transition-colors"
          onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className='h-6 w-6'/>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Trust Score', value: user?.trustScore || 0, icon: Shield },
            { label: 'Scans', value: user?.totalScans || 0, icon: Activity },
            { label: 'Reports', value: user?.totalReports || 0, icon: FileText },
          ].map((s) => (
            <div key={s.label} className="text-center p-4 rounded-xl bg-secondary/50">
              <s.icon className="h-5 w-5 text-primary mx-auto mb-1" />
              <div className="text-2xl font-display font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4">Activity History</h2>
        <div className="space-y-3">
          {isLoading && (
            <div className="p-3 rounded-lg bg-secondary/30 text-sm text-muted-foreground">
              Loading recent activity...
            </div>
          )}

          {!isLoading && history.length === 0 && (
            <div className="p-3 rounded-lg bg-secondary/30 text-sm text-muted-foreground">
              Your scan and report history will appear here once you start using the platform.
            </div>
          )}

          {history.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <div className="flex items-center gap-3">
                {item.type === 'scan' ? (
                  <Activity className="h-4 w-4 text-primary" />
                ) : (
                  <FileText className="h-4 w-4 text-warning" />
                )}
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </div>
                  {item.details && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.details}</div>
                  )}
                  {item.contentPreview && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {item.contentPreview}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                {item.postedToCommunity && (
                  <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-1 text-xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Posted
                  </span>
                )}
                {item.canPostToCommunity && (
                  <Button
                    size="sm"
                    variant="cyber-outline"
                    onClick={() => postScanToCommunity(item.id)}
                    disabled={postingScanId === item.id}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {postingScanId === item.id ? 'Posting...' : 'Post to Community'}
                  </Button>
                )}
                <span className={`text-xs px-2 py-1 rounded ${
                  item.status === 'High Risk' ? 'bg-destructive/10 text-destructive' :
                  item.status === 'Verified' ? 'bg-success/10 text-success' :
                  item.status === 'Low Risk' ? 'bg-primary/10 text-primary' :
                  'bg-warning/10 text-warning'
                }`}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
