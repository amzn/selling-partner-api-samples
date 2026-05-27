import { setTimeout, clearTimeout } from "node:timers";
import { RepositoryService } from "../tools/code-generation-tools/services/repository.js";

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3_000;

export type SdkStatus =
  | { state: "idle" }
  | { state: "cloning" }
  | { state: "ready" }
  | { state: "failed"; error: Error };

/**
 * Singleton that manages eager cloning of the SP-API SDK repository.
 *
 * - Starts the clone as a non-blocking background task on server startup.
 * - Exposes `ensureReady()` for tools that need the repo — if the clone is
 *   in-flight it awaits the existing promise; if it failed it retries.
 * - Implements timeout + retry so a single slow/failing clone doesn't hang
 *   the tool forever.
 */
export class SdkInitializer {
  private readonly repositoryService: RepositoryService;
  private clonePromise: Promise<void> | null = null;
  private status: SdkStatus = { state: "idle" };
  private retryCount = 0;

  constructor(repositoryService?: RepositoryService) {
    this.repositoryService = repositoryService ?? new RepositoryService();
  }

  getStatus(): SdkStatus {
    return this.status;
  }

  /**
   * Kick off the clone in the background. Safe to call multiple times —
   * subsequent calls are no-ops if a clone is already running or succeeded.
   */
  startBackgroundClone(): void {
    if (this.status.state === "ready" || this.status.state === "cloning") {
      return;
    }
    this.clonePromise = this.attemptClone();
    this.clonePromise.catch(() => {});
  }

  /**
   * Await the SDK being available. If the background clone succeeded this
   * resolves immediately. If it failed or was never started, it retries.
   *
   * @throws Error if all attempts (including retries) are exhausted.
   */
  async ensureReady(): Promise<void> {
    if (this.status.state === "ready") {
      return;
    }

    // Check if repo already exists on disk (e.g., from a prior server run)
    const alreadyCloned = await this.repositoryService.isRepositoryCloned(
      this.repositoryService.getDefaultTargetPath(),
    );
    if (alreadyCloned) {
      this.status = { state: "ready" };
      return;
    }

    // If a clone is in-flight, wait for it
    if (this.clonePromise && this.status.state === "cloning") {
      await this.clonePromise;
      if ((this.status as SdkStatus).state === "ready") return;
    }

    // Clone never started or previously failed — try now with retries
    await this.attemptCloneWithRetries();
  }

  private async attemptClone(): Promise<void> {
    this.status = { state: "cloning" };
    try {
      await this.withTimeout(
        this.repositoryService.cloneRepository(),
        DEFAULT_TIMEOUT_MS,
      );
      this.status = { state: "ready" };
      this.retryCount = 0;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.status = { state: "failed", error };
      throw error;
    }
  }

  private async attemptCloneWithRetries(): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.clonePromise = this.attemptClone();
        await this.clonePromise;
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.retryCount++;
        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_DELAY_MS);
        }
      }
    }

    throw new Error(
      `Failed to clone SP-API SDK repository after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    );
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Clone timed out after ${ms}ms`)),
        ms,
      );
      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
