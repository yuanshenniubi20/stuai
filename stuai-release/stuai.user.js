// ==UserScript==
// @name         STUAI 拓灵AI智能刷课
// @namespace    https://github.com/ocsjs/ocs-desktop
// @version      3.8
// @description  拓灵AI(tuolingai.seentao.com)全自动刷课：自动导航/视频2倍速/测验AI答题/任务切换/卡死恢复/跨页续刷
// @author       ocs-desktop
// @match        https://tuolingai.seentao.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    var CFG = { apiUrl: 'http://localhost:5000/api/answer', speed2x: true, watchInterval: 5000, stuckTimeout: 300000, quizDelay: 1000 };
    try { Object.assign(CFG, JSON.parse(GM_getValue('stuai_config', '{}'))); } catch (e) {}

    var isApiOnline = false, isAnswering = false, autoMode = false, autoAbort = false, autoRunning = false, videoMode = false, videoAbort = false, autoStatus = '', lastUrl = '', stuckCount = 0, logs = [], visitedProjects = [], visitedCourses = [];
    try { visitedProjects = JSON.parse(GM_getValue('stuai_visited', '[]')); } catch (e) { visitedProjects = []; }
    try { visitedCourses = JSON.parse(GM_getValue('stuai_visited_courses', '[]')); } catch (e) { visitedCourses = []; }

    // 持久化项目ID
    function getProjectId() {
        try {
            var pj = JSON.parse(sessionStorage.getItem('projectJson') || sessionStorage.getItem('student_project') || '{}');
            if (pj.dbeProjectId) return 'p' + pj.dbeProjectId;
        } catch (e) {}
        var m = location.href.match(/[?&]id=(\d+)/i) || location.href.match(/[?&]projectId=(\d+)/i);
        if (m) return 'p' + m[1];
        var body = (document.body.innerText || '').slice(0, 200);
        var pm = body.match(/([\u4e00-\u9fff]{3,20})项目简介/);
        if (pm) return 'p_' + pm[1].replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '').slice(0, 20);
        return 'u' + (location.pathname + (document.title || '')).replace(/[^a-zA-Z0-9]/g, '').slice(-20);
    }

    function getCourseId() {
        try {
            var cd = JSON.parse(sessionStorage.getItem('classData') || '{}');
            // 课程级ID：classId + 页面正文中的课程名（区分同班多门课）
            var name = '';
            var body = (document.body.innerText || '').slice(0, 300);
            var nm = body.match(/([\u4e00-\u9fff]{3,20}(?:课程|通识|概论|实训|基础|编程|导学|场景|智能|安全|工程)?)/);
            if (nm) name = nm[1];
            if (cd.classId) return 'c' + cd.classId + (name ? '_' + name : '');
        } catch (e) {}
        var m = location.href.match(/[?&]courseId=(\d+)/i);
        if (m) return 'c' + m[1];
        return 'c_unknown';
    }
    function persistVisited() { GM_setValue('stuai_visited', JSON.stringify(visitedProjects)); }
    function persistVisitedCourses() { GM_setValue('stuai_visited_courses', JSON.stringify(visitedCourses)); }

    function markCourseVisited() {
        var id = getCourseId();
        if (id !== 'c_unknown' && isCourseVisited(id)) return;
        // 附带课程名slug
        try {
            var cd = JSON.parse(sessionStorage.getItem('classData') || '{}');
            if (cd.className) { id = id + '__' + cd.className.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '').slice(0, 30); }
        } catch (e) {}
        visitedCourses.push(id);
        if (visitedCourses.length > 30) visitedCourses.shift();
        persistVisitedCourses();
        console.log('[stuai] markCourseVisited | key=' + id);
    }
    function isCourseVisited(key) {
        for (var i = 0; i < visitedCourses.length; i++) {
            if (visitedCourses[i].indexOf(key) !== -1) return true;
        }
        return false;
    }

    function makeVisitedKey() {
        var id = getProjectId();
        var body = (document.body.innerText || '').slice(0, 200);
        var name = '';
        // 策略1: "XXXX 项目简介"（允许多行）
        var pm = body.match(/([\u4e00-\u9fffA-Za-z0-9]{2,30})\s*项目简介/);
        if (pm) name = pm[1];
        // 策略2: "返回\nXXXX\n" 模式
        if (!name) { var pm2 = body.match(/返回\s+([\u4e00-\u9fffA-Za-z0-9]{2,30})/); if (pm2) name = pm2[1]; }
        // 策略3: "Hi\nXXXX\n" 模式
        if (!name) { var pm3 = body.match(/Hi\s+([\u4e00-\u9fffA-Za-z0-9]{2,30})/); if (pm3) name = pm3[1]; }
        // 策略4: taskTitle 元素
        if (!name) {
            var tt = document.querySelector('[class*="taskTitle"], [class*="projectName"], h1, h2');
            if (tt) name = (tt.textContent || '').trim();
        }
        // 兜底
        if (!name) {
            var cm = body.match(/([\u4e00-\u9fff]{3,})/);
            name = cm ? cm[1] : '';
        }
        var slug = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '').slice(0, 40) || id;
        return id + '__' + slug;
    }
    function hasVisited(idSlugOrProjId) {
        for (var i = 0; i < visitedProjects.length; i++) {
            if (visitedProjects[i].indexOf(idSlugOrProjId) !== -1) return true;
        }
        return false;
    }

    // 样式
    var s = document.createElement('style');
    s.textContent = '.stuai-p{position:fixed;bottom:16px;right:16px;z-index:99999;background:#fff;border:2px solid #6c5ce7;border-radius:12px;padding:12px;width:280px;box-shadow:0 4px 20px rgba(0,0,0,.15);font:13px sans-serif;max-height:85vh;overflow-y:auto}.stuai-p .t{color:#6c5ce7;font-size:14px;font-weight:700;margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid #eee}.stuai-p .s{padding:2px 5px;border-radius:3px;margin:1px 2px;font-size:10px;display:inline-block}.stuai-p .s.ok{background:#e8f5e9;color:#2e7d32}.stuai-p .s.er{background:#ffebee;color:#c62828}.stuai-p .s.at{background:#e3f2fd;color:#1565c0}.stuai-p .s.au{background:#fff3e0;color:#e65100}.stuai-p .b{display:block;width:100%;padding:7px 0;margin:3px 0;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500}.stuai-p .b.p{background:linear-gradient(135deg,#6c5ce7,#a855f7);color:#fff}.stuai-p .b.s{background:#f5f5f5;color:#333}.stuai-p .b:disabled{opacity:.5}.stuai-p .l{max-height:120px;overflow-y:auto;font-size:10px;color:#666;margin-top:6px;border-top:1px solid #eee;padding-top:4px;line-height:1.6;display:flex;flex-direction:column;gap:1px}.stuai-p .f{margin:4px 0}.stuai-p .f input{width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box}';
    document.head.appendChild(s);

    var el = null;

    function log(msg, type) {
        type = type || 'info';
        logs.push({ time: new Date().toLocaleTimeString(), msg: msg, type: type });
        if (logs.length > 40) logs.shift();
        render();
    }

    function render() {
        if (el) el.remove();
        var sc = isAnswering ? 'at' : autoMode ? 'au' : videoMode ? 'ok' : isApiOnline ? 'ok' : 'er';
        var st = isAnswering ? 'AI作答中...' : autoMode ? '自动刷课中...' : videoMode ? '视频托管中...' : isApiOnline ? 'AI已连接' : 'AI未连接';
        el = document.createElement('div');
        el.className = 'stuai-p';
        el.innerHTML = '<div class="t">拓灵AI刷课 v3.3</div>' +
            '<div class="s ' + sc + '">' + st + (autoStatus ? ' - ' + autoStatus : '') + '</div>' +
            '<div class="f"><input id="stuai-cfg-api" value="' + esc(CFG.apiUrl) + '" placeholder="AI接口地址"></div>' +
            '<div class="f"><label style="font-size:11px;display:flex;align-items:center;gap:4px;margin:2px 0"><input type="checkbox" id="stuai-cfg-speed" ' + (CFG.speed2x ? 'checked' : '') + '> 视频2倍速</label></div>' +
            '<button class="b p" id="stuai-answer">' + (isAnswering ? '停止答题' : 'AI答题当前页') + '</button>' +
            '<button class="b p" id="stuai-auto">' + (autoMode ? '停止自动刷课' : '开始自动刷课') + '</button>' +
            '<button class="b p" id="stuai-video" style="background:linear-gradient(135deg,#00b894,#00cec9);color:#fff">' + (videoMode ? '停止视频托管' : '开始视频托管') + '</button>' +
            '<button class="b s" id="stuai-check">' + (isApiOnline ? 'AI已连接' : '检测AI服务') + '</button>' +
            '<button class="b s" id="stuai-reset" style="color:#c62828">重置进度记录</button>' +
            '<div class="l">' + logs.slice(-6).map(function (l) { return '<span class="s ' + l.type + '">[' + l.time + '] ' + l.msg + '</span>'; }).join('') + '</div>';
        document.body.appendChild(el);
        document.getElementById('stuai-answer').onclick = answerCurrentQuiz;
        document.getElementById('stuai-auto').onclick = toggleAuto;
        document.getElementById('stuai-video').onclick = toggleVideo;
        document.getElementById('stuai-check').onclick = checkAPI;
        document.getElementById('stuai-reset').onclick = function () { stopAuto(); stopVideo(); visitedProjects = []; visitedCourses = []; persistVisited(); persistVisitedCourses(); log('进度记录已重置（自动刷课已暂停，请手动重新开启）', 'info'); };
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    // ====== 按钮工具 ======
    function findBtn(text, exact) {
        var btns = document.querySelectorAll('button, a[class*="btn"], [class*="finishBtn"], [class*="rightBtn"], [class*="leftBtn"], div[class*="footer"] button, div[class*="footer"] div[class*="btn"], div[class*="actions"] button, div[class*="actions"] div[class*="btn"]');
        for (var i = 0; i < btns.length; i++) {
            var t = (btns[i].textContent || '').trim();
            if (exact ? t === text : t.indexOf(text) !== -1) { if (!btns[i].disabled && !btns[i].closest('[aria-hidden="true"]')) return btns[i]; }
        }
        var all = document.querySelectorAll('[class*="Btn"], [class*="btn"], button');
        for (var j = 0; j < all.length; j++) {
            var t2 = (all[j].textContent || '').trim();
            if (exact ? t2 === text : t2.indexOf(text) !== -1) return all[j];
        }
        return null;
    }

    function checkAPI() {
        var base = CFG.apiUrl.replace(/\/api\/answer\/?$/, '').replace(/\/+$/, '');
        var healthUrl = base + '/api/health';
        GM_xmlhttpRequest({ method: 'GET', url: healthUrl, timeout: 5000,
            onload: function (r) { try { var d = JSON.parse(r.responseText); isApiOnline = d.status === 'ok'; log('AI: ' + (isApiOnline ? '已连接(' + (d.model || '') + ')' : '异常'), isApiOnline ? 'ok' : 'er'); } catch (e) { isApiOnline = false; log('AI响应异常', 'er'); } render(); },
            onerror: function () { isApiOnline = false; log('AI服务未启动', 'er'); render(); },
            ontimeout: function () { isApiOnline = false; log('超时', 'er'); render(); }
        });
    }

    // ====== 题库提取 ======
    function extractQuestions() {
        var qs = [];
        var lis = document.querySelectorAll('[class*="question___"]');
        for (var i = 0; i < lis.length; i++) {
            var li = lis[i];
            var h3 = li.querySelector('h3');
            if (!h3) continue;
            var title = h3.textContent.trim();
            if (!/^\d+\./.test(title)) continue;
            var isMulti = title.indexOf('多选') !== -1;
            var isJudge = title.indexOf('判断') !== -1;
            var labels = li.querySelectorAll('label');
            var opts = [];
            for (var j = 0; j < labels.length; j++) {
                if (labels[j].querySelector('input[type="radio"], input[type="checkbox"]')) {
                    opts.push(labels[j].textContent.trim());
                }
            }
            if (opts.length > 0) qs.push({ title: title, opts: opts, multi: isMulti, judge: isJudge, li: li });
        }
        if (qs.length === 0) {
            var h3s = document.querySelectorAll('h3');
            for (var k = 0; k < h3s.length; k++) {
                var t = h3s[k].textContent.trim();
                if (/^\d+\./.test(t)) {
                    var container = h3s[k].closest('div');
                    if (!container) continue;
                    var labels2 = container.querySelectorAll('label');
                    var opts2 = [];
                    for (var m = 0; m < labels2.length; m++) {
                        if (labels2[m].querySelector('input[type="radio"], input[type="checkbox"]'))
                            opts2.push(labels2[m].textContent.trim());
                    }
                    if (opts2.length > 0) qs.push({ title: t, opts: opts2, multi: t.indexOf('多选') !== -1, judge: t.indexOf('判断') !== -1, li: container });
                }
            }
        }
        return qs;
    }

    function selectAnswer(answer, q) {
        var labels = q.li.querySelectorAll('label');
        if (labels.length === 0) return false;

        var letters = [], found = 0;
        var raw = Array.isArray(answer) ? answer.join(',') : String(answer).trim();

        if (/^[A-E]+$/i.test(raw)) {
            letters = raw.toUpperCase().split('');
        } else if (/^[A-E][\.\、]/.test(raw)) {
            var ms = raw.match(/[A-E][\.\、]?/g);
            if (ms) letters = ms.map(function (m) { return m.charAt(0).toUpperCase(); });
        } else {
            var m2 = raw.match(/[A-E]/g);
            if (m2) letters = m2.map(function (m) { return m.toUpperCase(); });
        }

        if (!q.multi && letters.length > 1) letters = [letters[0]];

        if (letters.length === 0) {
            var rawLower = raw.toLowerCase();
            var isCorrect = /^(正确|对|√|true|yes|是|right|t)$/i.test(rawLower);
            var isWrong = /^(错误|错|×|false|no|否|wrong|f)$/i.test(rawLower);
            if (isCorrect || isWrong) {
                for (var j = 0; j < labels.length; j++) {
                    var t = labels[j].textContent.trim();
                    if (isCorrect && (t.indexOf('正确') !== -1 || t.indexOf('对') !== -1 || t.indexOf('是') !== -1)) { clickLabel(labels[j]); found = 1; break; }
                    if (isWrong && (t.indexOf('错误') !== -1 || t.indexOf('错') !== -1 || t.indexOf('否') !== -1)) { clickLabel(labels[j]); found = 1; break; }
                }
            }
            if (!found) {
                for (var k = 0; k < labels.length; k++) {
                    var txt2 = labels[k].textContent.trim();
                    if (txt2.indexOf(raw) !== -1 || raw.indexOf(txt2) !== -1) { clickLabel(labels[k]); break; }
                }
            }
            return found > 0;
        }

        for (var li = 0; li < letters.length; li++) {
            var ltr = letters[li];
            for (var lj = 0; lj < labels.length; lj++) {
                var t = labels[lj].textContent.trim();
                if (t.charAt(0) === ltr && (t.charAt(1) === '.' || t.charAt(1) === '、')) {
                    var antCb = labels[lj].querySelector('.ant-checkbox');
                    if (antCb) { antCb.click(); }
                    else {
                        var inp = labels[lj].querySelector('input[type="radio"], input[type="checkbox"]');
                        if (inp) { inp.click(); }
                        else { labels[lj].click(); }
                    }
                    found++;
                    break;
                }
            }
        }
        log('选中 ' + letters.join(',') + ' (' + found + '/' + letters.length + ')', found > 0 ? 'ok' : 'er');
        return found > 0;
    }

    function clickLabel(label) {
        var antCb = label.querySelector('.ant-checkbox');
        if (antCb) { antCb.click(); return; }
        var inp = label.querySelector('input[type="radio"], input[type="checkbox"]');
        if (inp) { inp.click(); return; }
        label.click();
    }

    function callAPI(question, options, type) {
        var qType = type === 'multiple' ? 1 : type === 'completion' ? 3 : type === 'judgement' ? 4 : 0;
        var retries = 3;
        return new Promise(function (res, rej) {
            function tryReq(attempt) {
                GM_xmlhttpRequest({
                    method: 'POST', url: CFG.apiUrl, headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ question: question, options: options, type: qType, images: [] }),
                    timeout: 120000,
                    onload: function (r) { try { res(JSON.parse(r.responseText)); } catch (e) { retryOrFail(new Error('解析失败')); } },
                    onerror: function () { retryOrFail(new Error('网络错误')); },
                    ontimeout: function () { retryOrFail(new Error('超时')); }
                });
                function retryOrFail(e) {
                    if (attempt < retries) {
                        log('API重试 ' + (attempt + 1) + '/' + retries, 'at');
                        setTimeout(function() { tryReq(attempt + 1); }, 1000);
                    } else {
                        rej(e);
                    }
                }
            }
            tryReq(1);
        });
    }

    async function answerCurrentQuiz() {
        if (isAnswering) { log('AI答题已进行中', 'au'); isAnswering = false; render(); return; }
        isAnswering = true; render();
        var qs = extractQuestions();
        if (qs.length === 0) { log('未检测到题目', 'er'); isAnswering = false; render(); return; }
        log('检测到 ' + qs.length + ' 道题', 'info');

        var ok = 0;
        for (var i = 0; i < qs.length; i++) {
            if (autoAbort || (!autoMode && !isAnswering)) { log('答题已中断', 'at'); break; }
            if (pageType() !== 'task') { log('页面已跳转，中断答题', 'at'); break; }
            // 检查弹窗
            var popup = findBtn('继续学习');
            if (popup) { popup.click(); log('检测到暂停弹窗，已恢复', 'info'); await sleep(2000); }
            var q = qs[i];
            try {
                var r = await callAPI(q.title, q.opts, q.judge ? 'judgement' : q.multi ? 'multiple' : 'single');
                if (r.success && (r.answer || r.ans || r.ocs_format)) {
                    var raw = r.ocs_format;
                    if (Array.isArray(raw) && raw.length >= 2) {
                        raw = raw[1];
                        if (Array.isArray(raw)) raw = raw.join(',');
                    }
                    var ans = raw || r.ans || r.answer;
                    var ansStr = Array.isArray(ans) ? ans.join(',') : String(ans);
                    log('题' + (i + 1) + ': ' + ansStr, 'ok');
                    if (selectAnswer(ans, q)) ok++; else log('题' + (i + 1) + ' 匹配失败', 'er');
                } else { log('题' + (i + 1) + ' API失败', 'er'); }
            } catch (e) { log('题' + (i + 1) + ' 请求异常: ' + e.message, 'er'); }
            await sleep(CFG.quizDelay);
        }
        log('答题完成: ' + ok + '/' + qs.length, ok > 0 ? 'ok' : 'er');

        await sleep(1500);
        var submitEl = document.querySelector('[class*="finishBtn"]') || document.querySelector('[class*="submitBtn"]');
        if (submitEl) { submitEl.click(); log('已提交测验', 'info'); }
        else { var btns = document.querySelectorAll('button'); for (var j = 0; j < btns.length; j++) { if (btns[j].textContent.indexOf('提交测验') !== -1) { btns[j].click(); log('已提交', 'info'); break; } } }
        isAnswering = false; render();
    }

    // ====== 页面类型检测（URL + DOM特征，因为SPA可能共享URL） ======
    function pageType() {
        var url = location.href;
        if (url.indexOf('/student/task') !== -1) return 'task';
        if (url.indexOf('/studentIndex') !== -1) return 'dashboard';
        if (url.indexOf('/courseList') !== -1) return 'courselist';
        // student/index 可能承载项目页或课程索引页，靠DOM区分
        if (url.indexOf('/student/index') !== -1 || url.indexOf('/runner_web/student') !== -1) {
            var btns = document.querySelectorAll('button');
            for (var i = 0; i < btns.length; i++) {
                var t = (btns[i].textContent || '').trim();
                if (t === '进入任务') return 'project';
                if (t.indexOf('开始学习') !== -1) return 'index';
            }
            if (document.querySelector('video') || document.querySelectorAll('[class*="question___"]').length > 0 || (document.body.innerText||'').indexOf('完成学习') !== -1) return 'task';
            // 默认按索引页处理
            return 'index';
        }
        return 'other';
    }

    function taskContentType() {
        if (document.querySelectorAll('[class*="question___"]').length > 0) return 'quiz';
        var txt = document.body.innerText || '';
        if (txt.indexOf('作业') !== -1) return 'homework';
        if (txt.indexOf('完成学习') !== -1 && txt.indexOf('视频') === -1) return 'doc';
        if (document.querySelector('video')) return 'video';
        return 'unknown';
    }

    // ====== 视频倍速 ======
    function setVideoSpeed() {
        var v = document.querySelector('video');
        if (!v) return;
        v.play().catch(function () {});
        if (CFG.speed2x && v.playbackRate !== 2) {
            v.playbackRate = 2.0;
            log('视频已设为2倍速', 'info');
        }
    }

    async function handleVideoTask() {
        autoStatus = '处理视频';
        var v = document.querySelector('video');
        if (!v) { log('未找到视频元素', 'er'); return false; }
        setVideoSpeed();
        if (v.paused) v.play().catch(function () {});
        log('视频开始播放', 'info');

        var maxWatch = 3600; // 最长等待1小时（避免死循环）
        var watched = 0;
        while (autoMode && watched < maxWatch) {
            await sleep(CFG.watchInterval);
            watched += CFG.watchInterval / 1000;

            var cont = findBtn('继续学习');
            if (cont) { cont.click(); await sleep(1500); v = document.querySelector('video'); if (v) { setVideoSpeed(); v.play().catch(function () {}); } }

            var pg = document.querySelector('.ant-progress-text, span[class*="progress"]');
            if (pg && pg.textContent && pg.textContent.indexOf('%') !== -1) {
                var nums = pg.textContent.match(/(\d+(?:\.\d+)?)/);
                var pct = nums ? parseFloat(nums[1]) : 0;
                autoStatus = '视频进度 ' + Math.round(pct) + '%'; render();
                if (pct >= 99) { log('视频进度100%', 'ok'); break; }
            }

            v = document.querySelector('video');
            if (!v || v.ended) break;

            if (pageType() !== 'task') break;
        }

        // 轮询等待完成按钮（服务器可能延迟出现）
        for (var i = 0; i < 15; i++) {
            var done = findBtn('完成任务') || findBtn('完成学习') || findBtn('完成');
            if (done) { done.click(); log('视频完成', 'ok'); await sleep(2000); return true; }
            if (pageType() !== 'task') break;
            autoStatus = '等待完成按钮... (' + (i + 1) + '/15)'; render();
            await sleep(2000);
        }
        log('超时等待完成按钮', 'er');
        return false;
    }

    // ====== 文档处理 ======
    function clickCompleteDoc() {
        var btn = findBtn('完成学习') || findBtn('完成任务') || findBtn('完成');
        if (btn) { btn.click(); log('任务完成', 'ok'); return true; }
        return false;
    }

    // ====== 导航 ======
    function goHome() {
        location.href = '/runner_web/student/index';
        autoStatus = ''; stuckCount = 0; lastUrl = '';
    }

    function goBack() {
        var ref = document.referrer || '';
        var pt = pageType();
        if (pt === 'task') {
            var btn = findBtn('返回项目') || findBtn('返回');
            if (btn) { btn.click(); setTimeout(checkRedirect, 2000); return; }
            if (ref && ref.indexOf('runner_web/student') !== -1) { location.href = ref; return; }
            history.back();
            setTimeout(checkRedirect, 2000);
        } else if (pt === 'project') {
            var btn2 = findBtn('返回') || findBtn('回到课程');
            if (btn2) { btn2.click(); return; }
            goHome();
        } else if (pt === 'index') {
            location.href = '/runner_web/courseList';
        } else {
            goHome();
        }
    }

    function checkRedirect() {
        setTimeout(function() {
            if (location.href.indexOf('runner_web') === -1) {
                log('检测到错误跳转，返回工作台', 'er');
                location.href = '/runner_web/studentIndex';
            }
        }, 1500);
    }

    function navigateNext() {
        var btns = document.querySelectorAll('button');
        var skippedHw = 0, totalRemaining = 0;
        for (var i = 0; i < btns.length; i++) {
            if ((btns[i].textContent || '').trim() !== '进入任务') continue;
            totalRemaining++;
            // Walk up to find the task panel container
            var panel = btns[i];
            for (var d = 0; d < 4; d++) {
                panel = panel.parentElement;
                if (!panel) break;
                var taskText = panel.textContent || '';
                if (taskText.length > 30 && taskText.indexOf('任务') !== -1) break;
            }
            if (!panel) continue;
            var taskText = panel.textContent || '';
            if (taskText.indexOf('已完成') !== -1) continue;
            if (taskText.indexOf('作业') !== -1) { log('跳过作业: ' + taskText.slice(0, 30), 'info'); skippedHw++; continue; }
            btns[i].click();
            log('进入下一个任务', 'info');
            return true;
        }
        // All remaning are homework or done
        if (skippedHw > 0 && totalRemaining > 0) {
            var key = makeVisitedKey();
            log('项目仅剩 ' + skippedHw + ' 个作业，标记完成', 'ok');
            if (!hasVisited(getProjectId())) {
                visitedProjects.push(key);
                if (visitedProjects.length > 50) visitedProjects.shift();
                persistVisited();
            }
        }
        log('项目任务全部完成', 'ok');
        return false;
    }

    async function clickStartLearning() {
        // 展开所有折叠的章节
        var items = document.querySelectorAll('.ant-collapse-item');
        for (var h = 0; h < items.length; h++) {
            if (items[h].className.indexOf('active') === -1) {
                var header = items[h].querySelector('.ant-collapse-header');
                if (header) { header.click(); await sleep(300); }
            }
        }
        await sleep(500);

        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
            if ((btns[i].textContent || '').trim().indexOf('开始学习') !== -1) {
                var card = btns[i].parentElement;
                if (!card) continue;
                var txt = (card.textContent || '').trim();
                var m = txt.match(/任务完成度\s*(\d+)\s*\/\s*(\d+)/);
                if (m && parseInt(m[1]) >= parseInt(m[2])) continue;
                if (isProjectVisited(txt, btns[i])) { log('项目仅剩作业，跳过', 'info'); continue; }
                btns[i].click();
                log('进入学习项目: ' + txt.slice(2, 30), 'info');
                return true;
            }
        }
        log('所有项目已完成', 'ok');
        return false;
    }

    // ====== 自动刷课主循环 ======
    function isQuizComplete() {
        var txt = document.body.innerText || '';
        if (txt.indexOf('答案未解锁') !== -1) return true;
        if (txt.indexOf('已完成') !== -1 && !document.querySelector('[class*="finishBtn"]')) return true;
        return false;
    }

    function markProjectVisited() {
        var key = makeVisitedKey();
        if (!hasVisited(getProjectId())) {
            visitedProjects.push(key);
            if (visitedProjects.length > 50) visitedProjects.shift();
            persistVisited();
            console.log('[stuai] markProjectVisited | key=' + key + ' | all=[' + visitedProjects.join(',') + ']');
        }
    }
    function isProjectVisited(cardText, btnEl) {
        // 策略1: 从按钮/卡片提取项目ID精确匹配（最可靠）
        if (btnEl) {
            var walk = btnEl;
            for (var d = 0; d < 6; d++) {
                var dataId = walk.getAttribute('data-id') || walk.getAttribute('data-project-id') || walk.getAttribute('data-row-key');
                if (dataId && hasVisited('p' + dataId)) return true;
                var onclick = walk.getAttribute('onclick') || '';
                var om = onclick.match(/project[?&]id=(\d+)/);
                if (om && hasVisited('p' + om[1])) return true;
                var a = walk.querySelector('a[href*="project"]');
                if (!a && walk.tagName === 'A' && (walk.getAttribute('href')||'').indexOf('project') !== -1) a = walk;
                if (a) { var am = (a.getAttribute('href')||'').match(/[?&]id=(\d+)/); if (am && hasVisited('p' + am[1])) return true; }
                walk = walk.parentElement;
                if (!walk) break;
            }
        }

        // 策略2: 文本slug双向包含匹配（后备）
        var slug = (cardText || '').trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '').slice(0, 60);
        for (var i = 0; i < visitedProjects.length; i++) {
            var parts = visitedProjects[i].split('__');
            var vk = parts.length > 1 ? parts[1] : visitedProjects[i];
            if (vk.length < 3) continue;
            if (slug.indexOf(vk) !== -1 || vk.indexOf(slug) !== -1) {
                console.log('[stuai] isProjectVisited -> TRUE (text match) | vk=' + vk);
                return true;
            }
        }
        console.log('[stuai] isProjectVisited -> FALSE | slug=' + slug + ' | visited=[' + visitedProjects.join(',') + ']');
        return false;
    }

    async function autoLoop() {
        while (autoMode && !autoAbort) {
            autoRunning = true;
            var url = location.href;
            var pt = pageType();

            // 卡死检测（豁免视频播放、答题中、索引页）
            if (url === lastUrl && pt !== 'index' && pt !== 'dashboard') {
                var vt = document.querySelector('video');
                if ((!vt || vt.ended) && !isAnswering) {
                    stuckCount++;
                }
                if (stuckCount * (CFG.watchInterval / 1000) >= CFG.stuckTimeout / 1000) {
                    log('检测到卡死，返回工作台', 'er');
                    markProjectVisited();
                    goHome(); await sleep(5000); stuckCount = 0; continue;
                }
            } else { stuckCount = 0; lastUrl = url; }

            autoStatus = '导航中...';

            if (pt === 'dashboard') {
                autoStatus = '进入课程'; render();
                var courseBtn = document.querySelector('a[href*="course"], [class*="course"] a, button');
                var allEls = document.querySelectorAll('a, button, [class*="nav"] div');
                for (var di = 0; di < allEls.length; di++) {
                    var elt = allEls[di].textContent.trim();
                    if (elt === '课程' || elt === '进入课程') {
                        allEls[di].click();
                        log('进入课程列表', 'info');
                        break;
                    }
                }
                await sleep(4000);
            } else if (pt === 'task') {
                var type = taskContentType();
                if (type === 'unknown') { await sleep(2000); type = taskContentType(); }
                autoStatus = '处理' + (type === 'quiz' ? '测验' : type === 'video' ? '视频' : type === 'doc' ? '文档' : '任务');
                render();

                if (type === 'quiz') {
                    if (isQuizComplete()) { log('测验已完成，跳过', 'info'); goBack(); await sleep(3000); }
                    else {
                        await answerCurrentQuiz();
                        await sleep(3000);
                        var nxt = findBtn('下个任务');
                        if (nxt) { nxt.click(); log('进入下个任务', 'info'); }
                        else { goBack(); }
                        await sleep(3000);
                    }
                } else if (type === 'video') {
                    await handleVideoTask();
                    await sleep(2000);
                    var nxt2 = findBtn('下个任务');
                    if (nxt2) { nxt2.click(); log('进入下个任务', 'info'); }
                    else { goBack(); }
                    await sleep(3000);
                } else if (type === 'doc') {
                    clickCompleteDoc();
                    await sleep(2000);
                    var nxt3 = findBtn('下个任务');
                    if (nxt3) { nxt3.click(); log('进入下个任务', 'info'); }
                    else { goBack(); }
                    await sleep(3000);
                } else if (type === 'homework') {
                    log('检测到作业，自动跳过', 'info');
                    goBack();
                    await sleep(3000);
                } else {
                    await sleep(2000);
                    var retry = taskContentType();
                    if (retry === 'video') {
                        await handleVideoTask();
                        await sleep(2000);
                        var nxtR = findBtn('下个任务'); if (nxtR) nxtR.click(); else goBack();
                    } else if (retry === 'quiz') {
                        if (!isQuizComplete()) await answerCurrentQuiz();
                        await sleep(3000);
                        var nxtR2 = findBtn('下个任务'); if (nxtR2) nxtR2.click(); else goBack();
                    } else if (retry === 'doc') {
                        clickCompleteDoc(); await sleep(2000);
                        var nxtR3 = findBtn('下个任务'); if (nxtR3) nxtR3.click(); else goBack();
                    } else {
                        if (!clickCompleteDoc()) goBack();
                    }
                    await sleep(3000);
                }
            } else if (pt === 'project') {
                autoStatus = '选择任务'; render();
                if (hasVisited(getProjectId())) {
                    log('项目已标记完成(仅剩作业)，跳过', 'info');
                    goBack();
                    await sleep(3000);
                } else if (!navigateNext()) {
                    markProjectVisited();
                    goBack();
                }
                await sleep(4000);
            } else if (pt === 'index') {
                var courseId = getCourseId();
                if (courseId !== 'c_unknown' && isCourseVisited(courseId)) {
                    console.log('[stuai] index guard: course ' + courseId + ' already visited, redirecting to courselist');
                    log('课程已完成，前往课程列表', 'info');
                    location.href = '/runner_web/courseList';
                    await sleep(5000); stuckCount = 0; continue;
                }
                autoStatus = '选择课程'; render();
                if (!await clickStartLearning()) {
                    markCourseVisited();
                    log('当前课程全部完成，前往课程列表', 'ok');
                    location.href = '/runner_web/courseList';
                    await sleep(5000); stuckCount = 0; continue;
                }
                await sleep(4000);
            } else if (pt === 'courselist') {
                autoStatus = '选择课程'; render();
                await sleep(3000);
                var courseEntered = false;
                var isCardVisited = function(el) {
                    var txt = (el.textContent || '').trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '').slice(0, 40);
                    for (var vi = 0; vi < visitedCourses.length; vi++) {
                        var parts = visitedCourses[vi].split('__');
                        var vkey = visitedCourses[vi];
                        // 策略1: 完整存储key包含卡片文本
                        if (vkey.indexOf(txt) !== -1) return true;
                        // 策略2: 卡片文本包含存储的课程名（从复合key中提取）
                        var courseName = parts[0].replace(/^c\d+_?/, '').replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '');
                        if (courseName && courseName.length > 1 && txt.indexOf(courseName) !== -1) return true;
                        // 策略3: 卡片文本包含存储的类名slug
                        if (parts.length > 1 && parts[1] && txt.indexOf(parts[1]) !== -1) return true;
                    }
                    console.log('[stuai] courselist card NOT visited | txt=' + txt + ' | vcs=' + JSON.stringify(visitedCourses));
                    return false;
                };
                for (var retry = 0; retry < 5 && !courseEntered; retry++) {
                    if (retry > 0) await sleep(2000);
                    var allCards = [];
                    // 找容器
                    var container = document.querySelector('[class*="courseListContainer"], [class*="CourseListContainer"], [class*="coursePanelContainer"]');
                    if (container) {
                        // 深层查找所有可点击的卡片元素（链接、有role的、含课程名的div）
                        var cands = container.querySelectorAll('a[href], [class*="card"], [class*="Card"], [role="button"], div[onclick]');
                        for (var c = 0; c < cands.length; c++) {
                            var txt = (cands[c].textContent || '').trim();
                            if (txt.length > 3 && !/加入课程|未开始|学习中|已结束|我的课程|公开课|学校共享/.test(txt)) {
                                allCards.push(cands[c]);
                            }
                        }
                        // 如果a/button找不到，取所有文本不为空的子 div
                        if (allCards.length === 0) {
                            var divs = container.querySelectorAll('div');
                            for (var d = 0; d < divs.length; d++) {
                                var dtxt = (divs[d].textContent || '').trim();
                                if (dtxt.length > 5 && divs[d].children.length <= 5 && !/加入课程|未开始|学习中|已结束/.test(dtxt)) {
                                    allCards.push(divs[d]);
                                }
                            }
                        }
                    }
                    if (allCards.length === 0) {
                        // 兜底：找任意含课程名文本的元素
                        var elems = document.querySelectorAll('[class*="course"], [class*="item"], a');
                        for (var e = 0; e < elems.length; e++) {
                            var et = (elems[e].textContent || '').trim();
                            if (et.length > 5 && !/加入课程|未开始|学习中|已结束|我的课程|公开课|学校共享/.test(et)) {
                                allCards.push(elems[e]);
                            }
                        }
                    }
                    console.log('[stuai] courselist found ' + allCards.length + ' cards');
                    for (var ci = 0; ci < allCards.length && !courseEntered; ci++) {
                        var card = allCards[ci];
                        if (isCardVisited(card)) { log('课程已完成，跳过', 'info'); continue; }
                        var target = card.querySelector('a[href]') || card.querySelector('button') || card.querySelector('[class*="ant-btn"]') || card.querySelector('[role="button"]') || card;
                        target.click();
                        log('进入课程(卡片)', 'info');
                        await sleep(2000);
                        if (pageType() !== 'courselist') { courseEntered = true; }
                        else { log('点击未跳转，换下一个目标', 'er'); }
                    }
                    // 最后重试时兜底：直接URL跳转
                    if (!courseEntered && retry === 4) {
                        log('所有卡片无法点击跳转，直接导航', 'info');
                        location.href = '/runner_web/student/index';
                        courseEntered = true;
                    }
                }
                if (!courseEntered) {
                    log('课程列表无可用课程，自动停止', 'ok');
                    stopAuto(); render(); return;
                }
                await sleep(4000);
            } else {
                autoStatus = '等待页面...'; render();
                await sleep(3000);
            }
            render();
        }
        autoRunning = false;
    }

    // ====== 自动模式控制 ======
    function toggleAuto() {
        autoMode = !autoMode;
        if (autoMode) {
            if (videoMode) { log('检测到视频托管运行中，请先停止', 'er'); autoMode = false; render(); return; }
            startAuto();
        } else { stopAuto(); }
        render();
    }

    function startAuto() {
        if (autoRunning) { log('自动刷课已在运行中', 'au'); return; }
        autoAbort = false;
        autoMode = true;
        autoRunning = true;
        stuckCount = 0;
        lastUrl = location.href;
        GM_setValue('stuai_auto', '1');
        log('自动刷课已启动', 'info');
        render();
        autoLoop().catch(function (e) { log('异常: ' + e.message, 'er'); }).then(function () { autoRunning = false; });
    }

    function stopAuto() {
        autoAbort = true;
        autoMode = false;
        autoRunning = false;
        autoStatus = '';
        GM_setValue('stuai_auto', '0');
        log('自动刷课已停止', 'info');
        render();
    }

    // ====== 视频托管模式（仅长视频播放，不自动导航/完成任务） ======
    function toggleVideo() {
        videoMode = !videoMode;
        if (videoMode) {
            if (autoMode) { log('检测到自动刷课运行中，请先停止', 'er'); videoMode = false; render(); return; }
            startVideo();
        } else { stopVideo(); }
        render();
    }

    function startVideo() {
        videoAbort = false;
        videoMode = true;
        GM_setValue('stuai_video', '1');
        log('视频托管已启动（仅播放，不导航）', 'info');
        render();
        videoLoop().catch(function (e) { log('视频异常: ' + e.message, 'er'); stopVideo(); });
    }

    function stopVideo() {
        videoAbort = true;
        videoMode = false;
        GM_setValue('stuai_video', '0');
        log('视频托管已停止', 'info');
        render();
    }

    async function videoLoop() {
        while (videoMode && !videoAbort) {
            await sleep(CFG.watchInterval);
            var v = document.querySelector('video');
            if (!v) {
                autoStatus = '等待视频...'; render();
                continue;
            }
            // 2x speed
            if (CFG.speed2x && v.playbackRate !== 2) { v.playbackRate = 2.0; }
            if (v.paused) { v.play().catch(function () {}); }
            // 自动续播弹窗
            var cont = findBtn('继续学习');
            if (cont) { cont.click(); await sleep(1500); v = document.querySelector('video'); if (v) { v.play().catch(function () {}); v.playbackRate = CFG.speed2x ? 2.0 : 1.0; } }
            // 显示进度
            var pg = document.querySelector('.ant-progress-text, span[class*="progress"]');
            if (pg && pg.textContent && pg.textContent.indexOf('%') !== -1) {
                var nums = pg.textContent.match(/(\d+(?:\.\d+)?)/);
                var pct = nums ? parseFloat(nums[1]) : 0;
                autoStatus = '视频播放 ' + Math.round(pct) + '%'; render();
            }
            // 视频结束自动跳下一个
            v = document.querySelector('video');
            if (!v || v.ended) {
                log('视频播放完毕', 'info');
                autoStatus = ''; render();
                break;
            }
        }
        // 循环结束后不自动停止，保持面板状态
    }

    // ====== 初始化 ======
    function init() {
        if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); return; }
        console.log('[stuai] init | url=' + location.href.slice(-50) + ' | visitedProjects=[' + visitedProjects.join(',') + '] | visitedCourses=[' + visitedCourses.join(',') + ']');
        render(); checkAPI();
        var v = document.querySelector('video'); if (v && v.paused) v.play().catch(function () {});
        // 页面卸载前强制持久化
        window.addEventListener('beforeunload', function() { persistVisited(); persistVisitedCourses(); });
        // 跨页面自动恢复
        if (GM_getValue('stuai_auto', '0') === '1') {
            if (autoRunning) { log('自动刷课已在运行中，跳过恢复', 'au'); return; }
            var pt = pageType();
            if (pt === 'other') {
                log('非刷课页面，自动导航到课程页', 'au');
                location.href = '/runner_web/student/index';
                return;
            }
            log('检测到未完成的刷课任务，自动恢复', 'au');
            startAuto();
            return;
        }
        if (GM_getValue('stuai_video', '0') === '1') {
            log('检测到未完成的视频托管，自动恢复', 'au');
            startVideo();
            return;
        }
        // 保存当前课程URL用于恢复
        if (pageType() === 'index' || pageType() === 'task' || pageType() === 'project') {
            GM_setValue('stuai_last_course', location.href);
        }
    }
    init();
})();
