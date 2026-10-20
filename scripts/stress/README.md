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
| S7 | 手机断线（`disableNetwork`）后加入、GM 建队（PIN 已被占用）、提交照片 | 都马上回报「连不上服务器」；不误报 PIN 错、不卡住、不写出重复 PIN | B10 |

每个场景也会检查：worker 没崩、**没有悄悄切到 mock 假数据**（B7）、heartbeat 没有被吞掉的写入失败。

## 负载模式：指定每个接口的 QPS

加 `--load` 就不跑 S1–S6，改成按固定速率打指定的接口：

```bash
npm run stress -- --load=heartbeat:25 --duration=30                  # heartbeat 25 qps，30 秒
npm run stress -- --load=heartbeat:20,gps:5,submit:2 --teams=3       # 多个接口同时打
npm run stress -- --load=approve:5 --p95=500 --max-error-rate=0.01   # 加上通过标准
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--load=op:qps,...` | — | op：`heartbeat` `offline` `gps` `join` `submit` `approve` `broadcast` |
| `--duration=秒` | 30 | |
| `--procs=N` | 4 | worker process 数（= 多少个独立 client 分摊这些 QPS） |
| `--teams=N` | 1 | 请求轮流打在几个 team doc 上（1 = 全部挤在同一个 doc，最狠） |
| `--players=N` | 10 | 每队几个玩家 id（heartbeat / offline 轮流用） |
| `--photo-kb=KB` | 140 | submit 的照片大小 |
| `--max-error-rate=0~1` | 0 | 错误率超过就 FAIL |
| `--p95=ms` | 不限 | p95 延迟超过就 FAIL |

- **开环（open-loop）**：照时间表发请求，不等上一个回来。系统变慢时请求会堆积（报告里的 `peak in-flight`），
  跟真实玩家一样，不会因为等待而把压力自动降下来。
- `send lateness` 是压测端自己有没有跟上时间表；p95 > 50ms 会 FAIL，表示是压测机不够力，不是系统的问题。
- heartbeat / offline 在 app 里会把错误吞掉（只 `console.warn`），负载模式会把它算回那一个请求的失败。
- `submit` / `approve` 会先自动建好需要的 clue / pending submission（每个请求一个，不重复用）。
- `broadcast` 目前会 100% `PERMISSION_DENIED`：文档里的规则没有 `broadcasts` 子集合。

**真实游戏大概多少 QPS？** 30 个玩家：heartbeat 每人 20 秒一次 ≈ 1.5 qps，GPS 每人最快 30 秒一次 ≈ 1 qps，
每个 team doc（5 人）≈ 0.4 写入/秒。`heartbeat:25` 已经是真实负载的十几倍。

**已知现象**：heartbeat + offline + approve + join 一起打（每个 team doc 约 12 个 transaction/秒）时，
部分 client 会卡住约 10 秒，Firestore SDK 判定离线，join / submit 会失败。修 B10 之后玩家看到的是
「Cannot reach the game server…」（之前会误报「No team found with PIN」）。这个卡顿有多少是 emulator 自己的
transaction 实现造成的，emulator 里分辨不出来，要在独立的 Firebase 项目上验证。

## 已验证：脚本真的抓得到 bug

把 `gameService.ts` 换回修 bug 前的版本跑：S1–S5、S7 全部 FAIL
（例：S4 "20 approvals for 10 submissions"，分数 2900 vs 1450；S7 建队卡住 15 秒）。修复后 7/7 PASS。

## 限制

- Emulator **没有**真实的网络延迟、单 doc 每秒 ~1 次写入的限制、配额。这里测的是**正确性**；
  S6 的延迟数字只能拿来前后对比，不能当线上数字。要测真实上限，用另一个独立的 Firebase 项目（Blaze + 预算警报），
  **绝对不要用正式项目**。
- `firestore.rules` 是从 `docs/SECURITY_AND_DEPLOYMENT.md` 抄的，不一定等于线上部署的规则。
