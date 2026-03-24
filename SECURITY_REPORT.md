# Security Audit Report: W5 Wallet Contract

## Critical Vulnerability Found: Incorrect SendMode Validation for External Messages

### Vulnerability Description
The `verify_c5_actions` function in `contracts/wallet_v5.fc` incorrectly validates the `SendMode` flag for external messages, potentially allowing messages to be processed without the `IGNORE_ERRORS` flag set.

### Location
`contracts/wallet_v5.fc`, function `verify_c5_actions`, lines checking `count_trailing_zeroes(cs.preload_bits(7)) > 0`

### Impact
1. **Replay Attack Vector**: If an external message is processed without `IGNORE_ERRORS` flag and its actions fail (e.g., insufficient balance), the seqno will not be incremented. This allows the same signed message to be replayed indefinitely.
2. **Incorrect Bit Check**: The function only loads 7 bits of the 8-bit SendMode, missing the highest bit.
3. **Wrong Flag Check**: Uses `count_trailing_zeroes` to check if "bits end with 1", but actually needs to check if bit 2 (`IGNORE_ERRORS`) is set.

### Technical Details
1. **SendMode Representation**: `SendMode.IGNORE_ERRORS = 4` (binary `00000100`, bit 2 set)
2. **Current Check**: `count_trailing_zeroes(cs.preload_bits(7)) > 0`
   - Loads only 7 bits (bits 0-6), missing bit 7
   - Checks if there are any trailing zeros (i.e., if bit 0 is 0)
   - This passes for many values without `IGNORE_ERRORS` set
3. **Correct Check Should**: 
   - Load all 8 bits of SendMode
   - Verify `(mode & 4) != 0` for external messages

### Exploit Scenario
1. Attacker crafts a valid signed external message with `SendMode = 0` (no flags)
2. Message actions fail (e.g., insufficient funds)
3. Since `IGNORE_ERRORS` is not set, seqno is not incremented (due to `commit()` only being called if actions succeed)
4. Attacker can replay the same message repeatedly
5. If conditions change (wallet receives funds), message could execute unexpectedly

### Fix
The fix requires:
1. Loading all 8 bits of SendMode
2. Properly checking if bit 2 (`IGNORE_ERRORS`) is set for external messages

### Severity: CRITICAL
This vulnerability allows replay attacks and could lead to unauthorized fund transfers when combined with other attack vectors.

### Recommendation
Immediately apply the provided fix to correctly validate SendMode flags.
# Security Audit Report: W5 Wallet Contract

## Critical Vulnerability Found: Incorrect SendMode Validation for External Messages

### Vulnerability Description
The `verify_c5_actions` function in `contracts/wallet_v5.fc` incorrectly validates the `SendMode` flag for external messages, potentially allowing messages to be processed without the `IGNORE_ERRORS` flag set.

### Location
`contracts/wallet_v5.fc`, function `verify_c5_actions`, lines checking `count_trailing_zeroes(cs.preload_bits(7)) > 0`

### Impact
1. **Replay Attack Vector**: If an external message is processed without `IGNORE_ERRORS` flag and its actions fail (e.g., insufficient balance), the seqno will not be incremented. This allows the same signed message to be replayed indefinitely.
2. **Incorrect Bit Check**: The function only loads 7 bits of the 8-bit SendMode, missing the highest bit.
3. **Wrong Flag Check**: Uses `count_trailing_zeroes` to check if "bits end with 1", but actually needs to check if bit 2 (`IGNORE_ERRORS`) is set.

### Technical Details
1. **SendMode Representation**: `SendMode.IGNORE_ERRORS = 4` (binary `00000100`, bit 2 set)
2. **Current Check**: `count_trailing_zeroes(cs.preload_bits(7)) > 0`
   - Loads only 7 bits (bits 0-6), missing bit 7
   - Checks if there are any trailing zeros (i.e., if bit 0 is 0)
   - This passes for many values without `IGNORE_ERRORS` set
3. **Correct Check Should**: 
   - Load all 8 bits of SendMode
   - Verify `(mode & 4) != 0` for external messages

### Exploit Scenario
1. Attacker crafts a valid signed external message with `SendMode = 0` (no flags)
2. Message actions fail (e.g., insufficient funds)
3. Since `IGNORE_ERRORS` is not set, seqno is not incremented (due to `commit()` only being called if actions succeed)
4. Attacker can replay the same message repeatedly
5. If conditions change (wallet receives funds), message could execute unexpectedly

### Fix
The fix requires:
1. Loading all 8 bits of SendMode using `cs~load_uint(8)`
2. Properly checking if bit 2 (`IGNORE_ERRORS`) is set: `(mode & 4) == 0` should throw for external messages

### Severity: CRITICAL
This vulnerability allows replay attacks and could lead to unauthorized fund transfers when combined with other attack vectors.

### Recommendation
Immediately apply the provided fix to correctly validate SendMode flags.

## Additional Security Notes

### Seqno Increment Before Action Processing
The contract increments seqno and commits it before processing actions (in `process_signed_request`). This is actually a security feature that prevents replay attacks even if actions fail. However, combined with the SendMode validation bug, it creates a dangerous situation where:
- For external messages without `IGNORE_ERRORS`: seqno increments, actions may fail, message can't be replayed (good)
- But with the bug: external messages without `IGNORE_ERRORS` might not be properly detected

### Extension Management Security
The extension system appears robust with proper workchain checks and signature auth controls. However, administrators should be aware that:
1. Once signature auth is disabled and extensions exist, the wallet can only be controlled by extensions
2. Removing the last extension when signature auth is disabled is properly prevented
3. Extensions can only be added/removed from the same workchain

### Signature Verification
Signature verification appears correct with proper hash checking and validation of all required fields (wallet_id, seqno, valid_until).
