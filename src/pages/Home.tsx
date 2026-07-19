import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { db, auth } from '../App';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { appendToSheet } from '../lib/sheets';
import { Plus } from 'lucide-react';

const MOODS = [
  { key: 'energetic', emoji: '⚡', text: 'Energetic' },
  { key: 'good/productive', emoji: '😊', text: 'Good/Productive' },
  { key: 'average', emoji: '😐', text: 'Average' },
  { key: 'bad/zero day', emoji: '😕', text: 'Bad/Zero Day' },
  { key: 'awful', emoji: '📉', text: 'Awful' },
];

export default function Home() {
  const [date] = useState(new Date());
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayName = format(date, 'EEEE');

  // Goals
  const [goals, setGoals] = useState<{text: string, done: boolean}[]>([{text: '', done: false}, {text: '', done: false}, {text: '', done: false}]);
  const [savingGoals, setSavingGoals] = useState(false);

  // Health & Mood
  const [mood, setMood] = useState('');
  const [weight, setWeight] = useState('');
  const [workoutCategory, setWorkoutCategory] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [foodHealthy, setFoodHealthy] = useState('');
  const [foodJunk, setFoodJunk] = useState('');
  const [foodOut, setFoodOut] = useState('');
  const [savingHealth, setSavingHealth] = useState(false);

  // Study
  const [schoolNotes, setSchoolNotes] = useState('');
  const [learningNotes, setLearningNotes] = useState('');
  const [practiceHours, setPracticeHours] = useState('');
  const [savingStudy, setSavingStudy] = useState(false);

  // Work
  const [workNotes, setWorkNotes] = useState('');
  const [networkNotes, setNetworkNotes] = useState('');
  const [savingWork, setSavingWork] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        
        // Load Goals
        const gSnap = await getDoc(doc(db, 'users', uid, 'daily', dateStr));
        if (gSnap.exists()) {
          const data = gSnap.data();
          if (data.goals) setGoals(data.goals.map((g: any) => typeof g === 'string' ? { text: g, done: false } : g));
        }

        // Load Health & Mood
        const hSnap = await getDoc(doc(db, 'users', uid, 'healthLogs', dateStr));
        if (hSnap.exists()) {
          const data = hSnap.data();
          setWeight(data.weight || '');
          setWorkoutCategory(data.workoutCategory || '');
          setWorkoutNotes(data.workoutNotes || '');
          setFoodHealthy(data.foodHealthy?.join(', ') || '');
          setFoodJunk(data.foodJunk?.join(', ') || '');
          setFoodOut(data.foodOut?.join(', ') || '');
          setMood(data.mood || '');
        } else {
          // Fallback if mood is in old moodLogs
          const mSnap = await getDoc(doc(db, 'users', uid, 'moodLogs', dateStr));
          if (mSnap.exists()) {
            setMood(mSnap.data().mood || '');
          }
        }

        // Load Study
        const sSnap = await getDoc(doc(db, 'users', uid, 'studyLogs', dateStr));
        if (sSnap.exists()) {
          const data = sSnap.data();
          setSchoolNotes(data.schoolNotes || '');
          setLearningNotes(data.learningNotes || '');
          setPracticeHours(data.practiceHours || '');
        }

        // Load Work
        const wSnap = await getDoc(doc(db, 'users', uid, 'workLogs', dateStr));
        if (wSnap.exists()) {
          const data = wSnap.data();
          setWorkNotes(data.workNotes || '');
          setNetworkNotes(data.networkNotes || '');
        }
        
      } catch (err: any) {
        console.warn("Firestore load error:", err.message);
      }
    }
    loadData();
  }, [dateStr]);

  const saveGoals = async () => {
    if (!auth.currentUser) return;
    try {
      const confirmed = window.confirm('Save goals to Firebase and append to Google Sheets?');
      if (!confirmed) return;
      setSavingGoals(true);
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'daily', dateStr), { goals }, { merge: true });
      await appendToSheet('Sheet1!A:J', [[dateStr, goals.map(g => g.text).join(' | '), '', '', '', '', '', '', '', '']]);
    } catch (err: any) {
      console.warn("Save error:", err.message);
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingGoals(false);
    }
  };

  const handleGoalChange = (index: number, val: string) => {
    const newGoals = [...goals];
    newGoals[index].text = val;
    setGoals(newGoals);
  };
  const toggleGoalDone = (index: number) => {
    const newGoals = [...goals];
    newGoals[index].done = !newGoals[index].done;
    setGoals(newGoals);
  };

  const addGoal = () => {
    setGoals([...goals, '']);
  };

  const saveHealth = async () => {
    if (!auth.currentUser) return;
    try {
      const confirmed = window.confirm('Save health log to Firebase and append to Google Sheets?');
      if (!confirmed) return;
      setSavingHealth(true);
      
      const docRef = doc(db, 'users', auth.currentUser.uid, 'healthLogs', dateStr);
      await setDoc(docRef, {
        date: dateStr,
        weight: Number(weight) || 0,
        workoutCategory,
        workoutNotes,
        foodHealthy: foodHealthy.split(',').map(s=>s.trim()).filter(Boolean),
        foodJunk: foodJunk.split(',').map(s=>s.trim()).filter(Boolean),
        foodOut: foodOut.split(',').map(s=>s.trim()).filter(Boolean),
        mood,
        updatedAt: new Date()
      }, { merge: true });

      // Save to old moodLogs as well for backwards compatibility in history
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'moodLogs', dateStr), {
        date: dateStr, mood, updatedAt: new Date()
      }, { merge: true });

      await appendToSheet('Sheet1!A:J', [
        [
          dateStr,
          '',
          mood,
          weight,
          workoutCategory,
          workoutNotes,
          `Healthy: ${foodHealthy}\nJunk: ${foodJunk}\nOut: ${foodOut}`,
          '',
          '',
          ''
        ]
      ]);
    } catch (err: any) {
      console.warn("Save error:", err.message);
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingHealth(false);
    }
  };

  const saveStudy = async () => {
    if (!auth.currentUser) return;
    try {
      const confirmed = window.confirm('Save study log to Firebase and append to Google Sheets?');
      if (!confirmed) return;
      setSavingStudy(true);
      const docRef = doc(db, 'users', auth.currentUser.uid, 'studyLogs', dateStr);
      await setDoc(docRef, {
        date: dateStr,
        schoolNotes,
        learningNotes,
        practiceHours: Number(practiceHours) || 0,
        updatedAt: new Date()
      }, { merge: true });

      await appendToSheet('Sheet1!A:J', [
        [
          dateStr,
          '',
          '',
          '',
          '',
          '',
          '',
          practiceHours,
          `School: ${schoolNotes}\nLearning: ${learningNotes}`,
          ''
        ]
      ]);
    } catch (err: any) {
      console.warn("Save error:", err.message);
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingStudy(false);
    }
  };

  const saveWork = async () => {
    if (!auth.currentUser) return;
    try {
      const confirmed = window.confirm('Save work log to Firebase and append to Google Sheets?');
      if (!confirmed) return;
      setSavingWork(true);
      const docRef = doc(db, 'users', auth.currentUser.uid, 'workLogs', dateStr);
      await setDoc(docRef, {
        date: dateStr,
        workNotes,
        networkNotes,
        updatedAt: new Date()
      }, { merge: true });

      await appendToSheet('Sheet1!A:J', [
        [
          dateStr,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          `Work: ${workNotes}\nNet: ${networkNotes}`
        ]
      ]);
    } catch (err: any) {
      console.warn("Save error:", err.message);
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingWork(false);
    }
  };

  const categories = ['Push', 'Pull', 'Legs', 'Core', 'Mobility', 'Running', 'Sports'];

  return (
    <div className="p-6 pb-24 max-w-xl mx-auto space-y-12">
      <div className="text-center space-y-2 mb-8">
        <h1 className="font-serif text-5xl font-light text-text-primary">{format(date, 'dd')}</h1>
        <div className="text-xs text-text-secondary tracking-[3px] uppercase">
          {format(date, 'MMMM yyyy')} • {dayName}
        </div>
      </div>

      {/* GOALS */}
      <section className="bg-bg-secondary p-5 rounded-2xl border border-bg-tertiary space-y-4">
        <h2 className="text-xs font-semibold tracking-[3px] uppercase text-text-primary border-b border-bg-tertiary pb-3">Today's Goals</h2>
        <div className="space-y-3">
          {goals.map((goal, i) => (
            <div key={i} className="flex items-center gap-3">
              <button 
                onClick={() => toggleGoalDone(i)}
                className={`w-6 h-6 flex-shrink-0 flex items-center justify-center border rounded-full text-xs transition-colors ${goal.done ? 'bg-accent-amber border-accent-amber text-bg-primary' : 'border-bg-tertiary text-text-tertiary hover:border-text-secondary'}`}
              >
                {goal.done ? '✓' : i + 1}
              </button>
              <input 
                type="text"
                value={goal.text}
                onChange={(e) => handleGoalChange(i, e.target.value)}
                placeholder="Set a goal..."
                className={`flex-1 bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-amber transition-colors ${goal.done ? 'line-through text-text-tertiary' : ''}`}
              />
            </div>
          ))}
          <button 
            onClick={addGoal}
            className="flex items-center gap-2 text-xs text-text-tertiary uppercase tracking-widest hover:text-accent-amber transition-colors ml-9 mt-2"
          >
            <Plus size={14} /> Add Goal
          </button>
        </div>
        <button 
          onClick={saveGoals}
          disabled={savingGoals}
          className="w-full mt-4 py-3 bg-bg-tertiary text-text-primary font-semibold tracking-widest text-[10px] rounded-xl uppercase active:scale-95 transition-transform disabled:opacity-50"
        >
          {savingGoals ? 'Saving...' : 'Save Goals'}
        </button>
      </section>

      {/* HEALTH & MOOD */}
      <section className="bg-bg-secondary p-5 rounded-2xl border border-bg-tertiary space-y-6">
        <h2 className="text-xs font-semibold tracking-[3px] uppercase text-accent-teal border-b border-bg-tertiary pb-3">Health & Mood</h2>
        
        <div className="space-y-3">
          <h3 className="text-[10px] tracking-[2px] uppercase text-text-tertiary mb-2">Mood Check-in</h3>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMood(m.key === mood ? '' : m.key)}
                className={`p-2 rounded-lg border text-lg transition-all ${
                  mood === m.key
                    ? 'border-accent-teal bg-accent-teal/10'
                    : 'border-bg-tertiary text-text-secondary hover:border-text-tertiary'
                }`}
                title={m.text}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Weight (kg)</label>
          <input 
            type="number" 
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-teal transition-colors"
            placeholder="e.g. 70.5"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Workout Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setWorkoutCategory(cat === workoutCategory ? '' : cat)}
                className={`px-3 py-1.5 rounded-lg border text-xs tracking-wider transition-colors ${
                  workoutCategory === cat 
                    ? 'border-accent-teal bg-accent-teal/10 text-accent-teal' 
                    : 'border-bg-tertiary text-text-secondary hover:border-text-tertiary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary mt-3">Workout Journal</label>
          <textarea 
            value={workoutNotes}
            onChange={(e) => setWorkoutNotes(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm min-h-[80px] focus:outline-none focus:border-accent-teal transition-colors"
            placeholder="e.g. Bench Press: 4x6 @ 60kg"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary mb-2">Nutrition</label>
          <input type="text" value={foodHealthy} onChange={e=>setFoodHealthy(e.target.value)} className="w-full bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-accent-teal" placeholder="Healthy (e.g. Salad)" />
          <input type="text" value={foodJunk} onChange={e=>setFoodJunk(e.target.value)} className="w-full bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-accent-teal" placeholder="Junk (e.g. Chips)" />
          <input type="text" value={foodOut} onChange={e=>setFoodOut(e.target.value)} className="w-full bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-accent-teal" placeholder="Eating out (e.g. Sushi)" />
        </div>

        <button 
          onClick={saveHealth}
          disabled={savingHealth}
          className="w-full py-3 bg-accent-teal text-[#1a0f07] font-semibold tracking-widest text-[10px] rounded-xl uppercase active:scale-95 transition-transform disabled:opacity-50"
        >
          {savingHealth ? 'Saving...' : 'Save Health & Mood'}
        </button>
      </section>

      {/* STUDY */}
      <section className="bg-bg-secondary p-5 rounded-2xl border border-bg-tertiary space-y-4">
        <h2 className="text-xs font-semibold tracking-[3px] uppercase text-accent-amber border-b border-bg-tertiary pb-3">Study & Learning</h2>
        
        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Practice Hours</label>
          <input 
            type="number" 
            value={practiceHours}
            onChange={(e) => setPracticeHours(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-amber transition-colors"
            placeholder="e.g. 2.5"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">School / Formal Coursework</label>
          <textarea 
            value={schoolNotes}
            onChange={(e) => setSchoolNotes(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm min-h-[80px] focus:outline-none focus:border-accent-amber transition-colors"
            placeholder="e.g. Math: Revised Chapter 4."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Self-Learning</label>
          <textarea 
            value={learningNotes}
            onChange={(e) => setLearningNotes(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm min-h-[80px] focus:outline-none focus:border-accent-amber transition-colors"
            placeholder="e.g. Read 20 pages of a book."
          />
        </div>

        <button 
          onClick={saveStudy}
          disabled={savingStudy}
          className="w-full py-3 bg-accent-amber text-[#1a0f07] font-semibold tracking-widest text-[10px] rounded-xl uppercase active:scale-95 transition-transform disabled:opacity-50"
        >
          {savingStudy ? 'Saving...' : 'Save Study Log'}
        </button>
      </section>

      {/* WORK */}
      <section className="bg-bg-secondary p-5 rounded-2xl border border-bg-tertiary space-y-4">
        <h2 className="text-xs font-semibold tracking-[3px] uppercase text-accent-red border-b border-bg-tertiary pb-3">Work</h2>
        
        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Projects & Jobs</label>
          <textarea 
            value={workNotes}
            onChange={(e) => setWorkNotes(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm min-h-[80px] focus:outline-none focus:border-accent-red transition-colors"
            placeholder="e.g. Built feature X for work."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Networking</label>
          <textarea 
            value={networkNotes}
            onChange={(e) => setNetworkNotes(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm min-h-[80px] focus:outline-none focus:border-accent-red transition-colors"
            placeholder="e.g. Met with team regarding Y."
          />
        </div>

        <button 
          onClick={saveWork}
          disabled={savingWork}
          className="w-full py-3 bg-accent-red text-[#1a0f07] font-semibold tracking-widest text-[10px] rounded-xl uppercase active:scale-95 transition-transform disabled:opacity-50"
        >
          {savingWork ? 'Saving...' : 'Save Work Log'}
        </button>
      </section>
    </div>
  );
}
