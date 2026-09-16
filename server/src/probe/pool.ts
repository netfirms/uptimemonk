/**
 * A bounded work pool.
 *
 * Probes are I/O-bound, so this limit protects file descriptors and memory
 * rather than CPU — which is why the number to watch is queue depth, not load
 * average. Depth growing monotonically means the worker is genuinely full —
 * which is the signal to add another one;
 * a high load average during a burst means nothing.
 */
export class Pool {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  get depth(): number {
    return this.queue.length;
  }

  get inFlight(): number {
    return this.active;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }

  /** Fire and forget, with the rejection surfaced to a handler. */
  submit(task: () => Promise<unknown>, onError: (err: unknown) => void): void {
    this.run(task).catch(onError);
  }

  /** Wait for everything in flight to settle — used on shutdown. */
  async drain(): Promise<void> {
    while (this.active > 0 || this.queue.length > 0) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}
