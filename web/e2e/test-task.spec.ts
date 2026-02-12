import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5173' });

test('test task execution with @claude', async ({ page }) => {
  // 打开前端页面
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // 截图初始状态
  await page.screenshot({ path: 'test-1-initial.png', fullPage: true });

  // 查找输入框
  const input = page.locator('input[type="text"], textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10000 });

  // 输入简单任务
  await input.fill('@claude 1+1等于几？只回答数字');
  await page.screenshot({ path: 'test-2-input.png', fullPage: true });

  // 发送
  await input.press('Enter');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-3-sent.png', fullPage: true });

  // 等待 Agent 响应（最多 60 秒）
  console.log('Waiting for agent response...');

  // 监控页面变化
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `test-4-wait-${i}.png`, fullPage: true });

    // 检查是否有响应
    const pageText = await page.textContent('body');
    console.log(`Check ${i}: page length = ${pageText?.length}`);

    // 检查是否还在"思考中"
    if (pageText?.includes('思考中') || pageText?.includes('正在思考')) {
      console.log('Still thinking...');
    } else if (pageText?.includes('2') || pageText?.includes('等于')) {
      console.log('Got response!');
      break;
    }
  }

  await page.screenshot({ path: 'test-5-final.png', fullPage: true });
});
