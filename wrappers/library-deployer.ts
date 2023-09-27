import {
    Address,
    beginCell,
    BitBuilder,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode
} from 'ton-core';

export type LibraryDeployerConfig = {
    libraryCode: Cell;
};

export class LibraryDeployer implements Contract {
    static exportLibCode(code: Cell) {
        const bits = new BitBuilder();
        bits.writeUint(2, 8);
        bits.writeUint(BigInt('0x' + code.hash().toString('hex')), 256);

        return new Cell({ exotic: true, bits: bits.build() });
    }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromConfig(config: LibraryDeployerConfig, code: Cell, workchain = -1) {
        const data = config.libraryCode;
        const init = { code, data };
        return new LibraryDeployer(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell()
        });
    }
}
