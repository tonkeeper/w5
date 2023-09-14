import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Address, beginCell, Cell, Dictionary, Sender, SendMode, toNano } from 'ton-core';
import { Opcodes, WalletV5 } from '../wrappers/WalletV5';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { getSecureRandomBytes, KeyPair, keyPairFromSeed, sign } from 'ton-crypto';
import { bufferToBigInt, createMsgInternal, packAddress, validUntil } from './utils';
import { ActionAddExtension, ActionSendMsg, ActionSetData, packActionsList } from './actions';

const SUBWALLET_ID = 20230823 + 0;

describe('Wallet_V5_3', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Wallet_V5_3');
    });

    let blockchain: Blockchain;
    let walletV5: SandboxContract<WalletV5>;
    let keypair: KeyPair;
    let sender: Sender;
    let seqno: number;

    async function deploy(params?: Partial<Parameters<typeof WalletV5.createFromConfig>[0]>) {
        blockchain = await Blockchain.create();
        if (!params?.publicKey) {
            keypair = keyPairFromSeed(await getSecureRandomBytes(32));
        }

        walletV5 = blockchain.openContract(
            WalletV5.createFromConfig(
                {
                    seqno: params?.seqno ?? 0,
                    subwallet: params?.subwallet ?? SUBWALLET_ID,
                    publicKey: params?.publicKey ?? keypair.publicKey,
                    extensions: params?.extensions ?? Dictionary.empty()
                },
                code
            )
        );

        const deployer = await blockchain.treasury('deployer');
        sender = deployer.getSender();

        const deployResult = await walletV5.sendDeploy(sender, toNano('0.05'));
        return { deployer, deployResult };
    }

    async function deployOtherWallet(
        params?: Partial<Parameters<typeof WalletV5.createFromConfig>[0]>
    ) {
        const _keypair = keyPairFromSeed(await getSecureRandomBytes(32));

        const _walletV5 = blockchain.openContract(
            WalletV5.createFromConfig(
                {
                    seqno: params?.seqno ?? 0,
                    subwallet: params?.subwallet ?? SUBWALLET_ID,
                    publicKey: params?.publicKey ?? _keypair.publicKey,
                    extensions: params?.extensions ?? Dictionary.empty()
                },
                code
            )
        );

        const deployer = await blockchain.treasury('deployer');
        const _sender = deployer.getSender();

        const deployResult = await _walletV5.sendDeploy(_sender, toNano('0.05'));
        return { sender: _sender, walletV5: _walletV5, keypair: _keypair, deployer, deployResult };
    }

    function createBody(actionsList: Cell) {
        const payload = beginCell()
            .storeUint(SUBWALLET_ID, 32)
            .storeUint(validUntil(), 32)
            .storeUint(seqno, 32) // seqno
            .storeSlice(actionsList.beginParse())
            .endCell();

        const signature = sign(payload.hash(), keypair.secretKey);
        return beginCell()
            .storeUint(bufferToBigInt(signature), 512)
            .storeSlice(payload.beginParse())
            .endCell();
    }

    beforeEach(async () => {
        const { deployer, deployResult } = await deploy();

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: walletV5.address,
            deploy: true,
            success: true
        });

        seqno = 0;
    });

    it('should deploy', async () => {});

    it('Get seqno', async () => {
        const expectedSeqno = 12345;
        await deploy({ seqno: expectedSeqno });
        const actualSeqno = await walletV5.getSeqno();
        expect(expectedSeqno).toEqual(actualSeqno);
    });

    it('Get pubkey', async () => {
        const actualPubkey = await walletV5.getPublicKey();
        expect(actualPubkey).toEqual(bufferToBigInt(keypair.publicKey));
    });

    it('Get subwallet id', async () => {
        const expectedSubWalletId = 20230824;
        await deploy({ subwallet: expectedSubWalletId });
        const actualSubWalletId = await walletV5.getSubWalletID();
        expect(expectedSubWalletId).toEqual(actualSubWalletId);
    });

    it('Get extensions dict', async () => {
        const plugin1 = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const plugin2 = Address.parse('Ef82pT4d8T7TyRsjW2BpGpGYga-lMA4JjQb4D2tc1PXMX28X');

        const extensions: Dictionary<bigint, bigint> = Dictionary.empty(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8)
        );
        extensions.set(packAddress(plugin1), BigInt(plugin1.workChain));
        extensions.set(packAddress(plugin2), BigInt(plugin2.workChain));

        await deploy({ extensions });

        const actual = await walletV5.getExtensions();
        const expected = beginCell()
            .storeDictDirect(extensions, Dictionary.Keys.BigUint(256), Dictionary.Values.BigInt(8))
            .endCell();
        expect(actual.equals(expected)).toBeTruthy();
    });

    it('Send a simple transfer', async () => {
        const testReceiver = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue = toNano(0.001);

        const receiverBalanceBefore = (await blockchain.getContract(testReceiver)).balance;

        const sendTxMsg = beginCell()
            .storeUint(0x10, 6)
            .storeAddress(testReceiver)
            .storeCoins(forwardValue)
            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(beginCell().endCell())
            .endCell();

        const sendTxactionAction = beginCell()
            .storeUint(Opcodes.action_send_msg, 32)
            .storeInt(SendMode.PAY_GAS_SEPARATELY, 8)
            .storeRef(sendTxMsg)
            .endCell();

        const actionsList = beginCell()
            .storeUint(0, 1)
            .storeRef(
                beginCell()
                    .storeRef(beginCell().endCell())
                    .storeSlice(sendTxactionAction.beginParse())
                    .endCell()
            )
            .endCell();

        const receipt = await walletV5.sendInternalSignedMessage(sender, {
            value: toNano(0.1),
            body: createBody(actionsList)
        });

        expect(receipt.transactions.length).toEqual(3);

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver,
            value: forwardValue
        });

        const fee = receipt.transactions[2].totalFees.coins;

        const receiverBalanceAfter = (await blockchain.getContract(testReceiver)).balance;
        expect(receiverBalanceAfter).toEqual(receiverBalanceBefore + forwardValue - fee);
    });

    it('Add an extension', async () => {
        const testExtension = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');

        const addExtensionAction = beginCell()
            .storeUint(Opcodes.action_extended_add_extension, 32)
            .storeAddress(testExtension)
            .endCell();

        const actionsList = beginCell()
            .storeUint(1, 1)
            .storeRef(beginCell().storeUint(0, 1).storeRef(beginCell().endCell()).endCell())
            .storeSlice(addExtensionAction.beginParse())
            .endCell();

        const receipt = await walletV5.sendInternalSignedMessage(sender, {
            value: toNano(0.1),
            body: createBody(actionsList)
        });

        expect(receipt.transactions.length).toEqual(2);

        const extensions = await walletV5.getExtensions();
        const extensionsDict = Dictionary.loadDirect(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8),
            extensions
        );

        expect(extensionsDict.size).toEqual(1);

        const storedWC = extensionsDict.get(packAddress(testExtension));
        expect(storedWC).toEqual(BigInt(testExtension.workChain));
    });

    it('Send two transfers', async () => {
        const testReceiver1 = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue1 = toNano(0.001);

        const { walletV5: testReceiver2Wallet } = await deployOtherWallet();

        const testReceiver2 = testReceiver2Wallet.address;
        const forwardValue2 = toNano(0.002);

        const receiver1BalanceBefore = (await blockchain.getContract(testReceiver1)).balance;
        const receiver2BalanceBefore = (await blockchain.getContract(testReceiver2)).balance;

        const msg1 = createMsgInternal({ dest: testReceiver1, value: forwardValue1 });
        const msg2 = createMsgInternal({ dest: testReceiver2, value: forwardValue2, bounce: true });

        const actionsList = packActionsList([
            new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg1),
            new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg2)
        ]);

        const receipt = await walletV5.sendInternalSignedMessage(sender, {
            value: toNano(0.1),
            body: createBody(actionsList)
        });

        expect(receipt.transactions.length).toEqual(4);

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver1,
            value: forwardValue1
        });

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver2,
            value: forwardValue2
        });

        const fee1 = receipt.transactions[2].totalFees.coins;
        const fee2 = receipt.transactions[3].totalFees.coins;

        const receiver1BalanceAfter = (await blockchain.getContract(testReceiver1)).balance;
        const receiver2BalanceAfter = (await blockchain.getContract(testReceiver2)).balance;

        expect(receiver1BalanceAfter).toEqual(receiver1BalanceBefore + forwardValue1 - fee1);
        expect(receiver2BalanceAfter).toEqual(receiver2BalanceBefore + forwardValue2 - fee2);
    });

    it('Add two extensions and do a transfer', async () => {
        const testExtension1 = Address.parse('Ef82pT4d8T7TyRsjW2BpGpGYga-lMA4JjQb4D2tc1PXMX28X');
        const testExtension2 = Address.parse('EQCgYDKqfTh7zVj9BQwOIPs4SuOhM7wnIjb6bdtM2AJf_Z9G');

        const testReceiver = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue = toNano(0.001);

        const receiverBalanceBefore = (await blockchain.getContract(testReceiver)).balance;

        const msg = createMsgInternal({ dest: testReceiver, value: forwardValue });

        const actionsList = packActionsList([
            new ActionAddExtension(testExtension1),
            new ActionAddExtension(testExtension2),
            new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg)
        ]);

        const receipt = await walletV5.sendInternalSignedMessage(sender, {
            value: toNano(0.1),
            body: createBody(actionsList)
        });

        expect(receipt.transactions.length).toEqual(3);

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver,
            value: forwardValue
        });

        const fee = receipt.transactions[2].totalFees.coins;
        const receiverBalanceAfter = (await blockchain.getContract(testReceiver)).balance;
        expect(receiverBalanceAfter).toEqual(receiverBalanceBefore + forwardValue - fee);

        const extensionsDict = Dictionary.loadDirect(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8),
            await walletV5.getExtensions()
        );

        expect(extensionsDict.size).toEqual(2);

        expect(extensionsDict.get(packAddress(testExtension1))).toEqual(
            BigInt(testExtension1.workChain)
        );
        expect(extensionsDict.get(packAddress(testExtension2))).toEqual(
            BigInt(testExtension2.workChain)
        );
    });

    it('Set data and do two transfers', async () => {
        const testReceiver1 = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue1 = toNano(0.001);

        const testReceiver2 = Address.parse('EQCgYDKqfTh7zVj9BQwOIPs4SuOhM7wnIjb6bdtM2AJf_Z9G');
        const forwardValue2 = toNano(0.0012);

        const receiver1BalanceBefore = (await blockchain.getContract(testReceiver1)).balance;
        const receiver2BalanceBefore = (await blockchain.getContract(testReceiver2)).balance;

        const msg1 = createMsgInternal({ dest: testReceiver1, value: forwardValue1 });
        const msg2 = createMsgInternal({ dest: testReceiver2, value: forwardValue2 });

        const actionsList = packActionsList([
            new ActionSetData(beginCell().storeUint(239, 32).endCell()),
            new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg1),
            new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg2)
        ]);

        const receipt = await walletV5.sendInternalSignedMessage(sender, {
            value: toNano(0.1),
            body: createBody(actionsList)
        });

        expect(receipt.transactions.length).toEqual(4);

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver1,
            value: forwardValue1
        });

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver2,
            value: forwardValue2
        });

        const fee1 = receipt.transactions[2].totalFees.coins;
        const fee2 = receipt.transactions[3].totalFees.coins;

        const receiver1BalanceAfter = (await blockchain.getContract(testReceiver1)).balance;
        const receiver2BalanceAfter = (await blockchain.getContract(testReceiver2)).balance;
        expect(receiver1BalanceAfter).toEqual(receiver1BalanceBefore + forwardValue1 - fee1);
        expect(receiver2BalanceAfter).toEqual(receiver2BalanceBefore + forwardValue2 - fee2);

        const storedSeqno = await walletV5.getSeqno();
        expect(storedSeqno).toEqual(239);
    });

    it('Set data and do two transfers', async () => {
        const testReceiver1 = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue1 = toNano(0.001);

        const testReceiver2 = Address.parse('EQCgYDKqfTh7zVj9BQwOIPs4SuOhM7wnIjb6bdtM2AJf_Z9G');
        const forwardValue2 = toNano(0.0012);

        const receiver1BalanceBefore = (await blockchain.getContract(testReceiver1)).balance;
        const receiver2BalanceBefore = (await blockchain.getContract(testReceiver2)).balance;

        const msg1 = createMsgInternal({ dest: testReceiver1, value: forwardValue1 });
        const msg2 = createMsgInternal({ dest: testReceiver2, value: forwardValue2 });

        const actionsList = packActionsList([
            new ActionSetData(beginCell().storeUint(239, 32).endCell()),
            new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg1),
            new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg2)
        ]);

        const receipt = await walletV5.sendInternalSignedMessage(sender, {
            value: toNano(0.1),
            body: createBody(actionsList)
        });

        expect(receipt.transactions.length).toEqual(4);

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver1,
            value: forwardValue1
        });

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver2,
            value: forwardValue2
        });

        const fee1 = receipt.transactions[2].totalFees.coins;
        const fee2 = receipt.transactions[3].totalFees.coins;

        const receiver1BalanceAfter = (await blockchain.getContract(testReceiver1)).balance;
        const receiver2BalanceAfter = (await blockchain.getContract(testReceiver2)).balance;
        expect(receiver1BalanceAfter).toEqual(receiver1BalanceBefore + forwardValue1 - fee1);
        expect(receiver2BalanceAfter).toEqual(receiver2BalanceBefore + forwardValue2 - fee2);

        const storedSeqno = await walletV5.getSeqno();
        expect(storedSeqno).toEqual(239);
    });

    it('Send 255 transfers and do set data', async () => {
        const range = [...new Array(255)].map((_, index) => index);

        const receivers = range.map(i => Address.parseRaw('0:' + i.toString().padStart(64, '0')));
        const balancesBefore = (
            await Promise.all(receivers.map(r => blockchain.getContract(r)))
        ).map(i => i.balance);

        const forwardValues = range.map(i => BigInt(toNano(0.0001 * i)));

        const msges = receivers.map((dest, i) =>
            createMsgInternal({ dest: dest, value: forwardValues[i] })
        );

        const actionsList = packActionsList([
            new ActionSetData(beginCell().storeUint(239, 32).endCell()),
            ...msges.map(msg => new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg))
        ]);

        const receipt = await walletV5.sendInternalSignedMessage(sender, {
            value: toNano(10),
            body: createBody(actionsList)
        });

        expect(receipt.transactions.length).toEqual(range.length + 2);

        receivers.forEach((to, i) => {
            expect(receipt.transactions).toHaveTransaction({
                from: walletV5.address,
                to,
                value: forwardValues[i]
            });
        });

        const balancesAfter = (
            await Promise.all(receivers.map(r => blockchain.getContract(r)))
        ).map(i => i.balance);

        const fees = receipt.transactions.slice(2).map(tx => tx.totalFees.coins);

        balancesAfter.forEach((balanceAfter, i) => {
            expect(balanceAfter).toEqual(balancesBefore[i] + forwardValues[i] - fees[i]);
        });

        const storedSeqno = await walletV5.getSeqno();
        expect(storedSeqno).toEqual(239);
    });
});
