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
    activeClass: "bg-[var(--accent-soft)]0",
  },
  {
    key: "purple",
    label: "Purple",
    emoji: "💜",
    activeClass: "bg-[var(--accent-soft)]0",
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

    await loadLatestCareWindow(user.id);

    setLoading(false);
  }

  async function loadLatestCareWindow(
    userId: string
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("care_windows")
      .select("id, start_date, end_date")
      .eq("user_id", userId)
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

  function addDays(
    dateString: string,
    amount: number
  ) {
    const date = new Date(
      `${dateString}T00:00:00`
    );

    date.setDate(
      date.getDate() + amount
    );

    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatDate(
    dateString: string | null
  ) {
    if (!dateString) {
      return "";
    }

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

  function getDaysUntil(
    dateString: string
  ) {
    const today = new Date(
      `${getTodayString()}T00:00:00`
    );

    const target = new Date(
      `${dateString}T00:00:00`
    );

    return Math.max(
      0,
      Math.ceil(
        (target.getTime() -
          today.getTime()) /
          (1000 * 60 * 60 * 24)
      )
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
        p_start_date:
          todayString,
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
          "Could not start Care Window."
      );

      setStartingCareWindow(false);
      return;
    }

    if (!data?.success) {
      if (
        data?.reason ===
        "active_window"
      ) {
        setErrorMessage(
          "You already have an active Care Window."
        );
      } else if (
        data?.reason ===
        "cooldown"
      ) {
        setErrorMessage(
          `Care Window is available again on ${formatDate(
            data.next_allowed_date
          )}.`
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
          display_name:
            trimmedName,
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

  const today = getTodayString();

  const careWindowActive =
    careWindow !== null &&
    careWindow.start_date <= today &&
    !!careWindow.end_date &&
    careWindow.end_date >= today;

  const nextAllowedDate =
    careWindow !== null
      ? addDays(
          careWindow.start_date,
          21
        )
      : null;

  const cooldownActive =
    careWindow !== null &&
    !careWindowActive &&
    nextAllowedDate !== null &&
    today < nextAllowedDate;

  const cooldownDays =
    cooldownActive &&
    nextAllowedDate
      ? getDaysUntil(
          nextAllowedDate
        )
      : 0;

  return (
    <main className="min-h-screen bg-[var(--app-background)] text-[var(--app-foreground)]">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-10">

        {/* Header */}
        <header className="flex items-center gap-3 pt-7">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-surface)] shadow-sm ring-1 ring-[var(--app-border)] transition hover:opacity-90"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-[var(--app-muted-strong)]" />
          </button>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              Your Account
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-[var(--app-foreground)]">
              Settings ⚙️
            </h1>
          </div>
        </header>

        {/* Profile */}
        <section className="mt-6 rounded-3xl bg-[var(--app-surface)] p-5 shadow-sm ring-1 ring-[var(--app-border)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
              <User className="h-5 w-5 text-[var(--accent)]" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                Profile
              </p>

              <h2 className="mt-0.5 text-lg font-bold text-[var(--app-foreground)]">
                Your name
              </h2>
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="displayName"
              className="text-sm font-medium text-[var(--app-muted-strong)]"
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
              className="mt-2 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-background)] px-4 py-3 text-base font-medium text-[var(--app-foreground)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--accent)] focus:bg-[var(--app-surface)] focus:ring-4 focus:ring-[var(--accent-soft)] disabled:opacity-60"
            />

            <button
              onClick={saveName}
              disabled={
                loading ||
                savingName ||
                !hasNameChanges ||
                !displayName.trim()
              }
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
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
        <section className="mt-6 rounded-3xl bg-[var(--app-surface)] p-5 shadow-sm ring-1 ring-[var(--app-border)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
            Appearance
          </p>

          <h2 className="mt-1 text-lg font-bold text-[var(--app-foreground)]">
            Make it yours 🎨
          </h2>

          <div className="mt-5">
            <p className="text-sm font-semibold text-[var(--app-muted-strong)]">
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
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent-light)]"
                        : "border-[var(--app-border)] bg-[var(--app-background)] hover:bg-[var(--app-surface)]"
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

                    <p className="mt-2 text-xs font-semibold text-[var(--app-muted-strong)]">
                      {item.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-[var(--app-muted-strong)]">
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
                  appearance === "light"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent-light)]"
                    : "border-[var(--app-border)] bg-[var(--app-background)]"
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
                  appearance === "dark"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent-light)]"
                    : "border-[var(--app-border)] bg-[var(--app-background)]"
                }`}
              >
                <Moon className="h-5 w-5 text-[var(--accent)]" />

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
                  appearance === "system"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent-light)]"
                    : "border-[var(--app-border)] bg-[var(--app-background)]"
                }`}
              >
                <div className="flex h-5 items-center gap-0.5">
                  <Sun className="h-4 w-4 text-orange-400" />
                  <Moon className="h-4 w-4 text-[var(--accent)]" />
                </div>

                <span className="text-xs font-semibold">
                  System
                </span>
              </button>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-[var(--app-muted)]">
            Your preferences are saved on this device.
          </p>
        </section>

        {/* Care Window */}
        <section className="mt-6 rounded-3xl bg-gradient-to-br from-pink-100 via-purple-50 to-white p-5 shadow-sm ring-1 ring-pink-100 dark:bg-none dark:bg-[var(--app-surface)] dark:ring-[var(--app-border)]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-surface)]/80 text-2xl">
              🌷
            </div>

            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                Care Window
              </p>

              <h2 className="mt-1 text-lg font-bold text-[var(--app-foreground)]">
                Supportive 5-day mode
              </h2>

              <p className="mt-1 text-sm leading-5 text-[var(--app-muted-strong)]">
                A gentler daily target during a
                Care Window. Your task rewards
                always remain at their full value.
              </p>

              <div className="mt-4 rounded-2xl bg-[var(--app-surface)]/70 p-3">
                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    ["D1", "30%"],
                    ["D2", "40%"],
                    ["D3", "50%"],
                    ["D4", "60%"],
                    ["D5", "70%"],
                  ].map(([day, percentage]) => (
                    <div key={day}>
                      <p className="text-xs font-bold text-[var(--accent)]">
                        {day}
                      </p>

                      <p className="mt-1 text-xs text-[var(--app-muted-strong)]">
                        {percentage}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {careWindowActive ? (
                <div className="mt-4 rounded-2xl bg-green-50 p-4 dark:bg-green-950/30">
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
                          careWindow.start_date
                        )}{" "}
                        →{" "}
                        {formatDate(
                          careWindow.end_date
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ) : cooldownActive &&
                careWindow &&
                nextAllowedDate ? (
                <div className="mt-4 rounded-2xl bg-[var(--accent-soft)] p-4 dark:bg-[var(--accent-soft)]">
                  <p className="text-sm font-bold text-purple-700">
                    Care Window cooling down
                  </p>

                  <p className="mt-1 text-sm text-[var(--accent)]">
                    Next available:{" "}
                    {formatDate(
                      nextAllowedDate
                    )}
                  </p>

                  <p className="mt-1 text-xs text-purple-400">
                    Available in{" "}
                    {cooldownDays}{" "}
                    {cooldownDays === 1
                      ? "day"
                      : "days"}
                  </p>
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
                    className="mt-4 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-wait disabled:opacity-50"
                  >
                    {startingCareWindow
                      ? "Starting..."
                      : "Start Care Window"}
                  </button>

                  <p className="mt-2 text-center text-xs text-[var(--app-muted)]">
                    Starts today and lasts 5 days.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Game Rules */}
        <section className="mt-6 rounded-3xl bg-[var(--app-surface)] p-5 shadow-sm ring-1 ring-[var(--app-border)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
            Game Rules
          </p>

          <div className="mt-4 space-y-4">

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)]">
                🎯
              </div>

              <div>
                <p className="font-semibold text-[var(--app-foreground)]">
                  Daily Target
                </p>

                <p className="mt-1 text-sm text-[var(--app-muted-strong)]">
                  Normally reach 80% of planned XP.
                  During a Care Window the required
                  percentage starts lower and rises
                  gradually.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)]">
                <Shield className="h-4 w-4 text-[var(--accent)]" />
              </div>

              <div>
                <p className="font-semibold text-[var(--app-foreground)]">
                  Streak Recovery
                </p>

                <p className="mt-1 text-sm text-[var(--app-muted-strong)]">
                  A future recovery mechanic for
                  restoring a meaningful streak after
                  a missed day.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--app-background)]">
                📅
              </div>

              <div>
                <p className="font-semibold text-[var(--app-foreground)]">
                  Weekly Planning
                </p>

                <p className="mt-1 text-sm text-[var(--app-muted-strong)]">
                  Your planning week runs from Monday
                  through Sunday.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Account */}
        <section className="mt-6 rounded-3xl bg-[var(--app-surface)] p-5 shadow-sm ring-1 ring-[var(--app-border)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
            Account
          </p>

          <h2 className="mt-1 text-lg font-bold text-[var(--app-foreground)]">
            Session
          </h2>

          <p className="mt-1 text-sm text-[var(--app-muted-strong)]">
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
          <p className="text-xs text-[var(--app-muted)]">
            One quest at a time 💕
          </p>
        </div>

      </div>
    </main>
  );
}