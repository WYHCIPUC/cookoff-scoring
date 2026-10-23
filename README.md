# 厨艺比赛评委打分工具

> 一个可复用的**手机端在线打分工具**：多组各出品 2 道菜，除本组外每组推举一位评委匿名打分，云端实时汇总，自动去极值，小组总分最高者获胜。

## 安全模型（必读）

本项目从 v1.0.0 起采用**可信后端鉴权**：

- 主持人通过云函数 `admin-login` 校验口令后，换取自定义登录 ticket，获得管理员身份。
- 评委在「我是评委」页选择本组后，调用云函数 `register-judge` 登记并换取 `judge:{groupId}` ticket。
- 评分、赛程切换、配置修改等写操作全部走云函数，云函数内部校验身份、阶段、本组回避、分值范围后再写库。
- 数据库安全规则拒绝客户端直接写入敏感集合。

**不要把旧版的「默认口令 1011」再写入 README 或源码。首次部署后，主持人通过首次设置流程自行设定口令。**

## 快速开始

### 1. 准备 CloudBase 环境

- 创建 CloudBase 环境（文档型数据库）。
- 在控制台开启「匿名登录」和「自定义登录」。
- 下载自定义登录私钥 `tcb_custom_login.json`（控制台 → 身份认证 → 自定义登录）。

### 2. 本地配置

```bash
npm install
cp .env.example .env
# 编辑 .env，填入你的 envId
cp /path/to/tcb_custom_login.json ./cloudfunctions/admin-login/
# 把同一份私钥复制到所有 cloudfunctions/* 目录（或部署时通过环境变量注入）
```

`.env` 示例：

```bash
TCB_ENV_ID=your-env-id
```

### 3. 初始化云端资源

```bash
npm run setup:cloud -- your-env-id
```

这会创建 `cc_config`、`cc_scores`、`cc_photos`、`cc_dishphotos`、`cc_judges` 五个集合并设置最小授权安全规则。

### 4. 部署云函数

```bash
tcb fn deploy --env your-env-id
```

或按 CloudBase MCP / 控制台逐个部署 `cloudfunctions/` 下的函数。

### 5. 构建并部署前端

```bash
npm run build -- your-env-id
# 部署 dist/ 到 CloudBase 静态托管
```

### 6. 首次使用

打开部署后的链接，进入「主持人后台」→ 首次使用会提示设置主持人口令。设置后，主持人可用该口令登录并管理比赛。

## 本地开发与测试

```bash
# 运行计分逻辑单元测试
npm test

# 静态检查（检测源码中是否残留旧 envId/默认口令提示）
npm run lint

# 本地演示模式（无云端依赖）
npm run preview
# 然后访问 http://localhost:8080/index.html?demo=1
```

## 比赛当天操作 SOP

**赛前（主持人）**
1. 打开链接 → 主持人后台 → 输口令 → 「组与菜品」
2. 确认各组：组名、成员（2–3 人）、两道菜名、指定评委代表
3. 「评分规则」确认：活动名、比赛时间/地点、评分维度与权重、去极值、评分期间隐藏分数

**出菜后**
4. 每组出菜时，主持人为每道菜拍 📷 靓照
5. 主持人「赛程控制」→ 点 **🔔 开火 · 开始评分**
6. 评委们扫码/点链接 → 「我是评委」→ 选自己组 → 逐菜打分（打错可重打）
7. 想拍照的伙伴进「精彩瞬间」随手上传
8. 主持人在「赛程控制」盯交卷状态

**揭晓**
9. 全部交齐后点 **🏁 收锅 · 揭晓榜单**
10. 榜单页生成结果海报 → 长按保存 → 发群/朋友圈
11. 「精彩瞬间」→ **📚 整理成照片合集**
12. 「赛程控制」→ **📦 导出配置与评分** 留档

## 数据结构

- `cc_config`（doc `app`）：比赛配置、组与菜品、评分维度、phase、管理员 UID
- `cc_scores`：每评委 × 每菜一条评分（含 `judge`、`target`、`idx`、`scores`、`comment`、`ts`）
- `cc_photos`：精彩瞬间照片元数据与 base64 数据
- `cc_dishphotos`：菜品靓照（doc key 为 `{gid}_{idx}`）
- `cc_judges`：评委登记记录（doc key 为 `{gid}`，含 `customUserId`）

## 项目结构

```
cloudfunctions/          # 可信后端云函数
  admin-login/           # 管理员登录 / 首次设置
  admin-set-phase/       # 切换赛程阶段
  admin-update-config/   # 更新比赛配置
  admin-import-groups/   # 批量导入组
  admin-clear-scores/    # 清空评分
  admin-reset-all/       # 恢复默认
  admin-export/          # 导出配置与评分
  register-judge/        # 评委登记
  submit-score/          # 提交评分
  upload-photo/          # 上传精彩瞬间
  upload-dish-photo/     # 上传菜品靓照
public/
  index.html             # 单文件前端（正式版 + 演示模式）
  landing.html           # 介绍页
  qr.png                 # 示例二维码
scripts/
  build-dist.mjs         # 把 envId 注入 dist/index.html
  setup-cloud.mjs        # 云端初始化
  lint.mjs               # 简单静态检查
  preview.mjs            # 本地预览服务器
src/
  scoring.js             # 纯计分函数（浏览器 + Node 共用）
test/
  scoring.test.js        # 计分逻辑单元测试
```

## 安全边界与注意

- 不要把 `tcb_custom_login.json`、`.env`、真实 envId 提交到公开仓库。
- 主持人口令由活动现场自行设置，不在代码或 README 中预设。
- 完全断网时本次比赛评分不可用（无离线模式），请在有网络环境下使用。

## License

[MIT](./LICENSE)
