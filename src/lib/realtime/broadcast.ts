import "server-only";

type Subscriber = (payload: string) => void;

type BroadcastState = {
  subscribers: Map<string, Set<Subscriber>>;
};

declare global {
  var __pendlBroadcastState: BroadcastState | undefined;
}

function getState(): BroadcastState {
  if (!globalThis.__pendlBroadcastState) {
    globalThis.__pendlBroadcastState = { subscribers: new Map() };
  }
  return globalThis.__pendlBroadcastState;
}

/**
 * Register a listener for an agency's vehicle updates.
 *
 * The worker runs in this same process, so a tick can hand its payload
 * straight to every open stream instead of each client asking for it.
 *
 * @returns an unsubscribe function; calling it twice is harmless.
 */
export function subscribe(agencyTag: string, listener: Subscriber): () => void {
  const state = getState();

  let listeners = state.subscribers.get(agencyTag);
  if (!listeners) {
    listeners = new Set();
    state.subscribers.set(agencyTag, listeners);
  }
  listeners.add(listener);

  return () => {
    const current = state.subscribers.get(agencyTag);
    if (!current) return;

    current.delete(listener);
    if (current.size === 0) {
      state.subscribers.delete(agencyTag);
    }
  };
}

/**
 * Hand a payload to every open stream for an agency.
 *
 * A throwing listener must not stop the others from being served, so
 * failures are logged and skipped.
 */
export function publish(agencyTag: string, payload: string): void {
  const listeners = getState().subscribers.get(agencyTag);
  if (!listeners) return;

  for (const listener of [...listeners]) {
    try {
      listener(payload);
    } catch (error) {
      console.error(`Broadcast listener failed for ${agencyTag}:`, error);
    }
  }
}

export function subscriberCount(agencyTag: string): number {
  return getState().subscribers.get(agencyTag)?.size ?? 0;
}

/** Agencies with at least one open stream, so the worker keeps ticking. */
export function subscribedTags(): string[] {
  return [...getState().subscribers.keys()];
}
