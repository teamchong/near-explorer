import { queryAccountFungibleTokenContractIds } from "../database/queries";
import * as nearApi from "../utils/near";

// https://nomicon.io/Standards/Tokens/FungibleToken/Metadata
type FungibleTokenMetadata = {
  spec: string;
  name: string;
  symbol: string;
  icon: string | null;
  reference: string | null;
  reference_hash: string | null;
  decimals: number;
};

const base64ImageRegex = /^data:image\/(?:gif|png|jpeg|bmp|webp|svg\+xml)(?:;charset=utf-8)?;base64,(?:[A-Za-z0-9]|[+/])+={0,2}/;
const validateBase64Image = (base64Image: string | null): string | null => {
  if (!base64Image) {
    return null;
  }
  return base64ImageRegex.test(base64Image) ? base64Image : null;
};

type AccountFungibleToken = {
  symbol: string;
  decimals: number;
  name: string;
  authorAccountId: string;
  icon: string | null;
  balance: string;
  cursor: number;
};

export const getFungibleTokens = async (
  accountId: string,
  limit: number,
  cursor?: number
): Promise<AccountFungibleToken[]> => {
  const contractIds = await queryAccountFungibleTokenContractIds(
    accountId,
    limit,
    cursor
  );
  const nextCursor = limit + (cursor || 0);
  const tokens = await Promise.all(
    contractIds.map(async (contractId) => {
      const balance = await nearApi.callViewMethod<string>(
        contractId,
        "ft_balance_of",
        { account_id: accountId }
      );
      if (balance === "0") {
        return null;
      }
      const fungibleTokenMetadata = await nearApi.callViewMethod<FungibleTokenMetadata>(
        contractId,
        "ft_metadata",
        {}
      );

      return {
        symbol: fungibleTokenMetadata.symbol,
        decimals: fungibleTokenMetadata.decimals,
        name: fungibleTokenMetadata.name,
        authorAccountId: contractId,
        icon: validateBase64Image(fungibleTokenMetadata.icon),
        balance,
        cursor: nextCursor,
      };
    })
  );
  return tokens.filter((token): token is AccountFungibleToken =>
    Boolean(token)
  );
};
