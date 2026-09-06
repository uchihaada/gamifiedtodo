

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Home as HomeIcon,
  ListTodo,
  Plus,
  ShoppingBag,
  Sparkles,
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
};

type DayData = {
  date: string;
  label: string;
  dayNumber: number;
  tasks: Task[];
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getMonday(date = new Date()) {
  const result = new Date(date);
  const day = result.getDay();

  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);
  result.setHours(0, 0, 0, 0);

  return result;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatDateRange(start: Date, end: Date) {
  const startText = start.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  const endText = end.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${startText} – ${endText}`;
}

function getTaskReward(task: Task) {
  if (task.difficulty === "boss") {
    return {
      xp: 75,
      coins: 25,
    };
  }

  return getReward(task.difficulty);
}

function getTaskSubtitle(task: Task) {
  if (task.task_type === "timed") {
    let subtitle = "";

    if (
      task.target_value &&
      task.measurement_unit === "minutes"
    ) {
      const hours = Math.floor(task.target_value / 60);
      const minutes = task.target_value % 60;

      if (hours > 0 && minutes > 0) {
        subtitle = `${hours}h ${minutes}m`;
      } else if (hours > 0) {
        subtitle = `${hours}h`;
      } else {
        subtitle = `${minutes} min`;
      }
    } else {
      subtitle = task.category;
    }

    if (task.subject) {
      subtitle = `${task.subject} · ${subtitle}`;
    }

    return `${subtitle} · ${task.difficulty}`;
  }

  return `${task.category} · ${task.difficulty}`;
}

export default function WeekPage() {
  const router = useRouter();

  const [currentMonday, setCurrentMonday] = useState(
    getMonday()
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskDates, setTaskDates] = useState<
    Record<string, string[]>
  >({});

  const [completedDates, setCompletedDates] = useState<
    Record<string, string[]>
  >({});

  const [loading, setLoading] = useState(true);

  const today = getLocalDateString();

  const weekStart = getLocalDateString(currentMonday);
  const weekEnd = getLocalDateString(
    addDays(currentMonday, 6)
  );

  const days = useMemo<DayData[]>(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(currentMonday, index);
      const dateString = getLocalDateString(date);

      return {
        date: dateString,
        label: date.toLocaleDateString("en-IN", {
          weekday: "short",
        }),
        dayNumber: date.getDate(),
        tasks: tasks.filter((task) =>
          taskDates[task.id]?.includes(dateString)
        ),
      };
    });
  }, [currentMonday, tasks, taskDates]);

  async function loadWeek() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: weekTasks, error: taskError } =
      await supabase
        .from("tasks")
        .select(
          "id, title, task_type, category, subject, target_value, measurement_unit, difficulty, status"
        )
        .eq("user_id", user.id)
        .neq("status", "cancelled");

    if (taskError) {
      console.error("Week tasks error:", taskError);
      setLoading(false);
      return;
    }

    const taskList = (weekTasks ?? []) as Task[];

    setTasks(taskList);

    const taskIds = taskList.map((task) => task.id);

    if (taskIds.length === 0) {
      setTaskDates({});
      setCompletedDates({});
      setLoading(false);
      return;
    }

    const { data: plannedDays, error: daysError } =
      await supabase
        .from("task_days")
        .select("task_id, planned_date")
        .in("task_id", taskIds)
        .gte("planned_date", weekStart)
        .lte("planned_date", weekEnd);

    if (daysError) {
      console.error("Week task days error:", daysError);
      setLoading(false);
      return;
    }

    const datesMap: Record<string, string[]> = {};

    for (const row of plannedDays ?? []) {
      if (!datesMap[row.task_id]) {
        datesMap[row.task_id] = [];
      }

      datesMap[row.task_id].push(row.planned_date);
    }

    setTaskDates(datesMap);

    const { data: completions, error: completionError } =
      await supabase
        .from("task_completions")
        .select("task_id, completed_date")
        .in("task_id", taskIds)
        .gte("completed_date", weekStart)
        .lte("completed_date", weekEnd);

    if (completionError) {
      console.error(
        "Week completion error:",
        completionError
      );
      setLoading(false);
      return;
    }

    const completedMap: Record<string, string[]> = {};

    for (const row of completions ?? []) {
      if (!completedMap[row.task_id]) {
        completedMap[row.task_id] = [];
      }

      completedMap[row.task_id].push(row.completed_date);
    }

    setCompletedDates(completedMap);
    setLoading(false);
  }

  useEffect(() => {
    loadWeek();
  }, [weekStart, weekEnd]);

  function moveWeek(amount: number) {
    setCurrentMonday((current) =>
      addDays(current, amount * 7)
    );
  }

  function goToCurrentWeek() {
    setCurrentMonday(getMonday());
  }

  const totalPlannedXp = days.reduce(
    (total, day) =>
      total +
      day.tasks.reduce(
        (dayTotal, task) =>
          dayTotal + getTaskReward(task).xp,
        0
      ),
    0
  );

  const totalCompletedXp = days.reduce(
    (total, day) =>
      total +
      day.tasks.reduce((dayTotal, task) => {
        const completed = completedDates[task.id]?.includes(
          day.date
        );

        return completed
          ? dayTotal + getTaskReward(task).xp
          : dayTotal;
      }, 0),
    0
  );

  return (
    <main className="min-h-screen bg-[#fff8fb] text-slate-800">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28">
        <header className="pt-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-pink-500">
                Weekly Plan
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Your Week
              </h1>
            </div>

            <button
              onClick={() => router.push("/add")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-pink-500 text-white shadow-md shadow-pink-200"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <button
                onClick={() => moveWeek(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="text-center">
                <p className="font-bold text-slate-900">
                  {formatDateRange(
                    currentMonday,
                    addDays(currentMonday, 6)
                  )}
                </p>

                {weekStart ===
                getLocalDateString(getMonday()) ? (
                  <p className="mt-1 text-xs font-medium text-pink-500">
                    Current week
                  </p>
                ) : (
                  <button
                    onClick={goToCurrentWeek}
                    className="mt-1 text-xs font-semibold text-pink-500"
                  >
                    Back to current week
                  </button>
                )}
              </div>

              <button
                onClick={() => moveWeek(1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-pink-50 p-3">
                <p className="text-xs text-slate-500">
                  Planned XP
                </p>
                <p className="mt-1 text-lg font-bold text-pink-600">
                  {totalPlannedXp}
                </p>
              </div>

              <div className="rounded-2xl bg-purple-50 p-3">
                <p className="text-xs text-slate-500">
                  Earned XP
                </p>
                <p className="mt-1 text-lg font-bold text-purple-600">
                  {totalCompletedXp}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6">
          {loading ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
              <Sparkles className="mx-auto h-6 w-6 animate-pulse text-pink-400" />
              <p className="mt-3 text-sm text-slate-400">
                Loading your week...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {days.map((day) => {
                const isToday = day.date === today;
                const isPast = day.date < today;

                return (
                  <section
                    key={day.date}
                    className={`rounded-3xl bg-white p-4 shadow-sm ring-1 ${
                      isToday
                        ? "ring-pink-200"
                        : "ring-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-12 w-12 flex-col items-center justify-center rounded-2xl ${
                            isToday
                              ? "bg-pink-500 text-white"
                              : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase">
                            {day.label}
                          </span>

                          <span className="text-lg font-bold">
                            {day.dayNumber}
                          </span>
                        </div>

                        <div>
                          <p className="font-bold text-slate-900">
                            {isToday
                              ? "Today"
                              : day.label}
                          </p>

                          <p className="text-xs text-slate-400">
                            {day.tasks.length}{" "}
                            {day.tasks.length === 1
                              ? "quest"
                              : "quests"}
                          </p>
                        </div>
                      </div>

                      {isPast && (
                        <span className="text-xs font-medium text-slate-300">
                          Past
                        </span>
                      )}
                    </div>

                    {day.tasks.length === 0 ? (
                      <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-center">
                        <p className="text-sm text-slate-400">
                          No quests planned
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {day.tasks.map((task) => {
                          const completed =
                            completedDates[task.id]?.includes(
                              day.date
                            );

                          const reward = getTaskReward(task);

                          return (
                            <div
                              key={`${task.id}-${day.date}`}
                              className={`flex items-center gap-3 rounded-2xl p-3 ${
                                completed
                                  ? "bg-green-50"
                                  : "bg-slate-50"
                              }`}
                            >
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                  completed
                                    ? "bg-green-100 text-green-600"
                                    : "bg-white text-pink-500"
                                }`}
                              >
                                {completed ? (
                                  <Check
                                    className="h-4 w-4"
                                    strokeWidth={3}
                                  />
                                ) : (
                                  <ListTodo className="h-4 w-4" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p
                                  className={`truncate text-sm font-semibold ${
                                    completed
                                      ? "text-slate-400 line-through"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {task.title}
                                </p>

                                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                  {getTaskSubtitle(task)}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-xs font-bold text-purple-500">
                                  +{reward.xp} XP
                                </p>

                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  {completed
                                    ? "Earned"
                                    : "Available"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-3 py-3">
          <button
            onClick={() => router.push("/")}
            className="flex min-w-[58px] flex-col items-center gap-1 text-xs font-medium text-slate-400"
          >
            <HomeIcon className="h-5 w-5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => router.push("/week")}
            className="flex min-w-[58px] flex-col items-center gap-1 text-xs font-medium text-pink-500"
          >
            <ListTodo className="h-5 w-5" />
            <span>Week</span>
          </button>

          <button
            onClick={() => router.push("/add")}
            className="flex h-14 w-14 -translate-y-5 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg shadow-pink-200"
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </button>

          <button
            onClick={() => router.push("/stats")}
            className="flex min-w-[58px] flex-col items-center gap-1 text-xs font-medium text-slate-400"
          >
            <BarChart3 className="h-5 w-5" />
            <span>Stats</span>
          </button>

          <button
            onClick={() => router.push("/rewards")}
            className="flex min-w-[58px] flex-col items-center gap-1 text-xs font-medium text-slate-400"
          >
            <ShoppingBag className="h-5 w-5" />
            <span>Rewards</span>
          </button>
        </div>
      </nav>
    </main>
  );
}