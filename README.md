# 坦克大战 · Tank Battle

用 **Next.js 15 + React 19 + Canvas** 实现的经典「坦克大战」2游戏。

![game](https://img.shields.io/badge/Next.js-15-black) ![react](https://img.shields.io/badge/React-19-blue)

## 运行

```bash
npm install
npm run dev      # 开发环境 http://localhost:3000
npm run build    # 生产构建
npm start        # 运行生产版本
```

## 玩法

保卫底部的基地（金色鹰徽），消灭所有敌方坦克即可过关。

| 操作 | 按键 |
| --- | --- |
| 移动 | `W` `A` `S` `D` 或 方向键 |
| 开火 | `空格` 或 `J` |
| 暂停 | `P` |
| 开始 / 下一关 | `Enter` |

## 特性

- **像素风 Canvas 渲染**：砖墙、钢墙、河流（动态波纹）、草丛（遮挡视野）、基地鹰徽。
- **多种敌人 AI**：普通 / 快速 / 火力 / 装甲坦克，自动寻路、瞄准玩家或基地开火。
- **道具系统**：
  - ★ 升级火力（最高 3 级，子弹可破钢墙、双发）
  - ◈ 护盾
  - ♥ 额外生命
  - ✸ 全屏炸弹
  - ◷ 冻结敌人
- **奖励坦克**：闪烁的粉色坦克，击杀 +500 分并必掉道具。
- **关卡系统**：难度递增，地图随关卡随机生成（左右对称），敌人数量与属性递增。
- **特效**：爆炸粒子、履带扬尘、开火光晕、护盾光环、屏幕震动感。
- **最高分本地存档**（localStorage）。
- 完全静态导出，无后端依赖。

## 项目结构

```
tank-game/
├── app/
│   ├── layout.tsx        # 根布局
│   ├── page.tsx          # 游戏主组件（状态、按键、HUD 覆盖层）
│   └── globals.css       # 全局样式
├── game/
│   ├── types.ts          # 类型与常量（尺寸、地块、实体）
│   ├── engine.ts         # 游戏核心逻辑（地图生成、AI、碰撞、子弹、道具）
│   └── render.ts         # Canvas 渲染
├── next.config.ts
└── tsconfig.json
```

### 核心常量

画面为 15×15 格，每格 32px，共 480×480。基地位于底部中央 `(7,14)`，敌人在顶部三个位置刷新。

## 扩展建议

- 引入 `requestAnimationFrame` 之外的时间步进（当前已做 `dt` 归一化）。
- 增加双人模式：为第二名玩家添加独立按键映射与玩家数组。
- 用 Web Audio API 补充音效。
- 关卡编辑器：把 `map` 序列化为 JSON 存为固定关卡。
