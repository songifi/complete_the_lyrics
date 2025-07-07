import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SubmitAttemptDto {
  @IsUUID()
  lyricsId: string;

  @IsString()
  @IsNotEmpty()
  submittedText: string;
}
