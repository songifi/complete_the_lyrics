import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Injectable } from '@nestjs/common';

@ValidatorConstraint({ name: 'isFutureDate', async: false })
@Injectable()
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) return true; // Let @IsDateString handle required validation

    const date = new Date(value);
    const now = new Date();

    return date > now;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a future date`;
  }
}

@ValidatorConstraint({ name: 'isValidDateRange', async: false })
@Injectable()
export class IsValidDateRangeConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const [startDateProperty, endDateProperty] = args.constraints;

    const startDate = new Date(object[startDateProperty]);
    const endDate = new Date(object[endDateProperty]);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return true; // Let date validation handle invalid dates
    }

    return startDate < endDate;
  }

  defaultMessage(args: ValidationArguments) {
    const [startDateProperty, endDateProperty] = args.constraints;
    return `${startDateProperty} must be before ${endDateProperty}`;
  }
}

@ValidatorConstraint({ name: 'isValidParticipantCount', async: false })
@Injectable()
export class IsValidParticipantCountConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const maxParticipants = object.maxParticipants;
    const minParticipants = object.minParticipants;

    if (!maxParticipants || !minParticipants) {
      return true; // Skip validation if either is not set
    }

    return minParticipants <= maxParticipants;
  }

  defaultMessage(args: ValidationArguments) {
    return 'minParticipants must be less than or equal to maxParticipants';
  }
}

@ValidatorConstraint({ name: 'isValidTournamentFormat', async: false })
@Injectable()
export class IsValidTournamentFormatConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const format = object.format;
    const maxParticipants = object.maxParticipants;

    if (!format || !maxParticipants) {
      return true; // Skip validation if not set
    }

    // Single and Double Elimination work best with powers of 2
    if (format === 'SINGLE_ELIMINATION' || format === 'DOUBLE_ELIMINATION') {
      // Allow any number, but warn if not power of 2
      return true;
    }

    // Round Robin works with any number >= 3
    if (format === 'ROUND_ROBIN') {
      return maxParticipants >= 3;
    }

    // Swiss System works with any number >= 4
    if (format === 'SWISS_SYSTEM') {
      return maxParticipants >= 4;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    const format = object.format;

    switch (format) {
      case 'ROUND_ROBIN':
        return 'Round Robin tournaments require at least 3 participants';
      case 'SWISS_SYSTEM':
        return 'Swiss System tournaments require at least 4 participants';
      default:
        return 'Invalid tournament format for the specified participant count';
    }
  }
}

@ValidatorConstraint({ name: 'isValidPrizePool', async: false })
@Injectable()
export class IsValidPrizePoolConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const prizePool = object.prizePool;
    const entryFee = object.entryFee;
    const maxParticipants = object.maxParticipants;

    if (!prizePool || !entryFee || !maxParticipants) {
      return true; // Skip validation if not all fields are set
    }

    const maxPossiblePrizePool = entryFee * maxParticipants;

    // Prize pool shouldn't exceed total possible entry fees
    return prizePool <= maxPossiblePrizePool;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Prize pool cannot exceed total possible entry fees';
  }
}

@ValidatorConstraint({ name: 'isValidRegistrationPeriod', async: false })
@Injectable()
export class IsValidRegistrationPeriodConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const registrationStartAt = new Date(object.registrationStartAt);
    const registrationEndAt = new Date(object.registrationEndAt);
    const startAt = new Date(object.startAt);

    if (
      isNaN(registrationStartAt.getTime()) ||
      isNaN(registrationEndAt.getTime()) ||
      isNaN(startAt.getTime())
    ) {
      return true; // Let date validation handle invalid dates
    }

    // Registration must end before tournament starts
    const minimumPreparationTime = 5 * 60 * 1000; // 5 minutes
    return (
      registrationEndAt.getTime() + minimumPreparationTime <= startAt.getTime()
    );
  }

  defaultMessage(args: ValidationArguments) {
    return 'Tournament must start at least 5 minutes after registration ends';
  }
}

// Decorator functions
export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
}

export function IsValidDateRange(
  startDateProperty: string,
  endDateProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [startDateProperty, endDateProperty],
      validator: IsValidDateRangeConstraint,
    });
  };
}

export function IsValidParticipantCount(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidParticipantCountConstraint,
    });
  };
}

export function IsValidTournamentFormat(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidTournamentFormatConstraint,
    });
  };
}

export function IsValidPrizePool(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPrizePoolConstraint,
    });
  };
}

export function IsValidRegistrationPeriod(
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidRegistrationPeriodConstraint,
    });
  };
}
