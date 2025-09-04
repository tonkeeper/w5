# 🔥W5: wallet v5 standard

This is an extensible wallet specification aimed at replacing V4 and allowing arbitrary extensions.

W5 has **25% lower fees**, supports **gasless transactions** (via third party relayers) and implements a **flexible extension mechanism**.

## Project structure

-   [Specification](Specification.md)
-   `contracts` - source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts, additionally contains utilities for gas optimisation.
-   `fift` - contains standard Fift v0.4.4 library including the assembler and disassembler for gas optimisation utilities.

### Additional documentation

-   [Gas improvements](Improvements.rst) - a log of improvements, detailed by primary code paths, global gas counters per commit.
-   [Contest](Contest.md) - a note showing some information about interesting improvements during the optimisation contest.

## How to use

### Build

`npm run build:v5`

### Test

`npm run test`

### Deployment
1. Deploy library: `npm run deploy-library`
2. Deploy wallet: `npm run deploy-wallet`

### Get wallet compiled code

`npm run print-wallet-code`
