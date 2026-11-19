// 埼玉県教育委員会「埼玉県公立高等学校 進学希望状況」(Power BI の公開レポート)から、
// サイトに載せている公立高校の 募集人員・進学希望者数・倍率・前年同期倍率 を取り出して data/kibou.json に保存する。
// 使い方: node tools/fetch-kibou.mjs   (そのあと node tools/build-schools.mjs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_URL = "https://app.powerbi.com/view?r=eyJrIjoiMmExZWZhZmUtNzBiNy00ODViLWE4M2YtYzc1YjNiZWUwZDQ3IiwidCI6IjVlNzM4ZjMxLTVhNzItNGNiNS04NzA4LThiZWNlZjgwM2QyNyJ9";
const KEY = "2a1efafe-70b7-485b-a83f-c75b3bee0d47";
const API = "https://wabi-japan-east-api.analysis.windows.net/public/reports/";
const H = { "X-PowerBI-ResourceKey": KEY, "Content-Type": "application/json" };

// サイトの高校(slug)と、レポートの学校名
const SCHOOLS = { kumagaya: "熊谷", "kumagaya-joshi": "熊谷女子", "kumagaya-nishi": "熊谷西", "fukaya-daiichi": "深谷第一", "fukaya-shogyo": "深谷商業", fukaya: "深谷", honjo: "本庄", ageo: "上尾", "ina-gakuen": "伊奈学園総合", "kumagaya-shogyo": "熊谷商業", "kumagaya-kogyo": "熊谷工業", "kumagaya-nogyo": "熊谷農業", menuma: "妻沼", "yorii-johoku": "寄居城北", konosu: "鴻巣", "konosu-joshi": "鴻巣女子", shinshukan: "進修館" };

const me = await (await fetch(API + KEY + "/modelsAndExploration?preferReadOnlySession=true", { headers: H })).json();
const model = me.models[0];
const cols = ["課程", "学校名", "学科等", "募集人員（ａ）", "進路希望者計（ｂ）", "倍率（ｂ）/（ａ）", "前年同期倍率", "調査年月日", "備考"];
const query = { version: "1.0.0", queries: [{ Query: { Commands: [{ SemanticQueryDataShapeCommand: {
  Query: { Version: 2, From: [{ Name: "t", Entity: "希望状況", Type: 0 }], Select: cols.map(c => ({ Column: { Expression: { SourceRef: { Source: "t" } }, Property: c }, Name: "t." + c })) },
  Binding: { Primary: { Groupings: [{ Projections: cols.map((_, i) => i) }] }, DataReduction: { DataVolume: 4, Primary: { Window: { Count: 3000 } } }, Version: 1 } } }] },
  QueryId: "", ApplicationContext: { DatasetId: model.dbName, Sources: [{ ReportId: "", VisualId: "" }] } }], cancelQueries: [], modelId: model.id };
const res = await (await fetch(API + "querydata?synchronous=true", { method: "POST", headers: H, body: JSON.stringify(query) })).json();
const ds = res.results[0].result.data.dsr.DS[0], S = ds.PH[0].DM0[0].S, D = ds.ValueDicts || {};
const rows = []; let prev = new Array(S.length).fill(null);
for (const row of ds.PH[0].DM0) {
  const C = row.C || [], R = row.R || 0, N = row["Ø"] || 0; let ci = 0; const v = [];
  for (let i = 0; i < S.length; i++) {
    if (R & (1 << i)) { v.push(prev[i]); continue; }
    if (N & (1 << i)) { v.push(null); continue; }
    let x = C[ci++]; if (S[i].DN && typeof x === "number") x = D[S[i].DN][x]; v.push(x);
  }
  prev = v; rows.push(v);
}
const z = s => String(s ?? "").replace(/\s/g, "");
const out = { date: null, source: REPORT_URL, schools: {} };
for (const [slug, name] of Object.entries(SCHOOLS)) {
  const hit = rows.filter(r => /全日/.test(z(r[0])) && z(r[1]) === name);
  if (!hit.length) { console.warn("見つからない:", name); continue; }
  out.schools[slug] = hit.map(r => ({ gakka: z(r[2]), boshu: +r[3], kibou: +r[4], bairitsu: +(+r[5]).toFixed(2), zennen: r[6] == null ? null : +(+r[6]).toFixed(2), biko: z(r[8]) || null }));
  const d = new Date(+hit[0][7]); out.date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
fs.writeFileSync(path.join(ROOT, "data", "kibou.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`進学希望状況(${out.date}現在)を ${Object.keys(out.schools).length} 校分保存しました`);
