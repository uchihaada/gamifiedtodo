"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  Coins,
  Flame,
  Home as HomeIcon,
  ListTodo,
  ShoppingBag,
  Star,
  Trophy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

type Task = {
  id: string;
  difficulty: "easy" | "medium" | "hard" | "boss";
};

type DayStat = {
  date: string;
  label: string;
  plannedXp: number;
  earnedXp: number;
};

function getIndiaToday(): string {
  const now = new Date();

  const indiaTime = new Date(
    now.getTime() +
      5.5 * 60 * 60 * 1000
  );

  return indiaTime
    .toISOString()
    .slice(0, 10);
}

function addDays(
  dateString: string,
  amount: number
): string {
  const date = new Date(
    `${dateString}T00:00:00Z`
  );

  date.setUTCDate(
    date.getUTCDate() + amount
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function getIndiaDateFromTimestamp(
  timestamp: string
): string {
  const date = new Date(timestamp);

  /*
    Supabase stores created_at in UTC.

    Add 5 hours 30 minutes to convert
    the timestamp to India Standard Time.
  */
  const indiaTime = new Date(
    date.getTime() +
      5.5 * 60 * 60 * 1000
  );

  return indiaTime
    .toISOString()
    .slice(0, 10);
}

function getDayLabel(dateString: string) {
  const date = new Date(
    `${dateString}T00:00:00Z`
  );

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}

function getDifficultyXp(
  difficulty: Task["difficulty"]
) {
  switch (difficulty) {
    case "easy":
      return 10;

    case "medium":
      return 20;

    case "hard":
      return 35;

    case "boss":
      return 75;

    default:
      return 0;
  }
}

export default function StatsPage() {
  const router = useRouter();

  const [lifetimeXp, setLifetimeXp] = useState(0);
  const [coins, setCoins] = useState(0);
  const [currentStreak, setCurrentStreak] =
    useState(0);
  const [longestStreak, setLongestStreak] =
    useState(0);

  const [totalTasksCompleted, setTotalTasksCompleted] =
    useState(0);

  const [sevenDayXp, setSevenDayXp] = useState(0);

  const [sevenDayStats, setSevenDayStats] =
    useState<DayStat[]>([]);

  const [loading, setLoading] = useState(true);

  async function loadStats() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    /*
      ============================
      PROFILE
      ============================
    */

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "lifetime_xp, current_streak, longest_streak"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Profile error:",
        profileError
      );
    }

    setLifetimeXp(
      Number(profile?.lifetime_xp ?? 0)
    );

    setCurrentStreak(
      Number(profile?.current_streak ?? 0)
    );

    setLongestStreak(
      Number(profile?.longest_streak ?? 0)
    );

    /*
      ============================
      COINS
      ============================
    */

    const {
      data: coinTransactions,
      error: coinError,
    } = await supabase
      .from("coin_transactions")
      .select("amount")
      .eq("user_id", user.id);

    if (coinError) {
      console.error(
        "Coin error:",
        coinError
      );
    }

    const coinBalance =
      coinTransactions?.reduce(
        (total, transaction) =>
          total +
          Number(transaction.amount),
        0
      ) ?? 0;

    setCoins(coinBalance);

    /*
      ============================
      TASKS
      ============================
    */

    const {
      data: userTasks,
      error: tasksError,
    } = await supabase
      .from("tasks")
      .select("id, difficulty")
      .eq("user_id", user.id)
      .neq("status", "cancelled");

    if (tasksError) {
      console.error(
        "Tasks error:",
        tasksError
      );
    }

    const tasks: Task[] =
      userTasks ?? [];

    const taskMap = new Map<
      string,
      Task
    >();

    tasks.forEach((task) => {
      taskMap.set(task.id, task);
    });

    /*
      ============================
      COMPLETED TASKS
      ============================
    */

    const {
      data: completions,
      error: completionsError,
    } = await supabase
      .from("task_completions")
      .select("id")
      .eq("user_id", user.id);

    if (completionsError) {
      console.error(
        "Completions error:",
        completionsError
      );
    }

    setTotalTasksCompleted(
      completions?.length ?? 0
    );

    /*
      ============================
      LAST 7 INDIA DAYS
      ============================
    */

    const today = getIndiaToday();

    const dates: string[] = [];

    for (let i = 6; i >= 0; i--) {
      dates.push(
        addDays(today, -i)
      );
    }

    const firstDate = dates[0];
    const lastDate = dates[6];

    console.log(
      "Stats date range:",
      firstDate,
      "to",
      lastDate
    );

    /*
      ============================
      PLANNED XP
      ============================
    */

    const {
      data: taskDays,
      error: taskDaysError,
    } = await supabase
      .from("task_days")
      .select(
        "task_id, planned_date"
      )
      .gte(
        "planned_date",
        firstDate
      )
      .lte(
        "planned_date",
        lastDate
      );

    if (taskDaysError) {
      console.error(
        "Task days error:",
        taskDaysError
      );
    }

    const plannedByDate = new Map<
      string,
      number
    >();

    taskDays?.forEach(
      (taskDay) => {
        const task = taskMap.get(
          taskDay.task_id
        );

        if (!task) {
          return;
        }

        const xp =
          getDifficultyXp(
            task.difficulty
          );

        plannedByDate.set(
          taskDay.planned_date,
          (plannedByDate.get(
            taskDay.planned_date
          ) ?? 0) + xp
        );
      }
    );

    /*
      ============================
      ACTUAL XP
      ============================

      xp_transactions is the source
      of truth for earned XP.
    */

    const {
      data: xpTransactions,
      error: xpError,
    } = await supabase
      .from("xp_transactions")
      .select(
        "amount, created_at, source_type"
      )
      .eq("user_id", user.id);

    if (xpError) {
      console.error(
        "XP transaction error:",
        xpError
      );
    }

    console.log(
      "Stats XP transactions:",
      xpTransactions
    );

    const earnedByDate = new Map<
      string,
      number
    >();

    xpTransactions?.forEach(
      (transaction) => {
        const indiaDate =
          getIndiaDateFromTimestamp(
            transaction.created_at
          );

        console.log(
          "XP transaction:",
          transaction.amount,
          transaction.source_type,
          transaction.created_at,
          "=> India date:",
          indiaDate
        );

        if (
          indiaDate < firstDate ||
          indiaDate > lastDate
        ) {
          return;
        }

        const current =
          earnedByDate.get(
            indiaDate
          ) ?? 0;

        earnedByDate.set(
          indiaDate,
          current +
            Number(
              transaction.amount
            )
        );
      }
    );

    /*
      ============================
      BUILD 7-DAY STATS
      ============================
    */

    const stats: DayStat[] =
      dates.map((date) => ({
        date,
        label:
          getDayLabel(date),
        plannedXp:
          plannedByDate.get(
            date
          ) ?? 0,
        earnedXp:
          earnedByDate.get(
            date
          ) ?? 0,
      }));

    console.log(
      "Final Stats:",
      stats
    );

    setSevenDayStats(stats);

    setSevenDayXp(
      stats.reduce(
        (total, day) =>
          total +
          day.earnedXp,
        0
      )
    );

    setLoading(false);
  }

  useEffect(() => {
    loadStats();
  }, [router]);

  const maxChartXp =
    Math.max(
      ...sevenDayStats.flatMap(
        (day) => [
          day.plannedXp,
          day.earnedXp,
        ]
      ),
      1
    );

  return (
    <main className="min-h-screen bg-[#fff8fb] text-slate-800">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28">

        {/* Header */}
        <header className="flex items-center gap-3 pt-7">
          <button
            onClick={() =>
              router.push("/")
            }
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
              Your Progress
            </p>

            <h1 className="text-2xl font-bold text-slate-900">
              Stats 📊
            </h1>
          </div>
        </header>

        {/* Main Stats */}
        <section className="mt-6 grid grid-cols-2 gap-3">

          {/* Lifetime XP */}
          <div className="rounded-3xl bg-gradient-to-br from-pink-100 to-purple-100 p-5 shadow-sm ring-1 ring-pink-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lifetime XP
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading
                ? "..."
                : lifetimeXp.toLocaleString()}
            </p>
          </div>

          {/* Coins */}
          <div className="rounded-3xl bg-gradient-to-br from-orange-50 to-yellow-50 p-5 shadow-sm ring-1 ring-orange-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80">
              <Coins className="h-5 w-5 text-orange-400" />
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Coins
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading
                ? "..."
                : coins.toLocaleString()}
            </p>
          </div>

          {/* Current Streak */}
          <div className="rounded-3xl bg-gradient-to-br from-orange-50 to-pink-50 p-5 shadow-sm ring-1 ring-orange-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80">
              <Flame className="h-5 w-5 fill-orange-400 text-orange-400" />
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Current Streak
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading
                ? "..."
                : currentStreak}

              <span className="ml-1 text-sm font-medium text-slate-400">
                days
              </span>
            </p>
          </div>

          {/* Longest Streak */}
          <div className="rounded-3xl bg-gradient-to-br from-purple-50 to-blue-50 p-5 shadow-sm ring-1 ring-purple-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80">
              <Trophy className="h-5 w-5 text-purple-500" />
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Longest Streak
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {loading
                ? "..."
                : longestStreak}

              <span className="ml-1 text-sm font-medium text-slate-400">
                days
              </span>
            </p>
          </div>
        </section>

        {/* Task Summary */}
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
                All Time
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Task Progress
              </h2>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50">
              <ListTodo className="h-5 w-5 text-pink-500" />
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900">
                {loading
                  ? "..."
                  : totalTasksCompleted}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                tasks completed
              </p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold text-purple-500">
                {loading
                  ? "..."
                  : sevenDayXp}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                XP this week
              </p>
            </div>
          </div>
        </section>

        {/* XP Activity */}
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
              Last 7 Days
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              XP Activity
            </h2>
          </div>

          <div className="mt-6 space-y-4">
            {sevenDayStats.map(
              (day) => {
                const plannedWidth =
                  Math.max(
                    (day.plannedXp /
                      maxChartXp) *
                      100,
                    day.plannedXp >
                      0
                      ? 3
                      : 0
                  );

                const earnedWidth =
                  Math.max(
                    (day.earnedXp /
                      maxChartXp) *
                      100,
                    day.earnedXp >
                      0
                      ? 3
                      : 0
                  );

                const target =
                  day.plannedXp >
                  0
                    ? Math.floor(
                        day.plannedXp *
                          0.8
                      )
                    : 0;

                const goalReached =
                  target > 0 &&
                  day.earnedXp >=
                    target;

                return (
                  <div
                    key={
                      day.date
                    }
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="w-10 text-xs font-semibold text-slate-500">
                        {day.label}
                      </span>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-400">
                          {
                            day.earnedXp
                          }{" "}
                          /{" "}
                          {
                            day.plannedXp
                          }{" "}
                          XP
                        </span>

                        {goalReached && (
                          <span className="font-semibold text-green-500">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      {/* Planned */}
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-200"
                          style={{
                            width: `${plannedWidth}%`,
                          }}
                        />
                      </div>

                      {/* Earned */}
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-pink-400 transition-all duration-500"
                          style={{
                            width: `${earnedWidth}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-5 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-5 rounded-full bg-slate-200" />
              Planned
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-5 rounded-full bg-pink-400" />
              Earned
            </div>
          </div>
        </section>

        {/* Streak Explanation */}
        <section className="mt-5 rounded-3xl bg-gradient-to-br from-orange-50 to-pink-50 p-5 ring-1 ring-orange-100">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80">
              <Flame className="h-5 w-5 fill-orange-400 text-orange-400" />
            </div>

            <div>
              <p className="font-bold text-slate-900">
                Keep your streak alive 🔥
              </p>

              <p className="mt-1 text-sm leading-5 text-slate-500">
                Reach at least 80%
                of your planned XP
                on a planned day to
                count it toward your
                streak.
              </p>

              <p className="mt-2 text-xs font-medium text-slate-400">
                Days with no planned
                tasks are simply
                ignored.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-3 py-3">

          <NavItem
            icon={<HomeIcon />}
            label="Home"
            onClick={() =>
              router.push("/")
            }
          />

          <NavItem
            icon={<ListTodo />}
            label="Week"
            onClick={() =>
              router.push(
                "/week"
              )
            }
          />

          <button
            onClick={() =>
              router.push(
                "/add"
              )
            }
            className="flex h-14 w-14 -translate-y-5 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg shadow-pink-200 transition hover:scale-105 active:scale-95"
            aria-label="Add task"
          >
            <span className="text-3xl font-light leading-none">
              +
            </span>
          </button>

          <NavItem
            icon={<BarChart3 />}
            label="Stats"
            active
            onClick={() =>
              router.push(
                "/stats"
              )
            }
          />

          <NavItem
            icon={<ShoppingBag />}
            label="Rewards"
            onClick={() =>
              router.push(
                "/rewards"
              )
            }
          />
        </div>
      </nav>
    </main>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-[58px] flex-col items-center gap-1 text-xs font-medium transition ${
        active
          ? "text-pink-500"
          : "text-slate-400 hover:text-pink-400"
      }`}
    >
      <div className="h-5 w-5">
        {icon}
      </div>

      <span>{label}</span>
    </button>
  );
}