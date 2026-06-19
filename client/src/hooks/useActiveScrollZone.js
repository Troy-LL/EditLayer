import { useEffect, useState } from "react";

export const SCROLL_ZONE = {
  PAGE: "page",
  LAYERS: "layers",
  INSPECTOR: "inspector",
};

export function useActiveScrollZone(editMode) {
  const [activeZone, setActiveZone] = useState(SCROLL_ZONE.PAGE);

  useEffect(() => {
    if (editMode) setActiveZone(SCROLL_ZONE.PAGE);
  }, [editMode]);

  return [activeZone, setActiveZone];
}
