import { Dictionary, toNano } from 'ton-core';
import { WalletV5 } from '../wrappers/wallet-v5';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { getSecureRandomBytes, keyPairFromSeed } from 'ton-crypto';

const SUBWALLET_ID = 0;

export async function run(provider: NetworkProvider) {
    const keypair = keyPairFromSeed(await getSecureRandomBytes(32));
    console.log('KEYPAIR PUBKEY', keypair.publicKey.toString('hex'));
    console.log('KEYPAIR PRIVATE_KEY', keypair.secretKey.toString('hex'));
    //let keypair = randomTestKey('v5-treasure-relayer');

    const walletV5 = provider.open(
        WalletV5.createFromConfig(
            {
                seqno: 0,
                subwallet: SUBWALLET_ID,
                publicKey: keypair.publicKey,
                extensions: Dictionary.empty()
            },
            await compile('wallet_v5')
        )
    );

    await walletV5.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(walletV5.address);

    console.log('ADDRESS', walletV5.address);
}
