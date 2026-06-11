"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App, Spin } from "antd";
import { ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined } from "@ant-design/icons";
import { Flame, Target, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useTvLeaderboardSocket,
  type ConsistencyEntry,
  type GoalEntry,
  type LiveStats,
} from "@/hooks/useTvLeaderboardSocket";

type TvScreen = "consistency" | "goals";

const GOLD = "#FBBF24";
const BG = "#0B0F14";
const PANEL = "#121A22";
const ROW_BG = "#161D28";
const ACCENT_CYAN = "#06B6D4";
const ACCENT_ORANGE = "#F97316";
const ROTATION_MS = 10_000;

/* ─── Helpers ─── */

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function rankColor(rank: number): string {
  if (rank === 1) return GOLD;
  if (rank === 2) return "#22C55E";
  if (rank === 3) return ACCENT_CYAN;
  return "#94A3B8";
}

function formatClockTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatClockDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function relativeFromNow(iso: string | null): string {
  if (!iso) return "No activity";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "No activity";
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return `${sec}s ago`;
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  return `${day}d ago`;
}

function goalTypeLabel(type: GoalEntry["goalType"]): string {
  return type === "weight_loss" ? "WEIGHT LOSS" : "WEIGHT GAIN";
}

function buildTickerMessages(stats: LiveStats | null): string[] {
  if (!stats) return [];
  const messages: string[] = [];

  if (stats.workoutsToday > 0) {
    messages.push(`${stats.workoutsToday} workout${stats.workoutsToday === 1 ? "" : "s"} completed today`);
  }
  if (stats.workoutsThisWeek > 0) {
    messages.push(`${stats.workoutsThisWeek} workouts completed this week`);
  }
  if (stats.totalHoursThisWeek > 0) {
    messages.push(`${stats.totalHoursThisWeek} workout hours logged this week`);
  }
  if (stats.membersToday > 0) {
    messages.push(`${stats.membersToday} member${stats.membersToday === 1 ? "" : "s"} checked in today`);
  }
  if (stats.activeMembersThisMonth > 0) {
    messages.push(`${stats.activeMembersThisMonth} active member${stats.activeMembersThisMonth === 1 ? "" : "s"} this month`);
  }
  if (stats.rankedMembersCount > 0) {
    messages.push(`${stats.rankedMembersCount} member${stats.rankedMembersCount === 1 ? "" : "s"} on the leaderboard`);
  }
  if (stats.streakLeader && stats.streakLeaderDays > 0) {
    messages.push(`Current streak leader ${stats.streakLeader} (${stats.streakLeaderDays} day${stats.streakLeaderDays === 1 ? "" : "s"})`);
  }

  return messages;
}

function tickerIcon(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("streak leader")) return "🔥";
  if (lower.includes("workout hours") || lower.includes("hours logged")) return "💪";
  if (lower.includes("workout")) return "⚡";
  return "🏆";
}

/* ─── Sub-components ─── */

function InitialsAvatar({
  name,
  size,
  color = GOLD,
}: {
  name: string;
  size: number;
  color?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size > 72 ? 16 : 10,
        display: "grid",
        placeItems: "center",
        background: `${color}22`,
        border: `2px solid ${color}55`,
        color: "#F9FAFB",
        fontWeight: 900,
        fontSize: size * 0.34,
        letterSpacing: 1,
        flexShrink: 0,
      }}
    >
      {initialsFromName(name)}
    </div>
  );
}

function TvHeader({ liveTime, screenTitle }: { liveTime: Date; screenTitle: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        padding: "16px 20px 14px",
        borderBottom: `1px solid rgba(251,191,36,0.15)`,
        gap: 16,
        position: "relative",
        zIndex: 2,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, flex: "1 1 240px", minWidth: 0 }}>
        <motion.div
          style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}
          animate={{ opacity: [1, 0.45, 1] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          <div style={{ width: 12, height: 12, borderRadius: 999, background: "#EF4444" }} />
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3 }}>LIVE</span>
        </motion.div>
        <div style={{ width: 2, height: 36, background: GOLD, flexShrink: 0 }} />
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <div
            style={{
              color: GOLD,
              fontSize: "clamp(22px, 3vw, 34px)",
              fontWeight: 900,
              letterSpacing: 2,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {screenTitle}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>
            SESSION
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "clamp(22px, 2.5vw, 30px)",
              fontWeight: 900,
            }}
          >
            {formatClockTime(liveTime)}
          </div>
        </div>
        <div style={{ width: 2, height: 48, background: ACCENT_CYAN }} />
        <div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>
            DATE
          </div>
          <div style={{ fontSize: "clamp(16px, 2vw, 20px)", fontWeight: 800 }}>{formatClockDate(liveTime)}</div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  color = "#F9FAFB",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: "center", flex: "1 1 64px", minWidth: 64, maxWidth: 140 }}>
      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          color,
          fontWeight: 900,
          fontSize: "clamp(18px, 2.2vw, 28px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}

function MetricsRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px 12px",
        flex: "1 1 180px",
        minWidth: 0,
        justifyContent: "flex-end",
        maxWidth: "100%",
      }}
    >
      {children}
    </div>
  );
}

function LeaderSpotlight({ entry }: { entry: ConsistencyEntry }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: [
          `0 0 24px rgba(251,191,36,0.12), 0 0 0 1px ${GOLD}44`,
          `0 0 48px rgba(251,191,36,0.28), 0 0 0 1px ${GOLD}66`,
          `0 0 24px rgba(251,191,36,0.12), 0 0 0 1px ${GOLD}44`,
        ],
      }}
      transition={{
        opacity: { duration: 0.5 },
        scale: { duration: 0.5 },
        boxShadow: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
      }}
      style={{
        position: "relative",
        margin: "0 0 20px",
        padding: "20px 16px",
        borderRadius: 16,
        border: `2px solid ${GOLD}66`,
        background: `linear-gradient(135deg, rgba(251,191,36,0.12) 0%, ${PANEL} 60%)`,
        overflow: "hidden",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <motion.div
        aria-hidden
        style={{ position: "absolute", inset: 0, opacity: 0.12, pointerEvents: "none" }}
        animate={{ x: [0, 40] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <div
          style={{
            width: "200%",
            height: "100%",
            background: `repeating-linear-gradient(45deg, transparent, transparent 12px, ${GOLD}40 12px, ${GOLD}40 24px)`,
          }}
        />
      </motion.div>

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          maxWidth: "100%",
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <motion.div
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: 20,
              background: GOLD,
              opacity: 0.25,
              filter: "blur(12px)",
            }}
            animate={{ opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <InitialsAvatar name={entry.displayName} size={96} color={GOLD} />
        </div>

        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            <Trophy size={22} color={GOLD} />
            <span style={{ color: GOLD, fontWeight: 900, fontSize: 14, letterSpacing: 3 }}>
              LEADER SPOTLIGHT
            </span>
            <span
              style={{
                background: GOLD,
                color: BG,
                fontWeight: 900,
                fontSize: 14,
                padding: "2px 10px",
                borderRadius: 4,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              P1
            </span>
          </div>
          <div
            style={{
              color: "#F9FAFB",
              fontWeight: 900,
              fontSize: "clamp(22px, 3vw, 36px)",
              letterSpacing: 1,
              lineHeight: 1.1,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {entry.displayName.toUpperCase()}
          </div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginTop: 6 }}>
            Last active {relativeFromNow(entry.lastActivityAt)}
          </div>
        </div>

        <MetricsRow>
          <StatBlock label="STREAK" value={entry.streak} color={ACCENT_ORANGE} icon={<Flame size={22} />} />
          <StatBlock label="WORKOUTS" value={entry.workouts} />
          <StatBlock label="WEEKLY HRS" value={entry.weeklyHours} color={ACCENT_CYAN} />
        </MetricsRow>
      </div>
    </motion.div>
  );
}

function ConsistencyRow({ entry }: { entry: ConsistencyEntry }) {
  const color = rankColor(entry.rank);
  const podium = entry.rank <= 3;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        padding: "12px 14px",
        marginBottom: 8,
        borderRadius: 10,
        background: ROW_BG,
        border: `1px solid ${podium ? `${color}33` : "rgba(255,255,255,0.06)"}`,
        borderLeftWidth: 4,
        borderLeftColor: podium ? color : "rgba(255,255,255,0.08)",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          background: podium ? `${color}18` : "rgba(0,0,0,0.3)",
          color: podium ? color : "#CBD5E1",
          fontWeight: 900,
          fontSize: 20,
          fontFamily: "ui-monospace, monospace",
          flexShrink: 0,
        }}
      >
        {entry.rank}
      </div>

      <InitialsAvatar name={entry.displayName} size={52} color={color} />

      <div style={{ flex: "1 1 140px", minWidth: 0 }}>
        <div
          style={{
            color: "#F9FAFB",
            fontWeight: 800,
            fontSize: "clamp(16px, 2vw, 20px)",
            letterSpacing: 0.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.displayName.toUpperCase()}
        </div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>
          {relativeFromNow(entry.lastActivityAt)}
        </div>
      </div>

      <MetricsRow>
        <StatBlock label="STREAK" value={entry.streak} color={ACCENT_ORANGE} icon={<Flame size={16} />} />
        <StatBlock label="WORKOUTS" value={entry.workouts} />
        <StatBlock label="WEEKLY HRS" value={entry.weeklyHours} color={ACCENT_CYAN} />
      </MetricsRow>
    </motion.div>
  );
}

function GoalSpotlight({ entry }: { entry: GoalEntry }) {
  const color = GOLD;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: [
          `0 0 24px rgba(251,191,36,0.12), 0 0 0 1px ${GOLD}44`,
          `0 0 48px rgba(251,191,36,0.28), 0 0 0 1px ${GOLD}66`,
          `0 0 24px rgba(251,191,36,0.12), 0 0 0 1px ${GOLD}44`,
        ],
      }}
      transition={{
        opacity: { duration: 0.5 },
        scale: { duration: 0.5 },
        boxShadow: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
      }}
      style={{
        position: "relative",
        margin: "0 0 20px",
        padding: "20px 16px",
        borderRadius: 16,
        border: `2px solid ${color}66`,
        background: `linear-gradient(135deg, rgba(6,182,212,0.1) 0%, ${PANEL} 60%)`,
        overflow: "hidden",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          maxWidth: "100%",
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <motion.div
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: 20,
              background: GOLD,
              opacity: 0.2,
              filter: "blur(12px)",
            }}
            animate={{ opacity: [0.12, 0.32, 0.12] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <InitialsAvatar name={entry.displayName} size={96} color={color} />
        </div>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            <Target size={22} color={color} />
            <span style={{ color, fontWeight: 900, fontSize: 14, letterSpacing: 3 }}>TOP GOAL CRUSHER</span>
          </div>
          <div
            style={{
              color: "#F9FAFB",
              fontWeight: 900,
              fontSize: "clamp(22px, 3vw, 36px)",
              letterSpacing: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {entry.displayName.toUpperCase()}
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 6, letterSpacing: 1 }}>
            {goalTypeLabel(entry.goalType)}
          </div>
        </div>
        <MetricsRow>
          <StatBlock label="PROGRESS" value={`${entry.goalProgressPercent}%`} color={ACCENT_CYAN} />
          <StatBlock label="CURRENT" value={`${entry.currentWeightKg} kg`} />
          <StatBlock label="TARGET" value={`${entry.targetWeightKg} kg`} color={GOLD} />
        </MetricsRow>
      </div>
    </motion.div>
  );
}

function GoalRow({ entry }: { entry: GoalEntry }) {
  const color = rankColor(entry.rank);
  const podium = entry.rank <= 3;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        padding: "12px 14px",
        marginBottom: 8,
        borderRadius: 10,
        background: ROW_BG,
        border: `1px solid ${podium ? `${color}33` : "rgba(255,255,255,0.06)"}`,
        borderLeftWidth: 4,
        borderLeftColor: podium ? color : "rgba(255,255,255,0.08)",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          background: podium ? `${color}18` : "rgba(0,0,0,0.3)",
          color: podium ? color : "#CBD5E1",
          fontWeight: 900,
          fontSize: 20,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {entry.rank}
      </div>

      <InitialsAvatar name={entry.displayName} size={52} color={color} />

      <div style={{ flex: "1 1 140px", minWidth: 0 }}>
        <div
          style={{
            color: "#F9FAFB",
            fontWeight: 800,
            fontSize: "clamp(16px, 2vw, 20px)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.displayName.toUpperCase()}
        </div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 2, letterSpacing: 1 }}>
          {goalTypeLabel(entry.goalType)}
        </div>
      </div>

      <MetricsRow>
        <StatBlock label="PROGRESS" value={`${entry.goalProgressPercent}%`} color={ACCENT_CYAN} />
        <StatBlock label="CURRENT" value={`${entry.currentWeightKg}`} />
        <StatBlock label="TARGET" value={`${entry.targetWeightKg}`} color={GOLD} />
      </MetricsRow>
    </motion.div>
  );
}

function LiveTicker({ messages }: { messages: string[] }) {
  const scrollDuration = useMemo(
    () => Math.max(messages.length * 8, 24),
    [messages.length]
  );

  const tickerItems = useMemo(
    () => [...messages, ...messages],
    [messages]
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        background: BG,
        borderTop: `3px solid ${GOLD}`,
        zIndex: 4,
      }}
    >
      <div style={{ background: PANEL, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}>
        <div
          style={{
            background: "#EF4444",
            color: "white",
            padding: "6px 14px",
            fontWeight: 900,
            borderRadius: 4,
            fontSize: 13,
            letterSpacing: 2,
            flexShrink: 0,
          }}
        >
          LIVE
        </div>
        <div style={{ flex: 1, overflow: "hidden", minHeight: 32, display: "flex", alignItems: "center" }}>
          {messages.length > 0 ? (
            <motion.div
              style={{ display: "flex", alignItems: "center", gap: 40, whiteSpace: "nowrap" }}
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: scrollDuration, repeat: Infinity, ease: "linear" }}
            >
              {tickerItems.map((text, idx) => (
                <span
                  key={`${text}-${idx}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 12, flexShrink: 0 }}
                >
                  <span style={{ fontSize: 20 }}>{tickerIcon(text)}</span>
                  <span style={{ color: "#F9FAFB", fontWeight: 700, fontSize: 18, letterSpacing: 0.5 }}>
                    {text}
                  </span>
                  <span style={{ color: GOLD, fontSize: 18, opacity: 0.6, marginLeft: 8 }}>•</span>
                </span>
              ))}
            </motion.div>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 16 }}>Awaiting live gym data…</span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyBoard({ message, subtitle }: { message: string; subtitle?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 32px",
        gap: 16,
        textAlign: "center",
      }}
    >
      {subtitle ? (
        <div style={{ fontSize: 56, lineHeight: 1 }}>{message.split(" ")[0]}</div>
      ) : (
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 64, fontWeight: 900, letterSpacing: 4 }}>—</div>
      )}
      <div style={{ color: "rgba(255,255,255,0.75)", fontWeight: 800, fontSize: 24, letterSpacing: 2, maxWidth: 560 }}>
        {subtitle ? message.slice(message.indexOf(" ") + 1) : message}
      </div>
      {subtitle ? (
        <div style={{ color: "rgba(255,255,255,0.45)", fontWeight: 600, fontSize: 18, letterSpacing: 0.5, maxWidth: 520, lineHeight: 1.5 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function ConsistencyScreen({ entries }: { entries: ConsistencyEntry[] }) {
  const leader = entries[0] ?? null;
  const rest = entries.slice(1, 11);

  if (entries.length === 0) {
    return <EmptyBoard message="NO ATTENDANCE DATA AVAILABLE" />;
  }

  return (
    <div style={{ maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}>
      {leader ? <LeaderSpotlight entry={leader} /> : null}
      <div>
        {rest.map((entry) => (
          <ConsistencyRow key={entry.memberId} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function GoalsScreen({ entries }: { entries: GoalEntry[] }) {
  const leader = entries[0] ?? null;
  const rest = entries.slice(1, 11);

  if (entries.length === 0) {
    return (
      <EmptyBoard
        message="🎯 GOAL TRACKING NOT STARTED"
        subtitle="Members need body metric goals to appear in this leaderboard."
      />
    );
  }

  return (
    <div style={{ maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}>
      {leader ? <GoalSpotlight entry={leader} /> : null}
      <div>
        {rest.map((entry) => (
          <GoalRow key={entry.memberId} entry={entry} />
        ))}
      </div>
    </div>
  );
}

/* ─── Main ─── */

export default function LeaderboardPanelTv() {
  const { message } = App.useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    loading,
    connected,
    consistencyEntries,
    goalEntries,
    liveStats,
    refresh,
  } = useTvLeaderboardSocket();
  const [liveTime, setLiveTime] = useState(new Date());
  const [activeScreen, setActiveScreen] = useState<TvScreen>("consistency");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const connectionErrorShownRef = useRef(false);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await el.requestFullscreen();
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (connected) {
      connectionErrorShownRef.current = false;
      return;
    }

    if (!loading && !connectionErrorShownRef.current) {
      connectionErrorShownRef.current = true;
      void message.warning("Live leaderboard connection lost. Reconnecting…");
    }
  }, [connected, loading, message]);

  useEffect(() => {
    const clock = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const rotate = setInterval(() => {
      setActiveScreen((prev) => (prev === "consistency" ? "goals" : "consistency"));
    }, ROTATION_MS);
    return () => clearInterval(rotate);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      void toggleFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleFullscreen]);

  const tickerMessages = useMemo(() => buildTickerMessages(liveStats), [liveStats]);

  const screenTitle = activeScreen === "consistency" ? "CONSISTENCY CHAMPIONS" : "GOAL CRUSHERS";

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: isFullscreen ? "100vw" : "100%",
        maxWidth: "100%",
        height: isFullscreen ? "100vh" : "auto",
        minHeight: isFullscreen ? "100vh" : 640,
        borderRadius: isFullscreen ? 0 : 12,
        overflow: "hidden",
        boxSizing: "border-box",
        background: BG,
        color: "#E5E7EB",
        backgroundImage: `
          linear-gradient(to bottom, ${BG} 0%, #1A1F2E 100%),
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)
        `,
      }}
    >
      {/* subtle grid overlay */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.1, pointerEvents: "none", zIndex: 0 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(${GOLD}22 1px, transparent 1px), linear-gradient(90deg, ${GOLD}22 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* moving cyan light sweep */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <motion.div
          style={{
            position: "absolute",
            top: "-25%",
            left: "-40%",
            width: "55%",
            height: "150%",
            background: `radial-gradient(ellipse at center, ${ACCENT_CYAN}14 0%, transparent 68%)`,
            filter: "blur(48px)",
          }}
          animate={{ x: ["-5%", "115%"] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* racing stripe */}
      <motion.div
        style={{
          height: 3,
          position: "relative",
          zIndex: 2,
          background: `linear-gradient(90deg, #EF4444, ${GOLD}, #22C55E, ${ACCENT_CYAN}, #8B5CF6, #EF4444)`,
          backgroundSize: "200% 100%",
        }}
        animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />

      <TvHeader liveTime={liveTime} screenTitle={screenTitle} />

      <div
        style={{
          position: "relative",
          padding: "0 16px 72px",
          flex: 1,
          zIndex: 1,
          overflowX: "hidden",
          overflowY: isFullscreen ? "auto" : "visible",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 120 }}>
            <Spin size="large" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScreen}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.03 }}
              transition={{ duration: 0.55, ease: "easeInOut" }}
            >
              {activeScreen === "consistency" ? (
                <ConsistencyScreen entries={consistencyEntries} />
              ) : (
                <GoalsScreen entries={goalEntries} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* controls */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 10,
        }}
      >
        {/* <button
          type="button"
          onClick={refresh}
          aria-label="Refresh leaderboard"
          title="Refresh leaderboard"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            color: "#CBD5E1",
            padding: "8px 14px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <ReloadOutlined /> 
         </button> */}
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            color: "#CBD5E1",
            padding: "8px 14px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        </button>
      </div>

      <LiveTicker messages={tickerMessages} />

      {/* screen indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 72,
          right: 28,
          display: "flex",
          gap: 8,
          zIndex: 5,
        }}
      >
        {(["consistency", "goals"] as TvScreen[]).map((screen) => (
          <div
            key={screen}
            style={{
              width: activeScreen === screen ? 28 : 8,
              height: 8,
              borderRadius: 999,
              background: activeScreen === screen ? GOLD : "rgba(255,255,255,0.2)",
              transition: "all 0.4s",
            }}
          />
        ))}
      </div>
    </div>
  );
}
