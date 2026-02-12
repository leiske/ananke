export const GENERIC_ID_PATTERN = /^[A-Z]{1,3}-[0-9]+$/;

export const EPIC_PREFIX = "EPC";
export const TASK_PREFIX = "TSK";

export const EPIC_ID_PATTERN_SOURCE = `^${EPIC_PREFIX}-[0-9]+$`;
export const TASK_ID_PATTERN_SOURCE = `^${TASK_PREFIX}-[0-9]+$`;

const EPIC_ID_PATTERN = new RegExp(EPIC_ID_PATTERN_SOURCE);
const TASK_ID_PATTERN = new RegExp(TASK_ID_PATTERN_SOURCE);

export function isEpicId(value: string): boolean {
  return EPIC_ID_PATTERN.test(value);
}

export function isTaskId(value: string): boolean {
  return TASK_ID_PATTERN.test(value);
}
