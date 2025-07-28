import { Injectable } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService {
  private client: Client;

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
    });
  }

  async indexPlayerStats(stats: any): Promise<void> {
    await this.client.index({
      index: 'player-stats',
      body: {
        ...stats,
        timestamp: new Date()
      }
    });
  }

  async searchStats(query: any): Promise<any> {
    const response = await this.client.search({
      index: 'player-stats',
      body: query
    });

    return response.body.hits;
  }

  async getPlayerAnalytics(playerId: string, timeframe: string = '30d'): Promise<any> {
    const query = {
      query: {
        bool: {
          must: [
            { term: { playerId } },
            {
              range: {
                timestamp: {
                  gte: `now-${timeframe}`
                }
              }
            }
          ]
        }
      },
      aggs: {
        categories: {
          terms: { field: 'category.keyword' },
          aggs: {
            avg_score: { avg: { field: 'calculatedScore' } },
            total_score: { sum: { field: 'calculatedScore' } },
            score_trend: {
              date_histogram: {
                field: 'timestamp',
                calendar_interval: 'day'
              },
              aggs: {
                daily_avg: { avg: { field: 'calculatedScore' } }
              }
            }
          }
        },
        performance_over_time: {
          date_histogram: {
            field: 'timestamp',
            calendar_interval: 'day'
          },
          aggs: {
            daily_score: { avg: { field: 'calculatedScore' } }
          }
        }
      }
    };

    return this.searchStats(query);
  }

  async getTopPerformers(category: string, limit: number = 10): Promise<any> {
    const query = {
      size: 0,
      query: {
        bool: {
          must: [
            { term: { category: category } },
            {
              range: {
                timestamp: {
                  gte: 'now-7d'
                }
              }
