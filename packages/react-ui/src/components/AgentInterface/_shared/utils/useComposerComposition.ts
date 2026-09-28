import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import {
  isCommitEnter,
  isStaleComposition,
  shouldSubmitOnEnter,
} from "./composerKeyboard";

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
 * Single source of truth for the ordering that caused the Win+H duplicate
 * drafts: a single `Enter` commits then auto-sends (no second press), Send
 * clicks always send the already-committed draft (the plain-button click
 * blurs first, so the browser commits before the click handler runs), and
 * late pre-submit `compositionend` / `onChange` echoes are swallowed via the
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
  const pendingSendRef = useRef(false);

  useEffect(() => {
    isComposingRef.current = false;
    activeCompositionSubmitGenRef.current = null;
    pendingSendRef.current = false;
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
    pendingSendRef.current = false;
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

  const handleCompositionEnd = (e: { currentTarget: HTMLTextAreaElement }) => {
    if (isStaleComposition(activeCompositionSubmitGenRef.current, submitGenRef.current)) {
      if (textContent !== "") {
        setTextContent("");
      }
      isComposingRef.current = false;
      activeCompositionSubmitGenRef.current = null;
      pendingSendRef.current = false;
      return;
    }
    isComposingRef.current = false;
    activeCompositionSubmitGenRef.current = null;
    if (pendingSendRef.current) {
      submitSnapshot(e.currentTarget.value);
    }
  };

  const handleBlur = () => {
    isComposingRef.current = false;
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && isComposingRef.current) {
      isComposingRef.current = false;
      activeCompositionSubmitGenRef.current = null;
      pendingSendRef.current = false;
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && isCommitEnter(e, isComposingRef.current)) {
      e.preventDefault();
      pendingSendRef.current = true;
      return;
    }
    if (shouldSubmitOnEnter(e)) {
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
