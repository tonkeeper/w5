import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Dictionary, Sender, SendMode } from 'ton-core';

export type WalletV5Config = {
    seqno: number;
    subwallet: number;
    publicKey: Buffer;
    extensions: Dictionary<bigint, Cell>;
};


export function walletV5ConfigToCell(config: WalletV5Config): Cell {
    return beginCell()
        .storeUint(config.seqno, 32)
        .storeUint(config.subwallet, 32)
        .storeBuffer(config.publicKey, 32)
        .storeDict(config.extensions)
        .endCell();
}

export const Opcodes = {
    add: 0x1c40db9f,
    remove: 0x5eaef4a4,
    extn: 0x6578746E,
    sign: 0x7369676E,
};

export class WalletV5 implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new WalletV5(address);
    }

    static createFromConfig(config: WalletV5Config, code: Cell, workchain = 0) {
        const data = walletV5ConfigToCell(config);
        const init = { code, data };
        return new WalletV5(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendInternalSignedMessage(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint,
            body: Cell;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.sign, 32)
                .storeRef(opts.body)
                .endCell(),
        });
    }

    async getPublicKey(provider: ContractProvider) {
        const result = await provider.get('get_public_key', []);
        return result.stack.readNumber();
    }

    async getSeqNo(provider: ContractProvider) {
        const result = await provider.get('seqno', []);
        return result.stack.readNumber();
    }
}
