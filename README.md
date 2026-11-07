# 抖音直播防暂停 Douyin Live Keep-Alive

一个油猴（Tampermonkey）脚本：让抖音网页版直播**不再因为长时间无操作或切后台而自动暂停**，不用下载抖音客户端。

[English](#english)

## 解决什么问题

用浏览器看抖音直播时：

- 几分钟不碰鼠标键盘，直播会自动暂停，并弹出"继续观看"之类的确认框；
- 把标签页切到后台、或切到其他窗口，直播也会被暂停。

本脚本从四个层面规避这个问题，层层兜底：

| 层级 | 手段 | 解决的场景 |
| --- | --- | --- |
| 1 | 可见性伪装：让页面始终"以为"自己在前台、有焦点 | 切后台 / 切窗口立刻被暂停 |
| 2 | 活动模拟：定时派发合成鼠标移动事件 | 长时间无操作触发挂机判定 |
| 3 | 弹窗自动点击：发现"继续观看"类按钮就点掉 | 挂机确认弹窗 |
| 4 | 暂停恢复：非人为的视频暂停自动恢复播放 | 一切漏网的自动暂停 |

**尊重手动暂停**：10 秒内有过你的真实点击 / 按键 / 滚轮操作导致的暂停，脚本不会干预。脚本自己合成的鼠标事件无法伪造 `isTrusted` 标记，所以这个判断不会被脚本自己污染。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展：
   - Edge 用户：从 [Edge 加载项商店](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) 安装；
   - Chrome 用户：从 [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) 安装。
2. 安装本脚本，两种方式任选：
   - **方式 A（推荐）**：在本仓库中打开 `douyin-live-keepalive.user.js`，点击 Raw（原始文件），Tampermonkey 会自动弹出安装页面，点"安装"即可，之后更新仓库脚本可自动同步；
   - **方式 B**：点浏览器右上角 Tampermonkey 图标 → 添加新脚本 → 全选删除模板代码 → 粘贴 `douyin-live-keepalive.user.js` 的全部内容 → `Ctrl + S` 保存。
3. 打开或刷新 `live.douyin.com` 的直播间即可生效。脚本没有任何界面，装完即忘。

### 不想装 Tampermonkey？直接装本地扩展（Ego Lite 等浏览器适用）

部分浏览器（如 Ego Lite）会屏蔽 Chrome 应用店的安装通道，这时可以用本仓库自带的扩展版本，效果与油猴脚本完全一致：

1. 下载本仓库（`Code → Download ZIP` 解压，或 `git clone`）；
2. 地址栏输入 `chrome://extensions` 打开扩展管理页；
3. 打开右上角**开发者模式**；
4. 点击**加载已解压的扩展程序**（Ego Lite 中叫"加载未打包的扩展程序"），选择本仓库的 `extension` 文件夹即可。

之后如需更新，替换 `extension/keepalive.js` 后在扩展管理页点击该扩展的刷新按钮即可。

## 工作原理

1. **可见性伪装**：在页面所有代码运行之前（`@run-at document-start`），把 `document.hidden` / `document.visibilityState` / `document.hasFocus()` 改写为"永远可见、永远有焦点"，并拦截 `visibilitychange` / 窗口级 `blur` 事件，让抖音的代码感知不到页面进入了后台。脚本自己会先记下真实可见性，供第 4 层判断使用。
2. **活动模拟**：每 30 秒派发一次合成的 `mousemove` 事件，重置"长时间未操作"的计时。
3. **弹窗自动点击**：每 2 秒扫描一次页面，发现文案为"继续观看 / 继续播放 / 仍然观看"等短文案的按钮就自动点击（只点击可见、文案不超过 12 字的最内层元素，避免误点）。
4. **暂停监视器**：监听页面上所有 `<video>` 的 `pause` 事件——如果是后台发生的暂停，或者最近 10 秒内没有你的真实操作，就在 1 秒后自动恢复播放；另外每 5 秒对后台标签页做一次兜底巡检。

## 常见问题

**Q：挂机弹窗又出现了 / 新的弹窗文案没有被自动点击？**
抖音会不定期调整弹窗文案。按 `F12` 打开控制台，把弹窗按钮上的文字加进脚本开头的 `RESUME_TEXTS` 列表即可；也欢迎提 Issue 告诉我们文案内容。

**Q：怎么临时停用？**
点 Tampermonkey 图标，把本脚本的开关关掉，刷新页面。

**Q：控制台里的 `[douyin-live-keepalive]` 日志是什么？**
脚本每次自动点击按钮都会留日志，方便确认它有没有正常工作。

**Q：会不会误点页面上的其他东西？**
自动点击只匹配"文案很短且命中特定文案列表"的可见元素，误点概率很低；如果遇到误点，请开 Issue 反馈。

## 隐私

脚本**不发起任何网络请求、不收集也不上传任何数据**，全部逻辑都在你的浏览器本地运行。

## 免责声明

本项目仅供个人学习与个人使用，与抖音 / 字节跳动官方无关；是否使用请自行评估，并请遵守平台服务条款。抖音页面结构更新可能导致部分功能失效，欢迎提 Issue。

## English

A Tampermonkey userscript that stops Douyin (douyin.com) web live streams from auto-pausing when you are idle or the tab is in the background — no desktop client needed.

It works in four layers: it spoofs the Page Visibility API so the page always believes it is foregrounded, periodically dispatches synthetic mouse activity, auto-clicks "continue watching" confirmation dialogs, and automatically resumes any non-user-initiated video pause (pauses you trigger yourself within the last 10 seconds are respected). Install [Tampermonkey](https://www.tampermonkey.net/), then paste `douyin-live-keepalive.user.js` into a new userscript. No network requests, no data collection. MIT licensed.

## Roadmap

- [ ] 发布到 GreasyFork，支持一键安装与自动更新
- [ ] 可视化设置面板（自定义弹窗文案、暂停恢复开关）

## License

[MIT](LICENSE)
