"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { selectSession } from "@/redux/features/auth/authSlice";
import { useAppSelector } from "@/redux/hooks";
import { handleSessionExpired } from "@/utils/authSession";
import { resolveSocketBaseUrl } from "@/utils/socketBaseUrl";

export type ConsistencyEntry = {
  rank: number;
  memberId: string;
  displayName: string;
  phone: string;
  workouts: number;
  weeklyHours: number;
  streak: number;
  lastActivityAt: string | null;
};

export type GoalEntry = {
  rank: number;
  memberId: string;
  displayName: string;
  goalType: "weight_loss" | "weight_gain";
  goalProgressPercent: number;
  currentWeightKg: number;
  targetWeightKg: number;
};

export type LiveStats = {
  membersToday: number;
  workoutsToday: number;
  workoutsThisWeek: number;
  totalHoursThisWeek: number;
  activeMembersThisMonth: number;
  rankedMembersCount: number;
  streakLeader: string | null;
  streakLeaderDays: number;
};

export type TvLeaderboardPayload = {
  branchId: string;
  consistency: {
    totalRanked: number;
    entries: ConsistencyEntry[];
  };
  goals: {
    totalRanked: number;
    entries: GoalEntry[];
  };
  liveStats: LiveStats;
  updatedAt: string;
};

type SocketAuth = {
  token: string;
  gymId?: string;
  branchId?: string;
};

type UseTvLeaderboardSocketResult = {
  loading: boolean;
  connected: boolean;
  consistencyEntries: ConsistencyEntry[];
  goalEntries: GoalEntry[];
  liveStats: LiveStats | null;
  refresh: () => void;
};

export function useTvLeaderboardSocket(): UseTvLeaderboardSocketResult {
  const session = useAppSelector(selectSession);
  const socketRef = useRef<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [consistencyEntries, setConsistencyEntries] = useState<ConsistencyEntry[]>([]);
  const [goalEntries, setGoalEntries] = useState<GoalEntry[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);

  const applyPayload = useCallback((payload: TvLeaderboardPayload) => {
    setConsistencyEntries(payload.consistency.entries ?? []);
    setGoalEntries(payload.goals.entries ?? []);
    setLiveStats(payload.liveStats ?? null);
    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    socketRef.current?.emit("leaderboard:refresh");
  }, []);

  const socketAuth = useMemo((): SocketAuth | null => {
    const token =
      typeof session?.token === "string" && session.token.trim().length > 0
        ? session.token.trim()
        : null;
    if (!token) {
      return null;
    }

    const gymId = session?.user?.defaults?.gymId;
    const branchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId;

    return {
      token,
      gymId: typeof gymId === "string" && gymId.trim() ? gymId.trim() : undefined,
      branchId: typeof branchId === "string" && branchId.trim() ? branchId.trim() : undefined,
    };
  }, [session?.token, session?.activeBranch?.id, session?.user?.defaults?.branchId, session?.user?.defaults?.gymId]);

  useEffect(() => {
    if (!socketAuth) {
      setLoading(false);
      setConnected(false);
      return;
    }

    setLoading(true);

    const socket = io(resolveSocketBaseUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: socketAuth,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });

    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onUpdate = (payload: TvLeaderboardPayload) => {
      applyPayload(payload);
    };

    const onConnectError = (error: Error) => {
      const message = error.message.toLowerCase();
      if (message.includes("unauthorized") || message.includes("invalid") || message.includes("expired")) {
        handleSessionExpired();
      }
      setLoading(false);
      setConnected(false);
    };

    const onLeaderboardError = () => {
      setLoading(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("leaderboard:update", onUpdate);
    socket.on("connect_error", onConnectError);
    socket.on("leaderboard:error", onLeaderboardError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("leaderboard:update", onUpdate);
      socket.off("connect_error", onConnectError);
      socket.off("leaderboard:error", onLeaderboardError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [applyPayload, socketAuth]);

  return {
    loading,
    connected,
    consistencyEntries,
    goalEntries,
    liveStats,
    refresh,
  };
}
