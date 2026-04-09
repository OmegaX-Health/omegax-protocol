// SPDX-License-Identifier: AGPL-3.0-or-later
export function createShortLivedPromiseCache(options) {
    const values = new Map();
    const recentErrors = new Map();
    const pending = new Map();
    function clearExpired(now = Date.now()) {
        for (const [key, entry] of values.entries()) {
            if (entry.expiresAt <= now) {
                values.delete(key);
            }
        }
        for (const [key, entry] of recentErrors.entries()) {
            if (entry.expiresAt <= now) {
                recentErrors.delete(key);
            }
        }
    }
    async function getOrLoad(key, loader) {
        const now = Date.now();
        clearExpired(now);
        const cachedValue = values.get(key);
        if (cachedValue && cachedValue.expiresAt > now) {
            return cachedValue.value;
        }
        const cachedError = recentErrors.get(key);
        if (cachedError && cachedError.expiresAt > now) {
            throw cachedError.error;
        }
        const inflight = pending.get(key);
        if (inflight) {
            return inflight;
        }
        const request = Promise.resolve()
            .then(loader)
            .then((value) => {
            values.set(key, {
                expiresAt: Date.now() + options.ttlMs,
                value,
            });
            recentErrors.delete(key);
            pending.delete(key);
            return value;
        })
            .catch((error) => {
            if ((options.errorTtlMs ?? 0) > 0) {
                recentErrors.set(key, {
                    error,
                    expiresAt: Date.now() + (options.errorTtlMs ?? 0),
                });
            }
            pending.delete(key);
            throw error;
        });
        pending.set(key, request);
        return request;
    }
    return {
        clear() {
            values.clear();
            recentErrors.clear();
            pending.clear();
        },
        delete(key) {
            values.delete(key);
            recentErrors.delete(key);
            pending.delete(key);
        },
        getOrLoad,
    };
}
