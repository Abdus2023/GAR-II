import { AsyncLocalStorage } from 'node:async_hooks'

export interface GatewayRequestContext {
  userId: string
  correlationId?: string
}

const requestContextStorage = new AsyncLocalStorage<GatewayRequestContext>()

export function runWithRequestContext<T>(context: GatewayRequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn)
}

export function getRequestContext() {
  return requestContextStorage.getStore()
}

export function getCurrentUserId(fallback = 'default') {
  return getRequestContext()?.userId || fallback
}

export function getCurrentCorrelationId() {
  return getRequestContext()?.correlationId
}
