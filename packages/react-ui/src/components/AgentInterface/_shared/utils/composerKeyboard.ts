/**
 * The subset of a `keydown` event the composers need to decide whether `Enter`
 * submits. React's `KeyboardEvent<HTMLTextAreaElement>` satisfies it
 * structurally, so call sites pass the synthetic event straight through and
 * tests can build a plain object.
 */
export interface ComposerKeyDownEvent {
  key: string;
  shiftKey: boolean;
  keyCode: number;
  nativeEvent: { isComposing: boolean };
}

/**
 * Safari and older Chromium report `keyCode` 229 for a keydown consumed by an
 * open IME composition, and do not always have `isComposing` set on that same
 * event. Checking both covers each browser's timing.
 */
const IME_KEY_CODE = 229;

/**
 * Whether an `Enter` keydown in a composer textarea should send the draft.
 *
 * `Enter` sends and `Shift+Enter` inserts a newline — except for a true IME
 * commit, where `Enter` belongs to the IME (it commits the conversion
 * candidate) and must not reach the composer.
 *
 * Only the native commit signature blocks: `nativeEvent.isComposing === true`
 * or `keyCode === 229` (Safari / older Chromium). Windows Voice Typing
 * (Win+H, Chrome 153 / Edge 154 on Windows 11 25H2) reports a fast mid-
 * dictation `Enter` as `isComposing: false` + `keyCode: 13`, so it intentionally
 * sends in a single press: the composer snapshots the draft, submits once,
 * blurs to detach the OS dictation target, and swallows the late
 * pre-submit `compositionend` / `onChange` via the submit epoch below.
 * CJK keeps double-Enter (first commits, second sends) because its commit
 * `Enter` carries the native signature above.
 */
export const shouldSubmitOnEnter = (event: ComposerKeyDownEvent): boolean => {
  if (event.key !== "Enter" || event.shiftKey) return false;
  return !event.nativeEvent.isComposing && event.keyCode !== IME_KEY_CODE;
};

/**
 * Whether an `Enter` keydown is the commit keystroke of an open composition
 * that must still result in a single send without a second press.
 *
 * Covers the native commit signature (`isComposing` / `229`) plus the tracked
 * `onCompositionStart/End` ref for the Voice Typing stale-timing case
 * (`isComposing: false` + `13` while a dictation session is still open).
 * Call sites `preventDefault`, set a pending-send flag, let the browser
 * commit, then auto-send the committed value on `compositionend` — one
 * physical press, one message, draft left clear.
 */
export const isCommitEnter = (
  event: ComposerKeyDownEvent,
  trackedIsComposing = false,
): boolean => {
  if (event.key !== "Enter" || event.shiftKey) return false;
  return event.nativeEvent.isComposing || event.keyCode === IME_KEY_CODE || trackedIsComposing;
};

/**
 * Whether a late composition event belongs to a pre-submit dictation session
 * and must be swallowed to keep a cleared draft clear.
 *
 * Call sites capture `submitGen` at `compositionstart` and compare it at
 * `compositionend` / `onChange` against the current submit count. A submit
 * that lands after the composition started (`startSubmitGen < submitGen`)
 * means the draft was already sent + cleared — the late commit is the echo
 * the user reported ("already dictated text again with a new word") and must
 * be dropped. A composition started after the last submit (`===`) is new
 * typing and must be kept.
 */
export const isStaleComposition = (
  compositionStartSubmitGen: number | null,
  currentSubmitGen: number,
): boolean => {
  return compositionStartSubmitGen !== null && compositionStartSubmitGen < currentSubmitGen;
};
