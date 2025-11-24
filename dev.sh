#!/bin/bash
# 开发服务器启动脚本
# 自动切换到正确的 Node.js 版本并启动开发服务器

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 使用 .nvmrc 中指定的版本
nvm use

# 启动开发服务器
npm run dev

