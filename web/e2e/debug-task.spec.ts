import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5173' });

test('debug task execution', async ({ page }) => {
  // 打开前端页面
  await page.goto('/');

  // 等待页面加载
  await page.waitForLoadState('networkidle');

  // 截图查看初始状态
  await page.screenshot({ path: 'debug-1-initial.png', fullPage: true });

  // 查找输入框并输入任务
  const input = page.locator('input[placeholder*="发送消息"], textarea[placeholder*="发送消息"], input[type="text"]').first();
  await input.waitFor({ state: 'visible', timeout: 10000 });

  // 输入任务
  await input.fill('@claude 1+1等于几');
  await page.screenshot({ path: 'debug-2-input.png', fullPage: true });

  // 按 Enter 发送
  await input.press('Enter');

  // 等待一下看响应
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'debug-3-after-send.png', fullPage: true });

  // 等待更长时间观察
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'debug-4-waiting.png', fullPage: true });

  // 打印页面内容
  const content = await page.content();
  console.log('Page content length:', content.length);

  // 检查是否有错误信息
  const errorText = await page.locator('.error, [class*="error"], [class*="Error"]').allTextContents();
  if (errorText.length > 0) {
    console.log('Errors found:', errorText);
  }

  // 检查 Agent 状态
  const agentStatus = await page.locator('[class*="status"], [class*="Status"]').allTextContents();
  console.log('Agent status:', agentStatus);
});
