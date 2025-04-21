# 孩子发育信息记录系统 - 数据模型设计

本文档描述了系统的数据模型设计，包括各个数据集合的结构、字段说明和关系。

## 数据集合概览

系统主要包含以下数据集合：

1. **users** - 用户信息
2. **babies** - 婴幼儿信息
3. **feedingRecords** - 喂养记录
4. **sleepRecords** - 睡眠记录
5. **excretionRecords** - 排泄记录
6. **supplementRecords** - 补给品记录
7. **abnormalRecords** - 异常记录
8. **growthRecords** - 生长发育记录
9. **familyGroups** - 家庭组关系

## 详细数据模型

### 1. users 集合

存储系统用户信息。

```javascript
{
  _id: String,                 // 用户ID（微信OpenID）
  nickName: String,            // 用户昵称
  avatarUrl: String,           // 头像URL
  gender: Number,              // 性别：0未知，1男，2女
  role: String,                // 角色：'parent'，'grandparent'等
  phone: String,               // 电话（可选）
  createdAt: Date,             // 创建时间
  updatedAt: Date,             // 更新时间
  lastLoginAt: Date,           // 最后登录时间
}
```

### 2. babies 集合

存储婴幼儿基本信息。

```javascript
{
  _id: String,                 // 婴幼儿ID
  name: String,                // 姓名
  nickname: String,            // 昵称
  gender: Number,              // 性别：0未知，1男，2女
  birthDate: Date,             // 出生日期
  avatar: String,              // 头像URL
  familyGroupId: String,       // 关联的家庭组ID
  createdBy: String,           // 创建者ID（用户ID）
  createdAt: Date,             // 创建时间
  updatedAt: Date,             // 更新时间
}
```

### 3. feedingRecords 集合

存储喂养记录。

```javascript
{
  _id: String,                 // 记录ID
  babyId: String,              // 关联婴幼儿ID
  feedingType: String,         // 喂养类型：'breastMilk'，'formula'
  amount: Number,              // 奶量（ml），母乳可空
  startTime: Date,             // 开始时间
  endTime: Date,               // 结束时间（可选）
  duration: Number,            // 持续时间（分钟，可选）
  note: String,                // 备注
  createdBy: String,           // 记录创建者ID
  createdAt: Date,             // 创建时间
  updatedAt: Date              // 更新时间
}
```

### 4. sleepRecords 集合

存储睡眠记录。

```javascript
{
  _id: String,                 // 记录ID
  babyId: String,              // 关联婴幼儿ID
  startTime: Date,             // 入睡时间
  endTime: Date,               // 醒来时间（可为空，表示尚未醒来）
  duration: Number,            // 睡眠时长（分钟，根据开始结束时间计算）
  sleepQuality: String,        // 睡眠质量：'good'，'normal'，'bad'
  location: String,            // 睡眠地点
  note: String,                // 备注
  createdBy: String,           // 记录创建者ID
  createdAt: Date,             // 创建时间
  updatedAt: Date              // 更新时间
}
```

### 5. excretionRecords 集合

存储排泄记录。

```javascript
{
  _id: String,                 // 记录ID
  babyId: String,              // 关联婴幼儿ID
  excretionType: String,       // 排泄类型：'pee'，'poop'
  time: Date,                  // 时间
  poopColor: String,           // 大便颜色（仅大便时有效）
  poopConsistency: String,     // 大便性状（仅大便时有效）
  abnormal: Boolean,           // 是否异常
  note: String,                // 备注
  imageUrls: [String],         // 照片URL数组（可选）
  createdBy: String,           // 记录创建者ID
  createdAt: Date,             // 创建时间
  updatedAt: Date              // 更新时间
}
```

### 6. supplementRecords 集合

存储补给品和药物记录。

```javascript
{
  _id: String,                 // 记录ID
  babyId: String,              // 关联婴幼儿ID
  supplementType: String,      // 补给品类型，如'vitaminD'，'probiotics'等
  customName: String,          // 自定义补给品/药物名称
  dosage: String,              // 剂量
  time: Date,                  // 服用时间
  note: String,                // 备注
  createdBy: String,           // 记录创建者ID
  createdAt: Date,             // 创建时间
  updatedAt: Date              // 更新时间
}
```

### 7. abnormalRecords 集合

存储异常情况记录。

```javascript
{
  _id: String,                 // 记录ID
  babyId: String,              // 关联婴幼儿ID
  abnormalType: String,        // 异常类型：'fever'，'rash'等
  startTime: Date,             // 开始时间
  endTime: Date,               // 结束时间（可为空）
  temperature: Number,         // 体温（仅发热时有效）
  symptoms: [String],          // 症状描述
  treatment: String,           // 处理方式
  note: String,                // 备注
  imageUrls: [String],         // 照片URL数组
  createdBy: String,           // 记录创建者ID
  createdAt: Date,             // 创建时间
  updatedAt: Date              // 更新时间
}
```

### 8. growthRecords 集合

存储生长发育记录。

```javascript
{
  _id: String,                 // 记录ID
  babyId: String,              // 关联婴幼儿ID
  recordDate: Date,            // 记录日期
  height: Number,              // 身高（cm）
  weight: Number,              // 体重（kg）
  headCircumference: Number,   // 头围（cm）
  note: String,                // 备注
  createdBy: String,           // 记录创建者ID
  createdAt: Date,             // 创建时间
  updatedAt: Date              // 更新时间
}
```

### 9. familyGroups 集合

存储家庭组关系，用于授权和协作。

```javascript
{
  _id: String,                 // 家庭组ID
  name: String,                // 家庭组名称
  adminUserId: String,         // 管理员用户ID
  members: [{                  // 成员列表
    userId: String,            // 成员用户ID
    role: String,              // 成员角色
    joinTime: Date             // 加入时间
  }],
  babies: [String],            // 关联的婴幼儿ID列表
  inviteCode: String,          // 邀请码
  inviteCodeExpireAt: Date,    // 邀请码过期时间
  createdAt: Date,             // 创建时间
  updatedAt: Date              // 更新时间
}
```

## 数据关系图

```
+---------------+       +---------------+       +---------------+
|               |       |               |       |               |
|    users      |<----->| familyGroups |<----->|    babies     |
|               |       |               |       |               |
+---------------+       +---------------+       +---------------+
                                                       ^
                                                       |
                                                       v
+---------------+     +---------------+     +---------------+     +---------------+
|               |     |               |     |               |     |               |
| feedingRecords|     | sleepRecords  |     |excretionRecords     |supplementRecords|
|               |     |               |     |               |     |               |
+---------------+     +---------------+     +---------------+     +---------------+
                           ^
                           |
                           v
               +---------------+     +---------------+
               |               |     |               |
               |abnormalRecords|     | growthRecords |
               |               |     |               |
               +---------------+     +---------------+
```

## 索引设计

为提高查询性能，以下是建议的索引设计：

### users 集合
- `_id`: 主键索引

### babies 集合
- `_id`: 主键索引
- `familyGroupId`: 用于按家庭组查询
- `createdBy`: 用于按创建者查询

### 各类记录集合（feedingRecords, sleepRecords, excretionRecords等）
- `_id`: 主键索引
- `babyId`: 用于按婴幼儿查询
- `time` 或 `startTime`: 用于时间范围查询
- `createdBy`: 用于按记录者查询

### familyGroups 集合
- `_id`: 主键索引
- `adminUserId`: 用于按管理员查询
- `inviteCode`: 用于邀请码查询

## 数据验证与约束

- 所有日期字段必须是有效的Date对象
- 数值型字段（如奶量、体重等）必须在合理范围内
- 关联ID必须存在对应的文档

## 数据迁移策略

随着产品迭代，可能需要对数据模型进行调整。迁移策略如下：

1. 新增字段：直接添加，旧数据使用默认值
2. 字段重命名：创建迁移脚本，更新所有相关文档
3. 结构变更：先兼容旧结构，同时写入新结构，待所有数据迁移完成后删除旧结构

## 文档更新记录
| 日期 | 版本 | 更新内容 | 作者 |
|------|------|---------|------|
| 2024-05-24 | v1.0 | 初始化数据模型设计 | AI |