import * as React from "react";
import { useTranslation } from "react-i18next";
import { styled } from "../../../libraries/styles";
import { Tabs } from "../common/Tabs";
import AccountFungibleTokens from "./AccountFungibleTokens";

const TabLabel = styled("div", {
  display: "flex",
});

type Props = {
  accountId: string;
};

const AccountTabs: React.FC<Props> = React.memo(({ accountId }) => {
  const { t } = useTranslation();
  return (
    <Tabs
      tabs={[
        {
          id: "activity",
          disabled: true,
          label: <TabLabel>{t("pages.account.tabs.activity")}</TabLabel>,
          node: null,
        },
        {
          id: "tokens",
          disabled: false,
          label: <TabLabel>{t("pages.account.tabs.tokens")}</TabLabel>,
          node: <AccountFungibleTokens accountId={accountId} />,
        },
        {
          id: "collectibles",
          disabled: true,
          label: <TabLabel>{t("pages.account.tabs.collectibles")}</TabLabel>,
          node: null,
        },
        {
          id: "access-keys",
          disabled: true,
          label: <TabLabel>{t("pages.account.tabs.accessKeys")}</TabLabel>,
          node: null,
        },
        {
          id: "locked-up",
          disabled: true,
          label: <TabLabel>{t("pages.account.tabs.lockedUp")}</TabLabel>,
          node: null,
        },
      ]}
    />
  );
});

export default AccountTabs;
