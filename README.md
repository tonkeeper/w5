# Extensible Wallet V5

Author: Oleg Andreev <oleg@tonkeeper.com>

This is an extensible wallet specification aimed at replacing V4 and allowing arbitrary extensions.

Features:

* Arbitrary amount of outgoing messages is supported via snake encoding.
* Unlimited number of plugins can be deployed sharing the same code.
* Wallet code can be extended by anyone in a decentralized and conflict-free way: multiple feature extensions can co-exist.
* Plugins can perform the same operations as the signer: emit arbitrary messages on behalf of the owner, add and remove extensions.
* Signed requests can be delivered via internal message to allow 3rd party pay for gas.

## Overview

Wallet supports **2 authentication modes** and **4 operation types**:

Authentication: 
* signature 
* installed plugin

Operation types:
* outgoing message
* install extension
* remove extension
* tail-call: more of the above

Signed messages can be delivered both by external and internal messages.

All operation types are available to all authentication modes.

Tail-call operation permits chaining arbitrary number of operations, thus more than 4 messages can be added in a single transaction.


## FAQ

#### Q: Can user not pay the gas fees?

A: Yes! You can deliver signed messages via an internal message from a 3rd party wallet. Also, the message is handled exactly like an external one: after the basic checks the wallet takes care of the fees itself, so that 3rd party does not need to overpay for users who actually do have TONs.

#### Q: Does the wallet grow with number of plugins?

A: Not really. Wallet only accumulates code extensions. So if even you have 100500 plugins based on just three types of contracts, your wallet would only store extra ≈96 bytes of data.

#### Q: Can plugins implement subscriptions that collect tokens?

A: Yes. Plugins can emit arbitrary messages, including token transfers, on behalf of the wallet.

#### Q: How can a plugin collect funds?

A: Plugin needs to send a request with a message to its own address.

#### Q: How can a plugin self-destruct?

A: Plugin does not need to remove its extension code from the wallet — they can simply self-destroy by sending all TONs to the wallet with sendmode 128.

#### Q: How can I deploy a plugin, install its code and send it a message in one go?

A: You need two requests in your message body: first one installs the extension code, the second one sends raw message to your plugin address.

#### Q: Wallet only stores the extension code, how does it know which plugins it actually installed?

A: You need to design extensions in such way that each plugin checks that it was deployed by its proper wallet. See how NFT items or jetton wallets do that. Your wallet can only trust the extension code that was audited to perform such authenticated initialization.



## TODO

* Testing and review
* Optimize transmission of code/data pair for plugin authentication. We only really need 2 hashes to reconstruct sender's address.
* Other code optimizations


## Wallet ID

Wallet ID disambiguates requests signed with the same public key to different wallet versions (V3/V4/V5) or wallets deployed on different chains.

For Wallet V5 we suggest using the following wallet ID:

```
20230820 + workchain
```

## TL-B definitions

Signed request:

```
signed_request$_ 
  signature:    bits512                   // 512
  subwallet_id: uint32                    // 512+32
  valid_until:  uint32                    // 512+32+32
  msg_seqno:    uint32                    // 512+32+32+32 = 608
  inner: InnerRequest = SignedRequest;       
```

Internal message from extension:

```
internal_extension#6578746E 
   code:^Cell
   data:^Cell
   inner:InnerRequest 
= InternalMsgBody;
```

Internal message carrying a signed request:

```
internal_signed#7369676E
   signed:SignedRequest
= InternalMsgBody;
```

Arbitrary transfer or notification (no-op):
```
other$_ = InternalMsgBody
```

There are 4 types of concrete requests (`InnerRequest`). 

Opcode 0x00: sending a message.

```
msg_request$00 sendmode:uint8 rawmsg:^Cell = InnerRequest;
```

Opcode 0x01: adding extension.

```
extend_request$01 code:^Cell = InnerRequest;
```

Opcode 0x02: removing extension.

```
remove_request$10 code:^Cell = InnerRequest;
```

Opcode 0x03: tail-call into more requests.

```
nested_request$11 inner:^InnerRequest = InnerRequest;
```


## Code

```c
#pragma version =0.2.0;

;; Extensible wallet contract v5

(slice, int) dict_get?(cell dict, int key_len, slice index) asm(index dict key_len) "DICTGET" "NULLSWAPIFNOT";
(cell, int) dict_add_builder?(cell dict, int key_len, slice index, builder value) asm(value index dict key_len) "DICTADDB";
(cell, int) dict_delete?(cell dict, int key_len, slice index) asm(index dict key_len) "DICTDEL";


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

  ;; Read all the requests until we run out of bits.
  while (cs.slice_refs()) {
      int op = cs~load_uint(2);
      
      ;; Emit raw message with a given sendmode.
      if (op == 0) {
          var mode = cs~load_uint(8);
          send_raw_message(cs~load_ref(), mode);
      }
      
      ;; Add/remove extensions
      if (op == 1 || op == 2) {
          cell ext_code = cs~load_ref();
          int key = cell_hash(ext_code);
          ;; Add extension
          if (op == 1) {
              (extensions, int success?) = extensions.dict_add_builder?(256, key, begin_cell());
              throw_unless(39, success?);
          }
          ;; Remove extension
          if (op == 2) {
              (extensions, int success?) = extensions.dict_delete?(256, key);
              throw_unless(39, success?);
          }    
     
          set_data(begin_cell()
            .store_uint(stored_seqno, 32)
            .store_uint(stored_subwallet, 32)
            .store_uint(public_key, 256)
            .store_dict(extensions)
            .end_cell());
      }
      
      ;; Tail-call into a ref to process more requests. 
      ;; This terminates iteration of the refs in this cell.
      if (op == 3) {
          cs = cs~load_ref().begin_parse()
      }
  }
  return ();
}

() recv_external(slice body) impure {
  var ds = get_data().begin_parse();
  var (stored_seqno, stored_subwallet, public_key, extensions) = (ds~load_uint(32), ds~load_uint(32), ds~load_uint(256), ds~load_dict());
  ds.end_parse();
  process_signed_request(body, stored_seqno, stored_subwallet, public_key, extensions);
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


