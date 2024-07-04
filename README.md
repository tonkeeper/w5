# W5: wallet smart contract v5

New version of wallet smart contract, the previous one was [v4r2](https://github.com/ton-blockchain/wallet-contract).

The entire concept is proposed by the [Tonkeeper team](https://tonkeeper.com/).

New Features:

- Send up to 255 messages at once;

- Signed actions can be sent not only by external message, but also by internal messages (can be used for gasless transactions);

- Unlimited extensions;

- Extension can prohibit signed actions in the wallet (can be used for 2fa or key recovery);

- Optimizations to reduce network fees;

- Better foolproofing safety - reply-protection for external messages, wallet id rethinking;

## Project structure

-   [Specification](Specification.md)
-   `contracts` - source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts, additionally contains utilities for gas optimisation.
-   `fift` - contains standard Fift v0.4.4 library including the assembler and disassembler for gas optimisation utilities.

## How to use

### Build

`npm run build`

### Test

`npm run test`

### Deployment

Deploy wallet: `npm run deploy-wallet`

