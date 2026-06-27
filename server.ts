import express from "express";
import path from "path";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { Match, MatchStatus, Prediction, LeaderboardUser, MatchAnalysisResponse } from "./src/types";

// Force local DNS resolution to hold up cleanly
dns.setDefaultResultOrder("ipv4first");

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize GoogleGenAI SDK with standard AI Studio requirements
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// INITIAL TOURNAMENT STATE (June 19, 2026 - World Cup ongoing!)
let matches: Match[] = [
  // --- FINISHED MATCHES (June 11 - June 18) ---
  {
    id: "match-1",
    group: "Group A",
    homeTeam: "USA",
    awayTeam: "Morocco",
    homeFlag: "🇺🇸",
    awayFlag: "🇲🇦",
    date: "2026-06-11",
    time: "18:00",
    status: MatchStatus.FINISHED,
    homeScore: 2,
    awayScore: 1,
    stats: {
      shots: [14, 9],
      shotsOnTarget: [6, 4],
      possession: [55, 45],
      fouls: [12, 14],
      corners: [6, 3]
    },
    events: [
      { minute: 18, type: "goal", description: "Christian Pulisic scores from a brilliant diagonal cutback!", team: "home" },
      { minute: 42, type: "card", description: "Yellow Card: Weston McKennie (USA) for a tactical foul.", team: "home" },
      { minute: 58, type: "goal", description: "Youssef En-Nesyri equalizes with a powerful header from a corner!", team: "away" },
      { minute: 79, type: "goal", description: "Folarin Balogun scores the winner, slipping it under the goalkeeper!", team: "home" }
    ]
  },
  {
    id: "match-2",
    group: "Group B",
    homeTeam: "Mexico",
    awayTeam: "Uruguay",
    homeFlag: "🇲🇽",
    awayFlag: "🇺🇾",
    date: "2026-06-12",
    time: "20:00",
    status: MatchStatus.FINISHED,
    homeScore: 1,
    awayScore: 2,
    stats: {
      shots: [8, 16],
      shotsOnTarget: [3, 8],
      possession: [42, 58],
      fouls: [15, 11],
      corners: [2, 7]
    },
    events: [
      { minute: 12, type: "goal", description: "Darwin Núñez fires rockets into the top-right corner!", team: "away" },
      { minute: 36, type: "card", description: "Yellow Card: Edson Álvarez (Mexico) for a hard tackle.", team: "home" },
      { minute: 61, type: "goal", description: "Luis Chávez scores an absolute beauty of a free-kick to equalize!", team: "home" },
      { minute: 83, type: "goal", description: "Federico Valverde strikes from outside the box to retrieve the lead!", team: "away" }
    ]
  },
  {
    id: "match-3",
    group: "Group C",
    homeTeam: "Canada",
    awayTeam: "Australia",
    homeFlag: "🇨🇦",
    awayFlag: "🇦🇺",
    date: "2026-06-13",
    time: "15:00",
    status: MatchStatus.FINISHED,
    homeScore: 1,
    awayScore: 1,
    stats: {
      shots: [11, 10],
      shotsOnTarget: [4, 3],
      possession: [49, 51],
      fouls: [9, 13],
      corners: [4, 5]
    },
    events: [
      { minute: 29, type: "goal", description: "Jonathan David chips the keeper beautifully!", team: "home" },
      { minute: 71, type: "goal", description: "Harry Souttar makes use of his height and heads home from a corner!", team: "away" }
    ]
  },
  {
    id: "match-4",
    group: "Group D",
    homeTeam: "Argentina",
    awayTeam: "England",
    homeFlag: "🇦🇷",
    awayFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    date: "2026-06-14",
    time: "19:00",
    status: MatchStatus.FINISHED,
    homeScore: 3,
    awayScore: 2,
    stats: {
      shots: [17, 12],
      shotsOnTarget: [9, 5],
      possession: [53, 47],
      fouls: [14, 16],
      corners: [8, 4]
    },
    events: [
      { minute: 9, type: "goal", description: "Julian Alvarez clinical strike in the box!", team: "home" },
      { minute: 31, type: "goal", description: "Harry Kane converts from the penalty spot!", team: "away" },
      { minute: 44, type: "goal", description: "Phil Foden curls it from 20 yards out to stun the Albiceleste!", team: "away" },
      { minute: 68, type: "goal", description: "Alexis Mac Allister slams a rebound first-time!", team: "home" },
      { minute: 88, type: "goal", description: "Lautaro Martinez meets a whipped cross in the dying minutes to win it!", team: "home" }
    ]
  },
  {
    id: "match-5",
    group: "Group E",
    homeTeam: "France",
    awayTeam: "Japan",
    homeFlag: "🇫🇷",
    awayFlag: "🇯🇵",
    date: "2026-06-15",
    time: "16:00",
    status: MatchStatus.FINISHED,
    homeScore: 2,
    awayScore: 0,
    stats: {
      shots: [15, 6],
      shotsOnTarget: [7, 2],
      possession: [62, 38],
      fouls: [8, 11],
      corners: [9, 2]
    },
    events: [
      { minute: 34, type: "goal", description: "Kylian Mbappé bursts past three defenders and hits a low drive!", team: "home" },
      { minute: 73, type: "goal", description: "Marcus Thuram taps in a rebound from close range.", team: "home" }
    ]
  },
  {
    id: "match-6",
    group: "Group F",
    homeTeam: "Germany",
    awayTeam: "Italy",
    homeFlag: "🇩🇪",
    awayFlag: "🇮🇹",
    date: "2026-06-16",
    time: "20:00",
    status: MatchStatus.FINISHED,
    homeScore: 1,
    awayScore: 0,
    stats: {
      shots: [12, 8],
      shotsOnTarget: [4, 2],
      possession: [54, 46],
      fouls: [13, 15],
      corners: [5, 4]
    },
    events: [
      { minute: 55, type: "goal", description: "Jamal Musiala scores with a sensational solo run through the middle!", team: "home" },
      { minute: 81, type: "card", description: "Yellow Card: Nicolo Barella (Italy) for arguing with the referee.", team: "away" }
    ]
  },
  {
    id: "match-7",
    group: "Group G",
    homeTeam: "Brazil",
    awayTeam: "Senegal",
    homeFlag: "🇧🇷",
    awayFlag: "🇸🇳",
    date: "2026-06-17",
    time: "17:00",
    status: MatchStatus.FINISHED,
    homeScore: 3,
    awayScore: 1,
    stats: {
      shots: [19, 7],
      shotsOnTarget: [10, 3],
      possession: [64, 36],
      fouls: [9, 18],
      corners: [8, 1]
    },
    events: [
      { minute: 14, type: "goal", description: "Vinícius Júnior taps in at the back post!", team: "home" },
      { minute: 40, type: "goal", description: "Rodrygo scores with a neat finish after a tiki-taka sequence.", team: "home" },
      { minute: 67, type: "goal", description: "Nicolas Jackson pulls one back with a thunderous strike!", team: "away" },
      { minute: 89, type: "goal", description: "Endrick rounds the keeper to score a debut World Cup goal!", team: "home" }
    ]
  },
  {
    id: "match-8",
    group: "Group H",
    homeTeam: "Spain",
    awayTeam: "Portugal",
    homeFlag: "🇪🇸",
    awayFlag: "🇵🇹",
    date: "2026-06-18",
    time: "21:00",
    status: MatchStatus.FINISHED,
    homeScore: 2,
    awayScore: 2,
    stats: {
      shots: [11, 13],
      shotsOnTarget: [5, 6],
      possession: [51, 49],
      fouls: [12, 11],
      corners: [4, 5]
    },
    events: [
      { minute: 22, type: "goal", description: "Lamine Yamal curl into the top corner. Pure genius!", team: "home" },
      { minute: 45, type: "goal", description: "Rafael Leão speeds past the defense and equalizes!", team: "away" },
      { minute: 68, type: "goal", description: "Cristiano Ronaldo scores a high-pressure penalty!", team: "away" },
      { minute: 84, type: "goal", description: "Nico Williams fires a half-volley into the bottom corner!", team: "home" }
    ]
  },

  // --- LIVE MATCHES TODAY (June 19, 2026) ---
  {
    id: "match-9",
    group: "Group A",
    homeTeam: "Belgium",
    awayTeam: "South Korea",
    homeFlag: "🇧🇪",
    awayFlag: "🇰🇷",
    date: "2026-06-19",
    time: "10:00",
    status: MatchStatus.LIVE,
    homeScore: 1,
    awayScore: 1,
    stats: {
      shots: [9, 7],
      shotsOnTarget: [4, 3],
      possession: [56, 44],
      fouls: [8, 9],
      corners: [5, 3]
    },
    events: [
      { minute: 24, type: "goal", description: "Lois Openda heads in from an elegant De Bruyne cross!", team: "home" },
      { minute: 61, type: "goal", description: "Son Heung-min slides a delicate finish into the side netting!", team: "away" }
    ]
  },
  {
    id: "match-10",
    group: "Group B",
    homeTeam: "Colombia",
    awayTeam: "Netherlands",
    homeFlag: "🇨🇴",
    awayFlag: "🇳🇱",
    date: "2026-06-19",
    time: "13:00",
    status: MatchStatus.LIVE,
    homeScore: 0,
    awayScore: 1,
    stats: {
      shots: [5, 8],
      shotsOnTarget: [2, 4],
      possession: [43, 57],
      fouls: [10, 7],
      corners: [2, 4]
    },
    events: [
      { minute: 15, type: "goal", description: "Cody Gakpo scores a clean strike inside the near post!", team: "away" },
      { minute: 29, type: "card", description: "Yellow Card: Virgil van Dijk (Netherlands) for persistent warning.", team: "away" }
    ]
  },

  // --- SCHEDULED MATCHES (June 20 - June 24) ---
  {
    id: "match-11",
    group: "Group C",
    homeTeam: "Croatia",
    awayTeam: "Morocco",
    homeFlag: "🇭🇷",
    awayFlag: "🇲🇦",
    date: "2026-06-20",
    time: "15:00",
    status: MatchStatus.SCHEDULED
  },
  {
    id: "match-12",
    group: "Group D",
    homeTeam: "Uruguay",
    awayTeam: "Senegal",
    homeFlag: "🇺🇾",
    awayFlag: "🇸🇳",
    date: "2026-06-20",
    time: "18:00",
    status: MatchStatus.SCHEDULED
  },
  {
    id: "match-13",
    group: "Group E",
    homeTeam: "France",
    awayTeam: "Germany",
    homeFlag: "🇫🇷",
    awayFlag: "🇩🇪",
    date: "2026-06-21",
    time: "19:00",
    status: MatchStatus.SCHEDULED
  },
  {
    id: "match-14",
    group: "Group F",
    homeTeam: "Italy",
    awayTeam: "Argentina",
    homeFlag: "🇮🇹",
    awayFlag: "🇦🇷",
    date: "2026-06-21",
    time: "21:00",
    status: MatchStatus.SCHEDULED
  },
  {
    id: "match-15",
    group: "Group G",
    homeTeam: "Brazil",
    awayTeam: "Spain",
    homeFlag: "🇧🇷",
    awayFlag: "🇪🇸",
    date: "2026-06-22",
    time: "16:00",
    status: MatchStatus.SCHEDULED
  },
  {
    id: "match-16",
    group: "Group H",
    homeTeam: "England",
    awayTeam: "Japan",
    homeFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    awayFlag: "🇯🇵",
    date: "2026-06-22",
    time: "20:00",
    status: MatchStatus.SCHEDULED
  },
  {
    id: "match-17",
    group: "Group A",
    homeTeam: "USA",
    awayTeam: "Netherlands",
    homeFlag: "🇺🇸",
    awayFlag: "🇳🇱",
    date: "2026-06-23",
    time: "17:00",
    status: MatchStatus.SCHEDULED
  }
];

// SIMULATED COMPETITORS (Virtual Leaderboard Competitors)
const competitors: Omit<LeaderboardUser, "points" | "correctScores" | "correctOutcomes">[] = [
  { id: "comp-1", username: "KylianPredicts", avatar: "⚽", predictionsCount: 17 },
  { id: "comp-2", username: "SambaStar", avatar: "✨", predictionsCount: 17 },
  { id: "comp-3", username: "TacticalGeni", avatar: "🧠", predictionsCount: 17 },
  { id: "comp-4", username: "LuckyStrike", avatar: "🎯", predictionsCount: 17 },
  { id: "comp-5", username: "MessiClassic", avatar: "🐐", predictionsCount: 17 },
  { id: "comp-6", username: "ThreeLionsFan", avatar: "🦁", predictionsCount: 17 },
  { id: "comp-7", username: "CalcioNerd", avatar: "🛡️", predictionsCount: 17 },
  { id: "comp-8", username: "YankeeDoodle", avatar: "🦅", predictionsCount: 17 },
];

// Competitor prediction strategies
function getCompetitorScorePrediction(competitorId: string, match: Match): [number, number] {
  const hash = match.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  switch (competitorId) {
    case "comp-1": // KylianPredicts: Favors Europe, high scores
      if (["France", "Germany", "Belgium", "Netherlands", "Croatia", "Italy", "Spain", "England"].includes(match.homeTeam)) {
        return [2, 0];
      }
      return [1, 1];
    case "comp-2": // SambaStar: Highly offensive, Brazil supporter
      if (match.homeTeam === "Brazil" || match.awayTeam === "Brazil") {
        return match.homeTeam === "Brazil" ? [4, 1] : [1, 4];
      }
      return [2, 2];
    case "comp-3": // TacticalGeni: Practical, low variance
      return (hash % 3 === 0) ? [1, 0] : (hash % 3 === 1 ? [0, 1] : [1, 1]);
    case "comp-4": // LuckyStrike: Chaos, high scores
      return [hash % 4, (hash + 2) % 4];
    case "comp-5": // MessiClassic: Argentina lover, star-focused high scores
      if (match.homeTeam === "Argentina" || match.awayTeam === "Argentina") {
        return match.homeTeam === "Argentina" ? [3, 0] : [0, 3];
      }
      return [2, 1];
    case "comp-6": // ThreeLionsFan: Stubborn English bias
      if (match.homeTeam === "England") return [2, 0];
      if (match.awayTeam === "England") return [0, 2];
      return [1, 1];
    case "comp-7": // CalcioNerd: Super defensive Italian style
      return (hash % 2 === 0) ? [0, 0] : [1, 0];
    case "comp-8": // YankeeDoodle: High on North America
      if (["USA", "Mexico", "Canada"].includes(match.homeTeam)) return [2, 1];
      if (["USA", "Mexico", "Canada"].includes(match.awayTeam)) return [1, 2];
      return [0, 1];
    default:
      return [1, 1];
  }
}

// Calculate points given actual scores and predicted scores
function calculatePredictionPoints(actualH: number | undefined, actualA: number | undefined, predH: number, predA: number): { points: number; outcome: boolean; exact: boolean } {
  if (actualH === undefined || actualA === undefined) return { points: 0, outcome: false, exact: false };

  const actualWinner = actualH > actualA ? 'home' : (actualH < actualA ? 'away' : 'draw');
  const predWinner = predH > predA ? 'home' : (predH < predA ? 'away' : 'draw');

  const exact = actualH === predH && actualA === predA;
  const outcome = actualWinner === predWinner;

  let points = 0;
  if (exact) {
    points = 3;
  } else if (outcome) {
    points = 1;
  }

  return { points, outcome, exact };
}

// Memory database of user predictions (with a sample initialized to show prediction records)
let userPredictions: Prediction[] = [
  { matchId: "match-1", predictedWinner: "home", predictedHomeScore: 2, predictedAwayScore: 1, submittedAt: new Date().toISOString() },
  { matchId: "match-2", predictedWinner: "away", predictedHomeScore: 0, predictedAwayScore: 2, submittedAt: new Date().toISOString() },
  { matchId: "match-3", predictedWinner: "home", predictedHomeScore: 2, predictedAwayScore: 1, submittedAt: new Date().toISOString() },
  { matchId: "match-4", predictedWinner: "home", predictedHomeScore: 3, predictedAwayScore: 1, submittedAt: new Date().toISOString() },
  { matchId: "match-5", predictedWinner: "home", predictedHomeScore: 2, predictedAwayScore: 0, submittedAt: new Date().toISOString() },
  { matchId: "match-6", predictedWinner: "draw", predictedHomeScore: 1, predictedAwayScore: 1, submittedAt: new Date().toISOString() },
  { matchId: "match-7", predictedWinner: "home", predictedHomeScore: 4, predictedAwayScore: 1, submittedAt: new Date().toISOString() },
  { matchId: "match-8", predictedWinner: "away", predictedHomeScore: 1, predictedAwayScore: 2, submittedAt: new Date().toISOString() },
  { matchId: "match-9", predictedWinner: "draw", predictedHomeScore: 1, predictedAwayScore: 1, submittedAt: new Date().toISOString() }, // matches current LIVE Belgian-Korea score!
];

// Memory database of detailed analysis results so we don't query Gemini repeatedly for the same static match analyses
let analysisCache: Record<string, MatchAnalysisResponse> = {};

// REST API DEFINITIONS

// Get matches list
app.get("/api/matches", (req, res) => {
  res.json({ matches });
});

// Submit/Update user prediction
app.post("/api/predict", (req, res) => {
  const { matchId, homeScore, awayScore } = req.body;
  if (!matchId || homeScore === undefined || awayScore === undefined) {
    res.status(400).json({ error: "Missing matchId, homeScore, or awayScore" });
    return;
  }

  const match = matches.find(m => m.id === matchId);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  if (match.status !== MatchStatus.SCHEDULED) {
    res.status(400).json({ error: "Cannot predict a game that has already started or finished" });
    return;
  }

  const predictedWinner = homeScore > awayScore ? 'home' : (homeScore < awayScore ? 'away' : 'draw');

  const existingIdx = userPredictions.findIndex(p => p.matchId === matchId);
  const predictionObj: Prediction = {
    matchId,
    predictedWinner,
    predictedHomeScore: Number(homeScore),
    predictedAwayScore: Number(awayScore),
    submittedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    userPredictions[existingIdx] = predictionObj;
  } else {
    userPredictions.push(predictionObj);
  }

  res.json({ success: true, prediction: predictionObj });
});

// Retrieve User Predictions list
app.get("/api/predictions", (req, res) => {
  res.json({ predictions: userPredictions });
});

// Retrieve Current Leaderboard (dynamically calculated)
app.get("/api/leaderboard", (req, res) => {
  const leaderboard: LeaderboardUser[] = [];

  // Compute User standings
  let userPoints = 0;
  let userScores = 0;
  let userOutcomes = 0;

  userPredictions.forEach(pred => {
    const match = matches.find(m => m.id === pred.matchId);
    if (match && match.status === MatchStatus.FINISHED) {
      const calc = calculatePredictionPoints(match.homeScore, match.awayScore, pred.predictedHomeScore, pred.predictedAwayScore);
      userPoints += calc.points;
      if (calc.exact) userScores++;
      else if (calc.outcome) userOutcomes++;
    }
  });

  leaderboard.push({
    id: "user-current",
    username: "You (Predictor)",
    points: userPoints,
    correctScores: userScores,
    correctOutcomes: userOutcomes,
    predictionsCount: userPredictions.length,
    avatar: "🏆",
    isCurrentUser: true
  });

  // Compute Competitor standings
  competitors.forEach(comp => {
    let compPoints = 0;
    let compScores = 0;
    let compOutcomes = 0;
    let counted = 0;

    matches.forEach(match => {
      if (match.status === MatchStatus.FINISHED) {
        const [pHome, pAway] = getCompetitorScorePrediction(comp.id, match);
        const calc = calculatePredictionPoints(match.homeScore, match.awayScore, pHome, pAway);
        compPoints += calc.points;
        if (calc.exact) compScores++;
        else if (calc.outcome) compOutcomes++;
        counted++;
      }
    });

    leaderboard.push({
      id: comp.id,
      username: comp.username,
      points: compPoints,
      correctScores: compScores,
      correctOutcomes: compOutcomes,
      predictionsCount: counted,
      avatar: comp.avatar
    });
  });

  // Sort by points desc, then correct scores count, then alphabetical
  leaderboard.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.correctScores !== a.correctScores) return b.correctScores - a.correctScores;
    return a.username.localeCompare(b.username);
  });

  res.json({
    leaderboard: leaderboard.map((itm, idx) => ({ ...itm, rank: idx + 1 }))
  });
});

// SIMULATION TICK ENDPOINT
// Moves live games forward, injects goals/events, finishes games, and opens the next upcoming game
app.post("/api/simulate-tick", (req, res) => {
  let updatedAny = false;
  let simulatedEvents: string[] = [];

  matches = matches.map(match => {
    if (match.status === MatchStatus.LIVE) {
      updatedAny = true;
      const currentEvents = match.events || [];
      const latestMinute = currentEvents.length > 0 ? Math.max(...currentEvents.map(e => e.minute)) : 1;
      const newMinute = Math.min(90, latestMinute + Math.floor(Math.random() * 15) + 5);

      if (newMinute >= 90) {
        // Match finishes!
        match.status = MatchStatus.FINISHED;
        simulatedEvents.push(`${match.homeTeam} vs ${match.awayTeam} has finished! Final score: ${match.homeScore} - ${match.awayScore}.`);
      } else {
        // Random match event (goal, card, VAR)
        const rand = Math.random();
        if (rand < 0.35) { // Goal!
          const scoringTeam = Math.random() > 0.5 ? 'home' : 'away';
          if (scoringTeam === 'home') match.homeScore = (match.homeScore || 0) + 1;
          else match.awayScore = (match.awayScore || 0) + 1;

          const desc = scoringTeam === 'home' 
            ? `GOAL for ${match.homeTeam}! Striker bangs a rebound into the roof of the net after tactical cross.` 
            : `GOAL for ${match.awayTeam}! Midfield counter-press splits the defense, finished into bottom corner.`;

          currentEvents.push({
            minute: newMinute,
            type: 'goal',
            description: desc,
            team: scoringTeam
          });
          simulatedEvents.push(`[${newMinute}'] Goal! ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}`);
        } else if (rand < 0.6) { // Card
          const cardTeam = Math.random() > 0.5 ? 'home' : 'away';
          const player = cardTeam === 'home' ? `${match.homeTeam} Defender` : `${match.awayTeam} Playmaker`;
          currentEvents.push({
            minute: newMinute,
            type: 'card',
            description: `Yellow Card: ${player} booked for an aggregated string of challenges.`,
            team: cardTeam
          });
        }

        // Simulating some statistics increase
        if (match.stats) {
          match.stats.shots[0] += Math.floor(Math.random() * 2);
          match.stats.shots[1] += Math.floor(Math.random() * 2);
          match.stats.shotsOnTarget[0] += Math.floor(Math.random() * 1);
          match.stats.shotsOnTarget[1] += Math.floor(Math.random() * 1);
          match.stats.possession = Math.random() > 0.5 ? [53, 47] : [48, 52];
          match.stats.fouls[0] += Math.floor(Math.random() * 2);
          match.stats.fouls[1] += Math.floor(Math.random() * 2);
        }
      }

      return {
        ...match,
        events: currentEvents.sort((a, b) => a.minute - b.minute)
      };
    }
    return match;
  });

  // If no live matches, let's take the first scheduled match and turn it LIVE!
  if (!matches.some(m => m.status === MatchStatus.LIVE)) {
    const nextScheduled = matches.find(m => m.status === MatchStatus.SCHEDULED);
    if (nextScheduled) {
      nextScheduled.status = MatchStatus.LIVE;
      nextScheduled.homeScore = 0;
      nextScheduled.awayScore = 0;
      nextScheduled.stats = {
        shots: [0, 0],
        shotsOnTarget: [0, 0],
        possession: [50, 50],
        fouls: [0, 0],
        corners: [0, 0]
      };
      nextScheduled.events = [
        { minute: 1, type: "var", description: "Match started! Ref blows the whistle under the roaring stadium lights.", team: "none" }
      ];
      updatedAny = true;
      simulatedEvents.push(`Match Kickoff: ${nextScheduled.homeTeam} vs ${nextScheduled.awayTeam} is now LIVE!`);
    }
  }

  res.json({ success: true, updated: updatedAny, events: simulatedEvents, matches });
});

// QUICK SIMULATE MATCH INSTANTLY (Finished State)
app.post("/api/simulate-match/:id", (req, res) => {
  const matchId = req.params.id;
  const matchIdx = matches.findIndex(m => m.id === matchId);

  if (matchIdx < 0) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const match = matches[matchIdx];
  if (match.status === MatchStatus.FINISHED) {
    res.json({ success: true, message: "Match already finished", match });
    return;
  }

  // Generate dynamic simulation results
  const homeOdds = match.homeTeam === "France" || match.homeTeam === "Brazil" || match.homeTeam === "Argentina" ? 2.5 : 1.5;
  const hScore = Math.floor(Math.random() * (homeOdds + 1));
  const aScore = Math.floor(Math.random() * 3);

  matches[matchIdx] = {
    ...match,
    status: MatchStatus.FINISHED,
    homeScore: hScore,
    awayScore: aScore,
    stats: {
      shots: [10 + Math.floor(Math.random() * 10), 10 + Math.floor(Math.random() * 10)],
      shotsOnTarget: [4 + Math.floor(Math.random() * 5), 4 + Math.floor(Math.random() * 5)],
      possession: Math.random() > 0.5 ? [55, 45] : [45, 55],
      fouls: [10 + Math.floor(Math.random() * 8), 10 + Math.floor(Math.random() * 8)],
      corners: [3 + Math.floor(Math.random() * 6), 3 + Math.floor(Math.random() * 6)]
    },
    events: [
      { minute: 1, type: "var", description: "Match kick-off!", team: "none" },
      { minute: 45, type: "sub", description: "Tactical substitutions made at half-time.", team: "none" },
      ...(hScore > 0 ? [{ minute: 28, type: "goal" as const, description: `Goal! ${match.homeTeam} score inside the penalty area.`, team: "home" as const }] : []),
      ...(aScore > 0 ? [{ minute: 61, type: "goal" as const, description: `Goal! ${match.awayTeam} find the equalizer on the counter.`, team: "away" as const }] : []),
      ...(hScore > 1 ? [{ minute: 82, type: "goal" as const, description: `Goal! ${match.homeTeam} hammer a header into the net.`, team: "home" as const }] : []),
      ...(aScore > 1 ? [{ minute: 87, type: "goal" as const, description: `Goal! ${match.awayTeam} surprise with a distance rocket.`, team: "away" as const }] : []),
      { minute: 90, type: "var", description: "Full-time whistled!", team: "none" }
    ]
  };

  res.json({ success: true, match: matches[matchIdx] });
});

// TACTICAL ANALYTIC FEED BY GEMINI
// Generates expert "what went wrong" and prediction commentary
app.post("/api/analyze", async (req, res) => {
  const { matchId } = req.body;
  if (!matchId) {
    res.status(400).json({ error: "Missing matchId parameter" });
    return;
  }

  // Use cached description if already computed to avoid redundant API cost
  if (analysisCache[matchId]) {
    res.json(analysisCache[matchId]);
    return;
  }

  const match = matches.find(m => m.id === matchId);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  if (match.status !== MatchStatus.FINISHED) {
    res.status(400).json({ error: "Analytics feed are only compiled for finished matches" });
    return;
  }

  // Look for any user predictions to evaluate
  const userPred = userPredictions.find(p => p.matchId === matchId);
  let userPredictionSummary = "No prediction made by user.";
  if (userPred) {
    userPredictionSummary = `User predicted ${userPred.predictedHomeScore} - ${userPred.predictedAwayScore} (Winner: ${userPred.predictedWinner}).`;
  }

  const matchSummaryContext = `
    Match Details:
    Home: ${match.homeTeam} (Flag: ${match.homeFlag})
    Away: ${match.awayTeam} (Flag: ${match.awayFlag})
    Full-time Score: ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}
    Stats:
    - Shots: ${match.stats?.shots[0]} vs ${match.stats?.shots[1]}
    - Shots on Target: ${match.stats?.shotsOnTarget[0]} vs ${match.stats?.shotsOnTarget[1]}
    - Possession: ${match.stats?.possession[0]}% vs ${match.stats?.possession[1]}%
    - Fouls: ${match.stats?.fouls[0]} vs ${match.stats?.fouls[1]}
    - Corners: ${match.stats?.corners[0]} vs ${match.stats?.corners[1]}
    
    Match Events Timeline:
    ${JSON.stringify(match.events)}

    User Prediction Context:
    ${userPredictionSummary}
  `;

  try {
    const prompt = `
      You are an expert World Cup tactical football analyst writing a breakdown for a live prediction dashboard.
      Analyze the match outcome using the context below.
      Specifically explain "what went wrong" for the losing team (or both teams if a disappointing draw), referencing the statistics (e.g. possession mismatch vs counter-attacking efficiency, red cards, key errors).
      Also write a custom cheeky commentary on the User's prediction. If they guessed exact, praise them highly. If they got the outcome right but score wrong, say "decent insight". If they got it completely wrong, wittily roast their prediction.
      
      Response MUST be a valid JSON object matching this schema exactly:
      {
        "matchId": "string",
        "headline": "A short, trendy, catchy newspaper-style football headline",
        "summary": "A 2-3 sentence overview highlighting the decisive match moments and overall flow",
        "tacticalFailure": "A precise analytical breakdown of what went wrong for the underperformer or loser (e.g., failed defensive block, midfield turnovers, high-line vulnerability)",
        "keyManOfTheMatch": "A realistic name of a hero player who decided this match and what they did on the pitch",
        "tacticsNote": "Your custom commentary comparing the final score to the User's prediction"
      }

      Context:
      ${matchSummaryContext}
    `;

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["matchId", "headline", "summary", "tacticalFailure", "keyManOfTheMatch", "tacticsNote"],
          properties: {
            matchId: { type: Type.STRING },
            headline: { type: Type.STRING },
            summary: { type: Type.STRING },
            tacticalFailure: { type: Type.STRING },
            keyManOfTheMatch: { type: Type.STRING },
            tacticsNote: { type: Type.STRING }
          }
        }
      }
    });

    const aiText = result.text;
    if (!aiText) throw new Error("No response string received from Gemini");

    const parsed: MatchAnalysisResponse = JSON.parse(aiText.trim());
    parsed.matchId = matchId; // Ensure correct mapping
    analysisCache[matchId] = parsed;

    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    // Fallback professional offline reporting if Gemini fails or is unauthorized
    const homeWon = (match.homeScore || 0) > (match.awayScore || 0);
    const loser = homeWon ? match.awayTeam : match.homeTeam;
    const winner = homeWon ? match.homeTeam : match.awayTeam;

    const fallbackResponse: MatchAnalysisResponse = {
      matchId,
      headline: `${winner} Overpowers ${loser} as Tactical Gaps showing`,
      summary: `A fiercely contested tie where ${winner} exploited key spaces. The scoreline ended ${match.homeScore} - ${match.awayScore}.`,
      tacticalFailure: `${loser} struggled to contain wing overloads, allowing deep crossing options. Poor transitioning in central midfield caused costly possession turn-overs.`,
      keyManOfTheMatch: `Match winner and playmaker of ${winner}`,
      tacticsNote: userPred 
        ? `You predicted ${userPred.predictedHomeScore}-${userPred.predictedAwayScore}. Actual score: ${match.homeScore}-${match.awayScore}. Keep studying the structures!`
        : `No prediction logged for this clash.`
    };
    analysisCache[matchId] = fallbackResponse;
    res.json(fallbackResponse);
  }
});


// FRONTEND EMBED VITE AS EXPRESS MIDDLEWARE
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on port ${PORT}`);
  });
}

startServer();
