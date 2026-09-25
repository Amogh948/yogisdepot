import { zodResolver } from "@hookform/resolvers/zod";
import { Helmet } from "react-helmet-async";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { authApi } from "../../services/api/auth.api";
import { ApiError } from "../../services/api/client";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(8),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const toast = useToastStore((s) => s.push);
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  return (
    <div className="mx-auto max-w-md py-6">
      <Helmet>
        <title>Login | Yogi's Depot</title>
      </Helmet>
      <h1 className="font-display text-3xl text-yd-forest">Welcome back</h1>
      <p className="mt-1 text-sm text-yd-muted">Sign in to checkout, track orders, and save your pantry.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            const user = await login(values.email, values.password);
            toast("Logged in successfully");
            const from = (location.state as { from?: string } | null)?.from;
            if (user.role === "admin") navigate("/admin/dashboard");
            else if (user.role === "vendor") navigate("/vendor/dashboard");
            else navigate(from || "/");
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Login failed", "error");
          }
        })}
      >
        <Input label="Email" type="email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <Input label="Password" type="password" {...form.register("password")} error={form.formState.errors.password?.message} />
        <Button className="w-full" loading={form.formState.isSubmitting}>
          Login
        </Button>
      </form>
      <p className="mt-4 text-sm">
        New here? <Link className="font-semibold text-yd-green" to="/register">Create an account</Link>
      </p>
    </div>
  );
}

export function RegisterPage() {
  const login = useAuthStore((s) => s.login);
  const toast = useToastStore((s) => s.push);
  const navigate = useNavigate();
  const form = useForm({ resolver: zodResolver(registerSchema), defaultValues: { firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "" } });

  return (
    <div className="mx-auto max-w-md py-6">
      <Helmet>
        <title>Register | Yogi's Depot</title>
      </Helmet>
      <h1 className="font-display text-3xl text-yd-forest">Create your account</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await authApi.register(values);
            await login(values.email, values.password);
            toast("Welcome to Yogi's Depot");
            navigate("/");
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Registration failed", "error");
          }
        })}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" {...form.register("firstName")} error={form.formState.errors.firstName?.message} />
          <Input label="Last name" {...form.register("lastName")} error={form.formState.errors.lastName?.message} />
        </div>
        <Input label="Email" type="email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <Input label="Phone" {...form.register("phone")} error={form.formState.errors.phone?.message} />
        <Input label="Password" type="password" {...form.register("password")} error={form.formState.errors.password?.message} />
        <Input label="Confirm password" type="password" {...form.register("confirmPassword")} error={form.formState.errors.confirmPassword?.message} />
        <Button className="w-full" loading={form.formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </div>
  );
}
