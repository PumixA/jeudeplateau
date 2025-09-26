export function makeRng(seedHex: string) {
    // Transforme la seed hex en 32-bit state
    let state = [...seedHex.slice(0, 8)].reduce((acc, ch) => (acc * 33 + ch.charCodeAt(0)) >>> 0, 0x9e3779b9);

    const next = () => {
        // xorshift32
        state ^= state << 13; state >>>= 0;
        state ^= state >>> 17; state >>>= 0;
        state ^= state << 5;   state >>>= 0;
        return state;
    };

    const float = () => (next() >>> 0) / 0xffffffff;
    const intBetween = (min: number, max: number) => Math.floor(float() * (max - min + 1)) + min;

    return { next, float, intBetween };
}

export function rollFaces(seedHex: string, faces: number[]) {
    const rng = makeRng(seedHex);
    const idx = Math.floor(rng.float() * faces.length);
    return faces[idx];
}
