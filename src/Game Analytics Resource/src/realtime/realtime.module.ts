import { Module } from "@nestjs/common"
import { RealtimeService } from "./services/realtime.service"
import { EventsModule } from "../events/events.module"

@Module({
  imports: [EventsModule],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
