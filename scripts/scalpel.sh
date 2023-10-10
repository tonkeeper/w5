#!/bin/bash

cd "$(dirname "$0")" || exit
cd ..

if [ ! -f build/wallet_v5.fif ]; then
    mkdir -p build
    echo "Creating comparation origin"
    func contracts/imports/stdlib.fc contracts/wallet_v5.fc > build/wallet_v5.fif
    LINES=$(grep -v -e '^//' -e '^DECLPROC'  -e '^[0-9]\+ DECLMETHOD' build/wallet_v5.fif | wc -l)
    echo "Lines: $LINES"
    echo "Repeat script execution to compare and see more details"
    exit
fi

declare -A mlen
declare -A mlen_new

func contracts/imports/stdlib.fc contracts/wallet_v5.fc > build/wallet_v5_vs.fif
LINES=$(grep -v -e '^//' -e '^DECLPROC'  -e '^[0-9]\+ DECLMETHOD' build/wallet_v5.fif | wc -l)
NLINES=$(grep -v -e '^//' -e '^DECLPROC'  -e '^[0-9]\+ DECLMETHOD' build/wallet_v5_vs.fif | wc -l)


KEY=""
CNT=0
while IFS= read -r line
do
    if [[ "$line" =~ ^"//" ]]; then continue; fi
    if [[ "$line" =~ ^"DECLPROC" ]]; then continue; fi
    if [[ "$line" =~ ^[0-9]+" DECLMETHOD" ]]; then continue; fi
    if ! [[ "$line" =~ ^" " ]]; then
        if [[ "$line" == "}>" ]]; then
            mlen["$KEY"]="$CNT"
        else
            CNT=0
            KEY="$line"
        fi
    else
        CNT=$((CNT+1))
    fi
done < build/wallet_v5.fif

KEY=""
CNT=0
while IFS= read -r line
do
    if [[ "$line" =~ ^"//" ]]; then continue; fi
    if [[ "$line" =~ ^"DECLPROC" ]]; then continue; fi
    if [[ "$line" =~ ^[0-9]+" DECLMETHOD" ]]; then continue; fi
    if ! [[ "$line" =~ ^" " ]]; then
        if [[ "$line" == "}>" ]]; then
            mlen_new["$KEY"]="$CNT"
        else
            CNT=0
            KEY="$line"
        fi
    else
        CNT=$((CNT+1))
    fi
done < build/wallet_v5_vs.fif

RED="\e[31;1m"
YELLOW="\e[33;1m"
GREEN="\e[32;1m"
ENDCOLOR="\e[0m"

echo ""
echo -e "${YELLOW}Lines: $LINES -> $NLINES$ENDCOLOR"
for key in "${!mlen_new[@]}"
do
    PFX=""
    if [ "${mlen_new[$key]}" -gt "${mlen[$key]}" ]; then
        PFX=$RED
    fi
    if [ "${mlen_new[$key]}" -lt "${mlen[$key]}" ]; then
        PFX=$GREEN
    fi
    echo -e "$PFX${mlen[$key]} -> ${mlen_new[$key]} | $key$ENDCOLOR";
done
echo ""
