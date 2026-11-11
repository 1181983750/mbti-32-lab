(() => {
  'use strict';
  const data = window.MBTI_DATA, rules = window.MBTI_RULES, main = document.querySelector('#main');
  const STORE_KEY = 'personality-journal:answers:v3', ACCESS_KEY = 'personality-journal:access:v2';
  const questionCount = data.questions.length;
  let state = restore(), unlocked = restoreAccess(), transitioning = false, transitionId = 0, activeAnimation;
  let toastTimer, lastFocus, filter = 'all', subtypeFilter = 'all';
  const icon = (name, attributes = '') => `<i data-lucide="${name}" ${attributes}></i>`;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  function icons() { window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } }); }
  function blank() { return { version: 3, step: 0, answers: Array(questionCount).fill(null), tieBreaks: {} }; }
  function primaryDone(answers = state.answers) { return answers.every(value => Number.isInteger(value) && value >= -2 && value <= 2); }
  function axes(answers = state.answers) { return rules.analyze(data.questions, data.dimensions, answers); }
  function tiedDimensions(answers = state.answers) { return primaryDone(answers) ? axes(answers).filter(axis => axis.score === 0).map(axis => data.dimensions.find(dimension => dimension.key === axis.key)) : []; }
  function evaluation() { return rules.evaluate(data.questions, data.dimensions, state.answers, state.tieBreaks); }
  function complete() { return primaryDone() && evaluation().code !== null; }
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved?.version !== 3 || !Number.isInteger(saved.step) || saved.step < 0 || !Array.isArray(saved.answers) || saved.answers.length !== questionCount || saved.answers.some(value => value !== null && (!Number.isInteger(value) || value < -2 || value > 2)) || !saved.tieBreaks || typeof saved.tieBreaks !== 'object' || Array.isArray(saved.tieBreaks)) return blank();
      const gap = saved.answers.indexOf(null);
      if (gap !== -1) { saved.answers.fill(null, gap); saved.tieBreaks = {}; saved.step = Math.min(saved.step, gap); return saved; }
      const tied = tiedDimensions(saved.answers), cleaned = {}; let firstGap = false;
      for (const dimension of tied) {
        const choice = saved.tieBreaks[dimension.key];
        if (choice !== dimension.left && choice !== dimension.right) firstGap = true;
        if (!firstGap) cleaned[dimension.key] = choice;
      }
      saved.tieBreaks = cleaned;
      const firstMissing = tied.findIndex(dimension => !cleaned[dimension.key]);
      const lastStep = questionCount + tied.length - 1;
      saved.step = Math.min(saved.step, firstMissing < 0 ? lastStep : questionCount + firstMissing);
      return saved;
    } catch { return blank(); }
  }
  function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }
  function restoreAccess() { try { return sessionStorage.getItem(ACCESS_KEY) === 'unlocked'; } catch { return false; } }
  function route() { return location.hash.slice(1) || (complete() ? 'result' : 'quiz'); }
  function navigate(target) { if (location.hash === '#' + target) { cancelTransition(); render(true); } else location.hash = target; }
  function profileStyle(profile) { const group = data.groups[profile.group]; return `--type-color:${group.color};--type-bg:${group.bg}`; }
  function clearToast() { clearTimeout(toastTimer); document.querySelector('#toast').classList.remove('visible'); }
  function toast(message) { const node = document.querySelector('#toast'); clearToast(); node.textContent = message; node.classList.add('visible'); toastTimer = setTimeout(() => node.classList.remove('visible'), 2600); }
  function heading(title, section, aside = '') { return `<div class="page-heading"><div><div class="eyebrow">人格研究所<span>/</span>${section}</div><h1>${title}</h1></div>${aside ? `<div class="heading-aside">${aside}</div>` : ''}</div>`; }
  function render(animate = false, focus = false) {
    document.querySelector('.main-nav').hidden = !unlocked;
    if (!unlocked) { renderGate(); icons(); document.title = 'MBTI 32型人格测试 · 访问验证'; return; }
    let view = route();
    if (!['quiz', 'types', 'result'].includes(view) || view === 'result' && !complete()) { view = 'quiz'; history.replaceState(null, '', '#quiz'); }
    document.querySelectorAll('[data-nav]').forEach(node => { const active = node.dataset.nav === (view === 'types' ? 'types' : 'quiz'); node.classList.toggle('active', active); if (active) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
    if (view === 'quiz') renderQuiz();
    if (view === 'types') renderTypes();
    if (view === 'result') renderResult();
    icons();
    main.querySelectorAll('[data-filter]').forEach(tab => { tab.tabIndex = tab.dataset.filter === filter ? 0 : -1; });
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) main.animate([{ opacity: .5 }, { opacity: 1 }], { duration: 210 });
    if (focus) main.querySelector('.question-title, h1')?.focus({ preventScroll: true });
    document.title = view === 'result' ? `${evaluation().code} · 我的人格档案` : 'MBTI 32型人格测试 · 人格研究所';
  }
  function renderGate() {
main.innerHTML = `<div class="gate-layout"><div class="gate-art"><img src="assets/journal.jpg" alt="钢笔在笔记本上书写的特写" width="460" height="300"><div class="photo-caption"><strong>一页关于自己的记录</strong><span>ISSUE 032</span></div></div><section class="gate-copy" aria-labelledby="access-title"><div class="eyebrow">PERSONALITY JOURNAL<span>/</span>32型人格档案</div><h1 id="access-title">MBTI 人格测试<br><em>遇见，更完整的你。</em></h1><p class="gate-summary">在人群与独处、事实与想象之间，<br>看看你习惯怎样理解世界，怎样成为自己。</p><div class="gate-meta"><span>${icon('list-checks')}${questionCount} 道题</span><span>${icon('clock-3')}约 3–5 分钟</span><span>${icon('fingerprint')}32 种类型</span></div><form class="access-form" id="access-form" novalidate><label for="access-code">四位访问码</label><div class="input-wrap"><input id="access-code" type="password" name="access-code" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="输入访问码" aria-describedby="access-error" required><button type="button" class="text-button" data-action="toggle-code" aria-label="显示访问码" title="显示访问码" aria-pressed="false">${icon('eye')}</button></div><p class="access-error" id="access-error" role="alert"></p><button class="button primary" type="submit">开启我的人格档案${icon('arrow-right')}</button></form><p class="gate-note">自我探索趣味问卷 · 非官方 MBTI® 量表</p></section></div>`;
  }
  function unlock(event) {
    event.preventDefault(); const input = document.querySelector('#access-code'), error = document.querySelector('#access-error');
    if (input.value !== '9898') { input.setAttribute('aria-invalid', 'true'); error.textContent = input.value.length !== 4 ? '请输入四位数字访问码。' : '访问码不正确，请再试一次。'; input.focus(); input.select(); return; }
    unlocked = true; try { sessionStorage.setItem(ACCESS_KEY, 'unlocked'); } catch {}
    history.replaceState(null, '', complete() ? '#result' : '#quiz'); render(true, true);
  }
  function cancelTransition() { transitionId++; activeAnimation?.cancel(); activeAnimation = null; transitioning = false; }
  async function changeQuestion(nextStep, direction = 1, showSelection = false) {
    if (transitioning || !unlocked || route() !== 'quiz') return;
    transitioning = true;
    const id = ++transitionId, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, outgoing = main.querySelector('.question-surface');
    outgoing.inert = true; outgoing.setAttribute('aria-busy', 'true');
    try {
      if (!reduced) {
        activeAnimation = outgoing.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-16 * direction}px)` }], { delay: showSelection ? 150 : 0, duration: 130, easing: 'ease-in', fill: 'forwards' });
        await activeAnimation.finished;
      }
      if (id !== transitionId || route() !== 'quiz') return;
      if (nextStep === 'result') { navigate('result'); return; }
      state.step = nextStep; persist(); render(false, true);
      const incoming = main.querySelector('.question-surface'); incoming.inert = true;
      if (!reduced) {
        activeAnimation = incoming.animate([{ opacity: 0, transform: `translateX(${16 * direction}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 200, easing: 'ease-out' });
        await activeAnimation.finished;
      }
      if (id === transitionId) { incoming.inert = false; incoming.querySelector('.question-title')?.focus({ preventScroll: true }); }
    } catch (error) { if (error.name !== 'AbortError') throw error; }
    finally { if (id === transitionId) { transitioning = false; activeAnimation = null; } }
  }
  function currentAnswer() { const dimension = tiedDimensions()[state.step - questionCount]; return state.step < questionCount ? state.answers[state.step] : state.tieBreaks[dimension?.key] ?? null; }
  function next(showSelection = false) {
    if (transitioning || currentAnswer() === null || !unlocked || route() !== 'quiz') return;
    const finalStep = questionCount + tiedDimensions().length - 1;
    changeQuestion(state.step === finalStep ? 'result' : state.step + 1, 1, showSelection);
  }
  function selectAnswer(value) {
    if (transitioning || !unlocked || route() !== 'quiz') return;
    if (state.step < questionCount) {
      const number = Number(value); if (!data.scale.some(item => item.value === number)) return;
      state.answers[state.step] = number; state.tieBreaks = {};
    } else {
      const dimension = tiedDimensions()[state.step - questionCount];
      if (!dimension || ![dimension.left, dimension.right].includes(value)) return;
      state.tieBreaks[dimension.key] = value;
    }
    persist(); render(); main.querySelector(`[data-answer="${value}"]`)?.focus({ preventScroll: true }); next(true);
  }
  function renderQuiz() {
    const step = state.step, isTie = step >= questionCount, tied = tiedDimensions(), dimension = tied[step - questionCount];
    const selected = currentAnswer(), text = isTie ? dimension.tie : data.questions[step].text;
    const completed = state.answers.filter(value => value !== null).length;
    const fraction = isTie ? `补充 <b>${step - questionCount + 1}</b> / ${tied.length}` : `<b>${String(step + 1).padStart(2, '0')}</b> / ${questionCount}`;
    const selectedText = selected === null ? '尚未选择' : isTie ? '已选择 ' + selected : data.scale.find(item => item.value === selected).text;
    const options = isTie ? [dimension.left, dimension.right].map((value, index) => ({ value, text: dimension.choices[index] })) : data.scale;
    main.innerHTML = heading('MBTI <em>32型</em>人格测试', '偏好探索 · 自我记录', `<strong>${questionCount} 道生活情境</strong><br>五个维度，一份关于自己的观察`) + `<div class="quiz-layout"><aside class="quiz-sidebar" aria-label="答题概况"><img class="journal-photo" src="assets/journal.jpg" alt="钢笔在笔记本上书写的特写" width="196" height="132"><p class="sidebar-caption">把日常的选择，写成自己的注脚。</p><div class="progress-label"><strong>本次记录</strong><span>${completed} / ${questionCount} 已完成</span></div><div class="overall-track" aria-hidden="true"><span style="width:${completed / questionCount * 100}%"></span></div><div class="dimension-list">${data.dimensions.map(axis => `<div class="dimension-item" style="--axis-color:${axis.color}">${icon(axis.icon)}<div><b>${axis.title}</b><small>${axis.left} ${axis.leftName} / ${axis.right} ${axis.rightName}</small></div></div>`).join('')}</div><div class="sidebar-bottom">一个类型，不是你的全部。</div></aside><section class="question-surface ${isTie ? 'tie-surface' : ''}" aria-labelledby="question-title"><div class="mobile-progress"><span>本次记录</span><b>${completed} / ${questionCount} 已完成${isTie ? ' · 补充选择' : ''}</b></div><div class="question-top"><span class="topic">${icon(isTie ? 'git-compare-arrows' : 'notebook-pen')}${isTie ? dimension.title + ' · 平衡维度' : '生活里的你'}</span><span class="question-counter">${fraction}</span></div><div class="question-track" aria-hidden="true"><span style="width:${isTie ? 100 : (step + 1) / questionCount * 100}%"></span></div><h2 class="question-title" id="question-title" tabindex="-1">${escape(text)}</h2><div class="${isTie ? 'tie-options' : 'scale-options'}" role="group" aria-labelledby="question-title">${options.map(item => `<button class="option ${selected === item.value ? 'selected' : ''}" data-answer="${item.value}" aria-pressed="${selected === item.value}"><span class="choice-circle">${icon('check')}</span><span class="option-label">${escape(item.text)}</span></button>`).join('')}</div><div class="question-controls"><button class="icon-button" data-action="previous" aria-label="上一题" title="上一题" ${step === 0 ? 'disabled' : ''}>${icon('arrow-left')}</button><span class="answer-state" role="status">${selected !== null ? icon('check') : ''}${selectedText}</span>${selected !== null ? `<button class="button secondary continue-button" data-action="next">继续${icon('arrow-right')}</button>` : ''}</div><div class="question-foot"><span>${icon('heart')}没有标准答案，贴近真实的自己就好。</span><button class="text-button" data-action="restart" title="清空答案并重新测试">${icon('rotate-ccw')}重新测试</button></div></section></div>`;
  }
  function renderTypes() {
    const profiles = data.profiles.filter(profile => (filter === 'all' || profile.group === filter) && (subtypeFilter === 'all' || profile.subtype === subtypeFilter));
    main.innerHTML = heading('32 份人格档案，<em>各有光芒。</em>', '人格图鉴') + `<div class="library-top"><p>16 种基础偏好 × 2 种应对风格，没有高低之分。</p><div class="filter-tabs" role="tablist" aria-label="人格分组"><button class="filter-tab" role="tab" aria-selected="${filter === 'all'}" aria-controls="type-grid" data-filter="all">全部 32 型</button>${Object.entries(data.groups).map(([key, group]) => `<button class="filter-tab" role="tab" aria-selected="${filter === key}" aria-controls="type-grid" data-filter="${key}">${group.name}</button>`).join('')}</div></div><div class="library-styles"><div class="subtype-filters" role="group" aria-label="应对风格筛选"><button data-subtype="all" aria-pressed="${subtypeFilter === 'all'}">全部风格</button>${Object.entries(data.subtypes).map(([key, style]) => `<button data-subtype="${key}" aria-pressed="${subtypeFilter === key}" title="${key === 'A' ? '面对压力与评价，更容易保持自我信任' : '面对压力与评价，更敏锐地感知并校准'}">${key} ${style.name}</button>`).join('')}</div><span>${profiles.length} 份档案</span></div><div class="type-grid" id="type-grid" role="tabpanel">${profiles.map(profile => `<article class="type-card" style="${profileStyle(profile)}"><span class="type-icon">${icon(profile.icon)}</span><div class="type-code">${profile.code}</div><h2 class="type-name">${profile.name}</h2><p>${profile.summary}</p><button class="text-button" data-profile="${profile.code}" aria-label="查看 ${profile.code} ${profile.name}">阅读这份人格${icon('arrow-up-right')}</button></article>`).join('')}</div><div class="library-bottom"><button class="button primary" data-action="${complete() ? 'result' : 'quiz'}">${complete() ? '查看我的档案' : '继续我的测试'}${icon('arrow-right')}</button></div><p class="notice">${data.notice} 图鉴分组仅为浏览分类，不代表人格等级。</p>`;
  }
  function openProfile(code) {
    const profile = data.profiles.find(item => item.code === code); if (!profile) return;
    const dialog = document.querySelector('#profile-dialog'); lastFocus = document.activeElement;
    dialog.innerHTML = `<div class="dialog-top"><span class="eyebrow">人格图鉴 / ${data.groups[profile.group].name}</span><button class="icon-button" data-action="close-profile" aria-label="关闭人格介绍" title="关闭">${icon('x')}</button></div><div style="${profileStyle(profile)}"><div class="type-code">${profile.code}</div><h2 id="profile-dialog-title">${profile.name}</h2><p class="profile-summary">${profile.summary}</p><div class="mini-section"><h3>认识这份偏好</h3><p>${profile.portrait}</p></div><div class="mini-section"><h3>常见优势</h3><p>${profile.strengths.join('；')}。</p></div><div class="mini-section"><h3>值得留意</h3><p>${profile.blind}</p></div><div class="mini-section"><h3>成长的一小步</h3><p>${profile.growth}</p></div><p class="notice">${data.notice}</p></div>`;
    icons(); dialog.showModal();
  }
  function renderAxes(evaluation) {
    return evaluation.axes.map((axis, index) => {
      const dimension = data.dimensions[index], choice = axis.pole || state.tieBreaks[axis.key];
      const label = axis.score === 0 ? '主线均衡 · 补充选择 ' + choice : `${choice} ${axis.strength <= 25 ? '轻微倾向' : axis.strength <= 60 ? '较明显倾向' : '明显倾向'}`;
      return `<div class="axis" data-axis="${axis.key}" style="--axis-color:${dimension.color}"><div class="axis-top"><b>${dimension.title}</b><span>${label}</span></div><div class="axis-track" aria-hidden="true"><span class="left" style="width:${axis.leftPercent}%"></span><span class="right" style="width:${axis.rightPercent}%"></span></div><div class="axis-labels"><span class="${choice === dimension.left ? 'chosen' : ''}">${dimension.left} ${dimension.leftName} ${axis.leftPercent}%</span><span class="${choice === dimension.right ? 'chosen' : ''}">${dimension.right} ${dimension.rightName} ${axis.rightPercent}%</span></div><p class="axis-note">${dimension.description}</p></div>`;
    }).join('');
  }
  function renderReview() {
    return data.questions.map((question, index) => {
      const dimension = data.dimensions.find(axis => axis.key === question.dimension), value = state.answers[index], preferred = value === 0 ? null : value > 0 ? question.pole : question.pole === dimension.left ? dimension.right : dimension.left;
      return `<details class="review-item"><summary><span class="review-number">${String(index + 1).padStart(2, '0')}</span><span class="review-title">${question.text}<span class="review-choice">${data.scale.find(item => item.value === value).text}</span></span>${icon('chevron-down')}</summary><div class="review-analysis"><b>${dimension.title} · ${dimension.key}</b><br>${preferred ? `这一题的作答更偏向 ${preferred}（${preferred === dimension.left ? dimension.leftName : dimension.rightName}），倾向权重为 ${Math.abs(value)}。` : '这一题选择居中，对该维度不增加方向权重。'}${dimension.description}</div></details>`;
    }).join('');
  }
  function renderResult() {
    const result = evaluation(), profile = data.profiles.find(item => item.code === result.code);
    main.innerHTML = `<div class="result-page" style="${profileStyle(profile)}"><div class="result-toolbar"><a class="text-button" href="#quiz">${icon('arrow-left')}返回作答</a><span>PERSONALITY JOURNAL / 个人偏好档案</span></div><section class="result-intro" aria-labelledby="result-title"><div><div class="result-kicker">${icon('fingerprint')}本次记录中的你</div><h1 class="result-code" id="result-title" tabindex="-1">${profile.code}</h1><h2 class="result-name">${profile.name}</h2><p class="result-summary">${profile.summary}</p><div class="result-tags">${profile.tags.map(tag => `<span>${tag}</span>`).join('')}</div></div><div class="result-symbol" aria-hidden="true">${icon(profile.icon)}<span>各有自己的光芒</span></div></section><div class="result-actions"><button class="button primary" data-action="download">${icon('download')}保存人格档案</button><button class="button secondary" data-action="review">${icon('list-checks')}查看作答记录</button><button class="icon-button" data-action="restart" title="重新测试" aria-label="重新测试">${icon('rotate-ccw')}</button></div><section class="result-section"><div class="section-heading"><h2><small>01</small>你的五维倾向</h2><span>本次作答倾向</span></div><div class="axes-grid">${renderAxes(result)}</div><p class="score-note">百分比由本次答案的方向权重换算，不是准确率或人口排名。接近 50% 表示偏好较均衡；平分维度保留 50/50，并以补充选择形成类型。${result.axes.some(axis => axis.strength <= 25) ? '你的部分维度接近均衡，情境变化时也可能呈现相邻类型的特点。' : ''}</p></section><section class="result-section"><div class="section-heading"><h2><small>02</small>认识这份偏好</h2></div><p class="result-copy">${profile.portrait}</p><div class="strengths">${profile.strengths.map(text => `<div class="strength">${icon('check')}${text}</div>`).join('')}</div></section><section class="result-section"><div class="section-heading"><h2><small>03</small>在工作与关系里</h2></div><div class="context-grid"><div class="context-item"><h3>${icon('briefcase-business')}适合探索的工作方式</h3><p>${profile.work}</p></div><div class="context-item"><h3>${icon('messages-square')}与人相处的一点提醒</h3><p>${profile.relationship}</p></div></div></section><section class="result-section"><div class="section-heading"><h2><small>04</small>给自己留一点成长空间</h2></div><p class="result-copy">${profile.blind}</p><div class="growth-row"><b>可以尝试的一小步</b><p>${profile.growth}</p></div><p class="result-quote">${profile.quote}</p></section><section class="result-section" id="answer-review"><div class="section-heading"><h2><small>05</small>你的作答记录</h2><button class="text-button" data-action="toggle-reviews">展开全部${icon('chevrons-down')}</button></div><div class="review-list">${renderReview()}</div>${tiedDimensions().length ? `<p class="score-note">补充选择：${tiedDimensions().map(dimension => `${dimension.key} → ${state.tieBreaks[dimension.key]}`).join('；')}。补充选择仅用于形成类型，不改写主线得分。</p>` : ''}</section><p class="notice">${data.notice} 人格偏好可能随情境和经历变化，一个类型也无法概括完整的你。</p><div class="result-bottom"><p>你比一个类型，更丰富。</p><a class="button secondary" href="#types">浏览 32 型图鉴${icon('arrow-up-right')}</a></div></div>`;
  }
  function restart() {
    if (state.answers.every(value => value === null)) { cancelTransition(); state = blank(); persist(); navigate('quiz'); return; }
    lastFocus = document.activeElement; document.querySelector('#restart-dialog').showModal();
  }
  function closeDialog(id) { document.querySelector(id).close(); lastFocus?.focus(); }
  function toggleReviews() {
    const rows = [...main.querySelectorAll('.review-item')], open = rows.some(row => !row.open);
    rows.forEach(row => { row.open = open; }); main.querySelector('[data-action="toggle-reviews"]').innerHTML = (open ? '收起全部' : '展开全部') + icon(open ? 'chevrons-up' : 'chevrons-down'); icons();
  }
  async function downloadResult() {
    const button = main.querySelector('[data-action="download"]'); if (button.disabled) return; button.disabled = true;
    try {
      const result = evaluation(), profile = data.profiles.find(item => item.code === result.code), color = data.groups[profile.group].color;
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
      const width = 1080, pad = 80, blocks = []; canvas.width = width;
      const font = (size, weight) => `${weight} ${size}px "Microsoft YaHei","PingFang SC",sans-serif`;
      function add(text, size = 27, fill = '#56675c', weight = 400, gap = 25) {
        context.font = font(size, weight); const lines = []; let line = '';
        for (const character of text) { if (character === '\n') { lines.push(line); line = ''; continue; } if (line && context.measureText(line + character).width > width - pad * 2) { lines.push(line); line = character; } else line += character; }
        if (line) lines.push(line); blocks.push({ lines, size, fill, weight, gap, lineHeight: Math.ceil(size * 1.8) });
      }
      add('人格研究所 / PERSONALITY JOURNAL', 26, color, 550, 55);
      add(profile.code, 100, color, 700, 0); add(profile.name, 47, '#26332f', 600, 25); add(profile.summary, 29, '#56675c', 400, 35);
      add(profile.tags.join(' · '), 26, color, 550, 50);
      add('我的五维倾向', 32, '#26332f', 600, 20);
      result.axes.forEach((axis, index) => { const dimension = data.dimensions[index]; add(`${dimension.title}：${dimension.left} ${dimension.leftName} ${axis.leftPercent}%  /  ${dimension.right} ${dimension.rightName} ${axis.rightPercent}%${axis.score === 0 ? '  · 补充选择 ' + state.tieBreaks[axis.key] : ''}`, 27, dimension.color, 500, 15); });
      add('百分比为本次答案的倾向换算，不是准确率。', 21, '#7a8580', 400, 40);
      add('认识这份偏好', 32, '#26332f', 600); add(profile.portrait); add('常见优势 · ' + profile.strengths.join('；'));
      add('工作方式', 30, '#26332f', 600, 15); add(profile.work);
      add('与人相处', 30, '#26332f', 600, 15); add(profile.relationship);
      add('值得留意', 30, '#26332f', 600, 15); add(profile.blind); add('成长的一小步 · ' + profile.growth);
      add(profile.quote, 32, color, 550, 45); add(data.notice, 21, '#7a8580', 400, 0);
      canvas.height = pad * 2 + blocks.reduce((height, block) => height + block.lines.length * block.lineHeight + block.gap, 0);
      context.fillStyle = '#f7f8f6'; context.fillRect(0, 0, width, canvas.height); let y = pad;
      for (const block of blocks) { context.font = font(block.size, block.weight); context.fillStyle = block.fill; context.textBaseline = 'top'; for (const line of block.lines) { context.fillText(line, pad, y); y += block.lineHeight; } y += block.gap; }
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Empty image')), 'image/png'));
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `我的人格档案-${profile.code}.png`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); toast('人格档案已生成。');
    } catch { toast('图片暂时无法生成，请稍后重试。'); }
    finally { button.disabled = false; }
  }
  document.addEventListener('submit', event => { if (event.target.id === 'access-form') unlock(event); });
  document.addEventListener('input', event => { if (event.target.id === 'access-code') { event.target.removeAttribute('aria-invalid'); document.querySelector('#access-error').textContent = ''; } });
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!unlocked) {
      if (action === 'toggle-code') { const input = document.querySelector('#access-code'), button = event.target.closest('button'), show = input.type === 'password'; input.type = show ? 'text' : 'password'; button.title = button.ariaLabel = show ? '隐藏访问码' : '显示访问码'; button.setAttribute('aria-pressed', String(show)); button.innerHTML = icon(show ? 'eye-off' : 'eye'); icons(); input.focus(); }
      return;
    }
    if (action === 'close-profile') { closeDialog('#profile-dialog'); return; }
    if (transitioning) return;
    const answer = event.target.closest('[data-answer]'); if (answer) { selectAnswer(answer.dataset.answer); return; }
    const profile = event.target.closest('[data-profile]'); if (profile) { openProfile(profile.dataset.profile); return; }
    const tab = event.target.closest('[data-filter]'); if (tab) { filter = tab.dataset.filter; render(); main.querySelector(`[data-filter="${filter}"]`)?.focus(); return; }
    const subtype = event.target.closest('[data-subtype]'); if (subtype) { subtypeFilter = subtype.dataset.subtype; render(); main.querySelector(`[data-subtype="${subtypeFilter}"]`)?.focus(); return; }
    if (action === 'previous' && state.step > 0) changeQuestion(state.step - 1, -1);
    if (action === 'next') next();
    if (action === 'restart') restart();
    if (action === 'close-dialog') closeDialog('#restart-dialog');
    if (action === 'confirm-restart') { document.querySelector('#restart-dialog').close(); cancelTransition(); state = blank(); persist(); navigate('quiz'); window.scrollTo(0, 0); }
    if (action === 'quiz' || action === 'result') { navigate(action); window.scrollTo(0, 0); }
    if (action === 'download') downloadResult();
    if (action === 'toggle-reviews') toggleReviews();
    if (action === 'review') document.querySelector('#answer-review')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  document.addEventListener('keydown', event => {
    const tab = event.target.closest('[data-filter]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const tabs = ['all', ...Object.keys(data.groups)], current = tabs.indexOf(filter);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      filter = tabs[index]; render(); main.querySelector(`[data-filter="${filter}"]`)?.focus(); return;
    }
    if (!unlocked || transitioning || event.repeat || route() !== 'quiz' || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const key = Number(event.key), keys = state.step < questionCount ? data.scale.map(item => item.value) : (() => { const dimension = tiedDimensions()[state.step - questionCount]; return [dimension.left, dimension.right]; })();
    if (/^[1-5]$/.test(event.key) && keys[key - 1] !== undefined) { event.preventDefault(); selectAnswer(String(keys[key - 1])); }
    if (event.key === 'ArrowLeft' && state.step > 0) { event.preventDefault(); changeQuestion(state.step - 1, -1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
  });
  window.addEventListener('hashchange', () => { cancelTransition(); clearToast(); render(true); window.scrollTo(0, 0); });
  window.addEventListener('storage', event => { if (event.key === STORE_KEY || event.key === null) { cancelTransition(); document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); state = restore(); render(); } });
  if (!location.hash) history.replaceState(null, '', complete() ? '#result' : '#quiz');
  render();
})();
