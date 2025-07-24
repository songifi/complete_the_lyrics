import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import { type ClientKafka, Client, Transport } from "@nestjs/microservices"
import { EventPattern } from "@nestjs/microservices"

@Injectable()
export class EventsService implements OnModuleInit {
  private readonly logger = new Logger(EventsService.name)

  @Client({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: "analytics-producer",
        brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
      },
    },
  })
  private readonly kafkaClient: ClientKafka

  async onModuleInit() {
    await this.kafkaClient.connect()
    this.logger.log("Kafka client connected")
  }

  async publishEvent(topic: string, data: any): Promise<void> {
    try {
      await this.kafkaClient.emit(topic, {
        ...data,
        timestamp: new Date().toISOString(),
        eventId: require("uuid").v4(),
      })

      this.logger.debug(`Event published to topic ${topic}:`, data)
    } catch (error) {
      this.logger.error(`Failed to publish event to topic ${topic}:`, error)
      throw error
    }
  }

  @EventPattern("analytics.event.tracked")
  async handleAnalyticsEvent(data: any) {
    this.logger.log("Received analytics event:", data)
    // Process real-time analytics here
  }

  @EventPattern("player.session.started")
  async handleSessionStarted(data: any) {
    this.logger.log("Player session started:", data)
    // Process session start events
  }

  @EventPattern("player.session.ended")
  async handleSessionEnded(data: any) {
    this.logger.log("Player session ended:", data)
    // Process session end events
  }
}
