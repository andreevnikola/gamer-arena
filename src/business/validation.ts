export type FieldErrors = Record<string, string>;

export interface ValidationResult {
  valid: boolean;
  errors: FieldErrors;
}

const EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const GAMER_TAG_RE = /^[A-Za-z0-9_]{3,16}$/;
const USER_NAME_RE = /^[A-Za-z0-9_.-]{3,24}$/;

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 128;

const result = (errors: FieldErrors): ValidationResult => ({
  valid: Object.keys(errors).length === 0,
  errors,
});

export const isValidEmail = (value: string): boolean =>
  value.length <= 254 && value.split("@")[0]?.length <= 64 && EMAIL_RE.test(value);

export const isValidGamerTag = (value: string): boolean => GAMER_TAG_RE.test(value);

export const isValidUserName = (value: string): boolean => USER_NAME_RE.test(value);

/** At least 8 characters with a letter and a digit. */
export const isValidPassword = (value: string): boolean =>
  value.length >= 8 && value.length <= 128 && /[A-Za-z]/.test(value) && /\d/.test(value);

export const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

export const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

export interface UserRegistrationInput {
  userName: string;
  email: string;
  password: string;
  gamerTag: string;
}

export function validateUserRegistration(input: UserRegistrationInput): ValidationResult {
  const errors: FieldErrors = {};
  if (!isValidUserName(input.userName)) {
    errors.userName = "3-24 characters: letters, digits, '_', '.' or '-'.";
  }
  if (!isValidEmail(input.email)) errors.email = "Enter a valid email address.";
  if (!isValidPassword(input.password)) {
    errors.password = "At least 8 characters, with a letter and a digit.";
  }
  if (!isValidGamerTag(input.gamerTag)) {
    errors.gamerTag = "3-16 characters: letters, digits or '_'.";
  }
  return result(errors);
}

export function validateTeamName(name: string): ValidationResult {
  const trimmed = name.trim();
  const errors: FieldErrors = {};
  if (trimmed.length < 3 || trimmed.length > 32) errors.name = "Team name must be 3-32 characters.";
  return result(errors);
}

export interface TournamentInput {
  title: string;
  maxParticipants: number;
  prizePool: number;
  startDate: Date;
  endDate: Date;
}

export function validateTournamentInput(input: TournamentInput): ValidationResult {
  const errors: FieldErrors = {};
  const title = input.title.trim();
  if (title.length < 3 || title.length > 80) errors.title = "Title must be 3-80 characters.";
  if (
    !isPositiveInteger(input.maxParticipants) ||
    input.maxParticipants < MIN_PARTICIPANTS ||
    input.maxParticipants > MAX_PARTICIPANTS
  ) {
    errors.maxParticipants = `Must be a whole number from ${MIN_PARTICIPANTS} to ${MAX_PARTICIPANTS}.`;
  }
  if (!isNonNegativeNumber(input.prizePool)) errors.prizePool = "Prize pool cannot be negative.";
  if (!isValidDate(input.startDate)) errors.startDate = "Enter a valid start date.";
  if (!isValidDate(input.endDate)) errors.endDate = "Enter a valid end date.";
  if (!errors.startDate && !errors.endDate && input.endDate < input.startDate) {
    errors.endDate = "End date cannot be before the start date.";
  }
  return result(errors);
}

export function validateGame(input: { name: string; genre: string; teamSize: number }): ValidationResult {
  const errors: FieldErrors = {};
  if (input.name.trim().length < 2) errors.name = "Name is required.";
  if (input.genre.trim().length < 2) errors.genre = "Genre is required.";
  if (!isPositiveInteger(input.teamSize)) errors.teamSize = "Team size must be a positive whole number.";
  return result(errors);
}

export function validateScores(scoreA: number, scoreB: number): ValidationResult {
  const errors: FieldErrors = {};
  if (!isNonNegativeInteger(scoreA)) errors.scoreA = "Score must be a non-negative whole number.";
  if (!isNonNegativeInteger(scoreB)) errors.scoreB = "Score must be a non-negative whole number.";
  return result(errors);
}

export function validateProofUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
