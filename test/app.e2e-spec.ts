// test/chat.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as io from 'socket.io-client';
import { AppModule } from '../src/app.module';

describe('ChatGateway (e2e)', () => {
  let app: INestApplication;
  let client1: any;
  let client2: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(3000);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach((done) => {
    // Setup clients
    client1 = io.connect('http://localhost:3000/chat', {
      auth: { token: 'valid-jwt-token-for-user1' },
    });
    client2 = io.connect('http://localhost:3000/chat', {
      auth: { token: 'valid-jwt-token-for-user2' },
    });

    client1.on('connect', () => {
      client2.on('connect', () => {
        done();
      });
    });
  });

  afterEach(() => {
    client1.disconnect();
    client2.disconnect();
  });

  it('should join room and receive messages', (done) => {
    const roomId = 'test-room';
    const testMessage = { content: 'Hello world', roomId };

    client1.emit('joinRoom', roomId);
    client2.emit('joinRoom', roomId);

    client2.on('newMessage', (msg) => {
      expect(msg.content).toBe(testMessage.content);
      expect(msg.roomId).toBe(roomId);
      done();
    });

    setTimeout(() => {
      client1.emit('sendMessage', testMessage);
    }, 100);
  });

  it('should enforce rate limiting', (done) => {
    let messageCount = 0;
    const roomId = 'test-room2';
    const maxMessages = 30;

    client1.emit('joinRoom', roomId);

    client1.on('error', (err) => {
      expect(err).toBe(
        'Rate limit exceeded. Please wait before sending more messages.',
      );
      done();
    });

    const sendMessages = () => {
      for (let i = 0; i < maxMessages + 5; i++) {
        client1.emit('sendMessage', {
          content: `Message ${i}`,
          roomId,
        });
      }
    };

    setTimeout(sendMessages, 100);
  });
});

