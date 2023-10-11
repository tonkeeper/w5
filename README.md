# Wallet V5

This is an extensible wallet specification aimed at replacing V4 and allowing arbitrary extensions.

Wallet V5 has 93% lower storage fees, can delegate payments for gas to third parties and supports flexible extension mechanism.

## Warning! Contest note! 

<center>
<img alt="Contest logo" src="contest.png" height="280" width="280">
</center>

**Because of the extreme amount of optimizations, developer's discretion is advised!** *Evil laugh*

The build system is the same as in the original Wallet V5, **no security features have been sacrificed**
for performance improvements, that is - there are **practically no tradeoffs or compromises**.

Message and storage layouts were **not changed**, although some rearragement might squeeze a little more gas,
but that may break existing optimizations due to stack reordering.

Also, **tests were improved** - a **Global Gas Counter** mechanism was added that accounts for gas in all transactions
of all test suites and cases (except for negative and getter ones). This allows to keep an eye on other non-contest
cases to track how bad is tradeoff when performing optimizations here and there.

Another utility that was developed for contest is ***scalpel script***, that allows for a detailed, *really* detailed optimizations
of the code by comparing lines of code function by function, printing out diffs, and providing detailed TVM files with
stack comments and rewrites. This utility allowed to make some latter optimizations, since with each optimization
next one becomes exponentionally harder to make. While result is not entirely precise and is needed to be verified
by tests, this allows to instantly estimate whether there is some progress or not, since scalpel is executed immediately,
while tests take approximately 10 seconds to execute.

### Details of optimizations, their rationale and explanations, comparison of consumed gas both in test cases and not in test cases (global gas counter) are provided on [Gas improvements](Improvements.rst) page.

## Project structure

-   [Specification](Specification.md)
-   `contracts` - source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts.
-   **[Gas improvements](Improvements.rst)** (detailed by contest paths, global gas counters per commit)

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
