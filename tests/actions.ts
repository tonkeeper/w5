import { Address, beginCell, Cell, MessageRelaxed, SendMode, storeMessageRelaxed } from 'ton-core';
import { isTestOnlyExtendedAction, TestOnlyExtendedAction, TestOnlyOutAction } from './test-only-actions';

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

export class ActionAddExtension {
    public static readonly tag = 0x02;

    public readonly tag = ActionAddExtension.tag;

    constructor(public readonly address: Address) {}

    public serialize(): Cell {
        return beginCell().storeUint(this.tag, 8).storeAddress(this.address).endCell();
    }
}

export class ActionRemoveExtension {
    public static readonly tag = 0x03;

    public readonly tag = ActionRemoveExtension.tag;

    constructor(public readonly address: Address) {}

    public serialize(): Cell {
        return beginCell().storeUint(this.tag, 8).storeAddress(this.address).endCell();
    }
}

export class ActionSetSignatureAuthAllowed {
    public static readonly tag = 0x04;

    public readonly tag = ActionSetSignatureAuthAllowed.tag;

    constructor(public readonly allowed: Boolean) {}

    public serialize(): Cell {
        return beginCell()
            .storeUint(this.tag, 8)
            .storeUint(this.allowed ? 1 : 0, 1)
            .endCell();
    }
}

export type OutAction = ActionSendMsg | TestOnlyOutAction;
export type ExtendedAction =
    | ActionAddExtension
    | ActionRemoveExtension
    | ActionSetSignatureAuthAllowed
    | TestOnlyExtendedAction;

export function isExtendedAction(action: OutAction | ExtendedAction): action is ExtendedAction {
    return (
        action.tag === ActionAddExtension.tag ||
        action.tag === ActionRemoveExtension.tag ||
        action.tag === ActionSetSignatureAuthAllowed.tag ||
        isTestOnlyExtendedAction(action)
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
