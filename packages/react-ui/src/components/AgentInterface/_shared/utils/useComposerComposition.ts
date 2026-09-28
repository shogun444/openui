import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { isStaleComposition, shouldSubmitOnEnter } from "./composerKeyboard";

export interface ComposerCompositionOptions {
  textContent: string;
  setTextContent: (value: string) => void;
  processMessage: (message: { role: "user"; content: string }) => void;
  isRunning: boolean;
  isLoadingMessages: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** When this changes (e.g. thread switch) stuck composition flags are cleared. */
  resetKey?: unknown;
}

/**
 * Shared voice-typing / IME composition guard for both built-in composers.
 *
 * Double-Enter: the `Enter` that closes a composition only commits and never
 * sends; the next one sends. Send clicks send immediately (the plain-button
 * click blurs first, so the browser commits before the click handler runs).
 * Late pre-submit `compositionend` / `onChange` echoes are swallowed via the
 * submit epoch so the cleared draft stays clear across rounds.
 */
export const useComposerComposition = ({
  textContent,
  setTextContent,
  processMessage,
  isRunning,
  isLoadingMessages,
  textareaRef,
  resetKey,
}: ComposerCompositionOptions) => {
  const isComposingRef = useRef(false);
  const submitGenRef = useRef(0);
  const activeCompositionSubmitGenRef = useRef<number | null>(null);

  useEffect(() => {
    isComposingRef.current = false;
    activeCompositionSubmitGenRef.current = null;
  }, [resetKey]);

  const submitSnapshot = (snapshot: string) => {
    if (!snapshot.trim() || isRunning || isLoadingMessages) {
      return false;
    }

    processMessage({
      role: "user",
      content: snapshot,
    });

    setTextContent("");
    submitGenRef.current += 1;
    isComposingRef.current = false;
    activeCompositionSubmitGenRef.current = null;
    textareaRef.current?.blur();
    return true;
  };

  const handleSubmit = () => {
    submitSnapshot(textContent);
  };

  const handleChange = (value: string) => {
    if (isStaleComposition(activeCompositionSubmitGenRef.current, submitGenRef.current)) {
      if (textContent !== "") {
        setTextContent("");
      }
      return;
    }
    setTextContent(value);
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
    activeCompositionSubmitGenRef.current = submitGenRef.current;
  };

  const handleCompositionEnd = () => {
    if (isStaleComposition(activeCompositionSubmitGenRef.current, submitGenRef.current)) {
      if (textContent !== "") {
        setTextContent("");
      }
    }
    isComposingRef.current = false;
    activeCompositionSubmitGenRef.current = null;
  };

  const handleBlur = () => {
    isComposingRef.current = false;
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && isComposingRef.current) {
      isComposingRef.current = false;
      activeCompositionSubmitGenRef.current = null;
      return;
    }
    if (shouldSubmitOnEnter(e, isComposingRef.current)) {
      e.preventDefault();
      submitSnapshot(textContent);
    }
  };

  return {
    handleSubmit,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    handleBlur,
    handleKeyDown,
  };
};
