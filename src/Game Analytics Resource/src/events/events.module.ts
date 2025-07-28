import { Module } from "@nestjs/common"
import { EventsService } from "./services/events.service"

@Module({
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
