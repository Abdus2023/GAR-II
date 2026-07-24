export type GatewayErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'INVALID_INPUT'
  | 'CAPABILITY_NOT_FOUND'
  | 'CAPABILITY_FAILED'
  | 'BUDGET_EXCEEDED'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_ERROR'

export interface SerializedGatewayError {
  code: GatewayErrorCode
  message: string
  status: number
  details?: unknown
}

export class GatewayError extends Error {
  readonly code: GatewayErrorCode
  readonly status: number
  readonly details?: unknown

  constructor(code: GatewayErrorCode, message: string, options: { status?: number; details?: unknown; cause?: unknown } = {}) {
    super(message)
    this.name = 'GatewayError'
    this.code = code
    this.status = options.status ?? 500
    this.details = options.details

    if (options.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

export function isGatewayError(error: unknown): error is GatewayError {
  return error instanceof GatewayError
}

export function serializeGatewayError(error: unknown): SerializedGatewayError {
  if (isGatewayError(error)) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
    }
  }

  if (error instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
      status: 500,
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'Unknown error',
    status: 500,
    details: error,
  }
}
