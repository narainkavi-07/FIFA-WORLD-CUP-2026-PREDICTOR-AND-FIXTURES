export enum MatchStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  FINISHED = 'finished'
}

export interface MatchStats {
  shots: [number, number];       // [home, away]
  shotsOnTarget: [number, number];
  possession: [number, number];  // percentage
  fouls: [number, number];
  corners: [number, number];
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'card' | 'sub' | 'var';
  description: string;
  team: 'home' | 'away' | 'none';
}

export interface Match {
  id: string;
  group: string; // e.g., "Group A", "Group B", "Round of 16"
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  date: string;
  time: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  stats?: MatchStats;
  events?: MatchEvent[];
}

export interface Prediction {
  matchId: string;
  predictedWinner: 'home' | 'away' | 'draw';
  predictedHomeScore: number;
  predictedAwayScore: number;
  submittedAt: string;
  pointsEarned?: number; // 3 points for exact score, 1 point for correct outcome, 0 otherwise
}

export interface LeaderboardUser {
  id: string;
  username: string;
  points: number;
  correctScores: number; // 3pt matches
  correctOutcomes: number; // 1pt matches
  predictionsCount: number;
  avatar: string;
  isCurrentUser?: boolean;
}

export interface MatchAnalysisResponse {
  matchId: string;
  headline: string;
  summary: string;
  tacticalFailure: string; // What went wrong for the losing team or why the prediction failed
  keyManOfTheMatch: string;
  tacticsNote: string;
}
