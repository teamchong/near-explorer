import * as React from "react";
import JSBI from "jsbi";
import { useTranslation } from "react-i18next";
import moment from "moment";
import { styled } from "../../../libraries/styles";
import AccountActivityBadge from "./AccountActivityBadge";
import { shortenString } from "../../../libraries/formatting";
import {
  AccountActivityElementAction,
  AccountActivityElement,
  AccountActivityAction,
  AccountActivityRelatedAction,
} from "../../../types/common";
import { NearAmount } from "../../utils/NearAmount";
import ListHandler from "../../utils/ListHandler";
import * as BI from "../../../libraries/bigint";
import Link from "../../utils/Link";
import CopyToClipboard from "../common/CopyToClipboard";
import { trpc } from "../../../libraries/trpc";
import { useQueryParam } from "../../../hooks/use-query-param";

const ACCOUNT_CHANGES_PER_PAGE = 20;

const TableWrapper = styled("div", {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  fontFamily: "Manrope",
  paddingHorizontal: 24,
  borderRadius: 8,
  border: "1px solid #e8e8e8",
});

const TableHeader = styled("thead", {
  textTransform: "uppercase",
  color: "#c4c4c4",
  borderBottom: "1px solid #e8e8e8",

  fontSize: 12,
  fontWeight: 600,
});

const TableHeaderCell = styled("th", {
  paddingVertical: 20,
});

const TableRow = styled("tr", {
  fontSize: 14,
  fontWeight: 500,
  height: 50,

  "& + &": {
    borderTop: "1px solid #e8e8e8",
  },
});

const TableElement = styled("td", {
  verticalAlign: "top",
  padding: 8,
});

const Amount = styled("div", {
  fontSize: 14,
  fontWeight: 500,

  variants: {
    direction: {
      income: {
        color: "#10AA7F",
      },
      outcome: {
        color: "#C65454",
      },
    },
  },
});

const DateTableElement = styled(TableElement, {
  color: "#9B9B9B",
});

const LinkPrefix = styled("span", { marginRight: 8 });

const CopyWrapper = styled("div", {
  marginLeft: ".3em",
  fontSize: "1.5em",
});

type ActivityOptions = {
  hideRefund: boolean;
  hideGasReward: boolean;
  hideInboundReceipt: boolean;
  hideOutboundReceipt: boolean;
  hideTransactions: boolean;
};

type RowProps = {
  item: AccountActivityElement;
  options: ActivityOptions;
};

const getActionLink = (action: AccountActivityElementAction) => {
  return "blockHash" in action
    ? `/blocks/${action.blockHash}`
    : `/transactions/${action.transactionHash}${
        action.receiptId ? `#${action.receiptId}` : ""
      }`;
};

const getAccountLink = (account: string) => {
  return `/beta/accounts/${account}`;
};

const ActivityItemActionWrapper = styled("div", {
  display: "flex",
  alignItems: "center",
  whiteSpace: "pre",

  "& + &": {
    marginTop: 4,
  },
});

const ActivityItemTitle = styled("span", {
  fontWeight: "bold",
});

const ActivityItemAction: React.FC<{
  action: AccountActivityRelatedAction | AccountActivityAction;
}> = ({ action }) => {
  const badge = (
    <>
      {"sender" in action ? (
        <>
          <Link href={getAccountLink(action.sender)}>
            <a>{shortenString(action.sender)}</a>
          </Link>
          {" → "}
        </>
      ) : null}
      <AccountActivityBadge
        action={action}
        href={"transactionHash" in action ? getActionLink(action) : undefined}
      />
      {"receiver" in action ? (
        <>
          {" → "}
          <Link href={getAccountLink(action.receiver)}>
            <a>{shortenString(action.receiver)}</a>
          </Link>
        </>
      ) : null}
    </>
  );
  switch (action.type) {
    case "transfer": {
      const deltaAmount = JSBI.BigInt(action.deltaAmount);
      return (
        <ActivityItemActionWrapper>
          {badge}{" "}
          {JSBI.equal(deltaAmount, BI.zero) ? null : (
            <>
              {" 💸 "}
              <NearAmount amount={action.deltaAmount} />
            </>
          )}
        </ActivityItemActionWrapper>
      );
    }
    case "restake": {
      const deltaAmount = JSBI.BigInt(action.deltaAmount);
      return (
        <ActivityItemActionWrapper>
          {badge}{" "}
          {JSBI.equal(deltaAmount, BI.zero) ? null : (
            <>
              {" 💸 "}
              <NearAmount amount={action.deltaAmount} />
            </>
          )}
        </ActivityItemActionWrapper>
      );
    }
    case "call-method": {
      const attachedAmount = JSBI.BigInt(action.attachedAmount);
      return (
        <ActivityItemActionWrapper>
          {badge}{" "}
          {JSBI.equal(attachedAmount, BI.zero) ? null : (
            <>
              {" 💸 "}
              <NearAmount amount={action.attachedAmount} />
            </>
          )}
        </ActivityItemActionWrapper>
      );
    }
    default:
      return <ActivityItemActionWrapper>{badge}</ActivityItemActionWrapper>;
  }
};

const ActivityItemRow: React.FC<RowProps> = ({ item, options }) => {
  const { t } = useTranslation();
  const deltaAmount = JSBI.BigInt(item.deltaAmount);
  const isDeltaAmountZero = JSBI.equal(deltaAmount, BI.zero);
  const isDeltaAmountPositive = JSBI.greaterThan(deltaAmount, BI.zero);
  const absoluteDeltaAmount = isDeltaAmountPositive
    ? deltaAmount
    : JSBI.multiply(deltaAmount, BI.minusOne);
  const actions =
    item.action.type === "batch" ? item.action.actions : [item.action];

  return (
    <>
      {actions.map((subaction, subindex) => {
        const childrenActions = (item.action.childrenActions ?? []).filter(
          (action) => {
            if (options.hideRefund && action.type === "refund") {
              return false;
            }
            if (options.hideGasReward && action.type === "gas-reward") {
              return false;
            }
            return true;
          }
        );
        return (
          <TableRow key={subindex}>
            <TableElement>
              {subindex === 0 ? (
                <>
                  {item.direction === "inbound" ? "<<<" : ">>>"}
                  {item.involvedAccountId ? (
                    <Link href={getAccountLink(item.involvedAccountId)}>
                      <a>{shortenString(item.involvedAccountId)}</a>
                    </Link>
                  ) : (
                    "system"
                  )}
                </>
              ) : null}
            </TableElement>
            <TableElement>
              <ActivityItemAction action={subaction} />
              {item.action.parentAction ? (
                <>
                  <hr />
                  <ActivityItemTitle>Caused by receipt:</ActivityItemTitle>
                  <ActivityItemAction action={item.action.parentAction} />
                </>
              ) : null}
              {childrenActions.length !== 0 ? (
                <>
                  <hr />
                  <ActivityItemTitle>Children receipts:</ActivityItemTitle>
                  {childrenActions.map((childAction, index) => (
                    <ActivityItemAction key={index} action={childAction} />
                  ))}
                </>
              ) : null}
            </TableElement>
            <TableElement>
              {!isDeltaAmountZero && subindex === 0 ? (
                <Amount
                  direction={isDeltaAmountPositive ? "income" : "outcome"}
                >
                  {isDeltaAmountPositive ? "+" : "-"}
                  <NearAmount
                    amount={absoluteDeltaAmount.toString()}
                    decimalPlaces={2}
                  />
                </Amount>
              ) : (
                "—"
              )}
            </TableElement>
            <TableElement>
              {subindex === 0 ? (
                <>
                  <LinkPrefix>
                    {"transactionHash" in item.action
                      ? item.action.receiptId
                        ? "RX"
                        : "TX"
                      : "BL"}
                  </LinkPrefix>
                  <Link href={getActionLink(item.action)}>
                    {shortenString(
                      "blockHash" in item.action
                        ? item.action.blockHash
                        : item.action.transactionHash
                    )}
                  </Link>
                  <CopyWrapper>
                    <CopyToClipboard
                      text={
                        "blockHash" in item.action
                          ? item.action.blockHash
                          : item.action.transactionHash
                      }
                    />
                  </CopyWrapper>
                </>
              ) : null}
            </TableElement>
            <DateTableElement>
              {subindex === 0
                ? moment
                    .utc(item.timestamp)
                    .format(t(`pages.account.activity.dateFormat`))
                : null}
            </DateTableElement>
          </TableRow>
        );
      })}
    </>
  );
};

type OptionProps = {
  name: string;
  state: [
    string | undefined,
    React.Dispatch<React.SetStateAction<string | undefined>>
  ];
};

const AccountActivityOption: React.FC<OptionProps> = ({
  name,
  state: [value, setValue],
}) => {
  return (
    <div>
      <span>{name}: </span>
      <input
        type="checkbox"
        onChange={(e) => setValue(e.currentTarget.checked ? "true" : undefined)}
        checked={value !== undefined}
      />
    </div>
  );
};

const Floating = styled("div", {
  position: "fixed",
  top: 0,
  right: 0,
  margin: 12,
  padding: 12,
  background: "white",
  borderRadius: 8,
  borderColor: "black",
  borderStyle: "solid",
  zIndex: 1,
});

type Props = {
  accountId: string;
};

const AccountActivityView: React.FC<Props> = ({ accountId }) => {
  const query = trpc.useInfiniteQuery(
    ["account-activity", { accountId, limit: ACCOUNT_CHANGES_PER_PAGE }],
    {
      getNextPageParam: (lastPage) => {
        const lastElement = lastPage[lastPage.length - 1];
        if (!lastElement) {
          return;
        }
        return lastElement.cursor;
      },
    }
  );

  const hideRefundState = useQueryParam("hide-refund");
  const hideGasRewardState = useQueryParam("hide-gas-rewards");
  const hideInboundReceiptState = useQueryParam("hide-inbound-receipt");
  const hideOutboundReceiptState = useQueryParam("hide-outbound-receipt");
  const hideTransactionsState = useQueryParam("hide-transactions");
  const options = React.useMemo(
    () => ({
      hideRefund: Boolean(hideRefundState[0]),
      hideGasReward: Boolean(hideGasRewardState[0]),
      hideInboundReceipt: Boolean(hideInboundReceiptState[0]),
      hideOutboundReceipt: Boolean(hideOutboundReceiptState[0]),
      hideTransactions: Boolean(hideTransactionsState[0]),
    }),
    [
      hideRefundState[0],
      hideGasRewardState[0],
      hideInboundReceiptState[0],
      hideOutboundReceiptState[0],
      hideTransactionsState[0],
    ]
  );

  return (
    <>
      <Floating>
        <AccountActivityOption name="Hide refunds" state={hideRefundState} />
        <AccountActivityOption
          name="Hide gas rewards"
          state={hideGasRewardState}
        />
        <AccountActivityOption
          name="Hide inbound receipts"
          state={hideInboundReceiptState}
        />
        <AccountActivityOption
          name="Hide outbound receipts"
          state={hideOutboundReceiptState}
        />
        <AccountActivityOption
          name="Hide transactions"
          state={hideTransactionsState}
        />
      </Floating>
      <ListHandler query={query}>
        {(items) => {
          if (query.isLoading && items.length === 0) {
            return <div>Loading..</div>;
          }
          return (
            <TableWrapper>
              <table>
                <TableHeader>
                  <tr>
                    <TableHeaderCell>Sender / Reciever</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Id</TableHeaderCell>
                    <TableHeaderCell>When</TableHeaderCell>
                  </tr>
                </TableHeader>
                <tbody>
                  {items.length === 0 ? "No activity" : null}
                  {items
                    .filter((item) => {
                      if (
                        hideInboundReceiptState[0] &&
                        item.action.receiptId &&
                        item.direction === "inbound"
                      ) {
                        return false;
                      }
                      if (
                        hideOutboundReceiptState[0] &&
                        item.action.receiptId &&
                        item.direction === "outbound"
                      ) {
                        return false;
                      }
                      if (hideRefundState[0] && item.action.type === "refund") {
                        return false;
                      }
                      if (
                        hideGasRewardState[0] &&
                        item.action.type === "gas-reward"
                      ) {
                        return false;
                      }
                      if (hideTransactionsState[0] && !item.action.receiptId) {
                        return false;
                      }
                      return true;
                    })
                    .map((item, index) => (
                      <ActivityItemRow
                        key={index}
                        item={item}
                        options={options}
                      />
                    ))}
                </tbody>
              </table>
            </TableWrapper>
          );
        }}
      </ListHandler>
    </>
  );
};

export default AccountActivityView;
