import fs from 'fs';

const content = `import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../App';
import { subDays, parseISO, isAfter, format } from 'date-fns';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<'Health' | 'Study' | 'Work'>('Health');
  const [timeRange, setTimeRange] = useState<7 | 30 | 365>(30);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [studyLogs, setStudyLogs] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [moodLogs, setMoodLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        
        // Fetch up to 365 days
        const hQ = query(collection(db, 'users', uid, 'healthLogs'), orderBy('date', 'asc'), limit(365));
        const hSnap = await getDocs(hQ);
        setHealthLogs(hSnap.docs.map(d => d.data()));

        const sQ = query(collection(db, 'users', uid, 'studyLogs'), orderBy('date', 'asc'), limit(365));
        const sSnap = await getDocs(sQ);
        setStudyLogs(sSnap.docs.map(d => d.data()));

        const wQ = query(collection(db, 'users', uid, 'workLogs'), orderBy('date', 'asc'), limit(365));
        const wSnap = await getDocs(wQ);
        setWorkLogs(wSnap.docs.map(d => d.data()));

        const mQ = query(collection(db, 'users', uid, 'moodLogs'), orderBy('date', 'asc'), limit(365));
        const mSnap = await getDocs(mQ);
        setMoodLogs(mSnap.docs.map(d => d.data()));
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

  // --- HEALTH METRICS ---
  const calculateVolume = (notes: string) => {
    if (!notes) return 0;
    let total = 0;
    const lines = notes.split('\\n');
    for (const line of lines) {
      const match = line.match(/(\\d+)\\s*x\\s*(\\d+)\\s*@\\s*(\\d+(?:\\.\\d+)?)/i);
      if (match) {
        total += parseInt(match[1], 10) * parseInt(match[2], 10) * parseFloat(match[3]);
      }
    }
    return total;
  };

  const weightData = useMemo(() => {
    return filteredHealth.map(l => ({
      date: format(parseISO(l.date), 'MMM d'),
      weight: parseFloat(l.weight) || 0,
    })).filter(l => l.weight > 0);
  }, [filteredHealth]);

  const volumeData = useMemo(() => {
    return filteredHealth.map(l => ({
      date: format(parseISO(l.date), 'MMM d'),
      volume: calculateVolume(l.workoutNotes),
    })).filter(l => l.volume > 0);
  }, [filteredHealth]);

  const avgWeight = useMemo(() => {
    const weights = filteredHealth.map(l => parseFloat(l.weight)).filter(w => w > 0);
    if (!weights.length) return 0;
    return (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1);
  }, [filteredHealth]);

  const workoutCategoriesCount = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredHealth.forEach(l => {
      const cat = l.workoutCategory;
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [filteredHealth]);

  const workoutDoughnutData = useMemo(() => {
    return Object.keys(workoutCategoriesCount).map((key) => ({
      name: key,
      value: workoutCategoriesCount[key],
    }));
  }, [workoutCategoriesCount]);

  const COLORS = ['#4ade80', '#38bdf8', '#818cf8', '#fbbf24', '#f87171', '#c084fc', '#f472b6'];

  const moodMap: Record<string, number> = {
    'energetic': 5,
    'good/productive': 4,
    'average': 3,
    'bad/zero day': 2,
    'awful': 1,
  };

  const moodLabels = ['', 'Awful', 'Bad', 'Average', 'Good', 'Energetic'];

  // Some mood logs are now stored directly in healthLogs, so let's combine them
  const combinedMoods = useMemo(() => {
    const map = new Map();
    filteredMood.forEach(m => map.set(m.date, m.mood));
    filteredHealth.forEach(h => {
      if (h.mood) map.set(h.date, h.mood);
    });
    // sort by date
    return Array.from(map.entries())
      .map(([date, mood]) => ({ 
        date: format(parseISO(date), 'MMM d'), 
        moodLevel: moodMap[mood?.toLowerCase()] || 3,
        moodRaw: mood
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredMood, filteredHealth]);

  // --- STUDY METRICS ---
  const studyData = useMemo(() => {
    return filteredStudy.map(l => ({
      date: format(parseISO(l.date), 'MMM d'),
      hours: Number(l.practiceHours) || 0,
    })).filter(l => l.hours > 0);
  }, [filteredStudy]);
  
  const totalStudyHours = useMemo(() => {
    return filteredStudy.reduce((a, l) => a + (Number(l.practiceHours) || 0), 0);
  }, [filteredStudy]);

  // --- WORK METRICS ---
  const workDays = filteredWork.length;
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-primary border border-bg-tertiary p-3 rounded-lg shadow-xl text-xs">
          <p className="text-text-secondary mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="font-mono">
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const MoodTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-primary border border-bg-tertiary p-3 rounded-lg shadow-xl text-xs">
          <p className="text-text-secondary mb-1">{label}</p>
          <p style={{ color: payload[0].color }} className="font-mono">
            {payload[0].payload.moodRaw}
          </p>
        </div>
      );
    }
    return null;
  };


  return (
    <div className="p-6 pb-24 max-w-xl mx-auto space-y-8 text-text-primary">
      <h1 className="font-serif text-3xl tracking-widest uppercase">Analytics</h1>
      
      {loading ? (
        <div className="text-center text-text-tertiary py-10 animate-pulse text-xs tracking-widest uppercase">Loading Data...</div>
      ) : (
        <div className="space-y-8">
          
          <div className="flex gap-2 p-1 bg-bg-secondary rounded-lg">
            {['Health', 'Study', 'Work'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={\`flex-1 py-2 text-[10px] tracking-widest uppercase rounded-md transition-colors \${
                  activeTab === tab ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'
                }\`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-b border-bg-tertiary pb-4">
            {[
              { label: '7D', val: 7 },
              { label: '30D', val: 30 },
              { label: 'ALL', val: 365 },
            ].map(t => (
              <button
                key={t.val}
                onClick={() => setTimeRange(t.val as any)}
                className={\`px-3 py-1 text-[10px] tracking-widest uppercase rounded border transition-colors \${
                  timeRange === t.val 
                    ? 'border-text-primary text-text-primary bg-bg-secondary' 
                    : 'border-bg-tertiary text-text-tertiary'
                }\`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'Health' && (
            <div className="space-y-12 animate-in fade-in zoom-in-95 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-secondary border border-bg-tertiary p-4 rounded-xl text-center space-y-1">
                  <div className="text-[10px] tracking-[2px] uppercase text-text-tertiary">Avg Weight</div>
                  <div className="text-2xl font-serif">{avgWeight} <span className="text-sm font-sans text-text-secondary">kg</span></div>
                </div>
                <div className="bg-bg-secondary border border-bg-tertiary p-4 rounded-xl text-center space-y-1">
                  <div className="text-[10px] tracking-[2px] uppercase text-text-tertiary">Workouts Logged</div>
                  <div className="text-2xl font-serif">{Object.values(workoutCategoriesCount).reduce((a, b) => a + b, 0)}</div>
                </div>
              </div>

              <section className="space-y-4">
                <h2 className="text-[10px] tracking-[3px] uppercase text-text-tertiary">Body Weight Progress</h2>
                <div className="bg-bg-secondary border border-bg-tertiary p-4 rounded-xl h-64">
                  {weightData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weightData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bg-tertiary)" vertical={false} />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="#4ade80" strokeWidth={2} dot={{ r: 3, fill: '#4ade80' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center text-xs text-text-tertiary py-6">No data in this period.</div>}
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-[10px] tracking-[3px] uppercase text-text-tertiary">Workout Distribution</h2>
                <div className="bg-bg-secondary border border-bg-tertiary p-6 rounded-xl h-64 flex items-center justify-center">
                  {workoutDoughnutData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={workoutDoughnutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {workoutDoughnutData.map((entry, index) => (
                            <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-xs text-text-tertiary py-6">No workouts in this period.</div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-[10px] tracking-[3px] uppercase text-text-tertiary">Workout Intensity (Volume)</h2>
                <div className="bg-bg-secondary border border-bg-tertiary p-4 rounded-xl h-64">
                  {volumeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bg-tertiary)" vertical={false} />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="volume" name="Volume" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3, fill: '#38bdf8' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center text-xs text-text-tertiary py-6">No data in this period.</div>}
                </div>
                <p className="text-[10px] text-text-tertiary mt-2">
                  * Calculates total volume (Sets × Reps × Weight) from workout notes.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-[10px] tracking-[3px] uppercase text-text-tertiary">Mood Trends</h2>
                <div className="bg-bg-secondary border border-bg-tertiary p-4 rounded-xl h-64">
                  {combinedMoods.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={combinedMoods} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bg-tertiary)" vertical={false} />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis 
                          stroke="#9ca3af" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          domain={[1, 5]} 
                          ticks={[1, 2, 3, 4, 5]}
                          tickFormatter={(val) => moodLabels[val]}
                        />
                        <RechartsTooltip content={<MoodTooltip />} />
                        <Line type="monotone" dataKey="moodLevel" name="Mood" stroke="#818cf8" strokeWidth={2} dot={{ r: 3, fill: '#818cf8' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center text-xs text-text-tertiary py-6">No data in this period.</div>}
                </div>
              </section>

            </div>
          )}

          {activeTab === 'Study' && (
            <div className="space-y-12 animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-bg-secondary border border-bg-tertiary p-6 rounded-xl text-center space-y-2">
                <div className="text-[10px] tracking-[2px] uppercase text-text-tertiary">Total Practice Hours</div>
                <div className="text-4xl font-serif text-accent-amber">{totalStudyHours}</div>
              </div>
              <section className="space-y-4">
                <h2 className="text-[10px] tracking-[3px] uppercase text-text-tertiary">Study / Coursework</h2>
                <div className="bg-bg-secondary border border-bg-tertiary p-4 rounded-xl h-64">
                  {studyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={studyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bg-tertiary)" vertical={false} />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(251, 191, 36, 0.1)' }} />
                        <Bar dataKey="hours" name="Practice Hours" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center text-xs text-text-tertiary py-6">No data in this period.</div>}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Work' && (
            <div className="space-y-12 animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-bg-secondary border border-bg-tertiary p-6 rounded-xl text-center space-y-2">
                <div className="text-[10px] tracking-[2px] uppercase text-text-tertiary">Days Worked</div>
                <div className="text-4xl font-serif text-accent-red">{workDays}</div>
              </div>
              
              <div className="text-center text-text-tertiary text-xs mt-10 tracking-widest uppercase">
                Keep logging your projects and networking to see more metrics!
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
`

fs.writeFileSync('src/pages/Analytics.tsx', content);
