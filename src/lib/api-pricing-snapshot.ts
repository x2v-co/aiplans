/** One public-data slot, with no caller-controlled keys or response/query cache. */
export function createPublicSnapshot<T>(load: () => Promise<T>, options: {
  ttlMs: number;
  maxBytes: number;
  failureCooldownMs: number;
  clock?: () => number;
}) {
  const clock = options.clock ?? (() => Date.now());
  let entry: { value: T; expiresAt: number } | undefined;
  let inFlight: Promise<T> | undefined;
  let retryAt = 0;
  let eviction: ReturnType<typeof setTimeout> | undefined;

  return function read(): Promise<T> {
    const now = clock();
    if (entry && now < entry.expiresAt) return Promise.resolve(entry.value);
    // Drop expired data before a refresh, including when the refresh fails.
    entry = undefined;
    if (eviction) { clearTimeout(eviction); eviction = undefined; }
    if (inFlight) return inFlight;
    if (now < retryAt) return Promise.reject(new Error('Public snapshot unavailable'));
    const expiresAt = now + options.ttlMs;
    let timedOut = false;
    let deadline: ReturnType<typeof setTimeout>;
    const timeout = new Promise<T>((_resolve, reject) => {
      deadline = setTimeout(() => {
        timedOut = true;
        reject(new Error('Public snapshot unavailable'));
      }, options.ttlMs);
      deadline.unref?.();
    });
    const loading = Promise.resolve().then(load).then(value => {
      // The cap bounds retained serialized data, not transient SQL work or exact JS heap size.
      if (timedOut || clock() >= expiresAt || new TextEncoder().encode(JSON.stringify(value)).byteLength > options.maxBytes) {
        throw new Error('Public snapshot exceeds bounds');
      }
      entry = { value, expiresAt };
      eviction = setTimeout(() => { entry = undefined; eviction = undefined; }, expiresAt - clock());
      eviction.unref?.();
      return value;
    }).catch(() => {
      retryAt = clock() + options.failureCooldownMs;
      throw new Error('Public snapshot unavailable');
    });
    inFlight = Promise.race([loading, timeout]);
    const finish = () => { clearTimeout(deadline); inFlight = undefined; };
    void loading.then(finish, finish);
    // At the deadline, waiters fail; further callers share that rejection until
    // the underlying service settles. It has no cancellation API: never overlap
    // replacement loads, and never admit a late result. Failure cooldown follows settlement.
    return inFlight;
  };
}
