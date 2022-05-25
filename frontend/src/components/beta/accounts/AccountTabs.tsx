import * as React from "react";
import { useTranslation } from "react-i18next";
import { styled } from "../../../libraries/styles";
import { Tabs } from "../common/Tabs";

const TabLabel = styled("div", {
  display: "flex",
});

const AccountTabs: React.FC = React.memo(() => {
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
          id: "assets",
          disabled: true,
          label: <TabLabel>{t("pages.account.tabs.assets")}</TabLabel>,
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
