/* 核心：本地存储 / 星星台账 / 错题知识库（艾宾浩斯） / 计时器 / 小结推送 */
(function () {
  const KEY = 'g4_workbench_';

  // localStorage 不可用时（部分浏览器的 file:// 模式）自动降级为内存存储
  const _mem = {};
  const Store = {
    ok: (function () { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (e) { return false; } })(),
    get(k, d) {
      if (this.ok) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch (e) { } }
      return _mem[k] === undefined ? d : _mem[k];
    },
    set(k, v) {
      _mem[k] = v;
      if (this.ok) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { } }
    },
    del(k) {
      delete _mem[k];
      if (this.ok) { try { localStorage.removeItem(KEY + k); } catch (e) { } }
    }
  };

  /* ---------------- 日期工具 ---------------- */
  const DateUtil = {
    today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    diffDays(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); },
    isWeekend() { const w = new Date().getDay(); return w === 0 || w === 6; },
    weekdayName() { return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][new Date().getDay()]; }
  };

  /* ---------------- 设置 ---------------- */
  const defaultRewards = [
    { star: 10, name: '额外30分钟自由阅读（课外书自选）' },
    { star: 20, name: '周末一次户外游玩（骑行/打球）' },
    { star: 35, name: '自选小文具 / 课外书' },
    { star: 50, name: '一次小愿望（提前和家长约定好）' }
  ];
  const Settings = {
    get() {
      return Object.assign({
        weekdayMinutes: 20, weekendMinutes: 60,
        restAt: 15, restMinutes: 2,
        webhook: '', childName: '小朋友',
        versions: { cn: '语文 部编人教版 四上', math: '数学 人教版 四上', en: '英语 人教PEP 四上' },
        rewards: defaultRewards
      }, Store.get('settings', {}));
    },
    set(v) { Store.set('settings', v); }
  };

  /* ---------------- 星星台账 ---------------- */
  const Stars = {
    data() { return Store.get('stars', { total: 0, history: [] }); },
    total() { return this.data().total; },
    add(n, reason) {
      const d = this.data();
      const before = d.total;
      d.total = Math.max(0, Math.round((d.total + n) * 2) / 2); // 最低 0，不出现负数
      const delta = d.total - before;
      d.history.push({ date: DateUtil.today(), time: new Date().toTimeString().slice(0, 5), delta: delta, reason: reason, total: d.total });
      Store.set('stars', d);
      return delta;
    },
    history() { return this.data().history.slice(-80).reverse(); },
    reset() { Store.set('stars', { total: 0, history: [] }); }
  };

  /* ---------------- 错题知识库（简易艾宾浩斯：3天 / 7天） ---------------- */
  const Wrong = {
    list() { return Store.get('wrongs', []); },
    save(l) { Store.set('wrongs', l); },
    add(item) {
      const l = this.list();
      // 同题不重复入库
      if (l.some(x => x.q === item.q && x.subject === item.subject)) return false;
      const w = {
        id: 'w' + Date.now() + Math.floor(Math.random() * 1000),
        subject: item.subject, unit: item.unit || '', type: item.type || '',
        q: item.q, a: item.a, hint: item.hint || '',
        wrongAnswer: item.wrongAnswer || '',
        created: DateUtil.today(), stage: 0,
        next: DateUtil.addDays(DateUtil.today(), 3),
        reviewCount: 0
      };
      l.push(w); this.save(l); return true;
    },
    // 今天该复习的错题（3天后 / 7天后到期）
    due() {
      const t = DateUtil.today();
      return this.list().filter(w => w.next <= t).sort((a, b) => (a.next < b.next ? -1 : 1));
    },
    // 复习结果：对 → 进入下一阶段（3天→7天→掌握出库）；错 → 回到 3 天后
    mark(id, correct) {
      const l = this.list();
      const w = l.find(x => x.id === id); if (!w) return;
      w.reviewCount++;
      if (correct) {
        w.stage++;
        if (w.stage >= 2) { // 已掌握，出库
          const mastered = Store.get('mastered', []);
          mastered.push(Object.assign({}, w, { masteredAt: DateUtil.today() }));
          Store.set('mastered', mastered);
          l = null;
          this.save(this.list().filter(x => x.id !== id));
          return 'mastered';
        }
        w.next = DateUtil.addDays(DateUtil.today(), w.stage === 1 ? 7 : 3);
        this.save(l); return 'next';
      } else {
        w.stage = 0; w.next = DateUtil.addDays(DateUtil.today(), 3);
        this.save(l); return 'again';
      }
    },
    count() { return this.list().length; },
    masteredCount() { return Store.get('mastered', []).length; },
    clear() { Store.set('wrongs', []); }
  };

  /* ---------------- 学习记录 ---------------- */
  const Log = {
    list() { return Store.get('logs', []); },
    add(rec) { const l = this.list(); l.push(Object.assign({ date: DateUtil.today(), time: new Date().toTimeString().slice(0, 5) }, rec)); Store.set('logs', l); },
    todayLogs() { const t = DateUtil.today(); return this.list().filter(x => x.date === t); }
  };

  /* ---------------- 计时器（含 15 分钟休息提醒） ---------------- */
  function Timer(opts) {
    this.minutes = opts.minutes;
    this.total = opts.minutes * 60;
    this.left = this.total;
    this.restAt = (opts.restAt || 15) * 60;
    this.restMinutes = opts.restMinutes || 2;
    this.onTick = opts.onTick || function () { };
    this.onRest = opts.onRest || function () { };
    this.onEnd = opts.onEnd || function () { };
    this.onRestEnd = opts.onRestEnd || function () { };
    this.elapsed = 0;
    this.rested = false;
    this.running = false;
    this.resting = false;
    this.restLeft = 0;
    this._id = null;
  }
  Timer.prototype.start = function () {
    if (this._id) return;
    this.running = true;
    const self = this;
    this._id = setInterval(function () {
      if (self.resting) {
        self.restLeft--;
        if (self.restLeft <= 0) { self.resting = false; self.rested = true; self.onRestEnd(); }
        else self.onTick(self);
        return;
      }
      self.elapsed++; self.left--;
      if (!self.rested && self.elapsed >= self.restAt && self.left > 60) {
        self.resting = true; self.restLeft = self.restMinutes * 60; self.onRest(self);
      }
      if (self.left <= 0) { self.stop(); self.onEnd(self); }
      else self.onTick(self);
    }, 1000);
  };
  Timer.prototype.stop = function () { if (this._id) { clearInterval(this._id); this._id = null; } this.running = false; };
  Timer.prototype.mmss = function (s) { const m = Math.floor(Math.abs(s) / 60), ss = Math.abs(s) % 60; return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); };

  /* ---------------- 小结 & 企微推送 ---------------- */
  const Summary = {
    build(data) {
      const s = Settings.get();
      const lines = [];
      lines.push('**📚 ' + s.childName + '学习小结｜' + DateUtil.today() + ' ' + DateUtil.weekdayName() + '**');
      lines.push('> 模式：' + (data.mode || '—') + ' ｜ 用时：' + (data.minutes || 0) + ' 分钟');
      if (data.tasks && data.tasks.length) {
        lines.push('**今日任务**');
        data.tasks.forEach(t => lines.push('· ' + (t.done ? '✅' : '⬜') + ' ' + t.text));
      }
      if (data.detail) { lines.push('**学习情况**'); lines.push(data.detail); }
      if (data.wrongs && data.wrongs.length) {
        lines.push('**错题记录（共 ' + data.wrongs.length + ' 题）**');
        data.wrongs.slice(0, 10).forEach(w => lines.push('· 【' + w.subject + '】' + w.q + '  正确答案：' + w.a));
      } else {
        lines.push('**错题记录**：今天没有错题，很棒！');
      }
      lines.push('**本次获得星星**：⭐ ' + (data.delta >= 0 ? '+' : '') + data.delta + ' 颗');
      lines.push('**累计星星**：⭐ ' + Stars.total() + ' 颗');
      if (data.note) lines.push('💬 ' + data.note);
      return lines.join('\n');
    },
    // 浏览器直推企微 webhook（可能被 CORS 拦截，失败时自动降级为"复制"）
    push(markdown, cb) {
      const url = Settings.get().webhook;
      if (!url) { cb && cb(false, '还没有填写企微 webhook 地址'); return; }
      fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgtype: 'markdown', markdown: { content: markdown } })
      }).then(r => r.json().then(j => {
        cb && cb(j.errcode === 0, j.errcode === 0 ? '推送成功' : ('推送失败：' + (j.errmsg || JSON.stringify(j))));
      })).catch(e => { cb && cb(false, '浏览器直连被跨域拦住了，请点"复制小结"手动发送，或用 tools/wecom_push.js 推送'); });
    }
  };

  /* ---------------- 答案比对 ---------------- */
  const Judge = {
    norm(s) {
      return String(s == null ? '' : s)
        .replace(/[\uff01-\uff5e]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)) // 全角转半角
        .replace(/\s+/g, '').replace(/[，。、]/g, '').toLowerCase();
    },
    eq(user, answer) {
      const u = this.norm(user), a = this.norm(answer);
      if (!u) return false;
      if (a.indexOf('|') >= 0) { // 多空题：顺序比对
        const parts = a.split('|').map(x => this.norm(x));
        const up = u.split(/[｜|/、]/).map(x => this.norm(x)).filter(Boolean);
        if (up.length !== parts.length) return u === parts.join('');
        return parts.every((p, i) => up[i] === p);
      }
      return u === a;
    }
  };

  window.WB = { Store, DateUtil, Settings, Stars, Wrong, Log, Timer, Summary, Judge, defaultRewards };
})();
