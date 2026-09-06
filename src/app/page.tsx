"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronRight,
  Flame,
  Gift,
  Home as HomeIcon,
  ListTodo,
  Plus,
  ShoppingBag,
  Sparkles,
  Star,
  Play,
  Square,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getReward } from "@/lib/rewards";

const supabase = createClient();

type Task = {
  id: string;
  title: string;
  task_type: "timed" | "completion";
  category: string;
  subject: string | null;
  target_value: number | null;
  measurement_unit: string | null;
  difficulty: "easy" | "medium" | "hard" | "boss";
  status: string;
  progress_seconds: number;
};

type ActiveSession = {
  taskId: string;
  sessionId: string;
  startedAt: string;
};

export default function Home() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [level, setLevel] = useState(1);
  const [lifetimeXp, setLifetimeXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [coins, setCoins] = useState(0);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);

  const [activeSession, setActiveSession] =
    useState<ActiveSession | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionTaskId, setActionTaskId] =
    useState<string | null>(null);

  const [dailyTarget, setDailyTarget] = useState(0);
  const [dailyEarnedXp, setDailyEarnedXp] = useState(0);
  const [dailyGoalReached, setDailyGoalReached] = useState(false);

  function getTodayString() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatDuration(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }

  function formatTarget(minutes: number | null) {
    if (!minutes) return "";

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0 && remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }

    if (hours > 0) {
      return `${hours}h`;
    }

    return `${remainingMinutes} min`;
  }

  async function refreshStreak() {
    const { data, error } =
      await supabase.rpc("update_user_streak");

    if (error) {
      console.error("Streak error:", error);
      return;
    }

    if (data) {
      setStreak(data.current_streak ?? 0);
    }
  }

  async function refreshDailyGoal() {
    const todayString = getTodayString();

    const {
      data: dailyGoal,
      error: dailyGoalError,
    } = await supabase.rpc("check_daily_goal", {
      p_date: todayString,
    });

    if (dailyGoalError) {
      console.error(
        "Daily goal error:",
        dailyGoalError
      );
      return;
    }

    if (!dailyGoal) {
      return;
    }

    setDailyTarget(dailyGoal.daily_target ?? 0);
    setDailyEarnedXp(dailyGoal.earned_xp ?? 0);
    setDailyGoalReached(
      dailyGoal.goal_reached ?? false
    );

    if (dailyGoal.bonus_awarded) {
      setLifetimeXp((current) => current + 25);
      setCoins((current) => current + 10);
    }
  }

  async function loadHome() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    // Load profile
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select(
          "display_name, lifetime_xp, current_level, current_streak"
        )
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.error("Profile error:", profileError);
      setLoading(false);
      return;
    }

    if (!profile || !profile.display_name) {
      router.replace("/setup");
      return;
    }

    setDisplayName(profile.display_name);
    setLifetimeXp(profile.lifetime_xp ?? 0);
    setLevel(profile.current_level ?? 1);
    setStreak(profile.current_streak ?? 0);

    // Load coin balance
    const { data: coinTransactions, error: coinError } =
      await supabase
        .from("coin_transactions")
        .select("amount")
        .eq("user_id", user.id);

    if (coinError) {
      console.error("Coin error:", coinError);
    } else {
      const balance =
        coinTransactions?.reduce(
          (total, transaction) =>
            total + transaction.amount,
          0
        ) ?? 0;

      setCoins(balance);
    }

    // Update streak from the authenticated user session
    await refreshStreak();

    // Check daily goal and award daily bonus
    await refreshDailyGoal();

    const todayString = getTodayString();

    // Find tasks planned for today
    const { data: taskDays, error: taskDaysError } =
      await supabase
        .from("task_days")
        .select("task_id, progress_seconds")
        .eq("planned_date", todayString);

    if (taskDaysError) {
      console.error("Task days error:", taskDaysError);
      setLoading(false);
      return;
    }

    const taskIds =
      taskDays?.map((item) => item.task_id) ?? [];

    if (taskIds.length === 0) {
      setTasks([]);
      setCompletedTaskIds([]);
      setActiveSession(null);
      setLoading(false);
      return;
    }

    // Map today's progress by task
    const progressMap = new Map<string, number>();

    taskDays?.forEach((item) => {
      progressMap.set(
        item.task_id,
        item.progress_seconds ?? 0
      );
    });

    // Load actual tasks
    const { data: todayTasks, error: tasksError } =
      await supabase
        .from("tasks")
        .select(
          "id, title, task_type, category, subject, target_value, measurement_unit, difficulty, status"
        )
        .eq("user_id", user.id)
        .in("id", taskIds)
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });

    if (tasksError) {
      console.error("Tasks error:", tasksError);
      setLoading(false);
      return;
    }

    const tasksWithProgress: Task[] =
      (todayTasks ?? []).map((task) => ({
        ...task,
        progress_seconds:
          progressMap.get(task.id) ?? 0,
      }));

    setTasks(tasksWithProgress);

    // Load today's completion records
    const {
      data: completions,
      error: completionError,
    } = await supabase
      .from("task_completions")
      .select("task_id")
      .eq("user_id", user.id)
      .eq("completed_date", todayString)
      .in("task_id", taskIds);

    if (completionError) {
      console.error(
        "Completion error:",
        completionError
      );
    } else {
      setCompletedTaskIds(
        completions?.map((item) => item.task_id) ?? []
      );
    }

    // Find an active timed session
    const {
      data: openSession,
      error: sessionError,
    } = await supabase
      .from("task_sessions")
      .select("id, task_id, started_at")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      console.error(
        "Active session error:",
        sessionError
      );
    }

    if (openSession) {
      setActiveSession({
        taskId: openSession.task_id,
        sessionId: openSession.id,
        startedAt: openSession.started_at,
      });
    } else {
      setActiveSession(null);
      setElapsedSeconds(0);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadHome();
  }, [router]);

  // Keep the visible timer running.
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }

    function updateTimer() {
      if (!activeSession) {
        setElapsedSeconds(0);
        return;
      }

      const started = new Date(
        activeSession.startedAt
      ).getTime();

      const now = Date.now();

      setElapsedSeconds(
        Math.max(
          0,
          Math.floor((now - started) / 1000)
        )
      );
    }

    updateTimer();

    const interval = window.setInterval(
      updateTimer,
      1000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [activeSession]);

  async function startTimedTask(task: Task) {
    if (activeSession) {
      return;
    }

    setActionTaskId(task.id);

    const { data, error } = await supabase.rpc(
      "start_timed_task",
      {
        p_task_id: task.id,
      }
    );

    if (error) {
      console.error(
        "Start timed task error:",
        error
      );
      setActionTaskId(null);
      return;
    }

    if (!data?.success) {
      console.error(
        "Start timed task failed:",
        data
      );
      setActionTaskId(null);
      return;
    }

    setActiveSession({
      taskId: task.id,
      sessionId: data.session_id,
      startedAt: data.started_at,
    });

    setActionTaskId(null);
  }

  async function stopTimedTask(task: Task) {
    if (
      !activeSession ||
      activeSession.taskId !== task.id
    ) {
      return;
    }

    setActionTaskId(task.id);

    const { data, error } = await supabase.rpc(
      "stop_timed_task",
      {
        p_task_id: task.id,
      }
    );

    if (error) {
      console.error(
        "Stop timed task error:",
        error
      );
      setActionTaskId(null);
      return;
    }

    if (!data?.success) {
      console.error(
        "Stop timed task failed:",
        data
      );
      setActionTaskId(null);
      return;
    }

    setActiveSession(null);
    setElapsedSeconds(0);

    // Refresh task progress, rewards, daily goal and streak.
    await loadHome();

    setActionTaskId(null);
  }

  async function toggleCompletionTask(task: Task) {
    if (completedTaskIds.includes(task.id)) {
      return;
    }

    setActionTaskId(task.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const todayString = getTodayString();

    const { data, error } = await supabase.rpc(
      "complete_task_for_date",
      {
        p_task_id: task.id,
        p_completed_date: todayString,
      }
    );

    if (error) {
      console.error(
        "Completion/reward error:",
        error
      );
      setActionTaskId(null);
      return;
    }

    if (!data?.success) {
      console.error(
        "Completion failed:",
        data
      );
      setActionTaskId(null);
      return;
    }

    if (!data.already_completed) {
      setCompletedTaskIds((current) => [
        ...current,
        task.id,
      ]);

      setLifetimeXp(
        (current) => current + (data.xp ?? 0)
      );

      setCoins(
        (current) => current + (data.coins ?? 0)
      );
    }

    // Refresh daily goal.
    await refreshDailyGoal();

    // Refresh streak immediately.
    await refreshStreak();

    setActionTaskId(null);
  }

  const completedCount = tasks.filter((task) => {
    if (task.task_type === "timed") {
      return (
        task.target_value !== null &&
        task.progress_seconds >=
          task.target_value * 60
      );
    }

    return completedTaskIds.includes(task.id);
  }).length;

  const totalTasks = tasks.length;

  const xpProgress =
    dailyTarget > 0
      ? Math.min(
          (dailyEarnedXp / dailyTarget) * 100,
          100
        )
      : 0;

  const levelProgress = Math.min(
    ((lifetimeXp % 100) / 100) * 100,
    100
  );

  const biriyaniProgress = Math.min(
    (coins / 2000) * 100,
    100
  );

  return (
    <main className="min-h-screen bg-[#fff8fb] text-slate-800">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28">

        {/* Header */}
        <header className="flex items-center justify-between pt-7">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {new Date().toLocaleDateString(
                "en-IN",
                {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                }
              )}
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Hey, {loading ? "..." : displayName} 🌸
            </h1>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-pink-100">
            <Sparkles className="h-5 w-5 text-pink-500" />
          </div>
        </header>

        {/* Player Card */}
        <section className="mt-6 rounded-3xl bg-gradient-to-br from-pink-100 via-purple-50 to-white p-5 shadow-sm ring-1 ring-pink-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
                Your Journey
              </p>

              <div className="mt-1 flex items-center gap-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />

                <span className="text-2xl font-bold text-slate-900">
                  Level {level}
                </span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">
                Lifetime XP
              </p>

              <p className="font-bold text-slate-800">
                {lifetimeXp.toLocaleString()} XP
              </p>
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all duration-500"
              style={{
                width: `${levelProgress}%`,
              }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5">
              <Flame className="h-4 w-4 fill-orange-400 text-orange-400" />

              <span className="text-sm font-semibold">
                {streak} day streak
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5">
              <span className="text-base">🪙</span>

              <span className="text-sm font-semibold">
                {coins.toLocaleString()}
              </span>
            </div>
          </div>
        </section>

        {/* Daily Progress */}
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                TODAY&apos;S QUEST
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Daily Progress 🎯
              </h2>
            </div>

            <div className="rounded-2xl bg-pink-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-pink-600">
                {dailyEarnedXp}
              </p>

              <p className="text-[10px] font-medium text-pink-400">
                / {dailyTarget} XP
              </p>
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-pink-400 transition-all duration-500"
              style={{
                width: `${xpProgress}%`,
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              {completedCount} of {totalTasks} tasks complete
            </span>

            {dailyGoalReached ? (
              <span className="font-semibold text-green-600">
                Goal complete! ✨
              </span>
            ) : (
              <span className="font-medium text-pink-500">
                Keep going 💪
              </span>
            )}
          </div>
        </section>

        {/* Today's Tasks */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              Today&apos;s Tasks
            </h2>

            <button
              onClick={() => router.push("/week")}
              className="flex items-center gap-1 text-sm font-semibold text-pink-500"
            >
              See all
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pink-50">
                <Sparkles className="h-6 w-6 text-pink-400" />
              </div>

              <h3 className="mt-3 font-bold text-slate-800">
                No quests today 🌷
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Enjoy a lighter day or add something new.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const isTimed =
                  task.task_type === "timed";

                const targetSeconds =
                  (task.target_value ?? 0) * 60;

                const dayCompleted =
                  isTimed &&
                  targetSeconds > 0 &&
                  task.progress_seconds >=
                    targetSeconds;

                const completionCompleted =
                  !isTimed &&
                  completedTaskIds.includes(task.id);

                const completed =
                  dayCompleted ||
                  completionCompleted;

                const isActive =
                  activeSession !== null &&
                  activeSession.taskId === task.id;

                const isBusy =
                  actionTaskId === task.id;

                const taskReward =
                  task.difficulty === "boss"
                    ? { xp: 75, coins: 25 }
                    : getReward(task.difficulty);

                let subtitle = "";

                if (isTimed) {
                  subtitle = formatTarget(
                    task.target_value
                  );

                  if (task.subject) {
                    subtitle = `${task.subject} · ${subtitle}`;
                  }

                  subtitle = `${subtitle} · ${task.difficulty}`;
                } else {
                  subtitle = `${task.category} · ${task.difficulty}`;
                }

                if (isTimed) {
                  const savedSeconds =
                    task.progress_seconds;

                  const visibleSeconds =
                    isActive && activeSession
                      ? Math.min(
                          savedSeconds +
                            elapsedSeconds,
                          targetSeconds
                        )
                      : Math.min(
                          savedSeconds,
                          targetSeconds
                        );

                  const progressPercent =
                    targetSeconds > 0
                      ? Math.min(
                          (visibleSeconds /
                            targetSeconds) *
                            100,
                          100
                        )
                      : 0;

                  return (
                    <div
                      key={task.id}
                      className={`rounded-3xl bg-white p-4 shadow-sm ring-1 transition ${
                        completed
                          ? "ring-green-100"
                          : isActive
                            ? "ring-pink-200"
                            : "ring-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            completed
                              ? "bg-green-100 text-green-600"
                              : isActive
                                ? "bg-pink-100 text-pink-500"
                                : "bg-pink-50 text-pink-500"
                          }`}
                        >
                          {completed ? (
                            <Check
                              className="h-5 w-5"
                              strokeWidth={3}
                            />
                          ) : (
                            <Play className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-semibold ${
                              completed
                                ? "text-slate-400"
                                : "text-slate-800"
                            }`}
                          >
                            {task.title}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {subtitle}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-purple-500">
                            +{taskReward.xp} XP
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            +{taskReward.coins} 🪙
                          </p>
                        </div>
                      </div>

                      {/* Timed progress */}
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-500">
                            {formatDuration(
                              visibleSeconds
                            )}
                          </span>

                          <span className="text-slate-400">
                            {formatTarget(
                              task.target_value
                            )}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all duration-300"
                            style={{
                              width: `${progressPercent}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Start / Stop */}
                      <div className="mt-4">
                        {completed ? (
                          <div className="flex items-center justify-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-600">
                            <Check className="h-4 w-4" />
                            Today&apos;s target complete
                          </div>
                        ) : isActive ? (
                          <button
                            onClick={() =>
                              stopTimedTask(task)
                            }
                            disabled={isBusy}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-pink-600 disabled:cursor-wait disabled:opacity-60"
                          >
                            <Square
                              className="h-4 w-4 fill-current"
                            />

                            {isBusy
                              ? "Stopping..."
                              : "Stop Timer"}
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              startTimedTask(task)
                            }
                            disabled={
                              isBusy ||
                              activeSession !== null
                            }
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Play className="h-4 w-4 fill-current" />

                            {isBusy
                              ? "Starting..."
                              : activeSession
                                ? "Another timer is running"
                                : "Start Timer"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                // Completion quest
                return (
                  <button
                    key={task.id}
                    onClick={() =>
                      toggleCompletionTask(task)
                    }
                    disabled={
                      completed || isBusy
                    }
                    className={`flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 transition ${
                      completed
                        ? "ring-green-100"
                        : "ring-slate-100 hover:ring-pink-200"
                    } ${
                      isBusy
                        ? "cursor-wait opacity-70"
                        : ""
                    }`}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                        completed
                          ? "bg-green-100 text-green-600"
                          : "bg-pink-50 text-pink-500"
                      }`}
                    >
                      {completed ? (
                        <Check
                          className="h-5 w-5"
                          strokeWidth={3}
                        />
                      ) : (
                        <ListTodo className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-semibold ${
                          completed
                            ? "text-slate-400 line-through"
                            : "text-slate-800"
                        }`}
                      >
                        {task.title}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {subtitle}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-purple-500">
                        +{taskReward.xp} XP
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        +{taskReward.coins} 🪙
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Daily Goal */}
        <section className="mt-6 rounded-3xl bg-gradient-to-r from-purple-100 to-pink-100 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80">
              <Gift className="h-6 w-6 text-purple-500" />
            </div>

            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-500">
                Daily Reward
              </p>

              <h3 className="mt-1 font-bold text-slate-900">
                Hit your daily target
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                Complete your target and earn{" "}
                <span className="font-bold text-purple-600">
                  +25 XP
                </span>{" "}
                and{" "}
                <span className="font-bold text-purple-600">
                  +10 🪙
                </span>
              </p>

              {dailyGoalReached && (
                <p className="mt-3 text-sm font-bold text-green-600">
                  Daily bonus earned! ✨
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Biriyani */}
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
                Ultimate Reward
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                🍗 Biriyani
              </h2>
            </div>

            <span className="text-2xl">✨</span>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <p className="text-sm text-slate-500">
              Your progress
            </p>

            <p className="font-bold text-slate-800">
              {coins.toLocaleString()} / 2,000 🪙
            </p>
          </div>

          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-300 to-pink-400 transition-all duration-500"
              style={{
                width: `${biriyaniProgress}%`,
              }}
            />
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Keep going — your biriyani is getting closer! 💕
          </p>
        </section>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-3 py-3">
          <NavItem
            icon={<HomeIcon />}
            label="Home"
            active
            onClick={() => router.push("/")}
          />

          <NavItem
            icon={<ListTodo />}
            label="Week"
            onClick={() => router.push("/week")}
          />

          <button
            onClick={() => router.push("/add")}
            className="flex h-14 w-14 -translate-y-5 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg shadow-pink-200 transition hover:scale-105 active:scale-95"
            aria-label="Add task"
          >
            <Plus
              className="h-7 w-7"
              strokeWidth={2.5}
            />
          </button>

          <NavItem
            icon={<BarChart3 />}
            label="Stats"
            onClick={() => router.push("/stats")}
          />

          <NavItem
            icon={<ShoppingBag />}
            label="Rewards"
            onClick={() => router.push("/rewards")}
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
      <div className="h-5 w-5">{icon}</div>
      <span>{label}</span>
    </button>
  );
}