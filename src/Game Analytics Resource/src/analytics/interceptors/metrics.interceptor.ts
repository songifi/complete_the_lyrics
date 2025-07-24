import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import type { Observable } from "rxjs"
import { tap, catchError } from "rxjs/operators"
import type { MetricsService } from "../services/metrics.service"
import { TRACK_METRIC_KEY, type MetricConfig } from "../decorators/track-metric.decorator"

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly metricsService: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metricConfig = this.reflector.get<MetricConfig>(TRACK_METRIC_KEY, context.getHandler())

    if (!metricConfig) {
      return next.handle()
    }

    const startTime = Date.now()

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime
        this.recordMetric(metricConfig, duration, "success")
      }),
      catchError((error) => {
        const duration = Date.now() - startTime
        this.recordMetric(metricConfig, duration, "error")
        throw error
      }),
    )
  }

  private recordMetric(config: MetricConfig, duration: number, status: string) {
    const labels = { status, ...this.extractLabels(config) }

    switch (config.type) {
      case "counter":
        this.metricsService.incrementCounter(config.name, labels)
        break
      case "histogram":
        this.metricsService.recordHistogram(config.name, duration, labels)
        break
      case "gauge":
        this.metricsService.setGauge(config.name, duration, labels)
        break
      case "summary":
        this.metricsService.recordSummary(config.name, duration, labels)
        break
    }
  }

  private extractLabels(config: MetricConfig): Record<string, string> {
    // Extract labels from context if needed
    return {}
  }
}
