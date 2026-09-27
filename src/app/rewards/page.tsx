"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Check,
  Gift,
  Home as HomeIcon,
  ListTodo,
  ShoppingBag,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

type Reward = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  sort_order: number;
  active: boolean;
};

type Redemption = {
  id: string;
  reward_id: string;
  coin_cost: number;
  redeemed_at: string;
};

export default function RewardsPage() {
  const router = useRouter();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [coins, setCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadRewards() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const [rewardsResult, coinsResult, redemptionsResult] =
      await Promise.all([
        supabase
          .from("rewards")
          .select("id, name, emoji, cost, sort_order, active")
          .eq("active", true)
          .order("sort_order", { ascending: true }),

        supabase
          .from("coin_transactions")
          .select("amount")
          .eq("user_id", user.id),

        supabase
          .from("reward_redemptions")
          .select("id, reward_id, coin_cost, redeemed_at")
          .eq("user_id", user.id)
          .order("redeemed_at", { ascending: false })
          .limit(10),
      ]);

    if (rewardsResult.error) {
      console.error("Rewards load error:", rewardsResult.error);
      setErrorMessage("Unable to load rewards.");
    } else {
      setRewards(rewardsResult.data ?? []);
    }

    if (coinsResult.error) {
      console.error("Coins load error:", coinsResult.error);
    } else {
      const balance =
        coinsResult.data?.reduce(
          (total, transaction) => total + Number(transaction.amount),
          0
        ) ?? 0;

      setCoins(balance);
    }

    if (redemptionsResult.error) {
      console.error(
        "Redemptions load error:",
        redemptionsResult.error
      );
    } else {
      setRedemptions(redemptionsResult.data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRewards();
  }, [router]);

  async function redeemReward(reward: Reward) {
    if (redeemingId) return;

    setRedeemingId(reward.id);
    setMessage("");
    setErrorMessage("");

    const { data, error } = await supabase.rpc("redeem_reward", {
      p_reward_id: reward.id,
    });

    if (error) {
      console.error("Redeem reward error:", error);
      setErrorMessage(
        error.message || "Could not redeem this reward."
      );
      setRedeemingId(null);
      return;
    }

    if (!data?.success) {
      switch (data?.reason) {
        case "insufficient_coins":
          setErrorMessage(
            `You need ${Number(data.required ?? reward.cost).toLocaleString()} coins, but you only have ${Number(
              data.balance ?? coins
            ).toLocaleString()}.`
          );
          break;
        case "reward_unavailable":
          setErrorMessage("This reward is currently unavailable.");
          break;
        case "reward_not_found":
          setErrorMessage("This reward no longer exists.");
          break;
        case "not_authenticated":
          router.replace("/login");
          break;
        default:
          setErrorMessage(
            "Could not redeem this reward. Please try again."
          );
      }

      setRedeemingId(null);
      return;
    }

    const newBalance = Number(data.new_balance ?? coins);
    setCoins(newBalance);

    setMessage(
      `${reward.emoji} ${reward.name} redeemed successfully!`
    );

    await loadRewards();

    // Biriyani redemption should unlock First Biriyani immediately.
    if (reward.name.trim().toLowerCase() === "biriyani") {
      const { data: achievementData, error: achievementError } =
        await supabase.rpc("check_and_award_achievements");

      if (achievementError) {
        console.error(
          "Achievement check after Biriyani redemption failed:",
          achievementError
        );
      } else if (
        Array.isArray(achievementData?.unlocked) &&
        achievementData.unlocked.includes("first_biriyani")
      ) {
        setMessage(
          "🍗 Biriyani redeemed! First Biriyani achievement unlocked! ✨"
        );
      }
    }

    setRedeemingId(null);
  }

  const biriyaniReward = useMemo(
    () =>
      rewards.find(
        (reward) =>
          reward.name.trim().toLowerCase() === "biriyani"
      ) ?? null,
    [rewards]
  );

  const progress =
    biriyaniReward && biriyaniReward.cost > 0
      ? Math.min((coins / biriyaniReward.cost) * 100, 100)
      : 0;

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <main className="min-h-screen bg-[var(--app-background)] text-[var(--app-foreground)]">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28">
        <header className="flex items-center gap-3 pt-7">
          <button
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-surface)] shadow-sm ring-1 ring-[var(--app-border)] transition hover:opacity-90 active:scale-95"
            aria-label="Back to Home"
          >
            <ArrowLeft className="h-5 w-5 text-[var(--app-muted-strong)]" />
          </button>

          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              Your Rewards
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              Rewards 🎁
            </h1>
          </div>

          <button
            onClick={() => router.push("/achievements")}
            className="flex h-10 items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 text-sm font-semibold text-[var(--accent)] ring-1 ring-[var(--accent-light)] transition hover:opacity-90 active:scale-95"
          >
            <Trophy className="h-4 w-4" />
            Achievements
          </button>
        </header>

        <section className="mt-5 rounded-3xl bg-gradient-to-br from-[var(--accent-light)] via-[var(--accent-soft)] to-[var(--app-surface)] p-5 shadow-sm ring-1 ring-[var(--accent-light)] dark:bg-none dark:bg-[var(--app-surface)] dark:ring-[var(--app-border)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                Coin Wallet
              </p>

              <p className="mt-1 text-3xl font-bold text-[var(--app-foreground)]">
                {loading ? "..." : coins.toLocaleString()}
              </p>

              <p className="mt-1 text-sm text-[var(--app-muted)]">
                spendable coins
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-surface)] shadow-sm">
              <span className="text-2xl">🪙</span>
            </div>
          </div>

          {biriyaniReward && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">
                  🍗 Biriyani progress
                </span>
                <span className="font-bold text-[var(--accent)]">
                  {coins.toLocaleString()} /{" "}
                  {biriyaniReward.cost.toLocaleString()}
                </span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--app-surface)]/80">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {message && (
          <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              {message}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
            {errorMessage}
          </div>
        )}

        <section className="mt-6">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              Spend Your Coins
            </p>
            <h2 className="mt-1 text-xl font-bold">
              Choose a reward ✨
            </h2>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-3xl bg-[var(--app-surface)] p-6 text-center shadow-sm ring-1 ring-[var(--app-border)]">
                <Sparkles className="mx-auto h-6 w-6 text-[var(--accent)]" />
                <p className="mt-2 text-sm text-[var(--app-muted)]">
                  Loading rewards...
                </p>
              </div>
            ) : rewards.length === 0 ? (
              <div className="rounded-3xl bg-[var(--app-surface)] p-6 text-center shadow-sm ring-1 ring-[var(--app-border)]">
                <Gift className="mx-auto h-6 w-6 text-[var(--accent)]" />
                <p className="mt-2 font-semibold">
                  No rewards available right now.
                </p>
              </div>
            ) : (
              rewards.map((reward) => {
                const canRedeem = coins >= reward.cost;
                const isRedeeming = redeemingId === reward.id;

                return (
                  <article
                    key={reward.id}
                    className={`rounded-3xl bg-[var(--app-surface)] p-4 shadow-sm ring-1 transition ${
                      reward.name.trim().toLowerCase() === "biriyani"
                        ? "ring-[var(--accent)]/40"
                        : "ring-[var(--app-border)]"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-3xl">
                        {reward.emoji}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold">
                            {reward.name}
                          </h3>

                          {reward.name.trim().toLowerCase() ===
                            "biriyani" && (
                            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                              Ultimate
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm font-semibold text-[var(--accent)]">
                          {reward.cost.toLocaleString()} 🪙
                        </p>
                      </div>

                      <button
                        onClick={() => redeemReward(reward)}
                        disabled={!canRedeem || !!redeemingId}
                        className="shrink-0 rounded-2xl bg-[var(--accent)] px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isRedeeming ? "Redeeming..." : "Redeem"}
                      </button>
                    </div>

                    {!canRedeem && (
                      <p className="mt-3 text-xs text-[var(--app-muted)]">
                        {(reward.cost - coins).toLocaleString()} more
                        coins needed.
                      </p>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        {redemptions.length > 0 && (
          <section className="mt-6 rounded-3xl bg-[var(--app-surface)] p-5 shadow-sm ring-1 ring-[var(--app-border)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
                <Gift className="h-5 w-5 text-[var(--accent)]" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                  History
                </p>
                <h2 className="font-bold">
                  Recent redemptions
                </h2>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {redemptions.map((redemption) => {
                const reward = rewards.find(
                  (item) => item.id === redemption.reward_id
                );

                return (
                  <div
                    key={redemption.id}
                    className="flex items-center justify-between rounded-2xl bg-[var(--app-background)] px-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {reward?.emoji ?? "🎁"}
                      </span>

                      <div>
                        <p className="text-sm font-semibold">
                          {reward?.name ?? "Reward"}
                        </p>
                        <p className="text-xs text-[var(--app-muted)]">
                          {formatDate(redemption.redeemed_at)}
                        </p>
                      </div>
                    </div>

                    <span className="text-sm font-bold text-[var(--accent)]">
                      -{redemption.coin_cost.toLocaleString()} 🪙
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={() => router.push("/achievements")}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-3xl bg-[var(--accent)] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.99]"
        >
          <Trophy className="h-4 w-4" />
          View Achievements
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-3 py-3">
          <NavItem
            icon={<HomeIcon />}
            label="Home"
            onClick={() => router.push("/")}
          />

          <NavItem
            icon={<ListTodo />}
            label="Week"
            onClick={() => router.push("/week")}
          />

          <button
            onClick={() => router.push("/add")}
            className="flex h-14 w-14 -translate-y-5 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg transition hover:scale-105 active:scale-95"
            aria-label="Add task"
          >
            <Sparkles className="h-7 w-7" strokeWidth={2.5} />
          </button>

          <NavItem
            icon={<BarChart3 />}
            label="Stats"
            onClick={() => router.push("/stats")}
          />

          <NavItem
            icon={<ShoppingBag />}
            label="Rewards"
            active
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
          ? "text-[var(--accent)]"
          : "text-[var(--app-muted)] hover:text-[var(--accent)]"
      }`}
    >
      <div className="h-5 w-5">{icon}</div>
      <span>{label}</span>
    </button>
  );
}
