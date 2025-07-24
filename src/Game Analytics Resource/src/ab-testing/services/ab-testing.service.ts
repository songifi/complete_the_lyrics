import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type ABTest, TestStatus } from "../entities/ab-test.entity"
import type { ABTestAssignment } from "../entities/ab-test-assignment.entity"
import type { AnalyticsService } from "../../analytics/services/analytics.service"
import type { EventsService } from "../../events/services/events.service"

export interface TestVariant {
  id: string
  name: string
  weight: number
  config: Record<string, any>
}

export interface CreateTestInput {
  name: string
  description: string
  variants: TestVariant[]
  startDate: Date
  endDate?: Date
  targetSampleSize: number
  significanceLevel?: number
  metrics: Array<{
    name: string
    type: "conversion" | "revenue" | "retention"
    goal: "increase" | "decrease"
  }>
  segmentationCriteria?: Record<string, any>
}

@Injectable()
export class ABTestingService {
  private readonly logger = new Logger(ABTestingService.name)

  constructor(
    private readonly testRepository: Repository<ABTest>,
    private readonly assignmentRepository: Repository<ABTestAssignment>,
    private readonly analyticsService: AnalyticsService,
    private readonly eventsService: EventsService,
  ) {}

  async createTest(input: CreateTestInput): Promise<ABTest> {
    // Validate variant weights sum to 100
    const totalWeight = input.variants.reduce((sum, variant) => sum + variant.weight, 0)
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error("Variant weights must sum to 100")
    }

    const test = this.testRepository.create({
      ...input,
      significanceLevel: input.significanceLevel || 0.05,
      segmentationCriteria: input.segmentationCriteria || {},
    })

    const savedTest = await this.testRepository.save(test)

    await this.eventsService.publishEvent("ab_test.created", {
      testId: savedTest.id,
      name: savedTest.name,
      variants: savedTest.variants,
    })

    return savedTest
  }

  async startTest(testId: string): Promise<ABTest> {
    const test = await this.testRepository.findOne({ where: { id: testId } })
    if (!test) {
      throw new Error("Test not found")
    }

    if (test.status !== TestStatus.DRAFT) {
      throw new Error("Only draft tests can be started")
    }

    test.status = TestStatus.RUNNING
    const updatedTest = await this.testRepository.save(test)

    await this.eventsService.publishEvent("ab_test.started", {
      testId: test.id,
      name: test.name,
      startDate: test.startDate,
    })

    return updatedTest
  }

  async assignPlayerToTest(testId: string, playerId: string, playerContext: Record<string, any> = {}): Promise<string> {
    // Check if player is already assigned to this test
    const existingAssignment = await this.assignmentRepository.findOne({
      where: { testId, playerId },
    })

    if (existingAssignment) {
      return existingAssignment.variantId
    }

    const test = await this.testRepository.findOne({ where: { id: testId } })
    if (!test || test.status !== TestStatus.RUNNING) {
      throw new Error("Test not found or not running")
    }

    // Check if player meets segmentation criteria
    if (!this.playerMeetsSegmentation(playerContext, test.segmentationCriteria)) {
      throw new Error("Player does not meet test segmentation criteria")
    }

    // Assign variant based on weights
    const variantId = this.selectVariant(test.variants, playerId)

    const assignment = this.assignmentRepository.create({
      testId,
      playerId,
      variantId,
      playerContext,
    })

    await this.assignmentRepository.save(assignment)

    // Track assignment event
    await this.analyticsService.trackEvent({
      playerId,
      sessionId: playerContext.sessionId || "unknown",
      eventType: "ab_test_assigned",
      eventData: {
        testId,
        testName: test.name,
        variantId,
        variantName: test.variants.find((v) => v.id === variantId)?.name,
      },
    })

    await this.eventsService.publishEvent("ab_test.player_assigned", {
      testId,
      playerId,
      variantId,
      assignedAt: assignment.assignedAt,
    })

    return variantId
  }

  async getPlayerVariant(testId: string, playerId: string): Promise<string | null> {
    const assignment = await this.assignmentRepository.findOne({
      where: { testId, playerId },
    })

    return assignment?.variantId || null
  }

  async getTestResults(testId: string): Promise<any> {
    const test = await this.testRepository.findOne({ where: { id: testId } })
    if (!test) {
      throw new Error("Test not found")
    }

    // Get all assignments for this test
    const assignments = await this.assignmentRepository.find({
      where: { testId },
    })

    const results = {
      testId,
      testName: test.name,
      status: test.status,
      totalAssignments: assignments.length,
      variants: [],
      metrics: {},
      statisticalSignificance: {},
    }

    // Calculate results for each variant
    for (const variant of test.variants) {
      const variantAssignments = assignments.filter((a) => a.variantId === variant.id)
      const variantResults = {
        variantId: variant.id,
        variantName: variant.name,
        assignments: variantAssignments.length,
        metrics: {},
      }

      // Calculate metrics for each defined metric
      for (const metric of test.metrics) {
        const metricValue = await this.calculateMetricForVariant(
          testId,
          variant.id,
          metric,
          variantAssignments.map((a) => a.playerId),
        )
        variantResults.metrics[metric.name] = metricValue
      }

      results.variants.push(variantResults)
    }

    // Calculate statistical significance
    results.statisticalSignificance = await this.calculateStatisticalSignificance(test, results.variants)

    return results
  }

  private playerMeetsSegmentation(playerContext: Record<string, any>, criteria: Record<string, any>): boolean {
    if (Object.keys(criteria).length === 0) {
      return true // No criteria means all players qualify
    }

    for (const [key, value] of Object.entries(criteria)) {
      if (playerContext[key] !== value) {
        return false
      }
    }

    return true
  }

  private selectVariant(variants: TestVariant[], playerId: string): string {
    // Use player ID as seed for consistent assignment
    const hash = this.hashString(playerId)
    const random = (hash % 10000) / 10000 // Convert to 0-1 range

    let cumulativeWeight = 0
    for (const variant of variants) {
      cumulativeWeight += variant.weight / 100
      if (random <= cumulativeWeight) {
        return variant.id
      }
    }

    // Fallback to first variant
    return variants[0].id
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  private async calculateMetricForVariant(
    testId: string,
    variantId: string,
    metric: any,
    playerIds: string[],
  ): Promise<number> {
    if (playerIds.length === 0) return 0

    const playerIdsStr = playerIds.map((id) => `'${id}'`).join(",")

    switch (metric.type) {
      case "conversion":
        // Calculate conversion rate
        const conversions = await this.analyticsService.getEventsByType(metric.name)
        const convertedPlayers = new Set(
          conversions.filter((event) => playerIds.includes(event.playerId)).map((event) => event.playerId),
        )
        return (convertedPlayers.size / playerIds.length) * 100

      case "revenue":
        // Calculate average revenue per user
        const revenueEvents = await this.analyticsService.getEventsByType("purchase")
        const totalRevenue = revenueEvents
          .filter((event) => playerIds.includes(event.playerId))
          .reduce((sum, event) => sum + (event.value || 0), 0)
        return totalRevenue / playerIds.length

      case "retention":
        // Calculate retention rate (simplified - day 1 retention)
        const retainedPlayers = await this.calculateRetentionForPlayers(playerIds)
        return (retainedPlayers / playerIds.length) * 100

      default:
        return 0
    }
  }

  private async calculateRetentionForPlayers(playerIds: string[]): Promise<number> {
    // Simplified retention calculation
    // In a real implementation, this would be more sophisticated
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    let retainedCount = 0
    for (const playerId of playerIds) {
      const recentEvents = await this.analyticsService.getPlayerEvents(playerId, oneDayAgo, new Date())
      if (recentEvents.length > 0) {
        retainedCount++
      }
    }

    return retainedCount
  }

  private async calculateStatisticalSignificance(test: ABTest, variantResults: any[]): Promise<any> {
    // Simplified statistical significance calculation
    // In a real implementation, you would use proper statistical tests
    const significance = {}

    for (const metric of test.metrics) {
      const metricValues = variantResults.map((v) => v.metrics[metric.name] || 0)
      const controlValue = metricValues[0] // Assume first variant is control

      significance[metric.name] = {
        isSignificant: false,
        pValue: 1.0,
        confidenceInterval: [0, 0],
        recommendation: "insufficient_data",
      }

      // Simple check for significant difference (>10% improvement)
      for (let i = 1; i < metricValues.length; i++) {
        const improvement = ((metricValues[i] - controlValue) / controlValue) * 100
        if (Math.abs(improvement) > 10) {
          significance[metric.name].isSignificant = true
          significance[metric.name].pValue = 0.05 // Simplified
          significance[metric.name].recommendation = improvement > 0 ? "winner" : "loser"
        }
      }
    }

    return significance
  }
}
