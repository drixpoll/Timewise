import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, CalendarCheck2, CalendarDays,
  ChartNoAxesColumnIncreasing, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  Coffee, Copy, GraduationCap, LayoutDashboard, Menu, MoreHorizontal, Pause, Pencil,
  Play, Plus, RotateCcw, Settings2, ShieldCheck, Sparkles, Target, Trash2,
  X, BriefcaseBusiness, Heart, Zap
} from 'lucide-react';
import type { Block, Category, EditorValues, Preferences, TimerState, View } from './types';
import {
  asDate, categories, dateKey, daySummary, displayTime, durationMinutes, formatCountdown,
  formatDate, formatDuration, freshId, getWeekStart, loadBlocks, loadPreferences, loadTimer,
  saveBlocks, savePreferences, saveTimer, secondsLeft, shiftDate
} from './lib';
import { enableNotificationPermission, notifyCompleted } from './notifications';
import { isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

type Editor = { id: string | null; date: string } & EditorValues;
const categoryIcons = {
  work: BriefcaseBusiness,
  study: GraduationCap,
  break: Coffee,
  personal: Heart
};
const emptyEditor = (date: string): Editor => ({
  id: null, date, title: '', category: 'work', start: '09:00', end: '10:00', notes: ''
});

function Brand() {
  return <div className="brand">
    <div className="brand-mark"><span className="brand-mark-top"/><span className="brand-mark-middle"/><span className="brand-mark-dot"/></div>
    <div><strong>timewise<span className="brand-period">.</span></strong><small>PLAN WITH PURPOSE</small></div>
  </div>;
}

function CategoryChip({ category }: { category: Category }) {
  const Icon = categoryIcons[category];
  return <span className={`category-chip category-${category}`}><Icon size={13}/>{categories[category].name}</span>;
}

function ProgressRing({ percentage, size = 206, children }: { percentage: number; size?: number; children: React.ReactNode }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  return <div className="timer-ring" style={{ width: size, height: size }}>
    <svg viewBox="0 0 110 110" className="ring-svg" aria-hidden="true">
      <circle cx="55" cy="55" r={radius} stroke="var(--ring-base)" strokeWidth="6.5" fill="none" />
      <circle cx="55" cy="55" r={radius} stroke="var(--orange)" strokeWidth="6.5" strokeLinecap="round" fill="none" transform="rotate(-90 55 55)" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, percentage)) / 100)}/>
    </svg>
    <div className="ring-content">{children}</div>
  </div>;
}

function App() {
  const [view, setView] = useState<View>('today');
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [blocks, setBlocks] = useState<Block[]>(loadBlocks);
  const [timer, setTimer] = useState<TimerState | null>(loadTimer);
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const [now, setNow] = useState(Date.now());
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorError, setEditorError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveBlocks(blocks); }, [blocks]);
  useEffect(() => { saveTimer(timer); }, [timer]);
  useEffect(() => { savePreferences(prefs); }, [prefs]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const today = dateKey(new Date(now));
  const summary = useMemo(() => daySummary(blocks, selectedDate), [blocks, selectedDate]);
  const dayBlocks = useMemo(() => [...summary.items].sort((a, b) => a.start.localeCompare(b.start)), [summary.items]);
  const activeBlock = timer ? blocks.find(b => b.id === timer.blockId) ?? null : null;
  const timeRemaining = secondsLeft(timer, now);
  const fullDurationSeconds = activeBlock ? durationMinutes(activeBlock) * 60 : 0;
  const elapsedPercent = activeBlock && fullDurationSeconds ? 100 * (1 - timeRemaining / fullDurationSeconds) : 0;
  const nextBlock = dayBlocks.find(b => !b.completed && b.id !== timer?.blockId) ?? null;
  const currentWeek = getWeekStart(selectedDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDate(currentWeek, i));
  const lastSeven = Array.from({ length: 7 }, (_, i) => shiftDate(today, i - 6));
  const weekStats = lastSeven.map(date => ({ date, ...daySummary(blocks, date) }));
  const weekCompleted = weekStats.reduce((sum, d) => sum + d.completed, 0);
  const weekPlanned = weekStats.reduce((sum, d) => sum + d.planned, 0);
  const weekFinished = weekStats.reduce((sum, d) => sum + d.finished, 0);

  // The deadline-based timer catches up correctly after the window was minimized or the PC slept.
  useEffect(() => {
    if (!timer?.isRunning || secondsLeft(timer, now) > 0) return;
    const finished = blocks.find(b => b.id === timer.blockId);
    setTimer(prev => prev?.blockId === timer.blockId ? { ...prev, remainingSeconds: 0, isRunning: false, lastTickAt: null } : prev);
    if (finished && !finished.completed) {
      setBlocks(prev => prev.map(b => b.id === finished.id ? { ...b, completed: true, actualSeconds: durationMinutes(b) * 60 } : b));
      setToast(`Completed: ${finished.title}`);
      if (prefs.notifications) void notifyCompleted(finished.title);
    }
  }, [timer, now, blocks, prefs.notifications]);

  function startBlock(block: Block) {
    if (timer?.isRunning && timer.blockId !== block.id && !window.confirm('Switch focus? Your current countdown will be replaced.')) return;
    if (block.completed) setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, completed: false, actualSeconds: 0 } : b));
    // Resume a previously paused countdown for this block; otherwise start from its full scheduled duration.
    if (timer?.blockId === block.id && timeRemaining > 0) {
      setTimer({ ...timer, remainingSeconds: timeRemaining, lastTickAt: Date.now(), isRunning: true });
    } else {
      setTimer({ blockId: block.id, remainingSeconds: durationMinutes(block) * 60, lastTickAt: Date.now(), isRunning: true });
    }
    setSelectedDate(block.date);
    setView('today');
  }
  function toggleTimer() {
    if (!timer) return;
    if (timer.isRunning) setTimer({ ...timer, remainingSeconds: timeRemaining, isRunning: false, lastTickAt: null });
    else if (timeRemaining > 0) setTimer({ ...timer, remainingSeconds: timeRemaining, isRunning: true, lastTickAt: Date.now() });
  }
  function resetTimer() {
    if (!activeBlock) return;
    setTimer({ blockId: activeBlock.id, remainingSeconds: durationMinutes(activeBlock) * 60, isRunning: false, lastTickAt: null });
  }
  function finishBlock(block: Block) {
    if (timer?.blockId === block.id) setTimer(null);
    setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, completed: !b.completed, actualSeconds: !b.completed ? durationMinutes(b) * 60 : 0 } : b));
  }
  function removeBlock(block: Block) {
    if (!window.confirm(`Delete "${block.title}"?`)) return;
    if (timer?.blockId === block.id) setTimer(null);
    setBlocks(prev => prev.filter(b => b.id !== block.id));
    setToast('Block deleted');
  }
  function openEdit(block: Block) {
    setEditorError('');
    setEditor({ id: block.id, date: block.date, title: block.title, category: block.category, start: block.start, end: block.end, notes: block.notes });
  }
  function openNew() { setEditorError(''); setEditor(emptyEditor(selectedDate)); }
  function saveEditor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor) return;
    const title = editor.title.trim();
    if (!title) { setEditorError('Please enter a block title.'); return; }
    if (editor.end <= editor.start) { setEditorError('End time must be later than start time.'); return; }
    const overlaps = blocks.find(b => b.date === editor.date && b.id !== editor.id && editor.start < b.end && editor.end > b.start);
    if (overlaps) { setEditorError(`Time conflict with "${overlaps.title}" (${displayTime(overlaps.start)}–${displayTime(overlaps.end)}).`); return; }
    if (editor.id) {
      setBlocks(prev => prev.map(b => b.id === editor.id ? { ...b, title, category: editor.category, start: editor.start, end: editor.end, notes: editor.notes.trim(), completed: false, actualSeconds: 0 } : b));
      if (timer?.blockId === editor.id) setTimer(null);
      setToast('Block updated');
    } else {
      setBlocks(prev => [...prev, { id: freshId(), date: editor.date, title, category: editor.category, start: editor.start, end: editor.end, notes: editor.notes.trim(), completed: false, actualSeconds: 0 }]);
      setToast('Block added to your day');
    }
    setEditor(null);
  }
  function copyPreviousDay() {
    if (summary.total) { setToast('Your day already contains blocks'); return; }
    const original = blocks.filter(b => b.date === shiftDate(selectedDate, -1));
    if (!original.length) { setToast('There are no blocks on the previous day'); return; }
    setBlocks(prev => [...prev, ...original.map(b => ({ ...b, id: freshId(), date: selectedDate, completed: false, actualSeconds: 0 }))]);
    setToast(`${original.length} blocks copied`);
  }
  async function toggleNotifications() {
    if (prefs.notifications) { setPrefs(prev => ({ ...prev, notifications: false })); return; }
    const granted = await enableNotificationPermission();
    if (granted) setPrefs(prev => ({ ...prev, notifications: true }));
    else setToast('Notifications could not be enabled. Check your Linux notification settings.');
  }
  async function exportBackup() {
    const payload = { app: 'timewise', version: 1, exportedAt: new Date().toISOString(), blocks, preferences: prefs };
    if (isTauri()) {
      try {
        const path = await save({
          title: 'Save Timewise backup',
          defaultPath: `timewise-backup-${today}.json`,
          filters: [{ name: 'JSON backup', extensions: ['json'] }]
        });
        if (!path) return;
        await writeTextFile(path, JSON.stringify(payload, null, 2));
        setToast('Backup saved');
      } catch { setToast('Could not save backup to the selected file.'); }
      return;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `timewise-backup-${today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setToast('Backup download requested');
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await restoreBackup(await file.text());
  }
  async function importNativeBackup() {
    try {
      const path = await open({
        multiple: false, directory: false,
        title: 'Open Timewise backup',
        filters: [{ name: 'JSON backup', extensions: ['json'] }]
      });
      if (!path || typeof path !== 'string') return;
      await restoreBackup(await readTextFile(path));
    } catch { setToast('Could not read the selected backup file.'); }
  }
  async function restoreBackup(source: string) {
    try {
      const data: unknown = JSON.parse(source);
      if (!data || typeof data !== 'object') throw Error('Invalid file');
      const content = data as { app?: unknown; version?: unknown; blocks?: unknown; preferences?: unknown };
      if (content.app !== 'timewise' || content.version !== 1 || !Array.isArray(content.blocks)) throw Error('Not a Timewise backup');
      const valid = content.blocks.every((b: unknown) => {
        if (!b || typeof b !== 'object') return false;
        const x = b as Partial<Block>;
        return typeof x.id === 'string' && typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && typeof x.title === 'string' && x.title.length <= 150 && typeof x.start === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.start) && typeof x.end === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.end) && x.start < x.end && typeof x.category === 'string' && Object.hasOwn(categories, x.category);
      });
      if (!valid || content.blocks.length > 20000) throw Error('Invalid block data');
      if (!window.confirm('Restore backup? Your current schedule will be replaced.')) return;
      const restored: Block[] = content.blocks.map((b: Block) => ({ id: b.id, date: b.date, title: b.title, start: b.start, end: b.end, category: b.category, notes: typeof b.notes === 'string' ? b.notes.slice(0, 1000) : '', completed: Boolean(b.completed), actualSeconds: Number.isFinite(b.actualSeconds) ? Math.max(0, b.actualSeconds) : 0 }));
      setBlocks(restored);
      const importedPrefs = content.preferences as Partial<Preferences> | undefined;
      if (importedPrefs && typeof importedPrefs.dailyGoal === 'number' && importedPrefs.dailyGoal >= 30 && importedPrefs.dailyGoal <= 720) setPrefs(prev => ({ ...prev, dailyGoal: importedPrefs.dailyGoal! }));
      setTimer(null);
      setToast(`Restored ${restored.length} blocks`);
    } catch { setToast('Import failed: please choose a valid Timewise JSON backup.'); }
  }
  function clearAll() {
    if (!window.confirm('Delete ALL time blocks on ALL days? This cannot be undone. Export a backup first.')) return;
    setBlocks([]); setTimer(null); setToast('All blocks deleted');
  }
  function navigate(v: View) { setView(v); setMobileNav(false); if (v === 'today') setSelectedDate(dateKey(new Date())); }

  return <div className="app-shell">
    {mobileNav && <button aria-label="Close menu" className="mobile-scrim" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <Brand />
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="nav-items" aria-label="Main navigation">
        <button className={`nav-item ${view === 'today' ? 'nav-active' : ''}`} onClick={() => navigate('today')}><LayoutDashboard size={18}/> My day</button>
        <button className={`nav-item ${view === 'week' ? 'nav-active' : ''}`} onClick={() => navigate('week')}><CalendarDays size={18}/> Weekly planner</button>
        <button className={`nav-item ${view === 'insights' ? 'nav-active' : ''}`} onClick={() => navigate('insights')}><ChartNoAxesColumnIncreasing size={18}/> Insights</button>
      </nav>
      <div className="sidebar-section-label sidebar-tools-label">PREFERENCES</div>
      <nav className="nav-items"><button className={`nav-item ${view === 'settings' ? 'nav-active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={18}/> Settings</button></nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip"><div className="tip-icon"><Sparkles size={17}/></div><strong>Small steps, big progress.</strong><p>A little structure goes a long way. Make today count.</p></div>
        <div className="sidebar-footer"><div className="avatar">T</div><div><strong>My workspace</strong><small>Local · Offline</small></div><span className="online-dot"/></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn hamburger" onClick={() => setMobileNav(v => !v)} aria-label="Open menu"><Menu size={20}/></button><span className="breadcrumb">Workspace</span><span className="crumb-slash">/</span><span className="breadcrumb-current">{view === 'today' ? 'My day' : view === 'week' ? 'Weekly planner' : view === 'insights' ? 'Insights' : 'Settings'}</span></div><div className="topbar-right"><span className="offline-pill"><span/> Offline mode</span><div className="top-avatar">T</div></div></header>
      <div className="page-scroll"><div className="page-content">
        {view === 'today' && <>
          <div className="page-intro"><div><span className="eyebrow"><span className="eyebrow-dot"/> MAKE TODAY MATTER</span><h1>Your day, <span>your rhythm.</span></h1><p>Design your day with intention. One block at a time.</p></div><button className="primary-btn" onClick={openNew}><Plus size={18}/> New time block</button></div>
          <div className="date-line"><div className="date-main"><CalendarDays size={19}/><strong>{formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>{selectedDate === today && <span className="today-badge">Today</span>}</div><div className="date-controls"><button aria-label="Previous day" className="icon-btn" onClick={() => setSelectedDate(d => shiftDate(d, -1))}><ChevronLeft size={18}/></button><button className="today-jump" onClick={() => setSelectedDate(today)}>Today</button><button aria-label="Next day" className="icon-btn" onClick={() => setSelectedDate(d => shiftDate(d, 1))}><ChevronRight size={18}/></button></div></div>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-top"><span>Time planned</span><div className="stat-icon blue"><Clock3 size={18}/></div></div><div className="stat-num">{formatDuration(summary.planned)}</div><div className="stat-bottom">excluding breaks</div></div>
            <div className="stat-card"><div className="stat-top"><span>Time completed</span><div className="stat-icon green"><CheckCircle2 size={18}/></div></div><div className="stat-num">{formatDuration(summary.completed)}</div><div className="stat-bottom">finished focus blocks</div></div>
            <div className="stat-card"><div className="stat-top"><span>Blocks finished</span><div className="stat-icon purple"><CalendarCheck2 size={18}/></div></div><div className="stat-num">{summary.finished}<span className="out-of"> / {summary.total}</span></div><div className="stat-bottom">scheduled sessions</div></div>
            <div className="stat-card"><div className="stat-top"><span>Daily goal</span><div className="stat-icon orange"><Target size={18}/></div></div><div className="stat-num">{prefs.dailyGoal ? Math.min(100, Math.round(summary.completed / prefs.dailyGoal * 100)) : 0}<span className="percent-sign">%</span></div><div className="tiny-progress"><div style={{ width: `${prefs.dailyGoal ? Math.min(100, summary.completed / prefs.dailyGoal * 100) : 0}%` }}/></div></div>
          </div>
          <div className="content-columns"><section className="schedule-panel"><div className="section-header"><div><h2>Today's schedule <span className="count-label">{summary.total}</span></h2><p>Your time blocks, thoughtfully arranged.</p></div><button className="text-btn" onClick={openNew}><Plus size={16}/> Add block</button></div>
            {dayBlocks.length ? <div className="timeline">{dayBlocks.map((b, i) => {
              const Icon = categoryIcons[b.category];
              const isActive = timer?.blockId === b.id && timer.isRunning;
              return <div className="timeline-row" key={b.id}><div className="timeline-time"><strong>{displayTime(b.start)}</strong><small>{displayTime(b.end)}</small></div><div className="timeline-axis"><span className={`axis-dot ${b.completed ? 'axis-done' : ''} ${isActive ? 'axis-active' : ''}`}/>{i !== dayBlocks.length - 1 && <span className="axis-line"/>}</div><article className={`block-card ${b.completed ? 'block-finished' : ''} ${isActive ? 'block-running' : ''}`}><div className="block-details"><div className={`block-icon block-icon-${b.category}`}><Icon size={19}/></div><div className="block-copy"><div className="block-title-line"><strong>{b.title}</strong>{b.completed && <span className="done-label"><Check size={12}/> Done</span>}{isActive && <span className="live-label"><span/> Focusing</span>}</div><div className="block-meta"><CategoryChip category={b.category}/><span className="meta-dot">·</span><Clock3 size={13}/>{formatDuration(durationMinutes(b))}</div>{b.notes && <p className="block-note">{b.notes}</p>}</div></div><div className="block-actions"><button className="block-action-icon" onClick={() => openEdit(b)} aria-label={`Edit ${b.title}`} title="Edit"><Pencil size={15}/></button><button className="block-action-icon" onClick={() => removeBlock(b)} aria-label={`Delete ${b.title}`} title="Delete"><Trash2 size={15}/></button><button className={`compact-action ${b.completed ? 'compact-done' : isActive ? 'compact-pause' : ''}`} onClick={() => b.completed ? finishBlock(b) : isActive ? toggleTimer() : startBlock(b)}>{b.completed ? <><Check size={14}/> Done</> : isActive ? <><Pause size={14}/> Pause</> : <><Play size={13} fill="currentColor"/> Focus</>}</button><button className={`complete-check ${b.completed ? 'checked' : ''}`} onClick={() => finishBlock(b)} title={b.completed ? 'Mark unfinished' : 'Mark finished'} aria-label={b.completed ? 'Mark unfinished' : 'Mark finished'}><Check size={15}/></button></div></article></div>;
            })}</div> : <div className="empty-state"><div className="empty-icon"><CalendarDays size={28}/></div><h3>A fresh canvas for your day</h3><p>Add a time block to make a plan, or bring yesterday’s schedule forward.</p><div className="empty-actions"><button className="primary-btn" onClick={openNew}><Plus size={16}/> Create a block</button><button className="secondary-btn" onClick={copyPreviousDay}><Copy size={15}/> Copy previous day</button></div></div>}
            {dayBlocks.length > 0 && <div className="schedule-bottom"><span><ShieldCheck size={15}/> All changes are saved locally</span><button onClick={() => { setSelectedDate(shiftDate(selectedDate, 1)); setView('today'); }} className="subtle-btn">Plan tomorrow <ArrowRight size={15}/></button></div>}
          </section>
          <aside className="right-panel"><section className="focus-card"><div className="focus-header"><span><span className="focus-live-dot"/> FOCUS TIMER</span><MoreHorizontal size={20}/></div><div className="focus-heading">{activeBlock ? activeBlock.title : 'Ready to focus?'}</div><p className="focus-subheading">{activeBlock ? (timer?.isRunning ? 'Your focus session is in progress' : timeRemaining === 0 ? 'Session complete!' : 'Pick up where you left off') : 'Select a time block to begin a session'}</p><ProgressRing percentage={elapsedPercent}><div className="ring-time">{activeBlock ? formatCountdown(timeRemaining) : '00:00'}</div><div className="ring-label">{activeBlock ? timer?.isRunning ? 'REMAINING' : 'PAUSED / READY' : 'SET A TIMER'}</div></ProgressRing><div className="focus-buttons"><button disabled={!activeBlock || timeRemaining <= 0} className="focus-play" onClick={toggleTimer}>{timer?.isRunning ? <Pause size={18} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}{timer?.isRunning ? 'Pause session' : 'Start focusing'}</button><button className="focus-reset" disabled={!activeBlock} onClick={resetTimer} aria-label="Reset timer" title="Reset timer"><RotateCcw size={18}/></button></div>{activeBlock && <button className="finish-now" onClick={() => finishBlock(activeBlock)}><CheckCircle2 size={15}/> Mark session {activeBlock.completed ? 'unfinished' : 'complete'}</button>}<div className="focus-footer"><Zap size={16}/> Stay present. One thing at a time.</div></section>
            <section className="up-next-card"><div className="next-heading"><h3>Up next</h3><span>ON YOUR RADAR</span></div>{nextBlock ? <div className="next-item"><span className={`next-square block-icon-${nextBlock.category}`}><span className="next-square-dot"/></span><div><strong>{nextBlock.title}</strong><p>{displayTime(nextBlock.start)} · {formatDuration(durationMinutes(nextBlock))}</p></div><button aria-label="Start next block" onClick={() => startBlock(nextBlock)}><ArrowRight size={17}/></button></div> : <div className="next-empty">{summary.total ? 'You’re all caught up for this day.' : 'Your next block will appear here.'}</div>}</section>
            <section className="progress-card"><div className="progress-heading"><span>Daily progress</span><strong>{summary.percent}%</strong></div><div className="progress-bar"><div style={{ width: `${summary.percent}%` }}/></div><p>{formatDuration(summary.completed)} of {formatDuration(summary.planned)} scheduled focus time completed</p></section>
          </aside></div>
        </>}

        {view === 'week' && <><div className="page-intro"><div><span className="eyebrow"><span className="eyebrow-dot"/> THE BIG PICTURE</span><h1>Plan your <span>best week.</span></h1><p>See what's ahead and make room for what matters.</p></div><button className="primary-btn" onClick={() => { setSelectedDate(today); setView('today'); setEditorError(''); setEditor(emptyEditor(today)); }}><Plus size={18}/> New time block</button></div><div className="week-heading"><h2>{formatDate(currentWeek, { month: 'short', day: 'numeric' })} – {formatDate(shiftDate(currentWeek, 6), { month: 'short', day: 'numeric', year: 'numeric' })}</h2><div className="date-controls"><button className="icon-btn" onClick={() => setSelectedDate(d => shiftDate(d, -7))}><ChevronLeft size={18}/></button><button className="today-jump" onClick={() => setSelectedDate(today)}>This week</button><button className="icon-btn" onClick={() => setSelectedDate(d => shiftDate(d, 7))}><ChevronRight size={18}/></button></div></div><div className="week-grid">{weekDates.map(date => {
          const stats = daySummary(blocks, date);
          const ordered = [...stats.items].sort((a, b) => a.start.localeCompare(b.start));
          return <button className={`week-day ${date === today ? 'week-today' : ''}`} key={date} onClick={() => { setSelectedDate(date); setView('today'); }}><div className="week-day-top"><span>{formatDate(date, { weekday: 'short' })}</span><strong>{asDate(date).getDate()}</strong></div><div className="week-day-count">{stats.total} {stats.total === 1 ? 'block' : 'blocks'}</div><div className="week-mini-progress"><div style={{ width: `${stats.percent}%` }}/></div><div className="week-tasks">{ordered.slice(0, 4).map(b => <div className="week-task" key={b.id}><span style={{ background: categories[b.category].color }}/><span>{b.title}</span>{b.completed && <Check size={12}/>}</div>)}{ordered.length > 4 && <small>+{ordered.length - 4} more blocks</small>}{!ordered.length && <span className="week-no-tasks">Nothing planned yet</span>}</div><div className="week-day-footer">Open day <ArrowRight size={14}/></div></button>;
        })}</div><div className="weekly-guide"><div className="guide-icon"><Sparkles size={22}/></div><div><strong>A balanced week starts with a realistic plan.</strong><p>Schedule focused work, but leave space for breaks and unexpected tasks.</p></div></div></>}

        {view === 'insights' && <><div className="page-intro"><div><span className="eyebrow"><span className="eyebrow-dot"/> YOUR MOMENTUM</span><h1>Progress, <span>not perfection.</span></h1><p>A clearer look at how your time is working for you.</p></div></div><div className="insight-stats"><div className="insight-stat"><span>Last 7 days · Planned</span><strong>{formatDuration(weekPlanned)}</strong><small>Time dedicated to focused sessions</small></div><div className="insight-stat"><span>Last 7 days · Completed</span><strong>{formatDuration(weekCompleted)}</strong><small>Based on finished time blocks</small></div><div className="insight-stat"><span>Sessions finished</span><strong>{weekFinished}</strong><small>Across work, study, breaks & personal</small></div></div><section className="insight-chart-card"><div className="section-header"><div><h2>Focus time over the past 7 days</h2><p>Planned vs. completed minutes · completed is based on checked-off blocks</p></div><div className="chart-legend"><span><i className="legend-planned"/> Planned</span><span><i className="legend-done"/> Completed</span></div></div><div className="bar-chart">{weekStats.map(day => { const max = Math.max(...weekStats.map(d => d.planned), 60); return <div className="bar-column" key={day.date}><div className="bar-stack"><div className="bar-planned" style={{ height: `${Math.max(day.planned ? 4 : 0, day.planned / max * 100)}%` }} title={`Planned ${day.planned}m`}/><div className="bar-done" style={{ height: `${Math.max(day.completed ? 4 : 0, day.completed / max * 100)}%` }} title={`Completed ${day.completed}m`}/></div><span>{formatDate(day.date, { weekday: 'short' })}</span></div>; })}</div></section><section className="insight-note"><Activity size={20}/><p><strong>How progress is calculated:</strong> Mark a block complete when finished. Your charts count its scheduled duration. Breaks are excluded from focus minutes.</p></section></>}

        {view === 'settings' && <><div className="page-intro"><div><span className="eyebrow"><span className="eyebrow-dot"/> PERSONALIZE YOUR SPACE</span><h1>Make it <span>yours.</span></h1><p>A few small preferences to make planning feel easier.</p></div></div><div className="settings-grid"><section className="settings-card"><div className="settings-heading"><div className="settings-icon blue"><Target size={20}/></div><div><h2>Daily focus goal</h2><p>Set a realistic target for focused minutes each day.</p></div></div><label className="settings-label" htmlFor="daily-goal">Target focus time</label><select id="daily-goal" className="settings-select" value={prefs.dailyGoal} onChange={e => setPrefs(p => ({ ...p, dailyGoal: Number(e.target.value) }))}>{[60, 90, 120, 180, 240, 300, 360, 480].map(min => <option key={min} value={min}>{formatDuration(min)} per day</option>)}</select><div className="settings-help">Your goal is only a guideline. It won't restrict your schedule.</div></section><section className="settings-card"><div className="settings-heading"><div className="settings-icon orange"><Bell size={20}/></div><div><h2>Notifications</h2><p>Get an alert when your focus countdown finishes.</p></div></div><div className="switch-row"><span>End-of-session notifications</span><button role="switch" aria-checked={prefs.notifications} aria-label="Toggle notifications" className={`toggle ${prefs.notifications ? 'toggle-on' : ''}`} onClick={() => void toggleNotifications()}><span/></button></div><div className="settings-help">You may need to grant permission in Linux. The app must be running to send an alert at the moment the timer ends.</div></section><section className="settings-card"><div className="settings-heading"><div className="settings-icon green"><ShieldCheck size={20}/></div><div><h2>Your data</h2><p>Schedule data is saved locally on this device.</p></div></div><div className="settings-data-actions"><button className="secondary-btn" onClick={() => void exportBackup()}><ArrowDownToLine size={16}/> Export JSON backup</button><button className="secondary-btn" onClick={() => isTauri() ? void importNativeBackup() : fileInputRef.current?.click()}><ArrowLeft size={16}/> Import backup</button><input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden-file" onChange={e => void importBackup(e)}/></div><div className="settings-help">Export a backup before uninstalling the application or clearing browser data. On Linux desktop, a native file picker is used for backup and restore.</div></section><section className="settings-card"><div className="settings-heading"><div className="settings-icon red"><Trash2 size={20}/></div><div><h2>Reset workspace</h2><p>Remove all planned and completed time blocks.</p></div></div><button className="danger-btn" onClick={clearAll}><Trash2 size={16}/> Delete all time blocks</button><div className="settings-help">Permanent. Export a backup first if you want to keep your schedule.</div></section></div><div className="app-about"><span className="about-mark">t.</span><div><strong>timewise. <span>v1.0.0</span></strong><p>A lightweight offline desktop time blocker. Made for focused days.</p></div></div></>}
      </div></div>
    </main>

    {toast && <div className="toast" role="status"><CheckCircle2 size={17}/><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={16}/></button></div>}
    {editor && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setEditor(null); }}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="editor-header"><div><span className="eyebrow"><span className="eyebrow-dot"/> YOUR TIME MATTERS</span><h2 id="editor-title">{editor.id ? 'Edit time block' : 'Create a time block'}</h2><p>Give your time a clear purpose.</p></div><button className="icon-btn" onClick={() => setEditor(null)} aria-label="Close"><X size={20}/></button></div><form onSubmit={saveEditor}><div className="editor-body"><label className="form-field"><span>What are you working on? <em>*</em></span><input autoFocus maxLength={100} placeholder="e.g. Build my portfolio website" value={editor.title} onChange={e => setEditor(v => v ? { ...v, title: e.target.value } : v)}/></label><div className="form-field"><span>Category</span><div className="category-picker">{(['work', 'study', 'break', 'personal'] as const).map(category => { const Icon = categoryIcons[category]; return <button type="button" key={category} className={`category-option ${editor.category === category ? 'category-option-active' : ''}`} onClick={() => setEditor(v => v ? { ...v, category } : v)}><Icon size={16}/>{categories[category].name}</button>; })}</div></div><label className="form-field"><span>Date</span><input type="date" value={editor.date} onChange={e => setEditor(v => v ? { ...v, date: e.target.value } : v)} required/></label><div className="form-two"><label className="form-field"><span>Start time</span><input type="time" value={editor.start} onChange={e => setEditor(v => v ? { ...v, start: e.target.value } : v)} required/></label><label className="form-field"><span>End time</span><input type="time" value={editor.end} onChange={e => setEditor(v => v ? { ...v, end: e.target.value } : v)} required/></label></div><label className="form-field"><span>Notes <small>optional</small></span><textarea rows={3} maxLength={1000} placeholder="Any extra details or a reminder for yourself..." value={editor.notes} onChange={e => setEditor(v => v ? { ...v, notes: e.target.value } : v)} /></label><div className="duration-preview"><Clock3 size={16}/> Block duration <strong>{formatDuration(Math.max(0, durationMinutes(editor)))}</strong></div>{editorError && <div role="alert" className="form-error">{editorError}</div>}</div><div className="editor-footer"><button type="button" className="secondary-btn" onClick={() => setEditor(null)}>Cancel</button><button type="submit" className="primary-btn"><Check size={17}/>{editor.id ? 'Save changes' : 'Create block'}</button></div></form></section></div>}
  </div>;
}
export default App;
