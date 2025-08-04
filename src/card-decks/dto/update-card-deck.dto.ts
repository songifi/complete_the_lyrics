import { PartialType } from '@nestjs/mapped-types';
import { CreateCardDeckDto } from './create-card-deck.dto';

export class UpdateCardDeckDto extends PartialType(CreateCardDeckDto) {}
