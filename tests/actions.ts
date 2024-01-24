import {
    Address,
    beginCell,
    Cell,
    CurrencyCollection,
    MessageRelaxed,
    SendMode,
    storeMessageRelaxed,
    storeCurrencyCollection
} from 'ton-core';

export type LibRef = Cell | bigint;

export class ActionSendMsg {
    public static readonly tag = 0x0ec3c86d;

    public readonly tag = ActionSendMsg.tag;

    constructor(public readonly mode: SendMode, public readonly outMsg: MessageRelaxed) {}

    public serialize(): Cell {
        return beginCell()
            .storeUint(this.tag, 32)
            .storeUint(this.mode | SendMode.IGNORE_ERRORS, 8)
            .storeRef(beginCell().store(storeMessageRelaxed(this.outMsg)).endCell())
            .endCell();
    }
}

export class ActionSetCode {
    public static readonly tag = 0xad4de08e;

    public readonly tag = ActionSetCode.tag;

    constructor(public readonly newCode: Cell) {}

    public serialize(): Cell {
        return beginCell().storeUint(this.tag, 32).storeRef(this.newCode).endCell();
    }
}

export class ActionReserveCurrency {
    public static readonly tag = 0x36e6b809;

    public readonly tag = ActionReserveCurrency.tag;

    constructor(public readonly mode: SendMode, public readonly currency: CurrencyCollection) {}

    public serialize(): Cell {
        return beginCell()
            .storeUint(this.tag, 32)
            .storeUint(this.mode, 8)
            .store(storeCurrencyCollection(this.currency))
            .endCell();
    }
}

export class ActionChangeLibrary {
    public static readonly tag = 0x26fa1dd4;

    public readonly tag = ActionChangeLibrary.tag;

    constructor(public readonly mode: number, public readonly libRef: LibRef) {}

    public serialize(): Cell {
        const cell = beginCell().storeUint(this.tag, 32).storeUint(this.mode, 7);
        if (typeof this.libRef === 'bigint') {
            return cell.storeUint(0, 1).storeUint(this.libRef, 256).endCell();
        }

        return cell.storeUint(1, 1).storeRef(this.libRef).endCell();
    }
}

export class ActionSetData {
    public static readonly tag = 0x1ff8ea0b;

    public readonly tag = ActionSetData.tag;

    constructor(public readonly data: Cell) {}

    public serialize(): Cell {
        return beginCell().storeUint(this.tag, 32).storeRef(this.data).endCell();
    }
}

export class ActionAddExtension {
    public static readonly tag = 0x1c40db9f;

    public readonly tag = ActionAddExtension.tag;

    constructor(public readonly address: Address) {}

    public serialize(): Cell {
        return beginCell().storeUint(this.tag, 32).storeAddress(this.address).endCell();
    }
}

export class ActionRemoveExtension {
    public static readonly tag = 0x5eaef4a4;

    public readonly tag = ActionRemoveExtension.tag;

    constructor(public readonly address: Address) {}

    public serialize(): Cell {
        return beginCell().storeUint(this.tag, 32).storeAddress(this.address).endCell();
    }
}

export type OutAction = ActionSendMsg | ActionSetCode | ActionReserveCurrency | ActionChangeLibrary;
export type ExtendedAction = ActionSetData | ActionAddExtension | ActionRemoveExtension;

export function isExtendedAction(action: OutAction | ExtendedAction): action is ExtendedAction {
    return (
        action.tag === ActionSetData.tag ||
        action.tag === ActionAddExtension.tag ||
        action.tag === ActionRemoveExtension.tag
    );
}

function packActionsListOut(actions: (OutAction | ExtendedAction)[]): Cell {
    if (actions.length === 0) {
        return beginCell().endCell();
    }

    const [action, ...rest] = actions;

    if (isExtendedAction(action)) {
        throw new Error('Actions bust be in an order: all extended actions, all out actions');
    }

    return beginCell()
        .storeRef(packActionsListOut(rest))
        .storeSlice(action.serialize().beginParse())
        .endCell();
}

function packActionsListExtended(actions: (OutAction | ExtendedAction)[]): Cell {
    const [action, ...rest] = actions;

    if (!action || !isExtendedAction(action)) {
        return beginCell()
            .storeUint(0, 1)
            .storeRef(packActionsListOut(actions.slice().reverse())) // tvm handles actions from c5 in reversed order
            .endCell();
    }

    return beginCell()
        .storeUint(1, 1)
        .storeSlice(action.serialize().beginParse())
        .storeRef(packActionsListExtended(rest))
        .endCell();
}

export function packActionsList(actions: (OutAction | ExtendedAction)[]): Cell {
    return packActionsListExtended(actions);
}
