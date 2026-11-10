// Bounded waits for model calls: a slow call becomes a retryable ToolError instead of a hung request.
import { ToolError } from './scope.ts';

export const TIMEOUT_MESSAGE = 'LBC Auto AI Took Too Long To Answer. Nothing Was Changed. Tap Retry.';

export function withDeadline<T>(p: Promise<T>, ms: number, message = TIMEOUT_MESSAGE): Promise<T> {
  let timer: any;
  const late = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ToolError('timeout', message, 504)), ms); });
  return Promise.race([Promise.resolve(p).finally(() => clearTimeout(timer)), late]);
}

// Text from any InvokeLLM response shape; '' when there is nothing usable.
export function replyText(r: any): string {
  const v = typeof r === 'string' ? r : [r?.content, r?.reply, r?.message, r?.text].find((x) => typeof x === 'string');
  return typeof v === 'string' ? v.replace(/\[OFFER_APT\]/g, '').trim() : '';
}