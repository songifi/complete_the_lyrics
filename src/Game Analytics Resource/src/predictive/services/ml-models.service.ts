import { Injectable, Logger } from "@nestjs/common"
import * as tf from "@tensorflow/tfjs-node"
import type { PlayerBehavior } from "../../player/entities/player-behavior.entity"
import type { Repository } from "typeorm"

export interface ChurnPrediction {
  playerId: string
  churnProbability: number
  riskLevel: "low" | "medium" | "high"
  factors: Array<{
    feature: string
    importance: number
    value: number
  }>
}

export interface LTVPrediction {
  playerId: string
  predictedLTV: number
  confidence: number
  timeHorizon: number // days
}

@Injectable()
export class MLModelsService {
  private readonly logger = new Logger("MLModelsService")
  private churnModel: tf.LayersModel | null = null
  private ltvModel: tf.LayersModel | null = null

  constructor(private readonly behaviorRepository: Repository<PlayerBehavior>) {
    this.initializeModels()
  }

  private async initializeModels(): Promise<void> {
    try {
      await this.loadOrCreateChurnModel()
      await this.loadOrCreateLTVModel()
      this.logger.log("ML models initialized successfully")
    } catch (error) {
      this.logger.error("Failed to initialize ML models", error)
    }
  }

  private async loadOrCreateChurnModel(): Promise<void> {
    try {
      // Try to load existing model
      this.churnModel = await tf.loadLayersModel("file://./models/churn_model/model.json")
      this.logger.log("Churn model loaded from disk")
    } catch (error) {
      // Create new model if loading fails
      this.churnModel = this.createChurnModel()
      this.logger.log("Created new churn model")
    }
  }

  private async loadOrCreateLTVModel(): Promise<void> {
    try {
      this.ltvModel = await tf.loadLayersModel("file://./models/ltv_model/model.json")
      this.logger.log("LTV model loaded from disk")
    } catch (error) {
      this.ltvModel = this.createLTVModel()
      this.logger.log("Created new LTV model")
    }
  }

  private createChurnModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [12], // 12 features
          units: 64,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 32,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: "relu",
        }),
        tf.layers.dense({
          units: 1,
          activation: "sigmoid", // Binary classification
        }),
      ],
    })

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    })

    return model
  }

  private createLTVModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [10], // 10 features
          units: 128,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 64,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: "relu",
        }),
        tf.layers.dense({
          units: 1,
          activation: "linear", // Regression
        }),
      ],
    })

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "meanSquaredError",
      metrics: ["mae"],
    })

    return model
  }

  async trainChurnModel(): Promise<void> {
    if (!this.churnModel) {
      throw new Error("Churn model not initialized")
    }

    this.logger.log("Starting churn model training")

    // Get training data
    const trainingData = await this.prepareChurnTrainingData()

    if (trainingData.features.length === 0) {
      this.logger.warn("No training data available for churn model")
      return
    }

    const xs = tf.tensor2d(trainingData.features)
    const ys = tf.tensor2d(trainingData.labels, [trainingData.labels.length, 1])

    // Train the model
    const history = await this.churnModel.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            this.logger.log(
              `Churn model epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`,
            )
          }
        },
      },
    })

    // Save the model
    await this.churnModel.save("file://./models/churn_model")

    xs.dispose()
    ys.dispose()

    this.logger.log("Churn model training completed")
  }

  async trainLTVModel(): Promise<void> {
    if (!this.ltvModel) {
      throw new Error("LTV model not initialized")
    }

    this.logger.log("Starting LTV model training")

    const trainingData = await this.prepareLTVTrainingData()

    if (trainingData.features.length === 0) {
      this.logger.warn("No training data available for LTV model")
      return
    }

    const xs = tf.tensor2d(trainingData.features)
    const ys = tf.tensor2d(trainingData.labels, [trainingData.labels.length, 1])

    await this.ltvModel.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            this.logger.log(
              `LTV model epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, mae=${logs?.val_mae?.toFixed(4)}`,
            )
          }
        },
      },
    })

    await this.ltvModel.save("file://./models/ltv_model")

    xs.dispose()
    ys.dispose()

    this.logger.log("LTV model training completed")
  }

  async predictChurn(playerId: string): Promise<ChurnPrediction> {
    if (!this.churnModel) {
      throw new Error("Churn model not initialized")
    }

    const features = await this.extractChurnFeatures(playerId)
    const featureTensor = tf.tensor2d([features])

    const prediction = this.churnModel.predict(featureTensor) as tf.Tensor
    const churnProbability = (await prediction.data())[0]

    featureTensor.dispose()
    prediction.dispose()

    const riskLevel = this.determineRiskLevel(churnProbability)
    const factors = this.getChurnFactors(features)

    return {
      playerId,
      churnProbability,
      riskLevel,
      factors,
    }
  }

  async predictLTV(playerId: string, timeHorizon = 365): Promise<LTVPrediction> {
    if (!this.ltvModel) {
      throw new Error("LTV model not initialized")
    }

    const features = await this.extractLTVFeatures(playerId)
    const featureTensor = tf.tensor2d([features])

    const prediction = this.ltvModel.predict(featureTensor) as tf.Tensor
    const predictedLTV = (await prediction.data())[0]

    featureTensor.dispose()
    prediction.dispose()

    // Calculate confidence based on model uncertainty (simplified)
    const confidence = Math.min(0.95, Math.max(0.5, 1 - Math.abs(predictedLTV) / 1000))

    return {
      playerId,
      predictedLTV: Math.max(0, predictedLTV),
      confidence,
      timeHorizon,
    }
  }

  private async prepareChurnTrainingData(): Promise<{ features: number[][]; labels: number[] }> {
    // Get player behavior data for the last 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const behaviors = await this.behaviorRepository
      .createQueryBuilder("behavior")
      .where("behavior.date >= :startDate", { startDate: ninetyDaysAgo })
      .getMany()

    const playerData = new Map<string, PlayerBehavior[]>()

    // Group by player
    for (const behavior of behaviors) {
      if (!playerData.has(behavior.playerId)) {
        playerData.set(behavior.playerId, [])
      }
      playerData.get(behavior.playerId)!.push(behavior)
    }

    const features: number[][] = []
    const labels: number[] = []

    for (const [playerId, playerBehaviors] of playerData) {
      if (playerBehaviors.length < 7) continue // Need at least a week of data

      const playerFeatures = await this.extractChurnFeatures(playerId)
      const isChurned = this.isPlayerChurned(playerBehaviors)

      features.push(playerFeatures)
      labels.push(isChurned ? 1 : 0)
    }

    return { features, labels }
  }

  private async prepareLTVTrainingData(): Promise<{ features: number[][]; labels: number[] }> {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180)

    const behaviors = await this.behaviorRepository
      .createQueryBuilder("behavior")
      .where("behavior.date >= :startDate", { startDate: sixMonthsAgo })
      .getMany()

    const playerData = new Map<string, PlayerBehavior[]>()

    for (const behavior of behaviors) {
      if (!playerData.has(behavior.playerId)) {
        playerData.set(behavior.playerId, [])
      }
      playerData.get(behavior.playerId)!.push(behavior)
    }

    const features: number[][] = []
    const labels: number[] = []

    for (const [playerId, playerBehaviors] of playerData) {
      if (playerBehaviors.length < 30) continue // Need at least a month of data

      const playerFeatures = await this.extractLTVFeatures(playerId)
      const actualLTV = playerBehaviors.reduce((sum, b) => sum + b.totalRevenue, 0)

      features.push(playerFeatures)
      labels.push(actualLTV)
    }

    return { features, labels }
  }

  private async extractChurnFeatures(playerId: string): Promise<number[]> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const behaviors = await this.behaviorRepository.find({
      where: { playerId, date: tf.util.createShuffledIndices(30) as any },
      order: { date: "DESC" },
      take: 30,
    })

    if (behaviors.length === 0) {
      return new Array(12).fill(0)
    }

    const totalSessions = behaviors.reduce((sum, b) => sum + b.sessionsCount, 0)
    const totalPlayTime = behaviors.reduce((sum, b) => sum + b.totalPlayTime, 0)
    const totalRevenue = behaviors.reduce((sum, b) => sum + b.totalRevenue, 0)
    const totalEvents = behaviors.reduce((sum, b) => sum + b.eventsCount, 0)

    const avgSessionsPerDay = totalSessions / behaviors.length
    const avgPlayTimePerDay = totalPlayTime / behaviors.length
    const avgRevenuePerDay = totalRevenue / behaviors.length
    const avgEventsPerDay = totalEvents / behaviors.length

    // Calculate trends
    const recentBehaviors = behaviors.slice(0, 7)
    const olderBehaviors = behaviors.slice(7, 14)

    const recentAvgSessions = recentBehaviors.reduce((sum, b) => sum + b.sessionsCount, 0) / recentBehaviors.length
    const olderAvgSessions = olderBehaviors.reduce((sum, b) => sum + b.sessionsCount, 0) / olderBehaviors.length
    const sessionTrend = olderAvgSessions > 0 ? (recentAvgSessions - olderAvgSessions) / olderAvgSessions : 0

    const daysSinceLastSession =
      behaviors.length > 0 ? Math.floor((Date.now() - behaviors[0].date.getTime()) / (1000 * 60 * 60 * 24)) : 30

    return [
      avgSessionsPerDay,
      avgPlayTimePerDay,
      avgRevenuePerDay,
      avgEventsPerDay,
      sessionTrend,
      daysSinceLastSession,
      behaviors.length, // Days active
      totalRevenue > 0 ? 1 : 0, // Is paying user
      totalSessions > 0 ? totalPlayTime / totalSessions : 0, // Avg session duration
      totalSessions > 0 ? totalEvents / totalSessions : 0, // Events per session
      Math.min(behaviors.length, 30), // Recency
      behaviors.filter((b) => b.sessionsCount > 0).length, // Active days
    ]
  }

  private async extractLTVFeatures(playerId: string): Promise<number[]> {
    const behaviors = await this.behaviorRepository.find({
      where: { playerId },
      order: { date: "DESC" },
      take: 60, // Last 60 days
    })

    if (behaviors.length === 0) {
      return new Array(10).fill(0)
    }

    const totalRevenue = behaviors.reduce((sum, b) => sum + b.totalRevenue, 0)
    const totalSessions = behaviors.reduce((sum, b) => sum + b.sessionsCount, 0)
    const totalPlayTime = behaviors.reduce((sum, b) => sum + b.totalPlayTime, 0)

    const avgRevenuePerDay = totalRevenue / behaviors.length
    const avgSessionsPerDay = totalSessions / behaviors.length
    const avgPlayTimePerDay = totalPlayTime / behaviors.length

    const firstPurchaseDay = behaviors.findIndex((b) => b.totalRevenue > 0)
    const daysSinceFirstPurchase = firstPurchaseDay >= 0 ? firstPurchaseDay : behaviors.length

    const revenueGrowthRate = this.calculateGrowthRate(behaviors.map((b) => b.totalRevenue))
    const sessionGrowthRate = this.calculateGrowthRate(behaviors.map((b) => b.sessionsCount))

    return [
      avgRevenuePerDay,
      avgSessionsPerDay,
      avgPlayTimePerDay,
      totalRevenue,
      daysSinceFirstPurchase,
      revenueGrowthRate,
      sessionGrowthRate,
      behaviors.length, // Days active
      totalRevenue > 0 ? 1 : 0, // Is paying user
      behaviors.filter((b) => b.totalRevenue > 0).length, // Purchase frequency
    ]
  }

  private isPlayerChurned(behaviors: PlayerBehavior[]): boolean {
    if (behaviors.length === 0) return true

    const sortedBehaviors = behaviors.sort((a, b) => b.date.getTime() - a.date.getTime())
    const lastActivity = sortedBehaviors[0].date
    const daysSinceLastActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))

    return daysSinceLastActivity > 14 // Consider churned if no activity for 14 days
  }

  private determineRiskLevel(churnProbability: number): "low" | "medium" | "high" {
    if (churnProbability < 0.3) return "low"
    if (churnProbability < 0.7) return "medium"
    return "high"
  }

  private getChurnFactors(features: number[]): Array<{ feature: string; importance: number; value: number }> {
    const featureNames = [
      "avgSessionsPerDay",
      "avgPlayTimePerDay",
      "avgRevenuePerDay",
      "avgEventsPerDay",
      "sessionTrend",
      "daysSinceLastSession",
      "daysActive",
      "isPayingUser",
      "avgSessionDuration",
      "eventsPerSession",
      "recency",
      "activeDays",
    ]

    // Simplified feature importance (in a real implementation, you'd extract this from the model)
    const importanceWeights = [0.15, 0.12, 0.18, 0.08, 0.2, 0.25, 0.02, 0.1, 0.05, 0.03, 0.15, 0.07]

    return featureNames
      .map((name, index) => ({
        feature: name,
        importance: importanceWeights[index],
        value: features[index],
      }))
      .sort((a, b) => b.importance - a.importance)
  }

  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0

    const recent = values.slice(0, Math.floor(values.length / 2))
    const older = values.slice(Math.floor(values.length / 2))

    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length
    const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length

    return olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0
  }
}
