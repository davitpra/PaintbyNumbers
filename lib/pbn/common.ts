
export type RGB = number[];

export interface IMap<T> {
    [key: string]: T;
}

export async function delay(ms: number): Promise<void> {
    if (typeof window !== "undefined") {
        return new Promise<void>((exec) => (<any> window).setTimeout(exec, ms));
    } else {
        return new Promise<void>((exec) => exec());
    }
}

export class CancellationToken {
    public isCancelled: boolean = false;
}

// shared MessageChannel for fast macrotask yields; initialized lazily so this
// module stays SSR-safe (Next.js evaluates it on the server via the import graph)
let mcQueue: Array<() => void> | null = null;
let mcPort2: MessagePort | null = null;

/**
 * Yields control back to the browser between chunks of long-running work.
 *
 * Crucially, in a browser it resumes *after* the compositor has had a chance to
 * paint: scheduler.yield() and MessageChannel both run their continuation before
 * the next paint, so a pipeline that yields through them keeps the main thread
 * busy and the UI (e.g. the progress bar) appears frozen until everything is
 * done. We schedule the continuation past a paint via requestAnimationFrame +
 * setTimeout, with a setTimeout fallback so a hidden/background tab (where rAF is
 * throttled or paused) never stalls the pipeline. Off the DOM (SSR/workers) we
 * fall back to MessageChannel/delay.
 */
export function yieldToMain(): Promise<void> {
    if (typeof requestAnimationFrame !== "undefined") {
        return new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
                if (done) { return; }
                done = true;
                resolve();
            };
            // resume right after the frame paints, so the browser renders the
            // latest progress before we grab the main thread again
            requestAnimationFrame(() => setTimeout(finish, 0));
            // safety net: a backgrounded tab pauses rAF, so don't hang on it
            setTimeout(finish, 100);
        });
    }
    if (typeof MessageChannel !== "undefined") {
        if (mcQueue === null) {
            const mc = new MessageChannel();
            mcQueue = [];
            mcPort2 = mc.port2;
            mc.port1.onmessage = () => mcQueue!.shift()?.();
        }
        return new Promise<void>((resolve) => {
            mcQueue!.push(resolve);
            mcPort2!.postMessage(undefined);
        });
    }
    return delay(0);
}

/**
 * Returns an async function that yields to the browser only when more than
 * intervalMs has elapsed since the last yield. Resolves to true if a yield
 * happened, so callers can gate progress callbacks & canvas redraws on it.
 */
export function createYielder(intervalMs: number = 150): () => Promise<boolean> {
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    let last = now();
    return async () => {
        if (now() - last < intervalMs) { return false; }
        await yieldToMain();
        // measure after the yield so time spent in the browser isn't counted
        last = now();
        return true;
    };
}
