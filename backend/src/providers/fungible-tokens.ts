import { queryFungibleTokens, queryFungibleTokensAmount } from "../database/queries
import * as nearApi from "../utils/near";

export type FungibleToken = {
  contractId: string;
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  icon: string | null;
};

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

export const getFungibleTokenContractsAmount = (): Promise<number> => {
  return queryFungibleTokensAmount();
};

export const getFungibleTokenContracts = async (
  limit: number,
  cursor?: number
): Promise<string[]> => {
  const tokens = await queryFungibleTokens(limit, cursor);
  return tokens.map((token) => token.id);
};

export const getFungibleToken = async (id: string): Promise<FungibleToken> => {
  const totalSupply = await nearApi.callViewMethod<string>(id, "ft_total_supply", {});
  const fungibleTokenMetadata = await nearApi.callViewMethod<FungibleTokenMetadata>(
    id,
    "ft_metadata",
    {}
  );
  return {
    contractId: id,
    name: fungibleTokenMetadata.name,
    totalSupply,
    symbol: fungibleTokenMetadata.symbol,
    decimals: fungibleTokenMetadata.decimals,
    icon: fungibleTokenMetadata.icon,
  };
};
