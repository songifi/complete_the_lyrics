import { parentPort, workerData } from 'worker_threads';
import { PlayerStats } from '../entities/player-stats.entity';

interface WorkerData {
  type: 'CALCULATE_RANKINGS' | 'PROCESS_BATCH_STATS' | 'GENERATE_ANALYTICS';
  payload: any;
}

interface RankingCalculation {
  playerStats: PlayerStats[];
  weights: any;
}

parentPort?.on('message', async (data: WorkerData) => {
  try {
    let result;

    switch (data.type) {
      case 'CALCULATE_RANKINGS':
        result = await calculateRankings(data.payload as RankingCalculation);
        break;
      case 'PROCESS_BATCH_STATS':
        result = await processBatchStats(data.payload);
        break;
      case 'GENERATE_ANALYTICS':
        result = await generateAnalytics(data.payload);
        break;
      default:
        throw new Error(`Unknown worker task type: ${data.type}`);
    }

    parentPort?.postMessage({ success: true, result });
  } catch (error) {
    parentPort?.postMessage({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

async function calculateRankings(data: RankingCalculation) {
  const { playerStats, weights } = data;
  
  // Group stats by player
  const playerScores = new Map<string, { totalScore: number; stats: PlayerStats[] }>();
  
  playerStats.forEach(stat => {
    const existing = playerScores.get(stat.playerId) || { totalScore: 0, stats: [] };
    existing.totalScore += stat.calculatedScore;
    existing.stats.push(stat);
    playerScores.set(stat.playerId, existing);
  });

  // Calculate weighted scores and rank
  const rankings = Array.from(playerScores.entries()).map(([playerId, data]) => {
    const categoryScores = new Map<string, number>();
    
    data.stats.forEach(stat => {
      const current = categoryScores.get(stat.category) || 0;
      categoryScores.set(stat.category, current + stat.calculatedScore);
    });

    let weightedScore = 0;
    categoryScores.forEach((score, category) => {
      const weight = weights[category] || 0.1;
      weightedScore += score * weight;
    });

    return {
      playerId,
      score: Math.round(weightedScore * 100) / 100,
      categoryScores: Object.fromEntries(categoryScores)
    };
  });

  // Sort by score and assign ranks
  rankings.sort((a, b) => b.score - a.score);
  
  return rankings.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}

async function processBatchStats(data: { stats: PlayerStats[]; batchSize: number }) {
  const { stats, batchSize } = data;
  const results = [];
  
  for (let i = 0; i < stats.length; i += batchSize) {
    const batch = stats.slice(i, i + batchSize);
    
    // Process each stat in the batch
    const batchResults = batch.map(stat => {
      // Perform heavy calculations here
      const enhancedMetrics = {
        ...stat.metrics,
        efficiency: calculateEfficiency(stat.metrics),
        performanceIndex: calculatePerformanceIndex(stat.metrics),
        consistencyScore: calculateConsistencyScore(stat.metrics)
      };

      return {
        ...stat,
        enhancedMetrics
      };
    });

    results.push(...batchResults);
  }
  
  return results;
}

async function generateAnalytics(data: { 
  stats: PlayerStats[]; 
  timeframe: string; 
  analysisType: string 
}) {
  const { stats, timeframe, analysisType } = data;
  
  switch (analysisType) {
    case 'trend_analysis':
      return performTrendAnalysis(stats);
    case 'performance_prediction':
      return performancePredicition(stats);
    case 'player_clustering':
      return performPlayerClustering(stats);
    default:
      return { error: 'Unknown analysis type' };
  }
}

function calculateEfficiency(metrics: any): number {
  const kills = metrics.kills || 0;
  const deaths = metrics.deaths || 0;
  const accuracy = metrics.accuracy || 0;
  
  if (deaths === 0) return kills * accuracy / 100;
  return (kills / deaths) * (accuracy / 100);
}

function calculatePerformanceIndex(metrics: any): number {
  const factors = [
    metrics.kills || 0,
    (metrics.accuracy || 0) / 10,
    (metrics.experience || 0) / 1000,
    metrics.questsCompleted || 0
  ];
  
  return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
}

function calculateConsistencyScore(metrics: any): number {
  const values = Object.values(metrics).filter(v => typeof v === 'number') as number[];
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return Math.max(0, 100 - (stdDev / mean) * 100);
}

function performTrendAnalysis(stats: PlayerStats[]) {
  // Implement trend analysis algorithm
  const trends = new Map<string, number[]>();
  
  stats.forEach(stat => {
    Object.entries(stat.metrics).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (!trends.has(key)) trends.set(key, []);
        trends.get(key)?.push(value);
      }
    });
  });

  const analysis = {};
  trends.forEach((values, metric) => {
    const slope = calculateTrendSlope(values);
    analysis[metric] = {
      trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
      strength: Math.abs(slope),
      direction: slope
    };
  });

  return analysis;
}

function performancePredicition(stats: PlayerStats[]) {
  // Simple linear regression for performance prediction
  const predictions = {};
  const metrics = ['kills', 'score', 'experience'];
  
  metrics.forEach(metric => {
    const values = stats
      .map(s => s.metrics[metric])
      .filter(v => typeof v === 'number') as number[];
    
    if (values.length > 1) {
      const slope = calculateTrendSlope(values);
      const lastValue = values[values.length - 1];
      const predictedNext = lastValue + slope;
      
      predictions[metric] = {
        current: lastValue,
        predicted: Math.max(0, predictedNext),
        confidence: Math.min(100, (values.length / 10) * 100)
      };
    }
  });

  return predictions;
}

function performPlayerClustering(stats: PlayerStats[]) {
  // Simple k-means clustering based on performance metrics
  const playerData = new Map<string, number[]>();
  
  stats.forEach(stat => {
    if (!playerData.has(stat.playerId)) {
      playerData.set(stat.playerId, []);
    }
    
    const features = [
      stat.metrics.kills || 0,
      stat.metrics.deaths || 0,
      stat.metrics.accuracy || 0,
      stat.calculatedScore
    ];
    
    playerData.get(stat.playerId)?.push(...features);
  });

  // Normalize and cluster (simplified)
  const clusters = {
    casual: [],
    competitive: [],
    expert: []
  };

  playerData.forEach((features, playerId) => {
    const avgScore = features[features.length - 1]; // Last feature is calculated score
    
    if (avgScore < 100) {
      clusters.casual.push(playerId);
    } else if (avgScore < 500) {
      clusters.competitive.push(playerId);
    } else {
      clusters.expert.push(playerId);
    }
  });

  return clusters;
}

function calculateTrendSlope(values: number[]): number {
  if (values.length < 2) return 0;
  
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = values;
  
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);
  
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}
