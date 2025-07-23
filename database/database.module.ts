// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { RedisModule } from 'nestjs-redis';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),
    ElasticsearchModule.registerAsync({
      useFactory: () => ({
        node: process.env.ELASTICSEARCH_NODE,
        maxRetries: 10,
        requestTimeout: 60000,
      }),
    }),
    RedisModule.forRootAsync({
      useFactory: () => ({
        url: process.env.REDIS_URL,
        onClientReady: (client) => {
          client.on('error', (err) => {
            console.error('Redis error', err);
          });
        },
      }),
    }),
  ],
  exports: [MongooseModule, ElasticsearchModule, RedisModule],
})
export class DatabaseModule {}
