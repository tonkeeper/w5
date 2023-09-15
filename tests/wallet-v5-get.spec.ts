import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Address, beginCell, Cell, Dictionary, Sender, toNano } from 'ton-core';
import { WalletV5 } from '../wrappers/wallet-v5';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { getSecureRandomBytes, KeyPair, keyPairFromSeed } from 'ton-crypto';
import { bufferToBigInt, packAddress } from './utils';

const SUBWALLET_ID = 20230823 + 0;

describe('Wallet V5 get methods', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('wallet_v5');
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
        expect(actual?.equals(expected)).toBeTruthy();
    });
});
