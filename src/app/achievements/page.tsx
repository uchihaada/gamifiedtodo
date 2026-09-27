"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Lock, Sparkles, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Achievement = {
  id: string;
  code: string;
  name: string;
  description: string;
  emoji: string;
};

type UserAchievement = {
  achievement_id: string;
  unlocked_at: string;
};

export default function AchievementsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<Record<string, UserAchievement>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAchievements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAchievements() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { error: awardError } = await supabase.rpc(
        "check_and_award_achievements"
      );

      if (awardError) {
        console.warn("Achievement check failed:", awardError.message);
      }

      const [achievementResult, unlockedResult] = await Promise.all([
        supabase
          .from("achievements")
          .select("id, code, name, description, emoji")
          .order("created_at", { ascending: true }),
        supabase
          .from("user_achievements")
          .select("achievement_id, unlocked_at")
          .eq("user_id", user.id),
      ]);

      if (achievementResult.error) throw achievementResult.error;
      if (unlockedResult.error) throw unlockedResult.error;

      const unlockedMap: Record<string, UserAchievement> = {};

      for (const row of (unlockedResult.data ?? []) as UserAchievement[]) {
        unlockedMap[row.achievement_id] = row;
      }

      setAchievements((achievementResult.data ?? []) as Achievement[]);
      setUnlocked(unlockedMap);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not load achievements."
      );
    } finally {
      setLoading(false);
    }
  }

  const unlockedCount = achievements.filter(
    (item) => unlocked[item.id]
  ).length;
  const totalCount = achievements.length;
  const progressPercent =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <main className="min-h-screen bg-[var(--app-background)] pb-28 text-[var(--app-foreground)]">
      <div className="mx-auto min-h-screen max-w-md px-5">
        {/* Header */}
        <header className="flex items-center gap-3 pt-7">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-surface)] shadow-sm ring-1 ring-[var(--app-border)] transition hover:opacity-90"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-[var(--app-muted-strong)]" />
          </button>

          <div className="flex-1">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--accent)" }}
            >
              Your Progress
            </p>
            <h1 className="text-2xl font-bold text-[var(--app-foreground)]">
              Achievements 🏆
            </h1>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-surface)] shadow-sm ring-1 ring-[var(--app-border)] transition hover:opacity-90"
            aria-label="Go home"
          >
            <Sparkles
              className="h-5 w-5"
              style={{ color: "var(--accent)" }}
            />
          </button>
        </header>

        {/* Summary */}
        <section className="mt-6 rounded-3xl bg-[var(--app-surface)] p-5 shadow-sm ring-1 ring-[var(--app-border)]">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent)",
              }}
            >
              <Trophy className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--app-muted)]">
                Your milestone collection
              </p>
              <h2 className="mt-1 text-xl font-bold text-[var(--app-foreground)]">
                {unlockedCount} of {totalCount} unlocked
              </h2>
            </div>

            <span
              className="rounded-full px-3 py-1 text-sm font-bold"
              style={{
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent)",
              }}
            >
              {progressPercent}%
            </span>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--app-border)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: "var(--accent)",
              }}
            />
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-5 space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-3xl bg-[var(--app-surface)] shadow-sm ring-1 ring-[var(--app-border)]"
              />
            ))}
          </div>
        ) : achievements.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center text-sm text-[var(--app-muted)] shadow-sm">
            No achievements have been configured yet.
          </div>
        ) : (
          <section className="mt-5 space-y-3">
            {achievements.map((achievement) => {
              const record = unlocked[achievement.id];
              const isUnlocked = Boolean(record);

              return (
                <article
                  key={achievement.id}
                  className={`rounded-3xl p-4 shadow-sm ring-1 transition ${
                    isUnlocked
                      ? "bg-[var(--app-surface)] ring-[var(--app-border)]"
                      : "bg-[var(--app-surface)]/70 ring-[var(--app-border)]"
                  }`}
                  
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${
                        isUnlocked
                          ? ""
                          : "bg-[var(--app-border)] grayscale"
                      }`}
                      style={
                        isUnlocked
                          ? {
                              backgroundColor: "var(--accent-soft)",
                            }
                          : undefined
                      }
                    >
                      {isUnlocked ? achievement.emoji : "🔒"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3
                          className={`font-extrabold leading-tight ${
                            isUnlocked
                              ? "text-[var(--app-foreground)]"
                              : "text-[var(--app-muted-strong)]"
                          }`}
                        >
                          {achievement.name}
                        </h3>

                        {isUnlocked ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold"
                            style={{
                              backgroundColor: "var(--accent-soft)",
                              color: "var(--accent)",
                            }}
                          >
                            <Check className="h-3 w-3" />
                            Unlocked
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--app-background)] px-2 py-1 text-[11px] font-bold text-[var(--app-muted-strong)]">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm leading-5 text-[var(--app-muted)]">
                        {achievement.description}
                      </p>

                      {record && (
                        <p
                          className="mt-2 text-xs font-semibold"
                          style={{ color: "var(--accent)" }}
                        >
                          Unlocked on{" "}
                          {new Date(record.unlocked_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <button
          type="button"
          onClick={() => router.push("/stats")}
          className="mt-5 flex w-full items-center justify-center rounded-2xl bg-[var(--app-surface)] px-4 py-3 text-sm font-bold text-[var(--accent)] shadow-sm ring-1 ring-[var(--app-border)] transition hover:opacity-90"
          style={{ color: "var(--accent)" }}
        >
          View Stats
        </button>
      </div>
    </main>
  );
}
