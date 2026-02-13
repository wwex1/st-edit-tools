// ═══════════════════════════════════════════════════════
// Edit Tools - 가위 버튼 + 미니 수정 (SillyTavern Extension)
// ═══════════════════════════════════════════════════════

const MODULE_NAME = "st-edit-tools";
const defaultSettings = {
    enableCut: true,
    enableEdit: true,
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
    try {
        const extPath = `scripts/extensions/third_party/${MODULE_NAME}`;
        const res = await fetch(`/${extPath}/settings.html`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        $("#extensions_settings2").append(html);

        // 체크박스 초기값
        $("#et_enable_cut").prop("checked", settings.enableCut);
        $("#et_enable_edit").prop("checked", settings.enableEdit);

        // 이벤트
        $("#et_enable_cut").on("change", function () {
            settings.enableCut = !!$(this).prop("checked");
            save();
            applyCutVisibility();
        });
        $("#et_enable_edit").on("change", function () {
            settings.enableEdit = !!$(this).prop("checked");
            save();
            applyEditVisibility();
        });

        console.log("[Edit Tools] 설정 패널 로드 성공!");
    } catch (e) {
        console.warn("[Edit Tools] 설정 패널 로드 실패, HTML 직접 삽입 시도...", e);
        // fallback: HTML 직접 삽입
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
                </div>
            </div>
        </div>`;
        $("#extensions_settings2").append(fallbackHtml);

        $("#et_enable_cut").prop("checked", settings.enableCut);
        $("#et_enable_edit").prop("checked", settings.enableEdit);

        $("#et_enable_cut").on("change", function () {
            settings.enableCut = !!$(this).prop("checked");
            save();
            applyCutVisibility();
        });
        $("#et_enable_edit").on("change", function () {
            settings.enableEdit = !!$(this).prop("checked");
            save();
            applyEditVisibility();
        });
    }

    // ─────────────────────────────────────────────
    // ✂️ 파트 1: 가위(삭제) 버튼
    // ─────────────────────────────────────────────
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
                        e.preventDefault();
                        e.stopPropagation();

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

    // ─────────────────────────────────────────────
    // ✏️ 파트 2: 미니 수정
    // ─────────────────────────────────────────────
    let editEnabled = settings.enableEdit;

    function applyEditVisibility() {
        editEnabled = settings.enableEdit;
        const floatBtn = document.getElementById('pe-float-btn');
        if (floatBtn && !editEnabled) {
            floatBtn.style.display = 'none';
        }
    }

    function initPartialEdit() {
        const { getContext } = SillyTavern;

        // UI 생성
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

        // ── 유틸 함수 ──
        function getRawText(mesId) {
            try {
                const ctx = getContext();
                if (ctx && ctx.chat && ctx.chat[mesId]) return ctx.chat[mesId].mes;
            } catch (e) {}
            return null;
        }

        function getVariants(text) {
            const variants = [text];
            if (text.includes('…')) variants.push(text.replace(/\u2026/g, '...'));
            if (text.includes('...')) variants.push(text.replace(/\.\.\./g, '…'));
            if (text.includes("'")) {
                variants.push(text.replace(/'/g, '\u2018'));
                variants.push(text.replace(/'/g, '\u2019'));
            }
            if (text.includes('\u2018') || text.includes('\u2019')) {
                variants.push(text.replace(/[\u2018\u2019]/g, "'"));
            }
            if (text.includes('"')) {
                variants.push(text.replace(/"/g, '\u201C'));
                variants.push(text.replace(/"/g, '\u201D'));
            }
            if (text.includes('\u201C') || text.includes('\u201D')) {
                variants.push(text.replace(/[\u201C\u201D]/g, '"'));
            }
            if (text.includes('--')) variants.push(text.replace(/--/g, '\u2014'));
            if (text.includes('\u2014')) variants.push(text.replace(/\u2014/g, '--'));
            if (text.includes('\u2013')) variants.push(text.replace(/\u2013/g, '-'));
            return variants;
        }

        function findWithMarkdown(raw, text) {
            const mdSymbols = ['***', '**', '*', '__', '_', '~~'];
            for (const md of mdSymbols) {
                let search = md + text + md;
                let idx = raw.indexOf(search);
                if (idx !== -1) return { index: idx, matched: search };

                const endPunctMatch = text.match(/^(.+?)([.!?,;:'")\]}>…]+)$/);
                if (endPunctMatch) {
                    search = md + endPunctMatch[1] + md + endPunctMatch[2];
                    idx = raw.indexOf(search);
                    if (idx !== -1) return { index: idx, matched: search };
                }

                const startPunctMatch = text.match(/^([.!?,;:'"(\[{<…]+)(.+)$/);
                if (startPunctMatch) {
                    search = startPunctMatch[1] + md + startPunctMatch[2] + md;
                    idx = raw.indexOf(search);
                    if (idx !== -1) return { index: idx, matched: search };
                }

                const spaceIdx = text.indexOf(' ');
                if (spaceIdx > 0) {
                    const first = text.substring(0, spaceIdx);
                    const rest = text.substring(spaceIdx);
                    const fp = first.match(/^(.+?)([.!?,;:]+)$/);
                    if (fp) {
                        search = md + fp[1] + md + fp[2] + rest;
                    } else {
                        search = md + first + md + rest;
                    }
                    idx = raw.indexOf(search);
                    if (idx !== -1) return { index: idx, matched: search };

                    const lastSpaceIdx = text.lastIndexOf(' ');
                    const front = text.substring(0, lastSpaceIdx + 1);
                    const last = text.substring(lastSpaceIdx + 1);
                    search = front + md + last + md;
                    idx = raw.indexOf(search);
                    if (idx !== -1) return { index: idx, matched: search };
                }
            }
            return null;
        }

        function findInRaw(raw, selectedText) {
            const vars = getVariants(selectedText);
            for (const v of vars) {
                const idx = raw.indexOf(v);
                if (idx !== -1) return { index: idx, matched: v };
            }
            for (const v of vars) {
                const mdResult = findWithMarkdown(raw, v);
                if (mdResult) return mdResult;
            }
            return null;
        }

        function updateDOM(ctx, mesId, updated) {
            const mesEl = document.querySelector('.mes[mesid="' + mesId + '"]');
            if (mesEl) {
                const mt = mesEl.querySelector('.mes_text');
                if (mt) {
                    try {
                        if (typeof ctx.messageFormatting === 'function') {
                            const c = ctx.chat[mesId];
                            mt.innerHTML = ctx.messageFormatting(updated, c.name, c.is_system, c.is_user, mesId);
                        } else {
                            mt.innerHTML = updated.replace(/\n/g, '<br>');
                        }
                    } catch (e) {
                        mt.innerHTML = updated.replace(/\n/g, '<br>');
                    }
                }
            }
        }

        function doSaveChat(ctx) {
            if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
            else if (typeof ctx.saveChat === 'function') ctx.saveChat();
        }

        function applyEditDirect(mesId, index, length, newText) {
            try {
                const ctx = getContext();
                if (!ctx || !ctx.chat || !ctx.chat[mesId]) return false;
                const orig = ctx.chat[mesId].mes;
                const updated = orig.substring(0, index) + newText + orig.substring(index + length);
                ctx.chat[mesId].mes = updated;
                updateDOM(ctx, mesId, updated);
                doSaveChat(ctx);
                return true;
            } catch (e) {
                console.error("[Edit Tools] 에러:", e);
                return false;
            }
        }

        function toast(msg) {
            try { if (typeof toastr !== 'undefined') { toastr.success(msg, 'Edit Tools', { timeOut: 2000 }); return; } } catch (e) {}
            console.log("[Edit Tools] " + msg);
        }

        // ── 선택 감지 ──
        const chatEl = document.getElementById('chat');
        if (!chatEl) return;

        function findMes(node) {
            if (!node) return null;
            let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            return el ? el.closest('.mes') : null;
        }

        function onSelect() {
            if (!editEnabled) { editBtn.style.display = 'none'; return; }
            if (bg.classList.contains('pe-show')) return;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || !sel.toString().trim()) {
                editBtn.style.display = 'none';
                return;
            }
            const text = sel.toString().trim();
            const aMes = findMes(sel.anchorNode);
            const fMes = findMes(sel.focusNode);
            if (!aMes || !fMes) { editBtn.style.display = 'none'; return; }
            if (aMes.getAttribute('mesid') !== fMes.getAttribute('mesid')) { editBtn.style.display = 'none'; return; }
            const mt = aMes.querySelector('.mes_text');
            if (!mt || !mt.contains(sel.anchorNode)) { editBtn.style.display = 'none'; return; }

            state.selectedText = text;
            state.mesId = parseInt(aMes.getAttribute('mesid'), 10);

            const rect = sel.getRangeAt(0).getBoundingClientRect();
            let l = rect.left + rect.width / 2 - 55;
            l = Math.max(8, Math.min(l, window.innerWidth - 120));
            let t = rect.bottom + 22;
            if (t + 40 > window.innerHeight) t = rect.top - 50;

            editBtn.style.left = l + 'px';
            editBtn.style.top = t + 'px';
            editBtn.style.display = 'block';
        }

        chatEl.addEventListener('mouseup', e => {
            if (editBtn.contains(e.target)) return;
            setTimeout(onSelect, 80);
        });
        chatEl.addEventListener('touchend', e => {
            if (editBtn.contains(e.target)) return;
            setTimeout(onSelect, 350);
        });
        document.addEventListener('selectionchange', () => {
            if (bg.classList.contains('pe-show')) return;
            clearTimeout(window.__peSelTimer);
            window.__peSelTimer = setTimeout(() => {
                const s = window.getSelection();
                if (!s || !s.toString().trim()) {
                    editBtn.style.display = 'none';
                } else {
                    onSelect();
                }
            }, 200);
        });

        // ── 팝업 위치 ──
        function positionPopup() {
            const vv = window.visualViewport;
            const vH = vv ? vv.height : window.innerHeight;
            const vT = vv ? vv.offsetTop : 0;
            const vW = vv ? vv.width : window.innerWidth;

            popup.style.display = 'block';
            popup.style.visibility = 'hidden';
            const pH = popup.offsetHeight;
            const pW = popup.offsetWidth;
            popup.style.visibility = 'visible';

            const topVal = vT + Math.max(10, (vH - pH) / 2);
            const leftVal = Math.max(5, (vW - pW) / 2);
            popup.style.top = topVal + 'px';
            popup.style.left = leftVal + 'px';
        }

        function autoResize(el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }

        function openPopup() {
            editBtn.style.display = 'none';
            if (!state.selectedText || state.mesId === null) return;

            origEl.value = state.selectedText;
            ta.value = state.selectedText;

            const raw = getRawText(state.mesId);
            if (raw !== null) {
                const found = findInRaw(raw, state.selectedText);
                if (found) {
                    const cnt = raw.split(found.matched).length - 1;
                    if (cnt === 1) { badgeEl.textContent = '매칭 성공'; badgeEl.style.background = '#2ecc71'; }
                    else { badgeEl.textContent = cnt + '개 (첫번째)'; badgeEl.style.background = '#f39c12'; }
                } else {
                    badgeEl.textContent = '매칭 실패'; badgeEl.style.background = '#e74c3c';
                }
            } else {
                badgeEl.textContent = '실패'; badgeEl.style.background = '#e74c3c';
            }

            bg.classList.add('pe-show');
            popup.classList.add('pe-show');
            window.getSelection().removeAllRanges();

            positionPopup();
            autoResize(origEl);
            setTimeout(() => { autoResize(origEl); positionPopup(); }, 50);
            setTimeout(() => { ta.focus(); }, 100);
            setTimeout(positionPopup, 400);
            setTimeout(positionPopup, 800);
        }

        function closePopup() {
            bg.classList.remove('pe-show');
            popup.classList.remove('pe-show');
            popup.style.display = 'none';
            ta.value = '';
            origEl.value = '';
            state = { selectedText: '', mesId: null };
        }

        // 키보드 대응
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                if (popup.classList.contains('pe-show')) positionPopup();
            });
            window.visualViewport.addEventListener('scroll', () => {
                if (popup.classList.contains('pe-show')) positionPopup();
            });
        }

        editBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPopup(); });
        editBtn.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); openPopup(); });
        bg.addEventListener('click', closePopup);
        bg.addEventListener('touchend', e => { e.preventDefault(); closePopup(); });

        // ── 뱃지 업데이트 ──
        function updateBadge() {
            const raw = getRawText(state.mesId);
            if (!raw) { badgeEl.textContent = '실패'; badgeEl.style.background = '#e74c3c'; return; }
            const searchKey = origEl.value;
            let found = findInRaw(raw, searchKey);
            if (found) {
                badgeEl.textContent = '매칭 성공';
                badgeEl.style.background = '#2ecc71';
                return;
            }
            badgeEl.textContent = '매칭 실패';
            badgeEl.style.background = '#e74c3c';
        }

        ta.addEventListener('input', updateBadge);
        origEl.addEventListener('input', () => { updateBadge(); autoResize(origEl); });

        // ── 저장 / 삭제 / 취소 ──
        saveBtn.addEventListener('click', () => {
            const nw = ta.value;
            const searchKey = origEl.value;
            const raw = getRawText(state.mesId);
            if (!raw) { toast("수정 실패 ㅠ"); closePopup(); return; }

            let found = findInRaw(raw, searchKey);
            if (found) {
                if (found.matched === nw) { closePopup(); return; }
                const ok = applyEditDirect(state.mesId, found.index, found.matched.length, nw);
                toast(ok ? "수정 완료!" : "수정 실패 ㅠ");
                closePopup();
                return;
            }
            toast("수정 실패 - 매칭 안 됨 ㅠ");
            closePopup();
        });

        delBtn.addEventListener('click', () => {
            const p = state.selectedText.length > 30 ? state.selectedText.substring(0, 30) + '...' : state.selectedText;
            if (!confirm('삭제?\n"' + p + '"')) return;
            const raw = getRawText(state.mesId);
            if (!raw) { toast("삭제 실패 ㅠ"); closePopup(); return; }
            const found = findInRaw(raw, state.selectedText);
            if (found) {
                const ok = applyEditDirect(state.mesId, found.index, found.matched.length, '');
                toast(ok ? "삭제 완료!" : "삭제 실패 ㅠ");
            } else {
                toast("삭제 실패 - 매칭 안 됨 ㅠ");
            }
            closePopup();
        });

        cancelBtn.addEventListener('click', closePopup);
        ta.addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveBtn.click(); }
            if (e.key === 'Escape') { e.preventDefault(); closePopup(); }
        });

        console.log("[Edit Tools] ✏️ 미니 수정 활성화!");
    }

    // ─────────────────────────────────────────────
    // 🚀 초기화
    // ─────────────────────────────────────────────
    initCutButton();
    initPartialEdit();

    console.log("[Edit Tools] 로드 완료!");
    if (typeof toastr !== 'undefined') {
        toastr.success("가위 버튼 + 미니 수정 활성화!", "Edit Tools", { timeOut: 2000 });
    }
});
