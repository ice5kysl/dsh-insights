/**
 * Client-side i18n（zh ⇄ en）— zero-dependency, inline-script runtime.
 *
 * 架构（v1，客户端切换，无双份静态页）：
 *   - HTML 默认承载中文（no-JS / 爬虫看到的就是中文版，与现状一致）。
 *   - 短文案：生成侧用 t(zh, en) 包成 <span data-en="...">zh</span>，
 *     运行时按当前语言整体 swap textContent。
 *   - 占位符/aria：data-en-ph / data-en-title 属性同理 swap。
 *   - 长文段落（about 等）：langBlock(zhHtml, enHtml) 成对块，纯 CSS
 *     按 :root[data-lang] 显隐（head 内联脚本在首帧前定语言，无闪烁）。
 *   - 页面自有 JS 渲染的字符串（如 /plugins/ 浏览页）：用 window.__t(zh, en)
 *     取值，并监听 document 的 'langchange' 事件重渲染。
 *
 * 语言解析：localStorage('lang') 优先；否则 navigator.language 以 zh 开头
 * 为中文，其余一律英文。切换按钮 #langBtn 持久化选择。
 *
 * @module dsh-insights/lib/i18n
 */

const escAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 短文案（纯文本）：<span data-en="English">中文</span> */
export const t = (zh, en) => `<span data-en="${escAttr(en)}">${escHtml(zh)}</span>`

/** input placeholder / button title / aria-label 的双语属性对 */
export const ph = (zh, en) => `placeholder="${escAttr(zh)}" data-en-ph="${escAttr(en)}"`
export const titleAttr = (zh, en) => `title="${escAttr(zh)}" data-en-title="${escAttr(en)}" aria-label="${escAttr(zh)}" data-en-aria="${escAttr(en)}"`

/** 长文成对块：zh 默认可见，en 由 CSS 按 :root[data-lang=en] 切换 */
export const langBlock = (zhHtml, enHtml, tag = 'div') =>
  `<${tag} data-lang-block="zh">${zhHtml}</${tag}><${tag} data-lang-block="en">${enHtml}</${tag}>`

/** 成对块显隐 CSS（并入页面 <style>） */
export const I18N_CSS = `
:root[data-lang=en] [data-lang-block=zh]{display:none}
:root:not([data-lang=en]) [data-lang-block=en]{display:none}
.lang{min-width:30px;justify-content:center;font:600 11px var(--mono);letter-spacing:.04em}
`

/** head 内联：首帧前定语言（成对块靠 CSS 因此无闪烁；<html lang> 同步） */
export const I18N_HEAD = `<script>(function(){try{var l=localStorage.getItem('lang');if(l!=='zh'&&l!=='en')l=((navigator.language||'zh')+'').toLowerCase().indexOf('zh')===0?'zh':'en';var d=document.documentElement;d.dataset.lang=l;d.lang=l==='en'?'en':'zh-CN'}catch(e){}})()</script>`

/** body 末尾内联：swap 所有 data-en 文案 + 绑定切换按钮 + 暴露 __t/__lang/__setLang */
export const I18N_BODY = `<script>(function(){
var D=document.documentElement;
function cur(){return D.dataset.lang==='en'?'en':'zh'}
window.__lang=cur;
window.__t=function(zh,en){return cur()==='en'?en:zh};
window.__setLang=function(l){try{localStorage.setItem('lang',l)}catch(e){}D.dataset.lang=l;D.lang=l==='en'?'en':'zh-CN';apply();try{document.dispatchEvent(new CustomEvent('langchange',{detail:l}))}catch(e){}};
function apply(){
  var l=cur(),en=l==='en';
  document.querySelectorAll('[data-en]').forEach(function(el){if(el.dataset.zh===undefined)el.dataset.zh=el.textContent;el.textContent=en?el.dataset.en:el.dataset.zh});
  document.querySelectorAll('[data-en-ph]').forEach(function(el){if(el.dataset.zhPh===undefined)el.dataset.zhPh=el.getAttribute('placeholder')||'';el.setAttribute('placeholder',en?el.dataset.enPh:el.dataset.zhPh)});
  document.querySelectorAll('[data-en-title]').forEach(function(el){if(el.dataset.zhTitle===undefined)el.dataset.zhTitle=el.getAttribute('title')||'';el.setAttribute('title',en?el.dataset.enTitle:el.dataset.zhTitle)});
  document.querySelectorAll('[data-en-aria]').forEach(function(el){if(el.dataset.zhAria===undefined)el.dataset.zhAria=el.getAttribute('aria-label')||'';el.setAttribute('aria-label',en?el.dataset.enAria:el.dataset.zhAria)});
  var mt=document.querySelector('meta[name=en-title]');
  if(mt){if(!D.dataset.zhTitle)D.dataset.zhTitle=document.title;document.title=en?mt.getAttribute('content'):D.dataset.zhTitle}
  var b=document.getElementById('langBtn');if(b)b.textContent=en?'中':'EN';
}
apply();
var b=document.getElementById('langBtn');
if(b)b.addEventListener('click',function(){window.__setLang(cur()==='en'?'zh':'en')});
})()</script>`
