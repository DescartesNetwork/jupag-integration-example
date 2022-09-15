import { PublicKey, Keypair, Connection, Transaction } from "@solana/web3.js";
import { PoolData, IDL } from "@senswap/balancer";
import * as anchor from "@project-serum/anchor";

import {
  calcNormalizedWeight,
  calcOutGivenInSwap,
  calcPriceImpactSwap,
  mapAddressToAccountInfos,
  utilsBN,
} from "./helper";

const BALANSOL_PROGRAM_ID = "D3BBjqUdCYuP18fNvvMbPAZ8DpcRi4io2EsYHQawJDag";

// TODO: change Dummy provider
const anchorProvider = new anchor.AnchorProvider(
  new Connection("https://ssc-dao.genesysgo.net"),
  {
    signTransaction: async () => new Transaction(),
    signAllTransactions: async () => [new Transaction()],
    publicKey: new PublicKey(""),
  },
  {
    skipPreflight: false,
  }
);
const BALANSOL_CORE = /*#__PURE__*/ new anchor.Program(
  IDL,
  BALANSOL_PROGRAM_ID,
  anchorProvider
);

class BalansolAmm {
  label: string;
  shouldPrefetch: boolean;
  id: PublicKey;
  reserveTokenMints: PublicKey[];
  poolData: PoolData | undefined;

  constructor(address, accountInfo, params) {
    this.label = "Balansol";
    this.shouldPrefetch = false;
    this.id = address;
    this.reserveTokenMints = [...accountInfo.data.mints];
    this.poolData = void 0;
  }

  getAccountsForUpdate() {
    return [this.id];
  }

  update(accountInfoMap) {
    let [newPoolState] = mapAddressToAccountInfos(
      accountInfoMap,
      this.getAccountsForUpdate()
    );
    const poolData = BALANSOL_CORE.coder.accounts.decode(
      "Pool",
      newPoolState.data
    );
    if (!poolData) {
      throw new Error("Invalid token account data");
    }
    this.poolData = poolData;
  }

  getQuote({ sourceMint, destinationMint, amount }) {
    if (!this.poolData) return;
    const mintList = this.poolData.mints.map((mint) => mint.toBase58());
    const bidMintIndex = mintList.indexOf(sourceMint.toBase58());
    const askMintIndex = mintList.indexOf(destinationMint.toBase58());
    const weightIn = calcNormalizedWeight(
      this.poolData.weights,
      this.poolData.weights[bidMintIndex]
    );
    const weightOut = calcNormalizedWeight(
      this.poolData.weights,
      this.poolData.weights[askMintIndex]
    );
    // todo route
    const amountOut = calcOutGivenInSwap(
      amount,
      this.poolData.reserves[askMintIndex],
      this.poolData.reserves[bidMintIndex],
      weightOut,
      weightIn,
      this.poolData.fee.add(this.poolData.taxFee)
    );
    const priceImpact = calcPriceImpactSwap(amount, {
      balanceIn: this.poolData.reserves[bidMintIndex],
      balanceOut: this.poolData.reserves[askMintIndex],
      weightIn,
      weightOut,
      swapFee: this.poolData.fee.add(this.poolData.taxFee),
    });
    const fee = Number(
      utilsBN.undecimalize(this.poolData.fee.add(this.poolData.taxFee), 9)
    );

    return {
      notEnoughLiquidity: false,
      inAmount: amount,
      outAmount: amountOut,
      feeAmount: (amountOut / (1 - fee)) * fee,
      feeMint: destinationMint.toBase58(),
      feePct: 0,
      priceImpactPct: priceImpact,
    };
  }
}
