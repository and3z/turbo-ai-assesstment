export const AUTH_COOKIE_NAME = "medsupp_session";

const FALLBACK_PASSCODE = "12345";

export function getExpectedPasscode() {
  return process.env.GLOBAL_PASSCODE ?? FALLBACK_PASSCODE;
}

export function isValidPasscode(value: string) {
  return value.trim() === getExpectedPasscode();
}

