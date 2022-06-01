import {
  queryReceiptsCountInBlock,
  queryReceiptInTransaction,
  queryIncludedReceiptsList,
  queryExecutedReceiptsList,
  queryReceiptsByIds,
  queryRelatedReceiptsIds,
} from "../database/queries";

import {
  convertDbArgsToRpcArgs,
  getIndexerCompatibilityTransactionActionKinds,
  Action,
} from "./transactions";
import { nanosecondsToMilliseconds } from "../utils/bigint";

export type ReceiptExecutionStatus =
  | "Unknown"
  | "Failure"
  | "SuccessValue"
  | "SuccessReceiptId";

const INDEXER_COMPATIBILITY_RECEIPT_ACTION_KINDS = new Map<
  string | null,
  ReceiptExecutionStatus
>([
  ["SUCCESS_RECEIPT_ID", "SuccessReceiptId"],
  ["SUCCESS_VALUE", "SuccessValue"],
  ["FAILURE", "Failure"],
  [null, "Unknown"],
]);

export const getIndexerCompatibilityReceiptActionKinds = () => {
  return INDEXER_COMPATIBILITY_RECEIPT_ACTION_KINDS;
};

export type Receipt = {
  actions: Action[];
  blockTimestamp: number;
  receiptId: string;
  gasBurnt: string;
  receiverId: string;
  signerId: string;
  status?: ReceiptExecutionStatus;
  originatedFromTransactionHash: string;
  tokensBurnt: string;
};

function groupReceiptActionsIntoReceipts(
  receiptActions: Awaited<ReturnType<typeof queryIncludedReceiptsList>>
): Receipt[] {
  // The receipt actions are ordered in such a way that the actions for a single receipt go
  // one after another in a correct order, so we can collect them linearly using a moving
  // window based on the `previousReceiptId`.
  const receipts: Receipt[] = [];
  let actions: Action[] = [];
  let previousReceiptId = "";
  const indexerCompatibilityTransactionActionKinds = getIndexerCompatibilityTransactionActionKinds();
  for (const receiptAction of receiptActions) {
    if (previousReceiptId !== receiptAction.receipt_id) {
      previousReceiptId = receiptAction.receipt_id;
      actions = [];
      receipts.push({
        actions,
        blockTimestamp: nanosecondsToMilliseconds(
          BigInt(receiptAction.executed_in_block_timestamp)
        ),
        gasBurnt: receiptAction.gas_burnt,
        receiptId: receiptAction.receipt_id,
        receiverId: receiptAction.receiver_id,
        signerId: receiptAction.predecessor_id,
        status: INDEXER_COMPATIBILITY_RECEIPT_ACTION_KINDS.get(
          receiptAction.status
        ),
        originatedFromTransactionHash:
          receiptAction.originated_from_transaction_hash,
        tokensBurnt: receiptAction.tokens_burnt,
      });
    }
    actions.push({
      args: convertDbArgsToRpcArgs(receiptAction.kind, receiptAction.args),
      kind: indexerCompatibilityTransactionActionKinds.get(receiptAction.kind)!,
    } as Action);
  }

  return receipts;
}

// As a temporary solution we split receipts list into two lists:
// included in block and executed in block
// more info here https://github.com/near/near-explorer/pull/868
export const getIncludedReceiptsList = async (
  blockHash: string
): Promise<Receipt[]> => {
  const receiptActions = await queryIncludedReceiptsList(blockHash);
  return groupReceiptActionsIntoReceipts(receiptActions);
};

export const getExecutedReceiptsList = async (
  blockHash: string
): Promise<Receipt[]> => {
  const receiptActions = await queryExecutedReceiptsList(blockHash);
  return groupReceiptActionsIntoReceipts(receiptActions);
};

export const getReceiptsByIds = async (
  ids: string[]
): Promise<Map<string, Receipt>> => {
  if (ids.length === 0) {
    return new Map();
  }
  const receiptRows = await queryReceiptsByIds(ids);
  const receipts = groupReceiptActionsIntoReceipts(receiptRows);
  return receipts.reduce<Map<string, Receipt>>((acc, receipt) => {
    acc.set(receipt.receiptId, receipt);
    return acc;
  }, new Map());
};

export const getRelatedReceiptsByIds = async (
  prevReceiptsMapping: Map<string, Receipt>
): Promise<{
  receiptsMapping: Map<string, Receipt>;
  relations: Map<
    string,
    { parentReceiptId: string | null; childrenReceiptIds: string[] }
  >;
}> => {
  const ids = [...prevReceiptsMapping.keys()];
  if (ids.length === 0) {
    return {
      receiptsMapping: prevReceiptsMapping,
      relations: new Map(),
    };
  }
  const relatedResult = await queryRelatedReceiptsIds(ids);
  const relations = ids.reduce<
    Map<
      string,
      { parentReceiptId: string | null; childrenReceiptIds: string[] }
    >
  >((acc, id) => {
    let relatedIds: {
      parentReceiptId: string | null;
      childrenReceiptIds: string[];
    } = {
      parentReceiptId: null,
      childrenReceiptIds: [],
    };
    const parentRow = relatedResult.find((row) => row.producedReceiptId === id);
    if (parentRow) {
      relatedIds.parentReceiptId = parentRow.executedReceiptId;
    }
    const childrenRows = relatedResult.filter(
      (row) => row.executedReceiptId === id
    );
    if (childrenRows.length !== 0) {
      relatedIds.childrenReceiptIds = childrenRows.map(
        (row) => row.producedReceiptId
      );
    }
    acc.set(id, relatedIds);
    return acc;
  }, new Map());
  const prevReceiptIds = [...prevReceiptsMapping.keys()];
  const lookupIds = [...relations.values()].reduce<Set<string>>(
    (acc, relation) => {
      if (
        relation.parentReceiptId &&
        !prevReceiptIds.includes(relation.parentReceiptId)
      ) {
        acc.add(relation.parentReceiptId);
      }
      const filteredChildrenIds = relation.childrenReceiptIds.filter(
        (id) => !prevReceiptIds.includes(id)
      );
      filteredChildrenIds.forEach((id) => acc.add(id));
      return acc;
    },
    new Set()
  );
  const receiptRows = await queryReceiptsByIds([...lookupIds]);
  const receipts = groupReceiptActionsIntoReceipts(receiptRows);
  return {
    receiptsMapping: receipts.reduce<Map<string, Receipt>>((acc, receipt) => {
      acc.set(receipt.receiptId, receipt);
      return acc;
    }, new Map(prevReceiptsMapping)),
    relations,
  };
};

export const getReceiptsCountInBlock = async (
  blockHash: string
): Promise<number | null> => {
  const receiptsCount = await queryReceiptsCountInBlock(blockHash);
  if (!receiptsCount) {
    return null;
  }
  return parseInt(receiptsCount.count);
};

export type TransactionHashByReceiptId = {
  receiptId: string;
  originatedFromTransactionHash: string;
};

export const getReceiptInTransaction = async (
  receiptId: string
): Promise<TransactionHashByReceiptId | null> => {
  const transactionInfo = await queryReceiptInTransaction(receiptId);
  if (!transactionInfo) {
    return null;
  }
  return {
    receiptId: transactionInfo.receipt_id,
    originatedFromTransactionHash:
      transactionInfo.originated_from_transaction_hash,
  };
};
