import { renderElement } from "../../../testing/utils";

import NodesEpoch from "../NodesEpoch";

describe("<NodesEpoch />", () => {
  it("renders", () => {
    expect(
      renderElement(
        <NodesEpoch
          epochLength={43200}
          epochStartHeight={36647454}
          epochStartTimestamp={1620305916060}
        />
      )
    ).toMatchSnapshot();
  });
});
