import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { TournamentModule } from '../src/tournament/tournament.module';
import {
  TournamentFormat,
  TournamentStatus,
  ParticipantStatus,
  MatchStatus,
} from '../src/tournament/enums/tournament.enums';

describe('Tournament System (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let tournamentId: string;
  let participantIds: string[] = [];
  let matchIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.TEST_DATABASE_HOST || 'localhost',
          port: parseInt(process.env.TEST_DATABASE_PORT) || 5433,
          username: process.env.TEST_DATABASE_USERNAME || 'postgres',
          password: process.env.TEST_DATABASE_PASSWORD || 'password',
          database: process.env.TEST_DATABASE_NAME || 'tournament_test',
          entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        TournamentModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    // Mock authentication token
    authToken = 'Bearer test-token';
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  describe('Tournament Lifecycle Simulation', () => {
    it('should create a tournament', async () => {
      const createTournamentDto = {
        name: 'Test Championship 2024',
        description: 'A test tournament for e2e testing',
        format: TournamentFormat.SINGLE_ELIMINATION,
        maxParticipants: 8,
        minParticipants: 4,
        entryFee: 10.0,
        prizePool: 100.0,
        registrationStartAt: new Date(Date.now() + 1000).toISOString(),
        registrationEndAt: new Date(Date.now() + 60000).toISOString(),
        startAt: new Date(Date.now() + 120000).toISOString(),
        isPublic: true,
        allowLateRegistration: false,
        requireApproval: false,
      };

      const response = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', authToken)
        .send(createTournamentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: createTournamentDto.name,
        format: createTournamentDto.format,
        status: TournamentStatus.DRAFT,
        maxParticipants: createTournamentDto.maxParticipants,
      });

      tournamentId = response.body.id;
      expect(tournamentId).toBeDefined();
    });

    it('should register participants', async () => {
      const participants = [
        { playerId: 'player-1' },
        { playerId: 'player-2' },
        { playerId: 'player-3' },
        { playerId: 'player-4' },
        { playerId: 'player-5' },
        { playerId: 'player-6' },
        { playerId: 'player-7' },
        { playerId: 'player-8' },
      ];

      for (const participant of participants) {
        const response = await request(app.getHttpServer())
          .post(`/tournaments/${tournamentId}/participants`)
          .set('Authorization', authToken)
          .send(participant)
          .expect(201);

        expect(response.body).toMatchObject({
          playerId: participant.playerId,
          status: ParticipantStatus.CONFIRMED,
          tournamentId,
        });

        participantIds.push(response.body.id);
      }
    });

    it('should get tournament participants', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/participants`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toHaveLength(8);
      expect(response.body[0]).toHaveProperty('playerId');
      expect(response.body[0]).toHaveProperty('status');
    });

    it('should start the tournament', async () => {
      // First update tournament to make it ready to start
      await request(app.getHttpServer())
        .put(`/tournaments/${tournamentId}`)
        .set('Authorization', authToken)
        .send({
          status: TournamentStatus.REGISTRATION_CLOSED,
          registrationEndAt: new Date(Date.now() - 1000).toISOString(),
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/start`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.status).toBe(TournamentStatus.IN_PROGRESS);
    });

    it('should get tournament bracket', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/bracket`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toHaveProperty('format');
      expect(response.body).toHaveProperty('rounds');
      expect(response.body.format).toBe(TournamentFormat.SINGLE_ELIMINATION);
      expect(response.body.rounds).toHaveLength(3); // log2(8) = 3 rounds
    });

    it('should get tournament matches', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);

      // Store match IDs for later use
      matchIds = response.body.map((match) => match.id);

      // Check first round matches
      const firstRoundMatches = response.body.filter(
        (match) => match.round === 1,
      );
      expect(firstRoundMatches).toHaveLength(4); // 8 participants = 4 first round matches
    });

    it('should record match results and progress through rounds', async () => {
      // Get matches for round 1
      let matches = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches?round=1`)
        .set('Authorization', authToken)
        .expect(200);

      expect(matches.body).toHaveLength(4);

      // Record results for first round
      const round1Winners = [];
      for (const match of matches.body) {
        const winnerId = match.homeParticipantId; // Arbitrarily choose home participant as winner
        round1Winners.push(winnerId);

        await request(app.getHttpServer())
          .post(`/tournaments/${tournamentId}/matches/${match.id}/result`)
          .set('Authorization', authToken)
          .send({
            homeScore: 2,
            awayScore: 1,
            winnerId,
          })
          .expect(200);
      }

      // Wait a bit for match processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check round 2 matches are created and have participants
      matches = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches?round=2`)
        .set('Authorization', authToken)
        .expect(200);

      expect(matches.body).toHaveLength(2); // 4 winners = 2 semifinal matches

      // Record results for round 2
      const round2Winners = [];
      for (const match of matches.body) {
        const winnerId = match.homeParticipantId;
        round2Winners.push(winnerId);

        await request(app.getHttpServer())
          .post(`/tournaments/${tournamentId}/matches/${match.id}/result`)
          .set('Authorization', authToken)
          .send({
            homeScore: 3,
            awayScore: 0,
            winnerId,
          })
          .expect(200);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check final match
      matches = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches?round=3`)
        .set('Authorization', authToken)
        .expect(200);

      expect(matches.body).toHaveLength(1); // Final match

      // Record final result
      const finalMatch = matches.body[0];
      const tournamentWinner = finalMatch.homeParticipantId;

      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/matches/${finalMatch.id}/result`)
        .set('Authorization', authToken)
        .send({
          homeScore: 2,
          awayScore: 1,
          winnerId: tournamentWinner,
        })
        .expect(200);

      // Wait for tournament completion processing
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it('should show updated leaderboard', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/leaderboard`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.participants).toHaveLength(8);
      expect(response.body.participants[0]).toHaveProperty('currentRank', 1);
      expect(response.body.participants[0].wins).toBeGreaterThan(0);
    });

    it('should get tournament statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/stats`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toHaveProperty('tournament');
      expect(response.body).toHaveProperty('matches');
      expect(response.body).toHaveProperty('participants');
      expect(response.body).toHaveProperty('progress');

      expect(response.body.tournament.status).toBe(TournamentStatus.COMPLETED);
      expect(response.body.matches.completed).toBe(7); // Total matches in single elimination with 8 participants
      expect(response.body.participants.total).toBe(8);
      expect(response.body.progress).toBe(100);
    });

    it('should list tournaments with pagination and filtering', async () => {
      // Test basic listing
      let response = await request(app.getHttpServer())
        .get('/tournaments')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body.data).toBeInstanceOf(Array);

      // Test search functionality
      response = await request(app.getHttpServer())
        .get('/tournaments?search=Test Championship')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].name).toContain('Test Championship');

      // Test format filtering
      response = await request(app.getHttpServer())
        .get(`/tournaments?format=${TournamentFormat.SINGLE_ELIMINATION}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].format).toBe(
        TournamentFormat.SINGLE_ELIMINATION,
      );

      // Test status filtering
      response = await request(app.getHttpServer())
        .get(`/tournaments?status=${TournamentStatus.COMPLETED}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].status).toBe(TournamentStatus.COMPLETED);
    });
  });

  describe('Error Handling', () => {
    it('should handle tournament not found', async () => {
      await request(app.getHttpServer())
        .get('/tournaments/non-existent-id')
        .set('Authorization', authToken)
        .expect(404);
    });

    it('should prevent duplicate participant registration', async () => {
      // Try to register the same participant again
      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/participants`)
        .set('Authorization', authToken)
        .send({ playerId: 'player-1' })
        .expect(409); // Conflict
    });

    it('should prevent starting tournament without minimum participants', async () => {
      // Create a new tournament
      const createDto = {
        name: 'Small Tournament',
        format: TournamentFormat.SINGLE_ELIMINATION,
        maxParticipants: 8,
        minParticipants: 4,
        registrationStartAt: new Date(Date.now() + 1000).toISOString(),
        registrationEndAt: new Date(Date.now() + 60000).toISOString(),
        startAt: new Date(Date.now() + 120000).toISOString(),
        isPublic: true,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', authToken)
        .send(createDto)
        .expect(201);

      const newTournamentId = createResponse.body.id;

      // Register only 2 participants (less than minimum of 4)
      await request(app.getHttpServer())
        .post(`/tournaments/${newTournamentId}/participants`)
        .set('Authorization', authToken)
        .send({ playerId: 'player-a' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/tournaments/${newTournamentId}/participants`)
        .set('Authorization', authToken)
        .send({ playerId: 'player-b' })
        .expect(201);

      // Close registration
      await request(app.getHttpServer())
        .put(`/tournaments/${newTournamentId}`)
        .set('Authorization', authToken)
        .send({ status: TournamentStatus.REGISTRATION_CLOSED })
        .expect(200);

      // Try to start tournament
      await request(app.getHttpServer())
        .post(`/tournaments/${newTournamentId}/start`)
        .set('Authorization', authToken)
        .expect(400); // Bad Request
    });

    it('should prevent match result recording for non-existent match', async () => {
      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/matches/non-existent-match/result`)
        .set('Authorization', authToken)
        .send({
          homeScore: 2,
          awayScore: 1,
          winnerId: 'some-winner',
        })
        .expect(404);
    });
  });

  describe('Round Robin Tournament', () => {
    let roundRobinTournamentId: string;

    it('should create and complete a round robin tournament', async () => {
      // Create round robin tournament
      const createDto = {
        name: 'Round Robin Test',
        format: TournamentFormat.ROUND_ROBIN,
        maxParticipants: 4,
        minParticipants: 3,
        registrationStartAt: new Date(Date.now() + 1000).toISOString(),
        registrationEndAt: new Date(Date.now() + 60000).toISOString(),
        startAt: new Date(Date.now() + 120000).toISOString(),
        isPublic: true,
      };

      let response = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', authToken)
        .send(createDto)
        .expect(201);

      roundRobinTournamentId = response.body.id;

      // Register 4 participants
      for (let i = 1; i <= 4; i++) {
        await request(app.getHttpServer())
          .post(`/tournaments/${roundRobinTournamentId}/participants`)
          .set('Authorization', authToken)
          .send({ playerId: `rr-player-${i}` })
          .expect(201);
      }

      // Close registration and start tournament
      await request(app.getHttpServer())
        .put(`/tournaments/${roundRobinTournamentId}`)
        .set('Authorization', authToken)
        .send({ status: TournamentStatus.REGISTRATION_CLOSED })
        .expect(200);

      response = await request(app.getHttpServer())
        .post(`/tournaments/${roundRobinTournamentId}/start`)
        .set('Authorization', authToken)
        .expect(200);

      // Get bracket to verify round robin structure
      response = await request(app.getHttpServer())
        .get(`/tournaments/${roundRobinTournamentId}/bracket`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.format).toBe(TournamentFormat.ROUND_ROBIN);
      expect(response.body.rounds).toHaveLength(3); // n-1 rounds for n participants

      // Verify total matches for round robin (n*(n-1)/2)
      response = await request(app.getHttpServer())
        .get(`/tournaments/${roundRobinTournamentId}/matches`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toHaveLength(6); // 4*3/2 = 6 matches total
    });
  });

  describe('Tournament Management', () => {
    let managementTournamentId: string;

    beforeAll(async () => {
      // Create a tournament for management testing
      const createDto = {
        name: 'Management Test Tournament',
        format: TournamentFormat.SINGLE_ELIMINATION,
        maxParticipants: 4,
        minParticipants: 2,
        registrationStartAt: new Date(Date.now() + 1000).toISOString(),
        registrationEndAt: new Date(Date.now() + 60000).toISOString(),
        startAt: new Date(Date.now() + 120000).toISOString(),
        isPublic: true,
      };

      const response = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', authToken)
        .send(createDto)
        .expect(201);

      managementTournamentId = response.body.id;
    });

    it('should update tournament details', async () => {
      const updateDto = {
        name: 'Updated Tournament Name',
        description: 'Updated description',
        maxParticipants: 6,
      };

      const response = await request(app.getHttpServer())
        .put(`/tournaments/${managementTournamentId}`)
        .set('Authorization', authToken)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe(updateDto.name);
      expect(response.body.description).toBe(updateDto.description);
      expect(response.body.maxParticipants).toBe(updateDto.maxParticipants);
    });

    it('should remove a participant before tournament starts', async () => {
      // Register a participant
      const registerResponse = await request(app.getHttpServer())
        .post(`/tournaments/${managementTournamentId}/participants`)
        .set('Authorization', authToken)
        .send({ playerId: 'removable-player' })
        .expect(201);

      const participantId = registerResponse.body.id;

      // Remove the participant
      await request(app.getHttpServer())
        .delete(
          `/tournaments/${managementTournamentId}/participants/${participantId}`,
        )
        .set('Authorization', authToken)
        .expect(204);

      // Verify participant is removed
      const participantsResponse = await request(app.getHttpServer())
        .get(`/tournaments/${managementTournamentId}/participants`)
        .set('Authorization', authToken)
        .expect(200);

      expect(
        participantsResponse.body.some((p) => p.id === participantId),
      ).toBe(false);
    });

    it('should delete tournament if not started', async () => {
      await request(app.getHttpServer())
        .delete(`/tournaments/${managementTournamentId}`)
        .set('Authorization', authToken)
        .expect(204);

      // Verify tournament is deleted
      await request(app.getHttpServer())
        .get(`/tournaments/${managementTournamentId}`)
        .set('Authorization', authToken)
        .expect(404);
    });
  });
});
