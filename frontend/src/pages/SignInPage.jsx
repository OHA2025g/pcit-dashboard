import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { LOGIN } from "@/constants/testIds/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login({ email, password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" data-testid="sign-in-form">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="text-sm text-slate-500 mt-1">Authorised personnel only. All access is logged.</p>
      </div>
      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-sm" data-testid="sign-in-error">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="sign-in-email">Email</Label>
        <Input
          id="sign-in-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm"
          data-testid={LOGIN.emailInput}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sign-in-password">Password</Label>
        <Input
          id="sign-in-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm"
          data-testid={LOGIN.passwordInput}
        />
      </div>
      <Button type="submit" disabled={busy} className="w-full rounded-sm" data-testid={LOGIN.submitButton}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-sm text-slate-500 text-center">
        No account?{" "}
        <Link to="/sign-up" className="text-blue-800 hover:underline font-medium" data-testid={LOGIN.registerLink}>
          Register
        </Link>
      </p>
    </form>
  );
}
