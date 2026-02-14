// ═══════════════════════════════════════════════════════
// Edit Tools - 가위 + 미니 수정 + 메시지 관리 (SillyTavern Extension)
// ═══════════════════════════════════════════════════════

const MODULE_NAME = "st-edit-tools";
const defaultSettings = {
    enableCut: true,
    enableEdit: true,
    enableManager: true,
};

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    const s = extensionSettings[MODULE_NAME];
    for (const key of Object.keys(defaultSettings)) {
        if (s[key] === undefined) s[key] = defaultSettings[key];
    }
    return s;
}

function save() {
    const { saveSettingsDebounced } = SillyTavern.getContext();
    saveSettingsDebounced();
}

jQuery(async () => {
    console.log("[Edit Tools] 확장프로그램 로딩...");

    const settings = getSettings();

    // ── 설정 패널 HTML 로드 ──
    function bindSettingsEvents() {
        $("#et_enable_cut").prop("checked", settings.enableCut);
        $("#et_enable_edit").prop("checked", settings.enableEdit);
        $("#et_enable_manager").prop("checked", settings.enableManager);

        $("#et_enable_cut").on("change", function () {
            settings.enableCut = !!$(this).prop("checked");
            save(); applyCutVisibility();
        });
        $("#et_enable_edit").on("change", function () {
            settings.enableEdit = !!$(this).prop("checked");
            save(); applyEditVisibility();
        });
        $("#et_enable_manager").on("change", function () {
            settings.enableManager = !!$(this).prop("checked");
            save(); applyManagerVisibility();
        });
    }

    try {
        const extPath = `scripts/extensions/third_party/${MODULE_NAME}`;
        const res = await fetch(`/${extPath}/settings.html`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        $("#extensions_settings2").append(html);
        bindSettingsEvents();
        console.log("[Edit Tools] 설정 패널 로드 성공!");
    } catch (e) {
        console.warn("[Edit Tools] 설정 패널 로드 실패, HTML 직접 삽입...", e);
        const fallbackHtml = `
        <div class="edit-tools-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Edit Tools 설정</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label class="checkbox_label" for="et_enable_cut">
                        <input type="checkbox" id="et_enable_cut" />
                        <span>가위 버튼 표시</span>
                    </label>
                    <label class="checkbox_label" for="et_enable_edit">
                        <input type="checkbox" id="et_enable_edit" />
                        <span>미니 수정 버튼 표시</span>
                    </label>
                    <label class="checkbox_label" for="et_enable_manager">
                        <input type="checkbox" id="et_enable_manager" />
                        <span>메시지 관리 버튼 표시</span>
                    </label>
                </div>
            </div>
        </div>`;
        $("#extensions_settings2").append(fallbackHtml);
        bindSettingsEvents();
    }

    // ═════════════════════════════════════════════
    // ✂️ 파트 1: 가위(삭제) 버튼
    // ═════════════════════════════════════════════
    function applyCutVisibility() {
        document.querySelectorAll('.custom-cut-btn').forEach(btn => {
            btn.style.display = settings.enableCut ? '' : 'none';
        });
    }

    function initCutButton() {
        function upsertDeleteButtons() {
            document.querySelectorAll('.mes').forEach(mes => {
                const currentId = mes.getAttribute('mesid');
                if (!currentId) return;
                const target =
                    mes.querySelector('.extraMesButtons') ||
                    mes.querySelector('.mes_button') ||
                    mes.querySelector('.mes_buttons');
                if (!target) return;
                let cutBtn = target.querySelector('.custom-cut-btn');
                if (!cutBtn) {
                    cutBtn = document.createElement('div');
                    cutBtn.className = 'custom-cut-btn common_v2_button';
                    cutBtn.innerHTML = '<i class="fa-solid fa-scissors"></i>';
                    cutBtn.addEventListener('click', e => {
                        e.preventDefault(); e.stopPropagation();
                        const idNow = mes.getAttribute('mesid');
                        if (!idNow) return;
                        if (!confirm(`${idNow}번 메시지를 삭제할까?`)) return;
                        const textarea = document.getElementById('send_textarea');
                        const sendBtn = document.getElementById('send_but');
                        if (!textarea || !sendBtn) return;
                        const backup = textarea.value;
                        textarea.value = `/cut ${idNow}`;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        sendBtn.click();
                        setTimeout(() => {
                            textarea.value = backup;
                            textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        }, 50);
                    });
                    target.prepend(cutBtn);
                }
                cutBtn.dataset.mesid = currentId;
                cutBtn.title = `${currentId}번 메시지 삭제`;
                cutBtn.style.display = settings.enableCut ? '' : 'none';
            });
        }
        const chat = document.getElementById('chat');
        if (!chat) return;
        const observer = new MutationObserver(upsertDeleteButtons);
        observer.observe(chat, { childList: true, subtree: true });
        upsertDeleteButtons();
        console.log("[Edit Tools] ✂️ 가위 버튼 활성화!");
    }

    // ═════════════════════════════════════════════
    // ✏️ 파트 2: 미니 수정
    // ═════════════════════════════════════════════
    let editEnabled = settings.enableEdit;

    function applyEditVisibility() {
        editEnabled = settings.enableEdit;
        const floatBtn = document.getElementById('pe-float-btn');
        if (floatBtn && !editEnabled) floatBtn.style.display = 'none';
    }

    function initPartialEdit() {
        const { getContext } = SillyTavern;

        const editBtn = document.createElement('div');
        editBtn.id = 'pe-float-btn';
        editBtn.textContent = '✏️ 미니 수정';
        document.body.appendChild(editBtn);

        const bg = document.createElement('div');
        bg.id = 'pe-bg';
        document.body.appendChild(bg);

        const popup = document.createElement('div');
        popup.id = 'pe-popup';
        popup.innerHTML = `
            <div class="pe-hdr">
                <span>미니 수정</span>
                <span class="pe-badge" id="pe-badge"></span>
            </div>
            <div class="pe-orig-label">▼ 찾을 텍스트 (수정 가능)</div>
            <textarea class="pe-orig" id="pe-orig" placeholder="원문에서 찾을 텍스트" rows="1"></textarea>
            <textarea id="pe-ta" placeholder="바꿀 내용을 입력하세요..."></textarea>
            <div class="pe-btns">
                <div class="pe-b pe-b-save" id="pe-save">✔ 저장</div>
                <div class="pe-b pe-b-del" id="pe-del">🗑 삭제</div>
                <div class="pe-b pe-b-cancel" id="pe-cancel">✖ 취소</div>
            </div>
        `;
        document.body.appendChild(popup);

        const badgeEl = document.getElementById('pe-badge');
        const origEl = document.getElementById('pe-orig');
        const ta = document.getElementById('pe-ta');
        const saveBtn = document.getElementById('pe-save');
        const delBtn = document.getElementById('pe-del');
        const cancelBtn = document.getElementById('pe-cancel');

        let state = { selectedText: '', mesId: null };

        function getRawText(mesId) {
            try { const ctx = getContext(); if (ctx && ctx.chat && ctx.chat[mesId]) return ctx.chat[mesId].mes; } catch (e) {}
            return null;
        }

        function getVariants(text) {
            const v = [text];
            if (text.includes('…')) v.push(text.replace(/\u2026/g, '...'));
            if (text.includes('...')) v.push(text.replace(/\.\.\./g, '…'));
            if (text.includes("'")) { v.push(text.replace(/'/g, '\u2018')); v.push(text.replace(/'/g, '\u2019')); }
            if (text.includes('\u2018') || text.includes('\u2019')) v.push(text.replace(/[\u2018\u2019]/g, "'"));
            if (text.includes('"')) { v.push(text.replace(/"/g, '\u201C')); v.push(text.replace(/"/g, '\u201D')); }
            if (text.includes('\u201C') || text.includes('\u201D')) v.push(text.replace(/[\u201C\u201D]/g, '"'));
            if (text.includes('--')) v.push(text.replace(/--/g, '\u2014'));
            if (text.includes('\u2014')) v.push(text.replace(/\u2014/g, '--'));
            if (text.includes('\u2013')) v.push(text.replace(/\u2013/g, '-'));
            return v;
        }

        function findWithMarkdown(raw, text) {
            const mds = ['***', '**', '*', '__', '_', '~~'];
            for (const md of mds) {
                let s = md + text + md, idx = raw.indexOf(s);
                if (idx !== -1) return { index: idx, matched: s };
                const ep = text.match(/^(.+?)([.!?,;:'")\]}>…]+)$/);
                if (ep) { s = md + ep[1] + md + ep[2]; idx = raw.indexOf(s); if (idx !== -1) return { index: idx, matched: s }; }
                const sp = text.match(/^([.!?,;:'"(\[{<…]+)(.+)$/);
                if (sp) { s = sp[1] + md + sp[2] + md; idx = raw.indexOf(s); if (idx !== -1) return { index: idx, matched: s }; }
                const si = text.indexOf(' ');
                if (si > 0) {
                    const f = text.substring(0, si), r = text.substring(si);
                    const fp = f.match(/^(.+?)([.!?,;:]+)$/);
                    s = fp ? md + fp[1] + md + fp[2] + r : md + f + md + r;
                    idx = raw.indexOf(s); if (idx !== -1) return { index: idx, matched: s };
                    const li = text.lastIndexOf(' ');
                    s = text.substring(0, li + 1) + md + text.substring(li + 1) + md;
                    idx = raw.indexOf(s); if (idx !== -1) return { index: idx, matched: s };
                }
            }
            return null;
        }

        function findInRaw(raw, sel) {
            const vars = getVariants(sel);
            for (const v of vars) { const i = raw.indexOf(v); if (i !== -1) return { index: i, matched: v }; }
            for (const v of vars) { const r = findWithMarkdown(raw, v); if (r) return r; }
            return null;
        }

        function updateDOM(ctx, mesId, updated) {
            const el = document.querySelector('.mes[mesid="' + mesId + '"]');
            if (!el) return;
            const mt = el.querySelector('.mes_text');
            if (!mt) return;
            try {
                if (typeof ctx.messageFormatting === 'function') {
                    const c = ctx.chat[mesId];
                    mt.innerHTML = ctx.messageFormatting(updated, c.name, c.is_system, c.is_user, mesId);
                } else { mt.innerHTML = updated.replace(/\n/g, '<br>'); }
            } catch (e) { mt.innerHTML = updated.replace(/\n/g, '<br>'); }
        }

        function doSaveChat(ctx) {
            if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
            else if (typeof ctx.saveChat === 'function') ctx.saveChat();
        }

        function applyEditDirect(mesId, index, length, newText) {
            try {
                const ctx = getContext();
                if (!ctx || !ctx.chat || !ctx.chat[mesId]) return false;
                const o = ctx.chat[mesId].mes;
                const u = o.substring(0, index) + newText + o.substring(index + length);
                ctx.chat[mesId].mes = u; updateDOM(ctx, mesId, u); doSaveChat(ctx); return true;
            } catch (e) { console.error("[Edit Tools]", e); return false; }
        }

        function toast(msg) {
            try { if (typeof toastr !== 'undefined') { toastr.success(msg, 'Edit Tools', { timeOut: 2000 }); return; } } catch (e) {}
            console.log("[Edit Tools] " + msg);
        }

        const chatEl = document.getElementById('chat');
        if (!chatEl) return;

        function findMes(n) { if (!n) return null; let el = n.nodeType === Node.TEXT_NODE ? n.parentElement : n; return el ? el.closest('.mes') : null; }

        function onSelect() {
            if (!editEnabled) { editBtn.style.display = 'none'; return; }
            if (bg.classList.contains('pe-show')) return;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || !sel.toString().trim()) { editBtn.style.display = 'none'; return; }
            const text = sel.toString().trim();
            const aM = findMes(sel.anchorNode), fM = findMes(sel.focusNode);
            if (!aM || !fM) { editBtn.style.display = 'none'; return; }
            if (aM.getAttribute('mesid') !== fM.getAttribute('mesid')) { editBtn.style.display = 'none'; return; }
            const mt = aM.querySelector('.mes_text');
            if (!mt || !mt.contains(sel.anchorNode)) { editBtn.style.display = 'none'; return; }
            state.selectedText = text;
            state.mesId = parseInt(aM.getAttribute('mesid'), 10);
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            let l = rect.left + rect.width / 2 - 55;
            l = Math.max(8, Math.min(l, window.innerWidth - 120));
            let t = rect.bottom + 22;
            if (t + 40 > window.innerHeight) t = rect.top - 50;
            editBtn.style.left = l + 'px'; editBtn.style.top = t + 'px'; editBtn.style.display = 'block';
        }

        chatEl.addEventListener('mouseup', e => { if (editBtn.contains(e.target)) return; setTimeout(onSelect, 80); });
        chatEl.addEventListener('touchend', e => { if (editBtn.contains(e.target)) return; setTimeout(onSelect, 350); });
        document.addEventListener('selectionchange', () => {
            if (bg.classList.contains('pe-show')) return;
            clearTimeout(window.__peSelTimer);
            window.__peSelTimer = setTimeout(() => {
                const s = window.getSelection();
                if (!s || !s.toString().trim()) editBtn.style.display = 'none'; else onSelect();
            }, 200);
        });

        function posPopup() {
            const vv = window.visualViewport;
            const vH = vv ? vv.height : window.innerHeight, vT = vv ? vv.offsetTop : 0, vW = vv ? vv.width : window.innerWidth;
            popup.style.display = 'block'; popup.style.visibility = 'hidden';
            const pH = popup.offsetHeight, pW = popup.offsetWidth;
            popup.style.visibility = 'visible';
            popup.style.top = (vT + Math.max(10, (vH - pH) / 2)) + 'px';
            popup.style.left = Math.max(5, (vW - pW) / 2) + 'px';
        }

        function autoR(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

        function openPopup() {
            editBtn.style.display = 'none';
            if (!state.selectedText || state.mesId === null) return;
            origEl.value = state.selectedText; ta.value = state.selectedText;
            const raw = getRawText(state.mesId);
            if (raw !== null) {
                const f = findInRaw(raw, state.selectedText);
                if (f) {
                    const cnt = raw.split(f.matched).length - 1;
                    if (cnt === 1) { badgeEl.textContent = '매칭 성공'; badgeEl.style.background = '#2ecc71'; }
                    else { badgeEl.textContent = cnt + '개 (첫번째)'; badgeEl.style.background = '#f39c12'; }
                } else { badgeEl.textContent = '매칭 실패'; badgeEl.style.background = '#e74c3c'; }
            } else { badgeEl.textContent = '실패'; badgeEl.style.background = '#e74c3c'; }
            bg.classList.add('pe-show'); popup.classList.add('pe-show');
            window.getSelection().removeAllRanges();
            posPopup(); autoR(origEl);
            setTimeout(() => { autoR(origEl); posPopup(); }, 50);
            setTimeout(() => ta.focus(), 100);
            setTimeout(posPopup, 400); setTimeout(posPopup, 800);
        }

        function closePopup() {
            bg.classList.remove('pe-show'); popup.classList.remove('pe-show');
            popup.style.display = 'none'; ta.value = ''; origEl.value = '';
            state = { selectedText: '', mesId: null };
        }

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => { if (popup.classList.contains('pe-show')) posPopup(); });
            window.visualViewport.addEventListener('scroll', () => { if (popup.classList.contains('pe-show')) posPopup(); });
        }

        editBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPopup(); });
        editBtn.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); openPopup(); });
        bg.addEventListener('click', closePopup);
        bg.addEventListener('touchend', e => { e.preventDefault(); closePopup(); });

        function updateBadge() {
            const raw = getRawText(state.mesId);
            if (!raw) { badgeEl.textContent = '실패'; badgeEl.style.background = '#e74c3c'; return; }
            const f = findInRaw(raw, origEl.value);
            if (f) { badgeEl.textContent = '매칭 성공'; badgeEl.style.background = '#2ecc71'; }
            else { badgeEl.textContent = '매칭 실패'; badgeEl.style.background = '#e74c3c'; }
        }
        ta.addEventListener('input', updateBadge);
        origEl.addEventListener('input', () => { updateBadge(); autoR(origEl); });

        saveBtn.addEventListener('click', () => {
            const nw = ta.value, sk = origEl.value, raw = getRawText(state.mesId);
            if (!raw) { toast("수정 실패 ㅠ"); closePopup(); return; }
            const f = findInRaw(raw, sk);
            if (f) { if (f.matched === nw) { closePopup(); return; } toast(applyEditDirect(state.mesId, f.index, f.matched.length, nw) ? "수정 완료!" : "수정 실패 ㅠ"); closePopup(); return; }
            toast("수정 실패 - 매칭 안 됨 ㅠ"); closePopup();
        });
        delBtn.addEventListener('click', () => {
            const p = state.selectedText.length > 30 ? state.selectedText.substring(0, 30) + '...' : state.selectedText;
            if (!confirm('삭제?\n"' + p + '"')) return;
            const raw = getRawText(state.mesId);
            if (!raw) { toast("삭제 실패 ㅠ"); closePopup(); return; }
            const f = findInRaw(raw, state.selectedText);
            if (f) toast(applyEditDirect(state.mesId, f.index, f.matched.length, '') ? "삭제 완료!" : "삭제 실패 ㅠ");
            else toast("삭제 실패 - 매칭 안 됨 ㅠ");
            closePopup();
        });
        cancelBtn.addEventListener('click', closePopup);
        ta.addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveBtn.click(); }
            if (e.key === 'Escape') { e.preventDefault(); closePopup(); }
        });
        console.log("[Edit Tools] ✏️ 미니 수정 활성화!");
    }

    // ═════════════════════════════════════════════
    // 📋 파트 3: 메시지 관리 패널
    // ═════════════════════════════════════════════
    function applyManagerVisibility() {
        const btn = document.getElementById('mm_gen');
        if (btn) btn.style.display = settings.enableManager ? '' : 'none';
    }

    function initMessageManager() {
        const { getContext } = SillyTavern;

        // ── 하단 바에 네이티브 스타일 버튼 삽입 ──
        const openBtn = document.createElement('div');
        openBtn.id = 'mm_gen';
        openBtn.className = 'list-group-item flex-container flexGap5 interactable';
        openBtn.title = '메시지 관리';
        openBtn.innerHTML = '<i class="fa-solid fa-list-check"></i> 메시지 관리';
        openBtn.style.display = settings.enableManager ? '' : 'none';

        const sdGen = document.getElementById('sd_gen');
        const extMenu = document.getElementById('extensionsMenu');
        if (sdGen && sdGen.parentNode) {
            sdGen.parentNode.insertBefore(openBtn, sdGen.nextSibling);
        } else if (extMenu) {
            extMenu.appendChild(openBtn);
        } else {
            const wand = document.getElementById('data_bank_wand_container');
            if (wand && wand.parentNode) {
                wand.parentNode.insertBefore(openBtn, wand.nextSibling);
            } else {
                document.body.appendChild(openBtn);
            }
        }

        // ── 배경 ──
        const mmBg = document.createElement('div');
        mmBg.id = 'mm-bg';
        document.body.appendChild(mmBg);

        // ── 패널 ──
        const panel = document.createElement('div');
        panel.id = 'mm-panel';
        panel.innerHTML = `
            <div class="mm-header">
                <span class="mm-title">📋 메시지 관리</span>
                <span class="mm-close" id="mm-close">✕</span>
            </div>
            <div class="mm-toolbar">
                <div class="mm-tb-btn" id="mm-sel-all">전체선택</div>
                <div class="mm-tb-btn" id="mm-sel-none">선택해제</div>
                <div class="mm-tb-btn mm-tb-hide" id="mm-do-hide">👁 숨기기</div>
                <div class="mm-tb-btn mm-tb-unhide" id="mm-do-unhide">👁‍🗨 숨기기해제</div>
                <div class="mm-tb-btn mm-tb-del" id="mm-do-del">🗑 삭제</div>
            </div>
            <div class="mm-info" id="mm-info">0개 선택됨</div>
            <div class="mm-list" id="mm-list"></div>
        `;
        document.body.appendChild(panel);

        const listEl = document.getElementById('mm-list');
        const infoEl = document.getElementById('mm-info');
        let selected = new Set();

        function updateInfo() { infoEl.textContent = `${selected.size}개 선택됨`; }

        function escHtml(s) {
            return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function buildList() {
            const ctx = getContext();
            if (!ctx || !ctx.chat) return;
            listEl.innerHTML = '';
            selected.clear();
            updateInfo();

            ctx.chat.forEach((msg, idx) => {
                const row = document.createElement('div');
                row.className = 'mm-row';
                const isHidden = !!msg.is_hidden;
                const name = msg.name || (msg.is_user ? 'You' : 'System');
                const preview = (msg.mes || '').replace(/\n/g, ' ');
                const short = preview.length > 50 ? preview.substring(0, 50) + '…' : preview;

                row.innerHTML = `
                    <label class="mm-cb-wrap"><input type="checkbox" class="mm-cb" data-idx="${idx}" /></label>
                    <span class="mm-idx">#${idx}</span>
                    <span class="mm-name ${msg.is_user ? 'mm-name-user' : 'mm-name-char'}">${escHtml(name)}</span>
                    <span class="mm-preview">${escHtml(short)}</span>
                    ${isHidden ? '<span class="mm-hidden-tag">숨김</span>' : ''}
                `;
                if (isHidden) row.classList.add('mm-row-hidden');

                const cb = row.querySelector('.mm-cb');
                cb.addEventListener('change', () => {
                    if (cb.checked) selected.add(idx); else selected.delete(idx);
                    updateInfo();
                });
                row.addEventListener('click', (e) => {
                    if (e.target === cb || e.target.closest('.mm-cb-wrap')) return;
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                });
                listEl.appendChild(row);
            });
        }

        function positionPanel() {
            const vv = window.visualViewport;
            const vH = vv ? vv.height : window.innerHeight;
            const vT = vv ? vv.offsetTop : 0;
            const vW = vv ? vv.width : window.innerWidth;

            panel.style.display = 'flex';
            panel.style.visibility = 'hidden';
            // CSS transform 제거하고 직접 계산
            panel.style.transform = 'none';
            const pH = panel.offsetHeight;
            const pW = panel.offsetWidth;
            panel.style.visibility = 'visible';

            const topVal = vT + Math.max(10, (vH - pH) / 2);
            const leftVal = Math.max(5, (vW - pW) / 2);
            panel.style.top = topVal + 'px';
            panel.style.left = leftVal + 'px';
        }

        function openManager() {
            buildList();
            mmBg.classList.add('mm-show');
            panel.classList.add('mm-show');
            positionPanel();
            setTimeout(positionPanel, 100);
        }
        function closeManager() {
            mmBg.classList.remove('mm-show');
            panel.classList.remove('mm-show');
            panel.style.display = 'none';
            selected.clear();
        }

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => { if (panel.classList.contains('mm-show')) positionPanel(); });
            window.visualViewport.addEventListener('scroll', () => { if (panel.classList.contains('mm-show')) positionPanel(); });
        }

        openBtn.addEventListener('click', openManager);
        document.getElementById('mm-close').addEventListener('click', closeManager);
        mmBg.addEventListener('click', closeManager);

        document.getElementById('mm-sel-all').addEventListener('click', () => {
            listEl.querySelectorAll('.mm-cb').forEach(cb => { cb.checked = true; selected.add(parseInt(cb.dataset.idx, 10)); });
            updateInfo();
        });
        document.getElementById('mm-sel-none').addEventListener('click', () => {
            listEl.querySelectorAll('.mm-cb').forEach(cb => { cb.checked = false; });
            selected.clear(); updateInfo();
        });

        // ── 숨기기 ──
        document.getElementById('mm-do-hide').addEventListener('click', () => {
            if (selected.size === 0) return;
            const ids = [...selected].sort((a, b) => a - b);
            const textarea = document.getElementById('send_textarea');
            const sendBtn = document.getElementById('send_but');
            if (!textarea || !sendBtn) return;

            const backup = textarea.value;
            let i = 0;

            function doNext() {
                if (i >= ids.length) {
                    setTimeout(() => {
                        textarea.value = backup;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        if (typeof toastr !== 'undefined') toastr.success(`${ids.length}개 숨기기/표시 완료!`, 'Edit Tools', { timeOut: 2000 });
                        buildList();
                    }, 300);
                    return;
                }
                textarea.value = `/hide ${ids[i]}`;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                sendBtn.click();
                i++;
                setTimeout(doNext, 500);
            }
            doNext();
        });

        // ── 숨기기 해제 (/unhide) ──
        document.getElementById('mm-do-unhide').addEventListener('click', () => {
            if (selected.size === 0) return;
            const ctx = getContext();
            if (!ctx || !ctx.chat) return;
            // 숨겨진 것만 필터
            const ids = [...selected].filter(idx => ctx.chat[idx] && ctx.chat[idx].is_hidden).sort((a, b) => a - b);
            if (ids.length === 0) {
                if (typeof toastr !== 'undefined') toastr.info('선택한 메시지 중 숨겨진 게 없어요', 'Edit Tools', { timeOut: 2000 });
                return;
            }
            const textarea = document.getElementById('send_textarea');
            const sendBtn = document.getElementById('send_but');
            if (!textarea || !sendBtn) return;

            const backup = textarea.value;
            let i = 0;

            function doNext() {
                if (i >= ids.length) {
                    setTimeout(() => {
                        textarea.value = backup;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        if (typeof toastr !== 'undefined') toastr.success(`${ids.length}개 숨기기 해제!`, 'Edit Tools', { timeOut: 2000 });
                        buildList();
                    }, 300);
                    return;
                }
                textarea.value = `/unhide ${ids[i]}`;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                sendBtn.click();
                i++;
                setTimeout(doNext, 500);
            }
            doNext();
        });

        // ── 삭제 ──
        document.getElementById('mm-do-del').addEventListener('click', () => {
            if (selected.size === 0) return;
            const ids = [...selected].sort((a, b) => b - a); // 역순
            if (!confirm(`${ids.length}개 메시지를 삭제할까?\n(#${ids[ids.length - 1]} ~ #${ids[0]})`)) return;
            const textarea = document.getElementById('send_textarea');
            const sendBtn = document.getElementById('send_but');
            if (!textarea || !sendBtn) return;
            const backup = textarea.value;
            let i = 0;

            function doNext() {
                if (i >= ids.length) {
                    setTimeout(() => {
                        textarea.value = backup;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        if (typeof toastr !== 'undefined') toastr.success(`${ids.length}개 삭제 완료!`, 'Edit Tools', { timeOut: 2000 });
                        closeManager();
                    }, 300);
                    return;
                }
                textarea.value = `/cut ${ids[i]}`;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                sendBtn.click();
                i++;
                setTimeout(doNext, 500);
            }
            doNext();
        });

        console.log("[Edit Tools] 📋 메시지 관리 활성화!");
    }

    // ═════════════════════════════════════════════
    // 🚀 초기화
    // ═════════════════════════════════════════════
    initCutButton();
    initPartialEdit();
    initMessageManager();

    console.log("[Edit Tools] 로드 완료!");
    if (typeof toastr !== 'undefined') {
        toastr.success("Edit Tools 활성화!", "Edit Tools", { timeOut: 2000 });
    }
});
