// 高校別ページの生成。public/index.html の高校データ(S)・日程(TL)・CSS・日付と、
// data/school-pages.json の高校ごとの文章から、public/<slug>/index.html と sitemap.xml を作る。
// Netlify のビルドでも毎回実行されるので、トップページのデータを直せば高校別ページもそろって更新される。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const SITE = "https://fukaya-kumagaya-nyushi.netlify.app";
const LINE = "https://lin.ee/rcfMHgx";

const top = fs.readFileSync(path.join(PUB, "index.html"), "utf8");
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "school-pages.json"), "utf8"));

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
  return q;
}

function page(p) {
  const ds = p.keys.map(k => byName[k]);
  ds.forEach((d, i) => { if (!d) throw new Error(`${p.keys[i]} が高校データ S にありません`); });
  const main = ds[0];
  const url = `${SITE}/${p.slug}/`;
  const title = `${p.name}の偏差値・倍率・内申点と合格の目安【2027年度入試】｜深谷・熊谷 高校入試ナビ`;
  const desc = `${p.name}(埼玉県${p.area})の2027年度入試情報。偏差値${hv(main)}、2026年度の倍率${main.b}倍、合格者の内申点と学力検査の得点の目安、配点、面接対策まで、地元の塾がわかりやすくまとめました。`;
  const qs = faq(p);
  const tl = TL.filter(t => t.c !== "pri");
  const others = pages.filter(x => x.slug !== p.slug);
  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "深谷・熊谷 高校入試ナビ", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: `${p.name}の入試情報`, item: url }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: strip(a) } })) }
  ];
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
</style>
</head>
<body>

<div class="top">
  <div class="in">
    <a class="logo" href="https://blue0728.studio.site/" target="_blank" rel="noopener">学習空間<small>深谷上柴教室</small></a>
    <a class="btn-tel" href="${LINE}" target="_blank" rel="noopener"><span class="line-ic">LINE</span>無料体験・相談</a>
  </div>
  <nav class="nav" aria-label="ページ内メニュー"><ul>
    <li><a href="#data">基本データ</a></li><li><a href="#goal">合否の目安</a></li><li><a href="#mix">配点</a></li><li><a href="#point">対策</a></li>
    <li><a href="#schedule">日程</a></li><li><a href="#interview">面接</a></li><li><a href="#faq">よくある質問</a></li><li><a href="../#schools">ほかの高校</a></li>
  </ul></nav>
</div>

<header class="hero school">
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

<section class="sec" id="data"><div class="in">
  <div class="h2"><span class="en">DATA</span><h2>${p.name}の<br>基本データ</h2></div>
  ${ds.map(d => facts(p, d)).join("\n  ")}
  <div class="box"><h3 class="h3">近い偏差値の高校とくらべる</h3>${hensachi(p)}<p class="note" style="margin-top:8px">偏差値は「みんなの高校情報」の値をまとめた民間サイトより。模試によって数値は変わります。</p></div>
  <p class="note">「志願倍率」は2026年度の志願確定倍率(志願者数÷募集人数、埼玉県教育委員会)、「実質倍率」は2026年度に実際に受検した人数をもとにした倍率(民間の開示資料の集計)です。内申の目安(9教科・45点満点)は学習空間 深谷上柴教室の進路指導での目安です。</p>
</div></section>

<section class="sec alt" id="goal"><div class="in">
  <div class="h2"><span class="en">BORDER</span><h2>何点取れば合格?<br>合否の目安</h2></div>
  ${ds.map(d => `<div class="box">${ds.length > 1 ? `<h3 class="h3">${d.d}</h3>` : ""}${goal(d)}</div>`).join("\n  ")}
  ${ds.every(d => !d.g || d.g.few) ? "" : `<p class="note">2026年度入試を受けた先輩の開示得点(民間の調査資料)をもとに、学習空間 深谷上柴教室が算出しました。「安心ライン」は合格者の平均、「ボーダー」は合格者を点数順に並べた下から4分の1の位置です(5教科は5点単位に丸めています)。${ds.some(d => d.sel) ? "数学・英語は学校選択問題のため、学校選択問題を使わない高校とは点数を比べられません。" : ""}年度によって問題の難しさや倍率が変わるため、あくまで目安です。</p>`}
</div></section>

<section class="sec" id="mix"><div class="in">
  <div class="h2"><span class="en">SCORE</span><h2>${p.name}の<br>配点と選抜方法</h2></div>
  <div class="legend"><span><i style="background:var(--exam)"></i>学力検査</span><span><i style="background:var(--report)"></i>調査書(内申)</span><span><i style="background:var(--talk)"></i>面接</span></div>
  ${ds.map(d => mixBlock(p, d)).join("\n  ")}
  <p class="note">第1次選抜で定員の多くが決まり、残りを第2次選抜で決めます。調査書は中1〜中3の9教科の評定(各学年45点満点)を、学年の比率に合わせて点数にしたものです。</p>
</div></section>

<section class="sec alt" id="point"><div class="in">
  <div class="h2"><span class="en">POINT</span><h2>${p.name}合格への<br>ポイント</h2></div>
  <ol class="pts">${p.points.map(x => `<li>${x}</li>`).join("")}</ol>
  <div class="box voice"><div class="ic">塾長<br>より</div><div><div class="who">学習空間 深谷上柴教室から</div><p>${p.comment}</p></div></div>
</div></section>

<section class="sec" id="schedule"><div class="in">
  <div class="h2"><span class="en">SCHEDULE</span><h2>公立入試の日程</h2></div>
  <ol class="tl">${tl.map(t => `<li class="${t.c === "big" ? "big" : ""}" style="--c:${t.c === "big" ? "var(--navy)" : "var(--f)"}"><div class="dot"></div><div class="card"><div class="date">${t.d}</div><div class="what">${t.w}</div>${t.s ? `<div class="sub">${t.s}</div>` : ""}</div></li>`).join("")}</ol>
  <p class="note">私立高校の日程や、ほかの高校とくらべた情報は<a href="../#schedule">トップページ</a>で見られます。</p>
</div></section>

<section class="sec alt" id="interview"><div class="in">
  <div class="h2"><span class="en">INTERVIEW</span><h2>${p.name}の<br>面接対策</h2></div>
  <p class="lead">2027年度から、すべての受検生に面接があります。最初に1分30秒〜2分ほど自分の言葉で話す「My Voice」のあと、面接官からの質問に答えます。${ds.map(d => (ds.length > 1 ? d.d + "の" : "") + `面接の配点は${d.l1 ? d.l1 + "選抜" : "第1次"}${d.s1[2]}点・${d.l2 ? d.l2 + "選抜" : "第2次"}${d.s2[2]}点`).join("、")}です。</p>
  <a class="app" href="../myvoice/" style="border-color:var(--blue)"><svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="var(--blue)"/><path d="M14 16h20a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H24l-7 6v-6h-3a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4z" fill="#fff"/></svg><div><b style="color:var(--blue)">My Voice メーカー ›</b><span>質問に答えるだけで原稿ができる。タイマーと想定質問で本番練習も</span></div></a>
  <a class="app" href="https://splendid-centaur-c2b96a.netlify.app/" target="_blank" rel="noopener"><svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="var(--orange)"/><circle cx="24" cy="19" r="7" fill="#fff"/><path d="M11 38c2-7 7-10 13-10s11 3 13 10z" fill="#fff"/></svg><div><b>長所・短所を整理するアプリ ›</b><span>自分のよいところと課題を書き出そう</span></div></a>
</div></section>

<section class="sec" id="faq"><div class="in">
  <div class="h2"><span class="en">FAQ</span><h2>${p.name}の入試<br>よくある質問</h2></div>
  <div class="qa">${qs.map(([q, a], i) => `<details open><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>
</div></section>

<section class="sec alt"><div class="in">
  <div class="h2"><span class="en">OTHER SCHOOLS</span><h2>ほかの高校の入試情報</h2></div>
  ${[...AREAS].sort((x, y) => (y[0] === main.c) - (x[0] === main.c)).map(([c, lab]) => { const os = others.filter(o => byName[o.keys[0]].c === c); return os.length ? `<div class="box"><h3 class="h3" style="color:${col[c]}">${lab}</h3><div class="links">${os.map(o => { const d = byName[o.keys[0]]; return `<a href="../${o.slug}/"><span>${o.name}<small>偏差値${hv(d)}・志願倍率${d.b}</small></span></a>`; }).join("")}</div></div>` : ""; }).join("")}
  <div class="links"><a href="../#schools"><span>20校をまとめて見る<small>私立高校もふくめた一覧</small></span></a></div>
</div></section>

<section class="juku" id="juku"><div class="in">
  <span class="pill" style="align-self:center">受付中 個別相談・無料体験</span>
  <h2>${p.name}をめざすなら、<br>配点から逆算して準備</h2>
  <p class="lead">内申点・学力検査・面接のどこで点を取るか。志望校の配点に合わせて、一人ひとりやることを決めています。</p>
  <div class="cta">
    <a class="big line" href="${LINE}" target="_blank" rel="noopener"><small>無料体験(1週間・3回程度)・進路相談</small>LINEで問い合わせる</a>
    <a class="sub" href="https://blue0728.studio.site/" target="_blank" rel="noopener">学習空間 深谷上柴教室のサイトへ ›</a>
  </div>
  <p style="text-align:center;font-size:14px;color:#dbe6ff">お電話でも受け付けています:<a href="tel:0485715050" style="color:#fff">048-571-5050</a>(平日17:00〜22:00)/深谷市上柴町東4-14-1</p>
</div></section>

<footer><div class="in">
  <b>情報源</b>
  ${SOURCES}
  <p>最新・正確な内容は、必ず埼玉県教育委員会と${p.name}の発表でご確認ください。</p>
  <p><a href="../">深谷・熊谷 高校入試ナビ トップへ</a></p>
  <p>© 学習空間 深谷上柴教室</p>
</div></footer>
</body>
</html>
`;
}

// トップページの高校カードから各ページへのリンク表を書きかえる(内容が同じなら何もしない)
const pg = `const PG=${JSON.stringify(Object.fromEntries(Object.entries(slugOf).map(([k, v]) => [k, v + "/"])))};/*PG*/`;
const top2 = top.replace(/const PG=.*?;\/\*PG\*\//, pg);
if (!/\/\*PG\*\//.test(top)) throw new Error("index.html に PG の目印がありません");
if (top2 !== top) fs.writeFileSync(path.join(PUB, "index.html"), top2);

for (const p of pages) {
  const dir = path.join(PUB, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page(p));
}

const urls = [
  { loc: SITE + "/", pri: "1.0" },
  ...pages.map(p => ({ loc: `${SITE}/${p.slug}/`, pri: "0.8" })),
  { loc: SITE + "/myvoice/", pri: "0.5" }
];
fs.writeFileSync(path.join(PUB, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${isoDate}</lastmod><priority>${u.pri}</priority></url>`).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(PUB, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`高校別ページ ${pages.length}件・sitemap.xml・robots.txt を作成しました(${STAMP}時点)`);
