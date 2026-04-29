import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  FileText,
  Globe2,
  Link as LinkIcon,
  MapPin,
  MessageSquare,
  Route,
  Server,
  Shield,
  ShieldAlert,
  Zap,
  Lock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, type ScamAnalysisResponse } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';


function scoreColor(score: number) {
  if (score >= 75) return 'text-destructive';
  if (score >= 40) return 'text-warning';
  return 'text-success';
}

function scoreTrackColor(score: number) {
  if (score >= 75) return 'text-destructive';
  if (score >= 40) return 'text-warning';
  return 'text-primary';
}

function resultTone(result: ScamAnalysisResponse) {
  if (result.risk_level === 'high' || result.is_scam) {
    return {
      border: 'border-destructive/40',
      background: 'from-destructive/20 via-destructive/10 to-secondary/40',
      badge: 'bg-destructive/15 text-destructive border-destructive/30',
      icon: AlertTriangle,
    };
  }

  if (result.risk_level === 'medium') {
    return {
      border: 'border-warning/40',
      background: 'from-warning/15 via-warning/5 to-secondary/40',
      badge: 'bg-warning/15 text-warning border-warning/30',
      icon: ShieldAlert,
    };
  }

  return {
    border: 'border-success/40',
    background: 'from-success/15 via-success/5 to-secondary/40',
    badge: 'bg-success/15 text-success border-success/30',
    icon: CheckCircle,
  };
}

function buildRecommendations(result: ScamAnalysisResponse, tab: 'text' | 'url' | 'password') {
  const baseActions = result.is_scam
    ? [
        tab === 'url'
          ? 'Do not open the site or enter any password, OTP, or payment information.'
          : tab === 'password'
          ? 'This password has been leaked. Change it immediately on all linked accounts.'
          : 'Do not reply, click links, or share any code or money with the sender.',
        'Verify the request through an official contact channel you already trust.',
        'This scan stays private by default. Post it from your profile if you want the community to review it.',
      ]
    : [
        'No strong scam signal was found, but unexpected requests still need manual verification.',
        tab === 'url'
          ? 'Check the destination domain carefully before opening or signing in.'
          : tab === 'password'
          ? 'Password is safe but avoid reusing it across multiple sites'
          : 'Treat urgent requests for money, passwords, or account recovery as suspicious until confirmed.',
        'If anything still feels wrong, submit a manual report for the community.',
      ];

  if (tab === 'url' && result.url_details) {
    if (!result.url_details.has_https) {
      baseActions.unshift('Avoid signing in or sending sensitive data because the link is not using HTTPS.');
    }

    if (result.url_details.redirect_chain.length > 0) {
      baseActions.unshift('Be careful with this link because it redirects before reaching the final destination.');
    }
  }

  return baseActions.slice(0, 4);
}

function badgeText(value: string) {
  return value.replace(/_/g, ' ');
}

type PasswordCheckResponse = {
  breached: boolean;
  count: number;
  message: string;
};

type UrlCheckResponse = {
  safe: boolean;
  threats?: string[];
  expireTime?: string;
  raw?: unknown;
};

type ScanNotice = {
  tone: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  details?: string;
};

type DashboardUrlDetails = NonNullable<ScamAnalysisResponse['url_details']>;

function cleanPasswordCheckMessage(result: PasswordCheckResponse) {
  const message = result.message.replace(/\s+/g, ' ').trim();

  if (message) {
    return message;
  }

  return result.breached
    ? `This password has been breached ${Number(result.count ?? 0).toLocaleString()} times.`
    : 'This password has not been found in known breaches.';
}

function normalizeUrlForCheck(value: string) {
  const trimmedValue = value.trim();
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    return new URL(candidate).toString();
  } catch {
    throw new Error('Enter a valid URL or domain name to analyze.');
  }
}

function isIpHostname(hostname: string) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');
}

function getRegistrableDomain(hostname: string) {
  const parts = hostname.split('.').filter(Boolean);

  if (isIpHostname(hostname) || parts.length === 0) {
    return null;
  }

  return parts.length <= 2 ? hostname : parts.slice(-2).join('.');
}

function formatThreatLabel(threat: string) {
  return threat
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildUrlDetails(urlToCheck: string): DashboardUrlDetails {
  const parsedUrl = new URL(urlToCheck);
  const protocol = parsedUrl.protocol.toLowerCase();

  return {
    normalized_url: parsedUrl.toString(),
    hostname: parsedUrl.hostname,
    ascii_hostname: parsedUrl.hostname,
    registrable_domain: getRegistrableDomain(parsedUrl.hostname),
    protocol: protocol.replace(':', ''),
    port: parsedUrl.port || null,
    path: parsedUrl.pathname || '/',
    has_https: protocol === 'https:',
    uses_ip_host: isIpHostname(parsedUrl.hostname),
    dns_status: 'not_checked',
    dns_resolved: false,
    dns_message: 'DNS resolution was not part of the Web Risk urlCheck response.',
    resolved_addresses: [],
    redirect_chain: [],
    redirect_message: 'Redirect tracing was not part of the Web Risk urlCheck response.',
    final_url: parsedUrl.toString(),
  };
}

function buildUrlCheckAnalysis(urlCheckResult: UrlCheckResponse, urlToCheck: string): ScamAnalysisResponse {
  const threats = Array.isArray(urlCheckResult.threats) ? urlCheckResult.threats.filter(Boolean) : [];
  const formattedThreats = threats.map(formatThreatLabel);
  const isThreat = urlCheckResult.safe === false || threats.length > 0;
  const urlDetails = buildUrlDetails(urlToCheck);
  const destination = urlDetails.registrable_domain || urlDetails.hostname || urlToCheck;
  const threatSummary = formattedThreats.length > 0 ? formattedThreats.join(', ') : 'unsafe activity';

  return {
    prediction: isThreat ? 'spam' : 'ham',
    spam_probability: isThreat ? 0.95 : 0.05,
    threshold: 0.5,
    triggers: isThreat
      ? [
          {
            key: 'web_risk_threat',
            label: 'Web Risk threat match',
            icon: '!',
            description: `The urlCheck service flagged this URL for ${threatSummary}.`,
            matches: formattedThreats.length > 0 ? formattedThreats : ['Unsafe URL signal'],
          },
        ]
      : [],
    explanation: isThreat
      ? `The urlCheck service reported that ${destination} matches Web Risk threat data for ${threatSummary}.`
      : `The urlCheck service did not return Web Risk threat matches for ${destination}.`,
    is_scam: isThreat,
    risk_level: isThreat ? 'high' : 'low',
    verdict_title: isThreat ? 'Threat detected' : 'No threat found',
    verdict_summary: isThreat
      ? `Web Risk flagged ${destination} as unsafe.`
      : `No Web Risk threat match was found for ${destination}.`,
    analysis_mode: 'url',
    url_details: urlDetails,
    scan_id: '',
    stored_scam_id: null,
    stored_in_community: false,
    location: null,
  };
}

function buildPasswordAnalysis(passwordCheckResult: PasswordCheckResponse): ScamAnalysisResponse {
  const count = Number(passwordCheckResult.count ?? 0);
  const isBreached = Boolean(passwordCheckResult.breached);
  const description = cleanPasswordCheckMessage(passwordCheckResult);

  return {
    prediction: isBreached ? 'spam' : 'ham',
    spam_probability: isBreached ? 0.9 : 0.05,
    threshold: 0.5,
    triggers: isBreached
      ? [
          {
            key: 'known_password_breach',
            label: 'Known password breach',
            icon: '!',
            description,
            matches: [`${count.toLocaleString()} breach match${count === 1 ? '' : 'es'}`],
          },
        ]
      : [],
    explanation: description,
    is_scam: isBreached,
    risk_level: isBreached ? 'high' : 'low',
    verdict_title: isBreached ? 'Password exposed' : 'No known breach found',
    verdict_summary: isBreached
      ? 'This password appears in known breach data.'
      : 'This password was not found in the checked breach data.',
    analysis_mode: 'password',
    url_details: null,
    scan_id: '',
    stored_scam_id: null,
    stored_in_community: false,
    location: null,
  };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const resultRef = useRef<HTMLDivElement | null>(null);
  const { user, checkSession } = useAuthStore();
  const { activeAnalyzerTab, setActiveAnalyzerTab } = useUIStore();
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ScamAnalysisResponse | null>(null);
  const [scanNotice, setScanNotice] = useState<ScanNotice | null>(null);
  const [lastAnalyzedTab, setLastAnalyzedTab] = useState<'text' | 'url' | 'password' >('text');

  useEffect(() => {
    if (!result) return;

    resultRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [result]);

  const handleAnalyze = async () => {
    if (!input.trim()) return;

    setIsAnalyzing(true);
    setResult(null);
    setScanNotice(null);
    setLastAnalyzedTab(activeAnalyzerTab);

    try {
      if (activeAnalyzerTab === 'password') {
        const pwnedResult = await apiFetch<PasswordCheckResponse>('/checkPassword', {
          method: 'POST',
          body: JSON.stringify({ password: input }),
        });

        const description = cleanPasswordCheckMessage(pwnedResult);
        const analysis = buildPasswordAnalysis(pwnedResult);

        setResult(analysis);
        setScanNotice({
          tone: pwnedResult.breached ? 'warning' : 'success',
          title: pwnedResult.breached ? 'Password breach found' : 'No known password breach found',
          message: description,
        });

        if (pwnedResult.breached) {
          toast.warning('Password breach found', {
            description,
          });
        } else {
          toast.success('No known password breach found', {
            description,
          });
        }

        return;
      }

      if (activeAnalyzerTab === 'url') {
        const urlToCheck = normalizeUrlForCheck(input);
        const urlCheckResult = await apiFetch<UrlCheckResponse>(
          `/urlCheck?url=${encodeURIComponent(urlToCheck)}`,
          {
            method: 'GET',
          }
        );
        const analysis = buildUrlCheckAnalysis(urlCheckResult, urlToCheck);

        setResult(analysis);
        setScanNotice({
          tone: analysis.is_scam ? 'warning' : 'success',
          title: analysis.is_scam ? 'Threat detected by URL check' : 'URL check completed',
          message: analysis.verdict_summary,
          details: analysis.explanation,
        });
        await checkSession();

        if (analysis.is_scam) {
          toast.warning('Threat detected by URL check.');
        } else {
          toast.success('URL check completed.');
        }

        return;
      }

      const analysis = await apiFetch<ScamAnalysisResponse>('/scams/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputType: activeAnalyzerTab,
          content: input.trim(),
        }),
      });

      setResult(analysis);
      setScanNotice({
        tone: analysis.is_scam ? 'warning' : 'success',
        title: analysis.is_scam ? 'Threat detected' : 'Analysis completed',
        message: analysis.is_scam
          ? 'The scan is private until you post it from your profile.'
          : 'No strong scam signal was found in this message.',
        details: analysis.explanation || analysis.verdict_summary,
      });
      await checkSession();

      if (analysis.is_scam) {
        toast.warning('Threat detected. The scan is private until you post it from your profile.');
      } else {
        toast.success('Analysis completed.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed.';
      setScanNotice({
        tone: 'error',
        title: 'Analysis failed',
        message,
      });
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const score = result ? Math.round(Number(result.spam_probability ?? 0) * 100) : 0;
  const analyzedTab = result?.analysis_mode ?? lastAnalyzedTab;
  const recommendations = result ? buildRecommendations(result, analyzedTab) : [];
  const tone = result ? resultTone(result) : null;
  const ToneIcon = tone?.icon ?? Shield;
  const NoticeIcon =
    scanNotice?.tone === 'success' ? CheckCircle : scanNotice?.tone === 'error' ? AlertTriangle : ShieldAlert;
  const noticeClassName =
    scanNotice?.tone === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : scanNotice?.tone === 'error'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : 'border-warning/30 bg-warning/10 text-warning';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-display text-3xl font-bold">
          Welcome back, <span className="text-primary">{user?.name || 'Agent'}</span>
        </h1>
        <p className="text-muted-foreground">Your threat defense command center.</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Scans', value: user?.totalScans || 0, icon: Activity },
          { label: 'Reports Filed', value: user?.totalReports || 0, icon: FileText },
          { label: 'Trust Score', value: user?.trustScore || 0, icon: Shield },
        ].map((stat) => (
          <div key={stat.label} className="glass flex items-center gap-4 rounded-xl p-5">
            <div className="gradient-primary flex h-10 w-10 items-center justify-center rounded-lg">
              <stat.icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass mb-8 rounded-xl p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
          <Zap className="h-5 w-5 text-primary" /> Risk Analyzer
        </h2>

        <div className="mb-4 flex gap-2">
          {(['text', 'url', 'password'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveAnalyzerTab(tab)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeAnalyzerTab === tab
                  ? 'border border-primary/30 bg-primary/20 text-primary'
                  : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'text' && <MessageSquare className="h-4 w-4" />}
              {tab === 'url' && <LinkIcon className="h-4 w-4" />}
              {tab === 'password' && <Lock className="h-4 w-4" />}
              {tab === 'text' ? 'Text / Message' : tab === 'url' ? 'URL' : 'Password Checker'}
             
            </button>
          ))}
        </div>

        {scanNotice && (
          <div className={`mb-4 rounded-xl border p-4 ${noticeClassName}`}>
            <div className="flex items-start gap-3">
              <NoticeIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{scanNotice.title}</div>
                <p className="mt-1 text-sm leading-6 text-foreground/85">{scanNotice.message}</p>
                {scanNotice.details && (
                  <p className="mt-2 text-sm leading-6 text-foreground/75">{scanNotice.details}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeAnalyzerTab === 'text' ? (
          <Textarea
            placeholder="Paste suspicious message content here..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="mb-4 min-h-[120px] border-border/50 bg-secondary/50"
          />
        ) : activeAnalyzerTab === 'url' ? (
          <Input
            placeholder="https://suspicious-link.example.com"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="mb-4 border-border/50 bg-secondary/50"
          />
        ) : (
          <Input
          type="password"
          placeholder="Input password"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="mb-4 border-border/50 bg-secondary/50"
          />
        )
        }

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Button variant="cyber" onClick={handleAnalyze} disabled={isAnalyzing || !input.trim()}>
            {isAnalyzing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Analyzing...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4" /> Analyze Threat
              </>
            )}
          </Button>

          <p className="max-w-2xl text-sm text-muted-foreground">
            {(activeAnalyzerTab as string) === 'url'
              ? 'Look up Web Risk matches before scoring the link.'
              : (activeAnalyzerTab as string) === 'password'
              ? 'Password checker is a tool checker if password has been exposed in known breaches'
              : 'Message analysis checks for scam patterns and summarizes the strongest signals in a readable verdict.'}
          </p>
        </div>
      </div>

      {result && tone && (
        <motion.div
          ref={resultRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div
            className={`glass overflow-hidden rounded-2xl border ${tone.border} bg-gradient-to-br ${tone.background} p-6`}
          >
            <div className="grid gap-6 lg:grid-cols-[1.5fr_320px]">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${tone.badge}`}>
                    <ToneIcon className="h-4 w-4" />
                    {result.verdict_title}
                  </span>
                  <span className="rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-sm capitalize text-foreground">
                    {badgeText(result.risk_level)} risk
                  </span>
                  <span className="rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-sm capitalize text-foreground">
                    {result.prediction}
                  </span>
                  <span className="rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-sm text-foreground">
                    {analyzedTab === 'url'
                      ? 'URL analysis'
                      : analyzedTab === 'password'
                      ? 'Password check'
                      : 'Message analysis'}
                  </span>
                </div>

                <h2 className="mb-3 font-display text-3xl font-bold leading-tight md:text-4xl">
                  {result.verdict_summary}
                </h2>

                <p className="max-w-3xl text-base leading-7 text-foreground/85 md:text-lg">
                  {result.explanation || 'No explanation was returned by the analyzer.'}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <div className="rounded-xl border border-border/60 bg-secondary/50 px-4 py-3">
                    <div className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Risk score</div>
                    <div className={`text-2xl font-bold ${scoreColor(score)}`}>{score}/100</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-secondary/50 px-4 py-3">
                    <div className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Decision line</div>
                    <div className="text-2xl font-bold text-foreground">
                      {(Number(result.threshold ?? 0.3) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-secondary/50 px-4 py-3">
                    <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      Location
                    </div>
                    <div className="text-base font-semibold text-foreground">
                      {result.location || 'Unknown location'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass rounded-2xl border border-border/60 p-5">
                <div className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Outcome Snapshot
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className="relative h-44 w-44">
                    <svg className="h-44 w-44 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${score * 3.14} 314`}
                        className={scoreTrackColor(score)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`font-display text-5xl font-bold ${scoreColor(score)}`}>{score}</span>
                      <span className="text-sm text-muted-foreground">Risk Score</span>
                    </div>
                  </div>
                  <div className="mt-4 w-full rounded-xl border border-border/60 bg-secondary/50 p-4 text-sm text-muted-foreground">
                    {result.is_scam ? (
                      <div className="space-y-2">
                        <div className="font-semibold text-foreground">
                          {analyzedTab === 'password' || analyzedTab === 'url' ? 'Visible for this session' : 'Private scan saved'}
                        </div>
                        <div>
                          {analyzedTab === 'password' || analyzedTab === 'url'
                            ? 'This result is shown here for review and is not posted to the community.'
                            : 'This flagged sample was saved to your activity history. You choose whether to post it to the community.'}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="font-semibold text-foreground">Not shared automatically</div>
                        <div>
                          You can still send it to the community feed manually if you want other users to review it.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="glass rounded-2xl p-5 xl:col-span-2">
              <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
                <AlertTriangle className="h-5 w-5 text-warning" /> Why This Was Scored This Way
              </h3>

              <div className="space-y-3">
                {result.triggers.length > 0 ? (
                  result.triggers.map((trigger) => (
                    <div
                      key={`${trigger.key}-${trigger.label}`}
                      className="rounded-xl border border-warning/20 bg-warning/10 p-4"
                    >
                      <div className="mb-2 flex items-center gap-3 text-base font-semibold text-foreground">
                        <span className="text-lg">{trigger.icon}</span>
                        {trigger.label}
                      </div>
                      {trigger.description && (
                        <p className="text-sm leading-6 text-foreground/85">{trigger.description}</p>
                      )}
                      {trigger.matches.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {trigger.matches.map((match) => (
                            <span
                              key={`${trigger.key}-${match}`}
                              className="rounded-full border border-border/60 bg-secondary/70 px-3 py-1 text-xs text-muted-foreground"
                            >
                              {match}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-success/20 bg-success/10 p-5">
                    <div className="mb-2 flex items-center gap-2 text-base font-semibold text-success">
                      <CheckCircle className="h-5 w-5" />
                      No strong threat triggers were returned
                    </div>
                    <p className="text-sm leading-6 text-foreground/85">
                      The analyzer did not surface any explicit trigger patterns in this sample. That lowers risk, but
                      it does not replace manual verification.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
                <ShieldAlert className="h-5 w-5 text-primary" /> Recommended Next Steps
              </h3>

              <div className="mb-4 rounded-xl border border-border/60 bg-secondary/50 p-4">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Analyst summary</div>
                <p className="text-sm leading-6 text-foreground/85">{result.verdict_summary}</p>
              </div>

              <ul className="space-y-3">
                {recommendations.map((recommendation) => (
                  <li key={recommendation} className="flex items-start gap-3 text-sm leading-6 text-foreground/85">
                    <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-success" />
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>

              {result.is_scam ? (
                analyzedTab === 'text' ? (
                  <Button variant="destructive" className="mt-5 w-full" onClick={() => navigate('/profile')}>
                    <AlertTriangle className="h-4 w-4" /> Post from Profile
                  </Button>
                ) : null
              ) : (
                <Button variant="cyber-outline" className="mt-5 w-full" onClick={() => navigate('/report')}>
                  <FileText className="h-4 w-4" /> Report Manually
                </Button>
              )}
            </div>
          </div>

          {analyzedTab === 'url' && result.url_details && (
            <div className="glass rounded-2xl p-6">
              <h3 className="mb-5 flex items-center gap-2 font-display text-xl font-bold">
                <Globe2 className="h-5 w-5 text-primary" /> URL Inspection Details
              </h3>

              <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-secondary/50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <Globe2 className="h-3.5 w-3.5" />
                    Destination
                  </div>
                  <div className="break-all text-base font-semibold text-foreground">
                    {result.url_details.registrable_domain || result.url_details.hostname}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{result.url_details.hostname}</p>
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    Connection
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {result.url_details.has_https ? 'HTTPS detected' : 'No HTTPS detected'}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {result.url_details.protocol.toUpperCase()}
                    {result.url_details.port ? ` on port ${result.url_details.port}` : ''}
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <Server className="h-3.5 w-3.5" />
                    DNS status
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {result.url_details.dns_resolved ? 'Resolved' : badgeText(result.url_details.dns_status)}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{result.url_details.dns_message}</p>
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <Route className="h-3.5 w-3.5" />
                    Redirects
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {result.url_details.redirect_chain.length > 0
                      ? `${result.url_details.redirect_chain.length} hop${result.url_details.redirect_chain.length === 1 ? '' : 's'}`
                      : 'No redirect seen'}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{result.url_details.redirect_message}</p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
                  <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Normalized URL
                  </div>
                  <div className="break-all rounded-lg border border-border/60 bg-background/50 p-4 text-sm leading-6 text-foreground">
                    {result.url_details.normalized_url}
                  </div>

                  {result.url_details.resolved_addresses.length > 0 && (
                    <>
                      <div className="mt-4 mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Resolved addresses
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.url_details.resolved_addresses.map((address) => (
                          <span
                            key={address}
                            className="rounded-full border border-border/60 bg-secondary/70 px-3 py-1 text-xs text-muted-foreground"
                          >
                            {address}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
                  <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Redirect path
                  </div>

                  {result.url_details.redirect_chain.length > 0 ? (
                    <div className="space-y-3">
                      {result.url_details.redirect_chain.map((hop, index) => (
                        <div key={`${hop.from}-${hop.to}-${index}`} className="rounded-lg border border-border/60 bg-background/50 p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                            Hop {index + 1} · {hop.status}
                          </div>
                          <div className="space-y-2 text-sm text-foreground/85">
                            <div className="break-all">{hop.from}</div>
                            <div className="flex items-center gap-2 text-primary">
                              <ExternalLink className="h-4 w-4" />
                              Redirects to
                            </div>
                            <div className="break-all">{hop.to}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-success/20 bg-success/10 p-4 text-sm leading-6 text-foreground/85">
                      No redirect hops were observed during the live check.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
