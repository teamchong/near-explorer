import { sql } from "kysely";
import { z } from "zod";

import {
  indexerDatabase,
  analyticsDatabase,
  telemetryDatabase,
  Indexer,
} from "./databases";
import { DAY } from "../utils/time";
import { config } from "../config";
import {
  teraGasNomination,
  millisecondsToNanoseconds,
  nearNomination,
} from "../utils/bigint";
import { count, sum, max, div } from "./utils";
import { validators } from "../router/validators";

export const queryGenesisAccountCount = async () => {
  return indexerDatabase
    .selectFrom("accounts")
    .select((eb) => count(eb, "id").as("count"))
    .where("created_by_receipt_id", "is", null)
    .executeTakeFirstOrThrow();
};

// query for node information
export const queryTelemetryInfo = async (accountIds: string[]) => {
  const nodesInfo = await telemetryDatabase
    .selectFrom("nodes")
    .select([
      "ip_address",
      "account_id",
      "node_id",
      "last_seen",
      "last_height",
      "status",
      "agent_name",
      "agent_version",
      "agent_build",
      "latitude",
      "longitude",
      "city",
    ])
    .where("account_id", "in", accountIds)
    .orderBy("last_seen")
    .execute();

  const map = new Map<
    string,
    {
      ipAddress: string;
      nodeId: string;
      lastSeen: number;
      lastHeight: number;
      status: string;
      agentName: string;
      agentVersion: string;
      agentBuild: string;
      latitude: string | null;
      longitude: string | null;
      city: string | null;
    }
  >();
  for (const nodeInfo of nodesInfo) {
    map.set(nodeInfo.account_id, {
      ipAddress: nodeInfo.ip_address,
      nodeId: nodeInfo.node_id,
      lastSeen: nodeInfo.last_seen.valueOf(),
      lastHeight: parseInt(nodeInfo.last_height),
      status: nodeInfo.status,
      agentName: nodeInfo.agent_name,
      agentVersion: nodeInfo.agent_version,
      agentBuild: nodeInfo.agent_build,
      latitude: nodeInfo.latitude,
      longitude: nodeInfo.longitude,
      city: nodeInfo.city,
    });
  }
  return map;
};

export const queryStakingPoolAccountIds = async () => {
  const selection = await indexerDatabase
    .selectFrom("accounts")
    .select("account_id as accountId")
    .where(
      "account_id",
      "like",
      `%${config.accountIdSuffix.stakingPool[config.networkName]}`
    )
    .execute();
  return selection.map(({ accountId }) => accountId);
};

export const queryOnlineNodesCount = async () => {
  const selection = await telemetryDatabase
    .selectFrom("nodes")
    .select((eb) => count(eb, "node_id").as("onlineNodesCount"))
    .where("last_seen", ">", sql`now() - '60 seconds'::interval`)
    .executeTakeFirstOrThrow();
  return parseInt(selection.onlineNodesCount);
};

export const queryLatestBlock = async () => {
  const latestBlockHeightSelection = await indexerDatabase
    .selectFrom("blocks")
    .select([
      "block_height as blockHeight",
      (eb) => div(eb, "block_timestamp", 1000 * 1000, "blockTimestampMs"),
    ])
    .orderBy("block_height", "desc")
    .limit(1)
    .executeTakeFirstOrThrow();
  return {
    height: Number(latestBlockHeightSelection.blockHeight),
    timestamp: Number(latestBlockHeightSelection.blockTimestampMs),
  };
};

export const queryLatestGasPrice = async () => {
  const latestGasPriceSelection = await indexerDatabase
    .selectFrom("blocks")
    .select("gas_price")
    .orderBy("block_height", "desc")
    .limit(1)
    .executeTakeFirstOrThrow();
  return latestGasPriceSelection.gas_price;
};

export const queryRecentBlockProductionSpeed = async () => {
  const lastestBlockTimestampSelection = await indexerDatabase
    .selectFrom("blocks")
    .select("block_timestamp")
    .orderBy("block_timestamp", "desc")
    .limit(1)
    .executeTakeFirst();
  if (!lastestBlockTimestampSelection) {
    return 0;
  }
  const { block_timestamp: latestBlockTimestamp } =
    lastestBlockTimestampSelection;
  const latestBlockTimestampBI = BigInt(latestBlockTimestamp);
  const currentUnixTimeBI = BigInt(Math.floor(new Date().getTime() / 1000));
  const latestBlockEpochTimeBI = latestBlockTimestampBI / 1000000000n;
  // If the latest block is older than 1 minute from now, we report 0
  if (currentUnixTimeBI - latestBlockEpochTimeBI > 60) {
    return 0;
  }

  const selection = await indexerDatabase
    .selectFrom("blocks")
    .select((eb) =>
      count(eb, "block_hash").as("blocks_count_60_seconds_before")
    )
    .where(
      "block_timestamp",
      ">",
      sql`cast(
        ${Number(latestBlockEpochTimeBI)} - 60 as bigint
      ) * 1000 * 1000 * 1000`
    )
    .executeTakeFirstOrThrow();
  return parseInt(selection.blocks_count_60_seconds_before) / 60;
};

export const queryRecentTransactionsCount = async () => {
  const selection = await indexerDatabase
    .selectFrom("transactions")
    .select((eb) => count(eb, "transaction_hash").as("total"))
    .where(
      "block_timestamp",
      ">",
      sql`cast(
        extract(
          epoch from now() - '1 day'::interval
        ) as bigint
      ) * 1000 * 1000 * 1000`
    )
    .executeTakeFirstOrThrow();

  return parseInt(selection.total);
};

// query for statistics and charts
// transactions related
export const queryTransactionsHistory = async () => {
  const selection = await analyticsDatabase
    .selectFrom("daily_transactions_count")
    .select(["collected_for_day as date", "transactions_count as count"])
    .orderBy("date")
    .execute();
  return selection.map<[number, number]>((row) => [
    row.date.valueOf(),
    Number(row.count),
  ]);
};

export const queryGasUsedAggregatedByDate = async () => {
  const selection = await analyticsDatabase
    .selectFrom("daily_gas_used")
    .select(["collected_for_day as date", "gas_used as gasUsed"])
    .orderBy("date")
    .execute();
  return selection.map<[number, number]>(({ date, gasUsed }) => [
    date.valueOf(),
    Number(BigInt(gasUsed) / teraGasNomination),
  ]);
};

// accounts
export const queryNewAccountsCountAggregatedByDate = async () => {
  const selection = await analyticsDatabase
    .selectFrom("daily_new_accounts_count")
    .select([
      "collected_for_day as date",
      "new_accounts_count as accountsCount",
    ])
    .orderBy("date")
    .execute();
  return selection.map<[number, number]>(({ date, accountsCount }) => [
    date.valueOf(),
    accountsCount,
  ]);
};

export const queryDeletedAccountsCountAggregatedByDate = async () => {
  const selection = await analyticsDatabase
    .selectFrom("daily_deleted_accounts_count")
    .select([
      "collected_for_day as date",
      "deleted_accounts_count as accountsCount",
    ])
    .orderBy("date")
    .execute();
  return selection.map<[number, number]>(({ date, accountsCount }) => [
    date.valueOf(),
    accountsCount,
  ]);
};

export const queryActiveAccountsCountAggregatedByDate = async () => {
  const selection = await analyticsDatabase
    .selectFrom("daily_active_accounts_count")
    .select([
      "collected_for_day as date",
      "active_accounts_count as accountsCount",
    ])
    .orderBy("date")
    .execute();
  return selection.map<[number, number]>(({ date, accountsCount }) => [
    date.valueOf(),
    accountsCount,
  ]);
};

export const queryActiveAccountsCountAggregatedByWeek = async () => {
  const selection = await analyticsDatabase
    .selectFrom("weekly_active_accounts_count")
    .select([
      "collected_for_week as date",
      "active_accounts_count as accountsCount",
    ])
    .orderBy("date")
    .execute();
  return selection.map<[number, number]>(({ date, accountsCount }) => [
    date.valueOf(),
    accountsCount,
  ]);
};

export const queryActiveAccountsList = async () => {
  const selection = await analyticsDatabase
    .selectFrom("daily_outgoing_transactions_per_account_count")
    .select([
      "account_id as accountId",
      (eb) => sum(eb, "outgoing_transactions_count").as("transactionsCount"),
    ])
    .where(
      "collected_for_day",
      ">=",
      sql`date_trunc(
        'day', now() - '2 week'::interval
      )`
    )
    .groupBy("account_id")
    .orderBy("transactionsCount", "desc")
    .limit(10)
    .execute();
  return selection.map<[string, number]>(({ accountId, transactionsCount }) => [
    accountId,
    Number(transactionsCount || 0),
  ]);
};

// contracts
export const queryNewContractsCountAggregatedByDate = async () => {
  const selection = await analyticsDatabase
    .selectFrom("daily_new_contracts_count")
    .select([
      "collected_for_day as date",
      "new_contracts_count as contractsCount",
    ])
    .orderBy("date")
    .execute();

  return selection.map<[number, number]>(({ date, contractsCount }) => [
    date.valueOf(),
    contractsCount,
  ]);
};

export const queryUniqueDeployedContractsCountAggregatedByDate = async () => {
  const selection = await analyticsDatabase
    .selectFrom("daily_new_unique_contracts_count")
    .select([
      "collected_for_day as date",
      "new_unique_contracts_count as contractsCount",
    ])
    .orderBy("date")
    .execute();

  return selection.map<[number, number]>(({ date, contractsCount }) => [
    date.valueOf(),
    contractsCount,
  ]);
};

export const queryActiveContractsCountAggregatedByDate = async () => {
  const selection = await analyticsDatabase
    .selectFrom("daily_active_contracts_count")
    .select([
      "collected_for_day as date",
      "active_contracts_count as contractsCount",
    ])
    .orderBy("date")
    .execute();

  return selection.map<[number, number]>(({ date, contractsCount }) => [
    date.valueOf(),
    contractsCount,
  ]);
};

export const queryActiveContractsList = async () => {
  const selection = await analyticsDatabase
    .selectFrom("daily_receipts_per_contract_count")
    .select([
      "contract_id as accountId",
      (eb) => sum(eb, "receipts_count").as("receiptsCount"),
    ])
    .where(
      "collected_for_day",
      ">=",
      sql`date_trunc(
        'day', now() - '2 week'::interval
      )`
    )
    .groupBy("contract_id")
    .orderBy("receiptsCount", "desc")
    .limit(10)
    .execute();

  return selection.map<[string, number]>(({ accountId, receiptsCount }) => [
    accountId,
    Number(receiptsCount || 0),
  ]);
};

export const queryTokensSupply = async () => {
  const selection = await indexerDatabase
    .selectFrom("aggregated__circulating_supply")
    .select([
      sql<Date>`date_trunc(
        'day',
        to_timestamp(
          div(
            computed_at_block_timestamp, 1000 * 1000 * 1000
          )
        )
      )`.as("date"),
      "circulating_tokens_supply as circulatingSupply",
      "total_tokens_supply as totalSupply",
    ])
    .orderBy("date")
    .execute();
  return selection.map<[number, number, number]>(
    ({ date, totalSupply, circulatingSupply }) => [
      date.valueOf(),
      Number(BigInt(totalSupply) / nearNomination),
      Number(BigInt(circulatingSupply) / nearNomination),
    ]
  );
};

export const healthCheck = async () => {
  await sql`select 1`.execute(indexerDatabase);
};
