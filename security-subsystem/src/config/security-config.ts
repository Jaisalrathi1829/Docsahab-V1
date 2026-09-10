export type SecurityEnvironment = 'TEST' | 'DEVELOPMENT' | 'DEMO' | 'STAGING' | 'PRODUCTION';

export interface SecurityConfig {
  environment: SecurityEnvironment;
  allowDemoOtp: boolean;
  corsOrigins: ReadonlyArray<string>;
  debugErrors: boolean;
  auditLoggingEnabled: boolean;
  rateLimiterType: 'IN_MEMORY' | 'REDIS';
  cookieSecure: boolean;
  sessionSecret?: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateProductionConfig(config: SecurityConfig): ConfigValidationResult {
  const errors: string[] = [];

  if (config.environment === 'PRODUCTION') {
    if (config.allowDemoOtp) errors.push('Demo OTP is forbidden in PRODUCTION');
    if (config.corsOrigins.includes('*')) errors.push('Wildcard CORS is forbidden in PRODUCTION');
    if (config.debugErrors) errors.push('Debug errors must be disabled in PRODUCTION');
    if (!config.auditLoggingEnabled) errors.push('Audit logging is mandatory in PRODUCTION');
    if (config.rateLimiterType !== 'REDIS') errors.push('In-memory rate limiting is not acceptable in PRODUCTION');
    if (!config.cookieSecure) errors.push('Secure cookies are mandatory in PRODUCTION');
    if (!config.sessionSecret || config.sessionSecret.length < 32) errors.push('A strong session secret is mandatory in PRODUCTION');
  }

  return { valid: errors.length === 0, errors };
}

export function assertSafeStartup(config: SecurityConfig): void {
  const result = validateProductionConfig(config);
  if (config.environment === 'PRODUCTION' && !result.valid) {
    throw new Error(`[security] Refusing to start in PRODUCTION: ${result.errors.join('; ')}`);
  }
}