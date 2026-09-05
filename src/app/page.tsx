"use client";

import { useState } from "react";
import {
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
  BarChart3,
} from "lucide-react";

const tasks = [
  {
    id: 1,
    title: "Study Pharmacology",
    subtitle: "2 hours · Medium",
    xp: 20,
    coins: 10,
  },
  {
    id: 2,
    title: "Read 20 pages",
    subtitle: "Reading · Medium",
    xp: 20,
    coins: 10,
  },
  {
    id: 3,
    title: "Workout",
    subtitle: "45 minutes · Medium",
    xp: 20,
    coins: 10,
  },
  {
    id: 4,
    title: "Review notes",
    subtitle: "1 hour · Easy",
    xp: 10,
    coins: 5,
  },
];

export default function Home() {
  const [completedTasks, setCompletedTasks] = useState<number[]>([1]);

  const toggleTask = (id: number) => {
    setCompletedTasks((current) =>
      current.includes(id)
        ? current.filter((taskId) => taskId !== id)
        : [...current, id]
    );
  };

  const completedCount = completedTasks.length;
  const totalTasks = tasks.length;

  const earnedXp = tasks
    .filter((task) => completedTasks.includes(task.id))
    .reduce((total, task) => total + task.xp, 0);

  const dailyTarget = 76;
  const xpProgress = Math.min((earnedXp / dailyTarget) * 100, 100);

  return (
    <main className="min-h-screen bg-[#fff8fb] text-slate-800">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28">
        {/* Header */}
        <header className="flex items-center justify-between pt-7">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Thursday, September 4
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Hey, Sunshine 🌸
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
                  Level 7
                </span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">XP</p>
              <p className="font-bold text-slate-800">1,240 / 1,500</p>
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all"
              style={{ width: "82%" }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5">
              <Flame className="h-4 w-4 fill-orange-400 text-orange-400" />
              <span className="text-sm font-semibold">6 day streak</span>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5">
              <span className="text-base">🪙</span>
              <span className="text-sm font-semibold">1,420</span>
            </div>
          </div>
        </section>

        {/* Daily Progress */}
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                TODAY'S QUEST
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Daily Progress 🎯
              </h2>
            </div>

            <div className="rounded-2xl bg-pink-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-pink-600">
                {earnedXp}
              </p>
              <p className="text-[10px] font-medium text-pink-400">
                / {dailyTarget} XP
              </p>
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-pink-400 transition-all duration-500"
              style={{ width: `${xpProgress}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              {completedCount} of {totalTasks} tasks complete
            </span>

            {earnedXp >= dailyTarget ? (
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
              Today's Tasks
            </h2>

            <button className="flex items-center gap-1 text-sm font-semibold text-pink-500">
              See all
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            {tasks.map((task) => {
              const completed = completedTasks.includes(task.id);

              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 transition ${
                    completed
                      ? "ring-green-100"
                      : "ring-slate-100 hover:ring-pink-200"
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
                      <Check className="h-5 w-5" strokeWidth={3} />
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
                      {task.subtitle}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-purple-500">
                      +{task.xp} XP
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      +{task.coins} 🪙
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
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
                Complete your target and earn
                <span className="font-bold text-purple-600">
                  {" "}
                  +25 XP
                </span>{" "}
                and
                <span className="font-bold text-purple-600">
                  {" "}
                  +10 🪙
                </span>
              </p>
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
              1,420 / 2,000 🪙
            </p>
          </div>

          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-300 to-pink-400"
              style={{ width: "71%" }}
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
          <NavItem icon={<HomeIcon />} label="Home" active />

          <NavItem icon={<ListTodo />} label="Week" />

          <button className="flex h-14 w-14 -translate-y-5 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg shadow-pink-200">
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </button>

          <NavItem icon={<BarChart3 />} label="Stats" />

          <NavItem icon={<ShoppingBag />} label="Rewards" />
        </div>
      </nav>
    </main>
  );
}

function NavItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex min-w-[58px] flex-col items-center gap-1 text-xs font-medium ${
        active ? "text-pink-500" : "text-slate-400"
      }`}
    >
      <div className="h-5 w-5">{icon}</div>
      <span>{label}</span>
    </button>
  );
}