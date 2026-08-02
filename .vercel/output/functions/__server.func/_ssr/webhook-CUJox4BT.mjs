import { r as __toESM } from "../_runtime.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { t as createClient } from "../_libs/supabase__supabase-js.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/webhook-CUJox4BT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CobraFumando({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 64 64",
		className,
		role: "img",
		"aria-label": "Insígnia da Cobra Fumando — Força Expedicionária Brasileira",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "32",
				cy: "32",
				r: "29",
				opacity: "0.55"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "32",
				cy: "32",
				r: "24",
				opacity: "0.25"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18 44c0-9 6-12 12-12s10-2 10-6-3-6-6-6-5 2-5 4" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M18 44c6 3 14 3 20 0",
				opacity: "0.7"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "39",
				cy: "20",
				r: "1.6",
				fill: "currentColor",
				stroke: "none"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M44 20h7" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M52 19c1.6-1.4 1.6-3.4 0-4.8",
				opacity: "0.7"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M49 15c1.6-1.4 1.6-3.4 0-4.8",
				opacity: "0.5"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M46 12c1.6-1.4 1.6-3.4 0-4.8",
				opacity: "0.3"
			})
		]
	});
}
var DEFAULT_STATE = {
	store: {
		name: "Cantina do Pracinha",
		slogan: "Sabor de trincheira, brio de veterano",
		marquee: "ENTREGA EM ATÃ‰ 35 MIN â€¢ PIX APROVADO NA HORA â€¢ PEDIDOS ACIMA DE R$100 GANHAM CÃ“DIGO FEB-VIP â€¢ HONRA, DIGNIDADE E SABOR"
	},
	payment: { pixKey: "cantina@pracinha.com.br" },
	promo: {
		meta: 100,
		cidadelaDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
	},
	admin: { accessKey: "FEB-1944" },
	whatsapp: "5511999999999",
	integrations: {
		geminiApiKey: "",
		n8nWebhookUrl: "http://localhost:5678/webhook/pracinha",
		cidadelaAuthUrl: "http://localhost:5678/webhook/cidadela"
	},
	cidadela: {
		codes: [],
		accessHistory: [],
		robots: [],
		customTopics: [],
		isPremium: false
	},
	orders: [],
	conversation: [],
	_version: 4,
	categories: [
		{
			name: "Lanches",
			items: [
				{
					id: "x-proteic",
					name: "X-Proteic",
					desc: "Blend 180g, cheddar maturado, bacon crocante e pÃ£o brioche tostado na chapa.",
					price: 39.9,
					img: "ðŸ”"
				},
				{
					id: "x-monte-castelo",
					name: "X-Monte Castelo",
					desc: "Duplo smash, queijo prato, cebola caramelizada e molho da casa.",
					price: 44.9,
					img: "ðŸ”"
				},
				{
					id: "cobra-fumando",
					name: "Cobra Fumando",
					desc: "Costela desfiada defumada 12h, queijo coalho e geleia de pimenta.",
					price: 49.9,
					img: "ðŸ”¥"
				},
				{
					id: "veg-brio",
					name: "Veg Brio",
					desc: "Burger de grÃ£o-de-bico, rÃºcula, tomate confit e maionese de ervas.",
					price: 34.9,
					img: "ðŸ¥¬"
				}
			]
		},
		{
			name: "Adicionais",
			items: [
				{
					id: "add-bacon",
					name: "Bacon Extra",
					desc: "PorÃ§Ã£o generosa de bacon artesanal.",
					price: 7.5,
					img: "ðŸ¥“"
				},
				{
					id: "add-cheddar",
					name: "Cheddar Cremoso",
					desc: "Concha extra de cheddar inglÃªs.",
					price: 6,
					img: "ðŸ§€"
				},
				{
					id: "add-fritas",
					name: "Fritas RÃºsticas",
					desc: "Batata rÃºstica com alecrim e sal defumado.",
					price: 18.9,
					img: "ðŸŸ"
				}
			]
		},
		{
			name: "Bebidas",
			items: [
				{
					id: "bev-cola",
					name: "Refrigerante Lata",
					desc: "350ml gelado.",
					price: 7,
					img: "ðŸ¥¤"
				},
				{
					id: "bev-suco",
					name: "Suco Natural",
					desc: "Laranja, limÃ£o ou maracujÃ¡ â€” 500ml.",
					price: 12,
					img: "ðŸŠ"
				},
				{
					id: "bev-agua",
					name: "Ãgua Mineral",
					desc: "500ml com ou sem gÃ¡s.",
					price: 5,
					img: "ðŸ’§"
				}
			]
		}
	]
};
var DB_NAME = "CardapioDB";
var STORE = "kv";
var STATE_KEY = "currentState";
var LS_KEY = "cardapio_state_backup";
var STATE_VERSION = 4;
function openDB() {
	return new Promise((resolve) => {
		if (typeof indexedDB === "undefined") return resolve(null);
		try {
			const req = indexedDB.open(DB_NAME, 1);
			req.onupgradeneeded = () => {
				const db = req.result;
				if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
			};
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}
async function saveToIndexedDB(key, value) {
	try {
		localStorage.setItem(`${LS_KEY}:${key}`, JSON.stringify(value));
	} catch {}
	const db = await openDB();
	if (!db) return;
	await new Promise((resolve) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => resolve();
	});
}
async function loadFromIndexedDB(key) {
	const db = await openDB();
	if (db) {
		const fromIdb = await new Promise((resolve) => {
			const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => resolve(null);
		});
		if (fromIdb) return fromIdb;
	}
	try {
		const raw = localStorage.getItem(`${LS_KEY}:${key}`);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
/** Merge persisted state onto defaults so new fields never break old installs. */
function mergeState(persisted) {
	if (!persisted) return DEFAULT_STATE;
	if ((persisted._version ?? 0) !== STATE_VERSION) {
		try {
			localStorage.removeItem("n8n_pending_queue");
		} catch {}
		return DEFAULT_STATE;
	}
	return {
		...DEFAULT_STATE,
		...persisted,
		store: {
			...DEFAULT_STATE.store,
			...persisted.store
		},
		payment: {
			...DEFAULT_STATE.payment,
			...persisted.payment
		},
		promo: {
			...DEFAULT_STATE.promo,
			...persisted.promo
		},
		admin: {
			...DEFAULT_STATE.admin,
			...persisted.admin
		},
		integrations: {
			...DEFAULT_STATE.integrations,
			geminiApiKey: persisted.integrations?.geminiApiKey ?? DEFAULT_STATE.integrations.geminiApiKey,
			n8nWebhookUrl: DEFAULT_STATE.integrations.n8nWebhookUrl,
			cidadelaAuthUrl: DEFAULT_STATE.integrations.cidadelaAuthUrl
		},
		cidadela: {
			...DEFAULT_STATE.cidadela,
			...persisted.cidadela
		},
		categories: persisted.categories?.length ? persisted.categories : DEFAULT_STATE.categories
	};
}
var STATE_STORAGE_KEY = STATE_KEY;
var StoreContext = (0, import_react.createContext)(null);
function StoreProvider({ children }) {
	const [state, setState] = (0, import_react.useState)(DEFAULT_STATE);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [online, setOnline] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		let alive = true;
		loadFromIndexedDB(STATE_STORAGE_KEY).then((persisted) => {
			if (!alive) return;
			setState(mergeState(persisted));
			setReady(true);
		});
		return () => {
			alive = false;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		saveToIndexedDB(STATE_STORAGE_KEY, state);
	}, [state, ready]);
	(0, import_react.useEffect)(() => {
		const sync = () => {
			setOnline(navigator.onLine);
		};
		sync();
		window.addEventListener("online", sync);
		window.addEventListener("offline", sync);
		return () => {
			window.removeEventListener("online", sync);
			window.removeEventListener("offline", sync);
		};
	}, []);
	const update = (0, import_react.useCallback)((patch) => {
		setState((prev) => patch(prev));
	}, []);
	const value = (0, import_react.useMemo)(() => ({
		state,
		ready,
		online,
		update
	}), [
		state,
		ready,
		online,
		update
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StoreContext.Provider, {
		value,
		children
	});
}
function useStore() {
	const ctx = (0, import_react.useContext)(StoreContext);
	if (!ctx) throw new Error("useStore precisa estar dentro de <StoreProvider>");
	return ctx;
}
var supabase = createClient("https://hkzhksauilonqppipjyc.supabase.co", "sb_publishable_qT04tnP1_XEbAZ5EHw02FQ_CFDtX_LM");
var QUEUE_KEY = "n8n_pending_queue";
function buildOrderPayload(order, evento = "novo_pedido") {
	return {
		cliente: order.cliente,
		telefone: order.telefone,
		endereco: order.endereco,
		observacoes: order.observacoes,
		total: order.total,
		itens: order.itens,
		tipo_entrega: order.tipo_entrega,
		taxa_entrega: order.taxa_entrega,
		distancia_km: 0,
		imprimir: true,
		impressao_largura: 32,
		origem: "CIDADELA_PWA",
		comanda: order.comanda,
		evento,
		timestamp: (/* @__PURE__ */ new Date()).toISOString(),
		pagamento: order.pagamento,
		troco: order.troco
	};
}
function readQueue() {
	try {
		return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
	} catch {
		return [];
	}
}
function writeQueue(items) {
	try {
		localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
	} catch {}
}
function pendingCount() {
	return readQueue().length;
}
async function post(url, payload) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 15e3);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			signal: controller.signal
		});
		if (!res.ok) {
			console.error("Webhook error:", res.status, res.statusText);
			throw new Error(`Webhook respondeu ${res.status}`);
		}
		return true;
	} catch (error) {
		console.error("Erro ao enviar webhook:", error);
		throw error;
	} finally {
		clearTimeout(timer);
	}
}
/** Envia ao N8N; em falha/offline, enfileira localmente para sincronizar depois. */
async function sendToN8n(url, payload) {
	if (!url) return false;
	if (typeof navigator !== "undefined" && !navigator.onLine) {
		writeQueue([...readQueue(), {
			url,
			payload
		}]);
		return false;
	}
	try {
		await post(url, payload);
		return true;
	} catch {
		writeQueue([...readQueue(), {
			url,
			payload
		}]);
		return false;
	}
}
/** Reenvia tudo que ficou pendente. Retorna quantos foram sincronizados. */
async function flushQueue() {
	const queue = readQueue();
	if (!queue.length) return 0;
	const remaining = [];
	let sent = 0;
	for (const entry of queue) try {
		await post(entry.url, entry.payload);
		sent += 1;
	} catch {
		remaining.push(entry);
	}
	writeQueue(remaining);
	return sent;
}
/** Valida código de acesso via webhook Cidadela */
async function validateCidadelaCode(url, codigo) {
	if (!url) return {
		success: false,
		autenticado: false,
		erro: "codigo_invalido"
	};
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 15e3);
	try {
		const payload = {
			codigo: codigo.toUpperCase(),
			origem: "CIDADELA_PWA",
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		};
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			signal: controller.signal
		});
		if (!res.ok) return {
			success: false,
			autenticado: false,
			erro: "codigo_invalido"
		};
		return await res.json();
	} catch {
		return {
			success: false,
			autenticado: false,
			erro: "codigo_invalido"
		};
	} finally {
		clearTimeout(timer);
	}
}
//#endregion
export { pendingCount as a, useStore as c, flushQueue as i, validateCidadelaCode as l, StoreProvider as n, sendToN8n as o, buildOrderPayload as r, supabase as s, CobraFumando as t };
