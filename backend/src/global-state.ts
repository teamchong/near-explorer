import { CachedTimestampMap } from "./cron/types";
import {
  CurrentEpochState,
  HealthStatus,
  ValidatorDescription,
  ValidatorPoolInfo,
} from "./types";

export type GlobalState = {
  transactionsCountHistoryForTwoWeeks: { date: Date; total: number }[];
  stakingPoolsDescriptions: Map<string, ValidatorDescription>;
  stakingPoolStakeProposalsFromContract: CachedTimestampMap<string>;
  stakingPoolInfos: CachedTimestampMap<ValidatorPoolInfo>;
  poolIds: string[];
  currentEpochState: CurrentEpochState | null;
  rpcStatus: HealthStatus;
  indexerStatus: HealthStatus;
};

export const initGlobalState = (): GlobalState => ({
  transactionsCountHistoryForTwoWeeks: [],
  stakingPoolsDescriptions: new Map(),
  stakingPoolStakeProposalsFromContract: {
    timestampMap: new Map(),
    valueMap: new Map(),
    promisesMap: new Map(),
  },
  stakingPoolInfos: {
    timestampMap: new Map(),
    valueMap: new Map(),
    promisesMap: new Map(),
  },
  poolIds: [],
  currentEpochState: null,
  rpcStatus: { timestamp: Date.now(), ok: true },
  indexerStatus: { timestamp: Date.now(), ok: true },
});
