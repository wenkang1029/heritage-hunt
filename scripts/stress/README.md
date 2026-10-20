# Firestore Emulator 压测

用本地 Firebase Emulator 模拟很多台手机同时玩，检查 Firestore 最后的数据对不对。
**完全不碰正式项目**：project id 是 `demo-heritage-hunt`（`demo-` 前缀的项目只存在于 emulator）。

每个 worker 是一个独立的 Node process = 一个真实的 Firebase client（自己的匿名 uid、自己的连线），
跑的是 app 真正的 `src/services/gameService.ts`，不是 mock。

## 准备（一次）

- Node 22+
- **Java 21+**（Firestore emulator 需要）。没有 sudo 的话可以装便携版：
  ```bash
  mkdir -p ~/.local/jdk-21
  curl -fsSL "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse" \
    | tar -xz -C ~/.local/jdk-21 --strip-components=1
  export PATH=~/.local/jdk-21/bin:$PATH
  ```

## 跑

```bash
# 终端 1：起 emulator（第一次会下载 firebase-tools 和 emulator jar）
npm run emulators

# 终端 2：跑压测
npm run stress                    # 全部场景
npm run stress -- --only=s1,s4    # 只跑某几个
npm run stress -- --scale=2       # worker / 玩家数量 ×2（注意内存：每个 worker 约 130MB RSS）
```

全部通过 exit code 是 0，有失败是 1。每次的详细结果写在 `scripts/stress/results/`（已 gitignore）。

## 场景

| | 场景 | 检查什么 | 对应 bug |
|---|---|---|---|
| S1 | 同队 12 人（4 process × 3）疯狂 heartbeat / offline 15 秒 | members 没丢人、没重复、每个人的 `isOnline` = 他最后一次操作 | B4 lost update |
| S2 | 10 人同时扫码加入 3 队，一半人加入两次 | 每个人都在、没有重复 member | B5 |
| S3 | GM 一次批准 15 张，同时同队 6 人狂刷 heartbeat + GPS | 每个批准都成功、分数 = clue 分数总和 | B3 / 热点 doc |
| S4 | 两个 GM 同一时间批准同样 10 张 | 每张只批准一次、分数没翻倍 | B3 |
| S5 | 8 台手机在 game 还不存在时同时打开 app，然后马上加入 | 只有一个 client 建 game、加入的人没被覆盖掉 | B8 |
| S6 | 6 台手机在线，2 队每秒上传 140KB 照片 | 每台都收到每张；报告延迟、每台收到的数据量、内存 | 负载 / fan-out |

每个场景也会检查：worker 没崩、**没有悄悄切到 mock 假数据**（B7）、heartbeat 没有被吞掉的写入失败。

## 已验证：脚本真的抓得到 bug

把 `gameService.ts` 换回修 bug 前的版本跑：S1、S2、S3、S4、S5 全部 FAIL
（例：S4 "20 approvals for 10 submissions"，分数 2900 vs 1450）。修复后 6/6 PASS。

## 限制

- Emulator **没有**真实的网络延迟、单 doc 每秒 ~1 次写入的限制、配额。这里测的是**正确性**；
  S6 的延迟数字只能拿来前后对比，不能当线上数字。要测真实上限，用另一个独立的 Firebase 项目（Blaze + 预算警报），
  **绝对不要用正式项目**。
- `firestore.rules` 是从 `docs/SECURITY_AND_DEPLOYMENT.md` 抄的，不一定等于线上部署的规则。
