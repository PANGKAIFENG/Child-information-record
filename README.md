# 孩子发育信息记录系统

## 项目简介
这是一个用于记录和追踪孩子发育信息的微信小程序。系统旨在帮助新手父母和家庭成员便捷地记录、追踪和分析婴幼儿的日常生活状况，包括喂养、睡眠、排泄等信息，以及成长发育关键数据。

## 核心特性
- **简洁快速的日常记录**：一键记录喂奶、睡眠、排泄等日常信息
- **多媒体记录支持**：记录并保存湿疹、发育里程碑等图片和视频
- **数据可视化分析**：查看奶量、睡眠、大小便次数等趋势图表
- **家庭成员协作**：通过微信分享，让家庭成员共同参与记录和照顾
- **智能提醒功能**：
  - ✅ **喂养间隔提醒**：可在每次喂养记录时设置下一次喂养的提醒时间（需用户授权发送订阅消息）。
  - ⏳ **用药提醒**：[待开发]

## 目标用户
- 新生婴幼儿的父母，特别是新手父母
- 参与照顾婴幼儿的家庭成员（如祖父母、亲戚）
- 关注婴幼儿发育情况的医护人员

## 技术栈
- 前端：微信小程序
- 后端：云开发
- 数据库：云数据库
- 存储：云存储（用于多媒体文件）

## 开发计划
项目将分三个阶段进行开发：
1. **阶段一（MVP）**：基础记录功能、简单数据统计、微信分享
2. **阶段二**：数据分析增强、操作日志、更多自定义选项
3. **阶段三**：辅食记录、高级分析功能、更多自定义功能

## 可复用组件

### `reminder-setting` 组件

- **位置**: `src/components/reminder-setting/`
- **功能**: 提供一个包含时间选择和开关的UI，用于设置基于时间的提醒，并处理微信订阅消息的授权请求。
- **使用**: 
  ```wxml
  <reminder-setting 
    bind:change="handleReminderChange" 
    tmplId="YOUR_TEMPLATE_ID" 
    initialEnabled="{{false}}" 
    initialHours="{{3}}" 
    initialMinutes="{{0}}">
  </reminder-setting>
  ```
- **属性**:
  - `bind:change`: 事件，当设置改变时触发，返回 `{ enabled, hours, minutes }`。
  - `tmplId`: String, **必需**, 微信订阅消息模板 ID。
  - `initialEnabled`: Boolean, 可选, 初始开关状态, 默认 `false`。
  - `initialHours`: Number, 可选, 初始小时数, 默认 `3`。
  - `initialMinutes`: Number, 可选, 初始分钟数, 默认 `0`。

## 云函数说明

### 提醒功能相关云函数

#### `addRecord`
添加数据记录的通用云函数，已增强为支持处理提醒设置：
- 检测记录数据中是否包含 `reminder` 字段，且 `reminder.enabled` 为 `true`。
- 根据记录的日期时间和提醒设置的时间间隔，计算下一次提醒的具体时间。
- 将计算出的提醒时间保存在 `reminder.nextReminderTime` 字段中。
- 如果是喂养记录（`feeding_records` 集合），会在 `scheduled_reminders` 集合中创建对应的提醒任务。

#### `sendReminderMessage`
- **功能**：发送微信小程序订阅消息提醒。
- **调用方式**：
  1. 通过 `reminderId` 参数，从 `scheduled_reminders` 集合获取提醒信息并发送。
  2. 或直接传入 `userId`、`templateId`、`data` 等参数。
- **处理逻辑**：
  - 检查提醒状态，避免重复发送。
  - 调用微信订阅消息接口。
  - 更新提醒记录的状态为已发送或失败。
  - 如果是喂养提醒，同时更新原喂养记录中的提醒状态。

#### `scheduleReminders`
- **功能**：定时检查是否有需要发送的提醒，自动触发提醒发送。
- **触发方式**：通过定时触发器，每5分钟自动执行一次。
- **处理逻辑**：
  - 查询状态为 `pending` 且提醒时间在过去15分钟内的提醒记录。
  - 对每条提醒记录调用 `sendReminderMessage` 云函数发送订阅消息。
  - 更新提醒记录的状态。

### 云数据库集合结构

#### `scheduled_reminders` 集合
存储所有已计划的提醒任务：
- `type`: 提醒类型，如 'feeding'（喂养）。
- `userId`: 接收提醒的用户 OpenID。
- `familyId`: 所属家庭 ID。
- `sourceRecordId`: 原记录的 ID（如喂养记录 ID）。
- `scheduledTime`: 计划发送提醒的时间。
- `status`: 提醒状态 ('pending', 'sent', 'failed', 'canceled')。
- `templateId`: 使用的订阅消息模板 ID。
- `templateData`: 发送给模板的数据。

## 快速开始
[待补充]

## 文档导航
- [详细文档目录](./docs/README.md)
- [产品需求文档](./docs/PRD.md)
- [架构设计文档](./docs/architecture/README.md)
- [环境搭建指南](./docs/setup_guide.md)
- [部署说明](./docs/deployment.md)

## 开发规范
- [编码规范与 AI 协作指南](./.cursor-guidelines.md)

## 技术支持
[待补充] 