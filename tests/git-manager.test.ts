/**
 * Git 管理器单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitManager } from '../src/core/git-manager.js';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('GitManager', () => {
  let testDir: string;
  let gitManager: GitManager;

  beforeEach(() => {
    // 创建临时测试目录
    testDir = mkdtempSync(join(tmpdir(), 'git-test-'));

    // 初始化 Git 仓库
    execSync('git init', { cwd: testDir });
    execSync('git config user.email "test@test.com"', { cwd: testDir });
    execSync('git config user.name "Test User"', { cwd: testDir });

    // 创建初始文件并提交
    writeFileSync(join(testDir, 'README.md'), 'initial content');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "Initial commit"', { cwd: testDir });

    gitManager = new GitManager({
      repoPath: testDir,
      defaultBranch: 'master',
    });
  });

  afterEach(() => {
    // 清理测试目录
    if (existsSync(testDir)) {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
  });

  describe('isGitRepo', () => {
    it('should return true for git repo', async () => {
      expect(await gitManager.isGitRepo(testDir)).toBe(true);
    });

    it('should return false for non-git directory', async () => {
      const nonGitDir = mkdtempSync(join(tmpdir(), 'non-git-'));
      expect(await gitManager.isGitRepo(nonGitDir)).toBe(false);
      rmSync(nonGitDir, { recursive: true });
    });
  });

  describe('分支管理', () => {
    it('should list branches', async () => {
      const branches = await gitManager.listBranches();
      expect(branches.length).toBeGreaterThan(0);
    });

    it('should create branch', async () => {
      await gitManager.createBranch('feature/test');
      const branches = await gitManager.listBranches();
      expect(branches).toContain('feature/test');
    });

    it('should get current branch', async () => {
      const branch = await gitManager.getCurrentBranch(testDir);
      expect(typeof branch).toBe('string');
      expect(branch.length).toBeGreaterThan(0);
    });

    it('should switch branch', async () => {
      await gitManager.createBranch('feature/switch-test');
      await gitManager.switchBranch('feature/switch-test', testDir);
      const current = await gitManager.getCurrentBranch(testDir);
      expect(current).toBe('feature/switch-test');
    });

    it('should delete branch', async () => {
      await gitManager.createBranch('feature/to-delete');
      await gitManager.deleteBranch('feature/to-delete');
      const branches = await gitManager.listBranches();
      expect(branches).not.toContain('feature/to-delete');
    });
  });

  describe('提交操作', () => {
    it('should auto commit changes', async () => {
      // 创建变更
      writeFileSync(join(testDir, 'README.md'), 'new content');

      const commit = await gitManager.autoCommit(
        'test-module',
        'agent-1',
        '添加新内容',
        undefined,
        testDir
      );

      expect(commit).not.toBeNull();
      expect(commit?.message).toContain('test-module');
      expect(commit?.message).toContain('agent-1');
    });

    it('should return null when no changes', async () => {
      const commit = await gitManager.autoCommit(
        'test-module',
        'agent-1',
        '无变更',
        undefined,
        testDir
      );

      expect(commit).toBeNull();
    });

    it('should get commit history', async () => {
      const history = await gitManager.getCommitHistory({ limit: 10 }, testDir);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].hash).toBeDefined();
      expect(history[0].message).toBeDefined();
    });
  });

  describe('工作区状态', () => {
    it('should get status', async () => {
      const status = await gitManager.getStatus(testDir);
      expect(status).toHaveProperty('staged');
      expect(status).toHaveProperty('unstaged');
      expect(status).toHaveProperty('untracked');
    });

    it('should detect untracked files', async () => {
      writeFileSync(join(testDir, 'newfile.txt'), 'new file content');
      const status = await gitManager.getStatus(testDir);
      expect(status.untracked).toContain('newfile.txt');
    });
  });
});
