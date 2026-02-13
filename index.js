// ═══════════════════════════════════════════════════════
// Edit Tools v1.1 - SillyTavern Extension
// 가위 버튼 + 부분 수정 + 일괄 관리
// ═══════════════════════════════════════════════════════

jQuery(async () => {
    const extName = "Edit Tools";
    const settingsKey = "editTools";

    console.log(`🔧 ${extName} 로딩...`);

    // ─────────────────────────────────────────────
    // 0. 설정 관리
    // ─────────────────────────────────────────────
    const defaultSettings = {
        enableCutButton: true,
        enablePartialEdit: true,
        enableBulkManage: true,
    };

    function getSettings() {
        if (!window.extension_settings) window.extension_settings = {};
        if (!window.extension_settings[settingsKey]) {
            window.extension_settings[settingsKey] = { ...defaultSettings };
        }
        return window.extension_settings[settingsKey];
    }

    function saveSettingsDebounced() {
        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                if (ctx && typeof ctx.saveSettingsDebounced === 'function') {
                    ctx.saveSettingsDebounced();
                }
            }
        } catch(e) {}
    }

    // 설정 패널 HTML 삽입
    const settingsHtml = `
    <div class="et-settings-container" id="et-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Edit Tools 설정</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label>
                    <input type="checkbox" id="et-opt-cut" />
                    ✂️ 가위(삭제) 버튼
                </label>
                <label>
                    <input type="checkbox" id="et-opt-partial" />
                    ✏️ 부분 수정 (드래그)
                </label>
                <label>
                    <input type="checkbox" id="et-opt-bulk" />
                    📋 일괄 관리 버튼
                </label>
            </div>
        </div>
    </div>`;

    // 확장 설정 영역에 추가
    const settingsContainer = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (settingsContainer) {
        settingsContainer.insertAdjacentHTML('beforeend', settingsHtml);
    }

    // 체크박스 초기화 및 이벤트
    const s = getSettings();
    const cutCb = document.getElementById('et-opt-cut');
    const partialCb = document.getElementById('et-opt-partial');
    const bulkCb = document.getElementById('et-opt-bulk');

    if (cutCb) { cutCb.checked = s.enableCutButton; cutCb.addEventListener('change', () => { s.enableCutButton = cutCb.checked; saveSettingsDebounced(); toggleCutButton(); }); }
    if (partialCb) { partialCb.checked = s.enablePartialEdit; partialCb.addEventListener('change', () => { s.enablePartialEdit = partialCb.checked; saveSettingsDebounced(); togglePartialEdit(); }); }
    if (bulkCb) { bulkCb.checked = s.enableBulkManage; bulkCb.addEventListener('change', () => { s.enableBulkManage = bulkCb.checked; saveSettingsDebounced(); toggleBulkManage(); }); }

    // ─────────────────────────────────────────────
    // ✂️ 파트 1: 가위(삭제) 버튼
    // ─────────────────────────────────────────────
    let cutObserver = null;

    function upsertDeleteButtons() {
        if (!getSettings().enableCutButton) return;
        const messages = document.querySelectorAll('.mes');
        messages.forEach(mes => {
            const currentId = mes.getAttribute('mesid');
            if (!currentId) return;
            const target = mes.querySelector('.extraMesButtons') || mes.querySelector('.mes_button') || mes.querySelector('.mes_buttons');
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
                    setTimeout(() => { textarea.value = backup; textarea.dispatchEvent(new Event('input', { bubbles: true })); }, 50);
                });
                target.prepend(cutBtn);
            }
            cutBtn.dataset.mesid = currentId;
            cutBtn.title = `${currentId}번 메시지 삭제`;
        });
    }

    function toggleCutButton() {
        if (getSettings().enableCutButton) {
            if (!cutObserver) {
                const chat = document.getElementById('chat');
                if (chat) {
                    cutObserver = new MutationObserver(upsertDeleteButtons);
                    cutObserver.observe(chat, { childList: true, subtree: true });
                    upsertDeleteButtons();
                }
            }
        } else {
            if (cutObserver) { cutObserver.disconnect(); cutObserver = null; }
            document.querySelectorAll('.custom-cut-btn').forEach(el => el.remove());
        }
    }

    // ─────────────────────────────────────────────
    // ✏️ 파트 2: 부분 수정
    // ─────────────────────────────────────────────
    let peActive = false;

    function initPartialEdit() {
        const editBtn = document.createElement('div');
        editBtn.id = 'pe-float-btn';
        editBtn.textContent = '✏️ 부분 수정';
        document.body.appendChild(editBtn);

        const bg = document.createElement('div');
        bg.id = 'pe-bg';
        document.body.appendChild(bg);

        const popup = document.createElement('div');
        popup.id = 'pe-popup';
        popup.innerHTML = `
            <div class="pe-hdr"><span>부분 수정</span><span class="pe-badge" id="pe-badge"></span></div>
            <div class="pe-orig-label">▼ 찾을 텍스트 (수정 가능)</div>
            <textarea class="pe-orig" id="pe-orig" placeholder="원문에서 찾을 텍스트" rows="1"></textarea>
            <textarea id="pe-ta" placeholder="바꿀 내용을 입력하세요..."></textarea>
            <div class="pe-btns">
                <div class="pe-b pe-b-save" id="pe-save">✔ 저장</div>
                <div class="pe-b pe-b-del" id="pe-del">🗑 삭제</div>
                <div class="pe-b pe-b-cancel" id="pe-cancel">✖ 취소</div>
            </div>`;
        document.body.appendChild(popup);

        const badgeEl = document.getElementById('pe-badge');
        const origEl = document.getElementById('pe-orig');
        const ta = document.getElementById('pe-ta');
        const saveBtn = document.getElementById('pe-save');
        const delBtn = document.getElementById('pe-del');
        const cancelBtn = document.getElementById('pe-cancel');
        let state = { selectedText: '', mesId: null };

        function getCtx() { try { return SillyTavern.getContext(); } catch(e) { return null; } }
        function getRawText(mesId) { const c = getCtx(); return (c && c.chat && c.chat[mesId]) ? c.chat[mesId].mes : null; }

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
            const mds = ['***','**','*','__','_','~~'];
            for (const md of mds) {
                let s = md+text+md, idx = raw.indexOf(s);
                if (idx !== -1) return {index:idx,matched:s};
                const ep = text.match(/^(.+?)([.!?,;:'")\]}>…]+)$/);
                if (ep) { s=md+ep[1]+md+ep[2]; idx=raw.indexOf(s); if(idx!==-1) return {index:idx,matched:s}; }
                const sp = text.match(/^([.!?,;:'"(\[{<…]+)(.+)$/);
                if (sp) { s=sp[1]+md+sp[2]+md; idx=raw.indexOf(s); if(idx!==-1) return {index:idx,matched:s}; }
                const si = text.indexOf(' ');
                if (si > 0) {
                    const f=text.substring(0,si), r=text.substring(si);
                    const fp=f.match(/^(.+?)([.!?,;:]+)$/);
                    s = fp ? md+fp[1]+md+fp[2]+r : md+f+md+r;
                    idx=raw.indexOf(s); if(idx!==-1) return {index:idx,matched:s};
                    const li=text.lastIndexOf(' ');
                    s=text.substring(0,li+1)+md+text.substring(li+1)+md;
                    idx=raw.indexOf(s); if(idx!==-1) return {index:idx,matched:s};
                }
            }
            return null;
        }

        function findInRaw(raw, sel) {
            const vars = getVariants(sel);
            for (const v of vars) { const i=raw.indexOf(v); if(i!==-1) return {index:i,matched:v}; }
            for (const v of vars) { const r=findWithMarkdown(raw,v); if(r) return r; }
            return null;
        }

        function updateDOM(ctx, mesId, updated) {
            const el = document.querySelector('.mes[mesid="'+mesId+'"]');
            if (!el) return;
            const mt = el.querySelector('.mes_text');
            if (!mt) return;
            try {
                if (typeof ctx.messageFormatting === 'function') {
                    const c = ctx.chat[mesId];
                    mt.innerHTML = ctx.messageFormatting(updated, c.name, c.is_system, c.is_user, mesId);
                } else { mt.innerHTML = updated.replace(/\n/g,'<br>'); }
            } catch(e) { mt.innerHTML = updated.replace(/\n/g,'<br>'); }
        }

        function applyEditDirect(mesId, index, length, newText) {
            const ctx = getCtx();
            if (!ctx || !ctx.chat || !ctx.chat[mesId]) return false;
            const orig = ctx.chat[mesId].mes;
            const updated = orig.substring(0,index) + newText + orig.substring(index+length);
            ctx.chat[mesId].mes = updated;
            updateDOM(ctx, mesId, updated);
            if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
            else if (typeof ctx.saveChat === 'function') ctx.saveChat();
            return true;
        }

        function toast(msg) { try { toastr.success(msg, extName, {timeOut:2000}); } catch(e) { console.log('✏️ '+msg); } }
        function findMes(node) { if(!node) return null; const el = node.nodeType===Node.TEXT_NODE ? node.parentElement : node; return el ? el.closest('.mes') : null; }
        function autoResize(el) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; }

        function onSelect() {
            if (!getSettings().enablePartialEdit) return;
            if (bg.classList.contains('pe-show')) return;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount===0 || !sel.toString().trim()) { editBtn.style.display='none'; return; }
            const text = sel.toString().trim();
            const aM = findMes(sel.anchorNode), fM = findMes(sel.focusNode);
            if (!aM || !fM) { editBtn.style.display='none'; return; }
            if (aM.getAttribute('mesid') !== fM.getAttribute('mesid')) { editBtn.style.display='none'; return; }
            const mt = aM.querySelector('.mes_text');
            if (!mt || !mt.contains(sel.anchorNode)) { editBtn.style.display='none'; return; }
            state.selectedText = text;
            state.mesId = parseInt(aM.getAttribute('mesid'),10);
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            let l = rect.left+rect.width/2-55;
            l = Math.max(8, Math.min(l, window.innerWidth-120));
            let t = rect.bottom+22;
            if (t+40 > window.innerHeight) t = rect.top-50;
            editBtn.style.left=l+'px'; editBtn.style.top=t+'px'; editBtn.style.display='block';
        }

        function positionPopup() {
            const vv=window.visualViewport, vH=vv?vv.height:window.innerHeight, vT=vv?vv.offsetTop:0, vW=vv?vv.width:window.innerWidth;
            popup.style.display='block'; popup.style.visibility='hidden';
            const pH=popup.offsetHeight, pW=popup.offsetWidth;
            popup.style.visibility='visible';
            popup.style.top=(vT+Math.max(10,(vH-pH)/2))+'px';
            popup.style.left=(Math.max(5,(vW-pW)/2))+'px';
        }

        function openPopup() {
            editBtn.style.display='none';
            if (!state.selectedText || state.mesId===null) return;
            origEl.value = state.selectedText; ta.value = state.selectedText;
            const raw = getRawText(state.mesId);
            if (raw) {
                const found = findInRaw(raw, state.selectedText);
                if (found) {
                    const type = (found.matched===state.selectedText)?'exact':'fuzzy';
                    badgeEl.textContent=type+' 100%'; badgeEl.style.background='#2ecc71';
                } else { badgeEl.textContent='매칭실패'; badgeEl.style.background='#e74c3c'; }
            } else { badgeEl.textContent='실패'; badgeEl.style.background='#e74c3c'; }
            bg.classList.add('pe-show'); popup.classList.add('pe-show');
            window.getSelection().removeAllRanges();
            positionPopup(); autoResize(origEl);
            setTimeout(()=>{autoResize(origEl);positionPopup();},50);
            setTimeout(()=>{ta.focus();},100);
            setTimeout(positionPopup,400); setTimeout(positionPopup,800);
        }

        function closePopup() {
            bg.classList.remove('pe-show'); popup.classList.remove('pe-show');
            popup.style.display='none'; ta.value=''; origEl.value='';
            state = { selectedText:'', mesId:null };
        }

        function updateBadge() {
            const raw = getRawText(state.mesId);
            if (!raw) { badgeEl.textContent='실패'; badgeEl.style.background='#e74c3c'; return; }
            const found = findInRaw(raw, origEl.value);
            if (found) {
                badgeEl.textContent = (found.matched===origEl.value)?'exact 100%':'fuzzy ✓';
                badgeEl.style.background = (found.matched===origEl.value)?'#2ecc71':'#3498db';
            } else { badgeEl.textContent='매칭실패'; badgeEl.style.background='#e74c3c'; }
        }

        const chatEl = document.getElementById('chat');
        if (chatEl) {
            chatEl.addEventListener('mouseup', e => { if(!editBtn.contains(e.target)) setTimeout(onSelect,80); });
            chatEl.addEventListener('touchend', e => { if(!editBtn.contains(e.target)) setTimeout(onSelect,350); });
        }
        document.addEventListener('selectionchange', () => {
            if (bg.classList.contains('pe-show')) return;
            clearTimeout(window.__peSelTimer);
            window.__peSelTimer = setTimeout(()=>{
                const s=window.getSelection();
                if(!s||!s.toString().trim()) editBtn.style.display='none'; else onSelect();
            },200);
        });

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize',()=>{ if(popup.classList.contains('pe-show')) positionPopup(); });
            window.visualViewport.addEventListener('scroll',()=>{ if(popup.classList.contains('pe-show')) positionPopup(); });
        }

        editBtn.addEventListener('click', e=>{e.preventDefault();e.stopPropagation();openPopup();});
        editBtn.addEventListener('touchend', e=>{e.preventDefault();e.stopPropagation();openPopup();});
        bg.addEventListener('click', closePopup);
        bg.addEventListener('touchend', e=>{e.preventDefault();closePopup();});

        ta.addEventListener('input', updateBadge);
        origEl.addEventListener('input', ()=>{updateBadge();autoResize(origEl);});

        saveBtn.addEventListener('click', ()=>{
            const nw=ta.value, key=origEl.value, raw=getRawText(state.mesId);
            if(!raw){toast("수정 실패 ㅠ");closePopup();return;}
            const found=findInRaw(raw,key);
            if(found){
                if(found.matched===nw){closePopup();return;}
                toast(applyEditDirect(state.mesId,found.index,found.matched.length,nw)?"수정 완료!":"수정 실패 ㅠ");
            } else { toast("수정 실패 - 매칭 안 됨 ㅠ"); }
            closePopup();
        });
        delBtn.addEventListener('click', ()=>{
            if(!confirm('삭제?\n"'+(state.selectedText.length>30?state.selectedText.substring(0,30)+'...':state.selectedText)+'"')) return;
            const raw=getRawText(state.mesId);
            if(!raw){toast("삭제 실패 ㅠ");closePopup();return;}
            const found=findInRaw(raw,state.selectedText);
            toast(found&&applyEditDirect(state.mesId,found.index,found.matched.length,'')?"삭제 완료!":"삭제 실패 ㅠ");
            closePopup();
        });
        cancelBtn.addEventListener('click', closePopup);
        ta.addEventListener('keydown', e=>{
            if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveBtn.click();}
            if(e.key==='Escape'){e.preventDefault();closePopup();}
        });

        peActive = true;
    }

    function togglePartialEdit() {
        const btn = document.getElementById('pe-float-btn');
        if (btn && !getSettings().enablePartialEdit) btn.style.display = 'none';
    }

    // ─────────────────────────────────────────────
    // 📋 파트 3: 일괄 관리 (삭제/숨김)
    // ─────────────────────────────────────────────
    let bulkBtnEl = null;

    function initBulkManage() {
        // 일괄관리 버튼 (확장 버튼 영역에)
        bulkBtnEl = document.createElement('div');
        bulkBtnEl.id = 'et-bulk-btn';
        bulkBtnEl.className = 'common_v2_button';
        bulkBtnEl.innerHTML = '<i class="fa-solid fa-list-check"></i>';
        bulkBtnEl.title = '메시지 일괄 관리';
        bulkBtnEl.style.cssText = 'cursor:pointer;';
        bulkBtnEl.addEventListener('click', openBulkPopup);

        // 확장 버튼 영역 찾기
        const extBtnArea = document.getElementById('extensionsMenuButton') || document.querySelector('#form_sheld .mes_buttons');
        if (extBtnArea && extBtnArea.parentElement) {
            extBtnArea.parentElement.insertBefore(bulkBtnEl, extBtnArea.nextSibling);
        } else {
            // fallback: 하단 바 영역
            const bottomBar = document.getElementById('form_sheld');
            if (bottomBar) bottomBar.appendChild(bulkBtnEl);
        }

        // 팝업
        const bulkBg = document.createElement('div');
        bulkBg.id = 'et-bulk-bg';
        document.body.appendChild(bulkBg);

        const bulkPopup = document.createElement('div');
        bulkPopup.id = 'et-bulk-popup';
        bulkPopup.innerHTML = `
            <div class="et-bulk-hdr">
                <span>📋 메시지 일괄 관리</span>
                <span class="et-bulk-count" id="et-bulk-count">0개 선택</span>
            </div>
            <div class="et-bulk-list" id="et-bulk-list"></div>
            <div class="et-bulk-actions">
                <div class="pe-b et-b-selall" id="et-bulk-selall">전체</div>
                <div class="pe-b et-b-hide" id="et-bulk-hide">🙈 숨김</div>
                <div class="pe-b et-b-cut" id="et-bulk-cut">✂️ 삭제</div>
                <div class="pe-b et-b-close" id="et-bulk-close">✖ 닫기</div>
            </div>`;
        document.body.appendChild(bulkPopup);

        const countEl = document.getElementById('et-bulk-count');
        const listEl = document.getElementById('et-bulk-list');
        let selected = new Set();

        function getCtx() { try { return SillyTavern.getContext(); } catch(e) { return null; } }

        function updateCount() { countEl.textContent = selected.size + '개 선택'; }

        function openBulkPopup() {
            if (!getSettings().enableBulkManage) return;
            const ctx = getCtx();
            if (!ctx || !ctx.chat) return;

            selected.clear();
            listEl.innerHTML = '';

            // 최신순 (역순)
            for (let i = ctx.chat.length - 1; i >= 0; i--) {
                const msg = ctx.chat[i];
                if (!msg || msg.is_system) continue;
                const preview = (msg.mes || '').replace(/\n/g,' ').substring(0,60);
                const name = msg.name || (msg.is_user ? 'You' : 'AI');

                const item = document.createElement('div');
                item.className = 'et-bulk-item';
                item.dataset.mesid = i;
                item.innerHTML = `
                    <input type="checkbox" class="et-bulk-cb" data-id="${i}">
                    <div class="et-bulk-info">
                        <span class="et-bulk-id">[${i}]</span>
                        <span class="et-bulk-name">${name}</span>
                        <div class="et-bulk-preview">${preview || '(빈 메시지)'}</div>
                    </div>`;
                item.addEventListener('click', e => {
                    if (e.target.tagName === 'INPUT') return;
                    const cb = item.querySelector('.et-bulk-cb');
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                });
                item.querySelector('.et-bulk-cb').addEventListener('change', e => {
                    const id = parseInt(e.target.dataset.id, 10);
                    if (e.target.checked) { selected.add(id); item.classList.add('et-selected'); }
                    else { selected.delete(id); item.classList.remove('et-selected'); }
                    updateCount();
                });
                listEl.appendChild(item);
            }

            updateCount();
            bulkBg.classList.add('et-show');
            bulkPopup.classList.add('et-show');
            positionBulkPopup();
        }

        function closeBulkPopup() {
            bulkBg.classList.remove('et-show');
            bulkPopup.classList.remove('et-show');
            bulkPopup.style.display = 'none';
        }

        function positionBulkPopup() {
            const vv = window.visualViewport;
            const vH = vv ? vv.height : window.innerHeight;
            const vT = vv ? vv.offsetTop : 0;
            const vW = vv ? vv.width : window.innerWidth;
            bulkPopup.style.display = 'block';
            const pH = bulkPopup.offsetHeight;
            const pW = bulkPopup.offsetWidth;
            bulkPopup.style.top = (vT + Math.max(10, (vH - pH) / 2)) + 'px';
            bulkPopup.style.left = (Math.max(5, (vW - pW) / 2)) + 'px';
        }

        function toast(msg) { try { toastr.success(msg, extName, {timeOut:2000}); } catch(e) { console.log(msg); } }

        // 전체 선택/해제
        document.getElementById('et-bulk-selall').addEventListener('click', () => {
            const cbs = listEl.querySelectorAll('.et-bulk-cb');
            const allChecked = selected.size === cbs.length;
            cbs.forEach(cb => {
                cb.checked = !allChecked;
                cb.dispatchEvent(new Event('change'));
            });
        });

        // 삭제 (역순으로 /cut)
        document.getElementById('et-bulk-cut').addEventListener('click', () => {
            if (selected.size === 0) { toast("선택된 메시지가 없어요!"); return; }
            if (!confirm(`${selected.size}개 메시지를 삭제할까요?`)) return;

            const ids = [...selected].sort((a,b) => b-a); // 큰 번호부터
            const textarea = document.getElementById('send_textarea');
            const sendBtn = document.getElementById('send_but');
            if (!textarea || !sendBtn) return;

            const backup = textarea.value;
            let delay = 0;
            ids.forEach(id => {
                setTimeout(() => {
                    textarea.value = `/cut ${id}`;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    sendBtn.click();
                }, delay);
                delay += 200;
            });
            setTimeout(() => {
                textarea.value = backup;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                toast(`${ids.length}개 메시지 삭제 완료!`);
            }, delay + 100);
            closeBulkPopup();
        });

        // 숨김 (is_system = true로 변경)
        document.getElementById('et-bulk-hide').addEventListener('click', () => {
            if (selected.size === 0) { toast("선택된 메시지가 없어요!"); return; }
            if (!confirm(`${selected.size}개 메시지를 숨길까요?\n(프롬프트에서 제외됩니다)`)) return;

            const ctx = getCtx();
            if (!ctx || !ctx.chat) return;

            selected.forEach(id => {
                if (ctx.chat[id]) {
                    ctx.chat[id].is_system = true;
                    const mesEl = document.querySelector('.mes[mesid="'+id+'"]');
                    if (mesEl) mesEl.style.opacity = '0.3';
                }
            });

            if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
            else if (typeof ctx.saveChat === 'function') ctx.saveChat();

            toast(`${selected.size}개 메시지 숨김 완료!`);
            closeBulkPopup();
        });

        document.getElementById('et-bulk-close').addEventListener('click', closeBulkPopup);
        bulkBg.addEventListener('click', closeBulkPopup);
        bulkBg.addEventListener('touchend', e => { e.preventDefault(); closeBulkPopup(); });
    }

    function toggleBulkManage() {
        if (bulkBtnEl) bulkBtnEl.style.display = getSettings().enableBulkManage ? '' : 'none';
    }

    // ─────────────────────────────────────────────
    // 🚀 초기화
    // ─────────────────────────────────────────────
    toggleCutButton();
    initPartialEdit();
    initBulkManage();

    console.log(`🔧 ${extName} 로드 완료!`);
    try { toastr.success("Edit Tools 활성화!", extName, { timeOut: 2000 }); } catch(e) {}
});
