import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@nestjs/redis';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { TournamentModule } from '../tournament.module';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { Match } from '../entities/match.entity';
import { MatchResult } from '../entities/match-result.entity';
import { TournamentService } from '../services/tournament.service';
import { BracketGeneratorService } from '../algorithms/bracket-generator.service';
import { MatchSchedulerService } from '../services/match-scheduler.service';
import { TournamentGateway } from '../gateways/tournament.gateway';
import {
  TournamentFormat,
  TournamentStatus,
  ParticipantStatus,
  MatchStatus,
} from '../enums/tournament.enums';
import {
  CreateTournamentDto,
  JoinTournamentDto,
  MatchResultDto,
} from '../dto/tournament.dto';
import { Server } from 'socket.io';
import { io, Socket } from 'socket.io-client';

interface TestParticipant {
  id: string;
  playerId: string;
  name: string;
  skillLevel: number;
}

interface TournamentSimulationResult {
  tournament: Tournament;
  participants: TournamentParticipant[];
  matches: Match[];
  results: MatchResult[];
  winner: TournamentParticipant;
  duration: number;
  rounds: number;
}

describe('Tournament Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tournamentService: TournamentService;
  let bracketGenerator: BracketGeneratorService;
  let matchScheduler: MatchSchedulerService;
  let tournamentGateway: TournamentGateway;
  let websocketServer: Server;
  let clientSockets: Socket[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Tournament, TournamentParticipant, Match, MatchResult],
          synchronize: true,
          logging: false,
        }),
        BullModule.forRoot({
          redis: {
            host: 'localhost',
            port: 6379,
          },
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        RedisModule.forRoot({
          config: {
            host: 'localhost',
            port: 6379,
          },
        }),
        TournamentModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    tournamentService = moduleFixture.get<TournamentService>(TournamentService);
    bracketGenerator = moduleFixture.get<BracketGeneratorService>(
      BracketGeneratorService,
    );
    matchScheduler = moduleFixture.get<MatchSchedulerService>(
      MatchSchedulerService,
    );
    tournamentGateway = moduleFixture.get<TournamentGateway>(TournamentGateway);

    await app.init();
    await app.listen(3001);

    // Initialize WebSocket server for testing
    websocketServer = tournamentGateway.server;
  });

  afterAll(async () => {
    // Close all client sockets
    clientSockets.forEach((socket) => socket.close());

    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await dataSource.query('DELETE FROM match_results');
    await dataSource.query('DELETE FROM matches');
    await dataSource.query('DELETE FROM tournament_participants');
    await dataSource.query('DELETE FROM tournaments');
  });

  describe('Single Elimination Tournament Simulation', () => {
    it('should complete a full 8-player single elimination tournament', async () => {
      const result = await simulateSingleEliminationTournament(8);

      expect(result.tournament.status).toBe(TournamentStatus.COMPLETED);
      expect(result.participants).toHaveLength(8);
      expect(result.matches).toHaveLength(7); // 8 players = 7 matches
      expect(result.rounds).toBe(3); // 8 players = 3 rounds
      expect(result.winner).toBeDefined();
      expect(result.winner.wins).toBeGreaterThan(0);

      // Verify bracket structure
      const roundMatches = result.matches.reduce((acc, match) => {
        acc[match.round] = (acc[match.round] || 0) + 1;
        return acc;
      }, {});

      expect(roundMatches[1]).toBe(4); // Round 1: 4 matches
      expect(roundMatches[2]).toBe(2); // Round 2: 2 matches
      expect(roundMatches[3]).toBe(1); // Round 3: 1 match (final)
    });

    it('should handle 16-player tournament with proper seeding', async () => {
      const result = await simulateSingleEliminationTournament(16);

      expect(result.tournament.status).toBe(TournamentStatus.COMPLETED);
      expect(result.participants).toHaveLength(16);
      expect(result.matches).toHaveLength(15); // 16 players = 15 matches
      expect(result.rounds).toBe(4); // 16 players = 4 rounds

      // Verify seeding was applied correctly
      const seededParticipants = result.participants.filter(
        (p) => p.seed !== null,
      );
      expect(seededParticipants).toHaveLength(16);
      expect(seededParticipants.find((p) => p.seed === 1)).toBeDefined();
      expect(seededParticipants.find((p) => p.seed === 16)).toBeDefined();
    });

    async function simulateSingleEliminationTournament(
      playerCount: number,
    ): Promise<TournamentSimulationResult> {
      const startTime = Date.now();

      // Create tournament
      const tournamentDto: CreateTournamentDto = {
        name: `Test Tournament ${playerCount} Players`,
        format: TournamentFormat.SINGLE_ELIMINATION,
        maxParticipants: playerCount,
        minParticipants: playerCount,
        registrationStartAt: new Date(),
        registrationEndAt: new Date(Date.now() + 60000),
        startAt: new Date(Date.now() + 120000),
        isPublic: true,
        allowLateRegistration: false,
        requireApproval: false,
        createdBy: 'test-user-id',
      };

      const tournament =
        await tournamentService.createTournament(tournamentDto);

      // Register participants
      const participants: TournamentParticipant[] = [];
      for (let i = 1; i <= playerCount; i++) {
        const participant = await tournamentService.registerParticipant(
          tournament.id,
          `player-${i}`,
        );
        participants.push(participant);
      }

      // Start tournament
      const startedTournament = await tournamentService.startTournament(
        tournament.id,
      );

      // Simulate matches
      const allMatches: Match[] = [];
      const allResults: MatchResult[] = [];
      let currentRound = 1;
      let activeParticipants = [...participants];

      while (activeParticipants.length > 1) {
        const roundMatches = await getRoundMatches(tournament.id, currentRound);
        allMatches.push(...roundMatches);

        const roundResults = await simulateRoundMatches(
          roundMatches,
          activeParticipants,
        );
        allResults.push(...roundResults);

        // Advance winners to next round
        activeParticipants = roundResults
          .filter((result) => result.winnerId)
          .map((result) => participants.find((p) => p.id === result.winnerId))
          .filter(Boolean);

        currentRound++;
      }

      const endTime = Date.now();
      const winner = activeParticipants[0];

      return {
        tournament: startedTournament,
        participants,
        matches: allMatches,
        results: allResults,
        winner,
        duration: endTime - startTime,
        rounds: currentRound - 1,
      };
    }
  });

  describe('Double Elimination Tournament Simulation', () => {
    it('should complete a double elimination tournament with winners and losers bracket', async () => {
      const result = await simulateDoubleEliminationTournament(8);

      expect(result.tournament.status).toBe(TournamentStatus.COMPLETED);
      expect(result.participants).toHaveLength(8);
      expect(result.winner).toBeDefined();

      // Double elimination should have more matches than single
      expect(result.matches.length).toBeGreaterThan(7);

      // Verify participants have different elimination rounds
      const eliminatedParticipants = result.participants.filter(
        (p) => p.eliminatedInRound !== null,
      );
      expect(eliminatedParticipants.length).toBeGreaterThan(0);
    });

    async function simulateDoubleEliminationTournament(
      playerCount: number,
    ): Promise<TournamentSimulationResult> {
      const startTime = Date.now();

      const tournamentDto: CreateTournamentDto = {
        name: `Double Elimination Test ${playerCount} Players`,
        format: TournamentFormat.DOUBLE_ELIMINATION,
        maxParticipants: playerCount,
        minParticipants: playerCount,
        registrationStartAt: new Date(),
        registrationEndAt: new Date(Date.now() + 60000),
        startAt: new Date(Date.now() + 120000),
        isPublic: true,
        allowLateRegistration: false,
        requireApproval: false,
        createdBy: 'test-user-id',
      };

      const tournament =
        await tournamentService.createTournament(tournamentDto);

      // Register participants and simulate (simplified version)
      const participants: TournamentParticipant[] = [];
      for (let i = 1; i <= playerCount; i++) {
        const participant = await tournamentService.registerParticipant(
          tournament.id,
          `player-${i}`,
        );
        participants.push(participant);
      }

      const startedTournament = await tournamentService.startTournament(
        tournament.id,
      );

      // Simulate bracket progression (simplified)
      const bracket = await tournamentService.getTournamentBracket(
        tournament.id,
      );
      const matches = await getAllTournamentMatches(tournament.id);

      // Simulate all matches with realistic results
      const results = await simulateAllMatches(matches, participants);

      const endTime = Date.now();
      const winner = participants[0]; // Simplified winner selection

      return {
        tournament: startedTournament,
        participants,
        matches,
        results,
        winner,
        duration: endTime - startTime,
        rounds: bracket?.totalRounds || 0,
      };
    }
  });

  describe('Round Robin Tournament Simulation', () => {
    it('should complete a round robin tournament where everyone plays everyone', async () => {
      const playerCount = 6;
      const result = await simulateRoundRobinTournament(playerCount);

      expect(result.tournament.status).toBe(TournamentStatus.COMPLETED);
      expect(result.participants).toHaveLength(playerCount);

      // In round robin, each player plays every other player once
      const expectedMatches = (playerCount * (playerCount - 1)) / 2;
      expect(result.matches).toHaveLength(expectedMatches);

      // Each participant should have played the same number of matches
      const matchCounts = result.participants.map(
        (p) => p.wins + p.losses + p.draws,
      );
      const expectedMatchCount = playerCount - 1;
      matchCounts.forEach((count) => {
        expect(count).toBe(expectedMatchCount);
      });
    });

    async function simulateRoundRobinTournament(
      playerCount: number,
    ): Promise<TournamentSimulationResult> {
      const startTime = Date.now();

      const tournamentDto: CreateTournamentDto = {
        name: `Round Robin Test ${playerCount} Players`,
        format: TournamentFormat.ROUND_ROBIN,
        maxParticipants: playerCount,
        minParticipants: playerCount,
        registrationStartAt: new Date(),
        registrationEndAt: new Date(Date.now() + 60000),
        startAt: new Date(Date.now() + 120000),
        isPublic: true,
        allowLateRegistration: false,
        requireApproval: false,
        createdBy: 'test-user-id',
      };

      const tournament =
        await tournamentService.createTournament(tournamentDto);

      const participants: TournamentParticipant[] = [];
      for (let i = 1; i <= playerCount; i++) {
        const participant = await tournamentService.registerParticipant(
          tournament.id,
          `player-${i}`,
        );
        participants.push(participant);
      }

      const startedTournament = await tournamentService.startTournament(
        tournament.id,
      );
      const matches = await getAllTournamentMatches(tournament.id);
      const results = await simulateAllMatches(matches, participants);

      const endTime = Date.now();
      const sortedParticipants = participants.sort(
        (a, b) => b.points - a.points,
      );
      const winner = sortedParticipants[0];

      return {
        tournament: startedTournament,
        participants,
        matches,
        results,
        winner,
        duration: endTime - startTime,
        rounds: playerCount - 1,
      };
    }
  });

  describe('WebSocket Real-time Updates', () => {
    it('should broadcast tournament events to connected clients', async () => {
      const client1 = await connectWebSocketClient();
      const client2 = await connectWebSocketClient();

      const tournamentEvents: any[] = [];
      const matchEvents: any[] = [];

      client1.on('tournament_created', (data) => tournamentEvents.push(data));
      client1.on('participant_registered', (data) =>
        tournamentEvents.push(data),
      );
      client1.on('match_completed', (data) => matchEvents.push(data));

      client2.on('tournament_started', (data) => tournamentEvents.push(data));

      // Create and simulate a tournament
      const tournament = await createTestTournament(4);

      // Join tournament room
      client1.emit('join_tournament', { tournamentId: tournament.id });
      client2.emit('join_tournament', { tournamentId: tournament.id });

      // Register participants
      for (let i = 1; i <= 4; i++) {
        await tournamentService.registerParticipant(
          tournament.id,
          `player-${i}`,
        );
      }

      // Start tournament
      await tournamentService.startTournament(tournament.id);

      // Simulate a match completion
      const matches = await getAllTournamentMatches(tournament.id);
      if (matches.length > 0) {
        const match = matches[0];
        await tournamentService.recordMatchResult(match.id, {
          matchId: match.id,
          homeScore: 2,
          awayScore: 1,
          winnerId: match.homeParticipantId,
        });
      }

      // Wait for events to propagate
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(tournamentEvents.length).toBeGreaterThan(0);

      client1.close();
      client2.close();
    });

    async function connectWebSocketClient(): Promise<Socket> {
      return new Promise((resolve) => {
        const client = io('http://localhost:3001/tournament');
        client.on('connect', () => {
          clientSockets.push(client);
          resolve(client);
        });
      });
    }
  });

  describe('Tournament Automation and Scheduling', () => {
    it('should automatically progress tournament through lifecycle stages', async () => {
      const now = new Date();
      const tournament = await tournamentService.createTournament({
        name: 'Auto Tournament Test',
        format: TournamentFormat.SINGLE_ELIMINATION,
        maxParticipants: 4,
        minParticipants: 4,
        registrationStartAt: new Date(now.getTime() - 1000), // Already started
        registrationEndAt: new Date(now.getTime() + 5000), // Ends in 5 seconds
        startAt: new Date(now.getTime() + 10000), // Starts in 10 seconds
        isPublic: true,
        allowLateRegistration: false,
        requireApproval: false,
        createdBy: 'test-user-id',
      });

      // Register participants
      for (let i = 1; i <= 4; i++) {
        await tournamentService.registerParticipant(
          tournament.id,
          `player-${i}`,
        );
      }

      // Wait for registration to close automatically
      await new Promise((resolve) => setTimeout(resolve, 6000));

      const updatedTournament = await tournamentService.getTournament(
        tournament.id,
      );
      expect(updatedTournament.status).toBe(
        TournamentStatus.REGISTRATION_CLOSED,
      );

      // Wait for tournament to start automatically
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const startedTournament = await tournamentService.getTournament(
        tournament.id,
      );
      expect(startedTournament.status).toBe(TournamentStatus.IN_PROGRESS);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle insufficient participants gracefully', async () => {
      const tournament = await createTestTournament(8);

      // Register only 1 participant (less than minimum)
      await tournamentService.registerParticipant(tournament.id, 'player-1');

      // Try to start tournament
      await expect(
        tournamentService.startTournament(tournament.id),
      ).rejects.toThrow();
    });

    it('should handle duplicate registrations', async () => {
      const tournament = await createTestTournament(4);

      // Register same player twice
      await tournamentService.registerParticipant(tournament.id, 'player-1');

      await expect(
        tournamentService.registerParticipant(tournament.id, 'player-1'),
      ).rejects.toThrow();
    });

    it('should handle invalid match results', async () => {
      const tournament = await createTestTournament(4);

      // Register participants and start
      for (let i = 1; i <= 4; i++) {
        await tournamentService.registerParticipant(
          tournament.id,
          `player-${i}`,
        );
      }

      await tournamentService.startTournament(tournament.id);
      const matches = await getAllTournamentMatches(tournament.id);

      if (matches.length > 0) {
        const match = matches[0];

        // Try to record invalid result
        await expect(
          tournamentService.recordMatchResult(match.id, {
            matchId: match.id,
            homeScore: -1, // Invalid score
            awayScore: 0,
          }),
        ).rejects.toThrow();
      }
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle large tournament efficiently', async () => {
      const playerCount = 64;
      const startTime = Date.now();

      const tournament = await createTestTournament(playerCount);

      // Register all participants
      const registrationPromises = [];
      for (let i = 1; i <= playerCount; i++) {
        registrationPromises.push(
          tournamentService.registerParticipant(tournament.id, `player-${i}`),
        );
      }

      await Promise.all(registrationPromises);

      // Start tournament
      await tournamentService.startTournament(tournament.id);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000); // 10 seconds

      const matches = await getAllTournamentMatches(tournament.id);
      expect(matches).toHaveLength(63); // 64 players = 63 matches
    });

    it('should handle concurrent tournament operations', async () => {
      const tournaments = await Promise.all([
        createTestTournament(8),
        createTestTournament(8),
        createTestTournament(8),
      ]);

      // Register participants concurrently for all tournaments
      const registrationPromises = tournaments.flatMap((tournament) =>
        Array.from({ length: 8 }, (_, i) =>
          tournamentService.registerParticipant(tournament.id, `player-${i}`),
        ),
      );

      await Promise.all(registrationPromises);

      // Start all tournaments concurrently
      const startPromises = tournaments.map((tournament) =>
        tournamentService.startTournament(tournament.id),
      );

      await Promise.all(startPromises);

      // Verify all tournaments started successfully
      for (const tournament of tournaments) {
        const updated = await tournamentService.getTournament(tournament.id);
        expect(updated.status).toBe(TournamentStatus.IN_PROGRESS);
      }
    });
  });

  // Helper functions
  async function createTestTournament(
    maxParticipants: number,
  ): Promise<Tournament> {
    const tournamentDto: CreateTournamentDto = {
      name: `Test Tournament ${Date.now()}`,
      format: TournamentFormat.SINGLE_ELIMINATION,
      maxParticipants,
      minParticipants: Math.min(2, maxParticipants),
      registrationStartAt: new Date(),
      registrationEndAt: new Date(Date.now() + 300000), // 5 minutes
      startAt: new Date(Date.now() + 600000), // 10 minutes
      isPublic: true,
      allowLateRegistration: false,
      requireApproval: false,
      createdBy: 'test-user-id',
    };

    return tournamentService.createTournament(tournamentDto);
  }

  async function getRoundMatches(
    tournamentId: string,
    round: number,
  ): Promise<Match[]> {
    return dataSource.getRepository(Match).find({
      where: { tournamentId, round },
      relations: ['homeParticipant', 'awayParticipant'],
    });
  }

  async function getAllTournamentMatches(
    tournamentId: string,
  ): Promise<Match[]> {
    return dataSource.getRepository(Match).find({
      where: { tournamentId },
      relations: ['homeParticipant', 'awayParticipant'],
      order: { round: 'ASC', matchNumber: 'ASC' },
    });
  }

  async function simulateRoundMatches(
    matches: Match[],
    participants: TournamentParticipant[],
  ): Promise<
    {
      matchId: string;
      winnerId: string;
      homeScore: number;
      awayScore: number;
    }[]
  > {
    const results = [];

    for (const match of matches) {
      if (match.homeParticipantId && match.awayParticipantId) {
        // Simulate match with random but realistic results
        const homeScore = Math.floor(Math.random() * 3) + 1;
        const awayScore = Math.floor(Math.random() * 3) + 1;
        const winnerId =
          homeScore > awayScore
            ? match.homeParticipantId
            : match.awayParticipantId;

        const result = await tournamentService.recordMatchResult(match.id, {
          matchId: match.id,
          homeScore,
          awayScore,
          winnerId: homeScore !== awayScore ? winnerId : undefined,
          isDraw: homeScore === awayScore,
        });

        results.push({
          matchId: match.id,
          winnerId: winnerId!,
          homeScore,
          awayScore,
        });
      }
    }

    return results;
  }

  async function simulateAllMatches(
    matches: Match[],
    participants: TournamentParticipant[],
  ): Promise<MatchResult[]> {
    const results: MatchResult[] = [];

    for (const match of matches) {
      if (match.homeParticipantId && match.awayParticipantId) {
        const homeScore = Math.floor(Math.random() * 5);
        const awayScore = Math.floor(Math.random() * 5);
        const winnerId =
          homeScore > awayScore
            ? match.homeParticipantId
            : awayScore > homeScore
              ? match.awayParticipantId
              : undefined;

        await tournamentService.recordMatchResult(match.id, {
          matchId: match.id,
          homeScore,
          awayScore,
          winnerId,
          isDraw: homeScore === awayScore,
        });

        // Create result objects for return
        results.push({
          id: `result-${match.id}-home`,
          matchId: match.id,
          participantId: match.homeParticipantId,
          score: homeScore,
          recordedAt: new Date(),
        } as MatchResult);

        results.push({
          id: `result-${match.id}-away`,
          matchId: match.id,
          participantId: match.awayParticipantId,
          score: awayScore,
          recordedAt: new Date(),
        } as MatchResult);
      }
    }

    return results;
  }
});
