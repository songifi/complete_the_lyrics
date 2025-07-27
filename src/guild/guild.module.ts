import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { CacheModule } from "@nestjs/cache-manager"
import { EventEmitterModule } from "@nestjs/event-emitter"
import { Guild } from "./entities/guild.entity"
import { GuildMember } from "./entities/guild-member.entity"
import { GuildCompetition } from "./entities/guild-competition.entity"
import { GuildAchievement } from "./entities/guild-achievement.entity"
import { GuildController } from "./controllers/guild.controller"
import { GuildService } from "./services/guild.service"
import { GuildCacheService } from "./services/guild-cache.service"
import { GuildAccessGuard } from "./guards/guild-access.guard"
import { GuildEventListener } from "./listeners/guild-event.listener"

@Module({
  imports: [
    TypeOrmModule.forFeature([Guild, GuildMember, GuildCompetition, GuildAchievement]),
    CacheModule.register(),
    EventEmitterModule.forRoot(),
  ],
  controllers: [GuildController],
  providers: [GuildService, GuildCacheService, GuildAccessGuard, GuildEventListener],
  exports: [GuildService, GuildCacheService],
})
export class GuildModule {}
