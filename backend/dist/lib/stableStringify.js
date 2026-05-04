/**
 * Deterministic JSON-like string for hashing request payloads (idempotency).
 */
export function stableStringify(value) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    const t = typeof value;
    if (t === 'string')
        return JSON.stringify(value);
    if (t === 'number' || t === 'boolean' || t === 'bigint')
        return String(value);
    if (t !== 'object')
        return JSON.stringify(String(value));
    if (Array.isArray(value)) {
        return `[${value.map((v) => stableStringify(v)).join(',')}]`;
    }
    const obj = value;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
