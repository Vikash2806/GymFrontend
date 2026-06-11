import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, TrendingUp, TrendingDown, Flame, Clock } from 'lucide-react';

// Leaderboard data that will shuffle for racing-style position changes
interface LeaderboardMember {
  id: number;
  name: string;
  initials: string;
  position: number;
  totalWorkouts: number;
  weeklyHours: number;
  currentStreak: number;
  lastActivity: string;
  delta: number; // position change
  isMoving: boolean;
  teamColor: string;
}

const INITIAL_LEADERBOARD: LeaderboardMember[] = [
  { id: 1, name: 'SHARMA, Priya', initials: 'PS', position: 1, totalWorkouts: 124, weeklyHours: 12.5, currentStreak: 28, lastActivity: '8m ago', delta: 0, isMoving: false, teamColor: '#FBBF24' },
  { id: 2, name: 'PATEL, Amit', initials: 'AP', position: 2, totalWorkouts: 118, weeklyHours: 11.2, currentStreak: 21, lastActivity: '2m ago', delta: 0, isMoving: false, teamColor: '#22C55E' },
  { id: 3, name: 'WILLIAMS, Sarah', initials: 'SW', position: 3, totalWorkouts: 112, weeklyHours: 10.8, currentStreak: 19, lastActivity: '15m ago', delta: 0, isMoving: false, teamColor: '#06B6D4' },
  { id: 4, name: 'SINGH, Vikram', initials: 'VS', position: 4, totalWorkouts: 108, weeklyHours: 10.2, currentStreak: 15, lastActivity: '22m ago', delta: 0, isMoving: false, teamColor: '#8B5CF6' },
  { id: 5, name: 'CHEN, Maya', initials: 'MC', position: 5, totalWorkouts: 105, weeklyHours: 9.5, currentStreak: 12, lastActivity: '5m ago', delta: 0, isMoving: false, teamColor: '#F97316' },
  { id: 6, name: 'KUMAR, Rajesh', initials: 'RK', position: 6, totalWorkouts: 98, weeklyHours: 8.9, currentStreak: 10, lastActivity: '31m ago', delta: 0, isMoving: false, teamColor: '#EF4444' },
  { id: 7, name: 'MARTINEZ, Sofia', initials: 'SM', position: 7, totalWorkouts: 94, weeklyHours: 8.2, currentStreak: 8, lastActivity: '12m ago', delta: 0, isMoving: false, teamColor: '#EC4899' },
  { id: 8, name: 'LEE, David', initials: 'DL', position: 8, totalWorkouts: 89, weeklyHours: 7.8, currentStreak: 7, lastActivity: '18m ago', delta: 0, isMoving: false, teamColor: '#10B981' },
];

const ACTIVITY_FEED = [
  { icon: '🔥', text: 'PATEL just completed workout #118' },
  { icon: '🏆', text: 'SHARMA overtakes P1 position' },
  { icon: '💪', text: 'WILLIAMS sets new personal record' },
  { icon: '⚡', text: 'SINGH gains +2 positions' },
  { icon: '🎯', text: 'CHEN maintains 12-day streak' },
  { icon: '🏋️', text: 'KUMAR hits 98 total workouts' },
];

function Avatar({ initials, color, size = 'md' }: { initials: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl',
  };

  return (
    <div
      className={`flex items-center justify-center rounded-sm font-bold ${sizes[size]}`}
      style={{
        backgroundColor: color,
        boxShadow: `0 0 20px ${color}60`,
      }}
    >
      {initials}
    </div>
  );
}

function RacingHeader() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      {/* Top bar with live indicator */}
      <div className="px-12 py-4 flex items-center justify-between" style={{ backgroundColor: '#121A22' }}>
        <div className="flex items-center gap-6">
          <motion.div
            className="flex items-center gap-3"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#EF4444' }} />
            <span className="text-2xl font-bold tracking-wider">LIVE</span>
          </motion.div>
          <div className="w-px h-8" style={{ backgroundColor: '#FBBF24' }} />
          <div>
            <div className="text-sm opacity-60 uppercase tracking-wider">FitForge Championship</div>
            <div className="text-2xl font-bold tracking-wide" style={{ color: '#FBBF24' }}>LEADERBOARD</div>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-sm opacity-60 uppercase tracking-wider">Session Time</div>
            <div className="text-3xl font-mono font-bold">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          </div>
          <div className="w-px h-12" style={{ backgroundColor: '#06B6D4' }} />
          <div>
            <div className="text-sm opacity-60 uppercase tracking-wider">Date</div>
            <div className="text-xl font-bold">{time.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* Racing stripe */}
      <motion.div
        className="h-2"
        style={{
          background: 'linear-gradient(90deg, #EF4444 0%, #FBBF24 25%, #22C55E 50%, #06B6D4 75%, #8B5CF6 100%)',
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 0%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}

function RacingLeaderboardRow({ member, index }: { member: LeaderboardMember; index: number }) {
  const isLeader = member.position === 1;
  const isPodium = member.position <= 3;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{
        layout: { duration: 0.6, type: 'spring', stiffness: 100 },
        opacity: { duration: 0.3 },
      }}
      className="relative mb-3"
    >
      {/* Background card */}
      <div
        className="relative overflow-hidden"
        style={{
          backgroundColor: isLeader ? '#1A1F2E' : '#121A22',
          border: isPodium ? `2px solid ${member.teamColor}40` : '2px solid transparent',
          borderLeft: `6px solid ${member.teamColor}`,
        }}
      >
        {/* Racing stripes for leader */}
        {isLeader && (
          <div className="absolute inset-0 opacity-10">
            <motion.div
              className="h-full"
              style={{
                background: `repeating-linear-gradient(
                  45deg,
                  ${member.teamColor}00,
                  ${member.teamColor}00 10px,
                  ${member.teamColor} 10px,
                  ${member.teamColor} 20px
                )`,
              }}
              animate={{ x: [0, 20] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        <div className="relative px-6 py-5 flex items-center gap-6">
          {/* Position */}
          <div className="flex items-center gap-4 min-w-[180px]">
            <div
              className="w-16 h-16 flex items-center justify-center font-mono text-3xl font-bold"
              style={{
                backgroundColor: isPodium ? `${member.teamColor}20` : '#0B0F14',
                color: isPodium ? member.teamColor : 'white',
              }}
            >
              {member.position}
            </div>

            {/* Delta indicator */}
            <div className="w-12">
              {member.delta > 0 && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="flex flex-col items-center"
                >
                  <TrendingUp className="w-6 h-6" style={{ color: '#22C55E' }} />
                  <span className="text-xs font-bold" style={{ color: '#22C55E' }}>+{member.delta}</span>
                </motion.div>
              )}
              {member.delta < 0 && (
                <motion.div
                  initial={{ scale: 0, rotate: 180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="flex flex-col items-center"
                >
                  <TrendingDown className="w-6 h-6" style={{ color: '#EF4444' }} />
                  <span className="text-xs font-bold" style={{ color: '#EF4444' }}>{member.delta}</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Driver info */}
          <div className="flex items-center gap-4 min-w-[400px]">
            <Avatar initials={member.initials} color={member.teamColor} size="lg" />
            <div>
              <div className="text-2xl font-bold tracking-wide uppercase">{member.name}</div>
              <div className="text-sm opacity-60 flex items-center gap-2 mt-1">
                <Clock className="w-3 h-3" />
                Last activity: {member.lastActivity}
              </div>
            </div>
          </div>

          {/* Stats - Sector times style */}
          <div className="flex-1 grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-xs opacity-60 uppercase tracking-wider mb-1">Workouts</div>
              <div className="text-2xl font-mono font-bold">{member.totalWorkouts}</div>
            </div>
            <div className="text-center">
              <div className="text-xs opacity-60 uppercase tracking-wider mb-1">Weekly Hrs</div>
              <div className="text-2xl font-mono font-bold" style={{ color: '#06B6D4' }}>{member.weeklyHours}</div>
            </div>
            <div className="text-center">
              <div className="text-xs opacity-60 uppercase tracking-wider mb-1">Streak</div>
              <div className="text-2xl font-mono font-bold flex items-center justify-center gap-2" style={{ color: '#F97316' }}>
                <Flame className="w-5 h-5" />
                {member.currentStreak}
              </div>
            </div>
          </div>

          {/* Champion indicator */}
          {isLeader && (
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            >
              <Trophy className="w-10 h-10" style={{ color: '#FBBF24' }} />
            </motion.div>
          )}
        </div>

        {/* Moving indicator */}
        {member.isMoving && (
          <motion.div
            className="absolute right-0 top-0 bottom-0 w-2"
            style={{ backgroundColor: member.teamColor }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  );
}

function RacingLeaderboard() {
  const [leaderboard, setLeaderboard] = useState(INITIAL_LEADERBOARD);

  // Simulate position changes like in a race
  useEffect(() => {
    const interval = setInterval(() => {
      setLeaderboard((prev) => {
        const newBoard = [...prev];

        // Randomly swap positions
        if (Math.random() > 0.6) {
          const idx1 = Math.floor(Math.random() * (newBoard.length - 1));
          const idx2 = idx1 + 1;

          // Swap positions
          [newBoard[idx1], newBoard[idx2]] = [newBoard[idx2], newBoard[idx1]];

          // Update position numbers and deltas
          newBoard[idx1].position = idx1 + 1;
          newBoard[idx2].position = idx2 + 1;
          newBoard[idx1].delta = -1;
          newBoard[idx2].delta = 1;
          newBoard[idx1].isMoving = true;
          newBoard[idx2].isMoving = true;

          // Clear delta after animation
          setTimeout(() => {
            setLeaderboard((current) =>
              current.map((m) =>
                m.id === newBoard[idx1].id || m.id === newBoard[idx2].id
                  ? { ...m, delta: 0, isMoving: false }
                  : m
              )
            );
          }, 2000);
        }

        return newBoard;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="px-12 py-8">
      <div className="flex items-center gap-4 mb-6">
        <div
          className="px-6 py-2 text-xl font-bold uppercase tracking-wider"
          style={{ backgroundColor: '#FBBF24', color: '#0B0F14' }}
        >
          STANDINGS
        </div>
        <div className="text-sm opacity-60 uppercase tracking-wider">Real-time rankings</div>
      </div>

      <AnimatePresence mode="popLayout">
        {leaderboard.map((member, index) => (
          <RacingLeaderboardRow key={member.id} member={member} index={index} />
        ))}
      </AnimatePresence>
    </div>
  );
}


function RacingTicker() {
  const duplicatedFeed = [...ACTIVITY_FEED, ...ACTIVITY_FEED, ...ACTIVITY_FEED, ...ACTIVITY_FEED];

  return (
    <div className="fixed bottom-0 left-0 right-0 overflow-hidden" style={{ backgroundColor: '#0B0F14', borderTop: '3px solid #FBBF24' }}>
      <div className="py-4 px-4 flex items-center gap-4" style={{ backgroundColor: '#1A1F2E' }}>
        <div className="px-4 py-1 font-bold uppercase tracking-wider text-sm" style={{ backgroundColor: '#EF4444', color: 'white' }}>
          LIVE
        </div>
        <motion.div
          className="flex gap-16 whitespace-nowrap"
          animate={{
            x: [0, -1800],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {duplicatedFeed.map((item, index) => (
            <div key={index} className="flex items-center gap-4 text-lg">
              <span className="text-2xl">{item.icon}</span>
              <span className="font-semibold uppercase tracking-wide">{item.text}</span>
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#FBBF24' }} />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div
      className="w-screen h-screen text-white overflow-hidden relative"
      style={{
        backgroundColor: '#0B0F14',
        backgroundImage: `
          linear-gradient(to bottom, #0B0F14 0%, #1A1F2E 100%),
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255, 255, 255, 0.02) 2px,
            rgba(255, 255, 255, 0.02) 4px
          )
        `,
      }}
    >
      {/* Subtle grid overlay for racing feel */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(rgba(251, 191, 36, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(251, 191, 36, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Corner accents */}
      <div
        className="absolute top-0 right-0 w-96 h-96 blur-3xl opacity-20"
        style={{
          background: 'radial-gradient(circle, #FBBF24 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-96 h-96 blur-3xl opacity-20"
        style={{
          background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)',
        }}
      />

      <div className="relative h-full flex flex-col">
        <RacingHeader />

        <div className="flex-1 overflow-y-auto pb-20">
          <RacingLeaderboard />
        </div>

        <RacingTicker />
      </div>
    </div>
  );
}
