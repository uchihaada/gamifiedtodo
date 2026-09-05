"use client";

import { FormEvent, useState } from "react";
import { Heart, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      setError("We couldn't load your profile. Please try again.");
      setLoading(false);
      return;
    }

    if (!profile?.display_name) {
      router.push("/setup");
    } else {
      router.push("/");
    }
  }

  return (
    <main className="min-h-screen bg-[#fff8fb] px-5 py-10">
      <div className="mx-auto flex min-h-[85vh] max-w-md items-center">
        <div className="w-full">
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-pink-200 to-purple-200 shadow-sm">
              <Heart className="h-9 w-9 fill-pink-500 text-pink-500" />
            </div>

            <h1 className="mt-6 text-3xl font-bold text-slate-900">
              Her Little Quest 🌸
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              A little adventure, one task at a time.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
          >
            <div>
              <label
                htmlFor="email"
                className="text-sm font-semibold text-slate-700"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-50"
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="password"
                className="text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-50"
              />
            </div>

            {error && (
              <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-500 px-4 py-3.5 font-semibold text-white shadow-sm transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Start my quest
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400">
            Your progress, XP and rewards belong to your account.
          </p>
        </div>
      </div>
    </main>
  );
}