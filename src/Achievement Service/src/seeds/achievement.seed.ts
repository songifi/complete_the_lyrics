import { DataSource, type DeepPartial } from 'typeorm';
import { Achievement } from '../achievements/entities/achievement.entity';

export async function seedAchievements(dataSource: DataSource) {
  const achievementRepository = dataSource.getRepository(Achievement);

  const achievements: DeepPartial<Achievement>[] = [
    {
      name: 'First Steps',
      description: 'Complete your first task',
      category: 'onboarding',
      type: 'completion' as Achievement['type'],
      triggerAction: 'task_completed',
      targetValue: 1,
      points: 10,
      tier: 'bronze' as Achievement['tier'],
      rarity: 'common' as Achievement['rarity'],
      prerequisiteIds: [],
      imageUrl: '/images/achievements/first-steps.png',
      badgeIconUrl: '/badges/first-steps.svg',
      badgeStyle: { color: '#8bc34a', shape: 'shield' },
      rewards: [
        { type: 'points', value: 10 },
        { type: 'badge', value: 1, metadata: { badgeId: 'newcomer' } }
      ],
    },
    {
      name: 'Task Master',
      description: 'Complete 100 tasks',
      category: 'productivity',
      type: 'cumulative' as Achievement['type'],
      triggerAction: 'task_completed',
      targetValue: 100,
      points: 500,
      tier: 'gold' as Achievement['tier'],
      rarity: 'rare' as Achievement['rarity'],
      prerequisiteIds: [],
      imageUrl: '/images/achievements/task-master.png',
      badgeStyle: { color: '#ffd700', shape: 'ribbon' },
      rewards: [
        { type: 'points', value: 500 },
        { type: 'currency', value: 1000, metadata: { currencyType: 'coins' } }
      ],
    },
    {
      name: 'Week Warrior',
      description: 'Complete tasks for 7 consecutive days',
      category: 'consistency',
      type: 'streak' as Achievement['type'],
      triggerAction: 'daily_task_completed',
      targetValue: 7,
      points: 200,
      tier: 'silver' as Achievement['tier'],
      rarity: 'uncommon' as Achievement['rarity'],
      prerequisiteIds: [],
      imageUrl: '/images/achievements/week-warrior.png',
      badgeStyle: { color: '#c0c0c0', shape: 'star' },
      rewards: [
        { type: 'points', value: 200 }
      ],
    },
    {
      name: 'Social Butterfly',
      description: 'Share 5 achievements',
      category: 'social',
      type: 'cumulative' as Achievement['type'],
      triggerAction: 'achievement_shared',
      targetValue: 5,
      points: 100,
      tier: 'bronze' as Achievement['tier'],
      rarity: 'common' as Achievement['rarity'],
      prerequisiteIds: [],
      imageUrl: '/images/achievements/social-butterfly.png',
      badgeStyle: { color: '#cd7f32', shape: 'circle' },
      rewards: [
        { type: 'points', value: 100 },
        { type: 'item', value: 1, metadata: { itemId: 'social_badge' } }
      ],
    },
  ];

  for (const achievementData of achievements) {
    const existing = await achievementRepository.findOne({
      where: { name: achievementData.name },
    });

    if (!existing) {
      const achievement = achievementRepository.create(achievementData);
      await achievementRepository.save(achievement);
      console.log(`Created achievement: ${achievement.name}`);
    }
  }
}
