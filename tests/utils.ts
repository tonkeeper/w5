import { Address, beginCell, Cell, CurrencyCollection, MessageRelaxed, StateInit } from 'ton-core';
import { Address as Address_, Cell as Cell_, MessageRelaxed as MessageRelaxed_ } from '@ton/core';

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

export function createMsgInternal(params: {
    bounce?: boolean;
    dest: Address;
    value: bigint | CurrencyCollection;
    body?: Cell;
    init?: StateInit | null;
}): MessageRelaxed {
    return {
        info: {
            type: 'internal',
            ihrDisabled: true,
            bounce: params.bounce ?? false,
            bounced: false,
            dest: params.dest,
            value: typeof params.value === 'bigint' ? { coins: params.value } : params.value,
            ihrFee: 0n,
            forwardFee: 0n,
            createdLt: 0n,
            createdAt: 0
        },
        body: params.body || beginCell().endCell(),
        init: params.init
    };
}

export function toAtTonCoreMsgInternal(msg: MessageRelaxed): MessageRelaxed_ {
    return {
        info: {
            ...msg.info,
            dest: Address_.parse(msg.info.dest!.toString())
        },
        body: Cell_.fromBase64(msg.body.toBoc().toString('base64')),
        init: msg.init
    } as MessageRelaxed_;
}

export async function disableConsoleError(callback: () => Promise<void>): Promise<void> {
    const errorsHandler = console.error;
    console.error = () => {};
    await callback();
    console.error = errorsHandler;
}
