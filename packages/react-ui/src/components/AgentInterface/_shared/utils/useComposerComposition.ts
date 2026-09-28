import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { isCommitEnter, isStaleComposition, shouldSubmitOnEnter } from "./composerKeyboard";

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

const isModifierKey = (key: string) =>
  key === "Shift" ||
  key === "Control" ||
  key === "Alt" ||
  key === "Meta" ||
  key === "CapsLock";

/**
 * Shared voice-typing / IME composition guard for both built-in composers.
 *
 * Contract: first `Enter` commits exactly one clean copy to the draft and
 * stops the session; trailing dictation while stopped lands nowhere; second
 * `Enter` (or Send) submits that single copy. Send clicks send immediately
 * (the plain-button click blurs first, so the browser commits before the
 * click handler runs). Late pre-submit echoes are swallowed via the submit
 * epoch so the cleared draft stays clear across rounds.
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
  const commitPendingRef = useRef(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    isComposingRef.current = false;
    activeCompositionSubmitGenRef.current = null;
    commitPendingRef.current = false;
    stoppedRef.current = false;
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
    commitPendingRef.current = false;
    stoppedRef.current = false;
    textareaRef.current?.blur();
    return true;
  };

  const handleSubmit = () => {
    stoppedRef.current = false;
    commitPendingRef.current = false;
    submitSnapshot(textContent);
  };

  const handleChange = (value: string) => {
    if (commitPendingRef.current) {
      return;
    }
    if (stoppedRef.current) {
      return;
    }
    if (isStaleComposition(activeCompositionSubmitGenRef.current, submitGenRef.current)) {
      if (textContent !== "") {
        setTextContent("");
      }
      return;
    }
    setTextContent(value);
  };

  const handleCompositionStart = () => {
    if (stoppedRef.current) {
      return;
    }
    isComposingRef.current = true;
    activeCompositionSubmitGenRef.current = submitGenRef.current;
  };

  const handleCompositionEnd = (e: { currentTarget: HTMLTextAreaElement }) => {
    if (commitPendingRef.current) {
      commitPendingRef.current = false;
      isComposingRef.current = false;
      activeCompositionSubmitGenRef.current = null;
      setTextContent(e.currentTarget.value);
      return;
    }
    if (stoppedRef.current) {
      isComposingRef.current = false;
      activeCompositionSubmitGenRef.current = null;
      return;
    }
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

  const handleFocus = () => {
    stoppedRef.current = false;
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      isComposingRef.current = false;
      activeCompositionSubmitGenRef.current = null;
      commitPendingRef.current = false;
      stoppedRef.current = false;
      return;
    }
    if (stoppedRef.current && !isModifierKey(e.key)) {
      if (e.key === "Enter" && !e.shiftKey) {
        stoppedRef.current = false;
        commitPendingRef.current = false;
        if (shouldSubmitOnEnter(e, false)) {
          e.preventDefault();
          submitSnapshot(textContent);
        }
        return;
      }
      stoppedRef.current = false;
      commitPendingRef.current = false;
    }
    if (e.key === "Enter" && !e.shiftKey && isCommitEnter(e, isComposingRef.current)) {
      commitPendingRef.current = true;
      stoppedRef.current = true;
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
    handleFocus,
    handleKeyDown,
  };
};
