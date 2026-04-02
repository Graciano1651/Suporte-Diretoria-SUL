document.addEventListener('DOMContentLoaded', () => {

    const ui = new UIManager(storage);
    const elements = ui.getElements();

    let appState = {
        isAdminAuthenticated: false,
        confirmCallback: null
    };

    function init() {
        setupCardEvents();
        setupInfoEvents();
        setupSearchEvents();
        setupAdminEvents();
        setupModalEvents();
        setupNavigationEvents();
        setupVisibilityEvents();

        ui.cacheDefaultInfoContent();
        ui.loadInfoFromStorage();
        ui.setupImageUpload();

        if (elements.cards.length) {
            const firstCard = elements.cards[0];
            const firstCategory = firstCard.dataset.category;
            ui.loadLinks(firstCategory);
            ui.setActiveCard(firstCategory);
        }

        ui.startInfoRotation();
    }

    function setupCardEvents() {
        elements.cards.forEach(card => {
            card.addEventListener('click', () => {
                const category = card.dataset.category;
                ui.loadLinks(category);
                ui.setActiveCard(category);
            });
        });
    }

    function setupInfoEvents() {
        elements.prevInfoBtn.addEventListener('click', () => ui.showPrevInfo());
        elements.nextInfoBtn.addEventListener('click', () => ui.showNextInfo());
        elements.infoDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const infoNum = Number(dot.dataset.info);
                ui.showInfo(infoNum);
            });
        });
    }

    function setupSearchEvents() {
        elements.searchBtn.addEventListener('click', () => {
            ui.performSearch(elements.searchInput.value);
        });
        elements.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') ui.performSearch(elements.searchInput.value);
            if (e.key === 'Escape') {
                elements.searchInput.value = '';
                if (ui.currentCategory) ui.loadLinks(ui.currentCategory);
            }
        });
    }

    function setupAdminEvents() {
        elements.adminBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (appState.isAdminAuthenticated) {
                elements.adminPanel.classList.add('active');
                ui.loadAdminLinks();
            } else {
                ui.showAuthModal();
            }
        });

        elements.closeAdminBtn.addEventListener('click', () => {
            elements.adminPanel.classList.remove('active');
        });

        const overlay = document.getElementById('admin-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                elements.adminPanel.classList.remove('active');
            });
        }

        elements.adminTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                elements.adminTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                elements.adminSections.forEach(section => {
                    section.classList.toggle('active', section.id === `admin-${tabId}`);
                });
                if (tabId === 'info') {
                    const infoNum = elements.infoSelect.value;
                    ui.loadInfoIntoForm(infoNum);
                    ui.updateInfoActionButtons(infoNum);
                }
            });
        });

        elements.infoSelect.addEventListener('change', () => {
            const infoNum = elements.infoSelect.value;
            ui.loadInfoIntoForm(infoNum);
            ui.updateInfoActionButtons(infoNum);
        });

        elements.addLinkBtn.addEventListener('click', () => {
            const category = document.getElementById('link-category').value;
            const name = document.getElementById('link-name').value.trim();
            const url = document.getElementById('link-url').value.trim();
            const desc = document.getElementById('link-desc').value.trim();
            if (!name || !url) {
                ui.showAdminMessage('Preencha nome e URL do link.', 'error');
                ui.showToast('Preencha nome e URL do link', 'error');
                return;
            }
            if (!storage.validateUrl(url)) {
                ui.showAdminMessage('URL inválida. Use formato válido (ex: https://site.com).', 'error');
                ui.showToast('URL inválida. Use https://site.com', 'error');
                return;
            }
            const normalizedUrl = storage.normalizeUrl(url);
            if (!normalizedUrl) {
                ui.showAdminMessage('Não foi possível processar a URL. Verifique o formato.', 'error');
                ui.showToast('URL com formato inválido', 'error');
                return;
            }
            try {
                storage.addLink(category, { nome: name, url: normalizedUrl, desc: desc });
                document.getElementById('link-name').value = '';
                document.getElementById('link-url').value = '';
                document.getElementById('link-desc').value = '';
                ui.loadAdminLinks();
                if (ui.currentCategory === category) ui.loadLinks(category);
                ui.showAdminMessage('Link adicionado com sucesso!', 'success');
                ui.showToast('Link adicionado com sucesso!', 'success');
            } catch (error) {
                console.error('Erro ao adicionar link:', error);
                ui.showAdminMessage(error.message || 'Erro ao adicionar link.', 'error');
                ui.showToast(error.message || 'Erro ao adicionar link.', 'error');
            }
        });

        elements.saveInfoBtn.addEventListener('click', async () => {
            const infoNum = elements.infoSelect.value;
            const title = elements.infoTitle.value.trim();
            const content = elements.infoContent.value.trim();
            const imageFile = ui.currentImageFile;
            try {
                const infoData = storage.getInfo();
                const current = infoData[infoNum] || { title: '', content: '', imageData: null, type: 'text' };
                let imageData = current.imageData || null;
                if (ui.imageRemoved) imageData = null;
                if (imageFile) imageData = await storage.imageToBase64(imageFile);
                const hasImage = !!imageData;
                const hasTitle = !!title;
                const hasContent = !!content;
                if (!hasImage && !(hasTitle && hasContent)) {
                    ui.showAdminMessage('Preencha título e conteúdo, ou adicione uma imagem.', 'error');
                    ui.showToast('Preencha título e conteúdo, ou adicione uma imagem', 'error');
                    return;
                }
                infoData[infoNum] = { title, content, imageData, type: hasImage ? 'image' : 'text' };
                storage.saveInfo(infoData);
                ui.loadInfoFromStorage();
                ui.showAdminMessage('Informativo salvo!', 'success');
                ui.showToast('Informativo salvo com sucesso!', 'success');
                ui.updateInfoActionButtons(infoNum);
                ui.currentImageFile = null;
                ui.imageRemoved = false;
            } catch (error) {
                console.error('Erro ao salvar informativo:', error);
                ui.showAdminMessage(error.message || 'Erro ao salvar informativo.', 'error');
                ui.showToast(error.message || 'Erro ao salvar informativo.', 'error');
            }
        });

        elements.clearStorageBtn.addEventListener('click', () => {
            ui.showConfirmModal('Tem certeza que deseja limpar TODOS os dados? Links personalizados, informativos e configurações de PIN serão perdidos e restaurados aos padrões.');
            appState.confirmCallback = () => {
                storage.resetToDefaults();
                ui.loadAdminLinks();
                if (ui.currentCategory) ui.loadLinks(ui.currentCategory);
                ui.loadInfoFromStorage();
                ui.loadInfoIntoForm(elements.infoSelect.value);
                ui.updateInfoActionButtons(elements.infoSelect.value);
                ui.showAdminMessage('Sistema restaurado para padrões de fábrica.', 'success');
                ui.showToast('Sistema restaurado para padrões de fábrica', 'success');
            };
        });

        elements.adminLinksList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-link');
            if (!deleteBtn) return;
            const category = deleteBtn.dataset.category;
            const index = parseInt(deleteBtn.dataset.index);
            const links = storage.getLinks()[category];
            if (links && links[index]) {
                const linkName = links[index].nome;
                ui.showConfirmModal(`Excluir o link "${linkName}"?`);
                appState.confirmCallback = () => {
                    storage.deleteLink(category, index);
                    ui.loadAdminLinks();
                    if (ui.currentCategory === category) ui.loadLinks(category);
                    ui.showAdminMessage('Link excluído.', 'success');
                    ui.showToast('Link excluído com sucesso', 'success');
                };
            }
        });
    }

    const resetCurrentInfoBtn = document.getElementById('reset-current-info');
    if (resetCurrentInfoBtn) {
        resetCurrentInfoBtn.addEventListener('click', () => {
            const infoNum = elements.infoSelect.value;
            if (!ui.hasCustomizedInfo(infoNum)) {
                ui.showToast('Este painel já está no conteúdo padrão.', 'info');
                return;
            }
            ui.showConfirmModal(`Deseja restaurar o Painel ${infoNum} para o conteúdo original?`);
            appState.confirmCallback = () => {
                ui.restoreCurrentInfoToDefault(infoNum);
                ui.showAdminMessage('Painel restaurado ao padrão com sucesso!', 'success');
                ui.showToast('Painel restaurado ao padrão!', 'success');
                ui.updateInfoActionButtons(infoNum);
            };
        });
    }

    function setupModalEvents() {
        const pinInput = document.getElementById('pin-input');
        pinInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
            if (e.target.value.length > 4) e.target.value = e.target.value.slice(0, 4);
        });
        pinInput.addEventListener('blur', () => {
            const value = pinInput.value;
            if (value.length >= 2 && value.length !== 4) ui.showToast('O PIN deve ter 4 dígitos', 'warning');
        });
        elements.authSubmit.addEventListener('click', async () => {
            const pin = pinInput.value;
            if (!pin || pin.length !== 4) { ui.showAuthMessage('Digite exatamente 4 dígitos', 'error'); pinInput.focus(); return; }
            try {
                const isValid = await storage.validatePIN(pin);
                if (isValid) {
                    appState.isAdminAuthenticated = true;
                    ui.hideAuthModal();
                    elements.adminPanel.classList.add('active');
                    ui.loadAdminLinks();
                    ui.showAuthMessage('Acesso concedido!', 'success');
                    ui.showToast('Acesso administrativo concedido', 'success');
                } else {
                    ui.showAuthMessage('PIN incorreto. Tente novamente.', 'error');
                    pinInput.value = ''; pinInput.focus();
                }
            } catch (error) {
                console.error('Erro na validação do PIN:', error);
                ui.showAuthMessage('Erro na validação. Tente novamente.', 'error');
                pinInput.focus();
            }
        });
        elements.authCancel.addEventListener('click', () => { ui.hideAuthModal(); });
        pinInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') elements.authSubmit.click();
            if (e.key === 'Escape') ui.hideAuthModal();
        });
        elements.modalCancel.addEventListener('click', () => { ui.hideConfirmModal(); appState.confirmCallback = null; });
        elements.modalConfirm.addEventListener('click', () => {
            if (typeof appState.confirmCallback === 'function') appState.confirmCallback();
            ui.hideConfirmModal(); appState.confirmCallback = null;
        });
        elements.confirmModal.addEventListener('click', (e) => {
            if (e.target === elements.confirmModal) { ui.hideConfirmModal(); appState.confirmCallback = null; }
        });
        elements.pageClose.addEventListener('click', () => { ui.hidePageModal(); });
        elements.pageModal.addEventListener('click', (e) => { if (e.target === elements.pageModal) ui.hidePageModal(); });
    }

    function setupNavigationEvents() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                switch(page) {
                    case 'home': ui.hidePageModal(); break;
                    case 'sobre': showSobrePage(); break;
                    case 'contato': showContatoPage(); break;
                    case 'admin': break;
                }
            });
        });
    }

    function setupVisibilityEvents() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) ui.stopInfoRotation();
            else ui.startInfoRotation();
        });
    }

    function showSobrePage() {
        const content = `
            <div class="page-content">
                <h4><i class="fas fa-info-circle"></i> Sobre o Suporte Diretoria Sul</h4>
                <p>Este portal foi desenvolvido para centralizar e facilitar o acesso aos recursos e ferramentas utilizados pela Engenharia de Controle de Obras - Rede Externa da Telefónica VIVO.</p>
                <div class="info-box">
                    <h5><i class="fas fa-bullseye"></i> Objetivos</h5>
                    <ul>
                        <li>Centralizar links e ferramentas em um único local</li>
                        <li>Facilitar o acesso rápido a sistemas críticos</li>
                        <li>Compartilhar comunicados e informações relevantes</li>
                        <li>Otimizar o fluxo de trabalho da equipe</li>
                    </ul>
                </div>
                <div class="info-box">
                    <h5><i class="fas fa-shield-alt"></i> Diretrizes de Uso</h5>
                    <ul>
                        <li>O uso é restrito a colaboradores autorizados</li>
                        <li>Mantenha suas credenciais em sigilo</li>
                        <li>Reporte links quebrados ou problemas técnicos</li>
                        <li>Sugestões são bem-vindas para melhoria contínua</li>
                    </ul>
                </div>
                <div class="version-info">
                    <p><strong>Versão:</strong> 2.1.0</p>
                    <p><strong>Última atualização:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
        `;
        ui.showPageModal('Sobre o Sistema', content);
    }

    function showContatoPage() {
        const content = `
            <div class="page-content">
                <h4><i class="fas fa-headset"></i> Suporte e Contato</h4>
                <p>Entre em contato com nossa equipe de suporte para reportar problemas, sugerir melhorias ou obter assistência técnica.</p>
                <div class="contact-grid">
                    <div class="contact-card">
                        <div class="contact-icon"><i class="fas fa-phone"></i></div>
                        <h5>Suporte Técnico</h5>
                        <p><strong>Telefone:</strong> (41) 99728-0210</p>
                        <p><strong>Horário:</strong> 8h às 18h (seg-sex)</p>
                    </div>
                    <div class="contact-card">
                        <div class="contact-icon"><i class="fas fa-envelope"></i></div>
                        <h5>E-mail</h5>
                        <p><strong>Suporte:</strong> guilherme.graciano@telefonica.com</p>
                        <p><strong>RH:</strong> dayane.fagundes@telefonica.com</p>
                    </div>
                    <div class="contact-card">
                        <div class="contact-icon"><i class="fas fa-ticket-alt"></i></div>
                        <h5>Abrir Chamado</h5>
                        <p>Para questões técnicas, abra um chamado:</p>
                        <button class="ticket-btn" onclick="window.open('https://chamados.vivo.com.br', '_blank')">
                            <i class="fas fa-external-link-alt"></i> Sistema de Chamados
                        </button>
                    </div>
                    <div class="contact-card">
                        <div class="contact-icon"><i class="fas fa-map-marker-alt"></i></div>
                        <h5>Localização</h5>
                        <p><strong>Diretoria Sul - Curitiba</strong></p>
                        <p>Rua Iapó, 1408 — Rebouças</p>
                        <p>Curitiba - PR, CEP: 80215-223</p>
                    </div>
                </div>
                <div class="emergency-contact">
                    <h5><i class="fas fa-exclamation-triangle"></i> Contato de Emergência</h5>
                    <p><strong>Plantão Técnico:</strong> (41) 99728-0210 — disponível 24h/7dias</p>
                </div>
            </div>
        `;
        ui.showPageModal('Contato e Suporte', content);
    }

    init();
});
