 const DEFAULT_PIN = '1651';
  class StorageManager {
    constructor() {
        this._links = null;
        this._info = null;
         this._pinHash = null;
    }

    // =========================
    // HASH
    // =========================
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return (hash >>> 0).toString(16);
    }

    async _secureHash(str) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('Web Crypto não disponível, usando hash simples:', error);
            return this._simpleHash(str);
        }
    }

    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // =========================
    // LINKS
    // =========================
    async getLinks() {
        if (this._links) return this._links;

        const { data, error } = await db
            .from('links')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Erro ao buscar links do Supabase:', error);
            throw new Error('Não foi possível carregar os links.');
        }

        const grouped = {
            b2b: [],
            b2c: [],
            materiais: [],
            rh: []
        };

        (data || []).forEach(item => {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push({
                id: item.id,
                nome: item.nome || '',
                url: item.url || '',
                desc: item.descricao || ''
            });
        });

        this._links = grouped;
        return grouped;
    }

    async saveLinks(links) {
        this._links = links;
        return true;
    }

    async ensureDefaultLinks() {
        const { count, error } = await db
            .from('links')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Erro ao verificar links padrão:', error);
            throw new Error('Não foi possível verificar os links iniciais.');
        }

        if ((count || 0) > 0) return;

        const rows = [];

        Object.keys(initialLinksData).forEach(category => {
            initialLinksData[category].forEach(link => {
                rows.push({
                    category,
                    nome: link.nome,
                    url: link.url,
                    descricao: link.desc || ''
                });
            });
        });

        if (!rows.length) return;

        const { error: insertError } = await db.from('links').insert(rows);

        if (insertError) {
            console.error('Erro ao inserir links padrão:', insertError);
            throw new Error('Não foi possível criar os links padrão.');
        }

        this._links = null;
    }

    async addLink(category, link) {
        const payload = {
            category,
            nome: link.nome || '',
            url: link.url || '',
            descricao: link.desc || ''
        };

        const { data, error } = await db
            .from('links')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Erro ao adicionar link:', error);
            throw new Error('Não foi possível adicionar o link.');
        }

        const links = await this.getLinks();

        if (!links[category]) links[category] = [];
        links[category].push({
            id: data.id,
            nome: data.nome,
            url: data.url,
            desc: data.descricao || ''
        });

        this._links = links;
        return links;
    }

    async deleteLink(category, index) {
        const links = await this.getLinks();
        const item = links?.[category]?.[index];

        if (!item) return links;

        const { error } = await db
            .from('links')
            .delete()
            .eq('id', item.id);

        if (error) {
            console.error('Erro ao excluir link:', error);
            throw new Error('Não foi possível excluir o link.');
        }

        links[category].splice(index, 1);
        this._links = links;
        return links;
    }

    async searchLinks(query) {
        const links = await this.getLinks();
        const results = [];
        const q = String(query || '').toLowerCase().trim();

        Object.keys(links).forEach(category => {
            links[category].forEach(link => {
                const name = String(link.nome || '').toLowerCase();
                const desc = String(link.desc || '').toLowerCase();

                if (name.includes(q) || desc.includes(q)) {
                    results.push({ ...link, category });
                }
            });
        });

        return results;
    }

    // =========================
    // INFORMATIVOS
    // =========================
    async getInfo() {
        if (this._info) return this._info;

        const { data, error } = await db
            .from('info_panels')
            .select('*')
            .order('panel_number', { ascending: true });

        if (error) {
            console.error('Erro ao buscar informativos:', error);
            throw new Error('Não foi possível carregar os informativos.');
        }

        const info = {};

        (data || []).forEach(item => {
            info[item.panel_number] = {
                title: item.title || '',
                content: item.content || '',
                imageData: item.image_data || null,
                type: item.type || 'text'
            };
        });

        this._info = info;
        return info;
    }

    async saveInfo(info) {
        try {
            const rows = Object.keys(info).map(key => ({
                panel_number: Number(key),
                title: info[key].title || '',
                content: info[key].content || '',
                image_data: info[key].imageData || null,
                type: info[key].type || 'text'
            }));

            if (rows.length) {
                const { error } = await db
                    .from('info_panels')
                    .upsert(rows, { onConflict: 'panel_number' });

                if (error) {
                    console.error('Erro ao salvar informativos:', error);
                    throw new Error('Não foi possível salvar os informativos.');
                }
            }

            this._info = info;
            return true;
        } catch (error) {
            console.error('Erro ao salvar informativos no Supabase:', error);
            throw error instanceof Error
                ? error
                : new Error('Não foi possível salvar os informativos.');
        }
    }

    async deleteInfoPanel(panelNumber) {
        const { error } = await db
            .from('info_panels')
            .delete()
            .eq('panel_number', Number(panelNumber));

        if (error) {
            console.error('Erro ao restaurar painel:', error);
            throw new Error('Não foi possível restaurar o painel.');
        }

        if (this._info && this._info[panelNumber]) {
            delete this._info[panelNumber];
        }

        return true;
    }

    imageToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve(null);

            const reader = new FileReader();

            reader.onload = (event) => {
                const img = new Image();

                img.onload = () => {
                    const MAX_WIDTH = 1600;
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height = height * (MAX_WIDTH / width);
                        width = MAX_WIDTH;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressed = canvas.toDataURL('image/jpeg', 0.82);
                    resolve(compressed);
                };

                img.onerror = reject;
                img.src = event.target.result;
            };

            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // =========================
    // PIN
    // =========================
    async ensureDefaultPIN() {
        const { data, error } = await db
            .from('app_settings')
            .select('*')
            .eq('key', 'admin_pin_hash')
            .maybeSingle();

        if (error) {
            console.error('Erro ao verificar PIN:', error);
            throw new Error('Não foi possível verificar o PIN.');
        }

        if (data) return;

        const defaultHash = await this._secureHash(DEFAULT_PIN);

        const { error: upsertError } = await db
            .from('app_settings')
            .upsert({
                key: 'admin_pin_hash',
                value: defaultHash
            }, { onConflict: 'key' });

        if (upsertError) {
            console.error('Erro ao criar PIN padrão:', upsertError);
            throw new Error('Não foi possível criar o PIN padrão.');
        }

        this._pinHash = defaultHash;
    }

    async getPINHash() {
        if (this._pinHash) return this._pinHash;

        const { data, error } = await db
            .from('app_settings')
            .select('*')
            .eq('key', 'admin_pin_hash')
            .maybeSingle();

        if (error) {
            console.error('Erro ao buscar PIN:', error);
            throw new Error('Não foi possível validar o PIN.');
        }

        if (!data) {
            await this.ensureDefaultPIN();
            return this._pinHash;
        }

        this._pinHash = data.value;
        return this._pinHash;
    }

    async setPIN(newPIN) {
        if (!newPIN || newPIN.length < 4) return false;

        const hash = await this._secureHash(newPIN);

        const { error } = await db
            .from('app_settings')
            .upsert({
                key: 'admin_pin_hash',
                value: hash
            }, { onConflict: 'key' });

        if (error) {
            console.error('Erro ao salvar novo PIN:', error);
            throw new Error('Não foi possível alterar o PIN.');
        }

        this._pinHash = hash;
        return true;
    }

    async validatePIN(input) {
        if (!input || input.length < 4) return false;

        const inputHash = await this._secureHash(input);
        const storedHash = await this.getPINHash();
        return inputHash === storedHash;
    }

    // =========================
    // RESET
    // =========================
    async clearAll() {
        const linksPromise = db.from('links').delete().neq('id', 0);
        const infoPromise = db.from('info_panels').delete().neq('panel_number', 0);
        const settingsPromise = db.from('app_settings').delete().neq('key', '');

        const [linksRes, infoRes, settingsRes] = await Promise.all([
            linksPromise,
            infoPromise,
            settingsPromise
        ]);

        if (linksRes.error) {
            console.error('Erro ao limpar links:', linksRes.error);
            throw new Error('Erro ao limpar links.');
        }

        if (infoRes.error) {
            console.error('Erro ao limpar informativos:', infoRes.error);
            throw new Error('Erro ao limpar informativos.');
        }

        if (settingsRes.error) {
            console.error('Erro ao limpar configurações:', settingsRes.error);
            throw new Error('Erro ao limpar configurações.');
        }

        this._links = null;
        this._info = null;
        this._pinHash = null;
    }

    async resetToDefaults() {
        await this.clearAll();
        await this.ensureDefaultLinks();
        await this.ensureDefaultPIN();
        this._links = null;
        this._info = null;
    }

    // =========================
    // URL
    // =========================
    validateUrl(url) {
        const raw = String(url || '').trim();
        if (!raw) return false;

        try {
            const withHttps = raw.match(/^https?:\/\//i) ? raw : `https://${raw}`;
            const urlObj = new URL(withHttps);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }

    normalizeUrl(url) {
        const raw = String(url || '').trim();
        if (!raw) return null;

        try {
            const withProtocol = raw.match(/^https?:\/\//i) ? raw : `https://${raw}`;
            const urlObj = new URL(withProtocol);
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return null;
            return urlObj.toString();
        } catch {
            return null;
        }
    }
 }

const initialLinksData = {
    b2b: [
        { nome: 'Portal de Vendas B2B', url: 'https://portalvendas.vivo.com.br/b2b', desc: 'Acesso ao portal de vendas corporativas' },
        { nome: 'Suporte Empresas', url: 'https://suporte.vivo.com.br/empresas', desc: 'Central de suporte para clientes empresariais' },
        { nome: 'CRM Corporativo', url: 'https://crm.vivo.com.br/corporate', desc: 'Sistema de gestão de relacionamento com clientes' },
        { nome: 'Relatórios de Vendas', url: 'https://relatorios.vivo.com.br/b2b', desc: 'Dashboard e relatórios de performance de vendas' }
    ],
    b2c: [
        { nome: 'Portal do Cliente', url: 'https://meuvivo.vivo.com.br', desc: 'Área do cliente para gerenciar serviços' },
        { nome: 'Vendas Online', url: 'https://vendas.vivo.com.br', desc: 'Portal de vendas para clientes residenciais' },
        { nome: 'Central de Atendimento', url: 'https://atendimento.vivo.com.br', desc: 'Canais de atendimento ao cliente' },
        { nome: 'App Meu Vivo', url: 'https://app.vivo.com.br', desc: 'Aplicativo para gerenciamento de conta' }
    ],
    materiais: [
        { nome: 'Sistema de Obras', url: 'https://obras.vivo.com.br', desc: 'Controle e monitoramento de obras de rede' },
        { nome: 'Help Desk TI', url: 'https://helpdesk.vivo.com.br', desc: 'Suporte técnico interno' },
        { nome: 'Gestão de Ativos', url: 'https://ativos.vivo.com.br', desc: 'Controle de ativos de rede e equipamentos' },
        { nome: 'Monitoramento de Rede', url: 'https://monitoramento.vivo.com.br', desc: 'Dashboard de monitoramento em tempo real' }
    ],
    rh: [
        { nome: 'Portal do Colaborador', url: 'https://rh.vivo.com.br/colaborador', desc: 'Acesso aos dados pessoais e holerite' },
        { nome: 'Solicitação de Férias', url: 'https://rh.vivo.com.br/ferias', desc: 'Sistema de solicitação e aprovação de férias' },
        { nome: 'Benefícios', url: 'https://beneficios.vivo.com.br', desc: 'Consulta e gestão de benefícios corporativos' },
        { nome: 'Treinamentos', url: 'https://ead.vivo.com.br', desc: 'Plataforma de treinamentos online' }
    ]
};

 const storage = new StorageManager();