import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode
} from 'ton-core';

export type WalletV5Config = {
    seqno: number;
    subwallet: number;
    publicKey: Buffer;
    extensions: Dictionary<bigint, bigint>;
};

export function walletV5ConfigToCell(config: WalletV5Config): Cell {
    return beginCell()
        .storeUint(config.seqno, 32)
        .storeUint(config.subwallet, 32)
        .storeBuffer(config.publicKey, 32)
        .storeDict(config.extensions, Dictionary.Keys.BigUint(256), Dictionary.Values.BigInt(8))
        .endCell();
}

export const Opcodes = {
    action_send_msg: 0x0ec3c86d,
    action_set_code: 0xad4de08e,
    action_reserve_currency: 0x36e6b809,
    action_change_library: 0x26fa1dd4,
    action_extended_set_data: 0x1ff8ea0b,
    action_extended_add_extension: 0x1c40db9f,
    action_extended_remove_extension: 0x5eaef4a4,
    auth_extension: 0x6578746e,
    auth_signed: 0x7369676e
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
            body: beginCell().endCell()
        });
    }

    async sendInternalSignedMessage(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            body: Cell;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.auth_signed, 32)
                .storeSlice(opts.body.beginParse())
                .endCell()
        });
    }

    async getPublicKey(provider: ContractProvider) {
        const result = await provider.get('get_public_key', []);
        return result.stack.readBigNumber();
    }

    async getSeqno(provider: ContractProvider) {
        const result = await provider.get('seqno', []);
        return result.stack.readNumber();
    }

    async getSubWalletID(provider: ContractProvider) {
        const result = await provider.get('get_subwallet_id', []);
        return result.stack.readNumber();
    }

    async getExtensions(provider: ContractProvider) {
        const result = await provider.get('get_extensions', []);
        return result.stack.readCell();
    }
}
