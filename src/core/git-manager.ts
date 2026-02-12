/**
 * Git 管理器
 * 支持 Worktree、自动提交、分支管理、冲突检测
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import type { GitCommit, WorktreeInfo } from './types.js';

const execFileAsync = promisify(execFile);

export interface GitManagerConfig {
  repoPath: string;
  defaultBranch?: string;
  autoCommit?: boolean;
}

export interface ConflictInfo {
  file: string;
  type: 'both_modified' | 'deleted_by_us' | 'deleted_by_them' | 'both_added';
  content?: string;
}

export interface MergeResult {
  success: boolean;
  conflicts?: ConflictInfo[];
  message: string;
}

export class GitManager {
  private repoPath: string;
  private defaultBranch: string;
  private autoCommitEnabled: boolean;

  constructor(config: GitManagerConfig) {
    this.repoPath = config.repoPath;
    this.defaultBranch = config.defaultBranch || 'main';
    this.autoCommitEnabled = config.autoCommit ?? true;
  }

  /**
   * 执行 Git 命令（使用 execFile 避免命令注入）
   */
  private async execGit(args: string[], cwd?: string): Promise<string> {
    const workdir = cwd || this.repoPath;

    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: workdir,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });
      return stdout.trim();
    } catch (error: unknown) {
      const err = error as { stderr?: string; message: string };
      throw new Error(`Git command failed: git ${args.join(' ')}\n${err.stderr || err.message}`);
    }
  }

  // ==================== Worktree 管理 ====================

  /**
   * 创建 Worktree
   */
  async createWorktree(
    worktreePath: string,
    branch: string,
    module: string,
    agentId?: string
  ): Promise<WorktreeInfo> {
    // 检查分支是否存在，不存在则创建
    const branches = await this.listBranches();
    if (!branches.includes(branch)) {
      await this.createBranch(branch);
    }

    // 创建 worktree
    await this.execGit(['worktree', 'add', worktreePath, branch]);

    return {
      path: worktreePath,
      branch,
      module,
      agentId,
      createdAt: Date.now(),
    };
  }

  /**
   * 删除 Worktree
   */
  async removeWorktree(worktreePath: string, force = false): Promise<void> {
    const args = ['worktree', 'remove'];
    if (force) args.push('--force');
    args.push(worktreePath);

    await this.execGit(args);
  }

  /**
   * 列出所有 Worktree
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    const output = await this.execGit(['worktree', 'list', '--porcelain']);
    const worktrees: WorktreeInfo[] = [];

    const entries = output.split('\n\n').filter(Boolean);
    for (const entry of entries) {
      const lines = entry.split('\n');
      let worktreePath = '';
      let branch = '';

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          worktreePath = line.substring(9);
        } else if (line.startsWith('branch ')) {
          branch = line.substring(7).replace('refs/heads/', '');
        }
      }

      if (worktreePath && branch) {
        worktrees.push({
          path: worktreePath,
          branch,
          module: this.extractModuleFromBranch(branch),
          createdAt: 0, // 无法从 git 获取创建时间
        });
      }
    }

    return worktrees;
  }

  /**
   * 从分支名提取模块名
   */
  private extractModuleFromBranch(branch: string): string {
    // 假设分支格式: feature/module-name 或 module-name
    const parts = branch.split('/');
    return parts[parts.length - 1];
  }

  // ==================== 自动提交 ====================

  /**
   * 自动提交（格式：[模块名]-[agentId]：[功能描述]）
   */
  async autoCommit(
    module: string,
    agentId: string,
    description: string,
    files?: string[],
    cwd?: string
  ): Promise<GitCommit | null> {
    const workdir = cwd || this.repoPath;

    // 检查是否有变更
    const status = await this.execGit(['status', '--porcelain'], workdir);
    if (!status) {
      return null; // 无变更
    }

    // 添加文件
    if (files && files.length > 0) {
      for (const file of files) {
        await this.execGit(['add', file], workdir);
      }
    } else {
      await this.execGit(['add', '-A'], workdir);
    }

    // 构建提交消息
    const message = `[${module}]-[${agentId}]：${description}`;

    // 提交
    await this.execGit(['commit', '-m', message], workdir);

    // 获取提交信息
    const hash = await this.execGit(['rev-parse', 'HEAD'], workdir);
    const branch = await this.getCurrentBranch(workdir);
    const changedFiles = await this.getCommitFiles(hash, workdir);

    return {
      hash,
      message,
      author: await this.getAuthor(workdir),
      timestamp: Date.now(),
      branch,
      files: changedFiles,
    };
  }

  /**
   * 获取提交涉及的文件
   */
  private async getCommitFiles(hash: string, cwd?: string): Promise<string[]> {
    const output = await this.execGit(
      ['diff-tree', '--no-commit-id', '--name-only', '-r', hash],
      cwd
    );
    return output.split('\n').filter(Boolean);
  }

  /**
   * 获取作者信息
   */
  private async getAuthor(cwd?: string): Promise<string> {
    const name = await this.execGit(['config', 'user.name'], cwd).catch(() => 'Unknown');
    const email = await this.execGit(['config', 'user.email'], cwd).catch(() => '');
    return email ? `${name} <${email}>` : name;
  }

  // ==================== 分支管理 ====================

  /**
   * 创建分支
   */
  async createBranch(branch: string, startPoint?: string): Promise<void> {
    const args = ['branch', branch];
    if (startPoint) args.push(startPoint);
    await this.execGit(args);
  }

  /**
   * 切换分支
   */
  async switchBranch(branch: string, cwd?: string): Promise<void> {
    await this.execGit(['checkout', branch], cwd);
  }

  /**
   * 列出所有分支
   */
  async listBranches(remote = false): Promise<string[]> {
    const args = ['branch', '--format=%(refname:short)'];
    if (remote) args.push('-r');

    const output = await this.execGit(args);
    return output.split('\n').filter(Boolean);
  }

  /**
   * 获取当前分支
   */
  async getCurrentBranch(cwd?: string): Promise<string> {
    return this.execGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  }

  /**
   * 删除分支
   */
  async deleteBranch(branch: string, force = false): Promise<void> {
    const flag = force ? '-D' : '-d';
    await this.execGit(['branch', flag, branch]);
  }

  /**
   * 合并分支
   */
  async mergeBranch(branch: string, cwd?: string): Promise<MergeResult> {
    try {
      await this.execGit(['merge', branch, '--no-edit'], cwd);
      return { success: true, message: `Successfully merged ${branch}` };
    } catch (error) {
      // 检查是否有冲突
      const conflicts = await this.detectConflicts(cwd);
      if (conflicts.length > 0) {
        return {
          success: false,
          conflicts,
          message: `Merge conflict detected in ${conflicts.length} file(s)`,
        };
      }
      throw error;
    }
  }

  // ==================== 冲突检测 ====================

  /**
   * 检测冲突
   */
  async detectConflicts(cwd?: string): Promise<ConflictInfo[]> {
    const workdir = cwd || this.repoPath;
    const conflicts: ConflictInfo[] = [];

    try {
      const status = await this.execGit(['status', '--porcelain'], workdir);
      const lines = status.split('\n').filter(Boolean);

      for (const line of lines) {
        const code = line.substring(0, 2);
        const file = line.substring(3);

        let type: ConflictInfo['type'] | null = null;

        if (code === 'UU') {
          type = 'both_modified';
        } else if (code === 'UD') {
          type = 'deleted_by_them';
        } else if (code === 'DU') {
          type = 'deleted_by_us';
        } else if (code === 'AA') {
          type = 'both_added';
        }

        if (type) {
          conflicts.push({ file, type });
        }
      }
    } catch {
      // 忽略错误
    }

    return conflicts;
  }

  /**
   * 检查是否有未解决的冲突
   */
  async hasConflicts(cwd?: string): Promise<boolean> {
    const conflicts = await this.detectConflicts(cwd);
    return conflicts.length > 0;
  }

  /**
   * 中止合并
   */
  async abortMerge(cwd?: string): Promise<void> {
    await this.execGit(['merge', '--abort'], cwd);
  }

  /**
   * 标记冲突已解决
   */
  async resolveConflict(file: string, cwd?: string): Promise<void> {
    await this.execGit(['add', file], cwd);
  }

  // ==================== 提交历史 ====================

  /**
   * 获取提交历史
   */
  async getCommitHistory(
    options: {
      branch?: string;
      limit?: number;
      since?: Date;
      until?: Date;
      author?: string;
      path?: string;
    } = {},
    cwd?: string
  ): Promise<GitCommit[]> {
    const separator = '|||';
    const args = [
      'log',
      `--format=%H${separator}%s${separator}%an <%ae>${separator}%at`,
      `--max-count=${options.limit || 50}`,
    ];

    if (options.branch) args.push(options.branch);
    if (options.since) args.push(`--since=${options.since.toISOString()}`);
    if (options.until) args.push(`--until=${options.until.toISOString()}`);
    if (options.author) args.push(`--author=${options.author}`);
    if (options.path) args.push('--', options.path);

    const output = await this.execGit(args, cwd);
    const commits: GitCommit[] = [];

    for (const line of output.split('\n').filter(Boolean)) {
      const [hash, message, author, timestamp] = line.split('|||');
      const files = await this.getCommitFiles(hash, cwd);
      const branch = await this.getCurrentBranch(cwd);

      commits.push({
        hash,
        message,
        author,
        timestamp: parseInt(timestamp, 10) * 1000,
        branch,
        files,
      });
    }

    return commits;
  }

  /**
   * 获取单个提交信息
   */
  async getCommit(hash: string, cwd?: string): Promise<GitCommit | null> {
    const separator = '|||';
    try {
      const output = await this.execGit(
        ['log', '-1', `--format=%H${separator}%s${separator}%an <%ae>${separator}%at`, hash],
        cwd
      );

      const [commitHash, message, author, timestamp] = output.split('|||');
      const files = await this.getCommitFiles(commitHash, cwd);
      const branch = await this.getCurrentBranch(cwd);

      return {
        hash: commitHash,
        message,
        author,
        timestamp: parseInt(timestamp, 10) * 1000,
        branch,
        files,
      };
    } catch {
      return null;
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 检查是否是 Git 仓库
   */
  async isGitRepo(dir?: string): Promise<boolean> {
    try {
      await this.execGit(['rev-parse', '--git-dir'], dir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 初始化 Git 仓库
   */
  async initRepo(dir?: string): Promise<void> {
    await this.execGit(['init'], dir);
  }

  /**
   * 获取仓库根目录
   */
  async getRepoRoot(cwd?: string): Promise<string> {
    return this.execGit(['rev-parse', '--show-toplevel'], cwd);
  }

  /**
   * 获取工作区状态
   */
  async getStatus(cwd?: string): Promise<{ staged: string[]; unstaged: string[]; untracked: string[] }> {
    const output = await this.execGit(['status', '--porcelain'], cwd);
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of output.split('\n').filter(Boolean)) {
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const file = line.substring(3);

      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(file);
      } else {
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push(file);
        }
        if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
          unstaged.push(file);
        }
      }
    }

    return { staged, unstaged, untracked };
  }

  /**
   * 暂存所有变更
   */
  async stageAll(cwd?: string): Promise<void> {
    await this.execGit(['add', '-A'], cwd);
  }

  /**
   * 重置暂存区
   */
  async unstageAll(cwd?: string): Promise<void> {
    await this.execGit(['reset', 'HEAD'], cwd);
  }

  /**
   * 获取文件差异
   */
  async getDiff(file?: string, staged = false, cwd?: string): Promise<string> {
    const args = ['diff'];
    if (staged) args.push('--staged');
    if (file) args.push('--', file);
    return this.execGit(args, cwd);
  }
}

export default GitManager;
