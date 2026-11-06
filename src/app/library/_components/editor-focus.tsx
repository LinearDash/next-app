"use client";

import { useEffect } from "react";

// After a poster is selected, bring the side editor into view (it sits above the grid on phones)
// and move focus to its heading so keyboard and screen-reader users land on the form.
export function EditorFocus({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById("editor")?.scrollIntoView({ block: "nearest" });
    document.getElementById("editor-heading")?.focus({ preventScroll: true });
  }, [id]);
  return null;
}
