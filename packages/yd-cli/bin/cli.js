#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const figlet = require('figlet');
const versionStr = figlet.textSync('YiDeng');
const Printer = require('@darkobits/lolcatjs');
const version = require('../package.json').version;
const ora = require('ora');
const inquirer = require('inquirer');
const chalk = require('chalk');
const shell = require('shelljs');
const transformed = Printer.default.fromString(
  ` \n   ✨ 京程一灯项目脚手架 ${version} ✨ \n ${versionStr}`
);
const {
  quicktype,
  InputData,
  jsonInputForTargetLanguage,
} = require('quicktype-core');

// 默认路径
const desktopPath = path.join(require('os').homedir(), 'Desktop');
const currentPath = process.cwd();

// 检查是否安装了VSCode
const hasVSCode = shell.which('code');

/**
 * 生成类型定义
 */
async function generateTypes(url, typeName) {
  const spinner = ora('🚀 正在获取API数据...').start();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.statusText}`);
    }

    const jsonData = await response.json();
    spinner.text = '🔄 正在解析数据结构...';

    const sampleData = Array.isArray(jsonData) ? jsonData[0] : jsonData;

    spinner.text = '📝 正在生成类型定义...';
    const jsonInput = await jsonInputForTargetLanguage('typescript');
    await jsonInput.addSource({
      name: typeName,
      samples: [JSON.stringify(sampleData)],
    });

    const inputData = new InputData();
    inputData.addInput(jsonInput);

    spinner.text = '🎨 正在优化类型结构...';
    const { lines } = await quicktype({
      lang: 'typescript',
      inputData,
      alphabetizeProperties: true,
      rendererOptions: {
        'just-types': 'true',
        'explicit-unions': 'true',
      },
    });

    spinner.succeed(chalk.green('✨ 太棒了！类型定义生成成功！'));

    if (!lines || lines.length === 0) {
      throw new Error('⚠️ 生成的类型为空，请检查API返回数据');
    }

    return { lines };
  } catch (error) {
    spinner.fail(chalk.red('❌ 处理失败'));
    throw error;
  }
}

async function promptUser() {
  console.log(chalk.cyan('\n👋 欢迎使用类型生成工具！让我们开始吧~\n'));

  const questions = [
    {
      type: 'input',
      name: 'url',
      message: '🌐 请输入API URL地址:',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return '❌ URL格式不正确，请输入有效的URL';
        }
      },
    },
    {
      type: 'input',
      name: 'name',
      message: '📝 请输入类型名称:',
      default: 'ApiTypes',
      validate: (input) => {
        if (/^[A-Za-z][A-Za-z0-9]*$/.test(input)) {
          return true;
        }
        return '❌ 类型名称必须以字母开头，且只能包含字母和数字';
      },
    },
    {
      type: 'list',
      name: 'path',
      message: '📂 请选择保存位置:',
      choices: [
        { name: '💻 桌面', value: desktopPath },
        { name: '📁 当前目录', value: currentPath },
        { name: '🔍 自定义路径', value: 'custom' },
      ],
    },
  ];

  const answers = await inquirer.prompt(questions);

  if (answers.path === 'custom') {
    const { customPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customPath',
        message: '📁 请输入保存路径:',
        default: currentPath,
        validate: (input) => {
          if (shell.test('-d', input)) {
            return true;
          }
          return '❌ 路径不存在，请输入有效的路径';
        },
      },
    ]);
    answers.path = customPath;
  }

  return answers;
}

program
  .version(transformed)
  .description('🚀 从API URL生成TypeScript类型定义')
  .option('-u, --url <url>', 'API URL地址')
  .option('-n, --name <name>', '生成的类型名称')
  .option('-p, --path <path>', '保存路径')
  .action(async (options) => {
    try {
      const config = options.url ? options : await promptUser();

      const { lines } = await generateTypes(config.url, config.name);

      const spinner = ora('💾 正在保存文件...').start();

      // 使用shelljs创建目录
      if (!shell.test('-d', config.path)) {
        shell.mkdir('-p', config.path);
      }

      const fullPath = path.join(config.path, `${config.name}.ts`);
      // 使用shelljs写入文件
      shell.ShellString(lines.join('\n')).to(fullPath);

      spinner.succeed(chalk.green('🎉 文件保存成功！'));

      console.log(chalk.cyan('\n📍 文件保存在:'), fullPath);
      console.log(chalk.yellow('\n👀 类型定义预览:\n'));
      console.log(chalk.gray('✨ ----------------------------------------'));
      console.log(lines.join('\n'));
      console.log(chalk.gray('✨ ----------------------------------------\n'));

      // 如果安装了VSCode，提供打开选项
      if (hasVSCode) {
        const { openFile } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'openFile',
            message: '🔍 是否要在VSCode中打开生成的文件？',
            default: false,
          },
        ]);

        if (openFile) {
          // 使用shelljs执行命令
          const result = shell.exec(`code "${fullPath}"`, { silent: true });
          if (result.code === 0) {
            console.log(chalk.green('\n📝 已在VSCode中打开文件'));
          } else {
            console.log(chalk.yellow('\n⚠️  无法自动打开文件，请手动打开查看'));
          }
        }
      }

      console.log(chalk.green('\n👋 感谢使用，祝您开发愉快！\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ 错误:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
