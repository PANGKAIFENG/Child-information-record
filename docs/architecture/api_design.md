# 孩子发育信息记录系统 - API设计

本文档描述了系统的API设计，包括各个接口的路径、请求方法、参数说明和返回格式。

## API 概览

系统主要提供以下API接口：

1. **用户认证与授权**
   - 登录
   - 获取用户信息

2. **婴幼儿信息管理**
   - 创建婴幼儿信息
   - 更新婴幼儿信息
   - 获取婴幼儿信息
   - 删除婴幼儿信息

3. **记录管理**
   - 创建记录（喂养、睡眠、排泄、补给品、异常）
   - 更新记录
   - 获取记录
   - 删除记录

4. **数据分析与统计**
   - 获取统计数据

5. **家庭组管理**
   - 创建家庭组
   - 更新家庭组
   - 获取家庭组信息
   - 删除家庭组

## 详细API设计

### 1. 用户认证与授权

#### 登录
- **路径**：`POST /api/auth/login`
- **描述**：用户通过微信登录，获取会话信息。
- **请求参数**：
  - `code` (string): 微信登录凭证
- **返回格式**：
  ```json
  {
    "token": "string",  // 会话令牌
    "userId": "string"  // 用户ID
  }
  ```

#### 获取用户信息
- **路径**：`GET /api/auth/user`
- **描述**：获取当前登录用户的信息。
- **请求参数**：无
- **返回格式**：
  ```json
  {
    "userId": "string",
    "nickName": "string",
    "avatarUrl": "string",
    "gender": "number",
    "role": "string"
  }
  ```

### 2. 婴幼儿信息管理

#### 创建婴幼儿信息
- **路径**：`POST /api/babies`
- **描述**：创建新的婴幼儿信息。
- **请求参数**：
  ```json
  {
    "name": "string",
    "nickname": "string",
    "gender": "number",
    "birthDate": "date",
    "avatar": "string"
  }
  ```
- **返回格式**：
  ```json
  {
    "babyId": "string"
  }
  ```

#### 更新婴幼儿信息
- **路径**：`PUT /api/babies/{babyId}`
- **描述**：更新指定婴幼儿的信息。
- **请求参数**：
  ```json
  {
    "name": "string",
    "nickname": "string",
    "gender": "number",
    "birthDate": "date",
    "avatar": "string"
  }
  ```
- **返回格式**：无

#### 获取婴幼儿信息
- **路径**：`GET /api/babies/{babyId}`
- **描述**：获取指定婴幼儿的信息。
- **请求参数**：无
- **返回格式**：
  ```json
  {
    "babyId": "string",
    "name": "string",
    "nickname": "string",
    "gender": "number",
    "birthDate": "date",
    "avatar": "string"
  }
  ```

#### 删除婴幼儿信息
- **路径**：`DELETE /api/babies/{babyId}`
- **描述**：删除指定婴幼儿的信息。
- **请求参数**：无
- **返回格式**：无

### 3. 记录管理

#### 创建记录
- **路径**：`POST /api/records`
- **描述**：创建新的记录（喂养、睡眠、排泄、补给品、异常）。
- **请求参数**：
  ```json
  {
    "babyId": "string",
    "recordType": "string",  // 'feeding', 'sleep', 'excretion', 'supplement', 'abnormal'
    "data": { ... }           // 具体记录数据，格式根据recordType而定
  }
  ```
- **返回格式**：
  ```json
  {
    "recordId": "string"
  }
  ```

#### 更新记录
- **路径**：`PUT /api/records/{recordId}`
- **描述**：更新指定记录的信息。
- **请求参数**：
  ```json
  {
    "data": { ... }  // 具体记录数据，格式根据recordType而定
  }
  ```
- **返回格式**：无

#### 获取记录
- **路径**：`GET /api/records`
- **描述**：获取指定条件的记录列表。
- **请求参数**：
  - `babyId` (string): 婴幼儿ID
  - `recordType` (string): 记录类型
  - `startDate` (date): 开始日期
  - `endDate` (date): 结束日期
- **返回格式**：
  ```json
  [
    {
      "recordId": "string",
      "babyId": "string",
      "recordType": "string",
      "data": { ... },
      "createdAt": "date"
    }
  ]
  ```

#### 删除记录
- **路径**：`DELETE /api/records/{recordId}`
- **描述**：删除指定记录。
- **请求参数**：无
- **返回格式**：无

### 4. 数据分析与统计

#### 获取统计数据
- **路径**：`GET /api/statistics`
- **描述**：获取指定婴幼儿的统计数据。
- **请求参数**：
  - `babyId` (string): 婴幼儿ID
  - `type` (string): 统计类型，如'feeding', 'sleep', 'excretion'
  - `period` (string): 时间周期，如'daily', 'weekly'
- **返回格式**：
  ```json
  {
    "type": "string",
    "period": "string",
    "data": [ ... ]
  }
  ```

### 5. 家庭组管理

#### 创建家庭组
- **路径**：`POST /api/familyGroups`
- **描述**：创建新的家庭组。
- **请求参数**：
  ```json
  {
    "name": "string",
    "adminUserId": "string"
  }
  ```
- **返回格式**：
  ```json
  {
    "familyGroupId": "string"
  }
  ```

#### 更新家庭组
- **路径**：`PUT /api/familyGroups/{familyGroupId}`
- **描述**：更新指定家庭组的信息。
- **请求参数**：
  ```json
  {
    "name": "string",
    "members": [ ... ]
  }
  ```
- **返回格式**：无

#### 获取家庭组信息
- **路径**：`GET /api/familyGroups/{familyGroupId}`
- **描述**：获取指定家庭组的信息。
- **请求参数**：无
- **返回格式**：
  ```json
  {
    "familyGroupId": "string",
    "name": "string",
    "adminUserId": "string",
    "members": [ ... ]
  }
  ```

#### 删除家庭组
- **路径**：`DELETE /api/familyGroups/{familyGroupId}`
- **描述**：删除指定家庭组。
- **请求参数**：无
- **返回格式**：无

## 安全与认证

- 所有API请求必须携带有效的会话令牌（token）
- 使用HTTPS确保数据传输安全

## 文档更新记录
| 日期 | 版本 | 更新内容 | 作者 |
|------|------|---------|------|
| 2024-05-24 | v1.0 | 初始化API设计文档 | AI | 