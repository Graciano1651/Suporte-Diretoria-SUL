class UIManager {
    constructor(storage) {
        this.storage = storage;
        this.currentCategory = '';
        this.currentInfo = 1;
        this.infoInterval = null;
        this.toastTimeouts = new WeakMap();
        this.currentImageFile = null;
        this.imageRemoved = false;
        this.defaultInfoHTML = {};
    }

    restoreCurrentInfoToDefault(infoNum) {
        const infoData = this.storage.getInfo();
        delete infoData[infoNum];
        this.storage.saveInfo(infoData);
        this.loadInfoFromStorage();
        this.loadInfoIntoForm(infoNum);
    }

    hasCustomizedInfo(infoNum) {
        const infoData = this.storage.getInfo();
        return !!infoData[infoNum];
    }

    updateInfoActionButtons(infoNum) {
        const resetBtn = document.getElementById('reset-current-info');
        if (!resetBtn) return;
        resetBtn.disabled = !this.hasCustomizedInfo(infoNum);
    }

    getElements() {
        return {
            cards: document.querySelectorAll('.card'),
            linksGrid: document.getElementById('links-grid'),
            linksTitle: document.getElementById('links-title'),
            linksCount: document.getElementById('links-count'),
            searchInput: document.getElementById('search-input'),
            searchBtn: document.getElementById('search-btn'),
            infoTexts: document.querySelectorAll('.info-text'),
            infoDots: document.querySelectorAll('.info-dot'),
            prevInfoBtn: document.getElementById('prev-info'),
            nextInfoBtn: document.getElementById('next-info'),
            adminPanel: document.getElementById('admin-panel'),
            adminBtn: document.getElementById('admin-btn'),
            closeAdminBtn: document.getElementById('close-admin'),
            adminTabs: document.querySelectorAll('.admin-tab'),
            adminSections: document.querySelectorAll('.admin-section'),
            addLinkBtn: document.getElementById('add-link-btn'),
            adminLinksList: document.getElementById('admin-links-list'),
            saveInfoBtn: document.getElementById('save-info-btn'),
            clearStorageBtn: document.getElementById('clear-storage'),
            adminMessage: document.getElementById('admin-message'),
            authModal: document.getElementById('auth-modal'),
            pinInput: document.getElementById('pin-input'),
            authSubmit: document.getElementById('auth-submit'),
            authCancel: document.getElementById('auth-cancel'),
            authMessage: document.getElementById('auth-message'),
            confirmModal: document.getElementById('confirm-modal'),
            modalMessage: document.getElementById('modal-message'),
            modalCancel: document.getElementById('modal-cancel'),
            modalConfirm: document.getElementById('modal-confirm'),
            pageModal: document.getElementById('page-modal'),
            pageTitle: document.getElementById('page-title'),
            pageContent: document.getElementById('page-content'),
            pageClose: document.getElementById('page-close'),
            infoImage: document.getElementById('info-image'),
            imagePreview: document.getElementById('image-preview'),
            imagePreviewContainer: document.getElementById('image-preview-container'),
            removeImageBtn: document.getElementById('remove-image'),
            infoSelect: document.getElementById('info-select'),
            infoTitle: document.getElementById('info-title'),
            infoContent: document.getElementById('info-content')
        };
    }

    cacheDefaultInfoContent() {
        if (Object.keys(this.defaultInfoHTML).length) return;
        for (let i = 1; i <= 4; i++) {
            const infoText = document.getElementById(`info-text-${i}`);
            if (!infoText) continue;
            this.defaultInfoHTML[i] = infoText.innerHTML;
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        let iconClass = 'fa-info-circle';
        if (type === 'error') iconClass = 'fa-exclamation-triangle';
        if (type === 'success') iconClass = 'fa-check-circle';
        if (type === 'warning') iconClass = 'fa-exclamation-circle';
        const icon = document.createElement('i');
        icon.className = `fas ${iconClass}`;
        const textSpan = document.createElement('span');
        textSpan.textContent = message;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.type = 'button';
        closeBtn.title = 'Fechar notificação';
        const closeIcon = document.createElement('i');
        closeIcon.className = 'fas fa-times';
        closeBtn.appendChild(closeIcon);
        toast.appendChild(icon);
        toast.appendChild(textSpan);
        toast.appendChild(closeBtn);
        toastContainer.appendChild(toast);
        requestAnimationFrame(() => { toast.classList.add('show'); });
        const timeoutId = setTimeout(() => { this.removeToast(toast); }, duration);
        this.toastTimeouts.set(toast, timeoutId);
        closeBtn.addEventListener('click', () => {
            this.cancelToastTimeout(toast);
            this.removeToast(toast);
        });
        return toast;
    }

    cancelToastTimeout(toast) {
        const timeoutId = this.toastTimeouts.get(toast);
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
            this.toastTimeouts.delete(toast);
        }
    }

    removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        this.cancelToastTimeout(toast);
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
            const container = document.getElementById('toast-container');
            if (container && container.children.length === 0) container.remove();
        }, 300);
    }

    loadLinks(category) {
        const { linksGrid, linksTitle, linksCount } = this.getElements();
        this.currentCategory = category;
        const categoryNames = {
            b2b: 'B2B - Portal Empresarial',
            b2c: 'B2C - Suporte ao Cliente',
            materiais: 'Materiais - Sistemas Internos',
            rh: 'RH Acessos - Recursos Humanos'
        };
        linksTitle.textContent = categoryNames[category] || 'Links da Categoria';
        this.clearElement(linksGrid);
        const categoryLinks = this.storage.getLinks()[category] || [];
        linksCount.textContent = String(categoryLinks.length);
        if (!categoryLinks.length) {
            linksGrid.appendChild(this.buildEmptyState('fas fa-folder-open', 'Nenhum link disponível para esta categoria.', 'Adicione links através do painel administrativo.'));
            return;
        }
        categoryLinks.forEach(link => { linksGrid.appendChild(this.buildLinkItem(link)); });
    }

    buildLinkItem(link) {
        const wrapper = document.createElement('div');
        wrapper.className = 'link-item';
        const a = document.createElement('a');
        const href = this.storage.normalizeUrl(link.url);
        if (href) {
            a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
        } else {
            a.href = '#';
            a.addEventListener('click', (e) => { e.preventDefault(); this.showToast('URL inválida ou não configurada', 'error'); });
            a.title = 'URL inválida'; a.classList.add('invalid-link');
        }
        const icon = document.createElement('i'); icon.className = 'fas fa-external-link-alt';
        const text = document.createTextNode(link.nome || 'Link');
        a.appendChild(icon); a.appendChild(text); wrapper.appendChild(a);
        if (link.desc) {
            const p = document.createElement('p'); p.className = 'link-desc'; p.textContent = link.desc; wrapper.appendChild(p);
        }
        if (!href) {
            const warning = document.createElement('div'); warning.className = 'link-warning';
            const warningIcon = document.createElement('i'); warningIcon.className = 'fas fa-exclamation-triangle';
            warning.appendChild(warningIcon); warning.appendChild(document.createTextNode(' URL precisa de correção')); wrapper.appendChild(warning);
        }
        return wrapper;
    }

    setActiveCard(category) {
        const { cards } = this.getElements();
        cards.forEach(card => { card.classList.toggle('active', card.dataset.category === category); });
    }

    performSearch(query) {
        const { linksGrid, linksTitle, linksCount } = this.getElements();
        if (!query) { if (this.currentCategory) this.loadLinks(this.currentCategory); return; }
        this.clearElement(linksGrid);
        const results = this.storage.searchLinks(query);
        linksTitle.textContent = `Resultados para: "${query}"`;
        linksCount.textContent = String(results.length);
        if (!results.length) {
            linksGrid.appendChild(this.buildEmptyState('fas fa-search', `Nenhum resultado encontrado para "${query}".`, 'Tente termos diferentes ou mais genéricos.'));
            return;
        }
        results.forEach(link => { linksGrid.appendChild(this.buildSearchResultItem(link)); });
    }

    buildSearchResultItem(link) {
        const wrapper = document.createElement('div'); wrapper.className = 'link-item';
        const row = document.createElement('div'); row.className = 'link-top-row';
        const a = document.createElement('a');
        const href = this.storage.normalizeUrl(link.url);
        if (href) { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        else {
            a.href = '#'; a.addEventListener('click', (e) => { e.preventDefault(); this.showToast('URL inválida ou não configurada', 'error'); });
            a.title = 'URL inválida'; a.classList.add('invalid-link');
        }
        const icon = document.createElement('i'); icon.className = 'fas fa-external-link-alt';
        a.appendChild(icon); a.appendChild(document.createTextNode(link.nome || 'Link'));
        const badge = document.createElement('span'); badge.className = 'category-badge'; badge.textContent = this.categoryLabel(link.category);
        row.appendChild(a); row.appendChild(badge); wrapper.appendChild(row);
        if (link.desc) { const p = document.createElement('p'); p.className = 'link-desc'; p.textContent = link.desc; wrapper.appendChild(p); }
        if (!href) {
            const warning = document.createElement('div'); warning.className = 'link-warning';
            const warningIcon = document.createElement('i'); warningIcon.className = 'fas fa-exclamation-triangle';
            warning.appendChild(warningIcon); warning.appendChild(document.createTextNode(' URL precisa de correção')); wrapper.appendChild(warning);
        }
        return wrapper;
    }

    categoryLabel(category) {
        const map = { b2b: 'B2B', b2c: 'B2C', materiais: 'Materiais', rh: 'RH' };
        return map[category] || String(category || '').toUpperCase();
    }

    showInfo(infoNum) {
        const { infoTexts, infoDots } = this.getElements();
        this.currentInfo = infoNum;
        infoTexts.forEach(text => text.classList.remove('active'));
        const infoText = document.getElementById(`info-text-${infoNum}`);
        if (infoText) infoText.classList.add('active');
        infoDots.forEach(dot => { dot.classList.toggle('active', Number(dot.dataset.info) === infoNum); });
    }

    showPrevInfo() {
        let newInfo = this.currentInfo - 1;
        if (newInfo < 1) newInfo = this.getElements().infoTexts.length;
        this.showInfo(newInfo);
    }

    showNextInfo() {
        let newInfo = this.currentInfo + 1;
        if (newInfo > this.getElements().infoTexts.length) newInfo = 1;
        this.showInfo(newInfo);
    }

    startInfoRotation() {
        if (this.infoInterval) clearInterval(this.infoInterval);
        this.infoInterval = setInterval(() => this.showNextInfo(), 10000);
    }

    stopInfoRotation() {
        if (this.infoInterval) { clearInterval(this.infoInterval); this.infoInterval = null; }
    }

    loadInfoFromStorage() {
        const infoData = this.storage.getInfo();
        for (let i = 1; i <= 4; i++) {
            const infoText = document.getElementById(`info-text-${i}`);
            if (!infoText) continue;
            const info = infoData[i];
            if (!info || (!info.title && !info.content && !info.imageData)) {
                infoText.classList.remove('has-image-only', 'has-image-with-text');
                if (this.defaultInfoHTML[i] !== undefined) infoText.innerHTML = this.defaultInfoHTML[i];
                continue;
            }
            this.clearElement(infoText);
            const hasImage = !!info.imageData;
            const hasTitle = !!String(info.title || '').trim();
            const hasContent = !!String(info.content || '').trim();
            const hasText = hasTitle || hasContent;
            infoText.classList.remove('has-image-only', 'has-image-with-text');
            if (hasImage && !hasText) infoText.classList.add('has-image-only');
            else if (hasImage && hasText) infoText.classList.add('has-image-with-text');
            if (hasImage) {
                const imageContainer = document.createElement('div'); imageContainer.className = 'info-image-container';
                const img = document.createElement('img');
                img.src = info.imageData; img.alt = hasTitle ? info.title : 'Imagem do informativo'; img.className = 'info-image';
                img.onerror = () => { console.warn('Erro ao carregar imagem'); imageContainer.remove(); };
                imageContainer.appendChild(img); infoText.appendChild(imageContainer);
            }
            if (hasTitle) { const h3 = document.createElement('h3'); h3.textContent = info.title; infoText.appendChild(h3); }
            if (hasContent) {
                const paragraphs = String(info.content).split('\n');
                paragraphs.forEach(line => { if (!line.trim()) return; const p = document.createElement('p'); p.textContent = line; infoText.appendChild(p); });
            }
        }
    }

    setupImageUpload() {
        const { infoImage, imagePreview, imagePreviewContainer, removeImageBtn } = this.getElements();
        if (!infoImage || !imagePreview || !imagePreviewContainer || !removeImageBtn) return;
        infoImage.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            this.imageRemoved = false;
            if (file.size > 2 * 1024 * 1024) { this.showToast('Imagem muito grande. Máximo 2MB.', 'error'); infoImage.value = ''; this.currentImageFile = null; return; }
            if (!file.type.startsWith('image/')) { this.showToast('Arquivo deve ser uma imagem.', 'error'); infoImage.value = ''; this.currentImageFile = null; return; }
            const reader = new FileReader();
            reader.onload = (ev) => { imagePreview.src = String(ev.target.result || ''); imagePreviewContainer.style.display = 'block'; this.currentImageFile = file; };
            reader.readAsDataURL(file);
        });
        removeImageBtn.addEventListener('click', () => {
            infoImage.value = ''; imagePreview.src = '#'; imagePreviewContainer.style.display = 'none'; this.currentImageFile = null; this.imageRemoved = true;
        });
    }

    loadInfoIntoForm(infoNum) {
        const { infoTitle, infoContent, infoImage, imagePreview, imagePreviewContainer } = this.getElements();
        const infoData = this.storage.getInfo();
        const info = infoData[infoNum] || { title: '', content: '', imageData: null };
        infoTitle.value = info.title || '';
        infoContent.value = info.content || '';
        if (info.imageData) { imagePreview.src = info.imageData; imagePreviewContainer.style.display = 'block'; }
        else { imagePreview.src = '#'; imagePreviewContainer.style.display = 'none'; }
        infoImage.value = ''; this.currentImageFile = null; this.imageRemoved = false;
    }

    loadAdminLinks() {
        const { adminLinksList } = this.getElements();
        this.clearElement(adminLinksList);
        const links = this.storage.getLinks();
        const categories = Object.keys(links);
        let totalRendered = 0;
        categories.forEach(category => {
            const categoryLinks = links[category] || [];
            if (!categoryLinks.length) return;
            const title = document.createElement('div'); title.className = 'category-title';
            const h5 = document.createElement('h5'); h5.textContent = category.toUpperCase();
            title.appendChild(h5); adminLinksList.appendChild(title);
            categoryLinks.forEach((link, index) => { adminLinksList.appendChild(this.buildAdminLinkItem(category, link, index)); totalRendered++; });
        });
        if (!totalRendered) adminLinksList.appendChild(this.buildEmptyState('fas fa-folder-open', 'Nenhum link cadastrado.', ''));
    }

    buildAdminLinkItem(category, link, index) {
        const item = document.createElement('div'); item.className = 'link-admin-item';
        const info = document.createElement('div'); info.className = 'link-admin-info';
        const h5 = document.createElement('h5'); h5.textContent = link.nome || 'Link';
        const pUrl = document.createElement('p'); pUrl.textContent = link.url || '';
        info.appendChild(h5); info.appendChild(pUrl);
        if (link.desc) { const pDesc = document.createElement('p'); pDesc.textContent = link.desc; info.appendChild(pDesc); }
        if (!this.storage.validateUrl(link.url)) {
            const warning = document.createElement('p'); warning.className = 'url-warning';
            const warningIcon = document.createElement('i'); warningIcon.className = 'fas fa-exclamation-triangle';
            warning.appendChild(warningIcon); warning.appendChild(document.createTextNode(' URL inválida')); info.appendChild(warning);
        }
        const btn = document.createElement('button');
        btn.className = 'delete-link'; btn.type = 'button'; btn.title = 'Excluir link';
        btn.dataset.category = category; btn.dataset.index = index;
        const icon = document.createElement('i'); icon.className = 'fas fa-trash'; btn.appendChild(icon);
        item.appendChild(info); item.appendChild(btn);
        return item;
    }

    showAuthModal() {
        const { authModal, pinInput, authMessage } = this.getElements();
        pinInput.value = ''; authMessage.textContent = ''; authMessage.className = 'auth-message';
        authModal.classList.add('active'); pinInput.focus();
    }
    hideAuthModal() { this.getElements().authModal.classList.remove('active'); }
    showConfirmModal(message) { const { confirmModal, modalMessage } = this.getElements(); modalMessage.textContent = message; confirmModal.classList.add('active'); }
    hideConfirmModal() { this.getElements().confirmModal.classList.remove('active'); }
    showPageModal(title, content) {
        const { pageModal, pageTitle, pageContent } = this.getElements();
        pageTitle.textContent = title; this.clearElement(pageContent);
        if (typeof content === 'string') pageContent.innerHTML = content;
        else if (content instanceof HTMLElement) pageContent.appendChild(content);
        pageModal.classList.add('active');
    }
    hidePageModal() { this.getElements().pageModal.classList.remove('active'); }

    showAdminMessage(message, type) {
        const { adminMessage } = this.getElements();
        adminMessage.textContent = message; adminMessage.className = 'admin-message ' + (type || '');
        if (message) { setTimeout(() => { adminMessage.textContent = ''; adminMessage.className = 'admin-message'; }, 5000); }
    }
    showAuthMessage(message, type) {
        const { authMessage } = this.getElements();
        authMessage.textContent = message; authMessage.className = 'auth-message ' + (type || '');
        if (message) { setTimeout(() => { authMessage.textContent = ''; authMessage.className = 'auth-message'; }, 3000); }
    }

    clearElement(el) { if (el) { while (el.firstChild) { el.removeChild(el.firstChild); } } }

    buildEmptyState(iconClass, line1, line2) {
        const wrap = document.createElement('div'); wrap.className = 'empty-state';
        const i = document.createElement('i'); i.className = iconClass;
        const p1 = document.createElement('p'); p1.textContent = line1;
        wrap.appendChild(i); wrap.appendChild(p1);
        if (line2) { const p2 = document.createElement('p'); p2.textContent = line2; wrap.appendChild(p2); }
        return wrap;
    }
}
