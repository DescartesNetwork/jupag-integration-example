import { BN } from "@project-serum/anchor";
import { PoolPairData } from "./type";

const PRECISION = 10 ** 9;
const DECIMAL = 9;

export const calcOutGivenInSwap = (
  amountIn: number,
  balanceOut: BN,
  balanceIn: BN,
  weightOut: number,
  weightIn: number,
  swapFee: BN
) => {
  const numBalanceOut = Number(utilsBN.undecimalize(balanceOut, DECIMAL));
  const numBalanceIn = Number(utilsBN.undecimalize(balanceIn, DECIMAL));
  const numSwapFee = utilsBN.toNumber(swapFee) / PRECISION;
  const ratioBeforeAfterBalance = numBalanceIn / (numBalanceIn + amountIn);
  const ratioInOutWeight = weightIn / weightOut;
  return (
    numBalanceOut *
    (1 - ratioBeforeAfterBalance ** ratioInOutWeight) *
    (1 - numSwapFee)
  );
};

export const calcNormalizedWeight = (
  weights: BN[],
  weightToken: BN
): number => {
  const numWeights = weights.map((value) =>
    Number(utilsBN.undecimalize(value, 9))
  );
  const numWeightToken = Number(utilsBN.undecimalize(weightToken, DECIMAL));
  const weightSum = numWeights.reduce((pre, curr) => pre + curr, 0);
  return numWeightToken / weightSum;
};

export const calcSpotPriceExactInSwap = (
  amount: number,
  poolPairData: PoolPairData
) => {
  const { balanceIn, balanceOut, weightIn, weightOut, swapFee } = poolPairData;
  const Bi = Number(utilsBN.undecimalize(balanceIn, DECIMAL));
  const Bo = Number(utilsBN.undecimalize(balanceOut, DECIMAL));
  const wi = weightIn;
  const wo = weightOut;
  const f = utilsBN.toNumber(swapFee) / PRECISION;
  return -(
    (Bi * wo) /
    (Bo * (-1 + f) * (Bi / (amount + Bi - amount * f)) ** ((wi + wo) / wo) * wi)
  );
};

export const calcPriceImpactSwap = (
  bidAmount: number,
  poolPairData: PoolPairData
) => {
  const currentSpotPrice = calcSpotPriceExactInSwap(0, poolPairData);
  const spotPriceAfterSwap = calcSpotPriceExactInSwap(bidAmount, poolPairData);
  if (spotPriceAfterSwap < currentSpotPrice) return 0;
  const impactPrice = 1 - currentSpotPrice / spotPriceAfterSwap;
  return impactPrice;
};

export const utilsBN = {
  /**
   * Add decimals to the number
   * @param num
   * @param decimals
   * @returns
   */
  decimalize: (num: string | number, decimals: number): BN => {
    if (!num) return new BN(0);
    if (decimals < 0 || decimals % 1 !== 0)
      throw new Error("decimals must be an integer greater than zero");
    const n = num.toString();
    if (!decimals) return new BN(n);
    const m = n.split(".");
    if (m.length > 2) throw new Error("Invalid number");
    if (m.length === 1) return new BN(num).mul(new BN(10 ** decimals));
    if (m[1].length >= decimals)
      return new BN(m[0] + m[1].substring(0, decimals));
    else return new BN(m[0] + m[1] + "0".repeat(decimals - m[1].length));
  },

  /**
   * Remove decimals from the number
   * @param numBN
   * @param decimals
   * @returns
   */
  undecimalize: (numBN: BN, decimals: number): string => {
    if (decimals < 0 || decimals % 1 !== 0)
      throw new Error("decimals must be an integer greater than zero");
    if (!numBN) return "0";
    const n = numBN.toString();
    if (!decimals) return n;

    let integer =
      n.length > decimals ? n.substring(0, n.length - decimals) : "0";
    let fraction: string | string[] = "";
    if (n.length > decimals)
      fraction = n.substring(n.length - decimals, n.length);
    else if (n.length === decimals) fraction = n;
    else fraction = "0".repeat(decimals - n.length) + n;

    fraction = `${fraction}`.split("");
    while (fraction[fraction.length - 1] === "0") fraction.pop();
    fraction = fraction.join("");
    if (!fraction) return integer;
    return integer + "." + fraction;
  },

  toNumber: (numBN: BN): number => {
    return Number(utilsBN.undecimalize(numBN, 0));
  },
};

export const mapAddressToAccountInfos = (accountInfoMap, addresses) => {
  const accountInfos = addresses.map((address) => {
    const accountInfo = accountInfoMap.get(address.toString());

    if (!accountInfo) {
      throw new Error(`Account info ${address.toBase58()} missing`);
    }

    return accountInfo;
  });
  return accountInfos;
};
