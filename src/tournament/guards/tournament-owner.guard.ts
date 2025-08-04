import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from '../entities/tournament.entity';

@Injectable()
export class TournamentOwnerGuard implements CanActivate {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tournamentId = request.params.id;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!tournamentId) {
      throw new ForbiddenException('Tournament ID is required');
    }

    const tournament = await this.tournamentRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.createdBy !== user.sub && tournament.createdBy !== user.id) {
      throw new ForbiddenException(
        'Only tournament owner can perform this action',
      );
    }

    return true;
  }
}
