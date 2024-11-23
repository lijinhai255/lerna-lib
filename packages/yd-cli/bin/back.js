#!/usr/bin/env node

/**
 * 简单的类型生成工具
 * 用法: yd-gen -u <api-url> -n <type-name> -p <save-path>
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const figlet = require('figlet');
const versionStr = figlet.textSync('YiDeng');
const Printer = require('@darkobits/lolcatjs');
const version = require('../package.json').version;
const ora = require('ora');
const transformed = Printer.default.fromString(
  ` \n   京程一灯项目脚手架${version} \n ${versionStr}`
);
const {
  quicktype,
  InputData,
  jsonInputForTargetLanguage,
} = require('quicktype-core');

// 获取桌面路径作为默认保存位置
const desktopPath = path.join(require('os').homedir(), 'Desktop');

/**
 * 生成类型定义
 * @param {string} url - API URL
 * @param {string} typeName - 类型名称
 */
async function generateTypes(url, typeName) {
  const spinner = ora('正在获取API数据...').start();

  try {
    // 获取API数据
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.statusText}`);
    }

    const jsonData = await response.json();
    spinner.text = '正在生成类型定义...';

    // 处理数组和对象数据
    const sampleData = Array.isArray(jsonData) ? jsonData[0] : jsonData;

    // 创建TypeScript输入
    const jsonInput = await jsonInputForTargetLanguage('typescript');
    await jsonInput.addSource({
      name: typeName,
      samples: [JSON.stringify(sampleData)],
    });

    const inputData = new InputData();
    inputData.addInput(jsonInput);

    // 生成类型
    const { lines } = await quicktype({
      lang: 'typescript',
      inputData,
      alphabetizeProperties: true,
      rendererOptions: {
        'just-types': 'true',
        'explicit-unions': 'true',
      },
    });

    spinner.succeed('类型定义生成成功！');

    if (!lines || lines.length === 0) {
      throw new Error('生成的类型为空，请检查API返回数据');
    }

    return { lines };
  } catch (error) {
    spinner.fail('处理失败');
    throw error;
  }
}

// 配置CLI命令
program.version(transformed);

program
  .description('从API URL生成TypeScript类型定义')
  .option('-u, --url <url>', 'API URL地址')
  .option('-n, --name <name>', '生成的类型名称', 'ApiTypes')
  .option('-p, --path <path>', '保存路径', desktopPath)
  .action(async (options) => {
    if (!options.url) {
      console.error('请提供API URL地址');
      process.exit(1);
    }

    try {
      // 生成类型定义
      const { lines } = await generateTypes(options.url, options.name);

      // 保存文件
      const fullPath = path.join(options.path, `${options.name}.ts`);
      fs.writeFileSync(fullPath, lines.join('\n'));

      // 打印结果
      console.log(`\n类型文件已保存至: ${fullPath}`);
      console.log('\n生成的类型定义预览:');
      console.log('----------------------------------------');
      console.log(lines.join('\n'));
      console.log('----------------------------------------');
    } catch (error) {
      console.error('\n生成类型失败:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
