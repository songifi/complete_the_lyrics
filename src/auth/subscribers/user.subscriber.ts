import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

const BCRYPT_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return User;
  }

  async beforeInsert(event: InsertEvent<User>): Promise<void> {
    const entity = event.entity;
    if (!entity) return;
    if (entity.password && !BCRYPT_REGEX.test(entity.password)) {
      entity.password = await bcrypt.hash(entity.password, AUTH_CONSTANTS.BCRYPT_ROUNDS);
    }
  }

  async beforeUpdate(event: UpdateEvent<User>): Promise<void> {
    const entity = event.entity as User | undefined;
    if (!entity) return;
    // If password provided on update and not already a bcrypt hash, hash it
    if (entity.password && !BCRYPT_REGEX.test(entity.password)) {
      entity.password = await bcrypt.hash(entity.password, AUTH_CONSTANTS.BCRYPT_ROUNDS);
      // Ensure the update payload includes the new hash
      if (event.databaseEntity) {
        event.updatedColumns = event.updatedColumns || [];
      }
    }
  }
}


