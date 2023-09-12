import { Address } from 'ton-core';

export function bufferToBigInt(buffer: Buffer): bigint {
    return BigInt('0x' + buffer.toString('hex'));
}

export function packAddress(address: Address) {
    const wcPlus = address.workChain + 1;
    return bufferToBigInt(address.hash) ^ BigInt(wcPlus);
}
