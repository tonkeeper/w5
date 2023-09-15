import { Address, Cell, Contract, ContractProvider } from 'ton-core';

export class WalletV4 implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new WalletV4(address);
    }

    async sendExternalSignedMessage(provider: ContractProvider, body: Cell) {
        await provider.external(body);
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
        const result = await provider.get('get_plugin_list', []);
        return result.stack.readCellOpt();
    }
}
