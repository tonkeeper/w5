import { toNano } from 'ton-core';
import { WalletV5 } from '../wrappers/WalletV5';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    // const walletV5 = provider.open(
    //     WalletV5.createFromConfig(
    //         {
    //             id: Math.floor(Math.random() * 10000),
    //             counter: 0,
    //         },
    //         await compile('WalletV5')
    //     )
    // );

    // await walletV5.sendDeploy(provider.sender(), toNano('0.05'));

    // await provider.waitForDeploy(walletV5.address);

    // console.log('ID', await walletV5.getID());
}
