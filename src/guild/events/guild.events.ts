export class GuildCreatedEvent {
  constructor(
    public readonly guild: any,
    public readonly creatorUserId: string,
  ) {}
}

export class GuildUpdatedEvent {
  constructor(public readonly guild: any) {}
}

export class GuildDeletedEvent {
  constructor(public readonly guildId: string) {}
}

export class GuildMemberJoinedEvent {
  constructor(
    public readonly guildId: string,
    public readonly member: any,
  ) {}
}

export class GuildMemberLeftEvent {
  constructor(
    public readonly guildId: string,
    public readonly userId: string,
  ) {}
}

export class GuildMemberUpdatedEvent {
  constructor(
    public readonly guildId: string,
    public readonly member: any,
  ) {}
}
