import * as React from "react";
import { useTranslation } from "react-i18next";
import { KeysOfUnion } from "../../../types/util";
import * as RPC from "../../../types/rpc";
import { styled } from "../../../libraries/styles";

type Props = {
  status?: KeysOfUnion<RPC.FinalExecutionStatus>;
};

const Label = styled("div", {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: 20,
  borderRadius: 4,
  fontFamily: "Manrope",
  fontSize: 10,
  fontWeight: 700,
  color: "#fff",
  lineHeight: "15px",
  textTransform: "uppercase",
  marginLeft: 14,
  paddingHorizontal: 5,

  variants: {
    type: {
      fetching_status: {
        backgroundColor: "#38abb2",
      },
      NotStarted: {
        backgroundColor: "#b7ce29",
        width: 85,
      },
      Started: {
        background: "#1072aa",
      },
      Failure: {
        background: "#aa4710",
      },
      SuccessValue: {
        background: "#10aa7f",
      },
    },
  },
});

const TransactionStatus: React.FC<Props> = React.memo(({ status }) => {
  const { t } = useTranslation();
  if (!status) {
    return (
      <Label type="fetching_status">
        {t("common.transactions.status.fetching_status")}
      </Label>
    );
  }
  return (
    <Label type={status}>{t(`common.transactions.status.${status}`)}</Label>
  );
});

export default TransactionStatus;
