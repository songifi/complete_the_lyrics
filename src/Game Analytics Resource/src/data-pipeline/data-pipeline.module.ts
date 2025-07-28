import { Module } from "@nestjs/module"
import { AirflowService } from "./services/airflow.service"
import { PipelineService } from "./services/pipeline.service"
import { AnalyticsModule } from "../analytics/analytics.module"
import { PredictiveModule } from "../predictive/predictive.module"

@Module({
  imports: [AnalyticsModule, PredictiveModule],
  providers: [AirflowService, PipelineService],
  exports: [AirflowService, PipelineService],
})
export class DataPipelineModule {}
