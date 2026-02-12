import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:3001';
const API_URL = 'http://127.0.0.1:3000/api';

test.describe('猫咖工作室 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 打开前端页面
    await page.goto(FRONTEND_URL);
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
  });

  test('1. 页面加载 - 显示基本 UI', async ({ page }) => {
    // 检查标题
    await expect(page.locator('text=猫咖工作室')).toBeVisible();

    // 检查任务列表区域
    await expect(page.locator('text=任务列表')).toBeVisible();

    // 检查 Agent 面板
    await expect(page.locator('text=布偶猫')).toBeVisible();
    await expect(page.locator('text=缅因猫')).toBeVisible();
    await expect(page.locator('text=暹罗猫')).toBeVisible();

    // 检查聊天输入框
    await expect(page.locator('textarea[placeholder*="@agent"]')).toBeVisible();
  });

  test('2. 加载已有任务', async ({ page }) => {
    // 等待任务加载
    await page.waitForTimeout(1000);

    // 检查控制台日志
    const consoleLogs: string[] = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    // 刷新页面触发加载
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // 检查是否有加载日志
    const hasLoadLog = consoleLogs.some(log => log.includes('[Sidebar] Loading tasks'));
    console.log('Console logs:', consoleLogs);
  });

  test('3. 创建新任务', async ({ page }) => {
    // 点击添加任务按钮
    const addButton = page.locator('button[title="新建任务"]');
    await expect(addButton).toBeVisible();

    // 监听 dialog
    page.on('dialog', async dialog => {
      if (dialog.message().includes('任务名称')) {
        await dialog.accept('e2e-test-task');
      } else if (dialog.message().includes('描述')) {
        await dialog.accept('E2E 测试任务');
      }
    });

    await addButton.click();

    // 等待任务创建
    await page.waitForTimeout(1000);

    // 验证任务出现在列表中
    await expect(page.locator('text=e2e-test-task')).toBeVisible({ timeout: 5000 });
  });

  test('4. 选择任务', async ({ page }) => {
    // 先确保有任务
    await page.waitForTimeout(500);

    // 点击第一个任务
    const taskItem = page.locator('button:has-text("web-api")').first();
    if (await taskItem.isVisible()) {
      await taskItem.click();

      // 验证任务被选中（有高亮样式）
      await expect(taskItem).toHaveClass(/border-cafe-mocha/);
    }
  });

  test('5. 发送聊天消息', async ({ page }) => {
    // 先选择一个任务
    const taskItem = page.locator('button:has-text("web-api")').first();
    if (await taskItem.isVisible()) {
      await taskItem.click();
      await page.waitForTimeout(300);
    }

    // 输入消息
    const input = page.locator('textarea[placeholder*="@agent"]');
    await input.fill('@claude 你好，这是一条测试消息');

    // 点击发送按钮
    const sendButton = page.locator('button:has(svg.lucide-send)');
    await sendButton.click();

    // 验证消息出现在聊天区域
    await expect(page.locator('text=这是一条测试消息')).toBeVisible({ timeout: 3000 });
  });

  test('6. 打开设置面板', async ({ page }) => {
    // 点击设置按钮
    const settingsButton = page.locator('button[title="设置"]');
    await settingsButton.click();

    // 验证设置面板打开
    await expect(page.locator('text=Agent 设置')).toBeVisible();
    await expect(page.locator('text=资源池')).toBeVisible();

    // 切换到资源池 Tab
    await page.locator('button:has-text("资源池")').click();
    await expect(page.locator('text=API 资源池')).toBeVisible();

    // 关闭设置
    await page.locator('button:has(svg.lucide-x)').click();
    await expect(page.locator('text=Agent 设置')).not.toBeVisible();
  });

  test('7. API 连通性检查', async ({ page }) => {
    // 直接测试 API
    const response = await page.request.get(`${API_URL}/status`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('running');
    expect(data.agents.total).toBe(3);
  });

  test('8. 任务创建 API 测试', async ({ page }) => {
    const response = await page.request.post(`${API_URL}/tasks`, {
      data: {
        module: 'playwright-test',
        description: 'Playwright E2E 测试创建的任务',
      },
    });

    expect(response.ok()).toBeTruthy();
    const task = await response.json();
    expect(task.id).toBeDefined();
    expect(task.module).toBe('playwright-test');
    expect(task.createdAt).toBeDefined();
    expect(typeof task.createdAt).toBe('number');
  });
});

test.describe('网络请求监控', () => {
  test('监控前端 API 调用', async ({ page }) => {
    const apiCalls: string[] = [];

    // 监控网络请求
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push(`${request.method()} ${request.url()}`);
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`Response: ${response.status()} ${response.url()}`);
      }
    });

    // 打开页面
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('API calls made:', apiCalls);

    // 验证至少调用了 tasks API
    const hasTasksCall = apiCalls.some(call => call.includes('/api/tasks'));
    expect(hasTasksCall).toBeTruthy();
  });
});
