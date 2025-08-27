export class CreateRoundDto {
    gameId: string;
    roundNumber: number;
    questions: any[];
    timePerQuestion?: number;
    settings?: Record<string, any>;
  }
  
  export class SubmitAnswerDto {
    roundId: string;
    questionIndex: number;
    answer: string;
  }
  
  export class BuzzInDto {
    roundId: string;
    questionIndex: number;
  }
  
  export class RoundTimerDto {
    roundId: string;
    timeRemaining: number;
    questionIndex: number;
  }