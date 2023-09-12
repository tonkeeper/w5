import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Address, beginCell, Cell, Dictionary, Sender, SendMode, toNano } from 'ton-core';
import { WalletV5 } from '../wrappers/WalletV5';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { KeyPair, getSecureRandomBytes, keyPairFromSeed, sign } from 'ton-crypto';
import { bufferToBigInt, packAddress, validUntil } from './utils';

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

    beforeEach(async () => {
        const { deployer, deployResult } = await deploy();

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: walletV5.address,
            deploy: true,
            success: true
        });
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

        const extensions: Dictionary<bigint, Cell> = Dictionary.empty();
        extensions.set(packAddress(plugin1), beginCell().storeInt(plugin1.workChain, 8).endCell());
        extensions.set(packAddress(plugin2), beginCell().storeInt(plugin1.workChain, 8).endCell());

        await deploy({ extensions });

        const actual = await walletV5.getExtensions();
        const expected = beginCell()
            .storeDictDirect(extensions, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())
            .endCell();
        expect(actual.equals(expected)).toBeTruthy();
    });

    it('Send simple transfer', async () => {
        const seqno = 0;

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
            .storeUint(0x0ec3c86d, 32)
            .storeUint(SendMode.PAY_GAS_SEPARATELY, 8)
            .storeRef(sendTxMsg)
            .endCell();

        const actionsList = beginCell()
            .storeRef(beginCell().endCell())
            .storeSlice(sendTxactionAction.beginParse())
            .endCell();

        const payload = beginCell()
            .storeUint(SUBWALLET_ID, 32)
            .storeUint(validUntil(), 32)
            .storeUint(seqno, 32)
            .storeUint(0, 1)
            .storeRef(actionsList)
            .endCell();

        const signature = sign(payload.hash(), keypair.secretKey);
        const body = beginCell()
            .storeUint(bufferToBigInt(signature), 512)
            .storeSlice(payload.beginParse())
            .endCell();

        const receipt = await walletV5.sendInternalSignedMessage(sender, {
            value: toNano(0.1),
            body
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
});
