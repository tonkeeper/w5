// https://github.com/ton-community/func-js-bin/blob/main/scripts/pack-wasm.ts

import * as fs from "fs";

if (fs.existsSync('./node_modules/@ton-community/func-js-bin/dist/funcfiftlib.wasm')) {
    const wasmData = fs.readFileSync('./node_modules/@ton-community/func-js-bin/dist/funcfiftlib.wasm');
    const out = `module.exports = { FuncFiftLibWasm: '${wasmData.toString('base64')}' }`;
    fs.writeFileSync('./node_modules/@ton-community/func-js-bin/dist/funcfiftlib.wasm.js', out);
    fs.unlinkSync('./node_modules/@ton-community/func-js-bin/dist/funcfiftlib.wasm');
}
