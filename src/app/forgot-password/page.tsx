"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Mail, ArrowLeft, CheckCircle2, Copy, Check } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resetLink, setResetLink] = useState("")
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong")
        return
      }

      setSuccess(true)
      // For demo purposes - in production, this would be sent via email
      if (data.resetLink) {
        setResetLink(window.location.origin + data.resetLink)
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(resetLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="font-bold text-2xl">T</span>
            </div>
            <span className="text-2xl font-bold">Timeline</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-5xl font-bold leading-tight">
              Reset your<br />password
            </h1>
            <p className="text-xl text-primary-foreground/80 max-w-md">
              Don&apos;t worry, it happens to the best of us. Enter your email and we&apos;ll help you get back in.
            </p>
          </div>

          <p className="text-sm text-primary-foreground/60">
            Built with CT Editor and ShadCN UI
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-3xl">T</span>
            </div>
          </div>

          {success ? (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight">Check your email</h2>
                <p className="text-muted-foreground mt-2">
                  If an account exists with <span className="font-medium text-foreground">{email}</span>, you&apos;ll receive a password reset link.
                </p>
              </div>

              {/* Demo: Show reset link (remove in production) */}
              {resetLink && (
                <div className="p-4 bg-muted rounded-xl space-y-3">
                  <p className="text-sm text-muted-foreground">
                    <strong>Demo Mode:</strong> In production, this link would be sent via email.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={resetLink}
                      readOnly
                      className="text-xs h-10"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyLink}
                      className="h-10 px-3"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Link href={resetLink.replace(window.location.origin, '')}>
                    <Button className="w-full h-11">
                      Open Reset Link
                    </Button>
                  </Link>
                </div>
              )}

              <Link href="/login">
                <Button variant="outline" className="w-full h-12 text-base">
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold tracking-tight">Forgot password?</h2>
                <p className="text-muted-foreground mt-2">
                  Enter your email and we&apos;ll send you a reset link
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="flex items-center gap-3 p-4 text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 pl-12 text-base"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>

              <div className="text-center">
                <Link href="/login">
                  <Button variant="ghost" className="text-muted-foreground">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
