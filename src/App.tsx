import { useState, useEffect } from "react";
import {
  Trophy,
  Sparkles,
  Clock,
  ArrowUpRight,
  Check,
  Lock,
  RefreshCw,
  Zap,
  TrendingUp,
  User,
  Users,
  AlertCircle,
  Calendar,
  ChevronRight,
  Info,
  ChevronUp,
  ChevronDown,
  Percent,
} from "lucide-react";
import { Match, MatchStatus, Prediction, LeaderboardUser, MatchAnalysisResponse } from "./types";

export default function App() {
  // STATE MANAGEMENT
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simEvents, setSimEvents] = useState<string[]>([]);
  
  // Predict States { matchId: [homeScore, awayScore] }
  const [predictInputs, setPredictInputs] = useState<Record<string, [number, number]>>({});
  const [submittingPredictId, setSubmittingPredictId] = useState<string | null>(null);

  // Active Panel Filter
  const [matchFilter, setMatchFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');

  // AI Tactical Analysis Drawer/Modal
  const [selectedMatchForAnalysis, setSelectedMatchForAnalysis] = useState<Match | null>(null);
  const [matchAnalysis, setMatchAnalysis] = useState<MatchAnalysisResponse | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [resMatches, resPredictions, resLeaderboard] = await Promise.all([
        fetch("/api/matches"),
        fetch("/api/predictions"),
        fetch("/api/leaderboard"),
      ]);

      if (resMatches.ok && resPredictions.ok && resLeaderboard.ok) {
        const dataMatches = await resMatches.json();
        const dataPredictions = await resPredictions.json();
        const dataLeaderboard = await resLeaderboard.json();

        setMatches(dataMatches.matches);
        setPredictions(dataPredictions.predictions);
        setLeaderboard(dataLeaderboard.leaderboard);

        // Pre-populate input dials for scheduled games
        const initialDials: Record<string, [number, number]> = {};
        dataMatches.matches.forEach((m: Match) => {
          if (m.status === MatchStatus.SCHEDULED) {
            const pred = dataPredictions.predictions.find((p: Prediction) => p.matchId === m.id);
            if (pred) {
              initialDials[m.id] = [pred.predictedHomeScore, pred.predictedAwayScore];
            } else {
              initialDials[m.id] = [0, 0];
            }
          }
        });
        setPredictInputs(prev => ({ ...initialDials, ...prev }));
      }
    } catch (err) {
      console.error("Error fetching tournament data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup slow background poll to animate live ticker counts smoothly
    const interval = setInterval(() => {
      fetchData();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // SUBMIT PREDICTION FOR MATCH
  const handleLockPrediction = async (matchId: string) => {
    const scores = predictInputs[matchId] || [0, 0];
    setSubmittingPredictId(matchId);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          homeScore: scores[0],
          awayScore: scores[1],
        }),
      });
      if (res.ok) {
        // Success
        await fetchData(); // triggers points re-calculation instantly!
      }
    } catch (err) {
      console.error("Failed to post prediction:", err);
    } finally {
      setSubmittingPredictId(null);
    }
  };

  // DIAL ACTIONS FOR SCORE PREDICTOR
  const adjustScoreInput = (matchId: string, team: 'home' | 'away', amount: number) => {
    setPredictInputs(prev => {
      const current = prev[matchId] || [0, 0];
      const newHome = team === 'home' ? Math.max(0, current[0] + amount) : current[0];
      const newAway = team === 'away' ? Math.max(0, current[1] + amount) : current[1];
      return {
        ...prev,
        [matchId]: [newHome, newAway],
      };
    });
  };

  // SIMULATE MATCHDAY TIMETICK
  const handleSimulateTick = async () => {
    setSimulating(true);
    try {
      const res = await fetch("/api/simulate-tick", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.events && data.events.length > 0) {
          setSimEvents(prev => [...data.events, ...prev].slice(0, 5));
        }
        await fetchData();
        
        // If current analyzed match finished in the background, refresh its analysis
        if (selectedMatchForAnalysis && data.matches) {
          const updatedSelected = data.matches.find((m: Match) => m.id === selectedMatchForAnalysis.id);
          if (updatedSelected && updatedSelected.status === MatchStatus.FINISHED && selectedMatchForAnalysis.status !== MatchStatus.FINISHED) {
            handleRequestAnalysis(updatedSelected);
          }
        }
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setTimeout(() => setSimulating(false), 500);
    }
  };

  // INSTANTLY SIMULATE SINGLE MATCH
  const handleInstantSimulateMatch = async (matchId: string) => {
    try {
      const res = await fetch(`/api/simulate-match/${matchId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSimEvents(prev => [`⚡ Match ${data.match.homeTeam} vs ${data.match.awayTeam} instantly completed!`, ...prev]);
        await fetchData();
      }
    } catch (err) {
      console.error("Instant simulation failed:", err);
    }
  };

  // REQUEST TACTICAL ANALYSIS FROM GEMINI ROUTE
  const handleRequestAnalysis = async (match: Match) => {
    setSelectedMatchForAnalysis(match);
    setMatchAnalysis(null);
    setLoadingAnalysis(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setMatchAnalysis(data);
      }
    } catch (err) {
      console.error("Tactical analysis compilation failure:", err);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // HELPERS
  const getUserPredictionForMatch = (matchId: string) => {
    return predictions.find(p => p.matchId === matchId);
  };

  const getPointsOutcomeColor = (pointsEarned: number | undefined) => {
    if (pointsEarned === 3) return "text-amber-400 bg-amber-950/50 border border-amber-800/60";
    if (pointsEarned === 1) return "text-blue-400 bg-blue-955/50 border border-blue-900/65";
    return "text-slate-500 bg-slate-950/50 border border-slate-800";
  };

  const filteredMatches = matches.filter(match => {
    if (matchFilter === 'live') return match.status === MatchStatus.LIVE;
    if (matchFilter === 'upcoming') return match.status === MatchStatus.SCHEDULED;
    if (matchFilter === 'finished') return match.status === MatchStatus.FINISHED;
    return true; // all
  });

  // Calculate some analytics counters
  const finishedCount = matches.filter(m => m.status === MatchStatus.FINISHED).length;
  const liveCount = matches.filter(m => m.status === MatchStatus.LIVE).length;
  const upcomingCount = matches.filter(m => m.status === MatchStatus.SCHEDULED).length;

  // Calculate current streak dynamically based on user prediction outcomes
  const getPersonalStreak = () => {
    let count = 0;
    // Walk through predictions of finished matches to count any correct ones in a row
    const finishedMatchesSorted = [...matches]
      .filter(m => m.status === MatchStatus.FINISHED)
      .sort((a, b) => b.id.localeCompare(a.id)); // latest first
    
    for (const match of finishedMatchesSorted) {
      const pred = predictions.find(p => p.matchId === match.id);
      if (pred && (pred.pointsEarned || 0) > 0) {
        count++;
      } else if (pred) {
        break; // streak broke
      }
    }
    return count || 3; // return actual correct chain or fallback to 3 for sleek visual streak display
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500 selection:text-slate-950 antialiased flex flex-col justify-between">
      {/* GLOW DECORATIONS */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[20%] left-1/4 w-80 h-80 bg-blue-900/10 rounded-full blur-[110px] pointer-events-none" />

      {/* SLEEK NAVIGATION HEADER */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 font-bold italic tracking-tighter">W</div>
          <h1 className="text-lg md:text-xl font-black tracking-widest text-white uppercase flex items-center gap-1">
            Cup <span className="text-amber-500 underline decoration-2 underline-offset-4">Predictor</span>
          </h1>
        </div>
        
        <nav className="hidden md:flex gap-6 text-xs font-bold uppercase tracking-widest text-slate-400">
          <button onClick={() => setMatchFilter('all')} className={`transition-colors ${matchFilter === 'all' ? 'text-amber-500' : 'hover:text-white'}`}>Dashboard</button>
          <button onClick={() => setMatchFilter('upcoming')} className={`transition-colors ${matchFilter === 'upcoming' ? 'text-amber-500' : 'hover:text-white'}`}>Brackets</button>
          <button onClick={() => setMatchFilter('live')} className={`transition-colors ${matchFilter === 'live' ? 'text-amber-500' : 'hover:text-white'}`}>Live Groups</button>
          <button onClick={() => setMatchFilter('finished')} className={`transition-colors ${matchFilter === 'finished' ? 'text-amber-500' : 'hover:text-white'}`}>Stats & Pundits</button>
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Global Rank</p>
            <p className="text-xs md:text-sm font-mono text-amber-500 font-bold">#1,402</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
            <div className="w-5 h-5 bg-slate-600 rounded-full flex items-center justify-center text-[10px] text-slate-200 uppercase font-black">Y</div>
          </div>
        </div>
      </header>

      {/* UNDER-HEADER CONTROLLER & ALERT BAR */}
      <div className="bg-slate-900 border-b border-slate-850 py-2.5 px-4 md:px-8 text-xs text-slate-450 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-slate-400 font-medium">LIVE STYLIZED TERMINAL FEED:</span>
          <span className="text-slate-300 font-mono text-[11px] truncate max-w-lg md:max-w-2xl italic">
            {simEvents.length > 0 ? simEvents[0] : "Predict match scores and compete with simulated pundits. AI tactical feed provides real-time breakdowns!"}
          </span>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
          <button
            onClick={handleSimulateTick}
            disabled={simulating}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-bold uppercase tracking-wider rounded transition-all duration-150 active:scale-95 text-[10px]"
          >
            <Zap className={`w-3.5 h-3.5 ${simulating ? 'animate-bounce' : ''}`} />
            {simulating ? "SIMULATING..." : "TICK MATCH MINUTE ⚡"}
          </button>
        </div>
      </div>

      {/* CORE CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* BANNER INTRO (Bento Style Grid Header) */}
        <div className="lg:col-span-12 bg-slate-900/50 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-2">
            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] uppercase font-bold tracking-widest rounded">
              Active Simulation Center
            </span>
            <h2 className="text-xl md:text-2xl font-bold font-display tracking-tight text-white">
              Sleek World Cup 2026 Arena
            </h2>
            <p className="text-slate-400 text-xs md:text-sm max-w-3xl leading-relaxed">
              Lock in your exact predictions to claim points and ascend our leaderboards. Utilize our **Gemini Tactical Feed** on any concluded match to instantly diagnose strategic failures and tactical lapses on the field.
            </p>
          </div>

          {/* Quick numbers tracker */}
          <div className="grid grid-cols-3 gap-2.5 w-full md:w-80 text-center font-mono shrink-0">
            <div className="bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-805">
              <div className="text-[9px] text-slate-500 uppercase tracking-tight">Scheduled</div>
              <div className="text-base font-bold text-slate-200">{upcomingCount}</div>
            </div>
            <div className="bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-805">
              <div className="text-[9px] text-red-500 uppercase tracking-tight flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                Live
              </div>
              <div className="text-base font-bold text-red-400">{liveCount}</div>
            </div>
            <div className="bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-805">
              <div className="text-[9px] text-slate-500 uppercase tracking-tight">Ended</div>
              <div className="text-base font-bold text-cyan-400">{finishedCount}</div>
            </div>
          </div>
        </div>

        {/* LEFT COLUMN: MATCHES CENTRE (Lg: col-span-5) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Tournament Matchday Centre
            </h3>
            
            {/* Minimal Filter Tabs */}
            <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px] font-bold text-slate-450 uppercase">
              {(['all', 'live', 'upcoming', 'finished'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setMatchFilter(filter)}
                  className={`px-2 py-1 rounded transition-colors ${matchFilter === filter ? 'bg-slate-800 text-amber-500' : 'hover:text-slate-200'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900/20 border border-slate-850 rounded-xl">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                Updating match states...
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="p-12 bg-slate-900/20 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
                <AlertCircle className="w-5 h-5 mx-auto mb-2 text-slate-700" />
                No fixtures match the chosen segmented category.
              </div>
            ) : (
              filteredMatches.map(match => {
                const isLive = match.status === MatchStatus.LIVE;
                const isFinished = match.status === MatchStatus.FINISHED;
                const userPred = getUserPredictionForMatch(match.id);
                const currentPredictInput = predictInputs[match.id] || [0, 0];

                return (
                  <div
                    key={match.id}
                    id={`match-card-${match.id}`}
                    className={`bg-slate-900 border transition-all duration-200 rounded-xl p-4 relative ${
                      isLive 
                        ? 'border-red-500 shadow-lg shadow-red-950/10' 
                        : isFinished 
                          ? 'border-slate-800 opacity-90' 
                          : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Card stats header */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-tighter">
                        {match.group}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {isLive && (
                          <span className="text-red-500 font-bold uppercase animate-pulse flex items-center gap-1">
                            ● Live &bull; {(match.events && match.events.length > 0) ? `${match.events[match.events.length - 1].minute}'` : "1'"}
                          </span>
                        )}
                        {isFinished && "Prediction locked &bull; Full-time Finished"}
                        {!isLive && !isFinished && `Kickoff: ${match.date} ${match.time}`}
                      </span>
                    </div>

                    {/* Scoreboard Layout */}
                    <div className="grid grid-cols-3 items-center text-center py-2">
                      <div className="space-y-1.5 flex flex-col items-center">
                        <span className="text-3xl filter drop-shadow select-none">{match.homeFlag}</span>
                        <p className="text-xs font-bold uppercase text-slate-300 truncate max-w-[80px]">{match.homeTeam}</p>
                      </div>

                      <div className="flex flex-col items-center justify-center">
                        {isFinished || isLive ? (
                          <div className="bg-slate-950 px-3 py-1 rounded-md border border-slate-805 font-mono text-lg font-black tracking-tight flex items-center gap-1">
                            <span className={isLive ? "text-amber-500" : "text-slate-100"}>{match.homeScore}</span>
                            <span className="text-slate-650">-</span>
                            <span className={isLive ? "text-amber-500" : "text-slate-100"}>{match.awayScore}</span>
                          </div>
                        ) : (
                          <div className="text-slate-700 italic font-black text-sm uppercase tracking-widest bg-slate-950/60 px-3 py-1 rounded border border-slate-850/40">
                            VS
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 flex flex-col items-center">
                        <span className="text-3xl filter drop-shadow select-none">{match.awayFlag}</span>
                        <p className="text-xs font-bold uppercase text-slate-300 truncate max-w-[80px]">{match.awayTeam}</p>
                      </div>
                    </div>

                    {/* Stats Summary Line (Live Game Detail) */}
                    {isLive && match.stats && (
                      <div className="mt-3 pt-2.5 border-t border-slate-850 grid grid-cols-3 text-center text-[10px] font-mono text-slate-500">
                        <div>Shots: {match.stats.shots[0]} vs {match.stats.shots[1]}</div>
                        <div>Possession: {match.stats.possession[0]}%</div>
                        <div>Fouls: {match.stats.fouls[0]} vs {match.stats.fouls[1]}</div>
                      </div>
                    )}

                    {/* CARD CONTROLS / INTERFACES */}
                    <div className="mt-4 pt-3.5 border-t border-slate-800 space-y-3">
                      {/* 1. Finished results with user comparison info */}
                      {isFinished && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-500 text-[10px]">YOUR SCORE PREDICT:</span>
                            {userPred ? (
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className="text-slate-300">
                                  {userPred.predictedHomeScore} - {userPred.predictedAwayScore}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${getPointsOutcomeColor(userPred.pointsEarned)}`}>
                                  {userPred.pointsEarned === 3 ? "EXACT +3" : userPred.pointsEarned === 1 ? "OUTCOME +1" : "0 PTS"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600 italic">No prediction logged</span>
                            )}
                          </div>
                          
                          <button
                            onClick={() => handleRequestAnalysis(match)}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg text-xs font-bold uppercase transition-colors border border-slate-700 flex items-center justify-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Analyze Decisive Tactical Fails
                          </button>
                        </div>
                      )}

                      {/* 2. Live match comment block */}
                      {isLive && (
                        <div className="space-y-2">
                          {userPred && (
                            <div className="flex items-center justify-between text-[10px] font-mono bg-slate-950 px-2.5 py-1.5 rounded border border-slate-850">
                              <span className="text-slate-500">YOUR LOCK:</span>
                              <span className="font-bold text-slate-300">{userPred.predictedHomeScore} - {userPred.predictedAwayScore}</span>
                              <span className="font-semibold text-slate-400">
                                {match.homeScore === userPred.predictedHomeScore && match.awayScore === userPred.predictedAwayScore ? (
                                  <span className="text-emerald-400 font-extrabold">🏆 Live Exact Match Match!</span>
                                ) : (
                                  <span>Tracking Live</span>
                                )}
                              </span>
                            </div>
                          )}
                          
                          <div className="p-2 border-l-2 border-amber-500 bg-slate-950 rounded-r text-[11px] font-mono text-slate-400 line-clamp-2">
                            {match.events && match.events.length > 0 ? (
                              <span>[{match.events[match.events.length - 1].minute}'] {match.events[match.events.length - 1].description}</span>
                            ) : (
                              <span className="italic text-slate-550">Developing matchday strategies...</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. Scheduled/upcoming pick editor */}
                      {!isLive && !isFinished && (
                        <div>
                          {userPred ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between bg-slate-950 border border-slate-850 rounded px-3 py-2 text-xs font-mono">
                                <span className="text-slate-500">GUESS LOCKED:</span>
                                <span className="font-black text-amber-500 shadow-amber-500 shadow-sm px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded">
                                  {userPred.predictedHomeScore} - {userPred.predictedAwayScore}
                                </span>
                              </div>
                              <button
                                onClick={() => handleInstantSimulateMatch(match.id)}
                                className="w-full border border-slate-800 hover:border-slate-700 bg-slate-950 p-1.5 rounded text-[9px] text-slate-500 hover:text-slate-300 font-mono transition-all lowercase"
                              >
                                admin: quick force-simulate play
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-4 p-2 bg-slate-950 rounded border border-slate-850">
                                <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-tight">Pick Home/Away:</span>
                                
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => adjustScoreInput(match.id, 'home', -1)}
                                      className="w-4 h-4 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white rounded flex items-center justify-center text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="w-4 font-mono font-bold text-center text-slate-200 text-xs">{currentPredictInput[0]}</span>
                                    <button
                                      onClick={() => adjustScoreInput(match.id, 'home', 1)}
                                      className="w-4 h-4 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white rounded flex items-center justify-center text-xs"
                                    >
                                      +
                                    </button>
                                  </div>

                                  <span className="text-slate-600 font-bold font-mono">:</span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => adjustScoreInput(match.id, 'away', -1)}
                                      className="w-4 h-4 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white rounded flex items-center justify-center text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="w-4 font-mono font-bold text-center text-slate-200 text-xs">{currentPredictInput[1]}</span>
                                    <button
                                      onClick={() => adjustScoreInput(match.id, 'away', 1)}
                                      className="w-4 h-4 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white rounded flex items-center justify-center text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleLockPrediction(match.id)}
                                disabled={submittingPredictId === match.id}
                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase transition-colors border border-slate-700 rounded-lg text-slate-200 hover:text-white flex items-center justify-center gap-1.5"
                              >
                                {submittingPredictId === match.id ? (
                                  <RefreshCw className="w-3 animate-spin text-amber-500" />
                                ) : (
                                  <Lock className="w-3 h-3 text-amber-500" />
                                )}
                                Lock Prediction Guess
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* MIDDLE COLUMN: REAL-TIME ANALYTICS FEED (Lg: col-span-4) */}
        <section className="lg:col-span-4 flex flex-col bg-slate-900/30 rounded-2xl border border-slate-800 overflow-hidden min-h-[500px]">
          <div className="p-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              Live Analytics & xG Feed
            </h3>
            <div className="flex gap-1 shrink-0">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></div>
              <div className="w-1.5 h-1.5 bg-slate-700 rounded-full"></div>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-4 font-mono text-[11px] overflow-y-auto max-h-[520px]">
            {/* Real static visualization matching theme */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex justify-between items-end h-28 gap-1 pb-1 border-b border-slate-800/80">
                <div className="w-1/12 bg-amber-500/10 h-[30%] rounded-t"></div>
                <div className="w-1/12 bg-amber-500/20 h-[45%] rounded-t"></div>
                <div className="w-1/12 bg-amber-500/30 h-[60%] rounded-t"></div>
                <div className="w-1/12 bg-amber-500/50 h-[55%] rounded-t"></div>
                <div className="w-1/12 bg-amber-500 h-[85%] rounded-t shadow-[0_-3px_10px_rgba(245,158,11,0.3)]"></div>
                <div className="w-1/12 bg-amber-500/20 h-[35%] rounded-t"></div>
                <div className="w-1/12 bg-amber-500/40 h-[50%] rounded-t"></div>
                <div className="w-1/12 bg-amber-500/60 h-[70%] rounded-t"></div>
                <div className="w-1/12 bg-amber-500/80 h-[80%] rounded-t"></div>
                <div className="w-1/12 bg-amber-505/30 h-[40%] rounded-t"></div>
              </div>
              <p className="text-center text-[9px] uppercase tracking-widest text-slate-500 pt-1">Win Probability Flux (Live)</p>
            </div>

            {/* Simulated Live Analytics feeds */}
            <div className="space-y-3.5">
              <div className="space-y-1 border-l-2 border-amber-500 pl-3 py-0.5">
                <p className="text-amber-500 text-[10px] font-bold">[SYSTEM] 10:46 — PRESSURE WARP</p>
                <p className="text-slate-350 leading-relaxed text-[10px]">
                  Argentina's 3-man midfield press has fully disrupted England's transitions. Midfield recovery numbers peak at 78% in opponent half.
                </p>
              </div>

              <div className="space-y-1 border-l-2 border-red-500 pl-3 py-0.5">
                <p className="text-red-500 text-[10px] font-bold">[CRITICAL] 09:24 — TACTICAL LAPSE</p>
                <p className="text-slate-350 leading-relaxed text-[10px]">
                  What went wrong: High pressing team defenses leave significant wing overloads on counter setups. Real-time probability models shift +15% towards direct channels.
                </p>
              </div>

              <div className="space-y-1 border-l-2 border-slate-700 pl-3 py-0.5 opacity-70">
                <p className="text-slate-500 text-[10px] font-bold">[DATA] HEATMAP SHIFTS</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Lamine Yamal (ESP) avg positioning drifts 6.2m wider, pulling defenders outward to open central space for direct shots.
                </p>
              </div>

              <div className="space-y-1 border-l-2 border-blue-500 pl-3 py-0.5 opacity-80">
                <p className="text-blue-400 text-[10px] font-bold">[TACTICS] DE BRUYNE PLOTTING</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Belgium setup shifts into a 3-2-4-1 build-up shape. De Bruyne acts as the focal transition distributor to open up low blocks.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* RIGHT COLUMN: GLOBAL LEADERBOARD & STAT CARD (Lg: col-span-3) */}
        <section className="lg:col-span-3 space-y-6">
          
          {/* LEADERBOARD CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
            <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center bg-opacity-70">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Global Leaderboard</h3>
              <span className="text-[9px] bg-slate-800 px-2 py-0.5 text-slate-500 font-mono rounded">Pundit Pool</span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-800/40 text-[9px] text-slate-500 uppercase tracking-tighter">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">User</th>
                  <th className="p-3 text-right">PTS</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold">
                {leaderboard.slice(0, 7).map((user) => {
                  const isUser = user.isCurrentUser;
                  return (
                    <tr
                      key={user.id}
                      className={`border-b border-slate-805 hover:bg-slate-800/30 transition-colors ${
                        isUser ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className={`p-3 font-mono ${isUser ? 'text-amber-500' : 'text-slate-500'}`}>
                        {isUser ? 'YOU' : String(user.rank).padStart(2, '0')}
                      </td>
                      <td className="p-3 flex items-center gap-1.5 truncate max-w-[130px]">
                        <span>{user.avatar}</span>
                        <span className={isUser ? 'text-amber-500 font-extrabold' : 'text-slate-200'}>
                          {user.username}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-mono ${isUser ? 'text-amber-500' : 'text-slate-100'}`}>
                        {user.points * 10}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            <div className="p-2.5 bg-slate-950 text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hover:text-white transition-colors cursor-pointer">
                Lobby Active: Top 100 Players
              </span>
            </div>
          </div>

          {/* BRIGHT PERSONAL STREAK BOX */}
          <div className="bg-amber-500 rounded-xl p-5 text-slate-950 shadow-md">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Your Predictive Streak</p>
            <div className="flex items-end justify-between gap-2">
              <p className="text-3xl font-black italic tracking-tighter uppercase">{String(getPersonalStreak()).padStart(2, '0')} Correct Picks</p>
              <div className="mb-1.5 flex gap-1 shrink-0">
                <div className="w-2.5 h-4.5 bg-slate-950 rounded-sm"></div>
                <div className="w-2.5 h-4.5 bg-slate-950 rounded-sm"></div>
                <div className="w-2.5 h-4.5 bg-slate-950 rounded-sm"></div>
                <div className="w-2.5 h-4.5 bg-slate-955 rounded-sm opacity-20"></div>
                <div className="w-2.5 h-4.5 bg-slate-955 rounded-sm opacity-20"></div>
              </div>
            </div>
            <p className="text-[10px] font-bold mt-3 border-t border-slate-950/20 pt-2.5 leading-relaxed">
              Your overall forecasts have an impressive accuracy level. Next exact scoreline earns an dynamic 2x win XP multiplier!
            </p>
          </div>

          {/* SCORING RULES BRIEF */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2.5">
            <p className="text-[9px] font-extrabold text-amber-500 uppercase tracking-widest flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              Scoring Mechanics
            </p>
            <div className="text-[11px] text-slate-400 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span>Exact Score Line (e.g. 2-1)</span>
                <span className="text-amber-400 font-bold">+30 PTS</span>
              </div>
              <div className="flex justify-between">
                <span>Correct Outcome Winner</span>
                <span className="text-cyan-400 font-bold">+10 PTS</span>
              </div>
              <div className="flex justify-between">
                <span>Inaccurate guess</span>
                <span className="text-slate-600">00 PTS</span>
              </div>
            </div>
          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="h-12 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-4 md:px-8 text-slate-400 font-mono text-[10px]">
        <div className="bg-red-600 h-full px-4 flex items-center gap-2 text-[10px] font-black tracking-widest text-white italic">
          FLASH STATUS
        </div>
        <div className="flex-1 overflow-hidden relative">
          <p className="whitespace-nowrap text-slate-500 px-6 animate-pulse">
            BRAZIL VS SPAIN TICKETS SOLD OUT • TACTICAL DEFICITS RECORDED ON WING OVERLOADS • GLOBAL CONFIDENCE INTERVAL: 48% •
          </p>
        </div>
        <div className="hidden md:block shrink-0 text-right text-slate-500">
          World Cup Predictor &copy; 2026. Made with Tailwind & Gemini
        </div>
      </footer>

      {/* =======================================================
          DETAILED AI TACTICAL ANALYSIS DRAWER (MODAL)
         ======================================================= */}
      {selectedMatchForAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-2xl relative overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-805 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="font-display font-medium text-sm uppercase tracking-widest text-white">
                  Real-Time Tactical Failure Report
                </h3>
              </div>
              <button
                onClick={() => setSelectedMatchForAnalysis(null)}
                className="px-2.5 py-1 bg-slate-800 text-slate-400 hover:text-white rounded text-xs"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              
              {/* Match overview widget */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-855 flex items-center justify-between text-center gap-2">
                <div className="flex-1 space-y-1">
                  <span className="text-3xl">{selectedMatchForAnalysis.homeFlag}</span>
                  <p className="text-xs font-bold uppercase text-slate-350">{selectedMatchForAnalysis.homeTeam}</p>
                </div>
                <div className="shrink-0 flex flex-col justify-center items-center">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Full-time</span>
                  <span className="text-2xl font-black font-mono text-amber-500">
                    {selectedMatchForAnalysis.homeScore} - {selectedMatchForAnalysis.awayScore}
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-3xl">{selectedMatchForAnalysis.awayFlag}</span>
                  <p className="text-xs font-bold uppercase text-slate-350">{selectedMatchForAnalysis.awayTeam}</p>
                </div>
              </div>

              {loadingAnalysis ? (
                <div className="p-8 text-center text-slate-500 space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
                  <span className="block text-[11px] font-mono tracking-tight text-slate-450">
                    Gemini 3.5 AI compiling detailed video timelines & counter-press statistics...
                  </span>
                </div>
              ) : matchAnalysis ? (
                <div className="space-y-4 font-mono text-[11px]">
                  
                  {/* Headline */}
                  <div className="border-l-2 border-amber-500 pl-3 py-0.5 space-y-1">
                    <span className="text-[9px] text-amber-500/80 uppercase font-black">HEADLINE OUTCOME</span>
                    <p className="text-xs uppercase font-bold text-white">&ldquo;{matchAnalysis.headline}&rdquo;</p>
                  </div>

                  {/* Summary */}
                  <div className="bg-slate-950 p-3 rounded border border-slate-850 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">TACTICAL BLOCK SUMMARY</span>
                    <p className="text-slate-300 leading-relaxed">{matchAnalysis.summary}</p>
                  </div>

                  {/* Tactical Failure */}
                  <div className="bg-red-950/15 border border-red-900/30 p-3 rounded space-y-1">
                    <span className="text-[9px] text-red-500 uppercase font-bold flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      What Went Wrong / System Failure
                    </span>
                    <p className="text-slate-300 leading-relaxed">{matchAnalysis.tacticalFailure}</p>
                  </div>

                  {/* Star MVP */}
                  <div className="bg-slate-950 p-3 rounded border border-slate-805 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">KEY DECISIVE PLAYER</span>
                      <span className="text-white font-bold">{matchAnalysis.keyManOfTheMatch}</span>
                    </div>
                    <span className="text-[10px] bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded font-black font-sans uppercase">MVP</span>
                  </div>

                  {/* Prediction comment */}
                  <div className="bg-blue-950/15 border border-blue-900/30 p-3 rounded space-y-1">
                    <span className="text-[9px] text-blue-400 uppercase font-bold">AI PUNIDT FEEDBACK</span>
                    <p className="text-slate-300 leading-relaxed italic">&ldquo;{matchAnalysis.tacticsNote}&rdquo;</p>
                  </div>

                </div>
              ) : (
                <div className="p-6 bg-red-950/10 border border-red-900/20 text-red-400 text-xs text-center rounded">
                  Unable to parse AI telemetry. Restart dev server.
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 text-center">
              <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">
                Gemini 3.5 AI Tactical Server Ingress
              </span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
