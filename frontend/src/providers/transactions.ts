import BN from "bn.js";
import {
  TransactionId,
  Bytes,
  UTCTimestamp,
  YoctoNEAR,
} from "../libraries/types";
import { Action, RPC } from "../libraries/wamp/types";
import { Transaction } from "../pages/transactions/[hash]";
import { WampCall } from "../libraries/wamp/api";

export enum TransactionError {
  Internal = -1,
}

const mapRpcActionToAction = (action: RPC.ActionView): Action => {
  if (action === "CreateAccount") {
    return {
      kind: "CreateAccount",
      args: {},
    };
  }
  const kind = Object.keys(action)[0] as keyof Exclude<
    RPC.ActionView,
    "CreateAccount"
  >;
  return {
    kind,
    args: action[kind],
  } as Action;
};

export const getTransaction = async (
  wampCall: WampCall,
  hash: TransactionId
): Promise<Transaction | null> => {
  try {
    const wampCallTransaction = await wampCall("transaction", [hash]);
    console.log("getTransaction | wampCallTransaction", wampCallTransaction);

    const {
      hash: transactionHash,
      created,
      transactionIndex,
      status,
      transaction,
      transactionOutcome,
      receipts,
      receiptsOutcome,
    } = wampCallTransaction;

    const txActions = transaction.actions?.map(mapRpcActionToAction);

    if (
      receipts.length === 0 ||
      receipts[0].receipt_id !== receiptsOutcome[0].id
    ) {
      receipts.unshift({
        predecessor_id: transaction.signer_id,
        receipt: {
          Action: {
            signer_id: transaction.signer_id,
            signer_public_key: "",
            gas_price: "0",
            output_data_receivers: [],
            input_data_ids: [],
            actions: transaction.actions,
          },
        },
        receipt_id: receiptsOutcome[0].id,
        receiver_id: transaction.receiver_id,
      });
    }

    const receiptOutcomesByIdMap = new Map<
      string,
      RPC.ExecutionOutcomeWithIdView
    >();
    receiptsOutcome.forEach((receipt) => {
      receiptOutcomesByIdMap.set(receipt.id, receipt);
    });

    const receiptsByIdMap = new Map<
      string,
      Omit<RPC.ReceiptView, "actions"> & { actions: Action[] }
    >();
    receipts.forEach((receiptItem) => {
      receiptsByIdMap.set(receiptItem.receipt_id, {
        ...receiptItem,
        actions:
          "Action" in receiptItem.receipt
            ? receiptItem.receipt.Action.actions.map(mapRpcActionToAction)
            : [],
      });
    });

    const receiptsMap = new Map();

    const collectNestedReceiptWithOutcome = (receiptHash: string) => {
      const receipt = receiptsByIdMap.get(receiptHash);
      const receiptOutcome = receiptOutcomesByIdMap.get(receiptHash);

      const _receipt = {
        actions: receipt?.actions,
        signerId: receipt?.predecessor_id,
      };

      const outcome = {
        includedInBlockHash: receiptOutcome.block_hash,
        receiptId: receiptOutcome.id,
        receiverId: receiptOutcome.outcome.executor_id,
        gasBurnt: receiptOutcome.outcome.gas_burnt,
        tokensBurnt: receiptOutcome.outcome.tokens_burnt,
        logs: receiptOutcome.outcome.logs,
        status: receiptOutcome.outcome.status,
      };

      receiptsMap.set(receiptHash, {
        ..._receipt,
        ...outcome,
      });

      receiptOutcome.outcome.receipt_ids.forEach((executedReceipt: string) =>
        collectNestedReceiptWithOutcome(executedReceipt)
      );

      return {
        ...receipt,
        ...receiptOutcome,
        outcome: {
          ...receiptOutcome.outcome,
          outgoing_receipts: receiptOutcome.outcome.receipt_ids.map(
            (executedReceipt: string) =>
              collectNestedReceiptWithOutcome(executedReceipt)
          ),
        },
      };
    };

    // const deposit = transaction.actions
    //   .map((action: Action) => {
    //     if ("deposit" in action.args) {
    //       return new BN(action.args.deposit);
    //     } else {
    //       return new BN(0);
    //     }
    //   })
    //   .reduce((accumulator: BN, deposit: BN) => accumulator.add(deposit), new BN(0))
    //   .toString() as string;

    const _gasBurntByTx = transactionOutcome
      ? new BN(transactionOutcome.outcome.gas_burnt)
      : new BN(0);
    const _gasBurntByReceipts = receiptsOutcome
      ? receiptsOutcome
          .map((receipt) => new BN(receipt.outcome.gas_burnt))
          .reduce(
            (gasBurnt: BN, currentFee: BN) => gasBurnt.add(currentFee),
            new BN(0)
          )
      : new BN(0);
    const gasUsed = _gasBurntByTx.add(_gasBurntByReceipts).toString() as string;

    const _actionArgs = txActions.map((action: Action) => action.args);
    const _gasAttachedArgs = _actionArgs.filter((args) => "gas" in args);
    const gasAttached =
      _gasAttachedArgs.length === 0
        ? gasUsed
        : (_gasAttachedArgs
            .reduce(
              (accumulator: BN, args) =>
                accumulator.add(new BN(args.gas.toString())),
              new BN(0)
            )
            .toString() as string);

    const _tokensBurntByTx = transactionOutcome
      ? new BN(transactionOutcome.outcome.tokens_burnt)
      : new BN(0);
    const _tokensBurntByReceipts = receiptsOutcome
      ? receiptsOutcome
          .map((receipt) => new BN(receipt.outcome.tokens_burnt))
          .reduce(
            (tokenBurnt: BN, currentFee: BN) => tokenBurnt.add(currentFee),
            new BN(0)
          )
      : new BN(0);
    const transactionFee = _tokensBurntByTx
      .add(_tokensBurntByReceipts)
      .toString() as string;

    // const { actions, ...info } = wampCallTransaction.transactionInfo;

    collectNestedReceiptWithOutcome(receiptsOutcome[0].id);

    const response = {
      hash: transactionHash,
      created,
      transaction,
      transactionIndex,
      transactionFee,
      transactionOutcome,
      status,
      gasUsed,
      gasAttached,
      receipts: [...receiptsMap.values()],
      receipt: collectNestedReceiptWithOutcome(receiptsOutcome[0].id),
      receiptsOutcome,
    };

    return response;
  } catch (e) {
    throw {
      error: TransactionError.Internal,
      details: e,
    };
  }
};
