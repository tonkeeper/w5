import { compile } from '@ton-community/blueprint';
import { LibraryKeeper } from '../wrappers/library-keeper';

export async function run() {
    const code = LibraryKeeper.exportLibCode(await compile('wallet_v5'));

    console.log('WALLET CODE HEX', code.toBoc().toString('hex'), '\n');
    console.log('WALLET CODE BASE64', code.toBoc().toString('base64'));
}

run();
