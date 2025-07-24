import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import type { AirflowService } from "./airflow.service"
import type { AnalyticsService } from "../../analytics/services/analytics.service"
import type { MLModelsService } from "../../predictive/services/ml-models.service"

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name)

  constructor(
    private readonly airflowService: AirflowService,
    private readonly analyticsService: AnalyticsService,
    private readonly mlModelsService: MLModelsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyAggregation(): Promise<void> {
    try {
      this.logger.log("Starting hourly aggregation pipeline")

      await this.airflowService.triggerDAG("hourly_aggregation", {
        execution_date: new Date().toISOString(),
        source: "nestjs_scheduler",
      })

      this.logger.log("Hourly aggregation pipeline triggered successfully")
    } catch (error) {
      this.logger.error("Failed to trigger hourly aggregation pipeline", error)
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDailyETL(): Promise<void> {
    try {
      this.logger.log("Starting daily ETL pipeline")

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      await this.airflowService.triggerDAG("daily_etl", {
        date: yesterday.toISOString().split("T")[0],
        full_refresh: false,
      })

      this.logger.log("Daily ETL pipeline triggered successfully")
    } catch (error) {
      this.logger.error("Failed to trigger daily ETL pipeline", error)
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async runMLTraining(): Promise<void> {
    try {
      this.logger.log("Starting ML model training pipeline")

      // Trigger Airflow DAG for data preparation
      await this.airflowService.triggerDAG("ml_data_preparation", {
        models: ["churn", "ltv"],
        training_date: new Date().toISOString(),
      })

      // Wait for data preparation to complete (simplified)
      await new Promise((resolve) => setTimeout(resolve, 300000)) // 5 minutes

      // Train models
      await Promise.all([this.mlModelsService.trainChurnModel(), this.mlModelsService.trainLTVModel()])

      this.logger.log("ML training pipeline completed successfully")
    } catch (error) {
      this.logger.error("Failed to run ML training pipeline", error)
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async runWeeklyReports(): Promise<void> {
    try {
      this.logger.log("Starting weekly reports pipeline")

      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)

      await this.airflowService.triggerDAG("weekly_reports", {
        start_date: lastWeek.toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
        recipients: process.env.REPORT_RECIPIENTS?.split(",") || [],
      })

      this.logger.log("Weekly reports pipeline triggered successfully")
    } catch (error) {
      this.logger.error("Failed to trigger weekly reports pipeline", error)
    }
  }

  async runCustomPipeline(pipelineName: string, config: Record<string, any>): Promise<void> {
    try {
      this.logger.log(`Starting custom pipeline: ${pipelineName}`)

      await this.airflowService.triggerDAG(pipelineName, {
        ...config,
        triggered_by: "nestjs_api",
        timestamp: new Date().toISOString(),
      })

      this.logger.log(`Custom pipeline ${pipelineName} triggered successfully`)
    } catch (error) {
      this.logger.error(`Failed to trigger custom pipeline ${pipelineName}`, error)
      throw error
    }
  }

  async getPipelineStatus(pipelineName: string): Promise<any> {
    try {
      const dagRuns = await this.airflowService.getDAGRuns(pipelineName, 5)
      const latestRun = dagRuns[0]

      if (!latestRun) {
        return {
          pipelineName,
          status: "never_run",
          lastRun: null,
          tasks: [],
        }
      }

      const tasks = await this.airflowService.getTaskInstances(pipelineName, latestRun.runId)

      return {
        pipelineName,
        status: latestRun.state,
        lastRun: latestRun,
        tasks,
        history: dagRuns,
      }
    } catch (error) {
      this.logger.error(`Failed to get pipeline status for ${pipelineName}`, error)
      throw error
    }
  }

  async pausePipeline(pipelineName: string): Promise<void> {
    await this.airflowService.pauseDAG(pipelineName)
    this.logger.log(`Pipeline ${pipelineName} paused`)
  }

  async resumePipeline(pipelineName: string): Promise<void> {
    await this.airflowService.unpauseDAG(pipelineName)
    this.logger.log(`Pipeline ${pipelineName} resumed`)
  }
}
