## Contest note!

<div align="center">
<img alt="Contest logo" src="contest.png" height="280" width="280">
</div>

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

### Details of optimizations, their rationale and explanations, comparison of consumed gas both in test cases and not in test cases (global gas counter) are provided on a dedicated page: [Gas improvements](Improvements.rst).
