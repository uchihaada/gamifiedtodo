"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  ArrowLeft,
  Check,
  LogOut,
  Moon,
  Shield,
  Sun,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

const themes = [
  {
    key: "pink",
    label: "Pink",
    emoji: "🌸",
    activeClass: "bg-pink-500",
  },
  {
    key: "purple",
    label: "Purple",
    emoji: "💜",
    activeClass: "bg-purple-500",
  },
  {
    key: "blue",
    label: "Blue",
    emoji: "💙",
    activeClass: "bg-blue-500",
  },
  {
    key: "mint",
    label: "Mint",
    emoji: "💚",
    activeClass: "bg-emerald-500",
  },
  {
    key: "peach",
    label: "Peach",
    emoji: "🧡",
    activeClass: "bg-orange-400",
  },
  {
    key: "yellow",
    label: "Yellow",
    emoji: "🌻",
    activeClass: "bg-yellow-400",
  },
] as const;

type ThemeKey = (typeof themes)[number]["key"];
type AppearanceKey = "light" | "dark" | "system";

type CareWindow = {
  id: string;
  start_date: string;
  end_date: string | null;
};

export default function SettingsPage() {
  const router = useRouter();

  const {
    theme,
    appearance,
    setTheme,
    setAppearance,
  } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [originalName, setOriginalName] = useState("");

  const [careWindow, setCareWindow] =
    useState<CareWindow | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [startingCareWindow, setStartingCareWindow] =
    useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Settings profile error:",
        profileError
      );

      setErrorMessage(
        "Unable to load your profile."
      );

      setLoading(false);
      return;
    }

    const name = profile?.display_name ?? "";

    setDisplayName(name);
    setOriginalName(name);

    await loadCareWindow(user.id);

    setLoading(false);
  }

  async function loadCareWindow(userId: string) {
    const today = getTodayString();

    const {
      data,
      error,
    } = await supabase
      .from("care_windows")
      .select("id, start_date, end_date")
      .eq("user_id", userId)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("start_date", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Care window load error:",
        error
      );
      return;
    }

    setCareWindow(data ?? null);
  }

  function getTodayString() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatDate(
    dateString: string | null
  ) {
    if (!dateString) return "";

    const date = new Date(
      `${dateString}T00:00:00`
    );

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }

  async function startCareWindow() {
    setStartingCareWindow(true);
    setErrorMessage("");

    const todayString =
      getTodayString();

    const {
      data,
      error,
    } = await supabase.rpc(
      "start_care_window",
      {
        p_start_date: todayString,
      }
    );

    if (error) {
      const detailedError = [
        error.code
          ? `Code: ${error.code}`
          : "",
        error.message
          ? `Message: ${error.message}`
          : "",
        error.details
          ? `Details: ${error.details}`
          : "",
        error.hint
          ? `Hint: ${error.hint}`
          : "",
      ]
        .filter(Boolean)
        .join(" | ");

      console.error(
        "Start Care Window error:",
        detailedError
      );

      setErrorMessage(
        detailedError ||
          "Unknown error starting Care Window."
      );

      setStartingCareWindow(false);
      return;
    }

    if (!data?.success) {
      console.error(
        "Start Care Window failed:",
        JSON.stringify(data)
      );

      if (
        data?.reason ===
        "overlapping_window"
      ) {
        setErrorMessage(
          "You already have an active Care Window."
        );
      } else {
        setErrorMessage(
          "Care Window could not be started."
        );
      }

      setStartingCareWindow(false);
      return;
    }

    setCareWindow({
      id: data.id,
      start_date: data.start_date,
      end_date: data.end_date,
    });

    setStartingCareWindow(false);
  }

  async function saveName() {
    const trimmedName =
      displayName.trim();

    if (!trimmedName) {
      setErrorMessage(
        "Please enter a name."
      );
      return;
    }

    setSavingName(true);
    setSaved(false);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error } =
      await supabase
        .from("profiles")
        .update({
          display_name: trimmedName,
        })
        .eq("id", user.id);

    if (error) {
      console.error(
        "Save name error:",
        error
      );

      setErrorMessage(
        "Could not save your name."
      );

      setSavingName(false);
      return;
    }

    setDisplayName(trimmedName);
    setOriginalName(trimmedName);
    setSaved(true);
    setSavingName(false);

    window.setTimeout(() => {
      setSaved(false);
    }, 2000);
  }

  function changeTheme(
    nextTheme: ThemeKey
  ) {
    setTheme(nextTheme);
  }

  function changeAppearance(
    nextAppearance: AppearanceKey
  ) {
    setAppearance(nextAppearance);
  }

  async function logout() {
    setLoggingOut(true);
    setErrorMessage("");

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Logout error:",
        error
      );

      setErrorMessage(
        "Could not log out. Please try again."
      );

      setLoggingOut(false);
      return;
    }

    router.replace("/login");
  }

  const hasNameChanges =
    displayName.trim() !==
    originalName;

  const careWindowActive =
    careWindow !== null;

  return (
    <main className="min-h-screen bg-[#fff8fb] text-slate-800">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-10">

        {/* Header */}
        <header className="flex items-center gap-3 pt-7">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
              Your Account
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Settings ⚙️
            </h1>
          </div>
        </header>

        {/* Profile */}
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50">
              <User className="h-5 w-5 text-pink-500" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
                Profile
              </p>

              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                Your name
              </h2>
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="displayName"
              className="text-sm font-medium text-slate-600"
            >
              Display name
            </label>

            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => {
                setDisplayName(
                  event.target.value
                );
                setSaved(false);
                setErrorMessage("");
              }}
              disabled={
                loading ||
                savingName
              }
              placeholder="Enter your name"
              maxLength={40}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-50 disabled:opacity-60"
            />

            <button
              onClick={saveName}
              disabled={
                loading ||
                savingName ||
                !hasNameChanges ||
                !displayName.trim()
              }
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {savingName
                    ? "Saving..."
                    : "Save Name"}
                </>
              )}
            </button>
          </div>
        </section>

        {/* Appearance */}
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
            Appearance
          </p>

          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Make it yours 🎨
          </h2>

          {/* Theme */}
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-700">
              Theme color
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {themes.map((item) => {
                const selected =
                  theme === item.key;

                return (
                  <button
                    key={item.key}
                    onClick={() =>
                      changeTheme(
                        item.key
                      )
                    }
                    className={`rounded-2xl border p-3 text-center transition ${
                      selected
                        ? "border-pink-300 bg-pink-50 ring-2 ring-pink-100"
                        : "border-slate-100 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <div
                      className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ${item.activeClass}`}
                    >
                      {selected ? (
                        <Check className="h-4 w-4 text-white" />
                      ) : (
                        <span className="text-sm">
                          {item.emoji}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-xs font-semibold text-slate-600">
                      {item.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Appearance mode */}
          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-700">
              Appearance
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                onClick={() =>
                  changeAppearance(
                    "light"
                  )
                }
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
                  appearance ===
                  "light"
                    ? "border-pink-300 bg-pink-50 ring-2 ring-pink-100"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <Sun className="h-5 w-5 text-orange-400" />

                <span className="text-xs font-semibold">
                  Light
                </span>
              </button>

              <button
                onClick={() =>
                  changeAppearance(
                    "dark"
                  )
                }
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
                  appearance ===
                  "dark"
                    ? "border-pink-300 bg-pink-50 ring-2 ring-pink-100"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <Moon className="h-5 w-5 text-purple-500" />

                <span className="text-xs font-semibold">
                  Dark
                </span>
              </button>

              <button
                onClick={() =>
                  changeAppearance(
                    "system"
                  )
                }
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
                  appearance ===
                  "system"
                    ? "border-pink-300 bg-pink-50 ring-2 ring-pink-100"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <div className="flex h-5 items-center gap-0.5">
                  <Sun className="h-4 w-4 text-orange-400" />
                  <Moon className="h-4 w-4 text-purple-500" />
                </div>

                <span className="text-xs font-semibold">
                  System
                </span>
              </button>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-400">
            Your preferences are saved on this device.
          </p>
        </section>

        {/* Care Window */}
        <section className="mt-6 rounded-3xl bg-gradient-to-br from-pink-100 via-purple-50 to-white p-5 shadow-sm ring-1 ring-pink-100">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-2xl">
              🌷
            </div>

            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-pink-500">
                Care Window
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Supportive 5-day mode
              </h2>

              <p className="mt-1 text-sm leading-5 text-slate-600">
                A gentler reward period designed
                to reduce pressure while keeping
                your overall progress moving forward.
              </p>

              <div className="mt-4 rounded-2xl bg-white/70 p-3">
                <div className="grid grid-cols-5 gap-1 text-center">

                  <div>
                    <p className="text-xs font-bold text-pink-500">
                      D1
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      30%
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-pink-500">
                      D2
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      40%
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-pink-500">
                      D3
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      50%
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-pink-500">
                      D4
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      60%
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-pink-500">
                      D5
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      70%
                    </p>
                  </div>

                </div>
              </div>

              {careWindowActive ? (
                <div className="mt-4 rounded-2xl bg-green-50 p-4">
                  <div className="flex items-center gap-2">

                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-green-700">
                        Care Window active
                      </p>

                      <p className="text-xs text-green-600">
                        {formatDate(
                          careWindow?.start_date ??
                            null
                        )}{" "}
                        →{" "}
                        {formatDate(
                          careWindow?.end_date ??
                            null
                        )}
                      </p>
                    </div>

                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={
                      startCareWindow
                    }
                    disabled={
                      startingCareWindow ||
                      loading
                    }
                    className="mt-4 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-wait disabled:opacity-50"
                  >
                    {startingCareWindow
                      ? "Starting..."
                      : "Start Care Window"}
                  </button>

                  <p className="mt-2 text-center text-xs text-slate-400">
                    Starts today and lasts 5 days.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Game Rules */}
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
            Game Rules
          </p>

          <div className="mt-4 space-y-4">

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-50">
                🎯
              </div>

              <div>
                <p className="font-semibold text-slate-800">
                  Daily Target
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Normally reach 80% of your planned
                  XP. During a Care Window, the required
                  percentage gradually starts lower.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                <Shield className="h-4 w-4 text-purple-500" />
              </div>

              <div>
                <p className="font-semibold text-slate-800">
                  Streak Shield
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  A future protection mechanic for
                  your streak. No punishment or negative XP.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-50">
                📅
              </div>

              <div>
                <p className="font-semibold text-slate-800">
                  Weekly Planning
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Your planning week runs from Monday
                  through Sunday.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Account */}
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
            Account
          </p>

          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Session
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Log out of this device when you are finished.
          </p>

          <button
            onClick={logout}
            disabled={loggingOut}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut
              ? "Logging out..."
              : "Log Out"}
          </button>
        </section>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            One quest at a time 💕
          </p>
        </div>

      </div>
    </main>
  );
}