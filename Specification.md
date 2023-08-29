# Extensible Wallet V5

Author: Oleg Andreev <oleg@tonkeeper.com>

This is an extensible wallet specification aimed at replacing V4 and allowing arbitrary extensions.

* [Features](#features)
* [Overview](#overview)
* [Discussion](#discussion)
* [Wallet ID](#wallet-id)
* [TL-B definitions](#tl-b-definitions)
* [Source code](#source-code)


## Credits

Thanks to [Andrew Gutarev](https://github.com/pyAndr3w) for the idea to set c5 register to a [list of pre-composed actions](https://github.com/pyAndr3w/ton-preprocessed-wallet-v2).

Thanks to [@subden](https://t.me/subden) and [@botpult](https://t.me/botpult) for ideas and discussion.


## Features

* Arbitrary amount of outgoing messages is supported via action list.
* Wallet code can be upgraded transparently without breaking user's address in the future.
* Unlimited number of plugins can be deployed sharing the same code.
* Wallet code can be extended by anyone in a decentralized and conflict-free way: multiple feature extensions can co-exist.
* Extensions can perform the same operations as the signer: emit arbitrary messages on behalf of the owner, add and remove extensions.
* Signed requests can be delivered via internal message to allow 3rd party pay for gas.
* Extensible ABI for future additions.

## Overview

Wallet V5 supports **2 authentication modes**, all standard output actions (send message, set library, code replacement) plus additional **3 operation types**.

Authentication:
* by signature
* by extension

Operation types:
* standard output actions
* “set data”
* install extension
* remove extension

Signed messages can be delivered both by external and internal messages.

All operation types are available to all authentication modes.

## Discussion

### What is the job of the wallet?

The job of the wallet is to send messages to other apps in the TON network on behalf of a single user identified by a single public key.
User may delegate this job to other apps via extensions.

### The wallet is not for:

* multi-user operation: you should use a multisig or DAO solution instead.
* routing of incoming payments and messages: use a specialized contract instead.
* imposing limits on access to certain assets: put account restriction inside a jetton, or use a lockup contract instead.

### Extending the wallet

**A. Code optimization**

Backwards compatible code optimization **can be performed** with a single `set_code` action (`action_set_code#ad4de08e`) signed by the user. That is, hypothetical upgrade from v5R1 to v5R2 can be done in-place without forcing users to change wallet address.

If the optimized code requires changes to the data layout (e.g. reordering fields) the user can sign a request with two actions: `set_code` (in the standard action) and `set_data` (an extended action per this specification). Note that `set_data` action must make sure `seqno` is properly incremented after the upgrade as to prevent replays. Also, `set_data` must be performed right before the standard actions to not get overwritten by extension actions.

User agents **should not** make `set_code` and `set_data` actions available via general-purpose API to prevent misuse and mistakes. Instead, they should be used as a part of migration logic for a specific wallet code.

**B. Substantial upgrades**

We **do not recommend** performing substantial wallet upgrades in-place using `set_code`/`set_data` actions. Instead, user agents should have support for multiple accounts and easy switching between them.

In-place migration requires maintaining backwards compatibility for all wallet features, which in turn could lead to increase in code size and higher gas and rent costs.

**C. Delegation/Capabilities schemes**

We recommend trying out new wallet capabilities via the extensions scheme instead of upgrading the wallet code.

Wallet V5 supports scalable extensions that permit delegating access to the wallet to other contracts.

From the perspective of the wallet, every extension can perform the same actions as the user. Therefore limits and capabilities can be embedded in such an extension with a custom storage scheme.

Extensions can co-exist simultaneously, so experimental capabilities can be deployed and tested independently from each other.

### Can the wallet outsource payment for gas fees?

Yes! You can deliver signed messages via an internal message from a 3rd party wallet. Also, the message is handled exactly like an external one: after the basic checks the wallet takes care of the fees itself, so that 3rd party does not need to overpay for users who actually do have TONs.

### Does the wallet grow with number of plugins?

Not really. Wallet only accumulates code extensions. So if even you have 100500 plugins based on just three types of contracts, your wallet would only store extra ≈96 bytes of data.

### Can plugins implement subscriptions that collect tokens?

Yes. Plugins can emit arbitrary messages, including token transfers, on behalf of the wallet.

### How can a plugin collect funds?

Plugin needs to send a request with a message to its own address.

### How can a plugin self-destruct?

Plugin does not need to remove its extension code from the wallet — they can simply self-destroy by sending all TONs to the wallet with sendmode 128.

### How can I deploy a plugin, install its code and send it a message in one go?

You need two requests in your message body: first one installs the extension code, the second one sends raw message to your plugin address.

### How does the wallet know which plugins it has installed?

Extension contracts are designed in such way that each one checks that it was deployed by its proper wallet. For an example of this initialization pattern see how NFT items or jetton wallets do that. 

Your wallet can only trust the extension code that was audited to perform such authenticated initialization. Users are not supposed to install arbitrary extensions unknown to the user agent.


## Wallet ID

Wallet ID disambiguates requests signed with the same public key to different wallet versions (V3/V4/V5) or wallets deployed on different chains.

For Wallet V5 we suggest using the following wallet ID:

```
mainnet: 20230823 + workchain
testnet: 30230823 + workchain
```

## TL-B definitions

Action types:

```tlb
// Standard actions from block.tlb:
out_list_empty$_ = OutList 0;
out_list$_ {n:#} prev:^(OutList n) action:OutAction
  = OutList (n + 1);
action_send_msg#0ec3c86d mode:(## 8) 
  out_msg:^(MessageRelaxed Any) = OutAction;
action_set_code#ad4de08e new_code:^Cell = OutAction;
action_reserve_currency#36e6b809 mode:(## 8)
  currency:CurrencyCollection = OutAction;
libref_hash$0 lib_hash:bits256 = LibRef;
libref_ref$1 library:^Cell = LibRef;
action_change_library#26fa1dd4 mode:(## 7) { mode <= 2 }
  libref:LibRef = OutAction;

// Extended actions in W5:
action_list_basic$0 {n:#} actions:^(OutList n) = ActionList n 0;
action_list_extended$1 {m:#} {n:#} prev:^(ActionList n m) action:ExtendedAction = ActionList n (m+1);

action_set_data#1ff8ea0b data:^Cell = ExtendedAction;
action_add_ext#1c40db9f code_hash:uint256 = ExtendedAction;
action_delete_ext#5eaef4a4 code_hash:uint256 = ExtendedAction;
```

Authentication modes:

```tlb
signed_request$_ 
  signature:    bits512                   // 512
  subwallet_id: uint32                    // 512+32
  valid_until:  uint32                    // 512+32+32
  msg_seqno:    uint32                    // 512+32+32+32 = 608
  inner: InnerRequest = SignedRequest;

internal_signed#7369676E signed:SignedRequest = InternalMsgBody;
internal_extension#6578746E code:^Cell data:^Cell inner:InnerRequest = InternalMsgBody;
external_signed#7369676E signed:SignedRequest = ExternalMsgBody;

actions$_ {m:#} {n:#} actions:(ActionList n m) = InnerRequest;
```


## Source code

```func
#pragma version =0.2.0;

;; Extensible wallet contract v5

(slice, int) dict_get?(cell dict, int key_len, slice index) asm(index dict key_len) "DICTGET" "NULLSWAPIFNOT";
(cell, int) dict_add_builder?(cell dict, int key_len, slice index, builder value) asm(value index dict key_len) "DICTADDB";
(cell, int) dict_delete?(cell dict, int key_len, slice index) asm(index dict key_len) "DICTDEL";
() set_actions(cell action_list) impure asm "c5 POP";

;; Verifies signed request, prevents replays and proceeds with `dispatch_request`.
() process_signed_request(slice body, int stored_seqno, int stored_subwallet, int public_key, cell extensions) impure {
  var signature = body~load_bits(512);
  var cs = body;
  var (subwallet_id, valid_until, msg_seqno) = (cs~load_uint(32), cs~load_uint(32), cs~load_uint(32));
  
  throw_if(36, valid_until <= now());
  throw_unless(33, msg_seqno == stored_seqno); 
  throw_unless(34, subwallet_id == stored_subwallet);
  throw_unless(35, check_signature(slice_hash(body), signature, public_key));
  
  accept_message();
  
  ;; Store and commit the seqno increment to prevent replays even if the requests fail.
  stored_seqno = stored_seqno + 1;
  set_data(begin_cell()
    .store_uint(stored_seqno, 32)
    .store_uint(stored_subwallet, 32)
    .store_uint(public_key, 256)
    .store_dict(extensions)
    .end_cell());

  commit();

  dispatch_request(cs, stored_seqno, stored_subwallet, public_key, extensions);
}


;; Dispatches already authenticated request based on a 2-bit opcode: 
;; - emit message
;; - install extension
;; - remove extension
;; - process more requests recursively
() dispatch_request(slice cs, int stored_seqno, int stored_subwallet, int public_key, cell extensions) impure {

  ;; Recurse into extended actions until we reach standard actions
  while (cs~load_uint(1)) {
      int op = cs~load_uint(4);
      
      ;; Raw set_data 
      if (op == 0x1ff8ea0b) {
          set_data(cs~load_ref());
      }
      
      ;; Add/remove extensions
      if (op == 0x1c40db9f || op == 0x5eaef4a4) {
          int code_hash = cs~load_uint(256);
          ;; Add extension
          if (op == 0x1c40db9f) {
              (extensions, int success?) = extensions.dict_add_builder?(256, code_hash, begin_cell());
              throw_unless(39, success?);
          }
          ;; Remove extension
          if (op == 0x5eaef4a4) {
              (extensions, int success?) = extensions.dict_delete?(256, code_hash);
              throw_unless(39, success?);
          }
     
          set_data(begin_cell()
            .store_uint(stored_seqno, 32)
            .store_uint(stored_subwallet, 32)
            .store_uint(public_key, 256)
            .store_dict(extensions)
            .end_cell());
      }

      ;; Other actions are no-op
      ;; FIXME: is it costlier to check for unsupported actions and throw?

      cs = cs~load_ref().begin_parse()
  }
  ;; At this point we are `action_list_basic$0 {n:#} actions:^(OutList n) = ActionList n 0;`
  ;; Simply set the C5 register with all pre-computed actions:
  set_actions(cs~load_ref());
  return ();
}

() recv_external(slice body) impure {
  var ds = get_data().begin_parse();
  var (stored_seqno, stored_subwallet, public_key, extensions) = (ds~load_uint(32), ds~load_uint(32), ds~load_uint(256), ds~load_dict());
  ds.end_parse();
  int auth_kind = body~load_uint(32);
  if (auth_kind == 0x7369676E) { ;; "sign"
    process_signed_request(body, stored_seqno, stored_subwallet, public_key, extensions);
  } else {
    ;; FIXME: probably need to throw here?
    return ();
  }
}


() recv_internal(int msg_value, cell full_msg, slice body) impure {
  var full_msg_slice = full_msg.begin_parse();
  var flags = full_msg_slice~load_uint(4);  ;; int_msg_info$0 ihr_disabled:Bool bounce:Bool bounced:Bool
  if (flags & 1) {
    ;; ignore all bounced messages
    return ();
  }
  if (body.slice_bits() < 32) {
    ;; ignore simple transfers
    return ();
  }
  int auth_kind = body~load_uint(32);

  ;; We accept two kinds of authenticated messages:
  ;; - 0x6578746E "extn" authenticated by extension
  ;; - 0x7369676E "sign" authenticated by signature
  if (auth_kind != 0x6578746E) & (auth_kind != 0x7369676E) { ;; "extn" & "sign"
    ;; ignore all unauthenticated messages 
    return ();
  }
  
  var ds = get_data().begin_parse();
  var (stored_seqno, stored_subwallet, public_key, extensions) = (ds~load_uint(32), ds~load_uint(32), ds~load_uint(256), ds~load_dict());
  ds.end_parse();
  
  if (auth_kind == 0x6578746E) { ;; "extn"
    ;; Note that some random contract may have deposited funds with this prefix, 
    ;; so we accept the funds silently instead of throwing an error (wallet v4 does the same).
    
    ;; FIXME:
    ;; In this revision we send full code+data refs instead of their hashes.
    ;; In the future this should be optimized either with pruned cells or
    ;; with an explicit pair of 256-bit strings in the body.
    ;; Also consider subden's hack: transfer code+data in the stateinit for this wallet.
    (cell code, cell data) = (body~load_ref(), body~load_ref());
    var (_, success?) = extensions.dict_get?(256, cell_hash(code));
    if ~(success?) {
      return (); ;; did not find extension
    }
    ;; Check that the sender indeed has the declared code in its contract.
    (_, int sender_addr_hash) = parse_std_addr(full_msg_slice~load_msg_addr());
    cell state_init = begin_cell().store_uint(0, 2).store_dict(code).store_dict(data).store_uint(0, 1).end_cell();
    if !(sender_addr_hash == cell_hash(state_init)) {
      return (); ;; sender is not our extension
    }
    
    ;; The remainder of the body (up to 2 refs) can now be dispatched
    dispatch_request(body, stored_seqno, stored_subwallet, public_key, extensions);
  }
  if (auth_kind == 0x7369676E) { ;; "sign"
    ;; Process the rest of the slice just like the signed request.
    process_signed_request(body, stored_seqno, stored_subwallet, public_key, extensions);
  }
}


;; Get methods

int seqno() method_id {
  return get_data().begin_parse().preload_uint(32);
}

int get_subwallet_id() method_id {
  return get_data().begin_parse().skip_bits(32).preload_uint(32);
}

int get_public_key() method_id {
  var cs = get_data().begin_parse().skip_bits(64);
  return cs.preload_uint(256);
}

int has_extension(int code_hash) method_id {
  var ds = get_data().begin_parse().skip_bits(32 + 32 + 256);
  var extensions = ds~load_dict();
  var (_, success?) = extensions.dict_get?(256, begin_cell().store_uint(code_hash, 256).end_cell().begin_parse());
  return success?;
}

tuple get_extensions_list() method_id {
  var list = null();
  var ds = get_data().begin_parse().skip_bits(32 + 32 + 256);
  var extensions = ds~load_dict();
  do {
    var (slice, _, f) = extensions~dict::delete_get_min(256);
    if (f) {
      list = cons(slice~load_uint(256), list);
    }
  } until (~ f);
  return list;
}
```
