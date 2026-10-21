/* 四年级上册全科学习工作台 —— 交互主程序 */
(function () {
  const { Store, DateUtil, Settings, Stars, Wrong, Log, Timer, Summary, Judge } = WB;
  const $ = s => document.querySelector(s);
  const view = $('#view');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms || 2400); }
  function modal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
  function closeModal() { $('#modal').classList.add('hidden'); }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  const S = { tab: 'daily', timer: null, session: null, dic: null, plan: null, wplan: null, back: null };

  /* ================= 朗读 ================= */
  let speakTimers = [];
  function clearSpeak() { speakTimers.forEach(clearTimeout); speakTimers = []; try { speechSynthesis.cancel(); } catch (e) { } }
  function speak(text, lang) {
    if (!window.speechSynthesis) { toast('这个浏览器不支持朗读，请家长照着屏幕念'); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang || 'zh-CN';
    u.rate = (lang && lang.indexOf('en') === 0) ? 0.8 : 0.9;
    try { speechSynthesis.speak(u); } catch (e) { }
  }
  function speakSeq(items, lang, gap) {
    clearSpeak();
    items.forEach((t, i) => speakTimers.push(setTimeout(() => speak(t, lang), i * (gap || 2200))));
  }

  /* ================= 计时器 ================= */
  function startClock(minutes, restAt, restMin) {
    stopClock();
    const t = new Timer({
      minutes: minutes, restAt: restAt, restMinutes: restMin,
      onTick: tickUI, onRest: showRest, onEnd: timeUp, onRestEnd: closeModal
    });
    S.timer = t; t.start();
    $('#clock').classList.remove('hidden'); tickUI(t);
  }
  function stopClock() { if (S.timer) { S.timer.stop(); S.timer = null; } $('#clock').classList.add('hidden'); }
  function tickUI(t) {
    const c = $('#clock');
    if (t.resting) { c.classList.add('rest'); c.textContent = '休息 ' + t.mmss(t.restLeft); const r = $('#restCount'); if (r) r.textContent = t.mmss(t.restLeft); }
    else { c.classList.remove('rest'); c.textContent = t.mmss(t.left); }
  }
  function showRest() {
    modal(`<h3>🔔 已经学习 15 分钟啦，休息一下吧</h3>
      <p class="muted">站起来动一动、看看远处、喝口水，2 分钟后再继续～</p>
      <div style="font-size:44px;font-weight:800;color:var(--ok);text-align:center;padding:14px 0" id="restCount">02:00</div>
      <div class="row" style="justify-content:flex-end"><button class="btn ok" onclick="WB_APP.endRest()">我休息好了，继续</button></div>`);
  }
  function timeUp() { toast('⏰ 时间到！今天的学习就到这里，休息一下吧', 4000); stopClock(); }

  /* ================= 星星 ================= */
  function refreshStars() { $('#starTotal').textContent = Stars.total(); }

  function ensureSession(kind) {
    if (!S.session) S.session = { kind: kind, extra: 0, wrongs: [], notes: [] };
    return S.session;
  }

  /* ================= 题库构建 ================= */
  function cnItems(unit, n) {
    const out = [];
    const ws = shuffle(unit.words);
    for (let i = 0; i < Math.min(n, ws.length); i++) {
      const w = ws[i];
      out.push({ q: '看拼音写词语：' + (unit.pinyin[w] || w), a: w, hint: '注意生字的偏旁和结构。', type: '看拼音写词语', selfJudge: false });
    }
    return out;
  }
  function cnPoemItems(n) {
    const out = [];
    const ps = shuffle(CN.poems);
    for (let i = 0; i < Math.min(n, ps.length); i++) {
      const p = ps[i];
      const lines = p.text.split('\n');
      const line = pick(lines);
      const parts = line.split(/[，。？！]/).filter(Boolean);
      const hide = pick(parts);
      out.push({ q: `古诗填空（《${p.title}》${p.author}）：\n` + line.replace(hide, '______'), a: hide, hint: p.tip, type: '古诗填空' });
    }
    return out;
  }
  function cnReadItems(n) {
    const out = [];
    const rs = shuffle(CN.reading);
    for (let i = 0; i < Math.min(n, rs.length); i++) {
      const r = rs[i];
      const qs = shuffle(r.qs).slice(0, 2);
      qs.forEach(q => out.push({
        q: `【课内阅读·${r.title}】\n${r.text}\n\n问题：${q.q}`, a: q.a, hint: '答题要联系课文内容，说清楚理由。', type: '课内阅读', selfJudge: true
      }));
    }
    return out;
  }
  function enItems(unit, n) {
    const out = [];
    const ws = shuffle(unit.words);
    for (let i = 0; i < Math.min(n, ws.length); i++) {
      const w = ws[i];
      if (i % 2 === 0) out.push({ q: `写出单词：${w.zh}　（${w.ph}）`, a: w.w, hint: '注意字母占格和拼写顺序。', type: '单词默写' });
      else out.push({ q: `写出中文意思：${w.w} ${w.ph}`, a: w.zh, hint: '', type: '单词认读' });
    }
    const ss = shuffle(unit.sentences).slice(0, Math.max(1, Math.round(n / 3)));
    ss.forEach(s => {
      const words = s.en.split(' ').filter(w => w.length > 2);
      const target = pick(words.length ? words : s.en.split(' '));
      out.push({ q: '句型填空：' + s.en.replace(target, '______') + '　（' + s.zh + '）', a: target.replace(/[?.!]/g, ''), hint: s.tip, type: '核心句型' });
    });
    return out;
  }
  function mathItems(unit, n) {
    const out = [];
    const kinds = [];
    if (unit.gens && unit.gens.length) kinds.push('gen');
    if (unit.fill && unit.fill.length) kinds.push('fill');
    if (unit.word && unit.word.length) kinds.push('word');
    for (let i = 0; i < n; i++) {
      const k = pick(kinds);
      if (k === 'gen') {
        const g = pick(unit.gens);
        const it = g.make();
        out.push({ q: it.q, a: it.a, hint: it.hint, type: g.kind === 'oral' ? '口算' : '竖式计算' });
      } else if (k === 'fill') {
        const f = pick(unit.fill);
        out.push({ q: f.q, a: f.a, hint: f.hint, type: '填空题' });
      } else {
        const w = pick(unit.word);
        out.push({ q: w.q, a: w.a, hint: w.hint, type: '应用题', selfJudge: true });
      }
    }
    return out;
  }

  /* ================= 通用练习引擎 ================= */
  // mode: 'list' 一次全出 | 'one' 一题一题
  function Practice(items, opt) {
    S.prac = { items: items, i: 0, mode: opt.mode || 'one', results: [], opt: opt };
    renderPractice();
  }
  function renderPractice() {
    const P = S.prac;
    const o = P.opt;
    let html = `<div class="row" style="margin-bottom:10px">
      <button class="btn gray sm" onclick="WB_APP.goBack()">← 返回</button>
      <b>${esc(o.title || '练习')}</b><span class="muted">${P.mode === 'one' ? '第 ' + (P.i + 1) + ' / ' + P.items.length + ' 题' : '共 ' + P.items.length + ' 题'}</span></div>`;
    html += `<div class="card">`;
    if (P.mode === 'list') {
      html += `<div class="qlist">`;
      P.items.forEach((it, i) => {
        html += `<div class="qitem"><span class="qtext">${i + 1}. ${esc(it.q)}</span>
          <input class="ans" id="ans${i}" placeholder="在这里写答案" autocomplete="off">
          <span id="mk${i}"></span></div>`;
      });
      html += `</div><div class="row" style="margin-top:12px">
        <button class="btn" id="btnSubmit">提交批改</button>
        <button class="btn ghost hidden" id="btnFinish">做完了，返回</button></div>
      <div id="ansArea"></div>`;
    } else {
      const it = P.items[P.i];
      html += `<div class="qbox"><div class="row"><span class="tag">${esc(it.type || '')}</span>${it.selfJudge ? '<span class="tag o">自己对照答案打分</span>' : ''}</div>
        <div class="qtitle">${esc(it.q)}</div>
        ${it.selfJudge ? '<textarea class="ans" id="ans0" placeholder="把你的答案写在这里"></textarea>' : '<input class="ans wide" id="ans0" placeholder="把答案写在这里" autocomplete="off">'}</div>
        <div class="row"><button class="btn" id="btnSubmit">我写好了，看答案</button>
        <button class="btn ghost hidden" id="btnNext">下一题</button>
        <button class="btn ok hidden" id="btnFinish">做完了，返回</button></div>
        <div id="ansArea"></div>`;
    }
    html += `</div>`;
    view.innerHTML = html;

    $('#btnSubmit').onclick = () => {
      const area = $('#ansArea');
      if (P.mode === 'list') {
        let right = 0;
        P.items.forEach((it, i) => {
          const u = $('#ans' + i).value;
          if (!it.selfJudge) {
            const ok = Judge.eq(u, it.a);
            $('#mk' + i).innerHTML = ok ? '<span class="ok-mark">✅ 对</span>' : '<span class="bad-mark">❌ 错　正确：' + esc(it.a) + '</span>';
            if (ok) right++; else recordWrong(it, u, o);
            P.results.push({ q: it.q, a: it.a, user: u, correct: ok });
          } else {
            $('#mk' + i).innerHTML = '<span class="tag o">自己对照</span>';
            P.results.push({ q: it.q, a: it.a, user: u, correct: null });
          }
        });
        area.innerHTML = `<div class="answer"><b>对答案时间：</b>自动批改 ${P.items.filter(x => !x.selfJudge).length} 题，对的 <b>${right}</b> 题。${P.items.some(x => x.selfJudge) ? '<br>带"自己对照"的题目，请照着下面的答案自己打分。' : ''}</div>` +
          P.items.map((it, i) => `<div class="hintbox">第${i + 1}题　正确答案：<b>${esc(it.a)}</b>${it.hint ? '<br>💡 ' + esc(it.hint) : ''}</div>`).join('');
        $('#btnSubmit').classList.add('hidden'); $('#btnFinish').classList.remove('hidden');
      } else {
        const it = P.items[P.i];
        const u = $('#ans0').value;
        let ok = null;
        if (!it.selfJudge) ok = Judge.eq(u, it.a);
        let h = `<div class="answer"><b>正确答案：</b>${esc(it.a)}${it.selfJudge ? '<br><span class="muted">（主观题：照着参考答案看看自己答到了几点）</span>' : ''}</div>`;
        if (it.hint) h += `<div class="hintbox">💡 ${esc(it.hint)}</div>`;
        if (it.selfJudge) {
          h += `<div class="row" style="margin-top:10px">我答得怎么样？
            <button class="btn ok sm" id="btnRight">✅ 答对了</button>
            <button class="btn bad sm" id="btnWrong">❌ 答错了</button></div>`;
        } else if (ok) {
          h = `<div class="answer"><span class="ok-mark">✅ 太棒了，答对啦！</span><br>正确答案：${esc(it.a)}${it.hint ? '<br>💡 ' + esc(it.hint) : ''}</div>`;
        } else {
          h = `<div class="answer"><span class="bad-mark">❌ 这题再看看～</span><br>你的答案：${esc(u) || '（没写）'}<br>正确答案：<b>${esc(it.a)}</b>${it.hint ? '<br>💡 ' + esc(it.hint) : ''}</div>`;
        }
        area.innerHTML = h;
        $('#ans0').disabled = true;
        $('#btnSubmit').classList.add('hidden');
        const finishOne = (correct) => {
          P.results.push({ q: it.q, a: it.a, user: u, correct: correct });
          if (correct === false) recordWrong(it, u, o);
          if (o.onJudge) o.onJudge(it, correct);
          if (P.i < P.items.length - 1) $('#btnNext').classList.remove('hidden');
          else $('#btnFinish').classList.remove('hidden');
        };
        if (it.selfJudge) {
          $('#btnRight').onclick = () => finishOne(true);
          $('#btnWrong').onclick = () => finishOne(false);
        } else finishOne(ok);
        const bn = $('#btnNext'); if (bn) bn.onclick = () => { P.i++; renderPractice(); };
      }
    };
    const bf = $('#btnFinish');
    if (bf) {
      bf.onclick = () => {
        const res = P.results;
        if (o.onFinish) o.onFinish(res); else WB_APP.goBack();
      };
    }
  }
  function recordWrong(it, userAnswer, o) {
    if (!o || o.noWrong) return;
    WB.Wrong.add({ subject: o.subject || '', unit: o.unit || '', type: it.type || '', q: it.q, a: it.a, hint: it.hint, wrongAnswer: userAnswer });
    const ss = S.session; if (ss) ss.wrongs.push({ subject: o.subject, q: it.q, a: it.a });
  }

  /* ================= 模式1 每日任务 ================= */
  function dayIdx() { return Math.floor(Date.now() / 86400000); }
  function buildDailyPlan() {
    const d = dayIdx();
    const cn = CN.units[d % CN.units.length];
    const mu = MATH.units[d % MATH.units.length];
    const eu = EN.units[d % EN.units.length];
    const poem = CN.poems[d % CN.poems.length];
    const rec = CN.recite[d % CN.recite.length];
    const st = Store.get('plan_' + DateUtil.today(), { done: {} });
    const p = { kind: 'daily', done: st.done || {}, tasks: [] };
    p.cnUnit = cn; p.mathUnit = mu; p.enUnit = eu;
    p.tasks = [
      { id: 'm1', must: true, min: 4, text: `语文：听写《${cn.name}》5 个词语`, run: cb => screenDictation('cn', cn.id, 5, cb) },
      { id: 'm2', must: true, min: 3, text: `语文：背诵/朗读古诗《${poem.title}》`, run: cb => screenRecite({ kind: 'poem', ref: poem }, cb) },
      { id: 'm3', must: true, min: 5, text: `数学：口算 10 题（限时 5 分钟）`, run: cb => Practice(MATH.makeOral(10), { title: '数学口算 10 题', mode: 'list', subject: '数学', unit: mu.name, onFinish: () => cb && cb() }) },
      { id: 'm4', must: true, min: 5, text: `数学：《${mu.name}》竖式/填空 2 题`, run: cb => Practice(mathItems(mu, 2), { title: mu.name + ' 专项 2 题', mode: 'one', subject: '数学', unit: mu.name, onFinish: () => cb && cb() }) },
      { id: 'm5', must: true, min: 3, text: `英语：${eu.name} 单词 5 个 + 句型`, run: cb => screenDictation('en', eu.id, 5, cb) },
      { id: 'o1', must: false, min: 0, text: `选做：小练笔一则 ——《${pick(CN.writing).title}》` },
      { id: 'o2', must: false, min: 0, text: `选做：数学拓展挑战 1 题（《${mu.name}》）`, run: cb => Practice(mathItems(mu, 1), { title: '数学拓展挑战', mode: 'one', subject: '数学', unit: mu.name, onFinish: () => cb && cb() }) },
      { id: 'o3', must: false, min: 0, text: `选做：衡水体抄写 1 行（${eu.name} 单词 3 个）` }
    ];
    return p;
  }
  function ensureDailyPlan() { if (!S.plan) S.plan = buildDailyPlan(); return S.plan; }
  function savePlan() { if (S.plan) Store.set('plan_' + DateUtil.today(), { done: S.plan.done }); }

  function screenDaily() {
    const p = ensureDailyPlan();
    const s = Settings.get();
    const must = p.tasks.filter(t => t.must), done = must.filter(t => p.done[t.id]).length;
    let html = `<div class="card">
      <h3>📅 每日任务　<span class="tag">${DateUtil.today()} ${DateUtil.weekdayName()}</span>
      <span class="tag g">${s.weekdayMinutes} 分钟</span></h3>
      <div class="muted">今日进度：必做 ${done} / ${must.length} 项　·　规则：周一至周五每次不超过 ${s.weekdayMinutes} 分钟，学 15 分钟休息 2 分钟。</div>
      <div class="progress"><i style="width:${Math.round(done / must.length * 100)}%"></i></div>
      <div class="row">
        <button class="btn ${S.timer ? 'gray' : 'ok'}" id="btnClock">${S.timer ? '结束计时' : '▶ 开始 ' + s.weekdayMinutes + ' 分钟计时'}</button>
        <button class="btn ghost" id="btnSettle">🏁 结束学习，结算星星</button>
      </div></div>`;
    html += `<div class="card"><h3>✅ 必做任务</h3>`;
    must.forEach((t, i) => { html += taskHTML(t, i + 1); });
    html += `</div><div class="card"><h3>🌟 选做拓展（有时间再做）</h3>`;
    p.tasks.filter(t => !t.must).forEach(t => { html += taskHTML(t, 0); });
    html += `</div>`;
    view.innerHTML = html;
    bindTasks(p);
    $('#btnClock').onclick = () => {
      if (S.timer) { stopClock(); toast('已结束计时'); screenDaily(); return; }
      ensureSession('daily');
      startClock(s.weekdayMinutes, s.restAt, s.restMinutes);
      toast('开始啦！专注 ' + s.weekdayMinutes + ' 分钟～');
      screenDaily();
    };
    $('#btnSettle').onclick = () => openSettle('daily');
  }
  function taskHTML(t, no) {
    const done = S.plan && S.plan.done[t.id];
    return `<div class="task ${done ? 'done' : ''}">
      <div class="no">${no ? no : '☆'}</div>
      <div class="body"><div class="t">${esc(t.text)}</div>
        <div class="d">${t.must ? '必做' : '选做'}${t.min ? ' · 约 ' + t.min + ' 分钟' : ''}</div></div>
      <div class="row">${t.run ? `<button class="btn sm ${done ? 'gray' : ''}" data-act="run" data-id="${t.id}">${done ? '再做一次' : '开始'}</button>` : ''}
        <button class="btn sm ${done ? 'ok' : 'ghost'}" data-act="toggle" data-id="${t.id}">${done ? '已完成' : '标记完成'}</button></div></div>`;
  }
  function bindTasks(p) {
    view.querySelectorAll('[data-act=run]').forEach(b => b.onclick = () => {
      const t = p.tasks.find(x => x.id === b.dataset.id);
      S.back = () => screenDaily();
      t.run(() => { p.done[t.id] = true; savePlan(); refreshStars(); screenDaily(); });
    });
    view.querySelectorAll('[data-act=toggle]').forEach(b => b.onclick = () => {
      const t = p.tasks.find(x => x.id === b.dataset.id);
      if (p.done[t.id]) delete p.done[t.id]; else p.done[t.id] = true;
      savePlan(); screenDaily();
    });
  }

  /* ================= 模式2 周末专项 ================= */
  function buildWeekendPlan() {
    const d = dayIdx();
    const cn = CN.units[(d + 2) % CN.units.length];
    const mu = MATH.units[(d + 3) % MATH.units.length];
    const eu = EN.units[(d + 1) % EN.units.length];
    const reading = CN.reading[d % CN.reading.length];
    const st = Store.get('wplan_' + DateUtil.today(), { done: {} });
    const p = { kind: 'weekend', done: st.done || {}, tasks: [] };
    p.tasks = [
      { id: 'w1', must: true, mod: '语文（25 分钟）', text: `语文：听写《${cn.name}》8 个词语`, run: cb => screenDictation('cn', cn.id, 8, cb) },
      { id: 'w2', must: true, mod: '语文（25 分钟）', text: `语文：课内阅读《${reading.title}》回答问题`, run: cb => Practice(cnReadItems(1), { title: '课内阅读理解', mode: 'one', subject: '语文', unit: cn.name, onFinish: () => cb && cb() }) },
      { id: 'w3', must: true, mod: '语文（25 分钟）', text: `语文：古诗填空 2 题 + 小练笔`, run: cb => Practice(cnPoemItems(2), { title: '古诗填空', mode: 'one', subject: '语文', unit: '古诗', onFinish: () => cb && cb() }) },
      { id: 'w4', must: true, mod: '数学（25 分钟）', text: `数学：口算 12 题`, run: cb => Practice(MATH.makeOral(12), { title: '数学口算 12 题', mode: 'list', subject: '数学', unit: mu.name, onFinish: () => cb && cb() }) },
      { id: 'w5', must: true, mod: '数学（25 分钟）', text: `数学：《${mu.name}》竖式 3 题`, run: cb => Practice(mathItems(mu, 3), { title: mu.name + ' 竖式/填空', mode: 'one', subject: '数学', unit: mu.name, onFinish: () => cb && cb() }) },
      { id: 'w6', must: true, mod: '数学（25 分钟）', text: `数学：应用题 2 题`, run: cb => Practice(mathItems(mu, 2).map(x => Object.assign(x, { selfJudge: true, type: '应用题' })), { title: '数学应用题', mode: 'one', subject: '数学', unit: mu.name, onFinish: () => cb && cb() }) },
      { id: 'w7', must: true, mod: '英语（10 分钟）', text: `英语：${eu.name} 单词听写 8 个`, run: cb => screenDictation('en', eu.id, 8, cb) },
      { id: 'w8', must: true, mod: '英语（10 分钟）', text: `英语：句型 + 衡水体抄写`, run: cb => Practice(enItems(eu, 4), { title: eu.name + ' 句型练习', mode: 'one', subject: '英语', unit: eu.name, onFinish: () => cb && cb() }) },
      { id: 'w9', must: false, mod: '选做', text: '选做：错题复习 / 背诵检测 / 课外阅读' }
    ];
    return p;
  }
  function ensureWeekendPlan() { if (!S.wplan) S.wplan = buildWeekendPlan(); return S.wplan; }
  function screenWeekend() {
    const p = ensureWeekendPlan();
    const s = Settings.get();
    const must = p.tasks.filter(t => t.must), done = must.filter(t => p.done[t.id]).length;
    let html = `<div class="card"><h3>🎯 周末专项　<span class="tag g">${s.weekendMinutes} 分钟</span><span class="tag">中间安排一次休息</span></h3>
      <div class="muted">今日进度：${done} / ${must.length} 项　·　建议顺序：语文 → 休息 5 分钟 → 数学 → 英语</div>
      <div class="progress"><i style="width:${Math.round(done / must.length * 100)}%"></i></div>
      <div class="row"><button class="btn ${S.timer ? 'gray' : 'ok'}" id="btnClock">${S.timer ? '结束计时' : '▶ 开始 ' + s.weekendMinutes + ' 分钟计时'}</button>
      <button class="btn ghost" id="btnSettle">🏁 结束学习，结算星星</button></div></div>`;
    let mod = '';
    p.tasks.forEach(t => {
      if (t.mod !== mod) { mod = t.mod; html += `<div class="card"><h3>${esc(mod)}</h3>`; }
      html += taskHTML2(p, t);
      const next = p.tasks[p.tasks.indexOf(t) + 1];
      if (!next || next.mod !== mod) html += `</div>`;
      if (t.mod === '语文（25 分钟）' && (!next || next.mod !== mod)) html += `<div class="card" style="background:var(--ok-soft);border-color:#bfe5d2"><h3>🥤 休息一下（5 分钟）</h3><div class="muted">喝口水、伸个懒腰、看看远处，再开始下一模块。</div></div>`;
    });
    view.innerHTML = html;
    bindTasks2(p);
    $('#btnClock').onclick = () => {
      if (S.timer) { stopClock(); screenWeekend(); return; }
      ensureSession('weekend');
      startClock(s.weekendMinutes, 30, 5);
      toast('周末专项开始！中间记得休息一次～'); screenWeekend();
    };
    $('#btnSettle').onclick = () => openSettle('weekend');
  }
  function taskHTML2(p, t) {
    const done = p.done[t.id];
    return `<div class="task ${done ? 'done' : ''}"><div class="no">${done ? '✓' : '•'}</div>
      <div class="body"><div class="t">${esc(t.text)}</div><div class="d">${t.must ? '必做' : '选做'}</div></div>
      <div class="row">${t.run ? `<button class="btn sm" data-act="run" data-id="${t.id}">${done ? '再做一次' : '开始'}</button>` : ''}
      <button class="btn sm ${done ? 'ok' : 'ghost'}" data-act="toggle" data-id="${t.id}">${done ? '已完成' : '标记完成'}</button></div></div>`;
  }
  function bindTasks2(p) {
    view.querySelectorAll('[data-act=run]').forEach(b => b.onclick = () => {
      const t = p.tasks.find(x => x.id === b.dataset.id);
      S.back = () => screenWeekend();
      t.run(() => { p.done[t.id] = true; Store.set('wplan_' + DateUtil.today(), { done: p.done }); refreshStars(); screenWeekend(); });
    });
    view.querySelectorAll('[data-act=toggle]').forEach(b => b.onclick = () => {
      const t = p.tasks.find(x => x.id === b.dataset.id);
      if (p.done[t.id]) delete p.done[t.id]; else p.done[t.id] = true;
      Store.set('wplan_' + DateUtil.today(), { done: p.done }); screenWeekend();
    });
  }

  /* ================= 模式3 听写默写 ================= */
  function screenDictation(subj, unitId, count, onDone) {
    let words;
    if (subj === 'cn') { const u = CN.units.find(x => x.id === unitId) || CN.units[0]; words = shuffle(u.words).slice(0, count).map(w => ({ text: w, extra: (u.pinyin[w] || ''), zh: '' })); }
    else { const u = EN.units.find(x => x.id === unitId) || EN.units[0]; words = shuffle(u.words).slice(0, count).map(w => ({ text: w.w, extra: w.ph, zh: w.zh })); }
    S.dic = { subj: subj, unitId: unitId, words: words, batch: 0, size: 5, checking: false, marks: {}, onDone: onDone, show: false };
    S.back = onDone ? () => { clearSpeak(); S.back = null; screenDaily(); } : null;
    renderDic();
  }
  function renderDic() {
    const D = S.dic;
    if (!D) return;
    const total = D.words.length;
    const batches = Math.ceil(total / D.size);
    let html = `<div class="row" style="margin-bottom:10px">
      <button class="btn gray sm" onclick="WB_APP.dicBack()">← 返回</button>
      <b>${D.subj === 'cn' ? '语文听写' : '英语单词听写'}</b>
      <span class="tag">${D.checking ? '正在核对' : '第 ' + (D.batch + 1) + ' / ' + batches + ' 批'}</span>
      <div class="spacer"></div>
      ${D.checking ? '' : `<button class="btn gray sm" id="btnShow">👀 家长看词语</button>`}</div>`;
    html += `<div class="card">`;
    if (!D.checking) {
      const start = D.batch * D.size, end = Math.min(start + D.size, total);
      html += `<div class="muted" style="text-align:center">正在听写第 ${start + 1} — ${end} 个（共 ${total} 个）。听清楚再写，写完输入"写完"进入下一批。</div>
        <div class="dic-num">`;
      for (let i = 0; i < total; i++) {
        let cls = i < start ? 'fin' : (i < end ? 'cur' : '');
        html += `<span class="${cls}">${i + 1}</span>`;
      }
      html += `</div>
        <div class="row" style="justify-content:center;margin:14px 0">
          <button class="btn ok" id="btnPlay">🔊 播放本批（每个读两遍）</button>
          <button class="btn ghost" id="btnAgain">🔁 再读一遍</button>
        </div>
        <div id="showArea" class="hidden" style="text-align:center">${D.words.slice(start, end).map((w, i) => `<div class="dic-word">${start + i + 1}. ${esc(w.text)} <span class="muted" style="letter-spacing:0">${esc(w.extra)}${w.zh ? ' ' + esc(w.zh) : ''}</span></div>`).join('')}</div>
        <div class="row" style="justify-content:center">
          <input class="ans" id="dicInput" placeholder='写完了就输入：写完' autocomplete="off">
          <button class="btn" id="btnNextBatch">写完，下一批</button>
        </div>
        <div class="muted" style="text-align:center;margin-top:10px">💡 不会写的字先空着，等核对的时候再补上，不要偷看哦。</div>`;
    } else {
      html += `<div class="muted">全部报完啦！一起来对照一下，写对的点 ✅，写错的（或不会写的）点 ❌。</div>`;
      D.words.forEach((w, i) => {
        html += `<div class="check-word"><div><b>${i + 1}. ${esc(w.text)}</b> <span class="${D.subj === 'en' ? 'en-ph' : 'muted'}">${esc(w.extra)}${w.zh ? ' · ' + esc(w.zh) : ''}</span></div>
          <div class="row"><button class="btn ${D.marks[i] === 1 ? 'ok' : 'gray'} sm" data-mk="1" data-i="${i}">✅ 写对了</button>
          <button class="btn ${D.marks[i] === 0 ? 'bad' : 'gray'} sm" data-mk="0" data-i="${i}">❌ 写错了</button></div></div>`;
      });
      html += `<div class="row" style="margin-top:14px"><button class="btn ok" id="btnDicDone">核对完成</button></div>`;
    }
    html += `</div>`;
    view.innerHTML = html;
    if (!D.checking) {
      const bs = $('#btnShow'); if (bs) bs.onclick = () => { $('#showArea').classList.toggle('hidden'); };
      $('#btnPlay').onclick = () => {
        const start = D.batch * D.size;
        const list = [];
        D.words.slice(start, Math.min(start + D.size, total)).forEach(w => { list.push(w.text); list.push(w.text); });
        speakSeq(list, D.subj === 'en' ? 'en-US' : 'zh-CN', 2000);
        toast('开始报读，准备好纸笔！');
      };
      $('#btnAgain').onclick = () => {
        const start = D.batch * D.size;
        speakSeq(D.words.slice(start, Math.min(start + D.size, total)).map(w => w.text), D.subj === 'en' ? 'en-US' : 'zh-CN', 2000);
      };
      $('#btnNextBatch').onclick = () => {
        const v = $('#dicInput').value.trim();
        if (v !== '写完') { toast('写完以后，在框里输入"写完"再点按钮哦～'); return; }
        clearSpeak();
        if (D.batch + 1 < batches) { D.batch++; renderDic(); }
        else { D.checking = true; renderDic(); }
      };
    } else {
      view.querySelectorAll('[data-mk]').forEach(b => b.onclick = () => { D.marks[b.dataset.i] = Number(b.dataset.mk); renderDic(); });
      $('#btnDicDone').onclick = () => {
        let wrong = [];
        D.words.forEach((w, i) => { if (D.marks[i] === 0) wrong.push(w); });
        const subjName = D.subj === 'cn' ? '语文' : '英语';
        wrong.forEach(w => Wrong.add({ subject: subjName, unit: subjName === '语文' ? (CN.units.find(u => u.id === D.unitId) || {}).name : (EN.units.find(u => u.id === D.unitId) || {}).name, type: '听写', q: '听写：' + w.extra + (w.zh ? '（' + w.zh + '）' : ''), a: w.text, hint: '多写两遍，明天再听一次。' }));
        const ss = ensureSession(D.onDone ? (S.session ? S.session.kind : 'daily') : 'extra');
        ss.wrongs = ss.wrongs.concat(wrong.map(w => ({ subject: subjName, q: '听写：' + w.text, a: w.text })));
        let msg, extra = 0;
        const n = wrong.length;
        if (n === 0) { msg = '🎉 全部写对，太厉害了！额外奖励 ⭐1 颗'; extra = 1; }
        else if (n <= 2) { msg = `写错 ${n} 个，没关系，错的字多写两遍就记住啦！（不扣星也不加星）`; }
        else { msg = `写错 ${n} 个，我们把它放进错题本，过几天再复习一次～`; }
        if (extra) { Stars.add(extra, '听写全部正确'); ss.extra += extra; refreshStars(); }
        modal(`<h3>听写结果</h3><p>${msg}</p>
          ${wrong.length ? '<div class="hintbox">错词：' + wrong.map(w => esc(w.text)).join('、') + '<br>已加入错题知识库，3 天后复习。</div>' : ''}
          <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" onclick="WB_APP.closeModal()">好</button></div>`);
        if (D.onDone) { D.onDone(); } else { S.dic = null; screenDictationMenu(); }
      };
    }
  }

  function screenDictationMenu() {
    let html = `<div class="card"><h3>✍️ 听写默写</h3><div class="muted">分批报词语，写完输入"写完"进入下一批；全部报完后一起核对。全对额外 +⭐1。</div></div>`;
    html += `<div class="card"><h3>语文 · 词语听写</h3><div class="grid">` +
      CN.units.map(u => `<button class="btn ghost sm" data-cn="${u.id}">${esc(u.name)}</button>`).join('') + `</div>
      <div class="row" style="margin-top:12px">每批数量：
        <select id="cnCnt" class="ans" style="width:100px"><option>5</option><option selected>8</option><option>10</option><option>16</option></select></div></div>`;
    html += `<div class="card"><h3>英语 · 单词听写</h3><div class="grid">` +
      EN.units.map(u => `<button class="btn ghost sm" data-en="${u.id}">${esc(u.name)}</button>`).join('') + `</div>
      <div class="row" style="margin-top:12px">每批数量：
        <select id="enCnt" class="ans" style="width:100px"><option>5</option><option selected>8</option><option>10</option><option>16</option></select></div></div>`;
    view.innerHTML = html;
    view.querySelectorAll('[data-cn]').forEach(b => b.onclick = () => screenDictation('cn', Number(b.dataset.cn), Number($('#cnCnt').value)));
    view.querySelectorAll('[data-en]').forEach(b => b.onclick = () => screenDictation('en', Number(b.dataset.en), Number($('#enCnt').value)));
  }

  /* ================= 模式4 刷题练习 ================= */
  function screenPractice() {
    let html = `<div class="card"><h3>📝 刷题练习</h3><div class="muted">先出题 → 孩子作答 → 再对答案。做错的题自动进错题本。</div>
      <div class="row" style="margin-top:10px">
        <button class="btn sm" data-sub="语文">语文</button>
        <button class="btn ghost sm" data-sub="数学">数学</button>
        <button class="btn ghost sm" data-sub="英语">英语</button>
        <span class="muted" id="subTip">请选择学科</span></div></div>
      <div id="unitBox"></div>`;
    view.innerHTML = html;
    let sub = '语文';
    view.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => {
      sub = b.dataset.sub;
      view.querySelectorAll('[data-sub]').forEach(x => { x.className = 'btn sm ' + (x.dataset.sub === sub ? '' : 'ghost'); });
      $('#subTip').textContent = '已选择：' + sub;
      renderUnits(sub);
    });
    renderUnits('语文');
    function renderUnits(sub) {
      let box = `<div class="card"><h3>选择单元</h3><div class="grid">`;
      if (sub === '语文') {
        CN.units.forEach(u => box += `<button class="btn ghost sm" data-u="${u.id}">${esc(u.name)}</button>`);
        box += `<button class="btn ghost sm" data-u="poem">古诗专项</button><button class="btn ghost sm" data-u="read">课内阅读理解</button>`;
      } else if (sub === '数学') {
        MATH.units.forEach(u => box += `<button class="btn ghost sm" data-u="${u.id}">${esc(u.name)}</button>`);
      } else {
        EN.units.forEach(u => box += `<button class="btn ghost sm" data-u="${u.id}">${esc(u.name)}</button>`);
      }
      box += `</div><div class="row" style="margin-top:12px">题量：
        <select id="cnt" class="ans" style="width:100px"><option>5</option><option selected>8</option><option>10</option><option>15</option></select>
        方式：<select id="mode" class="ans" style="width:140px"><option value="one">一题一题</option><option value="list">一次全出</option></select></div></div>`;
      $('#unitBox').innerHTML = box;
      $('#unitBox').querySelectorAll('[data-u]').forEach(b => b.onclick = () => {
        const id = b.dataset.u, n = Number($('#cnt').value), mode = $('#mode').value;
        let items = [];
        if (sub === '语文') {
          if (id === 'poem') items = cnPoemItems(n);
          else if (id === 'read') items = cnReadItems(Math.ceil(n / 2));
          else { const u = CN.units.find(x => x.id === Number(id)); items = cnItems(u, n).concat(cnPoemItems(Math.min(2, Math.ceil(n / 4)))); }
          items.forEach(i => i.subject = '语文');
        } else if (sub === '数学') {
          const u = MATH.units.find(x => x.id === Number(id)); items = mathItems(u, n);
        } else {
          const u = EN.units.find(x => x.id === Number(id)); items = enItems(u, n);
        }
        S.back = () => screenPractice();
        Practice(shuffle(items).slice(0, n), {
          title: sub + '专项练习', mode: mode, subject: sub, unit: sub === '数学' ? (MATH.units.find(x => x.id === Number(id)) || {}).name : String(id),
          onFinish: () => { toast('这组练习完成啦！'); screenPractice(); }
        });
      });
    }
  }

  /* ================= 模式5 错题复习 ================= */
  function screenReview() {
    const due = Wrong.due();
    const all = Wrong.list();
    let html = `<div class="card"><h3>🔁 错题复习（3 天 / 7 天）</h3>
      <div class="muted">错题本共 ${all.length} 题，今天到期需要复习 <b>${due.length}</b> 题；已掌握出库 ${Wrong.masteredCount()} 题。</div>
      <div class="row" style="margin-top:10px">
        <button class="btn ${due.length ? '' : 'gray'}" id="btnDue" ${due.length ? '' : 'disabled'}>▶ 复习到期错题（${due.length}）</button>
        <button class="btn ghost" id="btnAll" ${all.length ? '' : 'disabled'}>复习全部错题（${all.length}）</button></div>
      ${due.length ? '' : '<div class="hintbox">今天没有到期的错题，先去完成今天的任务吧！下一次复习时间见下方错题本。</div>'}</div>`;
    html += wrongTable(all, '错题本（按复习时间排序）');
    view.innerHTML = html;
    $('#btnDue').onclick = () => startReview(due);
    $('#btnAll').onclick = () => startReview(all);
  }
  function startReview(list) {
    const items = list.map(w => ({ id: w.id, q: w.q, a: w.a, hint: w.hint, type: w.type || '错题', subject: w.subject }));
    S.back = () => screenReview();
    let bonus = 0;
    Practice(items, {
      title: '错题复习', mode: 'one', subject: '错题', noWrong: true,
      onJudge: (it, correct) => {
        Wrong.mark(it.id, correct);
        if (correct) { bonus += 0.5; }
      },
      onFinish: (res) => {
        const right = res.filter(r => r.correct === true).length;
        if (right > 0) {
          const add = right * 0.5;
          Stars.add(add, '错题重做全对 ' + right + ' 题');
          refreshStars();
          modal(`<h3>🔁 复习完成</h3><p>答对 <b>${right}</b> 题，奖励 ⭐ ${add} 颗（每道 0.5 颗）！<br>答错的题目会在 3 天后再次出现，别担心～</p>
            <div class="row" style="justify-content:flex-end"><button class="btn" onclick="WB_APP.closeModal()">好</button></div>`);
        } else {
          modal(`<h3>🔁 复习完成</h3><p>这次还有错题没过关，它们会在 3 天后再来一次。先把正确答案看一遍，写两遍就记住啦！</p>
            <div class="row" style="justify-content:flex-end"><button class="btn" onclick="WB_APP.closeModal()">好的</button></div>`);
        }
        screenReview();
      }
    });
  }
  function wrongTable(list, title) {
    if (!list.length) return `<div class="card"><h3>${title}</h3><div class="muted">暂无错题，很棒！</div></div>`;
    const t = DateUtil.today();
    const rows = list.slice().sort((a, b) => (a.next < b.next ? -1 : 1)).map(w => {
      const d = DateUtil.diffDays(t, w.next);
      return `<tr><td><span class="tag">${esc(w.subject || '')}</span></td>
        <td>${esc(w.q).replace(/\n/g, '<br>')}</td>
        <td><b>${esc(w.a)}</b></td>
        <td>${w.next}<br><span class="muted">${d <= 0 ? '今天该复习' : d + ' 天后'}｜第${w.stage + 1}轮</span></td>
        <td><button class="btn gray sm" data-del="${w.id}">删除</button></td></tr>`;
    }).join('');
    return `<div class="card"><h3>${title}</h3><table><thead><tr><th>科目</th><th>题目</th><th>正确答案</th><th>下次复习</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  view.addEventListener('click', e => {
    const b = e.target.closest('[data-del]');
    if (b) {
      const l = Wrong.list().filter(x => x.id !== b.dataset.del); Wrong.save(l);
      toast('已删除'); if (S.tab === 'review') screenReview(); else screenWrongBook();
    }
  });

  /* ================= 模式6 背诵检测 ================= */
  function screenRecite(preset, onDone) {
    if (preset) { renderRecite(preset.ref, preset.kind); S._reciteDone = onDone; return; }
    let html = `<div class="card"><h3>🎤 背诵检测</h3><div class="muted">选一篇，先自己背一遍，再点"我背完了"。背得流利完整，额外 +⭐1。</div></div>`;
    html += `<div class="card"><h3>古诗（要求背诵/默写）</h3><div class="grid">` +
      CN.poems.map((p, i) => `<button class="btn ghost sm" data-p="${i}">${esc(p.title)}　${esc(p.author)}</button>`).join('') + `</div></div>`;
    html += `<div class="card"><h3>课文 / 段落</h3><div class="grid">` +
      CN.recite.map((p, i) => `<button class="btn ghost sm" data-r="${i}">${esc(p.title)}　<span class="tag ${p.level === '重点' ? 'r' : 'o'}">${esc(p.level)}</span></button>`).join('') + `</div></div>`;
    view.innerHTML = html;
    view.querySelectorAll('[data-p]').forEach(b => b.onclick = () => renderRecite(CN.poems[Number(b.dataset.p)], 'poem'));
    view.querySelectorAll('[data-r]').forEach(b => b.onclick = () => renderRecite(CN.recite[Number(b.dataset.r)], 'text'));
  }
  function renderRecite(item, kind) {
    S.rec = { item: item, kind: kind, show: false };
    const isPoem = kind === 'poem';
    let html = `<div class="row" style="margin-bottom:10px"><button class="btn gray sm" onclick="WB_APP.goBack()">← 返回</button>
      <b>${esc(isPoem ? item.title + '　' + item.author : item.title)}</b>
      ${isPoem ? `<span class="tag">${esc(item.unit || '')}</span>` : `<span class="tag ${item.level === '重点' ? 'r' : 'o'}">${esc(item.level)}</span>`}</div>`;
    html += `<div class="card">
      <h3>🎤 先自己背一遍</h3>
      <div class="muted">${isPoem ? '背完可以对照原文检查，注意题目和作者也要记住哦。' : '背完再对照原文，卡顿的地方多读两遍。'}</div>
      <div class="row" style="margin-top:12px">
        <button class="btn ghost" id="btnTip">💡 给点提示</button>
        <button class="btn ghost" id="btnShow">📖 看原文</button>
        ${isPoem ? `<button class="btn gray sm" id="btnRead">🔊 听一遍</button>` : ''}
      </div>
      <div id="tipArea" class="hidden hintbox">${esc(item.tip)}</div>
      <div id="textArea" class="hidden answer" style="white-space:pre-wrap">${esc(isPoem ? item.text : (item.tip || ''))}</div>
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
      <div class="muted">背完了，给自己打个分：</div>
      <div class="row" style="margin-top:8px">
        <button class="btn ok" data-lv="good">😃 流利完整，没卡顿</button>
        <button class="btn warn" data-lv="mid">🙂 有点卡顿，基本背出</button>
        <button class="btn bad" data-lv="bad">😅 还不会，需要再读</button>
      </div></div>`;
    view.innerHTML = html;
    $('#btnTip').onclick = () => $('#tipArea').classList.toggle('hidden');
    $('#btnShow').onclick = () => $('#textArea').classList.toggle('hidden');
    const br = $('#btnRead'); if (br) br.onclick = () => speak(item.title + '。' + item.text, 'zh-CN');
    view.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => {
      const lv = b.dataset.lv;
      let msg = '', add = 0;
      if (lv === 'good') { msg = '👏 背得又流利又完整，额外奖励 ⭐1 颗！'; add = 1; }
      else if (lv === 'mid') { msg = '不错哦，卡顿的地方再读两遍，下次一定更流利！'; }
      else { msg = '没关系，先跟着原文读三遍，明天再来背一次～（已加入背诵复习清单）'; }
      if (add) { Stars.add(add, '背诵流利完成：' + (item.title || '')); const ss = ensureSession('extra'); ss.extra += add; refreshStars(); }
      if (lv !== 'good') {
        const due = Store.get('recite_due', []);
        if (!due.some(x => x.title === item.title)) { due.push({ title: item.title, kind: kind, date: DateUtil.today(), next: DateUtil.addDays(DateUtil.today(), 3) }); Store.set('recite_due', due); }
      }
      modal(`<h3>背诵检测</h3><p>${msg}</p><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" onclick="WB_APP.closeModal()">好</button></div>`);
      if (S._reciteDone) { const cb = S._reciteDone; S._reciteDone = null; cb(); }
      else setTimeout(() => screenRecite(), 300);
    });
  }

  /* ================= 星星与奖励 ================= */
  function screenStars() {
    const total = Stars.total();
    const rw = Settings.get().rewards || WB.defaultRewards;
    const next = rw.filter(r => r.star > total).sort((a, b) => a.star - b.star)[0];
    const prev = rw.filter(r => r.star <= total).sort((a, b) => b.star - a.star)[0];
    let html = `<div class="card"><h3>⭐ 星星总台账</h3>
      <div class="starbox"><span class="bigstar">🌟</span><div><div class="stars-big">${total} 颗</div>
      <div class="muted">${next ? '再得 ' + (next.star - total) + ' 颗就可以兑换：' + next.name : '所有奖励都解锁啦，真棒！'}</div>
      <div class="progress" style="max-width:420px"><i style="width:${Math.round((prev ? total / next.star * 100 : 0) || 0)}%"></i></div></div></div></div>`;
    html += `<div class="card"><h3>🎁 兑换奖励　<button class="btn gray sm" id="btnEditRw">家长修改清单</button></h3>`;
    rw.forEach(r => {
      const can = total >= r.star;
      html += `<div class="reward ${can ? 'can' : ''}" style="margin-bottom:10px">
        <div><b>⭐ ${r.star} 颗</b>　${esc(r.name)}</div>
        <button class="btn sm ${can ? 'warn' : 'gray'}" data-buy="${r.star}" data-name="${esc(r.name)}" ${can ? '' : 'disabled'}>${can ? '兑换' : '还差 ' + (r.star - total) + ' 颗'}</button></div>`;
    });
    html += `</div>`;
    html += `<div class="card"><h3>📜 星星记录</h3>`;
    const hs = Stars.history();
    if (!hs.length) html += `<div class="muted">还没有记录，完成一次学习就有星星啦！</div>`;
    else html += `<table><thead><tr><th>时间</th><th>变化</th><th>说明</th><th>累计</th></tr></thead><tbody>` +
      hs.map(h => `<tr><td>${h.date} ${h.time}</td><td style="color:${h.delta >= 0 ? 'var(--ok)' : 'var(--bad)'};font-weight:700">${h.delta >= 0 ? '+' : ''}${h.delta}</td><td>${esc(h.reason)}</td><td>⭐${h.total}</td></tr>`).join('') + `</tbody></table>`;
    html += `</div>`;
    html += `<div class="card"><h3>📖 星星规则</h3><div class="muted" style="font-size:14px">
      完成一次平日 20 分钟任务 ⭐2　·　周末 60 分钟任务 ⭐5<br>
      听写/默写全对 +⭐1（错 1～2 个不加不减，错 3 个及以上不额外加分）<br>
      错题重做全对，每道 +⭐0.5　·　流利完整背诵 +⭐1　·　认真思考可酌情 +⭐1<br>
      中途放弃本次不得星；敷衍乱写 −⭐1；多次提醒仍走神 −⭐1（最低 0 颗，不会出现负数）</div></div>`;
    view.innerHTML = html;
    $('#btnEditRw').onclick = editRewards;
    view.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const star = Number(b.dataset.buy), name = b.dataset.name;
      modal(`<h3>确认兑换？</h3><p>用 ⭐${star} 颗兑换：<b>${esc(name)}</b></p>
        <div class="row" style="justify-content:flex-end"><button class="btn gray" onclick="WB_APP.closeModal()">再想想</button>
        <button class="btn warn" id="buyOk">确认兑换</button></div>`);
      $('#buyOk').onclick = () => { Stars.add(-star, '兑换奖励：' + name); refreshStars(); closeModal(); toast('兑换成功！🎉', 3000); screenStars(); };
    });
  }
  function editRewards() {
    const rw = Settings.get().rewards || WB.defaultRewards;
    modal(`<h3>修改兑换清单</h3><div class="muted">每行一条，格式：星星数=奖励内容</div>
      <textarea class="ans" id="rwTxt" style="min-height:180px">${esc(rw.map(r => r.star + '=' + r.name).join('\n'))}</textarea>
      <div class="row" style="justify-content:flex-end;margin-top:12px">
        <button class="btn gray" onclick="WB_APP.closeModal()">取消</button>
        <button class="btn" id="rwSave">保存</button></div>`);
    $('#rwSave').onclick = () => {
      const lines = $('#rwTxt').value.split('\n').map(x => x.trim()).filter(Boolean);
      const arr = lines.map(l => { const p = l.split(/[=＝]/); return { star: Number(p[0].replace(/[^\d]/g, '')) || 0, name: (p[1] || '').trim() }; }).filter(x => x.star > 0 && x.name);
      const s = Settings.get(); s.rewards = arr; Settings.set(s);
      closeModal(); toast('兑换清单已更新'); screenStars();
    };
  }

  /* ================= 错题本 ================= */
  function screenWrongBook() {
    const l = Wrong.list();
    let html = `<div class="card"><h3>📕 错题知识库</h3>
      <div class="muted">共 ${l.length} 题待复习，已掌握 ${Wrong.masteredCount()} 题。复习节奏：做错 → 3 天后 → 再对 → 7 天后 → 再对 → 出库。</div>
      <div class="row" style="margin-top:10px"><button class="btn ok sm" onclick="WB_APP.tab('review')">去复习到期的错题</button>
      <button class="btn gray sm" id="btnClearW">清空错题本</button></div></div>`;
    html += wrongTable(l, '全部错题');
    view.innerHTML = html;
    $('#btnClearW').onclick = () => {
      modal(`<h3>确定清空错题本？</h3><p class="muted">清空后这些题目不会再安排复习。</p>
        <div class="row" style="justify-content:flex-end"><button class="btn gray" onclick="WB_APP.closeModal()">取消</button>
        <button class="btn bad" id="cwOk">确定清空</button></div>`);
      $('#cwOk').onclick = () => { Wrong.clear(); closeModal(); screenWrongBook(); };
    };
  }

  /* ================= 设置 ================= */
  function screenSettings() {
    const s = Settings.get();
    let html = `<div class="card"><h3>⚙️ 设置</h3>
      <div class="row" style="margin-bottom:8px">孩子昵称：<input class="ans" id="fName" style="width:160px" value="${esc(s.childName)}"></div>
      <div class="row" style="margin-bottom:8px">平日单次时长（分钟）：<input class="ans" id="fWd" style="width:100px" value="${s.weekdayMinutes}">
        周末单次时长（分钟）：<input class="ans" id="fWe" style="width:100px" value="${s.weekendMinutes}"></div>
      <div class="row" style="margin-bottom:8px">学习第 <input class="ans" id="fRest" style="width:80px" value="${s.restAt}"> 分钟提醒休息，
        休息 <input class="ans" id="fRestM" style="width:80px" value="${s.restMinutes}"> 分钟</div>
      <div class="row" style="margin-bottom:8px">家长企微群机器人 Webhook：<input class="ans wide" id="fHook" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." value="${esc(s.webhook)}"></div>
      <div class="muted">ℹ️ 浏览器直接推送可能被跨域拦截；失败时请点"复制小结"手动发到群里，或用 tools/wecom_push.js 命令行推送。</div>
      <div class="row" style="margin-top:12px"><button class="btn" id="btnSave">保存设置</button>
        <button class="btn ghost" id="btnTest">测试推送</button>
        <button class="btn gray" id="btnExport">导出数据</button>
        <button class="btn bad" id="btnReset">清空全部数据</button></div></div>`;
    html += `<div class="card"><h3>📚 教材版本</h3><div class="muted">${esc(s.versions.cn)}　|　${esc(s.versions.math)}　|　${esc(s.versions.en)}</div>
      <div class="muted" style="margin-top:6px">题目严格按四上课标出题，不超纲；数学只使用算术方法，不使用方程。</div></div>`;
    view.innerHTML = html;
    $('#btnSave').onclick = () => {
      const n = Settings.get();
      n.childName = $('#fName').value.trim() || '小朋友';
      n.weekdayMinutes = Number($('#fWd').value) || 20;
      n.weekendMinutes = Number($('#fWe').value) || 60;
      n.restAt = Number($('#fRest').value) || 15;
      n.restMinutes = Number($('#fRestM').value) || 2;
      n.webhook = $('#fHook').value.trim();
      Settings.set(n); toast('设置已保存'); screenSettings();
    };
    $('#btnTest').onclick = () => {
      const s2 = Settings.get();
      if (!s2.webhook) { toast('请先填写 webhook 地址'); return; }
      Summary.push('**测试消息**\n学习工作台已连接成功，之后每次学习结束都会把小结推送到这里。', (ok, m) => toast(ok ? '推送成功' : m));
    };
    $('#btnExport').onclick = () => {
      const data = { stars: Stars.data(), wrongs: Wrong.list(), mastered: Store.get('mastered', []), logs: Log.list(), settings: Settings.get() };
      modal(`<h3>导出数据</h3><div class="muted">复制下面内容保存，或用于备份。</div>
        <textarea class="ans" style="min-height:220px">${esc(JSON.stringify(data, null, 2))}</textarea>
        <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" onclick="WB_APP.closeModal()">关闭</button></div>`);
    };
    $('#btnReset').onclick = () => {
      modal(`<h3>确定清空全部数据？</h3><p class="muted">星星、错题、学习记录都会被清空，且无法恢复。</p>
        <div class="row" style="justify-content:flex-end"><button class="btn gray" onclick="WB_APP.closeModal()">取消</button>
        <button class="btn bad" id="rsOk">确定清空</button></div>`);
      $('#rsOk').onclick = () => { ['stars', 'wrongs', 'mastered', 'logs', 'settings'].forEach(k => Store.del(k)); closeModal(); refreshStars(); toast('已清空'); screenSettings(); };
    };
  }

  /* ================= 结算 & 推送 ================= */
  function openSettle(kind) {
    const p = kind === 'weekend' ? ensureWeekendPlan() : ensureDailyPlan();
    const must = p.tasks.filter(t => t.must);
    const done = must.filter(t => p.done[t.id]).length;
    const ratio = must.length ? done / must.length : 0;
    let base = 0, tip = '';
    if (kind === 'weekend') {
      if (ratio >= 1) { base = 5; tip = '完成全部周末任务'; }
      else if (ratio >= 0.6) { base = 3; tip = '完成大部分周末任务'; }
      else { base = 0; tip = '今天只完成了一小部分，下次我们早点开始～'; }
    } else {
      if (ratio >= 1) { base = 2; tip = '完成全部必做任务'; }
      else if (ratio >= 0.6) { base = 1; tip = '完成大部分必做任务'; }
      else { base = 0; tip = '今天还没怎么开始，明天继续加油！'; }
    }
    const ss = ensureSession(kind);
    modal(`<h3>🏁 学习结算</h3>
      <p>必做任务完成：<b>${done} / ${must.length}</b> 项　·　${esc(tip)}</p>
      <table><tbody>
        <tr><td>任务基础星</td><td><b>⭐ ${base}</b></td></tr>
        <tr><td>听写 / 背诵 / 错题等额外奖励</td><td><b>⭐ ${ss.extra}</b></td></tr>
      </tbody></table>
      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
      <div><label><input type="checkbox" id="cbSerious"> 今天主动认真思考、不浮躁（+⭐1）</label></div>
      <div><label><input type="checkbox" id="cbCare"> 做题敷衍、随便乱写（−⭐1）</label></div>
      <div><label><input type="checkbox" id="cbDis"> 多次提醒仍然走神（−⭐1）</label></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px">
        <button class="btn gray" onclick="WB_APP.closeModal()">还没结束</button>
        <button class="btn ok" id="btnOk">确定，生成小结</button></div>`);
    $('#btnOk').onclick = () => {
      let adj = 0, notes = [];
      if ($('#cbSerious').checked) { adj += 1; notes.push('认真思考 +1'); }
      if ($('#cbCare').checked) { adj -= 1; notes.push('做题敷衍 −1'); }
      if ($('#cbDis').checked) { adj -= 1; notes.push('走神 −1'); }
      const delta = base + ss.extra + adj;
      Stars.add(delta, (kind === 'weekend' ? '周末专项' : '每日任务') + '：' + tip + (notes.length ? '（' + notes.join('，') + '）' : ''));
      refreshStars();
      const summary = Summary.build({
        mode: kind === 'weekend' ? '模式2 周末专项（60 分钟）' : '模式1 每日任务（20 分钟）',
        minutes: kind === 'weekend' ? Settings.get().weekendMinutes : Settings.get().weekdayMinutes,
        tasks: must.map(t => ({ text: t.text, done: !!p.done[t.id] })),
        detail: `必做完成 ${done}/${must.length} 项；做错的题目 ${ss.wrongs.length} 道，已存入错题知识库。`,
        wrongs: ss.wrongs, delta: delta,
        note: delta >= 2 ? '今天特别认真，继续加油！' : (delta > 0 ? '有进步，保持住！' : '没关系，明天我们早点开始～')
      });
      Log.add({ mode: kind, done: done, total: must.length, delta: delta, wrongs: ss.wrongs.length });
      S.session = null;
      stopClock();
      modal(`<h3>🎉 本次获得 ⭐ ${delta} 颗，累计 ⭐ ${Stars.total()} 颗</h3>
        <div class="muted">${delta >= 2 ? '太棒啦！今天认真完成任务，继续加油！' : (delta > 0 ? '不错哦，明天再接再厉！' : '明天我们早点开始，多拿几颗星星～')}</div>
        <textarea class="ans" id="sumTxt" style="min-height:200px;margin-top:10px">${esc(summary)}</textarea>
        <div class="row" style="justify-content:flex-end;margin-top:10px">
          <button class="btn gray" id="btnCopy">📋 复制小结</button>
          <button class="btn" id="btnPush">📤 推送到家长企微群</button>
          <button class="btn ok" onclick="WB_APP.closeModal()">完成</button></div>
        <div class="muted" id="pushTip" style="margin-top:8px"></div>`);
      $('#btnCopy').onclick = () => {
        const ta = $('#sumTxt'); ta.select();
        try { document.execCommand('copy'); toast('已复制，去企微群粘贴发送吧'); } catch (e) { toast('请手动选中复制'); }
      };
      $('#btnPush').onclick = () => {
        $('#pushTip').textContent = '正在推送…';
        Summary.push(summary, (ok, m) => { $('#pushTip').textContent = (ok ? '✅ ' : '⚠️ ') + m; toast(ok ? '推送成功' : '推送失败，可改用复制', 3000); });
      };
    };
  }

  /* ================= 标签页 ================= */
  const TABS = [
    { key: 'daily', name: '📅 每日任务' }, { key: 'weekend', name: '🎯 周末专项' },
    { key: 'dictation', name: '✍️ 听写默写' }, { key: 'practice', name: '📝 刷题练习' },
    { key: 'review', name: '🔁 错题复习' }, { key: 'recite', name: '🎤 背诵检测' },
    { key: 'stars', name: '⭐ 星星与奖励' }, { key: 'wrongbook', name: '📕 错题本' }
  ];
  function renderTabs() {
    $('#tabs').innerHTML = TABS.map(t => `<button class="tab ${S.tab === t.key ? 'on' : ''}" data-tab="${t.key}">${t.name}</button>`).join('');
    $('#tabs').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => tab(b.dataset.tab));
  }
  function tab(key) {
    clearSpeak();
    S.tab = key; renderTabs();
    if (key === 'daily') screenDaily();
    else if (key === 'weekend') screenWeekend();
    else if (key === 'dictation') screenDictationMenu();
    else if (key === 'practice') screenPractice();
    else if (key === 'review') screenReview();
    else if (key === 'recite') screenRecite();
    else if (key === 'stars') screenStars();
    else if (key === 'wrongbook') screenWrongBook();
    window.scrollTo(0, 0);
  }

  /* ================= 对外接口 ================= */
  window.WB_APP = {
    tab: tab,
    closeModal: closeModal,
    endRest: function () { if (S.timer && S.timer.resting) { S.timer.restLeft = 0; } closeModal(); },
    goBack: function () { clearSpeak(); if (S.back) { const b = S.back; S.back = null; b(); } else tab(S.tab); },
    dicBack: function () { clearSpeak(); if (S.dic && S.dic.onDone) { const cb = S.dic.onDone; S.dic = null; cb(); } else { S.dic = null; tab('dictation'); } }
  };

  /* ================= 初始化 ================= */
  function init() {
    const s = Settings.get();
    $('#versionLine').textContent = s.versions.cn + ' · ' + s.versions.math + ' · ' + s.versions.en;
    $('#btnSettings').onclick = () => { S.tab = ''; renderTabs(); screenSettings(); };
    refreshStars();
    // 周末自动进入周末专项
    tab(DateUtil.isWeekend() ? 'weekend' : 'daily');
    // 到期错题提醒
    const due = Wrong.due().length;
    if (due) setTimeout(() => toast('🔁 今天有 ' + due + ' 道错题到期，记得去"错题复习"看看', 4000), 1200);
  }
  init();
})();
