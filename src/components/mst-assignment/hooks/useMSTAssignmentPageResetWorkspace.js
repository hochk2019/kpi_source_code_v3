import { useCallback, useRef } from "react";

const NOOP_SET_PAGE = () => {};

export default function useMSTAssignmentPageResetWorkspace() {
  const pageSetterRef = useRef(NOOP_SET_PAGE);

  const bindPageSetter = useCallback((setter) => {
    pageSetterRef.current = typeof setter === "function" ? setter : NOOP_SET_PAGE;
  }, []);

  const goToFirstPage = useCallback(() => {
    pageSetterRef.current(1);
  }, []);

  return {
    bindPageSetter,
    goToFirstPage,
  };
}
