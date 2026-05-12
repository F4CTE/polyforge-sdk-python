/**
 * Promise-based mutual exclusion lock for strategy tick execution.
 *
 * Ensures only one tick evaluates at a time. Concurrent requests are
 * coalesced: when the lock is held, additional callers set a pending
 * flag but only ONE follow-up tick fires after release, regardless of
 * how many requests arrived during the locked period.
 *
 * This is a security boundary that prevents:
 * - Concurrent tick evaluation corrupting shared strategy state
 * - Unbounded promise accumulation from rapid price events in EVENT mode
 * - Duplicate order intents from overlapping evaluations
 *
 * All methods are synchronous — no internal awaits. The lock relies on
 * the Node.js event-loop guarantee that synchronous code between await
 * points executes atomically.
 */
export class TickMutex {
  private _locked = false;
  private _pending = false;

  /**
   * Attempt to enter the critical section.
   * Returns true if the caller should proceed with evaluation.
   * If already locked, marks a pending follow-up and returns false.
   */
  tryEnter(): boolean {
    if (this._locked) {
      this._pending = true;
      return false;
    }
    this._locked = true;
    return true;
  }

  /**
   * Exit the critical section.
   * Returns true if a follow-up tick was requested during the
   * locked period and should be scheduled. The lock is always
   * released so the follow-up can re-acquire it via tryEnter().
   */
  exit(): boolean {
    const hadPending = this._pending;
    this._pending = false;
    this._locked = false;
    return hadPending;
  }

  /** Whether the mutex is currently held (released by exit() even when a follow-up is pending). */
  get isLocked(): boolean {
    return this._locked;
  }
}
