import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck, UserX, Warehouse } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#050a16] text-slate-200 antialiased selection:bg-sky-400/30">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(56,132,255,0.16),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        <div className="absolute right-[-160px] top-1/3 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      {/* top nav */}
      <header className="relative z-10 border-b border-white/5">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 outline-none"
          >
            <img src={logo} alt="SmartFulfill AI logo" width={28} height={28} className="rounded-md" />
            <span className="font-display text-[15px] font-semibold tracking-tight text-white">
              SmartFulfill <span className="text-sky-400">AI</span>
            </span>
          </button>
          <Button
            type="button"
            variant="ghost"
            className="gap-1.5 text-slate-300 hover:bg-white/5 hover:text-white"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="size-4" /> Back to site
          </Button>
        </div>
      </header>

      {/* auth content */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Card className="border-white/10 bg-[#0b1226]/90 text-slate-200 shadow-2xl shadow-black/50 backdrop-blur-xl">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center">
                  <div className="flex justify-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-400/10">
                      <Warehouse className="size-6 text-sky-300" />
                    </div>
                  </div>
                  <CardTitle className="mt-3 text-xl text-white">Enter the Command Center</CardTitle>
                  <CardDescription className="text-slate-400">
                    Sign in or create an account to manage warehouse operations
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-3 size-4 text-slate-500" />
                        <Input
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          className="border-white/10 bg-white/[0.04] pl-9 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/50"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        size="icon"
                        className="border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ArrowRight className="size-4" />
                        )}
                      </Button>
                    </div>
                    {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}

                    <div className="mt-4">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-[#0b1226] px-2 text-slate-500">Or</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4 w-full border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10"
                        onClick={handleGuestLogin}
                        disabled={isLoading}
                      >
                        <UserX className="mr-2 size-4" />
                        Continue as Guest
                      </Button>
                    </div>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="mt-4 text-center">
                  <div className="flex justify-center">
                    <img src={logo} alt="SmartFulfill AI logo" width={48} height={48} className="rounded-xl" />
                  </div>
                  <CardTitle className="text-xl text-white">Check your email</CardTitle>
                  <CardDescription className="text-slate-400">
                    We&apos;ve sent a verification code to {step.email}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) form.requestSubmit();
                          }
                        }}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className="border-white/10 bg-white/[0.04] text-slate-100"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="mt-2 text-center text-sm text-rose-400">{error}</p>
                    )}
                    <p className="mt-4 text-center text-sm text-slate-400">
                      Didn&apos;t receive a code?{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0 text-sky-400"
                        onClick={() => setStep("signIn")}
                      >
                        Try again
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button
                      type="submit"
                      className="w-full bg-sky-500 text-white hover:bg-sky-400"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight className="ml-2 size-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    >
                      Use different email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}

            <div className="flex items-center justify-center gap-1.5 border-t border-white/5 bg-white/[0.02] px-6 py-3.5 text-xs text-slate-500">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              Secured warehouse access · OTP & guest login
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
