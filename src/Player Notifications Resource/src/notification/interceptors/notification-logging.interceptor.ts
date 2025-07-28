import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler, Logger } from "@nestjs/common"
import type { Observable } from "rxjs"
import { tap, catchError } from "rxjs/operators"
import type { Reflector } from "@nestjs/core"
import { NOTIFICATION_TRIGGER_KEY, type NotificationTriggerOptions } from "../decorators/notification-trigger.decorator"
import type { NotificationService } from "../services/notification.service"

@Injectable()
export class NotificationLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(NotificationLoggingInterceptor.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly notificationService: NotificationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const notificationOptions = this.reflector.get<NotificationTriggerOptions>(
      NOTIFICATION_TRIGGER_KEY,
      context.getHandler(),
    )

    if (!notificationOptions) {
      return next.handle()
    }

    const request = context.switchToHttp().getRequest()
    const startTime = Date.now()

    return next.handle().pipe(
      tap(async (data) => {
        const duration = Date.now() - startTime
        this.logger.log(`Notification trigger executed in ${duration}ms`)

        if (notificationOptions.condition && !notificationOptions.condition({ request, data })) {
          return
        }

        // Trigger notification based on decorator configuration
        await this.triggerNotification(notificationOptions, { request, data })
      }),
      catchError((error) => {
        this.logger.error(`Notification trigger failed: ${error.message}`)
        throw error
      }),
    )
  }

  private async triggerNotification(options: NotificationTriggerOptions, context: { request: any; data: any }) {
    try {
      // Extract user ID from request (adjust based on your auth implementation)
      const userId = context.request.user?.id || context.request.body?.userId

      if (!userId) {
        this.logger.warn("No user ID found for notification trigger")
        return
      }

      const notificationData = {
        userId,
        type: options.type,
        category: options.category,
        title: `${options.category} notification`,
        content: "Notification triggered by system event",
        templateId: options.template,
        templateData: context.data,
        scheduledAt: options.delay ? new Date(Date.now() + options.delay) : undefined,
      }

      await this.notificationService.create(notificationData)
    } catch (error) {
      this.logger.error(`Failed to trigger notification: ${error.message}`)
    }
  }
}
