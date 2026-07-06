type Listener = (data: string) => void;

// Singleton aman dari Next.js hot reload di dev
declare global {
  // eslint-disable-next-line no-var
  var __sseListeners: Map<string, Set<Listener>> | undefined;
}

const listeners: Map<string, Set<Listener>> =
  global.__sseListeners ?? (global.__sseListeners = new Map());

export function sseSubscribe(userId: string, listener: Listener): () => void {
  if (!listeners.has(userId)) listeners.set(userId, new Set());
  listeners.get(userId)!.add(listener);
  return () => {
    listeners.get(userId)?.delete(listener);
    if (listeners.get(userId)?.size === 0) listeners.delete(userId);
  };
}

export function sseEmit(userId: string, data: object) {
  const userListeners = listeners.get(userId);
  if (!userListeners?.size) return;
  const payload = JSON.stringify(data);
  userListeners.forEach((fn) => {
    try { fn(payload); } catch { /* connection closed */ }
  });
}
