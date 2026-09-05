"use client";

import { FormEvent, useState } from "react";
import { Heart, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function SetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please choose a name.");
      return;
    }

    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: trimmedName,
      })
      .eq("id", user.id);

    if (updateError) {
      setError("We couldn't save your name. Please try again.");
      setLoading(false);
      return;
    }

    router.replace("/");
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
              What should we call you? 🌸
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Pick a name you'd like to see throughout your little quest.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
          >
            <label
              htmlFor="display-name"
              className="text-sm font-semibold text-slate-700"
            >
              Your name
            </label>

            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Ananya"
              maxLength={30}
              autoFocus
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-50"
            />

            <p className="mt-2 text-xs text-slate-400">
              You can change this later in Settings.
            </p>

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
                  Saving...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  That's me ✨
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}