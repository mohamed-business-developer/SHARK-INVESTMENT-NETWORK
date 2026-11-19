import type {
  AccountStatus,
  AppLocale,
  OnboardingStep,
  SignupSelectableRole,
  UserRole,
} from './enums';

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly preferredLanguage: AppLocale;
  readonly intendedRole?: SignupSelectableRole;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface SelectAccountRoleRequest {
  readonly role: SignupSelectableRole;
}

export interface ForgotPasswordRequest {
  readonly email: string;
}

export interface ResetPasswordRequest {
  readonly newPassword: string;
}

export interface DeleteOwnAccountRequest {
  readonly confirmationPhrase: string;
  readonly currentPassword: string;
}

export interface AuthSessionSummary {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  readonly accountStatus: AccountStatus;
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: OnboardingStep;
  readonly preferredLanguage: AppLocale;
}
