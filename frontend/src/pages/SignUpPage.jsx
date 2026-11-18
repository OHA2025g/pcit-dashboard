import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { REGISTER } from "@/constants/testIds/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const data = await register({ email, password, name });
      if (data.access_token) {
        navigate("/", { replace: true });
        return;
      }
      setDone(data.message || "Registration received. Wait for administrator approval before signing in.");
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-5" data-testid="sign-up-pending">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Awaiting approval</h1>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">{done}</p>
        </div>
        <Button asChild className="w-full rounded-sm" data-testid="sign-up-go-sign-in">
          <Link to="/sign-in">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" data-testid="sign-up-form">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Create account</h1>
        <p className="text-sm text-slate-500 mt-1">
          After you register, an administrator must approve your account before you can sign in.
        </p>
      </div>
      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-sm" data-testid="sign-up-error">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="sign-up-name">Name</Label>
        <Input
          id="sign-up-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-sm"
          data-testid={REGISTER.nameInput}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sign-up-email">Email</Label>
        <Input
          id="sign-up-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm"
          data-testid={REGISTER.emailInput}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sign-up-password">Password</Label>
        <Input
          id="sign-up-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm"
          data-testid={REGISTER.passwordInput}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sign-up-confirm">Confirm password</Label>
        <Input
          id="sign-up-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded-sm"
          data-testid={REGISTER.passwordConfirmInput}
        />
      </div>
      <Button type="submit" disabled={busy} className="w-full rounded-sm" data-testid={REGISTER.submitButton}>
        {busy ? "Submitting…" : "Register"}
      </Button>
      <p className="text-sm text-slate-500 text-center">
        Already have an account?{" "}
        <Link to="/sign-in" className="text-brand-navy hover:underline font-medium" data-testid={REGISTER.loginLink}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
