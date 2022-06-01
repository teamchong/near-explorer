import React from "react";
import { useRouter } from "next/router";

export const useQueryParam = <S extends string>(
  param: string
): [S | undefined, React.Dispatch<React.SetStateAction<S | undefined>>] => {
  const router = useRouter();
  const query = router.query;
  const setValue = React.useCallback(
    (nextValueOrFn) => {
      const nextValue =
        typeof nextValueOrFn === "function"
          ? nextValueOrFn(query[param])
          : nextValueOrFn;
      const nextQuery = { ...query };
      if (nextValue === undefined) {
        delete nextQuery[param];
      } else {
        nextQuery[param] = nextValue;
      }
      router.replace(
        {
          query: nextQuery,
        },
        undefined,
        { shallow: true }
      );
    },
    [router, query]
  );
  const paramValue = (Array.isArray(query[param])
    ? String(query[param])
    : query[param]) as S | undefined;
  return [paramValue, setValue];
};
