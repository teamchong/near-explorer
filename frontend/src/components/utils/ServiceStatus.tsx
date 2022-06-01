import moment from "moment";
import React from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { useEverySecond } from "../../hooks/use-every-second";
import {
  UseSubcriptionResult,
  useSubscription,
} from "../../hooks/use-subscription";
import { styled } from "../../libraries/styles";
import { SECOND } from "../../libraries/time";
import { HealthStatus } from "../../types/common";

const Wrapper = styled("div", {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  size: 12,
  borderRadius: "50%",
  background: "#2A2A2A",
});

const Indicator = styled("div", {
  size: 4,
  borderRadius: "50%",

  variants: {
    type: {
      success: {
        background: "#0DF8B7",
      },
      warning: {
        background: "#F5B842",
      },
      fatal: {
        background: "#FF004C",
      },
    },
  },
});

const Message = styled("span", {
  fontWeight: "bold",

  variants: {
    type: {
      success: {
        color: "#0DCE99",
      },
      warning: {
        color: "#EBAC34",
      },
      fatal: {
        color: "#FF004C",
      },
    },
  },
});

const BORDER_COLOR = "#F7F7F7";
const ARROW_SIDE = 10;
const ARROW_OFFSET = 3;

const TooltipRight = styled(Tooltip, {
  whiteSpace: "nowrap",
  opacity: "1 !important",

  "& > .tooltip-inner": {
    display: "inline-block",
    position: "relative",
    textAlign: "left",
    color: "#333",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: BORDER_COLOR,
    padding: "12px 20px",
    margin: "0 0 0 10px",
    filter: "drop-shadow(rgba(0, 0, 0, 0.4) 0 2px 3px)",
    borderRadius: 24,
    fontSize: 10,
    lineHeight: "12px",
    maxWidth: "initial",
  },

  "& > .arrow": {
    display: "none !important",
  },

  "& > .tooltip-inner::before, .tooltip-inner::after": {
    content: "",
    display: "block",
    position: "absolute",
    right: "100%",
    width: 0,
    height: 0,
    borderStyle: "solid",
  },

  "& > .tooltip-inner::after": {
    top: `calc(50% - ${ARROW_SIDE}px)`,
    borderColor: `transparent #fff transparent transparent`,
    borderWidth: ARROW_SIDE,
    left: -ARROW_SIDE * 2 + ARROW_OFFSET,
  },

  "& > .tooltip-inner::before": {
    top: `calc(50% - ${ARROW_SIDE}px)`,
    borderColor: `transparent ${BORDER_COLOR} transparent transparent`,
    borderWidth: ARROW_SIDE,
    left: -(ARROW_SIDE * 2 + 1) + ARROW_OFFSET,
  },
});

const hadNoHealthIn = (
  health: UseSubcriptionResult<HealthStatus>,
  inMs: number
): boolean => {
  if (health.status !== "success") {
    return false;
  }
  return health.data.timestamp + inMs < Date.now();
};

const AFFORDABLE_LAG = 30 * SECOND;
const getStatusWithMessage = (
  rpc: UseSubcriptionResult<HealthStatus>,
  indexer: UseSubcriptionResult<HealthStatus>
): ({ type: "success" } | { type: "warning" | "fatal"; message: string }) & {
  timestamp: number;
} => {
  if (rpc.status === "error" && indexer.status === "error") {
    return {
      type: "warning",
      message: "Explorer backend is down",
      timestamp: Math.max(rpc.errorUpdatedAt, indexer.errorUpdatedAt),
    };
  }
  if (
    hadNoHealthIn(rpc, AFFORDABLE_LAG) ||
    hadNoHealthIn(indexer, AFFORDABLE_LAG)
  ) {
    const maxTimestamp = Math.max(
      rpc.errorUpdatedAt,
      indexer.errorUpdatedAt,
      rpc.dataUpdatedAt,
      indexer.dataUpdatedAt
    );
    return {
      type: "warning",
      message: "Lost connection to explorer backend",
      timestamp: maxTimestamp,
    };
  }
  if (rpc.status === "success" && !rpc.data.ok) {
    return {
      type: "fatal",
      message: rpc.data.message ?? "RPC is down",
      timestamp: rpc.dataUpdatedAt,
    };
  }
  if (rpc.status === "error") {
    return {
      type: "warning",
      message: `Explorer backend can't fetch RPC status: ${rpc.error.message}`,
      timestamp: rpc.errorUpdatedAt,
    };
  }
  if (indexer.status === "success" && !indexer.data.ok) {
    return {
      type: "warning",
      message: indexer.data.message ?? "Indexer is down",
      timestamp: indexer.dataUpdatedAt,
    };
  }
  if (indexer.status === "error") {
    return {
      type: "warning",
      message: `Explorer backend can't fetch Indexer status: ${indexer.error.message}`,
      timestamp: indexer.errorUpdatedAt,
    };
  }
  return {
    type: "success",
    timestamp: Math.min(rpc.dataUpdatedAt, indexer.dataUpdatedAt),
  };
};

export const ServiceStatusView: React.FC = () => {
  const rpcStatusSubscription = useSubscription(["rpc-status"]);
  const indexerStatusSubscription = useSubscription(["indexer-status"]);

  const status = getStatusWithMessage(
    rpcStatusSubscription,
    indexerStatusSubscription
  );
  const [secondCounter, setSecondCounter] = React.useState(0);
  const formattedTime = React.useMemo(() => {
    if (!status.timestamp) {
      return "";
    }
    return moment(status.timestamp).fromNow();
  }, [status.timestamp, secondCounter]);
  useEverySecond(() => setSecondCounter((x) => x + 1), [setSecondCounter], {
    runOnMount: true,
  });
  const tooltipMessage =
    "message" in status ? status.message : "All systems go";

  return (
    <OverlayTrigger
      placement="right"
      overlay={(props) => (
        <TooltipRight id="status" {...props}>
          <Message type={status.type}>{tooltipMessage}</Message> {formattedTime}
        </TooltipRight>
      )}
    >
      <Wrapper>
        <Indicator type={status.type} />
      </Wrapper>
    </OverlayTrigger>
  );
};
