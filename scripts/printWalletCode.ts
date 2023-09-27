import { compile } from '@ton-community/blueprint';
import { LibraryDeployer } from '../wrappers/library-deployer';

export async function run() {
    const code = LibraryDeployer.exportLibCode(await compile('wallet_v5'));

    console.log('WALLET CODE HEX', code.toBoc().toString('hex'), '\n');
    console.log('WALLET CODE BASE64', code.toBoc().toString('base64'));
}

run();
