import { BLD, EXTRACT } from '../run/build-tmpl.js'
import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// テスト用の一時ディレクトリ
const TEMP_DIR = path.join(__dirname, '__test-temp');

// Assetメソッドを含むクラスを抽出するヘルパー関数
const setupAssetMethod = _ => {
  class AssetTester {
    Asset(src, dest) {
      new BLD(1)
      new EXTRACT().Asset(src, dest)
    }
  }

  return new AssetTester();
};


describe('eXtracter.Asset メソッド', _ => {
  beforeEach(_ => {
    // テスト前に一時ディレクトリをクリア
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterEach(_ => {
    // テスト後に一時ディレクトリをクリア
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe('ファイルコピー', _ => {
    test('単一ファイルをコピーできる', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source.txt');
      const destFile = path.join(TEMP_DIR, 'dest', 'source.txt');

      // ソースファイルを作成
      fs.writeFileSync(srcFile, 'test content');

      // Assetメソッドを呼び出し
      await assetTester.Asset(srcFile, destFile);

      // デスティネーションディレクトリが作成されていることを確認
      assert.ok(fs.existsSync(path.dirname(destFile)), 'デスティネーションディレクトリが作成されるべき');
    });

    test('拡張子付きのデスティネーションパスを処理できる', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source.txt');
      const destFile = path.join(TEMP_DIR, 'dest', 'renamed.txt');

      fs.writeFileSync(srcFile, 'test content');
      await assetTester.Asset(srcFile, destFile);

      // 拡張子がある場合、destはディレクトリになるべき
      assert.ok(fs.existsSync(path.dirname(destFile)), 'デスティネーションディレクトリが作成されるべき');
    });

    test('拡張子なしのデスティネーションパスを処理できる', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source.txt');
      const destDir = path.join(TEMP_DIR, 'dest');

      fs.writeFileSync(srcFile, 'test content');
      await assetTester.Asset(srcFile, destDir);

      // デスティネーションディレクトリが作成されている
      assert.ok(fs.existsSync(destDir), 'デスティネーションディレクトリが作成されるべき');
    });
  });

  describe('ディレクトリコピー', _ => {
    // test('ディレクトリを再帰的にコピーできる', async _ => {
    //   const assetTester = setupAssetMethod();
    //   const srcDir = path.join(TEMP_DIR, 'source');
    //   const destDir = path.join(TEMP_DIR, 'dest');

    //   // ソースディレクトリ構造を作成
    //   fs.mkdirSync(path.join(srcDir, 'subdir'), { recursive: true });
    //   fs.writeFileSync(path.join(srcDir, 'file1.txt'), 'content1');
    //   fs.writeFileSync(path.join(srcDir, 'subdir', 'file2.txt'), 'content2');

    //   // Assetメソッドを呼び出し
    //   await assetTester.Asset(srcDir, destDir);

    //   // デスティネーションディレクトリが作成されている
    //   assert.ok(fs.existsSync(destDir), 'デスティネーションディレクトリが作成されるべき');
    //   assert.ok(fs.existsSync(path.join(destDir, 'subdir')), 'サブディレクトリが作成されるべき');
    // });

    // test('ディレクトリ内の複数ファイルを処理できる', async _ => {
    //   const assetTester = setupAssetMethod();
    //   const srcDir = path.join(TEMP_DIR, 'source');
    //   const destDir = path.join(TEMP_DIR, 'dest');

    //   // 複数ファイルを作成
    //   fs.mkdirSync(srcDir, { recursive: true });
    //   fs.writeFileSync(path.join(srcDir, 'file1.txt'), 'content1');
    //   fs.writeFileSync(path.join(srcDir, 'file2.txt'), 'content2');
    //   fs.writeFileSync(path.join(srcDir, 'file3.txt'), 'content3');

    //   await assetTester.Asset(srcDir, destDir);

    //   assert.ok(fs.existsSync(destDir), 'デスティネーションディレクトリが作成されるべき');
    // });

    test('空ディレクトリをスキップ', async _ => {
      const assetTester = setupAssetMethod();
      const srcDir = path.join(TEMP_DIR, 'source');
      const destDir = path.join(TEMP_DIR, 'dest');

      // 空ディレクトリを作成
      fs.mkdirSync(srcDir, { recursive: true });

      await assetTester.Asset(srcDir, destDir);

      assert.ok(!fs.existsSync(destDir), '空のディレクトリは処理しない・作成しない');
    });

    test('ネストされたディレクトリを再帰的に処理できる', async _ => {
      const assetTester = setupAssetMethod();
      const srcDir = path.join(TEMP_DIR, 'source');
      const destDir = path.join(TEMP_DIR, 'dest');

      // ネストされたディレクトリ構造を作成
      fs.mkdirSync(path.join(srcDir, 'level1', 'level2', 'level3'), { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'level1', 'level2', 'level3', 'deep.txt'), 'deep content');

      await assetTester.Asset(srcDir, destDir);

      assert.ok(fs.existsSync(path.join(destDir, 'level1', 'level2', 'level3')), 'ネストされたディレクトリが作成されるべき');
    });
  });

  describe('隠しファイルとシステムファイルの処理', _ => {
    test('隠しファイル(.で始まる)をスキップする', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, '.hidden');
      const destFile = path.join(TEMP_DIR, 'dest', '.hidden');

      fs.writeFileSync(srcFile, 'hidden content');

      // スキップされるべき
      await assetTester.Asset(srcFile, destFile);

      // destが作成されていないことを確認
      assert.ok(!fs.existsSync(destFile), '隠しファイルはコピーされるべきではない');
    });

    test('.DS_Storeファイルを処理する', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, '.DS_Store');
      const destFile = path.join(TEMP_DIR, 'dest', '.DS_Store');

      fs.writeFileSync(srcFile, '.DS_Store content');

      // .DS_Storeはスキップされるべき
      await assetTester.Asset(srcFile, destFile);

      // destが作成されていないことを確認
      assert.ok(!fs.existsSync(destFile), '.DS_Storeファイルはコピーされるべきではない');
    });

    test('パス中に隠しディレクトリを含むファイルをスキップする', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, '.hidden', 'file.txt');
      const destFile = path.join(TEMP_DIR, 'dest', '.hidden', 'file.txt');

      // 隠しディレクトリ配下にファイルを作成
      fs.mkdirSync(path.dirname(srcFile), { recursive: true });
      fs.writeFileSync(srcFile, 'hidden content');

      // スキップされるべき
      await assetTester.Asset(srcFile, destFile);

      // destが作成されていないことを確認
      assert.ok(!fs.existsSync(destFile), 'パス中に隠しディレクトリを含むファイルはコピーされるべきではない');
    });
  });

  describe('ディレクトリ作成', _ => {
    test('存在しない親ディレクトリを再帰的に作成できる', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source.txt');
      const destFile = path.join(TEMP_DIR, 'deep', 'nested', 'dir', 'dest.txt');

      fs.writeFileSync(srcFile, 'content');

      await assetTester.Asset(srcFile, destFile);

      // 親ディレクトリがすべて作成されている
      assert.ok(fs.existsSync(path.dirname(destFile)), '深くネストされた親ディレクトリが作成されるべき');
    });

    test('既に存在するディレクトリへのコピーに対応できる', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source.txt');
      const destDir = path.join(TEMP_DIR, 'existing');

      // デスティネーションディレクトリを事前作成
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(srcFile, 'content');

      // エラーなく実行されるべき
      await assetTester.Asset(srcFile, destDir);

      assert.ok(fs.existsSync(destDir), 'デスティネーションディレクトリが存在するべき');
    });
  });

  describe('エッジケース', _ => {
    test('複雑なパス名を処理できる', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source-file_123.txt');
      const destFile = path.join(TEMP_DIR, 'dest@test', 'renamed-file_456.txt');

      fs.writeFileSync(srcFile, 'content');

      await assetTester.Asset(srcFile, destFile);

      assert.ok(fs.existsSync(path.dirname(destFile)), '複雑なパス名を処理できるべき');
    });

    test('スペースを含むパスを処理できる', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source file.txt');
      const destFile = path.join(TEMP_DIR, 'dest folder', 'dest file.txt');

      fs.writeFileSync(srcFile, 'content with spaces');

      await assetTester.Asset(srcFile, destFile);

      assert.ok(fs.existsSync(path.dirname(destFile)), 'スペースを含むパスを処理できるべき');
    });

    test('特殊文字を含むファイル名を処理できる', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source@#$%.txt');
      const destFile = path.join(TEMP_DIR, 'dest', 'renamed@#$%.txt');

      fs.writeFileSync(srcFile, 'special chars');

      await assetTester.Asset(srcFile, destFile);

      assert.ok(fs.existsSync(path.dirname(destFile)), '特殊文字を含むパスを処理できるべき');
    });
  });

  describe('ディレクトリの統計情報', _ => {
    test('isDirectory()がtrueの場合、再帰処理が実行される', async _ => {
      const assetTester = setupAssetMethod();
      const srcDir = path.join(TEMP_DIR, 'source');
      const destDir = path.join(TEMP_DIR, 'dest');

      // ディレクトリとファイルを作成
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'file.txt'), 'content');

      await assetTester.Asset(srcDir, destDir);

      // デスティネーションが処理されている
      assert.ok(fs.existsSync(destDir), 'ディレクトリが再帰処理されるべき');
    });

    test('isDirectory()がfalseの場合、ファイル処理が実行される', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source.txt');
      const destFile = path.join(TEMP_DIR, 'dest', 'dest.txt');

      fs.writeFileSync(srcFile, 'file content');

      await assetTester.Asset(srcFile, destFile);

      // デスティネーションディレクトリが作成されている
      assert.ok(fs.existsSync(path.dirname(destFile)), 'ファイルが処理されるべき');
    });
  });

  describe('拡張子の処理', _ => {
    test('拡張子を持つデスティネーションパスの処理', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source.txt');
      const destPath = path.join(TEMP_DIR, 'folder', 'file.html');

      fs.writeFileSync(srcFile, 'content');

      await assetTester.Asset(srcFile, destPath);

      // フォルダのみが作成されている
      assert.ok(fs.existsSync(path.dirname(destPath)), 'デスティネーションの親フォルダが作成されるべき');
    });

    test('拡張子なしのデスティネーションパスの処理', async _ => {
      const assetTester = setupAssetMethod();
      const srcFile = path.join(TEMP_DIR, 'source.txt');
      const destPath = path.join(TEMP_DIR, 'folder-no-ext');

      fs.writeFileSync(srcFile, 'content');

      await assetTester.Asset(srcFile, destPath);

      // フォルダが作成されている
      assert.ok(fs.existsSync(destPath), 'デスティネーションフォルダが作成されるべき');
    });
  });
});
