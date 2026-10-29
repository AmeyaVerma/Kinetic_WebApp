import type { Role } from './types'

/**
 * Roles for which two-factor authentication is mandatory.
 *
 * Siddharth confirmed this: these are the people who can release a bill of
 * lading, move money, or see payroll. The spec notes five of eight internal
 * users have it switched off today.
 */
export const MFA_REQUIRED_ROLES: Role[] = ['admin', 'finance', 'hr']

export function roleRequiresMfa(role: Role | null | undefined): boolean {
  return !!role && MFA_REQUIRED_ROLES.includes(role)
}
