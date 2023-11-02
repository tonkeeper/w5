Improvements log
================

In this section a table is presented with optimization results in several projections.

Contest test cases display how much gas is used by contest-like methods of test suite, total saved and percentage
as compared to the original commit gas use.

Global gas counters were introduced after commit ``Keep your functions close and vars even closer`` to make a measurable
metric of "tradeoff" between contest test cases and all other cases, that are totalled by their corresponding test suite.

Only positive (no fail) tests without getters (since there is no point to optimize getters) are included in the table.

This metric proven to be useful, because an ``Localize extensions in loop and short-circ simple`` commit resulted in very
big jump in savings on the test cases, meanwhile it severly impaired all other cases (GGC increased a lot on it). As a
result, the very next commit ``Refactored internal message flows, good GGC value`` managed to bring the GGC below the initial
total level, with further commits do a ``stable development`` of contest test cases with improving GGC as well.

+----------------------------------------------------------------+-------------------------------------------+--------------------------------+
| Commit                                                         |               Contest test cases          |       Global gas counters      |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| .____________________________________________________________. | Ext  | Int  | Extn | Total | Save | Perc% | Exter | Inter | Exten | Total  |
+================================================================+======+======+======+=======+======+=======+=======+=======+=======+========+
| *Origin point: INITIAL*                                        | 3235 | 4210 | 2760 | 10205 | 0    | 0.00% | 64038 | 71163 | 38866 | 174067 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Optimized unneccessary cell loads and operations               | 3185 | 4014 | 2744 | 9943  | 262  | 2.56% | 65556 | 70764 | 40304 | 176624 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Removed unneccessary always true check                         | 3185 | 3823 | 2501 | 9509  | 696  | 6.82% | 65504 | 68993 | 38998 | 173495 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Unrolled the common internal handler code                      | 3185 | 3700 | 2373 | 9258  | 947  | 9.28% | 65504 | 67886 | 38204 | 171594 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Implicitly return from the external handler                    | 3165 | 3700 | 2373 | 9238  | 967  | 9.48% | 65264 | 67886 | 38204 | 171354 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Reaped benefits of separated internal loaders                  | 3165 | 3700 | 2295 | 9160  | 1045 | 10.2% | 65264 | 67886 | 37736 | 170886 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Discarded unneccessary slice remains in dispatcher             | 3155 | 3690 | 2285 | 9130  | 1075 | 10.5% | 65034 | 67716 | 37646 | 170396 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Loaded auth_kind optionally using LDUQ instruction             | 3155 | 3654 | 2249 | 9058  | 1147 | 11.2% | 65050 | 67408 | 37430 | 169888 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Is ifnot a joke for you? (emits less instructions)             | 3155 | 3654 | 2231 | 9040  | 1165 | 11.4% | 65050 | 67408 | 37322 | 169780 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Localize extensions in loop and short-circ simple              | 3045 | 3644 | 2121 | 8810  | 1395 | 13.7% | 69697 | 71316 | 39314 | 180327 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Reordering int msg handlers somehow saves 10 gas               | 3045 | 3567 | 2188 | 8800  | 1405 | 13.8% | 69697 | 70623 | 39716 | 180036 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Moving signature check higher saves some gas                   | 3027 | 3549 | 2188 | 8764  | 1441 | 14.1% | 69481 | 70461 | 39716 | 179658 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Reordering checks somehow sames some more gas                  | 3009 | 3531 | 2188 | 8728  | 1477 | 14.5% | 69265 | 70299 | 39716 | 179280 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Removing end_parse is -gas and +reliability                    | 2983 | 3505 | 2188 | 8676  | 1529 | 15.0% | 68953 | 70065 | 39716 | 178734 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Keep your functions close and vars even closer                 | 2957 | 3505 | 2188 | 8650  | 1555 | 15.2% | 68641 | 70065 | 39716 | 178422 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| < restore extensions var in loop >                             | 3067 | 3533 | 2288 | 8888  |      |       | 65669 | 67568 | 38456 |        |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| < move complex logic to inline_ref >                           | 2957 | 3423 | 2316 | 8696  |      |       | 65528 | 67495 | 39148 |        |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| < optimize tail loading of extensions >                        | 2957 | 3423 | 2298 | 8678  |      |       | 65528 | 67495 | 39040 |        |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| < optimize preference for simple ext ops >                     | 2957 | 3423 | 2248 | 8628  |      |       | 65528 | 67495 | 39324 |        |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Refactored internal message flows, good GGC value              | 2957 | 3423 | 2248 | 8628  | 1577 | 15.5% | 65528 | 67495 | 39324 | 172347 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| ^^^ This commit finally shows TOTAL GGC less then initial one WHILE providing 15.5% gas save on contest test cases! ^^^                     |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Reorganized inlining point for extension message flow          | 2957 | 3423 | 2230 | 8610  | 1595 | 15.6% | 65528 | 67495 | 38782 | 171805 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Do not carry around params not needed (ext opt)                | 2957 | 3423 | 2176 | 8556  | 1649 | 16.2% | 65176 | 67275 | 38586 | 171037 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Optimize argument order to match stack                         | 2939 | 3405 | 2148 | 8492  | 1713 | 16.8% | 64960 | 67113 | 38346 | 170419 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Swapping extn and sign order back saves some net gas           | 2939 | 3464 | 2063 | 8466  | 1739 | 17.0% | 65004 | 67676 | 37876 | 170556 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Short-circuit optimization of LDUQ with IFNOTRET               | 2939 | 3420 | 2019 | 8378  | 1827 | 17.9% | 64929 | 67205 | 37612 | 169746 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| < short-circuit flags check with asm >                         | 2939 | 3402 | 2001 | 8342  |      |       |       |       |       |        |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| < short-circuit int msg sign last check with asm >             | 2939 | 3376 | 2001 | 8316  |      |       |       |       |       |        |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| < short-circuit ext msg sign last check with asm >             | 2913 | 3376 | 2001 | 8290  |      |       |       |       |       |        |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| < short-circuit extension dictionary check with asm >          | 2913 | 3376 | 1983 | 8272  |      |       |       |       |       |        |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Short-circuited some returns with asm                          | 2913 | 3376 | 1983 | 8272  | 1933 | 18.9% | 64599 | 66791 | 37373 | 168763 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| ASM-optimized simple action cases                              | 2885 | 3348 | 1981 | 8214  | 1991 | 19.5% | 64470 | 66700 | 37351 | 168521 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Optimized out more unneeded instructions if may RET            | 2885 | 3338 | 1955 | 8178  | 2027 | 19.9% | 64470 | 66610 | 37177 | 168257 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Removed another unneccessary DROP with preload uint            | 2875 | 3338 | 1955 | 8168  | 2037 | 20.0% | 64350 | 66610 | 37177 | 168137 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| ^^^ Finally got **20%** optimization in test cases! ^^^                                                                                     |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Reordered argument order to optimize stack operations          | 2857 | 3320 | 1955 | 8132  | 2073 | 20.3% | 64134 | 66448 | 37137 | 167719 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Rewritten RETALT to IFNOTJMP - less gas, more reliable         | 2836 | 3299 | 1934 | 8069  | 2136 | 20.9% | 64071 | 66406 | 37220 | 167697 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Another argument stack optimization (psr -> dr call)           | 2818 | 3281 | 1934 | 8033  | 2172 | 21.3% | 64017 | 66370 | 37220 | 167607 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| ^^^ Finally this solution is better then original in **EVERY** test suite branch! The last hurdle - Exter GGC is now less!!! ^^^            |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Black magic route optimization (drop some result later)        | 2818 | 3281 | 1916 | 8015  | 2190 | 21.5% | 64017 | 66370 | 37130 | 167517 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Another black magic optimization (drop auth_kind later)        | 2818 | 3281 | 1906 | 8005  | 2200 | 21.6% | 64017 | 66370 | 37102 | 167489 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Backported FunC optimizations from entrypoint branch           | 2782 | 3373 | 1824 | 7979  | 2226 | 21.8% | 60011 | 64810 | 34138 | 158959 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Use SDBEGINS to enforce prefix in external message             | 2710 | 3373 | 1824 | 7907  | 2298 | 22.5% | 59147 | 64810 | 34138 | 158095 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Use SDBEGINSQ to check internal message prefixes               | 2710 | 3283 | 1736 | 7729  | 2476 | 24.3% | 59237 | 64090 | 33578 | 156905 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Backport some optimizations from EP and coalesce code          | 2699 | 3165 | 1828 | 7692  | 2513 | 24.6% | 59108 | 63031 | 34141 | 156280 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| Optimized instructions order for extension and fix args        | 2699 | 3165 | 1810 | 7674  | 2531 | 24.8% | 59108 | 63031 | 34033 | 156172 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+
| *Reminder and origin point: INITIAL*                           | 3235 | 4210 | 2760 | 10205 | 0    | 0.00% | 64038 | 71163 | 38866 | 174067 |
+----------------------------------------------------------------+------+------+------+-------+------+-------+-------+-------+-------+--------+

*It seems that backporting optimization wiggles around values here and there.* To get the maximum possible gas savings please consider taking
a look at ``entrypoint`` ("radical") branch. Since optimizations are carefully made there, they decrease used gas by all cases without compromises.

As an example, here is a comparison of used gas in main ("conservative") and entrypoint ("radical") branches:

+-----------------+----------+----------------+
| Test case       | main gas | entrypoint gas |
+=================+==========+================+
| External        | 2699     | **2707**       |
+-----------------+----------+----------------+
| Internal        | 3165     | **2963**       |
+-----------------+----------+----------------+
| Extension       | 1828     | **1626**       |
+-----------------+----------+----------------+
| External GGC    | 59108    | **58893**      |
+-----------------+----------+----------------+
| Internal GGC    | 63031    | **61011**      |
+-----------------+----------+----------------+
| Extension GGC   | 34141    | **32929**      |
+-----------------+----------+----------------+

The external test case uses a tiny miniscule more gas due to if ordering, making it way around messes up cell slicing completely.
Nevertheless, external global counter is still less, therefore the overall result is not that bad.

N.B. Contest multiplier: 9905/10250 = 0.9663 (approximate) -> place multipliers ~ 0.3221138, 0.0966341, 0.048317

Details and rationale
=====================

In this section, details of optimization in each commit are pointed out, sometimes with detailed rationale and reasoning,
when neccessary (in some relatively controversial optimizations).

Origin point: INITIAL
---------------------
The origin point, the state of the contract when the contest was started. It is used as a basis point to measure further improvements.

Optimized unneccessary cell loads and operations
------------------------------------------------
There is some data that is not needed to be loaded right away, since most likely it won't be used, so that data loading is deferred
until the moment it is actually needed. First of all, that is ``extensions`` dictionary, since loading dict (consequently, a cell)
is a pretty expensive operation.

Also, reading ``stored_subwallet, public_key, extensions`` and writing them back just to increase ``stored_seqno`` is completely
unneccessary, so I took a snapshot of slice immediately after ``stored_seqno``, and write it as a slice, instead of 3 write operations
when increasing the ``stored_seqno``.

Instead of ``extensions`` now ``immutable_tail`` is being passed around, and ``extensions`` are extracted from it, when needed.

Removed unneccessary always true check
--------------------------------------
Adding return to the if condition decreased amount of gas (due to turning ``IF`` into ``IFJMP``), and, consequently,
second check of opcode is not required, since it is allowed to be only one of two options, one of which was already checked.

Unrolled the common internal handler code
-----------------------------------------
Copying the common data load code to separate execution paths in internal message handler somehow saves considerable amount
of gas, but, most importantly, allows to optimize the data loading in future (since it is now different code).

Implicitly return from the external handler
-------------------------------------------
*Explicity* (commit name has logic mistake) returning from the external handler saves some gas due to some TVM optimizations.

Reaped benefits of separated internal loaders
---------------------------------------------
Because data loading is now handled separately for signed and extension messages, it is possible to optimize data loading
so as not to waste unneccessary gas to load data that is not required for a specific execution path.

More precisely, extensions are now loaded from immutable tail, that allows to streamline stack manipulations that decrease
amount of used gas, also, this logic will be even more simplified in future to save even more gas.

Discarded unneccessary slice remains in dispatcher
--------------------------------------------------
Using ``preload_ref`` instead of ``load_ref`` on a varible that is not used anymore saves considerable amount of gas, since
it is not required anymore to do stack manipulations and dropping the unneccessary result.

Loaded auth_kind optionally using LDUQ instruction
--------------------------------------------------
An ``LDUQ`` TVM instruction was used to construct a ``try_load_uint32`` that attempts to load an ``uint32`` from a slice,
and returns the success indicator alongside with result, that allows to compact checking of availability of bits in slice
and reading the integer itself into one instruction - less branching, instructions, checks and gas.

Is ifnot a joke for you? (emits less instructions)
--------------------------------------------------
Using ``ifnot`` instead of ``if ~...`` saves gas, since ``NOT`` instruction is not needed anymore. ``ifnot`` has same price
and bit length as the ``if``, therefore it is **always** advised to use ``ifnot`` for negative conditions.

Localize extensions in loop and short-circ simple
-------------------------------------------------
In this commit, there are two different changes. First one is localizing ``extensions`` inside loop, that allowed to save
some gas in case ``extensions`` are not needed to be changed.

**The second one is one of the most important optimizations**, that opens the door for many more further gas optimizations
in the code. The idea is that if the message is simple, that it, has no extended actions (the first bit is right away 0),
it is possible to immediately do the ``set_actions`` and ``return``.

While the first idea has a noticeable tradeoff, that will be eliminated in future by optimizations all around the code,
the second one does not make other execution paths more pricey, while making the main ones much better in terms of gas.

Reordering int msg handlers somehow saves 10 gas
------------------------------------------------
Moving ``sign`` above ``extn`` one in internal message handler somehow saved 10 gas.

Moving signature check higher saves some gas
--------------------------------------------
In ``process_signed_request`` moving signature check to the top of the function saves some gas.

Reordering checks somehow sames some more gas
---------------------------------------------
In ``process_signed_request`` changing order of parameter checks decreased amount of stack manipulations and saved some gas.

Removing end_parse is -gas and +reliability
-------------------------------------------
In this commit, ``end_parse`` (and coincidentally now unneeded ``skip_dict``) was removed from this code. This leads to
increased reliability, less gas usage, and opens road to some more optimizations (like tail preloading).

**While decreasing gas usage and opening road to more optimizations is pretty obvious, let's me explain on the increased reliabilty.**

The idea behind it is, that usually, ``end_parse`` is used to force structure of user messages. Therefore, mostly, using
it to enforce structure of internal data of the contract is quite excessive, since the contract itself is the one, who
only can write it's own data, and therefore if it cannot be corrupted by the code, then there is no way extra data appears
after the expected end. Therefore, using ``end_parse`` is unneccessary, and just wastes gas.

However, in this contract the user can directly do ``set_data`` using extended actions on the contract. And here is the point
why reliability of the contract is actually **increased** by removing the ``end_parse``. It is possible in future, that the
user might accidentally append extra data to the end of the contract. This may happen if the user would like to upgrade the
contract, it will have some more extra data, but for some reason failed or forgot to do the code upgrade action, or it failed
one or another way. In this situation the user will end up with **the old contract with the new data**. And in this situation,
all the TONs, tokens and NFTs on this wallet will be locked **forever!!!** just because of that ``end_parse``. Therefore,
removing the ``end_parse`` also helps against such kind of mistakes, and there are no any kind of implications on removing it.

The only place where it should **really** be used is checking close-structured (without open ends, like in our case, where
the list can be of any length) input user data, in order to make sure, that a specific request can have only one single
implementation in order to prevent some playing with signatures, but that is completely not an our case.

Keep your functions close and vars even closer
----------------------------------------------
This refactoring of external message handler streamlines data flows in it, therefore avoiding unneccessary stack manipulations
and saving some gas as a result. More precisely, the ``auth_kind`` is loaded right away from ``body`` (since it is the last
parameter of the function, it is at the top of the stack at that moment), and data is being loaded later after the check.

Refactored internal message flows, good GGC value
-------------------------------------------------
This commit, and several other technical commits before it (not described here, since they are technical ones and do not
affect the code) lays beginning for calculation and optimizations of **GGC** (global gas counter). While not being a direct
target of the contest, the **GGC** is important metric, that allows to measure the tradeoff, of how optimizing contest paths
inadversely affects all other logic of the code that is not measured. Therefore, keeping an eye on **GGC** is important for
**sustained development** of contest paths, where optimizing them does not severely impair all other code logic.

This commit, while increasing extension gas usage a little (this problem will be addressed to and solved in later commits),
immensely decreases usage of gas in GGC, and brings it down below the GGC in initial commit. Therefore, starting at this point,
I can strongly assert, that the optimizations of the main contest paths do not impair the other code paths and logic.

restore extensions var in loop
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
First of all, ``extensions`` variable in complex handling loop was reinstated, because saving exts in cell and popping them
off each time required a lot of gas due to recreation of cell each time.

move complex logic to inline_ref
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Next, the complex dispatch request handling logic was moved off to a separate function, that is called with ``inline_ref``
modifier. This allows to save some gas on simple cases, and **is actually a very important optimization for future**, because
at some point in future, the *cell breaking point* where TVM Assembler decides to break cell into pieces because a critical
point for further optimization.

optimize tail loading of extensions
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The way how extensions are loaded in internal message handler is optimized so as not to load the unneccessary at that moment data.

optimize preference for simple ext ops
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Simple operations initiated by extensions now do not require to load the unneccessary data from the contract.

Reorganized inlining point for extension message flow
-----------------------------------------------------
Some optimizations were made to tell the compiler to break the cell at exact place by using ``inline`` and ``inline_ref`` accurately.

Do not carry around params not needed (ext opt)
-----------------------------------------------
Getting the data of the contract in place, even accounting for the ``begin_slice`` is more efficient than carrying it around
in many parameters, that forces stack shaping when crossing the function boundary, and constraints on how efficient stack
manipulations may be, therefore all the unneccessary parameters were removed and data is extracted closer to the point
where it is actually needed.

Optimize argument order to match stack
--------------------------------------
Some parameters were reordered to match how they are ordered in stack, so that to decrease amount of unneccessary stack operations.

Swapping extn and sign order back saves some net gas
----------------------------------------------------
In internal message handler ``sign`` and ``extn`` message handlers were swapped back once again, since somehow, after all the
optimizations carried out above, that order is now more efficient in terms of gas.

Short-circuit optimization of LDUQ with IFNOTRET
------------------------------------------------
Instead of pretty complex in terms of instructions and gas FunC construct, a single ``IFNOTRET`` is used to quickly end
execution when there are not enough bits in the slice to obtain the opcode from the internal message.

Short-circuited some returns with asm
-------------------------------------
Following the idea of the previous commit, some more operations now use ``IF(NOT)RET`` instead of conditionals to save more gas.

short-circuit flags check with asm
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Flags of internal message (bounced, to be more precise) are now checked by a concise ASM function that does ``IFRET`` to
end the execution in case a bounced message is detected.

short-circuit int msg sign last check with asm
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The check of second operation can be made shorter by comparing two numbers equality and performing ``IFNOTRET`` in ASM.

short-circuit ext msg sign last check with asm
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The same applies for opcode check in internal message handler.

short-circuit extension dictionary check with asm
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
... and the ``success?`` result of locating the sender in the ``extensions`` dictionary.

ASM-optimized simple action cases
---------------------------------
An optimized code construct was built to replace the not-so-efficient FunC code for simple function cases. This one uses
a specific ordering of result on the stack after executing the neccessary instructions.

Optimized out more unneeded instructions if may RET
---------------------------------------------------
An ``udict_get_or_return`` instruction was introduced that instead of returning ``success?`` alongside with the result
returns immediately if the entry is not found in the dictionary.

Also, I have noticed, that ``public_key`` is read from ``cs`` using ``~load_uint``, but that ``cs`` is not used anymore
in the code, so saved an unneccessary ``DROP`` by using ``.preload_uint`` instead.

Removed another unneccessary DROP with preload uint
---------------------------------------------------
The same optimization for ``public_key`` loading was done in the external message handler in this commit.

Reordered argument order to optimize stack operations
-----------------------------------------------------
Some arguments were reordered to save gas on stack manipulations. Also, another ``public_key`` loading was optimized (the
last one, in the extension handler execution path).

Rewritten RETALT to IFNOTJMP - less gas, more reliable
------------------------------------------------------
The simple actions handler was rewritten from ``IFNOT:<{ ... RETALT }>`` to ``IFNOTJMP:<{ ... }>``. This saves some gas
(since implicit returns are cheaper), and makes the code more reliable (since we cannot be 100% sure that ``RETALT`` will
end the execution as expected if the code will be modified in future, therefore using ``IFNOTJMP`` eliminates this uncertainity).

Another argument stack optimization (psr -> dr call)
----------------------------------------------------
Some another reordering of function arguments was done to eliminate unneccessary stack operations.

Black magic route optimization (drop some result later)
-------------------------------------------------------
An unused result of extension dictionary checking is now carried around inside the called function in order to be dropped
later after the simple actions checker. Surprisingly, this does not impair non-test code paths at all, since the ``DROP``
at the end of simple actions checker is merged with drop of the carried result into ``2DROP``, thus having no drawbacks.

Another black magic optimization (drop auth_kind later)
-------------------------------------------------------
Another variable is now called around for delayed drop, this time ``auth_kind``, which turns ``2DROP`` into ``3 BLKDROP``,
that is still not bad, increases gas efficiency on primary paths, and does not impair it on other ones.

Backported FunC optimizations from entrypoint branch
----------------------------------------------------
Backported some FunC optimizations done in entrypoint branch (although, they may be not as efficient):

Rearranged entrypoint conditions flow, compiler fix
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
External and internal message processing conditions order are swapped that result in less gas usage overall. Also, some
mistakes in TVM Assembler are fixed and functions were renamed so as not to accidentally compile it using an ordinary compiler.

some commits not affecting the main test branches
"""""""""""""""""""""""""""""""""""""""""""""""""
Some additional improvements to the complex dispatch case were made to decrease the global gas counters. This did not affect
the gas usage in the main test cases, but made my optimizations for friendly to the natur... to the other code branches.

Removed unneccessary exploded data parameters
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Moved data (``ds``) variables closer to their actual usage. Therefore it is not required to pass lots of those variables
in the arguments anymore saving some gas on stack reorganizations.

Moreover, this allows to move data variable code inbetween other code in ``process_signed_request`` function, saving even
more code by optimizing order of operations.

Use SDBEGINS to enforce prefix in external message
--------------------------------------------------
I have found out a super useful ``SDBEGINS(Q)`` TVM instruction that allows to verify the prefix of a slice against another
one (in this version of function the prefix is even conveniently embedded into the instruction code itself), and even has
a very convenient behaviour of throwing if prefix does not match (that is very convenient for external message, since
returning from it without accepting message is effectively the same as throwing an exception), and returns the slice without
that prefix is correct, that perfectly matches the previous behaviour.

As such, replacing compare and return with this instruction saves considerable amount of gas with no implications.

Use SDBEGINSQ to check internal message prefixes
------------------------------------------------
The quiet version of aforementioned instruction, ``SDBEGINSQ`` exhibits even more convenient behaviour for multi-case checking
and pipelining: on the top of the stack it puts whether the prefix matched or not, that can be consumed for any kind of condition
checks, and always returns a slice after it. The great behaviour is that if the prefix matched the returned slice is stripped of
it, and if the prefix did not match, the original slice is returned. This allows to use this instruction, branch into processing
code if it matched, or use it again if did not, and keep doing that (something like a switch-case).

Therefore, I have used this instruction to check for opcode prefix in internal message processing.

Backport some optimizations from EP and coalesce code
-----------------------------------------------------
Backported some more optimizations from entrypoint branch

Use SDFIRST instead of PLDU to check first bit
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
It is possible to use shorter ``SDFIRST`` instruction to check if first bit of slice is set, that saves some gas.

I have used it in checking whether to use simple action processing code, that saves some gas in each execution branch.

Check bounced flag using slices and trail bits
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
It is more efficient to get a 4-bit slice and check trailing bits with ``SDCNTTRAIL1`` (it will always be non-zero
if last bit (bounced) is non-zero, and it always will be zero if it is zero - a perfect instruction to check the last bit).
Therefore by such approach checking bounced flag bit is much more effective than loading 4-bit number from slice, pushing 1
to stack, and performing the or operation.

Using SDBEGINSQ to check for starting zero
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Like with internal message prefixes, it is more efficient to use a single ``SDBEGINSQ`` instruction to check that prefix
starts with zero and is a simple action even than preload a single uint1.

Optimized instructions order for extension and fix args
-------------------------------------------------------
Adjusting order of instructions in extension branch allows to save some gas. Also fixed arguments because TON Plugin
was complaining (no gas or instructions change whatsoever).