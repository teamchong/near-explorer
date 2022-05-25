import Head from "next/head";

import * as React from "react";
import * as ReactQuery from "react-query";
import { useTranslation } from "react-i18next";
import { GetServerSideProps, NextPage } from "next";

import { Account } from "../../../types/common";
import { useAnalyticsTrackOnMount } from "../../../hooks/analytics/use-analytics-track-on-mount";
import { getPrefetchObject } from "../../../libraries/queries";

import AccountHeader from "../../../components/beta/accounts/AccountHeader";
import AccountTabs from "../../../components/beta/accounts/AccountTabs";
import { useQuery } from "../../../hooks/use-query";
import { styled } from "../../../libraries/styles";

type Props = {
  id: string;
};

const Wrapper = styled("div", {
  backgroundColor: "#fff",
  padding: "12px 6em",
});

const AccountPage: NextPage<Props> = React.memo((props) => {
  useAnalyticsTrackOnMount("Explorer Beta | Account Page", {
    accountId: props.id,
  });
  const accountQuery = useQuery("account", [props.id]);

  return (
    <>
      <Head>
        <title>NEAR Explorer Beta | Account</title>
      </Head>
      <link
        href="https://fonts.googleapis.com/css2?family=Manrope&display=swap"
        rel="stylesheet"
      />
      <Wrapper>
        <AccountQueryView {...accountQuery} id={props.id} />
      </Wrapper>
    </>
  );
});

type QueryProps = ReactQuery.UseQueryResult<Account | null> & {
  id: string;
};

const AccountQueryView: React.FC<QueryProps> = React.memo((props) => {
  const { t } = useTranslation();
  switch (props.status) {
    case "success":
      if (props.data) {
        return (
          <>
            <AccountHeader account={props.data} />
            <AccountTabs account={props.data} />
          </>
        );
      }
      return (
        <div>
          {t("page.accounts.error.account_not_found", {
            account_id: props.id,
          })}
        </div>
      );
    case "error":
      return (
        <div>
          {t("page.accounts.error.account_fetching", {
            account_id: props.id,
          })}
        </div>
      );
    case "loading":
      return <div>Loading...</div>;
    default:
      return null;
  }
});

export const getServerSideProps: GetServerSideProps<
  Props,
  { id: string }
> = async ({ req, params, query }) => {
  const id = params?.id ?? "";
  if (/[A-Z]/.test(id)) {
    return {
      redirect: {
        permanent: true,
        destination: `/accounts/${id.toLowerCase()}`,
      },
    };
  }
  const prefetchObject = getPrefetchObject(query, req.headers.host);
  await prefetchObject.prefetch("account", [id]);
  return {
    props: {
      id,
      dehydratedState: prefetchObject.dehydrate(),
    },
  };
};

export default AccountPage;
