import {Blockchain, BlockchainTransaction, SandboxContract} from '@ton-community/sandbox';
import { Address, beginCell, Cell, Dictionary, internal, Sender, SendMode, toNano } from 'ton-core';
import { Opcodes, WalletId, WalletV5 } from '../wrappers/wallet-v5';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { getSecureRandomBytes, KeyPair, keyPairFromSeed, sign } from 'ton-crypto';
import {
    bufferToBigInt,
    createMsgInternal,
    disableConsoleError,
    packAddress,
    validUntil
} from './utils';
import {
    ActionAddExtension,
    ActionRemoveExtension,
    ActionSendMsg,
    ActionSetCode,
    ActionSetData,
    packActionsList
} from './actions';
import { WalletV4 } from '../wrappers/wallet-v4';
import { TransactionDescriptionGeneric } from 'ton-core/src/types/TransactionDescription';
import { TransactionComputeVm } from 'ton-core/src/types/TransactionComputePhase';
import { buildBlockchainLibraries, LibraryDeployer } from '../wrappers/library-deployer';

const WALLET_ID = new WalletId({ networkGlobalId: -239, workChain: -1, subwalletNumber: 0 });

describe('Wallet V5 sign auth external', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('wallet_v5');
    });

    let blockchain: Blockchain;
    let walletV5: SandboxContract<WalletV5>;
    let keypair: KeyPair;
    let sender: Sender;
    let seqno: number;

    let ggc: bigint = BigInt(0);
    function accountForGas(transactions: BlockchainTransaction[]) {
        transactions.forEach((tx) => {
            ggc += ((tx?.description as TransactionDescriptionGeneric)?.computePhase as TransactionComputeVm)?.gasUsed ?? BigInt(0);
        })
    }

    afterAll(async() => {
        console.log("EXTERNAL TESTS: Total gas " + ggc);
    });

    async function deployOtherWallet(
        params?: Partial<Parameters<typeof WalletV5.createFromConfig>[0]>
    ) {
        const _keypair = keyPairFromSeed(await getSecureRandomBytes(32));

        const _walletV5 = blockchain.openContract(
            WalletV5.createFromConfig(
                {
                    seqno: params?.seqno ?? 0,
                    walletId: params?.walletId ?? WALLET_ID.serialized,
                    publicKey: params?.publicKey ?? _keypair.publicKey,
                    extensions: params?.extensions ?? Dictionary.empty()
                },
                LibraryDeployer.exportLibCode(code)
            )
        );

        const deployer = await blockchain.treasury('deployer');
        const _sender = deployer.getSender();

        const deployResult = await _walletV5.sendDeploy(_sender, toNano('0.05'));
        return { sender: _sender, walletV5: _walletV5, keypair: _keypair, deployer, deployResult };
    }

    function createBody(actionsList: Cell) {
        const payload = beginCell()
            .storeUint(WALLET_ID.serialized, 80)
            .storeUint(validUntil(), 32)
            .storeUint(seqno, 32) // seqno
            .storeSlice(actionsList.beginParse())
            .endCell();

        const signature = sign(payload.hash(), keypair.secretKey);
        seqno++;
        return beginCell()
            .storeUint(bufferToBigInt(signature), 512)
            .storeSlice(payload.beginParse())
            .endCell();
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.libs = buildBlockchainLibraries([code]);

        keypair = keyPairFromSeed(await getSecureRandomBytes(32));

        walletV5 = blockchain.openContract(
            WalletV5.createFromConfig(
                {
                    seqno: 0,
                    walletId: WALLET_ID.serialized,
                    publicKey: keypair.publicKey,
                    extensions: Dictionary.empty()
                },
                LibraryDeployer.exportLibCode(code)
            )
        );

        const deployer = await blockchain.treasury('deployer');
        sender = deployer.getSender();

        const deployResult = await walletV5.sendDeploy(sender, toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: walletV5.address,
            deploy: true,
            success: true
        });

        seqno = 0;
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

        blockchain.verbosity = { ...blockchain.verbosity, blockchainLogs: true, vmLogs: 'vm_logs_gas', debugLogs: true, print: true }

        const receipt = await walletV5.sendExternalSignedMessage(createBody(actionsList));

        blockchain.verbosity = { ...blockchain.verbosity, blockchainLogs: false, vmLogs: 'none', debugLogs: false, print: false }

        expect(receipt.transactions.length).toEqual(2);
        accountForGas(receipt.transactions);

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver,
            value: forwardValue
        });

        const fee = receipt.transactions[1].totalFees.coins;
        console.debug(
            'SINGLE EXTERNAL TRANSFER GAS USED:',
            (
                (receipt.transactions[0].description as TransactionDescriptionGeneric)
                    .computePhase as TransactionComputeVm
            ).gasUsed
        );

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

        const receipt = await walletV5.sendExternalSignedMessage(createBody(actionsList));

        expect(receipt.transactions.length).toEqual(1);
        accountForGas(receipt.transactions);

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

    it('Send single transfers to a deployed wallet', async () => {
        const forwardValue = toNano(0.001);

        const { walletV5: receiver } = await deployOtherWallet();

        const receiverBalanceBefore = (await blockchain.getContract(receiver.address)).balance;

        const msg = internal({ to: receiver.address, value: forwardValue });

        const actionsList = packActionsList([new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg)]);

        const receipt = await walletV5.sendExternalSignedMessage(createBody(actionsList));

        expect(receipt.transactions.length).toEqual(2);
        accountForGas(receipt.transactions);

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: receiver.address,
            value: forwardValue
        });

        const fee = receipt.transactions[1].totalFees.coins;

        const receiverBalanceAfter = (await blockchain.getContract(receiver.address)).balance;

        expect(receiverBalanceAfter).toEqual(receiverBalanceBefore + forwardValue - fee);
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

        const receipt = await walletV5.sendExternalSignedMessage(createBody(actionsList));

        expect(receipt.transactions.length).toEqual(3);
        accountForGas(receipt.transactions);

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

        const fee1 = receipt.transactions[1].totalFees.coins;
        const fee2 = receipt.transactions[2].totalFees.coins;

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

        const receipt = await walletV5.sendExternalSignedMessage(createBody(actionsList));

        expect(receipt.transactions.length).toEqual(2);
        accountForGas(receipt.transactions);

        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver,
            value: forwardValue
        });

        const fee = receipt.transactions[1].totalFees.coins;
        const receiverBalanceAfter = (await blockchain.getContract(testReceiver)).balance;
        expect(receiverBalanceAfter).toEqual(receiverBalanceBefore + forwardValue - fee);

        const extensionsDict = Dictionary.loadDirect(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8),
            await walletV5.getExtensions()
        );

        expect(extensionsDict.size).toEqual(2);
        accountForGas(receipt.transactions);

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

        const receipt = await walletV5.sendExternalSignedMessage(createBody(actionsList));

        expect(receipt.transactions.length).toEqual(3);
        accountForGas(receipt.transactions);

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

        const fee1 = receipt.transactions[1].totalFees.coins;
        const fee2 = receipt.transactions[2].totalFees.coins;

        const receiver1BalanceAfter = (await blockchain.getContract(testReceiver1)).balance;
        const receiver2BalanceAfter = (await blockchain.getContract(testReceiver2)).balance;
        expect(receiver1BalanceAfter).toEqual(receiver1BalanceBefore + forwardValue1 - fee1);
        expect(receiver2BalanceAfter).toEqual(receiver2BalanceBefore + forwardValue2 - fee2);

        const storedSeqno = await walletV5.getSeqno();
        expect(storedSeqno).toEqual(239);
    });

    it('Send 255 transfers and do set data', async () => {
        await (
            await blockchain.treasury('mass-messages')
        ).send({ to: walletV5.address, value: toNano(100) });

        const range = [...new Array(255)].map((_, index) => index);

        const receivers = range.map(i => Address.parseRaw('0:' + i.toString().padStart(64, '0')));
        const balancesBefore = (
            await Promise.all(receivers.map(r => blockchain.getContract(r)))
        ).map(i => i.balance);

        const forwardValues = range.map(i => BigInt(toNano(0.000001 * i)));

        const msges = receivers.map((dest, i) =>
            createMsgInternal({ dest: dest, value: forwardValues[i] })
        );

        const actionsList = packActionsList([
            new ActionSetData(beginCell().storeUint(239, 32).endCell()),
            ...msges.map(msg => new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg))
        ]);

        const receipt = await walletV5.sendExternalSignedMessage(createBody(actionsList));

        expect(receipt.transactions.length).toEqual(range.length + 1);
        accountForGas(receipt.transactions);

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

        const fees = receipt.transactions.slice(1).map(tx => tx.totalFees.coins);

        balancesAfter.forEach((balanceAfter, i) => {
            expect(balanceAfter).toEqual(balancesBefore[i] + forwardValues[i] - fees[i]);
        });

        const storedSeqno = await walletV5.getSeqno();
        expect(storedSeqno).toEqual(239);
    });

    it('Remove extension', async () => {
        const testExtension = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');

        const actionsList1 = packActionsList([new ActionAddExtension(testExtension)]);
        const receipt1 = await walletV5.sendExternalSignedMessage(createBody(actionsList1));
        const extensionsDict1 = Dictionary.loadDirect(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8),
            await walletV5.getExtensions()
        );
        expect(extensionsDict1.size).toEqual(1);
        expect(extensionsDict1.get(packAddress(testExtension))).toEqual(
            BigInt(testExtension.workChain)
        );

        const actionsList2 = packActionsList([new ActionRemoveExtension(testExtension)]);
        const receipt2 = await walletV5.sendExternalSignedMessage(createBody(actionsList2));
        const extensionsDict2 = Dictionary.loadDirect(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8),
            await walletV5.getExtensions()
        );

        expect(extensionsDict2.size).toEqual(0);
        expect(extensionsDict2.get(packAddress(testExtension))).toEqual(undefined);

        accountForGas(receipt1.transactions);
        accountForGas(receipt2.transactions);
    });

    it('Change code and data to wallet v4', async () => {
        const code_v4 = await compile('wallet_v4');
        const data_v4 = beginCell()
            .storeUint(0, 32)
            .storeUint(0, 32)
            .storeBuffer(keypair.publicKey, 32)
            .storeDict(Dictionary.empty())
            .endCell();

        const actionsList = packActionsList([
            new ActionSetData(data_v4),
            new ActionSetCode(code_v4)
        ]);
        const receipt1 = await walletV5.sendExternalSignedMessage(createBody(actionsList));
        accountForGas(receipt1.transactions);

        const walletV4 = blockchain.openContract(WalletV4.createFromAddress(walletV5.address));
        const seqno = await walletV4.getSeqno();
        const subwalletId = await walletV4.getSubWalletID();
        const publicKey = await walletV4.getPublicKey();
        const extensions = Dictionary.loadDirect(
            Dictionary.Keys.Address(),
            Dictionary.Values.BigInt(0),
            await walletV4.getExtensions()
        );

        expect(seqno).toEqual(0);
        expect(subwalletId).toEqual(0);
        expect(publicKey).toEqual(bufferToBigInt(keypair.publicKey));
        expect(extensions.size).toEqual(0);

        const testReceiver = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue = toNano(0.001);

        const sendTxMsg = beginCell()
            .storeUint(0x10, 6)
            .storeAddress(testReceiver)
            .storeCoins(forwardValue)
            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(beginCell().endCell())
            .endCell();

        const mesagesCell = beginCell()
            .storeUint(0, 8)
            .storeUint(SendMode.PAY_GAS_SEPARATELY, 8)
            .storeRef(sendTxMsg)
            .endCell();

        const payload = beginCell()
            .storeUint(0, 32)
            .storeUint(validUntil(), 32)
            .storeUint(0, 32)
            .storeSlice(mesagesCell.beginParse())
            .endCell();

        const signature = sign(payload.hash(), keypair.secretKey);
        const body = beginCell()
            .storeUint(bufferToBigInt(signature), 512)
            .storeSlice(payload.beginParse())
            .endCell();

        const receipt = await walletV4.sendExternalSignedMessage(body);
        expect(receipt.transactions).toHaveTransaction({
            from: walletV5.address,
            to: testReceiver,
            value: forwardValue
        });
    });

    it('Should fail adding existing extension', async () => {
        const testExtension = Address.parseRaw('0:' + '0'.repeat(64));

        const actionsList1 = packActionsList([new ActionAddExtension(testExtension)]);
        const receipt1 = await walletV5.sendExternalSignedMessage(createBody(actionsList1));
        accountForGas(receipt1.transactions);
        const extensionsDict1 = Dictionary.loadDirect(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8),
            await walletV5.getExtensions()
        );
        expect(extensionsDict1.size).toEqual(1);
        expect(extensionsDict1.get(packAddress(testExtension))).toEqual(
            BigInt(testExtension.workChain)
        );

        const actionsList2 = packActionsList([new ActionAddExtension(testExtension)]);
        const receipt = await walletV5.sendExternalSignedMessage(createBody(actionsList2));

        expect(
            (
                (receipt.transactions[0].description as TransactionDescriptionGeneric)
                    .computePhase as TransactionComputeVm
            ).exitCode
        ).toEqual(39);

        const extensionsDict2 = Dictionary.loadDirect(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8),
            await walletV5.getExtensions()
        );
        expect(extensionsDict2.size).toEqual(1);
        expect(extensionsDict2.get(packAddress(testExtension))).toEqual(
            BigInt(testExtension.workChain)
        );
    });

    it('Should fail removing not existing extension', async () => {
        const testExtension = Address.parseRaw('0:' + '0'.repeat(64));

        const actionsList = packActionsList([new ActionRemoveExtension(testExtension)]);
        const receipt = await walletV5.sendExternalSignedMessage(createBody(actionsList));

        expect(
            (
                (receipt.transactions[0].description as TransactionDescriptionGeneric)
                    .computePhase as TransactionComputeVm
            ).exitCode
        ).toEqual(40);

        const extensionsDict = Dictionary.loadDirect(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8),
            await walletV5.getExtensions()
        );
        expect(extensionsDict.size).toEqual(0);
        expect(extensionsDict.get(packAddress(testExtension))).toEqual(undefined);
    });

    it('Should fail if signature is invalid: wrong payload signed', async () => {
        const testReceiver = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue = toNano(0.001);

        const walletBalanceBefore = (await blockchain.getContract(walletV5.address)).balance;
        const msg = createMsgInternal({ dest: testReceiver, value: forwardValue });
        const actionsList = packActionsList([new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg)]);

        const vu = validUntil();

        const payload = beginCell()
            .storeUint(WALLET_ID.serialized, 80)
            .storeUint(vu, 32)
            .storeUint(seqno, 32) // seqno
            .storeSlice(actionsList.beginParse())
            .endCell();

        const fakePayload = beginCell()
            .storeUint(WALLET_ID.serialized, 80)
            .storeUint(vu, 32)
            .storeUint(seqno + 1, 32) // seqno
            .storeSlice(actionsList.beginParse())
            .endCell();

        const signature = sign(fakePayload.hash(), keypair.secretKey);
        const body = beginCell()
            .storeUint(bufferToBigInt(signature), 512)
            .storeSlice(payload.beginParse())
            .endCell();

        await disableConsoleError(() =>
            expect(walletV5.sendExternalSignedMessage(body)).rejects.toThrow()
        );

        const walletBalanceAfter = (await blockchain.getContract(walletV5.address)).balance;

        expect(walletBalanceBefore).toEqual(walletBalanceAfter);
    });

    it('Should fail if signature is invalid: wrong private key used', async () => {
        const testReceiver = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue = toNano(0.001);

        const walletBalanceBefore = (await blockchain.getContract(walletV5.address)).balance;
        const msg = createMsgInternal({ dest: testReceiver, value: forwardValue });
        const actionsList = packActionsList([new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg)]);

        const payload = beginCell()
            .storeUint(WALLET_ID.serialized, 80)
            .storeUint(validUntil(), 32)
            .storeUint(seqno, 32) // seqno
            .storeSlice(actionsList.beginParse())
            .endCell();

        const fakeKeypair = keyPairFromSeed(await getSecureRandomBytes(32));

        const signature = sign(payload.hash(), fakeKeypair.secretKey);
        const body = beginCell()
            .storeUint(bufferToBigInt(signature), 512)
            .storeSlice(payload.beginParse())
            .endCell();

        await disableConsoleError(() =>
            expect(walletV5.sendExternalSignedMessage(body)).rejects.toThrow()
        );

        const walletBalanceAfter = (await blockchain.getContract(walletV5.address)).balance;

        expect(walletBalanceBefore).toEqual(walletBalanceAfter);
    });

    it('Should fail if seqno is invalid', async () => {
        const testReceiver = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue = toNano(0.001);

        const walletBalanceBefore = (await blockchain.getContract(walletV5.address)).balance;
        const msg = createMsgInternal({ dest: testReceiver, value: forwardValue });
        const actionsList = packActionsList([new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg)]);

        const payload = beginCell()
            .storeUint(WALLET_ID.serialized, 80)
            .storeUint(validUntil(), 32)
            .storeUint(seqno + 1, 32) // seqno
            .storeSlice(actionsList.beginParse())
            .endCell();

        const signature = sign(payload.hash(), keypair.secretKey);
        const body = beginCell()
            .storeUint(bufferToBigInt(signature), 512)
            .storeSlice(payload.beginParse())
            .endCell();

        await disableConsoleError(() =>
            expect(walletV5.sendExternalSignedMessage(body)).rejects.toThrow()
        );

        const walletBalanceAfter = (await blockchain.getContract(walletV5.address)).balance;

        expect(walletBalanceBefore).toEqual(walletBalanceAfter);
    });

    it('Should fail if valid_until is expired', async () => {
        const testReceiver = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue = toNano(0.001);

        const walletBalanceBefore = (await blockchain.getContract(walletV5.address)).balance;
        const msg = createMsgInternal({ dest: testReceiver, value: forwardValue });
        const actionsList = packActionsList([new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg)]);

        const payload = beginCell()
            .storeUint(WALLET_ID.serialized, 80)
            .storeUint(Math.round(Date.now() / 1000) - 600, 32)
            .storeUint(seqno, 32)
            .storeSlice(actionsList.beginParse())
            .endCell();

        const signature = sign(payload.hash(), keypair.secretKey);
        const body = beginCell()
            .storeUint(bufferToBigInt(signature), 512)
            .storeSlice(payload.beginParse())
            .endCell();

        await disableConsoleError(() =>
            expect(walletV5.sendExternalSignedMessage(body)).rejects.toThrow()
        );

        const walletBalanceAfter = (await blockchain.getContract(walletV5.address)).balance;

        expect(walletBalanceBefore).toEqual(walletBalanceAfter);
    });

    it('Should fail if walletId id is wrong', async () => {
        const testReceiver = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue = toNano(0.001);

        const walletBalanceBefore = (await blockchain.getContract(walletV5.address)).balance;
        const msg = createMsgInternal({ dest: testReceiver, value: forwardValue });
        const actionsList = packActionsList([new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg)]);

        const payload = beginCell()
            .storeUint(new WalletId({ ...WALLET_ID, subwalletNumber: 1 }).serialized, 80)
            .storeUint(validUntil(), 32)
            .storeUint(seqno, 32)
            .storeSlice(actionsList.beginParse())
            .endCell();

        const signature = sign(payload.hash(), keypair.secretKey);
        const body = beginCell()
            .storeUint(bufferToBigInt(signature), 512)
            .storeSlice(payload.beginParse())
            .endCell();

        await disableConsoleError(() =>
            expect(walletV5.sendExternalSignedMessage(body)).rejects.toThrow()
        );

        const walletBalanceAfter = (await blockchain.getContract(walletV5.address)).balance;

        expect(walletBalanceBefore).toEqual(walletBalanceAfter);
    });

    it('Should skip message if auth kind is wrong', async () => {
        const testReceiver = Address.parse('EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y');
        const forwardValue = toNano(0.001);

        const walletBalanceBefore = (await blockchain.getContract(walletV5.address)).balance;
        const msg = createMsgInternal({ dest: testReceiver, value: forwardValue });
        const actionsList = packActionsList([new ActionSendMsg(SendMode.PAY_GAS_SEPARATELY, msg)]);

        const payload = beginCell()
            .storeUint(WALLET_ID.serialized, 80)
            .storeUint(validUntil(), 32)
            .storeUint(seqno, 32)
            .storeSlice(actionsList.beginParse())
            .endCell();

        const signature = sign(payload.hash(), keypair.secretKey);
        const body = beginCell()
            .storeUint(bufferToBigInt(signature), 512)
            .storeSlice(payload.beginParse())
            .endCell();

        await disableConsoleError(() =>
            expect(
                walletV5.sendExternal(
                    beginCell().storeUint(1111, 32).storeSlice(body.beginParse()).endCell()
                )
            ).rejects.toThrow()
        );

        const walletBalanceAfter = (await blockchain.getContract(walletV5.address)).balance;

        expect(walletBalanceBefore).toEqual(walletBalanceAfter);
    });

    it('Should skip message if auth kind not given', async () => {
        const walletBalanceBefore = (await blockchain.getContract(walletV5.address)).balance;

        await disableConsoleError(() =>
            expect(walletV5.sendExternal(beginCell().endCell())).rejects.toThrow()
        );

        const walletBalanceAfter = (await blockchain.getContract(walletV5.address)).balance;

        expect(walletBalanceBefore).toEqual(walletBalanceAfter);
    });

    it('Should skip message with simple text comment', async () => {
        const walletBalanceBefore = (await blockchain.getContract(walletV5.address)).balance;

        await disableConsoleError(() =>
            expect(
                walletV5.sendExternal(
                    beginCell().storeUint(0, 32).storeStringTail('Hello world').endCell()
                )
            ).rejects.toThrow()
        );

        const walletBalanceAfter = (await blockchain.getContract(walletV5.address)).balance;

        expect(walletBalanceBefore).toEqual(walletBalanceAfter);
    });
});
