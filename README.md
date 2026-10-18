# 基因组数据分析系统

白底微蓝风格的测序数据分析演示平台，首页提供三个入口：

1. **转录组测序数据分析** → `rna.html`
2. **宏基因组测序数据分析** → `meta.html`
3. **16S 测序数据分析** → `16s.html`

各子系统参考对应流程软件文档，含软件一览、拖拽上传、可拖拽分析流水线与演示结果可视化。

运行分析后会自动写入本机 **历史记录**（`history.html`），可筛选、搜索、打开回看或删除。数据存在浏览器 `localStorage`，不上传服务器。

## 本地打开

```bash
cd sludge-omics
python3 -m http.server 5173
```

在线访问（GitHub Pages）：https://zhuxiaotu.github.io/sludge-omics/

本地：`python3 -m http.server 5173` 后打开 http://127.0.0.1:5173

演示账号：`admin` / `admin123`（也可自行注册）

## 说明

当前为前端交互演示，未连接真实生信后端。流程模块与软件清单来自转录组 / 宏基因组 / 16S 分析流程软件参考资料。
