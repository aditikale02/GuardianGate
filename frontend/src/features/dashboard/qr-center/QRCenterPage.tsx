import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Copy, QrCode, RefreshCw, ScanLine, TimerReset, Zap, ZapOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';
import { useToast } from '@/hooks/use-toast';
import { useOutletContext } from 'react-router-dom';
import { UserRole } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QrScanner from 'qr-scanner';

type GateTokenResponse = {
  token: string;
  gate_id: string;
  generated_at: string;
  expires_at: string;
  mode?: string;
  entry_exit_mode?: string;
};

type ScanSubmitResponse = {
  success: boolean;
  message: string;
  action_type: 'ENTRY' | 'EXIT';
  timestamp: string;
  status: 'SUCCESS' | 'INVALID' | 'EXPIRED' | 'REQUIRES_EXIT_DETAILS';
  late_status?: boolean;
  flagged_status?: boolean;
  requires_exit_details?: boolean;
  destination?: string | null;
  exit_note?: string | null;
};

type EntryExitLogsResponse = {
  summary: {
    total_entries_today: number;
    total_exits_today: number;
    total_late_entries_today: number;
    total_flagged_today: number;
  };
  rows: Array<{
    id: string;
    student_name: string;
    enrollment_no: string;
    hostel: string;
    floor: number | null;
    room: string;
    scan_type: 'ENTRY' | 'EXIT';
    time: string;
    status: string;
    late_status: boolean;
    flagged_status: boolean;
    verified_by: string;
    remarks: string;
    destination?: string | null;
    exit_note?: string | null;
  }>;
  recent_scan_activity: Array<{
    id: string;
    student_name: string;
    enrollment_no: string;
    hostel: string;
    room: string;
    scan_type: 'ENTRY' | 'EXIT';
    scan_time: string;
    status: string;
    late_status: boolean;
    flagged_status: boolean;
  }>;
  student_wise_history: Array<{
    student_id: string;
    student_name: string;
    enrollment_no: string;
    total_scans: number;
    entries: number;
    exits: number;
    late_count: number;
    flagged_count: number;
    last_scan_time: string;
  }>;
  room_wise_history: Array<{
    hostel: string;
    floor: number | null;
    room: string;
    total_scans: number;
    entries: number;
    exits: number;
    late_count: number;
    flagged_count: number;
  }>;
  floor_wise_history: Array<{
    hostel: string;
    floor: number | null;
    total_scans: number;
    entries: number;
    exits: number;
    late_count: number;
    flagged_count: number;
  }>;
  date_wise_history: Array<{
    date: string;
    total_scans: number;
    entries: number;
    exits: number;
    late_count: number;
    flagged_count: number;
  }>;
};

type CameraPermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

type ScanFeedback = {
  kind: 'success' | 'error';
  message: string;
  actionType?: 'ENTRY' | 'EXIT';
  timestamp: string;
};

type ExitDetailsDraft = {
  destination: string;
  note: string;
};

const DEFAULT_GATE_ID = 'G-01';

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const secs = (safe % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const QRCenterPage = () => {
  const { role } = useOutletContext<{ role: UserRole }>();
  const isGateManager = role === 'admin' || role === 'warden';
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const isScanLockedRef = useRef(false);
  const [activeManagerTab, setActiveManagerTab] = useState<'generate' | 'logs'>('generate');

  const [gateId, setGateId] = useState(DEFAULT_GATE_ID);
  const [tokenData, setTokenData] = useState<GateTokenResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scanToken, setScanToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanResult, setScanResult] = useState<ScanSubmitResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState>('unknown');
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [lastDecodedToken, setLastDecodedToken] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const [pendingExitToken, setPendingExitToken] = useState<string | null>(null);
  const [exitDraft, setExitDraft] = useState<ExitDetailsDraft>({ destination: '', note: '' });

  const [studentNameFilter, setStudentNameFilter] = useState('');
  const [enrollmentFilter, setEnrollmentFilter] = useState('');
  const [hostelFilter, setHostelFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [lateFilter, setLateFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [flaggedFilter, setFlaggedFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL');

  const logsQuery = useQuery({
    queryKey: [
      'entry-exit-logs',
      studentNameFilter,
      enrollmentFilter,
      hostelFilter,
      floorFilter,
      roomFilter,
      directionFilter,
      fromDateFilter,
      toDateFilter,
      lateFilter,
      flaggedFilter,
    ],
    enabled: isGateManager && activeManagerTab === 'logs',
    refetchInterval: isGateManager && activeManagerTab === 'logs' ? 3000 : false,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (studentNameFilter.trim()) params.set('student_name', studentNameFilter.trim());
      if (enrollmentFilter.trim()) params.set('enrollment_no', enrollmentFilter.trim());
      if (hostelFilter.trim()) params.set('hostel', hostelFilter.trim());
      if (floorFilter.trim()) params.set('floor', floorFilter.trim());
      if (roomFilter.trim()) params.set('room', roomFilter.trim());
      if (directionFilter !== 'ALL') params.set('direction', directionFilter);
      if (fromDateFilter) params.set('from_date', fromDateFilter);
      if (toDateFilter) params.set('to_date', toDateFilter);
      if (lateFilter === 'YES') params.set('late_status', 'true');
      if (lateFilter === 'NO') params.set('late_status', 'false');
      if (flaggedFilter === 'YES') params.set('flagged_status', 'true');
      if (flaggedFilter === 'NO') params.set('flagged_status', 'false');

      const response = await authenticatedFetch(`/dashboard/logs?${params.toString()}`);
      return parseJsonOrThrow<EntryExitLogsResponse>(response, 'Unable to load entry/exit logs');
    },
  });

  const qrImageSrc = useMemo(() => {
    if (!tokenData?.token) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tokenData.token)}`;
  }, [tokenData?.token]);

  const refreshGateToken = async (requestedGateId = gateId) => {
    if (!isGateManager) return;
    const normalizedGate = requestedGateId.trim().toUpperCase();
    if (!normalizedGate) {
      toast({ title: 'Gate ID is required', variant: 'destructive' });
      return;
    }

    setIsRefreshing(true);
    try {
      const response = await authenticatedFetch(`/qr/gate-token?gate_id=${encodeURIComponent(normalizedGate)}`);
      const body = await parseJsonOrThrow<GateTokenResponse>(response, 'Unable to generate QR token');
      setGateId(body.gate_id);
      setTokenData(body);
      setSecondsLeft(Math.max(0, Math.ceil((new Date(body.expires_at).getTime() - Date.now()) / 1000)));
    } catch (error) {
      toast({
        title: 'Token generation failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const submitScanToken = async (
    rawToken: string,
    shouldClearInput = false,
    exitDetails?: ExitDetailsDraft,
  ) => {
    const payloadToken = rawToken.trim();
    if (!payloadToken) {
      toast({ title: 'Provide a QR token first', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authenticatedFetch('/scan/submit', {
        method: 'POST',
        body: JSON.stringify({
          token: payloadToken,
          ...(exitDetails?.destination?.trim()
            ? {
                exit_destination: exitDetails.destination.trim(),
                exit_note: exitDetails.note.trim() || undefined,
              }
            : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as ScanSubmitResponse | null;

      if (!response.ok) {
        if (body?.requires_exit_details && body.action_type === 'EXIT') {
          setPendingExitToken(payloadToken);
          setExitDraft({ destination: '', note: '' });
          setScanFeedback({
            kind: 'error',
            message: 'Destination is required to complete exit.',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        throw new Error(body?.message || 'Unable to submit scan');
      }

      if (!body) {
        throw new Error('Unable to submit scan');
      }

      setScanResult(body);
      setPendingExitToken(null);
      setScanFeedback({
        kind: 'success',
        message: body.action_type === 'ENTRY' ? 'Entry marked successfully' : 'Exit marked successfully',
        actionType: body.action_type,
        timestamp: body.timestamp,
      });
      if (shouldClearInput) {
        setScanToken('');
      }

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(100);
      }

      toast({
        title: body.action_type === 'ENTRY' ? 'Entry marked successfully' : 'Exit marked successfully',
        description: body.late_status ? `${body.message} (Marked Late)` : body.message,
      });
    } catch (error) {
      const rawMessage = (error as Error).message || 'Unable to submit scan';
      const normalizedMessage =
        /expired/i.test(rawMessage)
          ? 'QR expired, please scan again'
          : /invalid|replay|token/i.test(rawMessage)
            ? 'Invalid QR code'
            : rawMessage;

      setScanFeedback({
        kind: 'error',
        message: normalizedMessage,
        timestamp: new Date().toISOString(),
      });

      toast({
        title: 'Scan failed',
        description: normalizedMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitExitDetails = async () => {
    if (!pendingExitToken) return;
    if (!exitDraft.destination.trim()) {
      toast({ title: 'Destination is required', variant: 'destructive' });
      return;
    }

    await submitScanToken(pendingExitToken, false, exitDraft);
  };

  const submitScan = async () => {
    const payloadToken = scanToken.trim();
    if (!payloadToken) {
      toast({ title: 'Paste the QR token first', variant: 'destructive' });
      return;
    }
    await submitScanToken(payloadToken, true);
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setIsCameraStarting(false);
    setIsTorchSupported(false);
    setIsTorchOn(false);
    isScanLockedRef.current = false;
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !isCameraActive) return;

    try {
      await scannerRef.current.toggleFlash();
      const maybeIsFlashOn = (scannerRef.current as any).isFlashOn;
      if (typeof maybeIsFlashOn === 'function') {
        setIsTorchOn(Boolean(maybeIsFlashOn.call(scannerRef.current)));
      } else {
        setIsTorchOn((prev) => !prev);
      }
    } catch {
      toast({
        title: 'Torch unavailable',
        description: 'This camera does not allow torch control right now.',
        variant: 'destructive',
      });
    }
  };

  const startCamera = async () => {
    if (isGateManager || isCameraStarting) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermission('unsupported');
      setCameraError('Camera access is required to scan QR');
      return;
    }

    setCameraError(null);
    setCameraPermission('unknown');
    setIsCameraStarting(true);
    setLastDecodedToken(null);
    setScanFeedback(null);
    isScanLockedRef.current = false;

    try {
      if (!videoRef.current) {
        throw new Error('Camera preview unavailable.');
      }

      const scanner = new QrScanner(
        videoRef.current,
        async (result) => {
          if (isScanLockedRef.current) return;

          const tokenValue =
            typeof result === 'string'
              ? result
              : ((result as { data?: string } | null)?.data ?? '');

          if (!tokenValue.trim()) return;

          isScanLockedRef.current = true;
          setLastDecodedToken(tokenValue.trim());
          stopCamera();
          await submitScanToken(tokenValue.trim());
        },
        {
          preferredCamera: 'environment',
          returnDetailedScanResult: true,
          maxScansPerSecond: 8,
          highlightCodeOutline: true,
          highlightScanRegion: true,
        },
      );

      scannerRef.current = scanner;
      await scanner.start();
      const supportsFlash = await scanner.hasFlash();
      setIsTorchSupported(Boolean(supportsFlash));
      setIsTorchOn(false);
      setCameraPermission('granted');
      setIsCameraActive(true);
    } catch (error) {
      stopCamera();
      const typedError = error as { name?: string; message?: string };
      const denied = typedError?.name === 'NotAllowedError' || /denied|permission/i.test(typedError?.message || '');
      const message = denied ? 'Camera access is required to scan QR' : typedError?.message || 'Unable to start camera scanner.';
      setCameraPermission(denied ? 'denied' : 'unknown');
      setCameraError(message);
      toast({ title: 'Camera unavailable', description: message, variant: 'destructive' });
    } finally {
      setIsCameraStarting(false);
    }
  };

  const copyToken = async () => {
    if (!tokenData?.token) return;
    try {
      await navigator.clipboard.writeText(tokenData.token);
      toast({ title: 'Token copied', description: 'QR token copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard permission denied.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!isGateManager) return;
    refreshGateToken(DEFAULT_GATE_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGateManager]);

  useEffect(() => {
    if (!isGateManager || !tokenData?.expires_at) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(tokenData.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [isGateManager, tokenData?.expires_at]);

  useEffect(() => {
    if (!isGateManager || !tokenData || secondsLeft > 0 || isRefreshing) return;
    refreshGateToken(tokenData.gate_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, tokenData, isGateManager, isRefreshing]);

  useEffect(() => {
    if (isGateManager) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGateManager]);

  const tokenMode = tokenData?.entry_exit_mode || tokenData?.mode || 'AUTO (entry/exit by student status)';
  const isTokenActive = Boolean(tokenData && secondsLeft > 0);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">QR Center</h1>
      <p className="text-sm text-muted-foreground">
        {isGateManager ? 'Generate and manage gate QR tokens' : 'Scan QR codes for entry/exit'}
      </p>

      <div className="rounded-2xl bg-card shadow-card p-8">
        {isGateManager ? (
          <Tabs value={activeManagerTab} onValueChange={(value) => setActiveManagerTab(value as 'generate' | 'logs')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="generate">Generate QR</TabsTrigger>
              <TabsTrigger value="logs">View Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={gateId}
                  onChange={(event) => setGateId(event.target.value)}
                  placeholder="Gate ID (example: G-01)"
                  className="sm:max-w-xs"
                />
                <Button
                  className="rounded-xl gap-2"
                  onClick={() => refreshGateToken(gateId)}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Generating...' : 'Regenerate Token'}
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  <TimerReset className="h-4 w-4" />
                  Expires in {formatTime(secondsLeft)}
                </div>
                <div className="rounded-lg bg-muted p-3 text-sm">
                  Status: <span className="font-semibold">{isTokenActive ? 'ACTIVE' : 'EXPIRED'}</span>
                </div>
                <div className="rounded-lg bg-muted p-3 text-sm">
                  Entry/Exit Mode: <span className="font-semibold">{tokenMode}</span>
                </div>
              </div>

              <div className="mx-auto w-full max-w-xs rounded-2xl bg-muted/50 p-4">
                {qrImageSrc ? (
                  <img
                    src={qrImageSrc}
                    alt="Gate QR token"
                    className="h-full w-full rounded-xl bg-white p-2"
                  />
                ) : (
                  <div className="flex h-[280px] items-center justify-center rounded-xl bg-muted">
                    <QrCode className="h-24 w-24 text-primary/40" />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Token</p>
                <p className="mt-1 break-all text-xs text-foreground">{tokenData?.token || 'No token generated yet.'}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl gap-2"
                    disabled={!tokenData?.token}
                    onClick={copyToken}
                  >
                    <Copy className="h-4 w-4" /> Copy Token
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="logs" className="space-y-5">
              <div className="rounded-xl border border-border bg-background/70 p-4">
              <p className="text-sm font-semibold text-foreground">Entry/Exit Logs</p>
              <div className="mt-3 grid gap-2 md:grid-cols-5">
                <Input placeholder="Student name" value={studentNameFilter} onChange={(event) => setStudentNameFilter(event.target.value)} />
                <Input placeholder="Enrollment no" value={enrollmentFilter} onChange={(event) => setEnrollmentFilter(event.target.value)} />
                <Input placeholder="Hostel" value={hostelFilter} onChange={(event) => setHostelFilter(event.target.value)} />
                <Input placeholder="Floor" value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)} />
                <Input placeholder="Room" value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)} />
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-5">
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value as 'ALL' | 'IN' | 'OUT')}>
                  <option value="ALL">All Entry/Exit</option>
                  <option value="IN">Entry</option>
                  <option value="OUT">Exit</option>
                </select>
                <Input type="date" value={fromDateFilter} onChange={(event) => setFromDateFilter(event.target.value)} />
                <Input type="date" value={toDateFilter} onChange={(event) => setToDateFilter(event.target.value)} />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={lateFilter} onChange={(event) => setLateFilter(event.target.value as 'ALL' | 'YES' | 'NO')}>
                  <option value="ALL">Late: All</option>
                  <option value="YES">Late: Yes</option>
                  <option value="NO">Late: No</option>
                </select>
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={flaggedFilter} onChange={(event) => setFlaggedFilter(event.target.value as 'ALL' | 'YES' | 'NO')}>
                  <option value="ALL">Flagged: All</option>
                  <option value="YES">Flagged: Yes</option>
                  <option value="NO">Flagged: No</option>
                </select>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <div className="rounded-lg bg-muted p-3 text-sm">Entries Today: {logsQuery.data?.summary.total_entries_today || 0}</div>
                <div className="rounded-lg bg-muted p-3 text-sm">Exits Today: {logsQuery.data?.summary.total_exits_today || 0}</div>
                <div className="rounded-lg bg-muted p-3 text-sm">Late Entries: {logsQuery.data?.summary.total_late_entries_today || 0}</div>
                <div className="rounded-lg bg-muted p-3 text-sm">Flagged: {logsQuery.data?.summary.total_flagged_today || 0}</div>
              </div>

              {logsQuery.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading logs...</p> : null}
              {logsQuery.error ? <p className="mt-3 text-sm text-destructive">{(logsQuery.error as Error).message}</p> : null}

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-2">Student</th>
                      <th className="px-2 py-2">Enrollment</th>
                      <th className="px-2 py-2">Hostel</th>
                      <th className="px-2 py-2">Floor</th>
                      <th className="px-2 py-2">Room</th>
                      <th className="px-2 py-2">Entry/Exit</th>
                      <th className="px-2 py-2">Scan Time</th>
                      <th className="px-2 py-2">Destination</th>
                      <th className="px-2 py-2">Late</th>
                      <th className="px-2 py-2">Flagged</th>
                      <th className="px-2 py-2">Verified By</th>
                      <th className="px-2 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logsQuery.data?.rows || []).map((row) => (
                      <tr key={row.id} className="border-b border-border/60">
                        <td className="px-2 py-2">{row.student_name}</td>
                        <td className="px-2 py-2">{row.enrollment_no}</td>
                        <td className="px-2 py-2">{row.hostel}</td>
                        <td className="px-2 py-2">{row.floor ?? '--'}</td>
                        <td className="px-2 py-2">{row.room}</td>
                        <td className="px-2 py-2">{row.scan_type}</td>
                        <td className="px-2 py-2">{new Date(row.time).toLocaleString()}</td>
                        <td className="px-2 py-2">{row.scan_type === 'EXIT' ? row.destination || '--' : '--'}</td>
                        <td className="px-2 py-2">{row.late_status ? 'Yes' : 'No'}</td>
                        <td className="px-2 py-2">{row.flagged_status ? 'Yes' : 'No'}</td>
                        <td className="px-2 py-2">{row.verified_by}</td>
                        <td className="px-2 py-2">{row.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-foreground">Recent Scan Activity</p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {(logsQuery.data?.recent_scan_activity || []).slice(0, 8).map((item) => (
                      <p key={item.id}>
                        {item.student_name} ({item.enrollment_no}) • {item.scan_type} • {new Date(item.scan_time).toLocaleString()} • Late:{' '}
                        {item.late_status ? 'Yes' : 'No'}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-foreground">Student-wise History</p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {(logsQuery.data?.student_wise_history || []).slice(0, 8).map((item) => (
                      <p key={item.student_id}>
                        {item.student_name} ({item.enrollment_no}) • Total {item.total_scans} • Late {item.late_count} • Flagged {item.flagged_count}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-foreground">Room-wise History</p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {(logsQuery.data?.room_wise_history || []).slice(0, 8).map((item, index) => (
                      <p key={`${item.hostel}-${item.floor ?? 'N'}-${item.room}-${index}`}>
                        {item.hostel} • Floor {item.floor ?? '--'} • Room {item.room} • Total {item.total_scans}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-foreground">Floor-wise / Date-wise History</p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {(logsQuery.data?.floor_wise_history || []).slice(0, 4).map((item, index) => (
                      <p key={`${item.hostel}-${item.floor ?? 'N'}-${index}`}>
                        {item.hostel} • Floor {item.floor ?? '--'} • Total {item.total_scans}
                      </p>
                    ))}
                    {(logsQuery.data?.date_wise_history || []).slice(0, 4).map((item) => (
                      <p key={item.date}>
                        {item.date} • Entries {item.entries} • Exits {item.exits} • Late {item.late_count}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Scan QR using camera</p>
                {isTorchSupported ? (
                  <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={toggleTorch} disabled={!isCameraActive}>
                    {isTorchOn ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                    {isTorchOn ? 'Torch Off' : 'Torch On'}
                  </Button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Camera scanning is primary. Manual token input is kept only as fallback.
              </p>

              <div className="relative mt-3 overflow-hidden rounded-xl border border-border bg-muted/50">
                <video ref={videoRef} className="h-64 w-full bg-black object-cover" playsInline muted />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-40 w-40 rounded-2xl border-2 border-emerald-300/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)] animate-pulse" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button className="rounded-xl gap-2" onClick={startCamera} disabled={isCameraStarting || isCameraActive}>
                  <Camera className="h-4 w-4" />
                  {isCameraStarting ? 'Starting camera...' : isCameraActive ? 'Camera active' : 'Start camera scanner'}
                </Button>
                <Button type="button" variant="outline" className="rounded-xl" onClick={stopCamera} disabled={!isCameraActive && !isCameraStarting}>
                  Stop camera
                </Button>
              </div>

              {cameraPermission === 'denied' ? (
                <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">Camera access is required to scan QR</p>
                  <Button type="button" variant="outline" className="mt-2 rounded-xl" onClick={startCamera}>
                    Allow Camera Access / Retry
                  </Button>
                </div>
              ) : null}

              {cameraError ? <p className="mt-2 text-sm text-destructive">{cameraError}</p> : null}
              {lastDecodedToken ? (
                <p className="mt-2 break-all text-xs text-muted-foreground">Last decoded token: {lastDecodedToken}</p>
              ) : null}

              {scanFeedback ? (
                <div
                  className={`mt-3 rounded-lg border p-3 ${scanFeedback.kind === 'success' ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-900' : 'border-destructive/50 bg-destructive/10 text-destructive'}`}
                >
                  <p className="text-sm font-semibold">{scanFeedback.message}</p>
                  <p className="mt-1 text-xs opacity-80">
                    {scanFeedback.actionType ? `Type: ${scanFeedback.actionType} | ` : ''}
                    Scan time: {new Date(scanFeedback.timestamp).toLocaleString()}
                  </p>
                  <Button type="button" variant="outline" className="mt-2 rounded-xl" onClick={startCamera}>
                    Retry scan
                  </Button>
                </div>
              ) : null}

              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Manual fallback token input</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use this only if camera scanning is unavailable.
                </p>
              <Input
                value={scanToken}
                onChange={(event) => setScanToken(event.target.value)}
                placeholder="Paste token text from scanner"
                className="mt-3"
              />
              <Button className="mt-3 rounded-xl gap-2" onClick={submitScan} disabled={isSubmitting}>
                <ScanLine className="h-4 w-4" />
                {isSubmitting ? 'Submitting...' : 'Submit Scan'}
              </Button>
              </div>

              {pendingExitToken ? (
                <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-semibold text-foreground">Complete Exit Details</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Destination is required before your exit can be logged.
                  </p>
                  <Input
                    className="mt-3"
                    placeholder="Destination / Where going"
                    value={exitDraft.destination}
                    onChange={(event) => setExitDraft((prev) => ({ ...prev, destination: event.target.value }))}
                  />
                  <Input
                    className="mt-2"
                    placeholder="Optional reason / note"
                    value={exitDraft.note}
                    onChange={(event) => setExitDraft((prev) => ({ ...prev, note: event.target.value }))}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" className="rounded-xl" onClick={submitExitDetails} disabled={isSubmitting}>
                      {isSubmitting ? 'Saving exit...' : 'Save Exit Details'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        setPendingExitToken(null);
                        setExitDraft({ destination: '', note: '' });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            {scanResult ? (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-900">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  {scanResult.action_type} recorded {scanResult.late_status ? '(Late)' : ''}
                </div>
                <p className="mt-1 text-sm">{scanResult.message}</p>
                <p className="mt-1 text-xs opacity-70">{new Date(scanResult.timestamp).toLocaleString()}</p>
                <p className="mt-1 text-xs opacity-70">
                  Status: {scanResult.status} | Late: {scanResult.late_status ? 'Yes' : 'No'} | Flagged: {scanResult.flagged_status ? 'Yes' : 'No'}
                </p>
              </div>
            ) : null}
          </div>
        )}

        <p className="mt-4 text-sm text-muted-foreground">
          {isGateManager ? 'Current gate token refreshes every 30 seconds.' : 'Use camera scan first. Manual token paste is fallback only.'}
        </p>
      </div>
    </div>
  );
};

export default QRCenterPage;
