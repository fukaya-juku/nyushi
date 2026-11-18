// 高校別ページの生成。public/index.html の高校データ(S)・日程(TL)・CSS・日付と、
// data/school-pages.json の高校ごとの文章から、public/<slug>/index.html と sitemap.xml を作る。
// GitHub Pages への公開(.github/workflows/pages.yml)でも毎回実行されるので、トップページのデータを直せば高校別ページもそろって更新される。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const SITE = "https://fukaya-juku.github.io/nyushi";
const LINE = "https://lin.ee/rcfMHgx";

const top = fs.readFileSync(path.join(PUB, "index.html"), "utf8");
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "school-pages.json"), "utf8"));
// 卒業後の進路(各高校の公式サイトの進路情報)。slug ごと。ない高校は進路の項目を出さない
const SHF = path.join(ROOT, "data", "school-shinro.json");
const SH = fs.existsSync(SHF) ? JSON.parse(fs.readFileSync(SHF, "utf8")) : {};
// 学校の特色・校風・求める生徒像(各高校の公式サイトで確認したもの)と、塾の見方(fit・voice)。ない高校は項目を出さない
const TKF = path.join(ROOT, "data", "school-features.json");
const TK = fs.existsSync(TKF) ? JSON.parse(fs.readFileSync(TKF, "utf8")) : {};
// 私立高校のページ(slug ごと)。ない場合は作らない
const PVF = path.join(ROOT, "data", "private-pages.json");
const privs = fs.existsSync(PVF) ? JSON.parse(fs.readFileSync(PVF, "utf8")) : [];

const grab = (re, what) => { const m = top.match(re); if (!m) throw new Error(what + " が index.html に見つかりません"); return m[1]; };
const S = new Function("return " + grab(/const S=(\[[\s\S]*?\n\]);/, "高校データ S"))();
const TL = new Function("return " + grab(/const TL=(\[[\s\S]*?\n\]);/, "日程 TL"))();
const CSS = grab(/<style>([\s\S]*?)<\/style>/, "CSS");
const STAMP = grab(/情報は(\d{4}年\d{1,2}月\d{1,2}日)時点/, "時点の日付");
const SOURCES = grab(/<b>情報源<\/b>\s*(<ul>[\s\S]*?<\/ul>)/, "情報源");
const isoDate = (() => { const [, y, m, d] = STAMP.match(/(\d+)年(\d+)月(\d+)日/); return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; })();

const byName = Object.fromEntries(S.map(d => [d.n, d]));
const slugOf = {}; pages.forEach(p => p.keys.forEach(k => { slugOf[k] = p.slug; }));
const col = { k: "var(--k)", f: "var(--f)", g: "var(--g)", h: "var(--h)", c: "#455a64" };
const AREAS = [["f", "深谷市"], ["k", "熊谷市"], ["h", "本庄市・寄居町"], ["g", "行田市"], ["c", "鴻巣市・上尾市・伊奈町"]];
const MC = ["var(--exam)", "var(--report)", "var(--talk)"];
const hv = d => d.h[0] === d.h[1] ? `${d.h[0]}` : `${d.h[0]}-${d.h[1]}`;
const strip = s => s.replace(/<[^>]+>/g, "");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const label = (p, d) => p.keys.length > 1 ? `${d.d}` : p.name;

function bar(v) {
  const tot = v[0] + v[1] + v[2];
  return `<div class="bar">${v.map((x, j) => `<span class="${j === 1 ? "r" : ""}" style="width:${x / tot * 100}%;background:${MC[j]}">${x / tot > .09 ? x : ""}</span>`).join("")}</div>`;
}

function goal(d) {
  const G = d.g;
  if (!G || G.few) return `<div class="goal few">合否の目安:2026年度の開示データが少ないため掲載していません</div>`;
  const P = x => (x - 100) / 400 * 100;
  return `<div class="goal"><div class="goal-h">合否の目安(2026年度 合格者の開示得点より)</div>
  <div class="gauge" aria-label="学力検査5教科 ボーダー${G.t[1]}点 安心ライン${G.t[0]}点"><div class="trk"><div class="zone" style="left:${P(G.t[1])}%;width:${P(G.t[0] - G.t[1])}%"></div>
  <span class="mk bd" style="left:${P(G.t[1])}%">ボーダー ${G.t[1]}</span><span class="mk avg" style="left:${P(G.t[0])}%">安心 ${G.t[0]}</span></div>
  <div class="lab"><span>100点</span><span>300点</span><span>5教科 500点</span></div></div>
  <table><thead><tr><th></th><th>安心ライン<small>合格者の平均</small></th><th>ボーダー<small>合格者の下位1/4</small></th></tr></thead>
  <tbody><tr><th>学力検査 5教科<small>500点満点</small></th><td>${G.t[0]}</td><td>${G.t[1]}</td></tr>
  <tr><th>中3の内申<small>9教科・45点満点</small></th><td>${G.y[0]}</td><td>${G.y[1]}</td></tr></tbody></table></div>`;
}

function hensachi(p) {
  const main = byName[p.keys[0]];
  const near = S.filter(d => Math.abs(d.h[0] - main.h[0]) <= 6 || p.keys.includes(d.n)).slice(0, 9);
  const lo = Math.min(...near.map(d => d.h[0])) - 3, hi = Math.max(...near.map(d => d.h[1])) + 2, P = v => (v - lo) / (hi - lo) * 100;
  const ticks = []; for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) ticks.push(v);
  const rows = near.map(d => {
    const me = p.keys.includes(d.n), a = P(d.h[0] - .8), b = P(d.h[1] + .8), c = me ? "var(--orange)" : col[d.c];
    const name = slugOf[d.n] && !me ? `<a href="../${slugOf[d.n]}/" style="color:${c}">${d.n}</a>` : d.n;
    return `<div class="row${me ? " me" : ""}"><div class="nm" style="color:${c}">${name}${me ? " ◀" : ""}</div><div class="trk"><div class="rng" style="left:${a}%;width:${b - a}%;background:${c}"></div></div><div class="v" style="color:${c}">${hv(d)}</div></div>`;
  }).join("");
  return `<div class="hen">${rows}<div class="axis"><div class="ticks">${ticks.map(v => `<span style="left:${P(v)}%">${v}</span>`).join("")}</div></div></div>`;
}

function mixBlock(p, d) {
  const s = (v, lab) => { const tot = v[0] + v[1] + v[2]; return `<div class="row"><div class="hd"><span class="nm">${lab}</span><span class="tot">学検${v[0]}・調査書${v[1]}・面接${v[2]}/計${tot}点</span></div>${bar(v)}</div>`; };
  const l1 = d.l1 ? `${d.l1}選抜` : "第1次選抜", l2 = d.l2 ? `${d.l2}選抜` : "第2次選抜";
  return `<div class="box"><h3 class="h3">${label(p, d)}(${d.type})</h3><div class="mix">${s(d.s1, l1)}${s(d.s2, l2)}</div>
  <p class="calc">調査書の学年の比率は <b>${d.r}</b>(中1:中2:中3)</p></div>`;
}

function facts(p, d) {
  return `<div class="box"><h3 class="h3">${label(p, d)}</h3><div class="facts"><div class="fact"><small>偏差値</small><b>${hv(d)}</b></div><div class="fact"><small>内申の目安</small><b>${d.na}</b></div><div class="fact"><small>2027募集</small><b>${d.t}${d.down ? "↓" : ""}</b></div><div class="fact"><small>2026志願倍率</small><b>${d.b}</b></div><div class="fact"><small>2026実質倍率</small><b>${d.j || "—"}</b></div><div class="fact"><small>選抜</small><b style="font-size:13px;display:block;line-height:1.35;margin-top:2px">${d.type}</b></div></div>
  <div class="chips">${d.tags.map(t => `<span class="chip ${/減/.test(t) ? "hot" : ""}">${t}</span>`).join("")}</div>${d.down ? `<p class="note">↓は2026年度より募集人数が減ることを示します。</p>` : ""}</div>`;
}

const CC = ["var(--blue)", "var(--report)", "var(--h)", "var(--orange)", "var(--g)", "#b0bec5", "#90a4ae", "#cfd8dc"];
const fmt = n => Number(n).toLocaleString("ja-JP");
function shares(s) {
  const b = s.breakdown || [], hasN = b.length > 0 && b.every(x => x.n != null);
  const tot = hasN ? b.reduce((a, x) => a + x.n, 0) : 100;
  return b.map((x, i) => ({ ...x, c: CC[i % CC.length], pct: hasN ? x.n / tot * 100 : x.pct, hasN }));
}
const pctTxt = v => v < 1 ? "1%未満" : `${Math.round(v)}%`;
const chips = (arr, cls = "") => `<div class="chips">${arr.map(t => `<span class="chip ${cls}">${esc(t)}</span>`).join("")}</div>`;

function career(p, s = SH[p.slug]) {
  if (!s) return "";
  const out = [];
  const sh = shares(s);
  if (sh.length) out.push(`<div class="box"><h3 class="h3">進路の内訳<small class="yr">${esc(s.year)}</small></h3>
  <div class="bar cbar" role="img" aria-label="${esc(sh.map(x => x.label + pctTxt(x.pct)).join("、"))}">${sh.map(x => `<span style="width:${x.pct}%;background:${x.c}"></span>`).join("")}</div>
  <ul class="crs">${sh.map(x => `<li><i style="background:${x.c}"></i><span>${esc(x.label)}</span><b>${x.hasN ? fmt(x.n) + "人" : ""}<small>${pctTxt(x.pct)}</small></b></li>`).join("")}</ul>
  ${s.total ? `<p class="note" style="margin-top:8px">卒業生 ${fmt(s.total)}人${s.shushokuRate ? `/就職内定率 ${esc(s.shushokuRate)}` : ""}</p>` : ""}</div>`);
  const gk = s.goukaku || [], mu = s.mainUniv || [];
  if (gk.length || mu.length) out.push(`<div class="box"><h3 class="h3">${esc(s.goukakuTitle || "大学などの合格実績")}<small class="yr">${esc(s.goukakuYear || s.year)}</small></h3>
  ${gk.length ? `<div class="facts gk">${gk.map(g => `<div class="fact"><small>${esc(g.label)}</small><b>${fmt(g.n)}<span>人</span></b></div>`).join("")}</div>` : ""}
  ${mu.length ? `<p class="sub-h">合格者・進学者の多い学校</p>${chips(mu)}` : ""}
  ${s.goukakuNote ? `<p class="note" style="margin-top:8px">${esc(s.goukakuNote)}</p>` : ""}</div>`);
  const extra = [];
  if (s.gakka && s.gakka.length > 1) extra.push(`<p class="sub-h">学科・コース</p>${chips(s.gakka)}`);
  if (s.shikaku && s.shikaku.length) extra.push(`<p class="sub-h">在学中にめざせる資格・検定</p>${chips(s.shikaku, "hot")}`);
  if (s.shushoku && s.shushoku.length) extra.push(`<p class="sub-h">主な就職先の分野</p>${chips(s.shushoku)}`);
  if (extra.length) out.push(`<div class="box"><h3 class="h3">学科・資格・就職</h3>${extra.join("")}</div>`);
  if (!out.length) return "";
  if (s.lead) out.unshift(`<p class="lead">${esc(s.lead)}</p>`);
  return out.join("\n  ") + `
  <p class="note">${esc(p.name)}の公式サイトの進路情報より:${s.sources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join("、")}。進路の結果は年度によって変わります。</p>`;
}

function feature(p, t = TK[p.slug]) {
  if (!t) return "";
  const out = [];
  const li = arr => `<ul class="fl">${arr.map(x => `<li>${esc(typeof x === "string" ? x : x.text)}</li>`).join("")}</ul>`;
  if (t.kokun || t.mission) out.push(`<div class="box">${t.kokun ? `<p class="kokun"><small>校訓・教育目標</small>${esc(t.kokun)}</p>` : ""}${t.mission ? `<p class="mission">${esc(t.mission)}</p>` : ""}</div>`);
  if (t.features && t.features.length) out.push(`<div class="box"><h3 class="h3">ここが特色</h3>${li(t.features)}</div>`);
  if (t.units && t.units.length) out.push(`<div class="box"><h3 class="h3">学科・系列で学ぶこと</h3><dl class="units">${t.units.map(u => `<dt>${esc(u.name)}</dt><dd>${esc(u.text)}</dd>`).join("")}</dl>${t.unitsNote ? `<p class="note" style="margin-top:8px">${esc(t.unitsNote)}</p>` : ""}<p class="note" style="margin-top:6px"><a href="../chigai/">ほかの専門高校・総合学科とのちがいを見る ›</a></p></div>`);
  if (t.life && t.life.length) out.push(`<div class="box"><h3 class="h3">学校生活</h3>${li(t.life)}</div>`);
  if (t.admission && t.admission.length) out.push(`<div class="box"><h3 class="h3">${esc(p.name)}が求める生徒像<small class="yr">アドミッション・ポリシー(学校の公式発表)</small></h3>${li(t.admission)}</div>`);
  if ((t.fit && t.fit.length) || t.voiceEx) out.push(`<div class="box voice-box"><h3 class="h3">こんな人に向いています<small class="yr">学習空間 深谷上柴教室の見方</small></h3>${t.fit && t.fit.length ? li(t.fit) : ""}
  ${t.voiceKeys && t.voiceKeys.length ? `<p class="sub-h">My Voice で使える${esc(p.name)}のキーワード</p>${chips(t.voiceKeys, "hot")}` : ""}
  ${t.voiceEx ? `<p class="sub-h">志望理由の話し始めの例</p><p class="vex">${esc(t.voiceEx)}</p><p class="note">例をそのまま使うのではなく、「なぜそう思ったか」に自分の体験を1つ入れると、自分の言葉になります。</p>` : ""}
  ${t.voiceEx || (t.voiceKeys && t.voiceKeys.length) ? `<a class="more" href="../myvoice/">My Voice メーカーで原稿を作る ›</a>` : ""}</div>`);
  if (!out.length) return "";
  return out.join("\n  ") + `
  <p class="note">校訓・特色・学校生活・求める生徒像は${esc(p.name)}の公式サイトより:${t.sources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join("、")}。「こんな人に向いています」とMy Voiceの例は、公式の情報をもとに当教室がまとめたものです。</p>`;
}

function faq(p) {
  const ds = p.keys.map(k => byName[k]), one = ds.length === 1;
  const each = (f) => ds.map(d => (one ? "" : `${d.d}は`) + f(d)).join("。");
  const q = [];
  q.push([`${p.name}の偏差値はいくつですか?`, each(d => `${hv(d)}`) + "です(民間の偏差値サイトの値。模試によって数値は変わります)。"]);
  q.push([`${p.name}の倍率は?`, each(d => `2026年度の志願確定倍率が${d.b}倍、実際に受検した人数をもとにした実質倍率が${d.j || "—"}倍`) + "でした。"]);
  q.push([`${p.name}に合格するには内申点がどのくらい必要ですか?`, each(d => d.g && !d.g.few ? `2026年度の合格者の中3の内申(9教科・45点満点)は平均${d.g.y[0]}、下位4分の1で${d.g.y[1]}でした` : `内申の目安は${d.na}です`) + "。" + `${ds[0].r === "1:1:2" ? "中1・中2・中3の比率は1:1:2" : "中1・中2・中3の比率は" + ds[0].r}なので、中3の成績がとくに大切です。`]);
  const gs = ds.filter(d => d.g && !d.g.few);
  if (gs.length) q.push([`${p.name}は学力検査で何点取れば合格できますか?`, gs.map(d => (one ? "" : `${d.d}は`) + `2026年度の合格者の5教科の平均が約${d.g.t[0]}点、下位4分の1が約${d.g.t[1]}点`).join("。") + "でした。安心ラインの点数を目標にしましょう。年度によって問題の難しさや倍率が変わるため、あくまで目安です。"]);
  q.push([`${p.name}の面接はどのくらい大切ですか?`, each(d => `面接の配点は${d.l1 ? d.l1 + "選抜" : "第1次"}${d.s1[2]}点・${d.l2 ? d.l2 + "選抜" : "第2次"}${d.s2[2]}点`) + "です。2027年度からすべての受検生に面接があり、最初に自分の言葉で話す「My Voice」があります。"]);
  const t = TK[p.slug];
  if (t && (t.kokun || (t.features && t.features.length))) {
    const a = (t.kokun ? `校訓・教育目標は「${t.kokun}」です。` : "") + (t.features || []).slice(0, 3).map(x => typeof x === "string" ? x : x.text).join("") + (t.admission && t.admission.length ? `求める生徒像の1つに「${t.admission[0]}」があります。` : "");
    q.splice(1, 0, [`${p.name}はどんな学校ですか?(校風・特色)`, a]);
  }
  const s = SH[p.slug];
  if (s) {
    const sh = shares(s);
    let a = sh.length ? `${s.year}は、${sh.map(x => `${x.label}${x.hasN ? x.n + "人" : ""}(${pctTxt(x.pct)})`).join("、")}でした。` : "";
    if (s.goukaku && s.goukaku.length) a += `合格実績は${s.goukaku.slice(0, 3).map(g => `${g.label}${g.n}人`).join("、")}です${s.goukakuNote ? "(" + s.goukakuNote + ")" : ""}。`;
    else if (s.mainUniv && s.mainUniv.length) a += `主な進学先は${s.mainUniv.slice(0, 3).join("・")}などです。`;
    if (s.shikaku && s.shikaku.length) a += `在学中に${s.shikaku.slice(0, 3).join("・")}などの資格・検定がめざせます。`;
    if (a) q.push([`${p.name}の卒業後の進路(進学・就職実績)は?`, a + "くわしくは高校の公式サイトをご確認ください。"]);
  }
  return q;
}

function shell(title, desc, url, ld, nav) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="深谷・熊谷 高校入試ナビ">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Lato:wght@700;900&display=swap">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>${CSS}
/* 高校別ページ */
body{--c:var(--blue);--cs:var(--sky)}
.box .calc{margin:12px 0 0}
.crumb{font-size:13px;color:var(--muted);padding:10px 0 0}
.crumb a{font-weight:700}
.hero.school{padding:28px 0 32px}
.hero.school h1{font-size:clamp(28px,7.6vw,44px)}
.hero.school h1 span{font-size:.52em}
.hero .big3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.hero .big3 div{background:#fff;color:var(--navy);border-radius:14px;padding:8px 4px;text-align:center;line-height:1.25}
.hero .big3 small{display:block;font-size:12.5px;font-weight:700;color:var(--muted)}
.hero .big3 b{font-family:var(--num);font-size:26px;font-weight:900;color:var(--blue)}
.toc{display:flex;flex-wrap:wrap;gap:6px}
.toc a{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.5);color:#fff;border-radius:999px;padding:2px 12px;font-size:14px;text-decoration:none}
.h3{margin:0 0 10px;font-size:19px;font-weight:900;color:var(--navy);line-height:1.4}
.facts.six{grid-template-columns:repeat(3,1fr)}
.box .facts{grid-template-columns:repeat(3,1fr);margin-bottom:10px}
.box .fact{background:var(--sky)}
.box .chips .chip{background:var(--sky);color:var(--blue)}
.hen .row.me .nm{font-size:17px}
.pts{list-style:none;margin:0;padding:0;counter-reset:p;display:flex;flex-direction:column;gap:10px}
.pts li{counter-increment:p;position:relative;padding:12px 14px 12px 54px;background:var(--white);border-radius:16px;font-size:16px}
.pts li::before{content:counter(p);position:absolute;left:12px;top:12px;width:30px;height:30px;border-radius:50%;background:var(--blue);color:#fff;font-family:var(--num);font-weight:900;text-align:center;line-height:30px}
.voice{display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:start}
.voice .ic{width:56px;height:56px;border-radius:50%;background:var(--orange);color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1.1;text-align:center}
.voice .who{font-size:14px;font-weight:900;color:var(--orange)}
.qa{display:flex;flex-direction:column;gap:10px}
.qa details{background:var(--white);border-radius:16px;padding:12px 14px}
.qa summary{font-weight:900;color:var(--navy);cursor:pointer;font-size:17px;list-style:none;padding-left:34px;position:relative}
.qa summary::-webkit-details-marker{display:none}
.qa summary::before{content:"Q";position:absolute;left:0;top:0;width:26px;height:26px;border-radius:8px;background:var(--blue);color:#fff;font-family:var(--num);text-align:center;line-height:26px;font-size:15px}
.qa details p{margin-top:8px;font-size:16px}
.links{display:grid;gap:10px}
@media (min-width:760px){.links{grid-template-columns:1fr 1fr}}
.links a{display:flex;justify-content:space-between;align-items:center;background:var(--white);border:2px solid var(--line);border-radius:14px;padding:12px 14px;text-decoration:none;color:var(--navy)}
.links a small{display:block;font-size:13px;color:var(--muted);font-weight:500}
.links a::after{content:"›";font-size:24px;color:var(--blue)}
.tl li{grid-template-columns:40px 1fr}
.h3 .yr{display:block;font-size:13px;font-weight:700;color:var(--muted)}
.cbar{height:26px;margin-bottom:10px}
.crs{list-style:none;margin:0;padding:0;display:grid;gap:4px}
@media (min-width:600px){.crs{grid-template-columns:1fr 1fr;column-gap:16px}}
.crs li{display:grid;grid-template-columns:14px 1fr auto;gap:8px;align-items:center;font-size:15px;padding:4px 0;border-bottom:1px dashed var(--line)}
.crs i{width:14px;height:14px;border-radius:4px}
.crs b{font-family:var(--num);font-weight:900;color:var(--navy);white-space:nowrap}
.crs b small{font-size:13px;color:var(--muted);margin-left:6px}
.box .facts.gk{grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}
.facts.gk b span{font-size:14px;margin-left:2px}
.sub-h{font-size:14px;font-weight:900;color:var(--navy);margin:14px 0 6px}
.box .h3+.sub-h{margin-top:0}
.kokun{margin:0;font-size:20px;font-weight:900;color:var(--navy);line-height:1.5}
.kokun small{display:block;font-size:13px;font-weight:700;color:var(--muted)}
.mission{margin:8px 0 0;font-size:15px}
.fl{margin:0;padding:0 0 0 1.2em;display:flex;flex-direction:column;gap:6px;font-size:16px}
.fl li::marker{color:var(--blue)}
.voice-box{border:2px solid var(--orange)}
.voice-box .h3{color:#d35400}
.vex{margin:0;background:var(--orange-soft);border-radius:12px;padding:10px 12px;font-size:16px}
.voice-box .more{margin-top:12px}
.tbl{overflow-x:auto}
table.ex{width:100%;border-collapse:collapse;font-size:15px}
table.ex th,table.ex td{border-bottom:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}
table.ex thead th{background:var(--sky);color:var(--navy);font-size:13px}
table.ex tbody th{color:var(--navy);white-space:nowrap}
table.ex tbody th small{display:block;font-weight:500;color:var(--muted);font-size:12.5px;white-space:normal}
table.ex.fee tbody th{white-space:normal;font-weight:700}
table.fee td{text-align:right;font-family:var(--num);font-weight:900;white-space:nowrap}
.kinds{display:grid;gap:10px}
@media (min-width:760px){.kinds{grid-template-columns:1fr 1fr}}
.kind{background:var(--white);border-radius:16px;padding:12px 14px;border-left:6px solid var(--g)}
.kind .kh{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}
.kind .kh b{font-size:18px;color:var(--navy)}
.kind .kh span{font-family:var(--num);font-weight:900;color:var(--g);font-size:17px}
.kind dl{margin:6px 0 0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:15px}
.kind dt{color:var(--muted);font-weight:700}
.kind dd{margin:0}
.kind .kn{margin:6px 0 0;font-size:13.5px;color:#d35400;font-weight:700}
.dl{margin:0;display:grid;gap:4px 12px;font-size:15px}
.dl dt{font-weight:900;color:var(--navy);margin-top:6px}
.dl dd{margin:0}
.units{margin:0;display:grid;gap:2px}
.units dt{font-weight:900;color:var(--navy);margin-top:8px;padding-left:10px;border-left:4px solid var(--blue)}
.units dd{margin:2px 0 0 14px;font-size:15px}
.cmp{display:grid;gap:12px}
@media (min-width:760px){.cmp{grid-template-columns:1fr 1fr}}
.cmp .box{margin:0}
.cmp dl{margin:6px 0 0;display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:15px}
.cmp dt{color:var(--muted);font-weight:700;white-space:nowrap}
.cmp dd{margin:0}
.cmp .kind-tag{display:inline-block;font-size:13px;font-weight:900;color:#fff;background:var(--blue);border-radius:999px;padding:1px 10px;margin-bottom:4px}
.cmp .more{margin-top:10px}
</style>
</head>
<body>

<div class="top">
  <div class="in">
    <a class="logo" href="https://blue0728.studio.site/" target="_blank" rel="noopener">学習空間<small>深谷上柴教室</small></a>
    <a class="btn-tel" href="${LINE}" target="_blank" rel="noopener"><span class="line-ic">LINE</span>無料体験・相談</a>
  </div>
  <nav class="nav" aria-label="ページ内メニュー"><ul>
    ${nav}
  </ul></nav>
</div>

`;
}

function tail(name, h2, lead, who, sources) {
  return `<section class="juku" id="juku"><div class="in">
  <span class="pill" style="align-self:center">受付中 個別相談・無料体験</span>
  <h2>${name}をめざすなら、<br>${h2}</h2>
  <p class="lead">${lead}</p>
  <div class="cta">
    <a class="big line" href="${LINE}" target="_blank" rel="noopener"><small>無料体験(1週間・3回程度)・進路相談</small>LINEで問い合わせる</a>
    <a class="sub" href="https://blue0728.studio.site/" target="_blank" rel="noopener">学習空間 深谷上柴教室のサイトへ ›</a>
  </div>
  <p style="text-align:center;font-size:14px;color:#dbe6ff">お電話でも受け付けています:<a href="tel:0485715050" style="color:#fff">048-571-5050</a>(平日17:00〜22:00)/深谷市上柴町東4-14-1</p>
</div></section>

<footer><div class="in">
  <b>情報源</b>
  ${sources}
  <p>最新・正確な内容は、必ず${who}の発表でご確認ください。</p>
  <p><a href="../">深谷・熊谷 高校入試ナビ トップへ</a></p>
  <p>© 学習空間 深谷上柴教室</p>
</div></footer>
</body>
</html>
`;
}

function page(p) {
  const ds = p.keys.map(k => byName[k]);
  ds.forEach((d, i) => { if (!d) throw new Error(`${p.keys[i]} が高校データ S にありません`); });
  const main = ds[0];
  const url = `${SITE}/${p.slug}/`;
  const cr = career(p), ft = feature(p);
  const title = `${p.name}の偏差値・倍率・合格の目安${ft ? "・校風" : ""}${cr ? "と進学実績" : ""}【2027年度入試】｜深谷・熊谷 高校入試ナビ`;
  const desc = `${p.name}(埼玉県${p.area})の2027年度入試情報。偏差値${hv(main)}、2026年度の倍率${main.b}倍、合格者の内申点と学力検査の得点の目安、配点${ft ? "、校風・特色と求める生徒像" : ""}、面接対策${cr ? "、卒業後の進路" : ""}まで、地元の塾がわかりやすくまとめました。`;
  let k = 0; const sec = id => `<section class="sec${k++ % 2 ? " alt" : ""}"${id ? ` id="${id}"` : ""}>`;
  const qs = faq(p);
  const tl = TL.filter(t => t.c !== "pri");
  const others = pages.filter(x => x.slug !== p.slug);
  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "深谷・熊谷 高校入試ナビ", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: `${p.name}の入試情報`, item: url }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: strip(a) } })) }
  ];
  const nav = `<li><a href="#data">基本データ</a></li><li><a href="#goal">合否の目安</a></li>${ft ? "" : `<li><a href="#mix">配点</a></li>`}<li><a href="#point">対策</a></li>${ft ? `<li><a href="#feature">特色</a></li>` : ""}${cr ? `<li><a href="#career">進路</a></li>` : ""}
    ${cr ? "" : `<li><a href="#schedule">日程</a></li>`}<li><a href="#interview">面接</a></li><li><a href="#faq">よくある質問</a></li><li><a href="../#schools">ほかの高校</a></li>`;
  return shell(title, desc, url, ld, nav) + `<header class="hero school">
  <div class="in">
    <nav class="crumb" aria-label="パンくずリスト" style="color:#dbe6ff"><a href="../" style="color:#fff">高校入試ナビ</a> › ${p.name}</nav>
    <span class="pill">2027年度(令和9年度)入試 対応</span>
    <h1><span>埼玉県${p.area}・${ds.map(d => d.d).join("/")}</span>${p.name}の偏差値・倍率・合格の目安</h1>
    <div class="big3">
      <div><small>偏差値</small><b>${hv(main)}</b></div>
      <div><small>2026志願倍率</small><b>${main.b.replace("〜", "<br>〜")}</b></div>
      <div><small>内申の目安</small><b>${main.na}</b></div>
    </div>
    ${ds.length > 1 ? `<p class="stamp">※上の数字は${main.d}。${ds.slice(1).map(d => `${d.d}は偏差値${hv(d)}・志願倍率${d.b}`).join("、")}。</p>` : ""}
    <p class="lead">${p.intro}</p>
    <p class="stamp">作成:学習空間 深谷上柴教室/情報は${STAMP}時点</p>
  </div>
</header>

${sec("data")}<div class="in">
  <div class="h2"><span class="en">DATA</span><h2>${p.name}の<br>基本データ</h2></div>
  ${ds.map(d => facts(p, d)).join("\n  ")}
  <div class="box"><h3 class="h3">近い偏差値の高校とくらべる</h3>${hensachi(p)}<p class="note" style="margin-top:8px">偏差値は「みんなの高校情報」の値をまとめた民間サイトより。模試によって数値は変わります。</p></div>
  <p class="note">「志願倍率」は2026年度の志願確定倍率(志願者数÷募集人数、埼玉県教育委員会)、「実質倍率」は2026年度に実際に受検した人数をもとにした倍率(民間の開示資料の集計)です。内申の目安(9教科・45点満点)は学習空間 深谷上柴教室の進路指導での目安です。</p>
</div></section>

${sec("goal")}<div class="in">
  <div class="h2"><span class="en">BORDER</span><h2>何点取れば合格?<br>合否の目安</h2></div>
  ${ds.map(d => `<div class="box">${ds.length > 1 ? `<h3 class="h3">${d.d}</h3>` : ""}${goal(d)}</div>`).join("\n  ")}
  ${ds.every(d => !d.g || d.g.few) ? "" : `<p class="note">2026年度入試を受けた先輩の開示得点(民間の調査資料)をもとに、学習空間 深谷上柴教室が算出しました。「安心ライン」は合格者の平均、「ボーダー」は合格者を点数順に並べた下から4分の1の位置です(5教科は5点単位に丸めています)。${ds.some(d => d.sel) ? "数学・英語は学校選択問題のため、学校選択問題を使わない高校とは点数を比べられません。" : ""}年度によって問題の難しさや倍率が変わるため、あくまで目安です。</p>`}
</div></section>

${sec("mix")}<div class="in">
  <div class="h2"><span class="en">SCORE</span><h2>${p.name}の<br>配点と選抜方法</h2></div>
  <div class="legend"><span><i style="background:var(--exam)"></i>学力検査</span><span><i style="background:var(--report)"></i>調査書(内申)</span><span><i style="background:var(--talk)"></i>面接</span></div>
  ${ds.map(d => mixBlock(p, d)).join("\n  ")}
  <p class="note">第1次選抜で定員の多くが決まり、残りを第2次選抜で決めます。調査書は中1〜中3の9教科の評定(各学年45点満点)を、学年の比率に合わせて点数にしたものです。</p>
</div></section>

${sec("point")}<div class="in">
  <div class="h2"><span class="en">POINT</span><h2>${p.name}合格への<br>ポイント</h2></div>
  <ol class="pts">${p.points.map(x => `<li>${x}</li>`).join("")}</ol>
  <div class="box voice"><div class="ic">塾長<br>より</div><div><div class="who">学習空間 深谷上柴教室から</div><p>${p.comment}</p></div></div>
</div></section>

${ft ? `${sec("feature")}<div class="in">
  <div class="h2"><span class="en">FEATURE</span><h2>${p.name}の<br>校風と特色</h2></div>
  ${ft}
</div></section>

` : ""}${cr ? `${sec("career")}<div class="in">
  <div class="h2"><span class="en">CAREER</span><h2>${p.name}の<br>卒業後の進路</h2></div>
  ${cr}
</div></section>

` : ""}${sec("schedule")}<div class="in">
  <div class="h2"><span class="en">SCHEDULE</span><h2>公立入試の日程</h2></div>
  <ol class="tl">${tl.map(t => `<li class="${t.c === "big" ? "big" : ""}" style="--c:${t.c === "big" ? "var(--navy)" : "var(--f)"}"><div class="dot"></div><div class="card"><div class="date">${t.d}</div><div class="what">${t.w}</div>${t.s ? `<div class="sub">${t.s}</div>` : ""}</div></li>`).join("")}</ol>
  <p class="note">私立高校の日程や、ほかの高校とくらべた情報は<a href="../#schedule">トップページ</a>で見られます。</p>
</div></section>

${sec("interview")}<div class="in">
  <div class="h2"><span class="en">INTERVIEW</span><h2>${p.name}の<br>面接対策</h2></div>
  <p class="lead">2027年度から、すべての受検生に面接があります。最初に1分30秒〜2分ほど自分の言葉で話す「My Voice」のあと、面接官からの質問に答えます。${ds.map(d => (ds.length > 1 ? d.d + "の" : "") + `面接の配点は${d.l1 ? d.l1 + "選抜" : "第1次"}${d.s1[2]}点・${d.l2 ? d.l2 + "選抜" : "第2次"}${d.s2[2]}点`).join("、")}です。</p>
  <a class="app" href="../myvoice/" style="border-color:var(--blue)"><svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="var(--blue)"/><path d="M14 16h20a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H24l-7 6v-6h-3a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4z" fill="#fff"/></svg><div><b style="color:var(--blue)">My Voice メーカー ›</b><span>質問に答えるだけで原稿ができる。タイマーと想定質問で本番練習も</span></div></a>
  <a class="app" href="https://splendid-centaur-c2b96a.netlify.app/" target="_blank" rel="noopener"><svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="var(--orange)"/><circle cx="24" cy="19" r="7" fill="#fff"/><path d="M11 38c2-7 7-10 13-10s11 3 13 10z" fill="#fff"/></svg><div><b>長所・短所を整理するアプリ ›</b><span>自分のよいところと課題を書き出そう</span></div></a>
</div></section>

${sec("faq")}<div class="in">
  <div class="h2"><span class="en">FAQ</span><h2>${p.name}の入試<br>よくある質問</h2></div>
  <div class="qa">${qs.map(([q, a], i) => `<details open><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>
</div></section>

${sec("")}<div class="in">
  <div class="h2"><span class="en">OTHER SCHOOLS</span><h2>ほかの高校の入試情報</h2></div>
  ${[...AREAS].sort((x, y) => (y[0] === main.c) - (x[0] === main.c)).map(([c, lab]) => { const os = others.filter(o => byName[o.keys[0]].c === c); return os.length ? `<div class="box"><h3 class="h3" style="color:${col[c]}">${lab}</h3><div class="links">${os.map(o => { const d = byName[o.keys[0]]; return `<a href="../${o.slug}/"><span>${o.name}<small>偏差値${hv(d)}・志願倍率${d.b}</small></span></a>`; }).join("")}</div></div>` : ""; }).join("")}
  ${privBox("")}
  <div class="links"><a href="../#schools"><span>22校をまとめて見る<small>私立高校もふくめた一覧</small></span></a></div>
</div></section>

` + tail(p.name, "配点から逆算して準備", "内申点・学力検査・面接のどこで点を取るか。志望校の配点に合わせて、一人ひとりやることを決めています。", `埼玉県教育委員会と${p.name}`, SOURCES);
}

// ---- 私立高校のページ(data/private-pages.json。入試・コース・学費・進路は各校の公式サイトと入試要項から) ----
function privBox(me) {
  const os = privs.filter(q => q.slug !== me);
  return os.length ? `<div class="box"><h3 class="h3" style="color:var(--g)">私立高校</h3><div class="links">${os.map(q => `<a href="../${q.slug}/"><span>${q.name}<small>${esc(q.area)}・${esc(q.sub)}</small></span></a>`).join("")}</div></div>` : "";
}

function privFaq(q) {
  const e = q.exam || {}, out = [];
  out.push([`${q.name}の偏差値は?`, `${q.name}は偏差値を公表していません。私立高校は、11〜12月の個別相談で通知表(内申)や北辰テストの結果をもとに合格の見込みを相談するのが一般的です。${e.criteria ? "公式に公表されている基準は「" + e.criteria + "」です。" : "基準は個別相談で確認しましょう。"}`]);
  if (e.kinds && e.kinds.length) out.push([`${q.name}の入試日と科目は?`, `${e.year || ""}は、` + e.kinds.map(k => `${k.name}が${k.date}${k.subjects ? "(" + k.subjects + ")" : ""}`).join("、") + "です。"]);
  if (e.kinds && e.kinds.some(k => k.interview)) out.push([`${q.name}の入試に面接はありますか?`, e.kinds.filter(k => k.interview).map(k => `${k.name}:${k.interview}`).join("。") + "。"]);
  if (e.scholarship) out.push([`${q.name}に特待生制度はありますか?`, e.scholarship]);
  if (q.fees && q.fees.items && q.fees.items.length) out.push([`${q.name}の学費は?`, `${q.fees.year}の公式資料では、` + q.fees.items.map(x => `${x.label}${fmt(x.yen)}円`).join("、") + `です。${q.fees.note || ""}`]);
  const c = q.career;
  if (c && ((c.breakdown && c.breakdown.length) || (c.mainUniv && c.mainUniv.length))) {
    const sh = shares(c);
    out.push([`${q.name}の進学実績は?`, (sh.length ? `${c.year}は、${sh.map(x => `${x.label}${x.hasN ? x.n + "人" : ""}`).join("、")}でした。` : "") + (c.goukaku && c.goukaku.length ? `合格実績は${c.goukaku.slice(0, 3).map(g => g.label + g.n + "人").join("、")}です。` : "") + (c.mainUniv && c.mainUniv.length ? `主な進学先・合格先は${c.mainUniv.slice(0, 4).join("・")}などです。` : "")]);
  }
  return out;
}

function privPage(q) {
  const url = `${SITE}/${q.slug}/`, e = q.exam || {};
  const qs = privFaq(q);
  const cr = career(q, q.career && (q.career.breakdown || q.career.goukaku || q.career.mainUniv) ? q.career : null);
  const ft = feature(q, { kokun: q.spirit, features: q.features, life: q.life, admission: q.admission, fit: q.fit, sources: q.sources });
  const title = `${q.name}の偏差値・入試日程・コース・学費・進学実績【2027年度入試】｜深谷・熊谷 高校入試ナビ`;
  const desc = `${q.name}(埼玉県${q.area}・私立)の2027年度入試情報。${(q.courses || []).filter(c => !/課程/.test(c.name)).length}つのコース、単願・併願の入試日と科目、個別相談会、特待生、学費、卒業後の進路まで、地元の塾が公式情報をもとにまとめました。`;
  let k = 0; const sec = id => `<section class="sec${k++ % 2 ? " alt" : ""}"${id ? ` id="${id}"` : ""}>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "深谷・熊谷 高校入試ナビ", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: `${q.name}の入試情報`, item: url }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qs.map(([a, b]) => ({ "@type": "Question", name: a, acceptedAnswer: { "@type": "Answer", text: strip(b) } })) }
  ];
  const nav = `<li><a href="#course">コース</a></li><li><a href="#exam">入試</a></li><li><a href="#point">対策</a></li>${ft ? `<li><a href="#feature">特色</a></li>` : ""}${q.fees ? `<li><a href="#fee">学費</a></li>` : ""}${cr ? `<li><a href="#career">進路</a></li>` : ""}<li><a href="#faq">よくある質問</a></li><li><a href="../#schools">ほかの高校</a></li>`;
  const first = (e.kinds || [])[0];
  const srcNote = list => list && list.length ? `<p class="note">出典:${list.map(u => typeof u === "string" ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(q.name)}の公式資料</a>` : `<a href="${esc(u.url)}" target="_blank" rel="noopener">${esc(u.title)}</a>`).filter((x, i, a) => a.indexOf(x) === i).join("、")}</p>` : "";
  const td = v => esc(v || "—");
  return shell(title, desc, url, ld, nav) + `<header class="hero school">
  <div class="in">
    <nav class="crumb" aria-label="パンくずリスト" style="color:#dbe6ff"><a href="../" style="color:#fff">高校入試ナビ</a> › ${q.name}</nav>
    <span class="pill">2027年度(令和9年度)入試 対応</span>
    <h1><span>埼玉県${q.area}・私立・${esc(q.sub)}</span>${q.name}の入試日程・コース・学費</h1>
    <div class="big3">
      <div><small>コース</small><b>${(q.courses || []).filter(c => !/課程/.test(c.name)).length || "—"}</b></div>
      <div><small>入試日</small><b style="font-size:20px">${first ? esc(first.date.replace(/\(.\)/, "")).replace(/(\d+月\d+日).*/, "$1") : "—"}</b></div>
      <div><small>出願</small><b style="font-size:17px">${esc(q.applyShort || "Web出願")}</b></div>
    </div>
    <p class="lead">${q.intro}</p>
    <p class="stamp">作成:学習空間 深谷上柴教室/情報は${STAMP}時点</p>
  </div>
</header>

${sec("course")}<div class="in">
  <div class="h2"><span class="en">COURSE</span><h2>${q.name}の<br>コース</h2></div>
  ${(q.courses || []).map(c => `<div class="box"><h3 class="h3">${esc(c.name)}${c.teiin ? `<small class="yr">募集 ${esc(c.teiin)}</small>` : ""}</h3><p style="margin:0">${esc(c.text)}</p></div>`).join("\n  ")}
  ${srcNote([...new Set((q.courses || []).map(c => c.src).filter(Boolean))].map(u => q.sources.find(x => x.url === u) || u))}
</div></section>

${sec("exam")}<div class="in">
  <div class="h2"><span class="en">EXAM</span><h2>${q.name}の<br>入試日程と科目</h2></div>
  <p class="lead">${esc(e.year || "")}の入試です。</p>
  <div class="kinds">${(e.kinds || []).map(x => `<div class="kind"><div class="kh"><b>${esc(x.name)}</b><span>${esc(x.date)}</span></div><dl><dt>科目</dt><dd>${td(x.subjects)}</dd><dt>面接</dt><dd>${td(x.interview)}</dd></dl>${x.note ? `<p class="kn">${esc(x.note)}</p>` : ""}</div>`).join("")}</div>
  <div class="box"><dl class="dl">
    ${e.apply ? `<dt>出願</dt><dd>${esc(e.apply)}</dd>` : ""}${e.result ? `<dt>合格発表</dt><dd>${esc(e.result)}</dd>` : ""}${e.consult ? `<dt>個別相談会・説明会</dt><dd>${esc(e.consult)}</dd>` : ""}${e.criteria ? `<dt>推薦の基準</dt><dd>${esc(e.criteria)}</dd>` : ""}${e.scholarship ? `<dt>特待生・奨学生</dt><dd>${esc(e.scholarship)}</dd>` : ""}
  </dl></div>
  ${srcNote(e.src)}
  <p class="note">日程や基準は変わることがあります。出願前に、必ず${q.name}の募集要項で確認してください。</p>
</div></section>

${sec("point")}<div class="in">
  <div class="h2"><span class="en">POINT</span><h2>${q.name}合格への<br>ポイント</h2></div>
  <ol class="pts">${(q.points || []).map(x => `<li>${x}</li>`).join("")}</ol>
  ${q.comment ? `<div class="box voice"><div class="ic">塾長<br>より</div><div><div class="who">学習空間 深谷上柴教室から</div><p>${q.comment}</p></div></div>` : ""}
</div></section>

${ft ? `${sec("feature")}<div class="in">
  <div class="h2"><span class="en">FEATURE</span><h2>${q.name}の<br>校風と特色</h2></div>
  ${ft}
</div></section>

` : ""}${q.fees ? `${sec("fee")}<div class="in">
  <div class="h2"><span class="en">FEE</span><h2>${q.name}の<br>学費</h2></div>
  <div class="box"><h3 class="h3">入学時・年間の費用<small class="yr">${esc(q.fees.year)}</small></h3><div class="tbl"><table class="ex fee"><tbody>${q.fees.items.map(x => `<tr><th>${esc(x.label)}</th><td>${fmt(x.yen)}円</td></tr>`).join("")}</tbody></table></div>
  ${q.fees.note ? `<p class="note" style="margin-top:8px">${esc(q.fees.note)}</p>` : ""}</div>
  ${srcNote(q.fees.src ? [q.fees.src] : [])}
  <p class="note">国の就学支援金などで、実際に払う額は家庭によって変わります。くわしくは学校の説明会で確認しましょう。</p>
</div></section>

` : ""}${cr ? `${sec("career")}<div class="in">
  <div class="h2"><span class="en">CAREER</span><h2>${q.name}の<br>卒業後の進路</h2></div>
  ${cr}
</div></section>

` : ""}${sec("schedule")}<div class="in">
  <div class="h2"><span class="en">SCHEDULE</span><h2>私立入試の流れ</h2></div>
  <ol class="tl">${TL.filter(t => t.c === "pri").map(t => `<li style="--c:var(--g)"><div class="dot"></div><div class="card"><div class="date">${t.d}</div><div class="what">${t.w}</div>${t.s ? `<div class="sub">${t.s}</div>` : ""}</div></li>`).join("")}</ol>
  <p class="note">公立高校の日程は<a href="../#schedule">トップページ</a>で見られます。私立を併願にして公立を受けるときは、公立の合格発表(3月)まで手続きを待てるかも確認しましょう。</p>
</div></section>

${sec("faq")}<div class="in">
  <div class="h2"><span class="en">FAQ</span><h2>${q.name}の入試<br>よくある質問</h2></div>
  <div class="qa">${qs.map(([a, b]) => `<details open><summary>${a}</summary><p>${b}</p></details>`).join("")}</div>
</div></section>

${sec("")}<div class="in">
  <div class="h2"><span class="en">OTHER SCHOOLS</span><h2>ほかの高校の入試情報</h2></div>
  ${privBox(q.slug)}
  ${[...AREAS].sort((x, y) => (y[0] === q.c) - (x[0] === q.c)).map(([c, lab]) => { const os = pages.filter(o => byName[o.keys[0]].c === c); return os.length ? `<div class="box"><h3 class="h3" style="color:${col[c]}">${lab}(公立)</h3><div class="links">${os.map(o => { const d = byName[o.keys[0]]; return `<a href="../${o.slug}/"><span>${o.name}<small>偏差値${hv(d)}・志願倍率${d.b}</small></span></a>`; }).join("")}</div></div>` : ""; }).join("")}
  <div class="links"><a href="../#schools"><span>22校をまとめて見る<small>公立・私立の一覧</small></span></a></div>
</div></section>

` + tail(q.name, "単願・併願の作戦から相談", "単願か併願か、どのコースを狙うか。内申と北辰テストの結果から、一人ひとりに合った受け方を一緒に考えます。", q.name, srcList(q));
}
const srcList = q => `<ul>${q.sources.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join("")}</ul>`;

// ---- 「ちがいがわかる」ページ(専門高校・総合学科と私立高校をくらべる。数字はすべて各校のデータから) ----
const SPEC = [["kumagaya-kogyo", "工業高校", "建築・土木・電気・機械・情報技術の5学科"], ["kumagaya-shogyo", "商業高校", "総合ビジネス科(2年から総合進学・商業・情報処理の3群)"], ["fukaya-shogyo", "商業高校", "商業・会計・情報処理の3学科"], ["kumagaya-nogyo", "農業高校", "生物生産技術・生物生産工学・食品科学・生活技術の4学科7コース"], ["yorii-johoku", "総合学科", "総合学科(文理総合・情報ビジネス・健康教養の3系列7プラン)"], ["shinshukan", "総合学科+工業", "総合学科(5系列)と、電気システム・情報メディア・ものづくりの工業3学科"]];
function chigaiPage() {
  const url = `${SITE}/chigai/`;
  const title = "熊谷工業・熊谷商業・熊谷農業・深谷商業・寄居城北・進修館と私立高校のちがい｜深谷・熊谷 高校入試ナビ";
  const desc = "熊谷・深谷周辺の専門高校(工業・商業・農業)と総合学科、正智深谷・東京成徳大学深谷・本庄第一などの私立高校のちがいを、学科・進路・資格・入試方法で比べました。各校の公式情報をもとに地元の塾がまとめています。";
  let k = 0; const sec = id => `<section class="sec${k++ % 2 ? " alt" : ""}"${id ? ` id="${id}"` : ""}>`;
  const ld = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "深谷・熊谷 高校入試ナビ", item: SITE + "/" },
    { "@type": "ListItem", position: 2, name: "高校のちがい", item: url }] }];
  const nav = `<li><a href="#spec">専門・総合</a></li><li><a href="#private">私立</a></li><li><a href="#voice">My Voice</a></li><li><a href="../#schools">高校一覧</a></li>`;
  const careerTxt = s => { if (!s) return "—"; const sh = shares(s); return sh.length ? sh.slice().sort((a, b) => b.pct - a.pct).slice(0, 3).map(x => `${x.label} ${pctTxt(x.pct)}`).join("・") + `(${s.year.replace(/\(.*/, "")})` : "—"; };
  const specCards = SPEC.map(([slug, kind, units]) => {
    const p = pages.find(x => x.slug === slug); if (!p) return "";
    const d = byName[p.keys[0]], t = TK[slug] || {}, s = SH[slug];
    return `<div class="box"><span class="kind-tag">${kind}</span><h3 class="h3">${p.name}</h3><dl>
      <dt>学科など</dt><dd>${esc(units || "—")}</dd>
      <dt>偏差値</dt><dd>${hv(d)}</dd>
      <dt>卒業後</dt><dd>${esc(careerTxt(s))}</dd>
      ${s && s.shikaku && s.shikaku.length ? `<dt>資格</dt><dd>${esc(s.shikaku.slice(0, 3).join("・"))}など</dd>` : ""}
      ${t.fit && t.fit.length ? `<dt>向いている人</dt><dd>${esc(t.fit[0])}</dd>` : ""}
    </dl><a class="more" href="../${slug}/">${p.name}をくわしく ›</a></div>`;
  }).join("");
  const privCards = privs.map(q => {
    const e = q.exam || {}, k1 = (e.kinds || [])[0] || {}, c = q.career || {};
    const kokko = (c.goukaku || []).find(g => /国公立/.test(g.label));
    return `<div class="box"><span class="kind-tag" style="background:var(--g)">私立・${esc(q.area)}</span><h3 class="h3">${q.name}</h3><dl>
      <dt>コース</dt><dd>${esc((q.courses || []).filter(c => !/課程/.test(c.name)).map(x => x.name.replace(/\(.*\)/, "")).join("・"))}</dd>
      <dt>入試</dt><dd>${esc(k1.date || "—")}から${(e.kinds || []).length}回/${esc(k1.subjects || "—")}</dd>
      <dt>面接</dt><dd>${esc((e.kinds || []).filter(x => x.interview && x.interview !== "なし").map(x => x.name).join("・") || "なし")}</dd>
      ${kokko ? `<dt>国公立合格</dt><dd>${kokko.n}人(${esc(c.year.replace(/\(.*/, ""))})</dd>` : ""}
      ${q.fit && q.fit.length ? `<dt>向いている人</dt><dd>${esc(q.fit[0])}</dd>` : ""}
    </dl><a class="more" href="../${q.slug}/">${q.name}をくわしく ›</a></div>`;
  }).join("");
  return shell(title, desc, url, ld, nav) + `<header class="hero school">
  <div class="in">
    <nav class="crumb" aria-label="パンくずリスト" style="color:#dbe6ff"><a href="../" style="color:#fff">高校入試ナビ</a> › 高校のちがい</nav>
    <span class="pill">2027年度(令和9年度)入試 対応</span>
    <h1><span>熊谷・深谷・本庄周辺</span>専門高校・総合学科と私立高校のちがい</h1>
    <p class="lead">同じ「専門高校」でも、工業・商業・農業で学ぶことと卒業後の進路は大きくちがいます。私立高校も、コースの分け方や入試の判定方法が学校ごとにちがいます。各校の公式情報をもとに、くらべやすくまとめました。</p>
    <p class="stamp">作成:学習空間 深谷上柴教室/情報は${STAMP}時点</p>
  </div>
</header>

${sec("spec")}<div class="in">
  <div class="h2"><span class="en">SPECIALIST</span><h2>専門高校・総合学科の<br>ちがい</h2></div>
  <p class="lead">工業は「ものづくりの技術と国家資格」、商業は「簿記・情報処理の資格」、農業は「動植物・食品・くらしの実習」が学びの中心です。総合学科は、2年生から系列を選んで自分で時間割をつくります。</p>
  <div class="cmp">${specCards}</div>
  <p class="note">「卒業後」は各校の公式サイトの進路資料から、割合の大きい順に3つ。偏差値は民間サイトの値です。</p>
</div></section>

${sec("private")}<div class="in">
  <div class="h2"><span class="en">PRIVATE</span><h2>私立高校の<br>ちがい</h2></div>
  <p class="lead">私立は1月に入試があり、公立の併願先にもなります。コースによって必要な得点がちがい、判定のしかた(3教科の合計か、得意な2教科か)や面接の有無も学校ごとにちがいます。</p>
  <div class="cmp">${privCards}</div>
  <p class="note">入試・コース・合格実績は各校の公式サイトと令和9年度の募集要項より。私立高校は偏差値を公表していないため、載せていません。</p>
</div></section>

${sec("voice")}<div class="in">
  <div class="h2"><span class="en">MY VOICE</span><h2>「なぜこの学校?」を<br>自分の言葉で</h2></div>
  <ol class="pts">
    <li><b>くらべてわかった「その学校だけのこと」を1つ選ぶ。</b>学科・系列・コース、資格、行事など。上のちがいの中から見つけましょう。</li>
    <li><b>それを選んだ理由に、自分の体験を1つ入れる。</b>「〇〇をしたときに、〇〇だと思ったから」と具体的に。</li>
    <li><b>入学後にやりたいことと、将来につなげる。</b>「〇〇を学んで、将来は〇〇に生かしたい」で終わると伝わりやすくなります。</li>
  </ol>
  <a class="app" href="../myvoice/" style="border-color:var(--blue)"><svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="var(--blue)"/><path d="M14 16h20a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H24l-7 6v-6h-3a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4z" fill="#fff"/></svg><div><b style="color:var(--blue)">My Voice メーカー ›</b><span>質問に答えるだけで原稿ができる。タイマーと想定質問で本番練習も</span></div></a>
</div></section>

` + tail("志望校", "くらべて、選んで、準備する", "どの学校が合うか、単願か併願か。内申と北辰テストの結果から、一人ひとりに合った受け方を一緒に考えます。", "各高校と埼玉県教育委員会", SOURCES);
}

// トップページの高校カードから各ページへのリンク表を書きかえる(内容が同じなら何もしない)
const pg = `const PG=${JSON.stringify(Object.fromEntries(Object.entries(slugOf).map(([k, v]) => [k, v + "/"])))};/*PG*/`;
const top2 = top.replace(/const PG=.*?;\/\*PG\*\//, pg);
if (!/\/\*PG\*\//.test(top)) throw new Error("index.html に PG の目印がありません");
if (top2 !== top) fs.writeFileSync(path.join(PUB, "index.html"), top2);

fs.mkdirSync(path.join(PUB, "chigai"), { recursive: true });
fs.writeFileSync(path.join(PUB, "chigai", "index.html"), chigaiPage());
for (const q of privs) {
  const dir = path.join(PUB, q.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), privPage(q));
}
for (const p of pages) {
  const dir = path.join(PUB, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page(p));
}

const urls = [
  { loc: SITE + "/", pri: "1.0" },
  ...pages.map(p => ({ loc: `${SITE}/${p.slug}/`, pri: "0.8" })),
  ...privs.map(q => ({ loc: `${SITE}/${q.slug}/`, pri: "0.8" })),
  { loc: SITE + "/chigai/", pri: "0.7" },
  { loc: SITE + "/myvoice/", pri: "0.5" }
];
fs.writeFileSync(path.join(PUB, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${isoDate}</lastmod><priority>${u.pri}</priority></url>`).join("\n")}
</urlset>
`);
console.log(`高校別ページ ${pages.length + privs.length}件・sitemap.xml を作成しました(${STAMP}時点)`);
