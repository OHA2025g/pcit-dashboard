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
      await register({ email, password, name });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" data-testid="sign-up-form">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Create account</h1>
        <p className="text-sm text-slate-500 mt-1">New accounts await administrator approval before data access.</p>
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
        {busy ? "Creating account…" : "Register"}
      </Button>
      <p className="text-sm text-slate-500 text-center">
        Already have an account?{" "}
        <Link to="/sign-in" className="text-blue-800 hover:underline font-medium" data-testid={REGISTER.loginLink}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
