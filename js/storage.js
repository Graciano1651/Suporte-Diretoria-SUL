const STORAGE_KEYS = {  
    links: 'suporteLinks',  
    info: 'suporteInfo',  
    pin: 'suporteAdminPIN'  
};  
  
// PIN padrão  
const DEFAULT_PIN = '1651';  
  
class StorageManager {  
    constructor() {  
        this._links = null;  
        this._pinHash = null;  
        this._pinHashPromise = null;  
    }  
  
    // ====== Hash simples mas consistente ======  
    _simpleHash(str) {  
        let hash = 0;  
        for (let i = 0; i < str.length; i++) {  
            const char = str.charCodeAt(i);  
            hash = ((hash << 5) - hash) + char;  
            hash = hash & hash;  
        }  
        return (hash >>> 0).toString(16);  
    }  
  
    // ====== Hash mais seguro usando Web Crypto API ======  
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
  
    // ====== Links ======  
    getLinks() {  
        if (!this._links) {  
            this._links = this.loadLinksFromStorage();  
        }  
        return this._links;  
    }  
  
    // ====== saveLinks com ordem correta ======  
    saveLinks(links) {  
        try {  
            // Primeiro tenta salvar no localStorage  
            localStorage.setItem(STORAGE_KEYS.links, JSON.stringify(links));  
            // Só atualiza o cache em memória após sucesso  
            this._links = links;  
            return true;  
        } catch (error) {  
            console.error('Erro ao salvar links no localStorage:', error);  
  
            if (  
                error &&  
                (  
                    error.name === 'QuotaExceededError' ||  
                    error.name === 'NS_ERROR_DOM_QUOTA_REACHED'  
                )  
            ) {  
                throw new Error('Armazenamento cheio. Não foi possível salvar os links.');  
            }  
  
            throw new Error('Não foi possível salvar os links.');  
        }  
    }  
  
    loadLinksFromStorage() {  
        const raw = localStorage.getItem(STORAGE_KEYS.links);  
        if (!raw) {  
            const clone = this.deepClone(initialLinksData);  
            this.saveLinks(clone);  
            return clone;  
        }  
          
        try {  
            const parsed = JSON.parse(raw);  
            return {  
                b2b: parsed.b2b || [],  
                b2c: parsed.b2c || [],  
                materiais: parsed.materiais || [],  
                rh: parsed.rh || []  
            };  
        } catch {  
            const clone = this.deepClone(initialLinksData);  
            this.saveLinks(clone);  
            return clone;  
        }  
    }  
  
    addLink(category, link) {  
        const links = this.getLinks();  
        if (!links[category]) links[category] = [];  
        links[category].push(link);  
        this.saveLinks(links);  
        return links;  
    }  
  
    deleteLink(category, index) {  
        const links = this.getLinks();  
        if (links[category] && links[category][index]) {  
            links[category].splice(index, 1);  
            this.saveLinks(links);  
        }  
        return links;  
    }  
  
    // ====== Busca com tratamento seguro ======  
    searchLinks(query) {  
        const links = this.getLinks();  
        const results = [];  
        const q = String(query || '').toLowerCase().trim();  
  
        Object.keys(links).forEach(category => {  
            links[category].forEach(link => {  
                // Tratamento seguro para evitar erros com dados corrompidos  
                const name = String(link.nome || '').toLowerCase();  
                const desc = String(link.desc || '').toLowerCase();  
  
                if (name.includes(q) || desc.includes(q)) {  
                    results.push({ ...link, category });  
                }  
            });  
        });  
  
        return results;  
    }  
  
    // ====== Informativos com suporte a imagens ======  
    getInfo() {  
        const raw = localStorage.getItem(STORAGE_KEYS.info);  
        if (!raw) return {};  
  
        try {  
            const parsed = JSON.parse(raw) || {};  
  
            // Garantir estrutura sem quebrar dados antigos  
            Object.keys(parsed).forEach((key) => {  
                if (typeof parsed[key] !== 'object' || parsed[key] === null) {  
                    parsed[key] = { title: '', content: '', imageData: null, type: 'text' };  
                }  
                if (!('type' in parsed[key])) parsed[key].type = 'text';  
                if (!('imageData' in parsed[key])) parsed[key].imageData = null;  
                if (!('title' in parsed[key])) parsed[key].title = '';  
                if (!('content' in parsed[key])) parsed[key].content = '';  
            });  
  
            return parsed;  
        } catch {  
            return {};  
        }  
    }  
  
    // ====== saveInfo com tratamento de QuotaExceededError ======  
    saveInfo(info) {  
        try {  
            localStorage.setItem(STORAGE_KEYS.info, JSON.stringify(info));  
            return true;  
        } catch (error) {  
            console.error('Erro ao salvar informativos no localStorage:', error);  
  
            if (  
                error &&  
                (  
                    error.name === 'QuotaExceededError' ||  
                    error.name === 'NS_ERROR_DOM_QUOTA_REACHED'  
                )  
            ) {  
                throw new Error('Armazenamento cheio. Reduza o tamanho ou a quantidade de imagens.');  
            }  
  
            throw new Error('Não foi possível salvar os informativos.');  
        }  
    }  
  
    // ====== Salvar imagem como base64 com tratamento seguro ======  
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

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingEnabled ="high"

                ctx.drawImage(img, 0, 0, width, height);

                const compressed = canvas.toDataURL("image/jpeg", 0.82);

                resolve(compressed);
            };

            img.onerror = reject;
            img.src = event.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
  
    // ====== PIN Admin ======  
    async getPINHash() {  
        if (!this._pinHash) {  
            const saved = localStorage.getItem(STORAGE_KEYS.pin);  
            if (saved) {  
                this._pinHash = saved;  
            } else {  
                const defaultHash = await this._secureHash(DEFAULT_PIN);  
                this._pinHash = defaultHash;  
                localStorage.setItem(STORAGE_KEYS.pin, defaultHash);  
            }  
        }  
        return this._pinHash;  
    }  
  
    async setPIN(newPIN) {  
        if (newPIN && newPIN.length >= 4) {  
            const hash = await this._secureHash(newPIN);  
            this._pinHash = hash;  
            localStorage.setItem(STORAGE_KEYS.pin, hash);  
            return true;  
        }  
        return false;  
    }  
  
    async validatePIN(input) {  
        if (!input || input.length < 4) return false;  
          
        const inputHash = await this._secureHash(input);  
        const storedHash = await this.getPINHash();  
        return inputHash === storedHash;  
    }  
  
    // ====== Limpeza ======  
    clearAll() {  
        localStorage.removeItem(STORAGE_KEYS.links);  
        localStorage.removeItem(STORAGE_KEYS.info);  
        localStorage.removeItem(STORAGE_KEYS.pin);  
        this._links = null;  
        this._pinHash = null;  
        this._pinHashPromise = null;  
    }  
  
    resetToDefaults() {  
        this.clearAll();  
        const clone = this.deepClone(initialLinksData);  
        this.saveLinks(clone);  
        this._pinHash = null;  
    }  
  
    // ====== Validação e normalização de URLs ======  
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
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {  
                return null;  
            }  
            return urlObj.toString();  
        } catch {  
            return null;  
        }  
    }  
  
    // ====== Helpers ======  
    deepClone(obj) {  
        return JSON.parse(JSON.stringify(obj));  
    }  
}  
  
// Dados iniciais dos links  
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
  
// Export singleton  
const storage = new StorageManager();  
