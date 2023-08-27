.PHONY: all

boc: func
	fift contracts/print.fif > artifacts/wallet.boc

func:
	func -PA contracts/wallet.fc > artifacts/wallet.fif
