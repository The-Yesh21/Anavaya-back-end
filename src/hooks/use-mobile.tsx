import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile({ includeTouch = false } = {}) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const narrow = `(width < ${MOBILE_BREAKPOINT}px)`;
    const mql = window.matchMedia(includeTouch ? `${narrow}, (pointer: coarse)` : narrow);
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [includeTouch]);

  return !!isMobile;
}
