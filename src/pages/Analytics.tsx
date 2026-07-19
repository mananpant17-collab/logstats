import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../App';
import { subDays, parseISO, isAfter, format, startOfMonth, isSameMonth } from 'date-fns';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<'Health' | 'Study' | 'Work'>('Health');
  const [timeRange, setTimeRange] = useState<7 | 30 | 365>(30);
  
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [studyLogs, setStudyLogs] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [moodLogs, setMoodLogs] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        
        const hQ = query(collection(db, 'users', uid, 'healthLogs'), orderBy('date', 'asc'), limit(365));
        const sQ = query(collection(db, 'users', uid, 'studyLogs'), orderBy('date', 'asc'), limit(365));
        const wQ = query(collection(db, 'users', uid, 'workLogs'), orderBy('date', 'asc'), limit(365));
        const mQ = query(collection(db, 'users', uid, 'moodLogs'), orderBy('date', 'asc'), limit(365));
        const dQ = query(collection(db, 'users', uid, 'daily'), orderBy('date', 'asc'), limit(365));

        const [hSnap, sSnap, wSnap, mSnap, dSnap] = await Promise.all([
          getDocs(hQ), getDocs(sQ), getDocs(wQ), getDocs(mQ), getDocs(dQ)
        ]);

        setHealthLogs(hSnap.docs.map(d => d.data()));
        setStudyLogs(sSnap.docs.map(d => d.data()));
        setWorkLogs(wSnap.docs.map(d => d.data()));
        setMoodLogs(mSnap.docs.map(d => d.data()));
        setDailyLogs(dSnap.docs.map(d => d.data()));

      } catch (err: any) {
        console.warn("Analytics fetch error:", err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filterByTimeRange = (logs: any[]) => {
    if (timeRange === 365) return logs; // "All time"
    const thresholdDate = subDays(new Date(), timeRange);
    return logs.filter(l => {
      if (!l.date) return false;
      const d = parseISO(l.date);
      return isAfter(d, thresholdDate);
    });
  };

  const filteredHealth = useMemo(() => filterByTimeRange(healthLogs), [healthLogs, timeRange]);
  const filteredStudy = useMemo(() => filterByTimeRange(studyLogs), [studyLogs, timeRange]);
  const filteredWork = useMemo(() => filterByTimeRange(workLogs), [workLogs, timeRange]);
  const filteredMood = useMemo(() => filterByTimeRange(moodLogs), [moodLogs, timeRange]);
  const filteredDaily = useMemo(() => filterByTimeRange(dailyLogs), [dailyLogs, timeRange]);

  // --- HEALTH TAB ---
  
  // Overview
  const currentWeight = useMemo(() => {
    const weights = healthLogs.map(l => parseFloat(l.weight)).filter(w => w > 0);
    return weights.length > 0 ? weights[weights.length - 1] : 0;
  }, [healthLogs]);

  const monthAvgWeight = useMemo(() => {
    const thisMonth = new Date();
    const weights = healthLogs
      .filter(l => l.date && isSameMonth(parseISO(l.date), thisMonth))
      .map(l => parseFloat(l.weight))
      .filter(w => w > 0);
    if (!weights.length) return 0;
    return (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1);
  }, [healthLogs]);

  const workoutsThisMonth = useMemo(() => {
    const thisMonth = new Date();
    return healthLogs.filter(l => l.date && isSameMonth(parseISO(l.date), thisMonth) && l.workoutCategory).length;
  }, [healthLogs]);

  // Weight Data
  const weightData = useMemo(() => {
    return filteredHealth.map(l => ({
      date: format(parseISO(l.date), 'MMM d'),
      weight: parseFloat(l.weight) || null,
    })).filter(l => l.weight !== null);
  }, [filteredHealth]);

  // Mood Data
  const moodMap: Record<string, number> = {
    'energetic': 5,
    'good/productive': 4,
    'average': 3,
    'bad/zero day': 2,
    'awful': 1,
  };
  const moodLabels = ['', 'Awful', 'Bad', 'Average', 'Good', 'Energetic'];
  
  const combinedMoods = useMemo(() => {
    const map = new Map();
    filteredMood.forEach(m => map.set(m.date, m.mood));
    filteredHealth.forEach(h => {
      if (h.mood) map.set(h.date, h.mood);
    });
    return Array.from(map.entries())
      .map(([date, mood]) => ({ 
        dateRaw: date,
        date: format(parseISO(date), 'MMM d'), 
        moodLevel: moodMap[mood?.toLowerCase()] || 3,
        moodRaw: mood
      }))
      .sort((a, b) => new Date(a.dateRaw).getTime() - new Date(b.dateRaw).getTime());
  }, [filteredMood, filteredHealth]);

  // Mood Distribution
  const moodDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    combinedMoods.forEach(m => {
      let key = m.moodRaw || 'Unknown';
      key = key.toLowerCase();
      if (key === 'good/productive') key = 'Good/Calm Day';
      if (key === 'bad/zero day') key = 'Bad/Zero Day';
      // capitalize first
      key = key.charAt(0).toUpperCase() + key.slice(1);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).sort((a, b) => b.value - a.value);
  }, [combinedMoods]);
  const MOOD_COLORS = ['#4ade80', '#fbbf24', '#f87171', '#38bdf8', '#a78bfa'];

  // Monthly Activity (Workouts per month in period)
  const monthlyActivity = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredHealth.forEach(l => {
      if (l.workoutCategory && l.date) {
        const m = format(parseISO(l.date), 'MMM');
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    return Object.keys(counts).map(key => ({ name: key, count: counts[key] }));
  }, [filteredHealth]);

  // Goals
  const goalStats = useMemo(() => {
    let totalGoals = 0;
    let completedGoals = 0;
    filteredDaily.forEach(d => {
      if (d.goals && Array.isArray(d.goals)) {
        d.goals.forEach((g: any) => {
          const text = typeof g === 'string' ? g : g.text;
          const done = typeof g === 'string' ? false : g.done;
          if (text && text.trim()) {
            totalGoals++;
            if (done) completedGoals++;
          }
        });
      }
    });
    const percent = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
    return { percent, totalGoals, completedGoals };
  }, [filteredDaily]);

  // All-time summary
  const workoutRate = useMemo(() => {
    const totalDays = healthLogs.length || 1;
    const workouts = healthLogs.filter(l => l.workoutCategory).length;
    return {
      rate: Math.round((workouts / totalDays) * 100),
      workouts,
      totalDays
    };
  }, [healthLogs]);

  const positiveDays = useMemo(() => {
    const total = combinedMoods.length || 1;
    const positive = combinedMoods.filter(m => m.moodLevel >= 4).length;
    return {
      rate: Math.round((positive / total) * 100),
      positive,
      total
    };
  }, [combinedMoods]);

  // Project weight
  const projectedWeight = useMemo(() => {
    if (weightData.length < 2) return currentWeight;
    const first = weightData[0].weight;
    const last = weightData[weightData.length - 1].weight;
    const diff = last - first;
    return (last + (diff / weightData.length) * 7).toFixed(1);
  }, [weightData, currentWeight]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111111] border border-gray-800 p-2 rounded text-xs text-gray-300">
          <p className="mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="font-mono">
              {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pb-8">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        
        {/* TABS & TIME RANGE */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex gap-2">
            {['Health', 'Study', 'Work'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 text-[10px] tracking-widest uppercase rounded-md transition-colors ${
                  activeTab === tab ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex bg-[#111111] rounded p-1 border border-gray-800">
            {[
              { label: '7D', val: 7 },
              { label: '30D', val: 30 },
              { label: 'ALL', val: 365 },
            ].map(t => (
              <button
                key={t.val}
                onClick={() => setTimeRange(t.val as any)}
                className={`px-4 py-1.5 text-[10px] tracking-widest uppercase rounded transition-colors ${
                  timeRange === t.val 
                    ? 'bg-gray-800 text-gray-100' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-600 py-20 text-xs tracking-widest uppercase animate-pulse">
            Loading Analytics...
          </div>
        ) : (
          <>
            {activeTab === 'Health' && (
              <div className="space-y-12 animate-in fade-in duration-500">
                
                {/* OVERVIEW */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#111] border border-gray-800 p-5 rounded-lg">
                    <div className="text-[10px] tracking-widest uppercase text-gray-500 mb-2">Current</div>
                    <div className="text-3xl text-orange-200/90 font-light">{currentWeight || '--'}</div>
                    <div className="text-[10px] text-gray-600 mt-1">kg today</div>
                  </div>
                  <div className="bg-[#111] border border-gray-800 p-5 rounded-lg">
                    <div className="text-[10px] tracking-widest uppercase text-gray-500 mb-2">Month Avg</div>
                    <div className="text-3xl text-gray-200 font-light">{monthAvgWeight || '--'}</div>
                    <div className="text-[10px] text-gray-600 mt-1">kg</div>
                  </div>
                  <div className="bg-[#111] border border-gray-800 p-5 rounded-lg">
                    <div className="text-[10px] tracking-widest uppercase text-gray-500 mb-2">Workouts</div>
                    <div className="text-3xl text-teal-400/80 font-light">{workoutsThisMonth}</div>
                    <div className="text-[10px] text-gray-600 mt-1">this month</div>
                  </div>
                </div>

                {/* WEIGHT TREND */}
                <section className="space-y-4">
                  <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 ml-1">Weight Trend</h2>
                  <div className="bg-[#0a0a0a] border-y border-gray-800 p-2 h-64 -mx-6 px-6">
                    {weightData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weightData} margin={{ top: 20, right: 0, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="0" stroke="#1f2937" vertical={true} horizontal={true} />
                          <XAxis dataKey="date" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} tickMargin={10} minTickGap={30} />
                          <YAxis stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                          <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#374151' }} />
                          <Line type="monotone" dataKey="weight" name="kg" stroke="#fcd34d" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: '#fcd34d' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <div className="text-center text-xs text-gray-600 py-10">No data</div>}
                  </div>
                </section>

                {/* MOOD JOURNEY */}
                <section className="space-y-4">
                  <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 ml-1">Mood Journey</h2>
                  <div className="bg-[#0a0a0a] border-y border-gray-800 p-2 h-64 -mx-6 px-6">
                    {combinedMoods.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={combinedMoods} margin={{ top: 20, right: 0, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="0" stroke="#1f2937" vertical={true} horizontal={true} />
                          <XAxis dataKey="date" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} tickMargin={10} minTickGap={30} />
                          <YAxis stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickFormatter={() => ''} />
                          <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#374151' }} />
                          <Line type="step" dataKey="moodLevel" name="Mood" stroke="#2dd4bf" strokeWidth={1.5} dot={{ r: 2, fill: '#fcd34d', stroke: 'none' }} activeDot={{ r: 4, fill: '#2dd4bf' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <div className="text-center text-xs text-gray-600 py-10">No data</div>}
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* MONTHLY ACTIVITY */}
                  <section className="space-y-4">
                    <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 ml-1">Monthly Activity</h2>
                    <div className="bg-[#0a0a0a] border-y md:border md:rounded-lg border-gray-800 p-4 h-64 -mx-6 md:mx-0 px-6 md:px-4">
                      {monthlyActivity.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyActivity} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="0" stroke="#1f2937" vertical={true} horizontal={true} />
                            <XAxis dataKey="name" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} tickMargin={10} />
                            <YAxis stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} />
                            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#1f2937' }} />
                            <Bar dataKey="count" name="Workouts" fill="#4b6b63" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <div className="text-center text-xs text-gray-600 py-10">No data</div>}
                    </div>
                  </section>

                  {/* MOOD DISTRIBUTION */}
                  <section className="space-y-4">
                    <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 ml-1">Mood Distribution</h2>
                    <div className="bg-[#111] border-y md:border md:rounded-lg border-gray-800 p-6 flex flex-row items-center gap-8 -mx-6 md:mx-0 h-64">
                      {moodDistribution.length > 0 ? (
                        <>
                          <div className="w-1/2 h-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={moodDistribution}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius="60%"
                                  outerRadius="80%"
                                  paddingAngle={2}
                                  dataKey="value"
                                  stroke="none"
                                >
                                  {moodDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={MOOD_COLORS[index % MOOD_COLORS.length]} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="w-1/2 space-y-3">
                            {moodDistribution.map((entry, i) => {
                              const total = moodDistribution.reduce((a, b) => a + b.value, 0);
                              const pct = Math.round((entry.value / total) * 100);
                              return (
                                <div key={entry.name} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MOOD_COLORS[i % MOOD_COLORS.length] }} />
                                    <span className="text-gray-400">{entry.name}</span>
                                  </div>
                                  <span className="text-gray-300 font-mono">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : <div className="text-center text-xs text-gray-600 py-10 w-full">No data</div>}
                    </div>
                  </section>
                </div>

                {/* ALL-TIME SUMMARY & GOALS */}
                <section className="space-y-4">
                  <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 ml-1">All-Time Summary</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#111] border border-gray-800 p-5 rounded-lg">
                      <div className="text-[10px] tracking-widest uppercase text-gray-500 mb-2">Workout Rate</div>
                      <div className="text-3xl text-teal-400/80 font-light">{workoutRate.rate}%</div>
                      <div className="text-[10px] text-gray-600 mt-1">{workoutRate.workouts} of {workoutRate.totalDays} days</div>
                    </div>
                    <div className="bg-[#111] border border-gray-800 p-5 rounded-lg">
                      <div className="text-[10px] tracking-widest uppercase text-gray-500 mb-2">Positive Days</div>
                      <div className="text-3xl text-emerald-400/80 font-light">{positiveDays.rate}%</div>
                      <div className="text-[10px] text-gray-600 mt-1">{positiveDays.positive} of {positiveDays.total} days good or energetic</div>
                    </div>
                    <div className="bg-[#111] border border-gray-800 p-5 rounded-lg">
                      <div className="text-[10px] tracking-widest uppercase text-gray-500 mb-2">Goals Achieved</div>
                      <div className="text-3xl text-amber-200/90 font-light">{goalStats.percent}%</div>
                      <div className="text-[10px] text-gray-600 mt-1">{goalStats.completedGoals} of {goalStats.totalGoals} goals completed</div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'Study' && (
              <div className="text-center text-gray-500 py-20 text-xs tracking-widest uppercase">
                Study metrics (Coming Soon)
              </div>
            )}
            
            {activeTab === 'Work' && (
              <div className="text-center text-gray-500 py-20 text-xs tracking-widest uppercase">
                Work metrics (Coming Soon)
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
