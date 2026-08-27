'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import TaskFlowLogo from '@/components/TaskFlowLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, toast } from '@/lib/util';

type ResetStep = 'email' | 'otp';

const RESEND_COOLDOWN_SECONDS = 30;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetErr, setResetErr] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const id = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendSeconds]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.push('/home');
    } catch (e: any) {
      setErr(e.message);
      toast.errorFrom(e, 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const openReset = () => {
    setResetOpen(true);
    setResetStep('email');
    setResetEmail(email);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResetErr('');
    setResetMsg('');
    setResendSeconds(0);
  };

  const closeReset = () => {
    setResetOpen(false);
    setResetStep('email');
    setResetErr('');
    setResetMsg('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResendSeconds(0);
  };

  const requestOtp = async (isResend = false) => {
    setResetErr('');
    if (!isResend) setResetMsg('');
    setResetBusy(true);
    try {
      const res = await api<{ message?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail }),
      });
      setResetMsg(res.message || 'If an account exists for this email, a verification code has been sent.');
      toast.success(isResend ? 'Verification code resent' : 'Verification code sent');
      if (!isResend) setResetStep('otp');
      setOtp('');
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (e: any) {
      setResetErr(e.message);
      toast.errorFrom(e);
    } finally {
      setResetBusy(false);
    }
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestOtp(false);
  };

  const resendOtp = async () => {
    if (resendSeconds > 0 || resetBusy) return;
    await requestOtp(true);
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetErr('');
    setResetMsg('');

    if (newPassword !== confirmPassword) {
      const msg = 'New passwords do not match';
      setResetErr(msg);
      toast.error(msg);
      return;
    }

    setResetBusy(true);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: resetEmail,
          otp: otp.trim(),
          newPassword,
          confirmPassword,
        }),
      });
      toast.success('Password updated');
      setPassword('');
      closeReset();
    } catch (e: any) {
      setResetErr(e.message);
      toast.errorFrom(e);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl shadow-lg">
            <TaskFlowLogo size={64} className="rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold">TaskFlow</h1>
          <p className="mt-1 text-sm text-muted-foreground">Task Management System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your RentFoxxy work email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  suppressHydrationWarning
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  suppressHydrationWarning
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              {err && (
                <Alert variant="destructive">
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={busy} suppressHydrationWarning>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={openReset}
                >
                  Reset password
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Modal open={resetOpen} onClose={closeReset} title="Reset password">
        {resetStep === 'email' ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your work email. We will send a 6-digit verification code to reset your password.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="h-10"
              />
            </div>
            {resetErr && (
              <Alert variant="destructive">
                <AlertDescription>{resetErr}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeReset} disabled={resetBusy}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={resetBusy}>
                {resetBusy ? 'Sending…' : 'Send code'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-medium text-foreground">{resetEmail}</span> and choose a new password.
            </p>
            {resetMsg && (
              <Alert>
                <AlertDescription>{resetMsg}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="reset-otp">Verification code</Label>
              <Input
                id="reset-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                className="h-10 text-center text-lg tracking-[0.35em]"
              />
              <div className="text-center text-sm">
                {resendSeconds > 0 ? (
                  <span className="text-muted-foreground">Resend code in {resendSeconds}s</span>
                ) : (
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                    onClick={resendOtp}
                    disabled={resetBusy}
                  >
                    {resetBusy ? 'Sending…' : 'Resend code'}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="h-10"
              />
            </div>
            {resetErr && (
              <Alert variant="destructive">
                <AlertDescription>{resetErr}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setResetStep('email');
                  setResetErr('');
                  setOtp('');
                  setResendSeconds(0);
                }}
                disabled={resetBusy}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={resetBusy}>
                {resetBusy ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
