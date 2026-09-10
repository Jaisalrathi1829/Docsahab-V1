import { SecurityContext, Role } from '../contracts/security-context';

export interface OTPProvider {
  generateOtp(): string;
  validateOtp(phone: string, candidateOtp: string): Promise<boolean>;
}

export class InsecureDemoOTPProvider implements OTPProvider {
  private static readonly DEMO_OTP = '123456';

  generateOtp(): string {
    return InsecureDemoOTPProvider.DEMO_OTP;
  }

  async validateOtp(phone: string, candidateOtp: string): Promise<boolean> {
    return candidateOtp === InsecureDemoOTPProvider.DEMO_OTP;
  }
}

export class SecureOTPProvider implements OTPProvider {
  private stored = new Map<string, string>();

  generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  storeOtp(phone: string, otp: string, ttlMs: number): void {
    this.stored.set(phone, otp);
    setTimeout(() => {
      this.stored.delete(phone);
    }, ttlMs).unref();
  }

  async validateOtp(phone: string, candidateOtp: string): Promise<boolean> {
    const expected = this.stored.get(phone);
    if (!expected) return false;
    this.stored.delete(phone);
    return expected === candidateOtp;
  }
}

export class AuthenticationProvider {
  constructor(private readonly otpProvider: OTPProvider) {}

  authenticateWithOtp(phone: string, otp: string, role: Role, userId: string): Promise<SecurityContext> {
    return this.otpProvider.validateOtp(phone, otp).then((valid) => {
      if (!valid) {
        throw new Error('INVALID_CREDENTIALS');
      }
      const now = new Date();
      return {
        subjectId: userId,
        role,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 3600_000),
        authMethod: 'OTP',
      };
    });
  }
}