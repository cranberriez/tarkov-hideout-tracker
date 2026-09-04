"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  RecipeItemHoverCard,
  type RecipeItemHoverData,
} from "./RecipeItemHoverCard";

interface RecipeItemHoverController {
  show: (data: RecipeItemHoverData) => void;
  close: () => void;
  scheduleClose: () => void;
  cancelClose: () => void;
}

const RecipeItemHoverContext = createContext<RecipeItemHoverController | null>(
  null,
);

export function RecipeItemHoverProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<RecipeItemHoverData | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const close = useCallback(() => {
    cancelClose();
    setCurrent(null);
  }, [cancelClose]);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setCurrent(null), 120);
  }, [cancelClose]);
  const show = useCallback(
    (data: RecipeItemHoverData) => {
      cancelClose();
      setCurrent(data);
    },
    [cancelClose],
  );

  useEffect(() => () => cancelClose(), [cancelClose]);
  const controller = useMemo(
    () => ({ show, close, scheduleClose, cancelClose }),
    [cancelClose, close, scheduleClose, show],
  );

  return (
    <RecipeItemHoverContext.Provider value={controller}>
      {children}
      {current &&
        createPortal(
          <RecipeItemHoverCard
            {...current}
            onClose={close}
            onKeepOpen={cancelClose}
          />,
          document.body,
        )}
    </RecipeItemHoverContext.Provider>
  );
}

export function useRecipeItemHover() {
  const controller = useContext(RecipeItemHoverContext);
  if (!controller)
    throw new Error(
      "useRecipeItemHover must be used inside RecipeItemHoverProvider",
    );
  return controller;
}
