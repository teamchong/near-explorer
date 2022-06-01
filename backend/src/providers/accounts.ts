import { sha256 } from "js-sha256";
import { z } from "zod";

import { config } from "../config";
import {
  queryIndexedAccount,
  queryAccountsList,
  queryAccountInfo,
  queryIncomeTransactionsCountFromAnalytics,
  queryIncomeTransactionsCountFromIndexerForLastDay,
  queryOutcomeTransactionsCountFromAnalytics,
  queryOutcomeTransactionsCountFromIndexerForLastDay,
  queryBalanceChanges,
} from "../database/queries";
import * as transactions from "./transactions";
import * as receipts from "./receipts";
import { validators } from "../router/validators";
import * as nearApi from "../utils/near";

export const isAccountIndexed = async (accountId: string): Promise<boolean> => {
  const account = await queryIndexedAccount(accountId);
  return Boolean(account?.account_id);
};

export const getAccountsList = async (limit: number, cursor?: number) => {
  const accountsList = await queryAccountsList(limit, cursor);
  return accountsList.map((account) => ({
    accountId: account.account_id,
    accountIndex: parseInt(account.account_index),
  }));
};

const queryAccountIncomeTransactionsCount = async (accountId: string) => {
  const {
    in_transactions_count: inTxCountFromAnalytics,
    last_day_collected_timestamp: lastDayCollectedTimestamp,
  } = await queryIncomeTransactionsCountFromAnalytics(accountId);
  const inTxCountFromIndexer = await queryIncomeTransactionsCountFromIndexerForLastDay(
    accountId,
    lastDayCollectedTimestamp
  );
  return inTxCountFromAnalytics + inTxCountFromIndexer;
};

const queryAccountOutcomeTransactionsCount = async (accountId: string) => {
  const {
    out_transactions_count: outTxCountFromAnalytics,
    last_day_collected_timestamp: lastDayCollectedTimestamp,
  } = await queryOutcomeTransactionsCountFromAnalytics(accountId);
  const outTxCountFromIndexer = await queryOutcomeTransactionsCountFromIndexerForLastDay(
    accountId,
    lastDayCollectedTimestamp
  );
  return outTxCountFromAnalytics + outTxCountFromIndexer;
};

export const getAccountTransactionsCount = async (accountId: string) => {
  const [inTransactionsCount, outTransactionsCount] = await Promise.all([
    queryAccountOutcomeTransactionsCount(accountId),
    queryAccountIncomeTransactionsCount(accountId),
  ]);
  return {
    inTransactionsCount,
    outTransactionsCount,
  };
};

export const getAccountInfo = async (accountId: string) => {
  const accountInfo = await queryAccountInfo(accountId);
  if (!accountInfo) {
    return null;
  }
  return {
    accountId: accountInfo.accountId,
    created: accountInfo.created
      ? {
          hash: accountInfo.created.hash,
          timestamp: parseInt(accountInfo.created.timestamp),
        }
      : undefined,
    deleted: accountInfo.deleted
      ? {
          hash: accountInfo.deleted.hash,
          timestamp: parseInt(accountInfo.deleted.timestamp),
        }
      : undefined,
  };
};

export const getAccountChanges = async (
  accountId: string,
  limit: number,
  cursor?: z.infer<typeof validators.accountActivityCursor>
): ReturnType<typeof queryBalanceChanges> => {
  return await queryBalanceChanges(accountId, limit, cursor);
};

function generateLockupAccountIdFromAccountId(accountId: string): string {
  // copied from https://github.com/near/near-wallet/blob/f52a3b1a72b901d87ab2c9cee79770d697be2bd9/src/utils/wallet.js#L601
  return (
    sha256(Buffer.from(accountId)).substring(0, 40) +
    "." +
    config.accountIdSuffix.lockup
  );
}

const isErrorWithMessage = (error: unknown): error is { message: string } => {
  return Boolean(
    typeof error === "object" &&
      error &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
  );
};

function ignoreIfDoesNotExist(error: unknown): null {
  if (
    isErrorWithMessage(error) &&
    (error.message.includes("doesn't exist") ||
      error.message.includes("does not exist") ||
      error.message.includes("MethodNotFound"))
  ) {
    return null;
  }
  throw error;
}

const getLockupAccountId = async (
  accountId: string
): Promise<string | undefined> => {
  if (accountId.endsWith(`.${config.accountIdSuffix.lockup}`)) {
    return;
  }
  const lockupAccountId = generateLockupAccountIdFromAccountId(accountId);
  const account = await nearApi
    .sendJsonRpcQuery("view_account", {
      finality: "final",
      account_id: lockupAccountId,
    })
    .catch(ignoreIfDoesNotExist);
  if (!account) {
    return;
  }
  return lockupAccountId;
};

export const getAccountDetails = async (accountId: string) => {
  const [accountInfo, lockupAccountId] = await Promise.all([
    nearApi
      .sendJsonRpcQuery("view_account", {
        finality: "final",
        account_id: accountId,
      })
      .catch(ignoreIfDoesNotExist),
    getLockupAccountId(accountId),
  ]);

  if (accountInfo === null) {
    return null;
  }

  return {
    storageUsage: accountInfo.storage_usage,
    stakedBalance: accountInfo.locked,
    nonStakedBalance: accountInfo.amount.toString(),
    lockupAccountId,
  };
};

export const getIdsFromAccountChanges = (
  changes: Awaited<ReturnType<typeof queryBalanceChanges>>
) => {
  return changes.reduce<{
    receiptIds: string[];
    transactionHashes: string[];
    blocksTimestamps: string[];
  }>(
    (acc, change) => {
      switch (change.cause) {
        case "CONTRACT_REWARD":
        case "RECEIPT":
          acc.receiptIds.push(change.receiptId!);
          break;
        case "TRANSACTION":
          acc.transactionHashes.push(change.transactionHash!);
          break;
        case "VALIDATORS_REWARD":
          acc.blocksTimestamps.push(change.blockTimestamp);
      }
      return acc;
    },
    {
      receiptIds: [],
      transactionHashes: [],
      blocksTimestamps: [],
    }
  );
};

export type ActivityConnectionActions = {
  parentAction?: AccountActivityAction &
    ActivityConnection &
    ActivityConnectionAccounts;
  childrenActions?: (AccountActivityAction &
    ActivityConnection &
    ActivityConnectionAccounts)[];
};

export type ActivityConnectionAccounts = {
  sender: string;
  receiver: string;
};

export type ActivityConnection = {
  transactionHash: string;
  receiptId?: string;
};

export type AccountTransferAction = {
  type: "transfer";
  deltaAmount: string;
};

export type AccountRefundAction = {
  type: "refund";
  deltaAmount: string;
};

export type AccountValidatorRewardAction = {
  type: "validator-reward";
  blockHash: string;
};

export type AccountContractDeployedAction = {
  type: "contract-deployed";
};

export type AccountAccessKeyCreatedAction = {
  type: "access-key-created";
};

export type AccountAccessKeyRemovedAction = {
  type: "access-key-removed";
};

export type AccountCallMethodAction = {
  type: "call-method";
  methodName: string;
  attachedAmount: string;
};

export type AccountRestakeAction = {
  type: "restake";
  deltaAmount: string;
};

export type AccountAccountCreatedAction = {
  type: "account-created";
};

export type AccountAccountRemovedAction = {
  type: "account-removed";
};

export type GasRewardAction = {
  type: "gas-reward";
  amount: string;
};

export type AccountBatchAction = {
  type: "batch";
  actions: AccountActivityAction[];
};

export type AccountActivityAction =
  | AccountTransferAction
  | AccountRefundAction
  | AccountValidatorRewardAction
  | AccountContractDeployedAction
  | AccountAccessKeyCreatedAction
  | AccountAccessKeyRemovedAction
  | AccountCallMethodAction
  | AccountRestakeAction
  | AccountAccountCreatedAction
  | AccountAccountRemovedAction
  | AccountBatchAction
  | GasRewardAction;

export type AccountActivityElement = {
  involvedAccountId: string | null;
  cursor: {
    blockTimestamp: string;
    shardId: number;
    indexInChunk: number;
  };
  timestamp: number;
  direction: "inbound" | "outbound";
  deltaAmount: string;
  action: AccountActivityAction &
    ActivityConnectionActions &
    ActivityConnection;
};

const getActivityAction = (
  actions: transactions.Action[],
  isRefund?: boolean
): AccountActivityAction => {
  if (actions.length === 0) {
    throw new Error("Unexpected zero-length array of actions");
  }
  if (actions.length !== 1) {
    return {
      type: "batch",
      actions: actions.map((action) => getActivityAction([action], isRefund)),
    };
  }
  switch (actions[0].kind) {
    case "AddKey":
      return {
        type: "access-key-created",
      };
    case "CreateAccount":
      return {
        type: "account-created",
      };
    case "DeleteAccount":
      return {
        type: "account-removed",
      };
    case "DeleteKey":
      return {
        type: "access-key-removed",
      };
    case "DeployContract":
      return {
        type: "contract-deployed",
      };
    case "FunctionCall":
      return {
        type: "call-method",
        methodName: actions[0].args.method_name,
        attachedAmount: actions[0].args.deposit,
      };
    case "Stake":
      return {
        type: "restake",
        deltaAmount: actions[0].args.stake,
      };
    case "Transfer":
      return {
        type: isRefund ? "refund" : "transfer",
        deltaAmount: actions[0].args.deposit,
      };
  }
};

const withActivityConnection = <T>(
  input: T,
  source?: receipts.Receipt | transactions.TransactionBaseInfo
): T & ActivityConnection => {
  if (!source) {
    return {
      ...input,
      transactionHash: "",
    };
  }
  if ("receiptId" in source) {
    return {
      ...input,
      transactionHash: source.originatedFromTransactionHash,
      receiptId: source.receiptId,
    };
  }
  return {
    ...input,
    transactionHash: source.hash,
  };
};

const withConnections = <T>(
  input: T,
  source: receipts.Receipt | transactions.TransactionBaseInfo
): T & ActivityConnectionAccounts => {
  return {
    ...input,
    sender: source.signerId,
    receiver: source.receiverId,
  };
};

export const getAccountActivityAction = (
  change: Awaited<ReturnType<typeof queryBalanceChanges>>[number],
  receiptsMapping: Map<string, receipts.Receipt>,
  transactionsMapping: Map<string, transactions.TransactionBaseInfo>,
  blockHeightsMapping: Map<string, { hash: string }>,
  receiptRelations: Map<
    string,
    { parentReceiptId: string | null; childrenReceiptIds: string[] }
  >
): AccountActivityElement["action"] => {
  switch (change.cause) {
    case "CONTRACT_REWARD": {
      const connectedReceipt = receiptsMapping.get(change.receiptId!)!;
      return withActivityConnection(
        {
          type: "gas-reward",
          amount: change.deltaStakedAmount,
        },
        connectedReceipt
      );
    }
    case "RECEIPT": {
      const connectedReceipt = receiptsMapping.get(change.receiptId!)!;
      const relation = receiptRelations.get(change.receiptId!)!;
      const parentReceipt = relation.parentReceiptId
        ? receiptsMapping.get(relation.parentReceiptId)!
        : undefined;
      const childrenReceipts = relation.childrenReceiptIds.map(
        (childrenReceiptId) => receiptsMapping.get(childrenReceiptId)!
      );
      return withActivityConnection(
        {
          ...getActivityAction(
            connectedReceipt.actions,
            !change.involvedAccountId
          ),
          parentAction: parentReceipt
            ? withConnections(
                withActivityConnection(
                  getActivityAction(
                    parentReceipt.actions,
                    parentReceipt.signerId === "system"
                  ),
                  parentReceipt
                ),
                parentReceipt
              )
            : undefined,
          childrenActions: childrenReceipts.map((receipt) =>
            withConnections(
              withActivityConnection(
                getActivityAction(
                  receipt.actions,
                  receipt.signerId === "system"
                ),
                receipt
              ),
              receipt
            )
          ),
        },
        connectedReceipt
      );
    }
    case "TRANSACTION": {
      const connectedTransaction = transactionsMapping.get(
        change.transactionHash!
      )!;
      return withActivityConnection(
        {
          ...getActivityAction(
            connectedTransaction.actions,
            !change.involvedAccountId
          ),
          childrenActions: [],
        },
        connectedTransaction
      );
    }
    case "VALIDATORS_REWARD":
      const connectedBlock = blockHeightsMapping.get(change.blockTimestamp!)!;
      return withActivityConnection({
        type: "validator-reward",
        blockHash: connectedBlock.hash,
      });
  }
};
