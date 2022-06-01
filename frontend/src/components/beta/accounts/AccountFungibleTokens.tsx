import * as React from "react";
import Image from "next/image";
import { formatToPowerOfTen } from "../../../libraries/formatting";

import { styled } from "../../../libraries/styles";
import { AccountFungibleToken } from "../../../types/common";
import ListHandler from "../../utils/ListHandler";
import { trpc } from "../../../libraries/trpc";

const Wrapper = styled("div", {
  margin: -10,
  display: "flex",
  flexWrap: "wrap",
});

const Token = styled("div", {
  margin: 10,
  padding: 16,
  border: "1px solid #EDEDED",
  borderRadius: 10,
  width: 220,
  height: 120,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
});

const TokenHeader = styled("div", {
  display: "flex",
});

const TokenLogo = styled("div", {
  position: "relative",
  width: 30,
  height: 30,
});

const TokenName = styled("div", {
  fontWeight: 700,
  fontSize: 14,
  lineHeight: "150%",
  marginLeft: 8,
});

const TokenAmount = styled("div", {
  fontWeight: 600,
  fontSize: 18,
  lineHeight: "150%",
});

const FUNGIBLE_TOKENS_PER_PAGE = 20;

type ItemProps = {
  token: AccountFungibleToken;
};

const AccountFungibleTokenView: React.FC<ItemProps> = React.memo(
  ({ token }) => {
    const formattedAmount = formatToPowerOfTen(token.balance, 999);
    const power = formattedAmount.prefix * 4;
    const offsettedPower = power - token.decimals;
    const powerFormatted =
      offsettedPower === 0 ? "" : ` * 10^${offsettedPower}`;
    return (
      <Token>
        <TokenHeader>
          <TokenLogo>
            {token.icon ? <Image src={token.icon} layout="fill" /> : null}
          </TokenLogo>
          <TokenName>{token.name}</TokenName>
        </TokenHeader>
        <TokenAmount>{`${formattedAmount.quotient}${
          formattedAmount.remainder
            ? Number("0." + formattedAmount.remainder)
                .toPrecision(3)
                .slice(1)
            : ""
        }${powerFormatted} ${token.symbol}`}</TokenAmount>
      </Token>
    );
  }
);

type Props = {
  accountId: string;
};

const AccountFungibleTokensView: React.FC<Props> = React.memo(
  ({ accountId }) => {
    const query = trpc.useInfiniteQuery(
      [
        "account-fungible-tokens",
        { accountId, limit: FUNGIBLE_TOKENS_PER_PAGE },
      ],
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
    return (
      <ListHandler query={query}>
        {(items) => {
          if (items.length === 0) {
            return <div>No fungible tokens yet!</div>;
          }
          return (
            <Wrapper>
              {items.map((token) => (
                <AccountFungibleTokenView
                  key={token.authorAccountId}
                  token={token}
                />
              ))}
            </Wrapper>
          );
        }}
      </ListHandler>
    );
  }
);

export default AccountFungibleTokensView;
