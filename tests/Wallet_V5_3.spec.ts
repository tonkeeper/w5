import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, Dictionary, toNano } from 'ton-core';
import { WalletV5 } from '../wrappers/WalletV5';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { KeyPair, getSecureRandomBytes, keyPairFromSeed } from 'ton-crypto';

describe('Wallet_V5_3', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Wallet_V5_3');
    });

    let blockchain: Blockchain;
    let walletV5: SandboxContract<WalletV5>;
    let keypair: KeyPair;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        keypair = keyPairFromSeed(await getSecureRandomBytes(32));

        walletV5 = blockchain.openContract(
            WalletV5.createFromConfig(
                {   
                    seqno: 0,
                    subwallet: 20230823 + 0,
                    publicKey: keypair.publicKey,
                    extensions: Dictionary.empty(),
                },
                code
            )
        );

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await walletV5.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: walletV5.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and walletV5 are ready to use
    });

});
