import { describe, expect, it } from 'vitest';
import i18n from '../index';

describe('logout failure translations', () => {
  it.each([
    ['en', 'Sign out could not be confirmed. Your session may still be active. Please try again.'],
    ['zh', '未能确认注销成功，当前会话可能仍有效，请重试。'],
    ['zh-TW', '無法確認登出成功，目前工作階段可能仍有效，請重試。'],
  ])('warns that the server session may remain active and offers retry in %s', (language, message) => {
    expect(i18n.getResource(language, 'translation', 'auth.logout_failed')).toBe(message);
  });
});
