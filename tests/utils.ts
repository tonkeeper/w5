import { Address } from 'ton-core';

export function bufferToBigInt(buffer: Buffer): bigint {
    return BigInt('0x' + buffer.toString('hex'));
}

export function packAddress(address: Address) {
    const wcPlus = address.workChain + 1;
    return bufferToBigInt(address.hash) ^ BigInt(wcPlus);
}

export function validUntil(ttlMs = 1000 * 60 * 3) {
    return Math.floor((Date.now() + ttlMs) / 1000);
}
