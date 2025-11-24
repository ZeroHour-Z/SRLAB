## Only Run Locally Now

### 重要提示：Node.js 版本，不然你一直rundev不了！

**每次在新终端中运行项目前，先切换 Node.js 版本：**

```bash
# 写了个启动脚本（自动帮你切换版本）
./dev.sh

# 自己动手，丰衣足食
nvm use  # 使用 .nvmrc 中指定的版本（Node.js 20）
# 或者手动指定：nvm use 20
```

### 快速开始！

1. **安装依赖**（确保已切换到 Node.js 20）：
   ```bash
   nvm use
   npm install
   ```

2. **启动开发服务器**：
   ```bash
   # 方法 1：使用启动脚本
   ./dev.sh
   
   # 方法 2：手动启动（确保已切换版本）
   nvm use
   npm run dev
   ```

## 功能

- **信号分析（DSP）**：实时音频可视化，完整的 DSP 流程分析（加窗、FFT、Mel 滤波器组、MFCC）
- **模板匹配（DTW）**：基于动态时间规整算法的语音命令识别
