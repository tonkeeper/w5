import {
    Address,
    beginCell,
    BitBuilder,
    BitReader,
    BitString,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode
} from 'ton-core';
import { bufferToBigInt } from '../tests/utils';

export type WalletV5Config = {
    seqno: number;
    walletId: bigint;
    publicKey: Buffer;
    extensions: Dictionary<bigint, bigint>;
};

export function walletV5ConfigToCell(config: WalletV5Config): Cell {
    return beginCell()
        .storeUint(config.seqno, 32)
        .storeUint(config.walletId, 80)
        .storeBuffer(config.publicKey, 32)
        .storeDict(config.extensions, Dictionary.Keys.BigUint(256), Dictionary.Values.BigInt(8))
        .endCell();
}

export const Opcodes = {
    action_send_msg: 0x0ec3c86d,
    action_set_code: 0xad4de08e,
    action_extended_set_data: 0x1ff8ea0b,
    action_extended_add_extension: 0x1c40db9f,
    action_extended_remove_extension: 0x5eaef4a4,
    auth_extension: 0x6578746e,
    auth_signed: 0x7369676e
};

export class WalletId {
    static readonly versionsSerialisation: Record<WalletId['walletVersion'], number> = {
        v5: 0
    };

    static deserialize(walletId: bigint | Buffer): WalletId {
        const bitReader = new BitReader(
            new BitString(
                typeof walletId === 'bigint' ? Buffer.from(walletId.toString(16), 'hex') : walletId,
                0,
                80
            )
        );
        const networkGlobalId = bitReader.loadInt(32);
        const workChain = bitReader.loadInt(8);
        const walletVersionRaw = bitReader.loadUint(8);
        const subwalletNumber = bitReader.loadUint(32);

        const walletVersion = Object.entries(this.versionsSerialisation).find(
            ([_, value]) => value === walletVersionRaw
        )?.[0] as WalletId['walletVersion'] | undefined;

        if (walletVersion === undefined) {
            throw new Error(
                `Can't deserialize walletId: unknown wallet version ${walletVersionRaw}`
            );
        }

        return new WalletId({ networkGlobalId, workChain, walletVersion, subwalletNumber });
    }

    readonly walletVersion: 'v5';

    // -239 is mainnet, -3 is testnet
    readonly networkGlobalId: number;

    readonly workChain: number;

    readonly subwalletNumber: number;

    readonly serialized: bigint;

    constructor(args?: {
        networkGlobalId?: number;
        workChain?: number;
        subwalletNumber?: number;
        walletVersion?: 'v5';
    }) {
        this.networkGlobalId = args?.networkGlobalId ?? -239;
        this.workChain = args?.workChain ?? 0;
        this.subwalletNumber = args?.subwalletNumber ?? 0;
        this.walletVersion = args?.walletVersion ?? 'v5';

        const bitBuilder = new BitBuilder(80);
        bitBuilder.writeInt(this.networkGlobalId, 32);
        bitBuilder.writeInt(this.workChain, 8);
        bitBuilder.writeUint(WalletId.versionsSerialisation[this.walletVersion], 8);
        bitBuilder.writeUint(this.subwalletNumber, 32);

        this.serialized = bufferToBigInt(bitBuilder.buffer());
    }
}

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

    async sendInternalMessageFromExtension(
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
                .storeUint(Opcodes.auth_extension, 32)
                .storeSlice(opts.body.beginParse())
                .endCell()
        });
    }

    async sendInternal(
        provider: ContractProvider,
        via: Sender,
        opts: Parameters<ContractProvider['internal']>[1]
    ) {
        await provider.internal(via, opts);
    }

    async sendExternalSignedMessage(provider: ContractProvider, body: Cell) {
        await provider.external(
            beginCell().storeUint(Opcodes.auth_signed, 32).storeSlice(body.beginParse()).endCell()
        );
    }

    async sendExternal(provider: ContractProvider, body: Cell) {
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

    async getWalletId(provider: ContractProvider) {
        const result = await provider.get('get_wallet_id', []);
        return WalletId.deserialize(result.stack.readBigNumber());
    }

    async getExtensions(provider: ContractProvider) {
        const result = await provider.get('get_extensions', []);
        return result.stack.readCellOpt();
    }

    async getExtensionsArray(provider: ContractProvider) {
        const extensions = await this.getExtensions(provider);
        if (!extensions) {
            return [];
        }

        const dict: Dictionary<bigint, bigint> = Dictionary.loadDirect(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8),
            extensions
        );

        return dict.keys().map(key => {
            const wc = dict.get(key)!;
            const addressHex = key ^ (wc + 1n);
            return Address.parseRaw(`${wc}:${addressHex.toString(16)}`);
        });
    }
}
