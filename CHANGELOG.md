# Changelog

## v1.0.0 — 安全加固与可用性重构

### 安全（P0）
- 移除源码与 README 中的默认口令 `1011`；首次使用由主持人现场设置口令。
- 移除 `cloudbaserc.json` 中的硬编码 envId，改为模板占位符。
- 引入 CloudBase 云函数作为可信后端：管理员 PIN 校验、评委登记、评分提交、赛程切换、配置修改均在服务端完成身份与权限校验。
- 数据库安全规则改为客户端只读，敏感写操作全部走云函数。

### 计分规则（P1）
- 抽出 `src/scoring.js` 纯计分模块，添加 15 项单元测试。
- `computeResults` 现在排除本组自评、未知评委、NaN/Infinity 与越界（1–10）分项。

### 可靠性与维护性（P1/P2）
- 评分与照片元数据读取改为分页循环，突破原 300/200 条限制。
- 新增「数据导出」功能（配置 + 评分 JSON）。
- 新增 `package.json`、`LICENSE`（MIT）、`.env.example`、`.gitignore`。
- 新增 `npm test`、`npm run lint`、`npm run preview` 脚本。
- 重写 README 与部署文档。
