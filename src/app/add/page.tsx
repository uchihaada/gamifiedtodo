"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Clock3, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type TaskType = "timed" | "completion";

type Category =
  | "Study"
  | "Health"
  | "Home"
  | "Personal"
  | "Work"
  | "Other";

type Difficulty = "easy" | "medium" | "hard";
type DurationUnit = "minutes" | "hours";

const DAYS = [
  { label: "M", name: "Monday", value: 1 },
  { label: "T", name: "Tuesday", value: 2 },
  { label: "W", name: "Wednesday", value: 3 },
  { label: "T", name: "Thursday", value: 4 },
  { label: "F", name: "Friday", value: 5 },
  { label: "S", name: "Saturday", value: 6 },
  { label: "S", name: "Sunday", value: 0 },
];

const REWARDS: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 35,
};

function getMonday(date: Date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);

  const day = monday.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;

  monday.setDate(monday.getDate() - daysFromMonday);

  return monday;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function AddPage() {
  const router = useRouter();
  const supabase = createClient();

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const todayDay = today.getDay();
  const isSunday = todayDay === 0;

  const currentWeekMonday = useMemo(
    () => getMonday(today),
    [today]
  );

  const nextWeekMonday = useMemo(
    () => addDays(currentWeekMonday, 7),
    [currentWeekMonday]
  );

  const [planningWeek, setPlanningWeek] = useState<
    "current" | "next"
  >(isSunday ? "next" : "current");

  const [taskType, setTaskType] =
    useState<TaskType>("timed");

  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<Category>("Study");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("60");
  const [durationUnit, setDurationUnit] =
    useState<DurationUnit>("minutes");
  const [difficulty, setDifficulty] =
    useState<Difficulty>("medium");

  const [selectedDays, setSelectedDays] = useState<number[]>(
    []
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const monday =
    planningWeek === "current"
      ? currentWeekMonday
      : nextWeekMonday;

  const weekEnd = addDays(monday, 6);

  const selectedDayObjects = useMemo(() => {
    return selectedDays.map((dayOfWeek) => {
      const daysFromMonday =
        dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      return {
        dayOfWeek,
        date: addDays(monday, daysFromMonday),
      };
    });
  }, [selectedDays, monday]);

  const durationInputValue = Number(duration);
  const totalDurationMinutes =
    Number.isFinite(durationInputValue) && durationInputValue > 0
      ? Math.round(
          durationInputValue * (durationUnit === "hours" ? 60 : 1)
        )
      : 0;

  const totalRewardXp =
    REWARDS[difficulty] * selectedDays.length;

  function isPastDay(dayOfWeek: number) {
    if (planningWeek === "next") {
      return false;
    }

    if (isSunday) {
      return dayOfWeek !== 0;
    }

    const todayValue = todayDay === 0 ? 7 : todayDay;
    const selectedValue = dayOfWeek === 0 ? 7 : dayOfWeek;

    return selectedValue < todayValue;
  }

  function toggleDay(dayOfWeek: number) {
    if (isPastDay(dayOfWeek)) {
      return;
    }

    setSelectedDays((current) =>
      current.includes(dayOfWeek)
        ? current.filter((day) => day !== dayOfWeek)
        : [...current, dayOfWeek]
    );
  }

  function changePlanningWeek(
    week: "current" | "next"
  ) {
    setPlanningWeek(week);
    setSelectedDays([]);
    setError("");
  }

  async function handleCreate() {
    setError("");

    if (!title.trim()) {
      setError("Please enter a quest title.");
      return;
    }

    if (taskType === "timed") {
      if (totalDurationMinutes <= 0) {
        setError("Please enter a valid duration.");
        return;
      }

      if (category === "Study" && !subject.trim()) {
        setError("Please enter the study subject.");
        return;
      }
    }

    if (selectedDays.length === 0) {
      setError("Please select at least one planned day.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const weekStart = formatDate(monday);
      const weekEndDate = formatDate(weekEnd);

      // Create the weekly plan if it does not exist.
      // If it already exists, reuse it.
      const { data: week, error: weekError } =
        await supabase
          .from("weeks")
          .upsert(
            {
              user_id: user.id,
              week_start: weekStart,
              week_end: weekEndDate,
              boss_completed: false,
            },
            {
              onConflict: "user_id,week_start",
            }
          )
          .select("id")
          .single();

      if (weekError || !week) {
        throw new Error(
          weekError?.message ||
            "Could not create the weekly plan."
        );
      }

      const { data: task, error: taskError } =
        await supabase
          .from("tasks")
          .insert({
            user_id: user.id,
            week_id: week.id,
            title: title.trim(),
            task_type: taskType,
            category,
            subject:
              taskType === "timed" &&
              category === "Study"
                ? subject.trim()
                : null,
            // Timed-task targets are always stored in minutes,
            // regardless of which unit the user selected in the form.
            target_value:
              taskType === "timed"
                ? totalDurationMinutes
                : null,
            measurement_unit:
              taskType === "timed"
                ? "minutes"
                : null,
            difficulty,
            status: "active",
          })
          .select("id")
          .single();

      if (taskError || !task) {
        throw new Error(
          taskError?.message ||
            "Could not create quest."
        );
      }

      const taskDays = selectedDayObjects.map(
        ({ date }) => ({
          task_id: task.id,
          planned_date: formatDate(date),
        })
      );

      const { error: daysError } = await supabase
        .from("task_days")
        .insert(taskDays);

      if (daysError) {
        await supabase
          .from("tasks")
          .delete()
          .eq("id", task.id);

        throw new Error(daysError.message);
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Create quest error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 pb-28">
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm transition hover:bg-pink-50"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Create a Quest ✨
            </h1>

            <p className="text-sm text-gray-500">
              Add something amazing to your plan.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Planning Week */}
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900">
                Planning Week
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {formatShortDate(monday)} –{" "}
                {formatShortDate(weekEnd)}
              </p>
            </div>

            {isSunday ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() =>
                    changePlanningWeek("current")
                  }
                  className={`rounded-2xl border p-4 text-left transition ${
                    planningWeek === "current"
                      ? "border-pink-400 bg-pink-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <p className="font-semibold text-gray-900">
                    This Week
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {formatShortDate(currentWeekMonday)} –{" "}
                    {formatShortDate(
                      addDays(currentWeekMonday, 6)
                    )}
                  </p>
                </button>

                <button
                  onClick={() =>
                    changePlanningWeek("next")
                  }
                  className={`rounded-2xl border p-4 text-left transition ${
                    planningWeek === "next"
                      ? "border-purple-400 bg-purple-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <p className="font-semibold text-gray-900">
                    Next Week
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {formatShortDate(nextWeekMonday)} –{" "}
                    {formatShortDate(
                      addDays(nextWeekMonday, 6)
                    )}
                  </p>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-pink-50 px-4 py-3">
                <p className="text-sm font-semibold text-pink-700">
                  This Week
                </p>

                <p className="mt-1 text-xs text-pink-500">
                  New quests added during the week belong
                  to this week.
                </p>
              </div>
            )}
          </section>

          {/* Task Type */}
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-900">
              Quest Type
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTaskType("timed")}
                className={`rounded-2xl border p-4 text-left transition ${
                  taskType === "timed"
                    ? "border-pink-400 bg-pink-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <Clock3
                  size={22}
                  className="mb-2 text-pink-500"
                />

                <p className="font-semibold text-gray-900">
                  Timed
                </p>

                <p className="text-xs text-gray-500">
                  Track time spent
                </p>
              </button>

              <button
                onClick={() =>
                  setTaskType("completion")
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  taskType === "completion"
                    ? "border-purple-400 bg-purple-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <Check
                  size={22}
                  className="mb-2 text-purple-500"
                />

                <p className="font-semibold text-gray-900">
                  Completion
                </p>

                <p className="text-xs text-gray-500">
                  Complete once per planned day
                </p>
              </button>
            </div>
          </section>

          {/* Quest Details */}
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">
              Quest Details
            </h2>

            <label className="mb-2 block text-sm font-medium text-gray-700">
              Title
            </label>

            <input
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="e.g. Study Pharmacology"
              className="mb-4 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
            />

            <label className="mb-2 block text-sm font-medium text-gray-700">
              Category
            </label>

            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as Category
                )
              }
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
            >
              <option value="Study">Study</option>
              <option value="Health">Health</option>
              <option value="Home">Home</option>
              <option value="Personal">Personal</option>
              <option value="Work">Work</option>
              <option value="Other">Other</option>
            </select>

            {taskType === "timed" &&
              category === "Study" && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Study Subject
                  </label>

                  <input
                    value={subject}
                    onChange={(e) =>
                      setSubject(e.target.value)
                    }
                    placeholder="e.g. Pharmacology"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none placeholder:text-gray-400 focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
                  />
                </div>
              )}
          </section>

          {/* Duration */}
          {taskType === "timed" && (
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-gray-900">
                Duration
              </h2>

              <div className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-3">
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  aria-label="Duration amount"
                  value={duration}
                  onChange={(e) =>
                    setDuration(e.target.value)
                  }
                  placeholder={durationUnit === "hours" ? "1" : "60"}
                  className="w-full min-w-0 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
                />

                <select
                  aria-label="Duration unit"
                  value={durationUnit}
                  onChange={(e) =>
                    setDurationUnit(e.target.value as DurationUnit)
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-700 outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                </select>
              </div>

              {totalDurationMinutes > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  Tracked as {totalDurationMinutes} minute{totalDurationMinutes === 1 ? "" : "s"}.
                </p>
              )}
            </section>
          )}

          {/* Difficulty */}
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900">
                Difficulty
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Choose the difficulty for this quest.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(
                ["easy", "medium", "hard"] as Difficulty[]
              ).map((level) => {
                const selected =
                  difficulty === level;

                return (
                  <button
                    key={level}
                    onClick={() =>
                      setDifficulty(level)
                    }
                    className={`rounded-2xl border p-4 text-center transition ${
                      selected
                        ? "border-pink-400 bg-pink-50 shadow-sm"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <p className="font-semibold capitalize text-gray-900">
                      {level}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {REWARDS[level]} XP
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Planned Days */}
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900">
                Planned Days
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Choose the days for this quest.
              </p>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {DAYS.map((day) => {
                const selected =
                  selectedDays.includes(day.value);

                const disabled =
                  isPastDay(day.value);

                const date =
                  addDays(
                    monday,
                    day.value === 0
                      ? 6
                      : day.value - 1
                  );

                return (
                  <button
                    key={`${day.name}-${day.value}`}
                    onClick={() =>
                      toggleDay(day.value)
                    }
                    disabled={disabled}
                    className={`relative flex h-16 flex-col items-center justify-center rounded-2xl border font-semibold transition ${
                      disabled
                        ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
                        : selected
                        ? "border-pink-400 bg-pink-500 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-pink-50"
                    }`}
                  >
                    <span>{day.label}</span>

                    <span
                      className={`mt-0.5 text-[10px] font-medium ${
                        selected
                          ? "text-white/80"
                          : disabled
                          ? "text-gray-300"
                          : "text-gray-400"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedDayObjects.length > 0 && (
              <div className="mt-4 rounded-2xl bg-pink-50 px-4 py-3">
                <p className="text-xs font-semibold text-pink-600">
                  Selected days
                </p>

                <p className="mt-1 text-sm text-pink-700">
                  {selectedDayObjects
                    .map(({ date }) =>
                      date.toLocaleDateString(
                        "en-IN",
                        {
                          weekday: "short",
                          day: "numeric",
                        }
                      )
                    )
                    .join(" · ")}
                </p>
              </div>
            )}
          </section>

          {/* Reward Preview */}
          <section className="rounded-3xl bg-gradient-to-r from-pink-100 to-purple-100 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 shadow-sm">
                <Sparkles
                  size={22}
                  className="text-pink-500"
                />
              </div>

              <div>
                <h2 className="font-semibold text-gray-900">
                  Reward Preview
                </h2>

                {selectedDays.length > 0 ? (
                  <>
                    <p className="mt-1 text-sm text-gray-600">
                      Potential reward for all selected
                      days:
                    </p>

                    <div className="mt-3">
                      <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-pink-600 shadow-sm">
                        +{totalRewardXp} XP
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-gray-500">
                      {REWARDS[difficulty]} XP ×{" "}
                      {selectedDays.length}{" "}
                      {selectedDays.length === 1
                        ? "day"
                        : "days"}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      You earn the reward only for days
                      you actually complete.
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    Select at least one day to see the
                    total XP.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Create */}
          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 px-5 py-4 font-semibold text-white shadow-md transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Creating Quest..."
              : "Create Quest ✨"}
          </button>
        </div>
      </div>
    </main>
  );
}