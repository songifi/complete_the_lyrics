import * as bcrypt from 'bcrypt';
import { InsertEvent, UpdateEvent } from 'typeorm';
import { UserSubscriber } from './user.subscriber';
import { User } from '../entities/user.entity';

// Minimal mock DataSource compatible with subscriber constructor
class MockDataSource {
  subscribers: any[] = [];
}

describe('UserSubscriber', () => {
  let subscriber: UserSubscriber;
  let dataSource: MockDataSource;

  beforeEach(() => {
    dataSource = new MockDataSource();
    subscriber = new UserSubscriber((dataSource as unknown) as any);
  });

  it('should register itself with the data source', () => {
    expect(dataSource.subscribers).toContain(subscriber);
  });

  it('beforeInsert hashes plaintext password', async () => {
    const user = new User();
    user.password = 'PlaintextPass123!';
    const event = { entity: user } as InsertEvent<User>;

    await subscriber.beforeInsert(event);

    expect(user.password).toBeDefined();
    expect(user.password).not.toEqual('PlaintextPass123!');
    expect(user.password.startsWith('$2')).toBe(true);
    const matches = await bcrypt.compare('PlaintextPass123!', user.password);
    expect(matches).toBe(true);
  });

  it('beforeInsert leaves existing bcrypt hash unchanged', async () => {
    const preHashed = await bcrypt.hash('SomePass!234', 10);
    const user = new User();
    user.password = preHashed;
    const event = { entity: user } as InsertEvent<User>;

    await subscriber.beforeInsert(event);

    expect(user.password).toEqual(preHashed);
  });

  it('beforeUpdate hashes plaintext password', async () => {
    const user = new User();
    user.password = 'AnotherPlaintext!234';
    const event = { entity: user } as unknown as UpdateEvent<User>;

    await subscriber.beforeUpdate(event);

    expect(user.password).toBeDefined();
    expect(user.password).not.toEqual('AnotherPlaintext!234');
    const matches = await bcrypt.compare('AnotherPlaintext!234', user.password);
    expect(matches).toBe(true);
  });

  it('beforeUpdate leaves existing bcrypt hash unchanged', async () => {
    const preHashed = await bcrypt.hash('KeepHash!234', 10);
    const user = new User();
    user.password = preHashed;
    const event = { entity: user } as unknown as UpdateEvent<User>;

    await subscriber.beforeUpdate(event);

    expect(user.password).toEqual(preHashed);
  });
});


