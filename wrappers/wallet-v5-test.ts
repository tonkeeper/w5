import {
    BitReader,
    BitString,
    Cell,
    beginCell,
    Slice,
    Sender,
    ContractProvider,
    SendMode,
    MessageRelaxed,
    Address,
    toNano,
    OutAction,
    OutActionSendMsg,
    Builder,
    storeOutList,
    contractAddress,
    Dictionary
} from '@ton/core';
import { WalletV5, Opcodes } from './wallet-v5';
import { sign } from '@ton/crypto';

export type WalletActions = {
    wallet?: OutAction[] | Cell;
    extended?: ExtendedAction[] | Cell;
};

export type ExtensionAdd = {
    type: 'add_extension';
    address: Address;
};
export type ExtensionRemove = {
    type: 'remove_extension';
    address: Address;
};

export type SetSignatureAuth = {
    type: 'sig_auth';
    allowed: boolean;
};

export type ExtendedAction = ExtensionAdd | ExtensionRemove | SetSignatureAuth;

export type MessageOut = {
    message: MessageRelaxed;
    mode: SendMode;
};

export interface WalletIdV5R1<
    C extends WalletIdV5R1ClientContext | WalletIdV5R1CustomContext =
        | WalletIdV5R1ClientContext
        | WalletIdV5R1CustomContext
> {
    /**
     * -239 is mainnet, -3 is testnet
     */
    readonly networkGlobalId: number;

    readonly context: C;
}

export interface WalletIdV5R1ClientContext {
    readonly walletVersion: 'v5r1';

    readonly workchain: number;

    readonly subwalletNumber: number;
}

/**
 * 31-bit unsigned integer
 */
export type WalletIdV5R1CustomContext = number;

export function isWalletIdV5R1ClientContext(
    context: WalletIdV5R1ClientContext | WalletIdV5R1CustomContext
): context is WalletIdV5R1ClientContext {
    return typeof context !== 'number';
}

const walletV5R1VersionsSerialisation: Record<WalletIdV5R1ClientContext['walletVersion'], number> =
    {
        v5r1: 0
    };

/**
 * @param value serialized wallet id
 * @param networkGlobalId -239 is mainnet, -3 is testnet
 */

export function storeWalletIdV5R1(walletId: WalletIdV5R1) {
    return (builder: Builder) => {
        let context;
        if (isWalletIdV5R1ClientContext(walletId.context)) {
            context = beginCell()
                .storeUint(1, 1)
                .storeInt(walletId.context.workchain, 8)
                .storeUint(walletV5R1VersionsSerialisation[walletId.context.walletVersion], 8)
                .storeUint(walletId.context.subwalletNumber, 15)
                .endCell()
                .beginParse()
                .loadInt(32);
        } else {
            context = beginCell()
                .storeUint(0, 1)
                .storeUint(walletId.context, 31)
                .endCell()
                .beginParse()
                .loadInt(32);
        }

        return builder.storeInt(BigInt(walletId.networkGlobalId) ^ BigInt(context), 32);
    };
}
function loadWalletIdV5R1(value: bigint | Buffer | Slice, networkGlobalId: number) {
    const val = new BitReader(
        new BitString(
            typeof value === 'bigint'
                ? Buffer.from(value.toString(16), 'hex')
                : value instanceof Slice
                ? value.loadBuffer(4)
                : value,
            0,
            32
        )
    ).loadInt(32);

    const context = BigInt(val) ^ BigInt(networkGlobalId);

    const bitReader = beginCell().storeInt(context, 32).endCell().beginParse();

    const isClientContext = bitReader.loadUint(1);
    if (isClientContext) {
        const workchain = bitReader.loadInt(8);
        const walletVersionRaw = bitReader.loadUint(8);
        const subwalletNumber = bitReader.loadUint(15);

        const walletVersion = Object.entries(walletV5R1VersionsSerialisation).find(
            ([_, value]) => value === walletVersionRaw
        );

        if (walletVersion === undefined) {
            throw new Error(
                `Can't deserialize walletId: unknown wallet version ${walletVersionRaw}`
            );
        }

        return {
            networkGlobalId,
            context: {
                walletVersion,
                workchain,
                subwalletNumber
            }
        };
    } else {
        throw new Error('Non-client context is not implemented');
    }
}

function storeWalletActions(actions: WalletActions) {
    // store compatable
    return (builder: Builder) => {
        let hasExtendedActions = false;
        if (actions.wallet) {
            let actionCell: Cell | null = null;
            if (actions.wallet instanceof Cell) {
                actionCell = actions.wallet;
            } else if (actions.wallet.length > 0) {
                actionCell = beginCell().store(storeOutList(actions.wallet)).endCell();
            }
            builder.storeMaybeRef(actionCell);
        } else {
            builder.storeBit(false);
        }
        if (actions.extended) {
            if (actions.extended instanceof Cell) {
                builder.storeBit(true);
                builder.storeSlice(actions.extended.asSlice());
            } else if (actions.extended.length > 0) {
                builder.storeBit(true);
                builder.store(storeExtendedActions(actions.extended));
            } else {
                builder.storeBit(false);
            }
        } else {
            builder.storeBit(false);
        }
    };
}

function storeExtensionAction(action: ExtendedAction) {
    return (builder: Builder) => {
        if (action.type == 'add_extension') {
            builder.storeUint(2, 8).storeAddress(action.address);
        } else if (action.type == 'remove_extension') {
            builder.storeUint(3, 8).storeAddress(action.address);
        } else {
            builder.storeUint(4, 8).storeBit(action.allowed);
        }
    };
}

export function storeExtendedActions(actions: ExtendedAction[]) {
    const cell = actions.reverse().reduce((curCell, action) => {
        const ds = beginCell().store(storeExtensionAction(action));
        if (curCell.bits.length > 0) {
            ds.storeRef(curCell);
        }
        return ds.endCell();
    }, beginCell().endCell());

    return (builder: Builder) => builder.storeSlice(cell.beginParse());
}

export function message2action(msg: MessageOut): OutActionSendMsg {
    return {
        type: 'sendMsg',
        mode: msg.mode,
        outMsg: msg.message
    };
}

export type TestWallet = WalletV5Test & WalletV5;

export type WalletV5Config = {
    signatureAllowed: boolean;
    seqno: number;
    walletId: WalletIdV5R1;
    publicKey: Buffer;
    extensions: Dictionary<bigint, bigint>;
};

export function walletV5ConfigToCell(config: WalletV5Config): Cell {
    return beginCell()
        .storeBit(config.signatureAllowed)
        .storeUint(config.seqno, 32)
        .store(storeWalletIdV5R1(config.walletId))
        .storeBuffer(config.publicKey, 32)
        .storeDict(config.extensions, Dictionary.Keys.BigUint(256), Dictionary.Values.BigInt(1))
        .endCell();
}

// Just a hack to work around WalletV5 private constructor
export function TestWalletFromV5(wallet: WalletV5) {
    const mockWallet = new WalletV5Test(wallet.address);
    return new Proxy(wallet as any, {
        get(target, prop) {
            const value = target[prop];
            // First try base wallet contract
            if (typeof value == 'function') {
                return (...args: any[]) => value.apply(target, [...args]);
            } else if (value !== undefined) {
                return value;
            } else {
                // Otherwise check against TestWallet functions
                if (typeof prop == 'string') {
                    if (prop == 'sendMessagesExternal') {
                        const value = mockWallet[prop];
                        return (...args: Parameters<WalletV5Test['sendMessagesExternal']>) =>
                            value.apply(mockWallet, [...args]);
                    }
                    if (prop == 'sendExtensionActions') {
                        const value = mockWallet[prop];
                        return (...args: Parameters<WalletV5Test['sendExtensionActions']>) =>
                            value.apply(mockWallet, [...args]);
                    }
                    if (prop == 'sendMessagesInternal') {
                        const value = mockWallet[prop];
                        return (...args: Parameters<WalletV5Test['sendMessagesInternal']>) =>
                            value.apply(mockWallet, [...args]);
                    }
                    if (prop == 'sendInternalSignedMessage') {
                        const value = mockWallet[prop];
                        return (...args: Parameters<WalletV5Test['sendInternalSignedMessage']>) =>
                            value.apply(mockWallet, [...args]);
                    }
                    if (prop == 'sendInternalMessageFromExtension') {
                        const value = mockWallet[prop];
                        return (
                            ...args: Parameters<WalletV5Test['sendInternalMessageFromExtension']>
                        ) => value.apply(mockWallet, [...args]);
                    }
                    if (prop == 'getWalletId') {
                        const value = mockWallet[prop];
                        return (...args: Parameters<WalletV5Test['getWalletId']>) =>
                            value.apply(mockWallet, [...args]);
                    }
                    if (prop == 'getWalletIdParsed') {
                        const value = mockWallet[prop];
                        return (...args: Parameters<WalletV5Test['getWalletIdParsed']>) =>
                            value.apply(mockWallet, [...args]);
                    }
                    if (prop == 'getPublicKey') {
                        const value = mockWallet[prop];
                        return (...args: Parameters<WalletV5Test['getPublicKey']>) =>
                            value.apply(mockWallet, [...args]);
                    }
                    // throw new Error(`Invalid property ${prop}`);
                }
            }
        }
    }) as TestWallet;
}

export class WalletV5Test {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromConfig(config: WalletV5Config, code: Cell, workchain = 0) {
        const data = walletV5ConfigToCell(config);
        const init = { code, data };
        return new WalletV5Test(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell()
        });
    }

    static requestMessage(
        internal: boolean,
        wallet_id: number,
        valid_until: number,
        seqno: bigint | number,
        actions: WalletActions,
        key?: Buffer
    ) {
        const op = internal ? Opcodes.auth_signed_internal : Opcodes.auth_signed;
        const msgBody = beginCell()
            .storeUint(op, 32)
            .storeUint(wallet_id, 32)
            .storeUint(valid_until, 32)
            .storeUint(seqno, 32)
            .store(storeWalletActions(actions))
            .endCell();
        return key ? WalletV5Test.signRequestMessage(msgBody, key) : msgBody;
    }

    static signRequestMessage(msg: Cell, key: Buffer) {
        const signature = sign(msg.hash(), key);

        return beginCell().storeSlice(msg.asSlice()).storeBuffer(signature).endCell();
    }

    async sendMessagesExternal(
        provider: ContractProvider,
        wallet_id: number,
        valid_until: number,
        seqno: bigint | number,
        key: Buffer,
        messages: MessageOut[]
    ) {
        const actions: OutActionSendMsg[] = messages.map(message2action);

        await provider.external(
            WalletV5Test.requestMessage(
                false,
                wallet_id,
                valid_until,
                seqno,
                { wallet: actions },
                key
            )
        );
    }

    static extensionMessage(actions: WalletActions, query_id: bigint | number = 0) {
        return beginCell()
            .storeUint(Opcodes.auth_extension, 32)
            .storeUint(query_id, 64)
            .store(storeWalletActions(actions))
            .endCell();
    }
    async sendExtensionActions(
        provider: ContractProvider,
        via: Sender,
        actions: WalletActions,
        value: bigint = toNano('0.1'),
        query_id: bigint | number = 0
    ) {
        await provider.internal(via, {
            value,
            body: WalletV5Test.extensionMessage(actions, query_id),
            sendMode: SendMode.PAY_GAS_SEPARATELY
        });
    }

    async sendMessagesInternal(
        provider: ContractProvider,
        via: Sender,
        wallet_id: number,
        valid_until: number,
        seqno: bigint | number,
        key: Buffer,
        messages: MessageOut[],
        value: bigint = toNano('0.05')
    ) {
        const actions: OutActionSendMsg[] = messages.map(message2action);

        await provider.internal(via, {
            value,
            body: WalletV5Test.requestMessage(
                true,
                wallet_id,
                valid_until,
                seqno,
                { wallet: actions },
                key
            ),
            sendMode: SendMode.PAY_GAS_SEPARATELY
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
            body: beginCell().storeSlice(opts.body.beginParse()).endCell()
        });
    }
    async sendInternalMessageFromExtension(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            body: Cell;
            queryId?: bigint | number;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.auth_extension, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeSlice(opts.body.asSlice())
                .endCell()
        });
    }

    async getWalletId(provider: ContractProvider) {
        const result = await provider.get('get_subwallet_id', []);
        return result.stack.readNumber();
    }

    async getWalletIdParsed(provider: ContractProvider, networkId: -239 | -3 = -239) {
        const result = await provider.get('get_subwallet_id', []);

        const walletId = result.stack.readBigNumber();
        return loadWalletIdV5R1(walletId, networkId);
    }

    async getPublicKey(provider: ContractProvider) {
        const result = await provider.get('get_public_key', []);
        return result.stack.readBigNumber();
    }

    async getSeqno(provider: ContractProvider) {
        const result = await provider.get('seqno', []);
        return result.stack.readNumber();
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
            Dictionary.Values.BigInt(1),
            extensions
        );

        return dict.keys().map(key => {
            const wc = this.address.workChain;
            const addressHex = key;
            return Address.parseRaw(`${wc}:${addressHex.toString(16).padStart(64, '0')}`);
        });
    }
}
