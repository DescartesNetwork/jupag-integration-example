import { BN } from "@project-serum/anchor";

export type PoolPairData = {
  balanceIn: BN;
  balanceOut: BN;
  weightIn: number;
  weightOut: number;
  swapFee: BN;
};
