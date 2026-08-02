import { r as __toESM } from "../_runtime.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { a as pendingCount, c as useStore, i as flushQueue, n as StoreProvider, o as sendToN8n, r as buildOrderPayload, s as supabase, t as CobraFumando } from "./webhook-CUJox4BT.mjs";
import { g as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Settings, c as Minus, d as Copy, f as CircleAlert, i as ShoppingBag, l as Lock, n as Trash2, s as Plus, t as X } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CpZadB-9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function newComanda() {
	const d = /* @__PURE__ */ new Date();
	const pad = (n) => String(n).padStart(2, "0");
	return `FEB${`${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`}`;
}
function generatePromoCode(prefix = "FEB-VIP", accessType) {
	return {
		code: `${prefix}-${Math.random().toString(36).toUpperCase().slice(2, 6)}-1944`,
		label: accessType === "15_dias" ? "Código VIP - 15 dias de acesso" : "Código temporário - 15 minutos de acesso",
		discount: 10,
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		used: false
	};
}
function brl(value) {
	return value.toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL"
	});
}
/** Comanda térmica 32 colunas. */
function buildThermalTicket(order, storeName) {
	const W = 32;
	const line = "-".repeat(W);
	const center = (t) => t.padStart(Math.floor((W + t.length) / 2)).padEnd(W);
	const row = (l, r) => l.slice(0, W - r.length - 1).padEnd(W - r.length) + r;
	return [
		center(storeName.toUpperCase()),
		center("COMANDA FEB"),
		line,
		`PEDIDO: ${order.comanda}`,
		`DATA..: ${new Date(order.createdAt).toLocaleString("pt-BR")}`,
		`CLIENTE: ${order.cliente}`,
		`FONE...: ${order.telefone}`,
		order.tipo_entrega === "entrega" ? `ENDER..: ${order.endereco}` : "RETIRADA NO BALCAO",
		line,
		...order.itens.map((i) => row(`${i.quantity}x ${i.name}`, brl(i.total))),
		line,
		row("TAXA", brl(order.taxa_entrega)),
		row("TOTAL", brl(order.total)),
		`PAGTO.: ${order.pagamento.toUpperCase()}${order.troco ? ` (troco p/ ${order.troco})` : ""}`,
		order.observacoes ? `OBS...: ${order.observacoes}` : "",
		line,
		center("A COBRA ESTA FUMANDO"),
		center("HONRA . DIGNIDADE . BRIO"),
		""
	].filter(Boolean).join("\n");
}
function Cardapio({ onOpenAdmin }) {
	const { state, update, online } = useStore();
	const navigate = useNavigate();
	const [cart, setCart] = (0, import_react.useState)({});
	const [activeCat, setActiveCat] = (0, import_react.useState)(state.categories[0]?.name ?? "");
	const [checkoutOpen, setCheckoutOpen] = (0, import_react.useState)(false);
	const [cartOpen, setCartOpen] = (0, import_react.useState)(false);
	const [success, setSuccess] = (0, import_react.useState)(null);
	const allItems = (0, import_react.useMemo)(() => state.categories.flatMap((c) => c.items), [state.categories]);
	const cartItems = (0, import_react.useMemo)(() => Object.entries(cart).map(([id, quantity]) => {
		const item = allItems.find((i) => i.id === id);
		if (!item || quantity <= 0) return null;
		return {
			id,
			name: item.name,
			quantity,
			price: item.price,
			total: Number((item.price * quantity).toFixed(2))
		};
	}).filter(Boolean), [cart, allItems]);
	const total = cartItems.reduce((sum, i) => sum + i.total, 0);
	const count = cartItems.reduce((sum, i) => sum + i.quantity, 0);
	const add = (id) => setCart((c) => ({
		...c,
		[id]: (c[id] ?? 0) + 1
	}));
	const remove = (id) => setCart((c) => {
		const next = {
			...c,
			[id]: (c[id] ?? 0) - 1
		};
		if (next[id] <= 0) delete next[id];
		return next;
	});
	async function submitOrder(order) {
		console.log("SUBMIT ORDER - URL:", state.integrations.n8nWebhookUrl);
		const accessType = order.total >= 200 ? "15_dias" : "15_min";
		const promoCode = generatePromoCode(accessType === "15_dias" ? "FEB-VIP" : "FEB-ACESSO", accessType);
		const payloadWithCode = {
			...buildOrderPayload(order),
			cidadela_code: promoCode.code,
			cidadela_access_type: accessType
		};
		console.log("ENVIANDO WEBHOOK PARA:", state.integrations.n8nWebhookUrl);
		const synced = await sendToN8n(state.integrations.n8nWebhookUrl, payloadWithCode);
		console.log("RESULTADO WEBHOOK:", synced);
		const finalOrder = {
			...order,
			synced
		};
		update((prev) => ({
			...prev,
			orders: [finalOrder, ...prev.orders],
			cidadela: {
				...prev.cidadela,
				codes: [...prev.cidadela.codes, promoCode]
			}
		}));
		setSuccess(finalOrder);
		setCart({});
		setCheckoutOpen(false);
		setCartOpen(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-black",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "relative",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => navigate({ to: "/" }),
						className: "text-white",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
							viewBox: "0 0 24 24",
							className: "size-6",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M19 12H5M12 19l-7-7 7-7" })
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded-lg bg-cyan-500 px-4 py-2 text-[10px] font-semibold text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]",
						children: "Exportar"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-64 w-full bg-cover bg-center bg-no-repeat",
							style: { backgroundImage: state.store.coverPhoto ? `url(${state.store.coverPhoto})` : "radial-gradient(ellipse at center top, #e8f4fc 0%, #87ceeb 30%, #4682b4 60%, #1e3a5f 100%)" }
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute top-4 left-0 right-0 px-4 text-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-4xl font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]",
								children: state.store.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm font-medium text-cyan-300",
								children: "Qual será o seu pedido?"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute left-1/2 top-20 -translate-x-1/2 flex flex-col items-center animate-float",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
                @keyframes float {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-10px); }
                }
                .animate-float {
                  animation: float 3s ease-in-out infinite;
                }
                @keyframes eyeColorChange {
                  0%, 100% { fill: #00ffff; }
                  25% { fill: #ff00ff; }
                  50% { fill: #00ff00; }
                  75% { fill: #ffff00; }
                }
                .animate-eye-color {
                  animation: eyeColorChange 4s ease-in-out infinite;
                }
              ` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
								viewBox: "0 0 200 240",
								className: "size-40",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "1.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("radialGradient", {
											id: "head3D",
											cx: "30%",
											cy: "30%",
											r: "70%",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "0%",
													stopColor: "#ffffff"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "50%",
													stopColor: "#e8f4fc"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "100%",
													stopColor: "#1e88e5"
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
											id: "body3D",
											x1: "0%",
											y1: "0%",
											x2: "100%",
											y2: "100%",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "0%",
													stopColor: "#ffffff"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "30%",
													stopColor: "#f0f8ff"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "70%",
													stopColor: "#1e88e5"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "100%",
													stopColor: "#0d47a1"
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
											id: "suitGradient",
											x1: "0%",
											y1: "0%",
											x2: "100%",
											y2: "100%",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "0%",
													stopColor: "#2c2c2c"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "50%",
													stopColor: "#1a1a1a"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "100%",
													stopColor: "#0d0d0d"
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
											id: "shirtGradient",
											x1: "0%",
											y1: "0%",
											x2: "100%",
											y2: "100%",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "0%",
													stopColor: "#ffffff"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "50%",
													stopColor: "#f5f5f5"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "100%",
													stopColor: "#e0e0e0"
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
											id: "trayGradient",
											x1: "0%",
											y1: "0%",
											x2: "100%",
											y2: "100%",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "0%",
													stopColor: "#c0c0c0"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "50%",
													stopColor: "#e8e8e8"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "100%",
													stopColor: "#a0a0a0"
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
											id: "glassGradient",
											x1: "0%",
											y1: "0%",
											x2: "100%",
											y2: "100%",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "0%",
													stopColor: "rgba(255,255,255,0.8)"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "50%",
													stopColor: "rgba(200,230,255,0.6)"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
													offset: "100%",
													stopColor: "rgba(150,200,255,0.4)"
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
											id: "waterGradient",
											x1: "0%",
											y1: "0%",
											x2: "100%",
											y2: "100%",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
												offset: "0%",
												stopColor: "rgba(100,200,255,0.7)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
												offset: "100%",
												stopColor: "rgba(50,150,255,0.5)"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("filter", {
											id: "shadow3D",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("feDropShadow", {
												dx: "2",
												dy: "4",
												stdDeviation: "3",
												"flood-opacity": "0.3"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("filter", {
											id: "glow3D",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("feGaussianBlur", {
												stdDeviation: "2",
												result: "coloredBlur"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("feMerge", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("feMergeNode", { in: "coloredBlur" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("feMergeNode", { in: "SourceGraphic" })] })]
										})
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
										cx: "100",
										cy: "45",
										rx: "35",
										ry: "40",
										fill: "url(#head3D)",
										filter: "url(#shadow3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
										cx: "100",
										cy: "45",
										rx: "30",
										ry: "35",
										fill: "rgba(0,0,0,0.3)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: "75",
										y: "35",
										width: "50",
										height: "25",
										rx: "5",
										fill: "rgba(0,0,0,0.8)",
										stroke: "#1e88e5",
										strokeWidth: "2"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
										cx: "85",
										cy: "42",
										rx: "6",
										ry: "4",
										fill: "#00ffff",
										filter: "url(#glow3D)",
										className: "animate-eye-color"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
										cx: "115",
										cy: "42",
										rx: "6",
										ry: "4",
										fill: "#00ffff",
										filter: "url(#glow3D)",
										className: "animate-eye-color",
										style: { animationDelay: "0.5s" }
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
										cx: "85",
										cy: "42",
										r: "2",
										fill: "#ffffff"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
										cx: "115",
										cy: "42",
										r: "2",
										fill: "#ffffff"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
										d: "M85 52 Q100 60 115 52",
										stroke: "#00ffff",
										strokeWidth: "2",
										fill: "none",
										filter: "url(#glow3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: "90",
										y: "82",
										width: "20",
										height: "12",
										fill: "url(#body3D)",
										filter: "url(#shadow3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
										d: "M70 95 L130 95 L135 170 L65 170 Z",
										fill: "url(#body3D)",
										filter: "url(#shadow3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
										d: "M70 95 L130 95 L135 170 L65 170 Z",
										fill: "url(#suitGradient)",
										opacity: "0.9"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
										d: "M75 100 L125 100 L130 165 L70 165 Z",
										fill: "url(#suitGradient)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
										d: "M85 105 L115 105 L118 160 L82 160 Z",
										fill: "url(#suitGradient)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
										d: "M90 110 L110 110 L112 155 L88 155 Z",
										fill: "url(#shirtGradient)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
										points: "100,105 92,115 100,125 108,115",
										fill: "#000000"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
										cx: "100",
										cy: "115",
										r: "2",
										fill: "#1e88e5"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
										d: "M65 100 Q45 120 40 150",
										stroke: "url(#suitGradient)",
										strokeWidth: "12",
										fill: "none",
										filter: "url(#shadow3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
										cx: "40",
										cy: "150",
										r: "8",
										fill: "url(#body3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
										d: "M135 100 Q155 120 160 150",
										stroke: "url(#suitGradient)",
										strokeWidth: "12",
										fill: "none",
										filter: "url(#shadow3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
										cx: "160",
										cy: "150",
										r: "8",
										fill: "url(#body3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: "155",
										y: "130",
										width: "15",
										height: "25",
										rx: "2",
										fill: "#ffffff",
										stroke: "#e0e0e0",
										strokeWidth: "1"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
										x1: "158",
										y1: "135",
										x2: "158",
										y2: "150",
										stroke: "#e0e0e0",
										strokeWidth: "1"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
										x1: "162",
										y1: "135",
										x2: "162",
										y2: "150",
										stroke: "#e0e0e0",
										strokeWidth: "1"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
										x1: "166",
										y1: "135",
										x2: "166",
										y2: "150",
										stroke: "#e0e0e0",
										strokeWidth: "1"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
										cx: "165",
										cy: "145",
										rx: "35",
										ry: "12",
										fill: "url(#trayGradient)",
										filter: "url(#shadow3D)",
										stroke: "#a0a0a0",
										strokeWidth: "2"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: "140",
										y: "138",
										width: "20",
										height: "15",
										rx: "1",
										fill: "#ffffff",
										stroke: "#e0e0e0",
										strokeWidth: "1"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
										x1: "145",
										y1: "142",
										x2: "155",
										y2: "142",
										stroke: "#e0e0e0",
										strokeWidth: "0.5"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
										x1: "145",
										y1: "146",
										x2: "155",
										y2: "146",
										stroke: "#e0e0e0",
										strokeWidth: "0.5"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
										x1: "145",
										y1: "150",
										x2: "155",
										y2: "150",
										stroke: "#e0e0e0",
										strokeWidth: "0.5"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: "165",
										y: "130",
										width: "8",
										height: "12",
										rx: "1",
										fill: "url(#glassGradient)",
										stroke: "#a0a0a0",
										strokeWidth: "1"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: "166",
										y: "132",
										width: "6",
										height: "8",
										fill: "url(#waterGradient)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: "175",
										y: "130",
										width: "8",
										height: "12",
										rx: "1",
										fill: "url(#glassGradient)",
										stroke: "#a0a0a0",
										strokeWidth: "1"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: "176",
										y: "132",
										width: "6",
										height: "8",
										fill: "url(#waterGradient)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
										cx: "180",
										cy: "135",
										r: "2",
										fill: "#ffeb3b",
										stroke: "#ffc107",
										strokeWidth: "0.5"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: "185",
										y: "130",
										width: "8",
										height: "12",
										rx: "1",
										fill: "url(#glassGradient)",
										stroke: "#a0a0a0",
										strokeWidth: "1"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: "186",
										y: "132",
										width: "6",
										height: "8",
										fill: "url(#waterGradient)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
										d: "M75 170 L70 230",
										stroke: "url(#suitGradient)",
										strokeWidth: "14",
										fill: "none",
										filter: "url(#shadow3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
										d: "M125 170 L130 230",
										stroke: "url(#suitGradient)",
										strokeWidth: "14",
										fill: "none",
										filter: "url(#shadow3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
										cx: "70",
										cy: "232",
										rx: "10",
										ry: "5",
										fill: "#0d0d0d",
										filter: "url(#shadow3D)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
										cx: "130",
										cy: "232",
										rx: "10",
										ry: "5",
										fill: "#0d0d0d",
										filter: "url(#shadow3D)"
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => navigate({ to: "/cidadela" }),
							className: "absolute right-4 top-16 z-50 transition-all hover:scale-105 active:scale-95",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative size-20 flex flex-col items-center justify-center rounded-full border-2 border-cyan-400 bg-black/70 shadow-[0_0_30px_rgba(34,211,238,0.7)]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 animate-pulse rounded-full bg-cyan-400/60" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "relative text-[10px] font-bold text-cyan-300 tracking-tight leading-tight",
										children: "CONHEÇA A CIDADELA"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
										viewBox: "0 0 24 24",
										className: "relative size-7 text-yellow-400 mt-1",
										fill: "none",
										stroke: "currentColor",
										strokeWidth: "2.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
											x: "5",
											y: "11",
											width: "14",
											height: "10",
											rx: "2"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 11V7a4 4 0 0 1 8 0v4" })]
									})
								]
							})
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "sticky top-0 z-20 border-b border-red-500/20 bg-black/90 backdrop-blur",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex gap-2 overflow-x-auto px-4 py-3",
					children: state.categories.map((cat) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							setActiveCat(cat.name);
							document.getElementById(`cat-${cat.name}`)?.scrollIntoView({
								behavior: "smooth",
								block: "start"
							});
						},
						className: `shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold transition-all ${activeCat === cat.name ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500" : "bg-black/50 text-gray-400 hover:bg-red-500/10 border border-red-500/30"}`,
						children: cat.name
					}, cat.name))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "px-4 pb-24",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto max-w-xl",
					children: state.categories.map((cat) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						id: `cat-${cat.name}`,
						className: "scroll-mt-20 pt-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mb-4 text-lg font-bold text-white",
							children: cat.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-4",
							children: cat.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
								className: "group relative flex items-center gap-4 rounded-xl border border-red-500/20 bg-black/40 p-4 transition-all hover:border-red-500/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 animate-pulse rounded-full border border-red-500/30" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "relative size-16 overflow-hidden rounded-full border-2 border-red-500/50 bg-black/50",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex size-full items-center justify-center text-2xl",
												children: item.img
											})
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex-1 min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-base font-bold text-white group-hover:text-red-400 transition-colors",
											children: item.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1 text-xs text-gray-400 line-clamp-2",
											children: item.desc
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex shrink-0 flex-col items-end gap-2 min-w-[80px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm font-bold text-white",
											children: brl(item.price)
										}), cart[item.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-500/30 p-1",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													"aria-label": `Remover ${item.name}`,
													onClick: () => remove(item.id),
													className: "grid size-6 place-items-center rounded-full bg-black/50 hover:bg-black/70",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, { className: "size-3 text-red-400" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "w-4 text-center text-sm font-semibold text-white",
													children: cart[item.id]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													"aria-label": `Adicionar ${item.name}`,
													onClick: () => add(item.id),
													className: "grid size-6 place-items-center rounded-full bg-red-600 hover:bg-red-500",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3 text-white" })
												})
											]
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => add(item.id),
											className: "flex items-center gap-1 rounded-lg border border-red-500/50 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3" }), "ADD"]
										})]
									})
								]
							}, item.id))
						})]
					}, cat.name))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed bottom-0 left-0 right-0 z-40 border-t border-red-500/20 bg-black/95 backdrop-blur",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-around py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "flex flex-col items-center gap-1 transition-all",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 rounded-full bg-red-500/20 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 24 24",
									className: "relative size-6 text-red-500",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 12h18M3 6h18M3 18h18" })
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-semibold text-red-500",
								children: "CARDÁPIO"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "flex flex-col items-center gap-1 transition-all hover:text-gray-300",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
								viewBox: "0 0 24 24",
								className: "size-6 text-gray-500",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
									cx: "12",
									cy: "7",
									r: "4"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-semibold text-gray-500",
								children: "PERFIL"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: onOpenAdmin,
							className: "flex flex-col items-center gap-1 transition-all hover:text-gray-300",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
								viewBox: "0 0 24 24",
								className: "size-6 text-gray-500",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
									cx: "12",
									cy: "12",
									r: "3"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-semibold text-gray-500",
								children: "PAINEL"
							})]
						})
					]
				})
			}),
			count > 0 && !cartOpen && !checkoutOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setCartOpen(true),
				className: "fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-md items-center justify-between rounded-full bg-red-600 px-5 py-4 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex items-center gap-2 text-sm font-semibold",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShoppingBag, { className: "size-4" }),
						" ",
						count,
						" ",
						count === 1 ? "item" : "itens"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm font-bold",
					children: brl(total)
				})]
			}),
			cartOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartSheet, {
				items: cartItems,
				total,
				onClose: () => setCartOpen(false),
				onAdd: add,
				onRemove: remove,
				onCheckout: () => {
					setCartOpen(false);
					setCheckoutOpen(true);
				}
			}),
			checkoutOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckoutModal, {
				items: cartItems,
				subtotal: total,
				onClose: () => setCheckoutOpen(false),
				onConfirm: submitOrder
			}),
			success && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SuccessModal, {
				order: success,
				onClose: () => setSuccess(null)
			})
		]
	});
}
function CartSheet({ items, total, onClose, onAdd, onRemove, onCheckout }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-lg font-semibold",
						children: "Seu pedido"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						"aria-label": "Fechar carrinho",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 space-y-3",
					children: items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-3 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-medium",
									children: i.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted-foreground",
									children: [brl(i.price), " un."]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-label": "Remover",
										onClick: () => onRemove(i.id),
										children: i.quantity === 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, { className: "size-4" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-4 text-center font-semibold",
										children: i.quantity
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-label": "Adicionar",
										onClick: () => onAdd(i.id),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" })
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-20 text-right font-semibold",
								children: brl(i.total)
							})
						]
					}, i.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 flex items-center justify-between border-t border-border pt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm text-muted-foreground",
						children: "Total"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-lg font-bold",
						children: brl(total)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onCheckout,
					className: "ember-glow mt-4 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground",
					children: "Finalizar pedido"
				})
			]
		})
	});
}
function CheckoutModal({ items, subtotal, onClose, onConfirm }) {
	const { state } = useStore();
	const [form, setForm] = (0, import_react.useState)({
		cliente: "",
		telefone: "",
		rua: "",
		numero: "",
		bairro: "",
		referencia: "",
		observacoes: "",
		troco: ""
	});
	const [tipo, setTipo] = (0, import_react.useState)("entrega");
	const [pagamento, setPagamento] = (0, import_react.useState)("pix");
	const [sending, setSending] = (0, import_react.useState)(false);
	const [copiedPix, setCopiedPix] = (0, import_react.useState)(false);
	const taxa = tipo === "entrega" ? 0 : 0;
	const total = Number((subtotal + taxa).toFixed(2));
	const pixQr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(state.payment.pixKey)}`;
	const valid = form.cliente.trim().length > 1 && form.telefone.trim().length >= 8 && (tipo === "retirada" || form.rua.trim().length > 2 && form.numero.trim().length > 0 && form.bairro.trim().length > 2);
	function copyPixKey() {
		navigator.clipboard.writeText(state.payment.pixKey);
		setCopiedPix(true);
		setTimeout(() => setCopiedPix(false), 2e3);
	}
	async function handleSubmit(e) {
		e.preventDefault();
		if (!valid || sending) return;
		setSending(true);
		await onConfirm({
			comanda: newComanda(),
			cliente: form.cliente.trim(),
			telefone: form.telefone.trim(),
			endereco: tipo === "entrega" ? `${form.rua.trim()}, ${form.numero.trim()} - ${form.bairro.trim()}${form.referencia.trim() ? ` (Ref: ${form.referencia.trim()})` : ""}` : "Retirada no balcão",
			observacoes: form.observacoes.trim(),
			itens: items,
			total,
			tipo_entrega: tipo,
			taxa_entrega: taxa,
			pagamento,
			troco: pagamento === "dinheiro" ? form.troco : void 0,
			status: "pendente",
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			synced: false
		});
		setSending(false);
	}
	const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-40 overflow-y-auto bg-black/60 p-0 sm:p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: handleSubmit,
			className: "mx-auto w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-lg font-semibold",
						children: "Checkout"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						"aria-label": "Fechar checkout",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 grid grid-cols-2 gap-2",
					children: ["entrega", "retirada"].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setTipo(t),
						className: `text-tech rounded-lg px-3 py-2 text-[11px] ${tipo === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`,
						children: t
					}, t))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: field,
							placeholder: "Seu nome",
							value: form.cliente,
							onChange: (e) => setForm({
								...form,
								cliente: e.target.value
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: field,
							placeholder: "Telefone / WhatsApp",
							inputMode: "tel",
							value: form.telefone,
							onChange: (e) => setForm({
								...form,
								telefone: e.target.value
							})
						}),
						tipo === "entrega" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: field,
									placeholder: "Rua",
									value: form.rua,
									onChange: (e) => setForm({
										...form,
										rua: e.target.value
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-3 gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: field,
										placeholder: "Número",
										value: form.numero,
										onChange: (e) => setForm({
											...form,
											numero: e.target.value
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: `${field} col-span-2`,
										placeholder: "Bairro",
										value: form.bairro,
										onChange: (e) => setForm({
											...form,
											bairro: e.target.value
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: field,
									placeholder: "Ponto de referência (opcional)",
									value: form.referencia,
									onChange: (e) => setForm({
										...form,
										referencia: e.target.value
									})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							className: field,
							rows: 2,
							placeholder: "Observações (ex: sem cebola)",
							value: form.observacoes,
							onChange: (e) => setForm({
								...form,
								observacoes: e.target.value
							})
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 grid grid-cols-3 gap-2",
					children: [
						"pix",
						"dinheiro",
						"cartao"
					].map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setPagamento(p),
						className: `text-tech rounded-lg px-2 py-2 text-[11px] ${pagamento === p ? "bg-primary text-primary-foreground" : "bg-secondary"}`,
						children: p
					}, p))
				}),
				pagamento === "pix" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex items-center gap-4 rounded-xl bg-secondary p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: pixQr,
						alt: "QR Code PIX para pagamento",
						width: 90,
						height: 90,
						className: "rounded-md"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-semibold",
								children: "Chave PIX"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "break-all text-muted-foreground",
								children: state.payment.pixKey
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: copyPixKey,
								className: "mt-2 flex items-center gap-1 text-primary hover:underline",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3" }), copiedPix ? "Copiado!" : "Copiar chave"]
							})
						]
					})]
				}),
				pagamento === "dinheiro" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: `${field} mt-4`,
					placeholder: "Troco para quanto?",
					inputMode: "numeric",
					value: form.troco,
					onChange: (e) => setForm({
						...form,
						troco: e.target.value
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 flex items-center justify-between border-t border-border pt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm text-muted-foreground",
						children: "Total"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-lg font-bold",
						children: brl(total)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					disabled: !valid || sending,
					className: "ember-glow mt-4 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50",
					children: sending ? "Enviando..." : "Confirmar pedido"
				})
			]
		})
	});
}
function SuccessModal({ order, onClose }) {
	const { state } = useStore();
	const formatComandaMessage = (order) => {
		const itemsText = order.itens.map((item) => {
			let text = `- ${item.quantity}x ${item.name} (${brl(item.total)})`;
			if (order.observacoes) text += `\n  _Obs: ${order.observacoes}_`;
			return text;
		}).join("\n");
		const paymentText = order.pagamento === "dinheiro" ? `Dinheiro (Troco p/ R$ ${order.troco || "0"})` : order.pagamento === "cartao" ? "Cartão" : "PIX";
		const addressText = order.tipo_entrega === "entrega" ? `${order.endereco}` : "Retirada no balcão";
		return `==============================
   *NOVO PEDIDO - ${state.store.name}*
==============================
*Cliente:* ${order.cliente}
*Telefone:* ${order.telefone}
*Tipo:* ${order.tipo_entrega === "entrega" ? "Delivery" : "Retirada"}
*Endereço:* ${addressText}

------------------------------
*ITENS DO PEDIDO:*
${itemsText}
------------------------------

*FORMA DE PAGAMENTO:* ${paymentText}
*TAXA DE ENTREGA:* ${brl(order.taxa_entrega)}
*TOTAL DO PEDIDO:* ${brl(order.total)}
==============================`;
	};
	const waText = encodeURIComponent(formatComandaMessage(order));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 grid place-items-center bg-black/70 p-5",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "feb-scope w-full max-w-sm rounded-2xl border border-border p-6 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CobraFumando, { className: "mx-auto size-14 text-[color:var(--brass)]" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-tech mt-4 text-[10px] text-[color:var(--brass)]",
					children: "Pedido confirmado"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-stencil mt-1 text-2xl",
					children: order.comanda
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-muted-foreground",
					children: order.synced ? "Comanda transmitida ao comando. Confirmação chega no WhatsApp." : "Comanda registrada localmente e será transmitida assim que a conexão voltar."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-xs italic text-muted-foreground/80",
					children: "“Tudo quanto te vier à mão para fazer, faze-o conforme as tuas forças.” — Eclesiastes 9:10"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: `https://wa.me/${state.whatsapp}?text=${waText}`,
						target: "_blank",
						rel: "noreferrer",
						className: "rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground",
						children: "Finalizar Pedido no WhatsApp"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						className: "text-tech py-2 text-[11px]",
						children: "Voltar ao cardápio"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-tech mt-4 text-[9px] text-muted-foreground/60",
					children: [buildThermalTicket(order, state.store.name).split("\n").length, " linhas de comanda prontas"]
				})
			]
		})
	});
}
var field = "w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-ring";
function ConfigOperacional() {
	const { state, update } = useStore();
	const [flushMsg, setFlushMsg] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-3 rounded-xl border border-border p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-tech text-[10px] text-white",
						children: "IntegraÃ§Ãµes"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-xs text-gray-300",
						children: ["GEMINI_API_KEY", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "password",
							className: `${field} mt-1`,
							value: state.integrations.geminiApiKey,
							placeholder: "AIzaSy...",
							onChange: (e) => update((prev) => ({
								...prev,
								integrations: {
									...prev.integrations,
									geminiApiKey: e.target.value
								}
							}))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-xs text-gray-300",
						children: ["N8N_WEBHOOK_URL (Pedido)", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${field} mt-1`,
							value: state.integrations.n8nWebhookUrl,
							placeholder: "https://above-improvement-endless-acne.trycloudflare.com/webhook/pracinha",
							onChange: (e) => update((prev) => ({
								...prev,
								integrations: {
									...prev.integrations,
									n8nWebhookUrl: e.target.value
								}
							}))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-xs text-gray-300",
						children: ["CIDADELA_AUTH_URL", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${field} mt-1`,
							value: state.integrations.cidadelaAuthUrl,
							placeholder: "https://above-improvement-endless-acne.trycloudflare.com/webhook/cidadela",
							onChange: (e) => update((prev) => ({
								...prev,
								integrations: {
									...prev.integrations,
									cidadelaAuthUrl: e.target.value
								}
							}))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: async () => {
								const sent = await flushQueue();
								setFlushMsg(`${sent} pedido(s) sincronizado(s). Fila: ${pendingCount()}`);
							},
							className: "text-tech rounded-md bg-[color:var(--olive)] px-3 py-2 text-[10px]",
							children: "Sincronizar"
						}), flushMsg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] text-white",
							children: flushMsg
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-3 rounded-xl border border-border p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-tech text-[10px] text-white",
						children: "Loja"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: field,
						value: state.store.name,
						onChange: (e) => update((prev) => ({
							...prev,
							store: {
								...prev.store,
								name: e.target.value
							}
						}))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: field,
						value: state.store.slogan,
						onChange: (e) => update((prev) => ({
							...prev,
							store: {
								...prev.store,
								slogan: e.target.value
							}
						}))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						className: field,
						rows: 2,
						value: state.store.marquee,
						onChange: (e) => update((prev) => ({
							...prev,
							store: {
								...prev.store,
								marquee: e.target.value
							}
						}))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-xs text-gray-300",
						children: ["Chave PIX", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${field} mt-1`,
							value: state.payment.pixKey,
							onChange: (e) => update((prev) => ({
								...prev,
								payment: { pixKey: e.target.value }
							}))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-xs text-gray-300",
						children: ["WhatsApp", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${field} mt-1`,
							value: state.whatsapp,
							onChange: (e) => update((prev) => ({
								...prev,
								whatsapp: e.target.value
							}))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-xs text-gray-300",
						children: ["Meta da operaÃ§Ã£o (R$)", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "number",
							className: `${field} mt-1`,
							value: state.promo.meta,
							onChange: (e) => update((prev) => ({
								...prev,
								promo: {
									...prev.promo,
									meta: Number(e.target.value) || 0
								}
							}))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-xs text-gray-300",
						children: ["Chave administrativa", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${field} mt-1`,
							value: state.admin.accessKey,
							onChange: (e) => update((prev) => ({
								...prev,
								admin: { accessKey: e.target.value }
							}))
						})]
					})
				]
			})
		]
	});
}
function useAdminTrial() {
	const [trial, setTrial] = (0, import_react.useState)(null);
	const [isLoading, setIsLoading] = (0, import_react.useState)(true);
	const [isExpired, setIsExpired] = (0, import_react.useState)(false);
	const [daysRemaining, setDaysRemaining] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		const savedTrial = localStorage.getItem("admin_trial");
		if (savedTrial) {
			const parsed = JSON.parse(savedTrial);
			setTrial(parsed);
			checkExpiration(parsed);
		}
		setIsLoading(false);
	}, []);
	function checkExpiration(trialData) {
		const now = /* @__PURE__ */ new Date();
		const expiresAt = new Date(trialData.trial_expires_at);
		const isExpired = now > expiresAt;
		setIsExpired(isExpired);
		if (!isExpired) {
			const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1e3 * 60 * 60 * 24));
			setDaysRemaining(Math.max(0, daysLeft));
		}
	}
	async function createTrial(storeName, adminPhone) {
		const accessCode = `FEB-${Math.random().toString(36).toUpperCase().slice(2, 8)}-TRIAL`;
		const trialStartedAt = /* @__PURE__ */ new Date();
		const trialExpiresAt = new Date(trialStartedAt);
		trialExpiresAt.setDate(trialExpiresAt.getDate() + 2);
		const { data, error } = await supabase.from("admin_trials").insert({
			store_name: storeName,
			admin_phone: adminPhone,
			access_code: accessCode,
			trial_started_at: trialStartedAt.toISOString(),
			trial_expires_at: trialExpiresAt.toISOString()
		}).select().single();
		if (error) {
			console.error("Error creating trial:", error);
			return null;
		}
		localStorage.setItem("admin_trial", JSON.stringify(data));
		setTrial(data);
		checkExpiration(data);
		return data;
	}
	async function validateAccessCode(code) {
		const { data, error } = await supabase.from("admin_trials").select("*").eq("access_code", code).single();
		if (error || !data) return {
			valid: false,
			trial: null
		};
		const trialData = data;
		const now = /* @__PURE__ */ new Date();
		const expiresAt = new Date(trialData.trial_expires_at);
		const isValid = trialData.is_active && (now <= expiresAt || trialData.is_premium);
		if (isValid) {
			localStorage.setItem("admin_trial", JSON.stringify(trialData));
			setTrial(trialData);
			checkExpiration(trialData);
		}
		return {
			valid: isValid,
			trial: trialData
		};
	}
	async function activateLiberationCode(code) {
		const { data, error } = await supabase.from("liberation_codes").select("*").eq("code", code).eq("used", false).single();
		if (error || !data) return {
			success: false,
			message: "Código inválido ou já utilizado"
		};
		const liberationCode = data;
		const now = /* @__PURE__ */ new Date();
		const premiumExpiresAt = /* @__PURE__ */ new Date();
		premiumExpiresAt.setDate(premiumExpiresAt.getDate() + liberationCode.duration_days);
		const { error: updateError } = await supabase.from("admin_trials").update({
			is_premium: true,
			premium_expires_at: premiumExpiresAt.toISOString()
		}).eq("id", liberationCode.store_id);
		if (updateError) return {
			success: false,
			message: "Erro ao ativar código"
		};
		await supabase.from("liberation_codes").update({
			used: true,
			used_at: now.toISOString()
		}).eq("id", liberationCode.id);
		if (trial) {
			const updatedTrial = {
				...trial,
				is_premium: true,
				premium_expires_at: premiumExpiresAt.toISOString()
			};
			localStorage.setItem("admin_trial", JSON.stringify(updatedTrial));
			setTrial(updatedTrial);
			checkExpiration(updatedTrial);
		}
		return {
			success: true,
			message: "Código ativado com sucesso!"
		};
	}
	function clearTrial() {
		localStorage.removeItem("admin_trial");
		setTrial(null);
		setIsExpired(false);
		setDaysRemaining(0);
	}
	return {
		trial,
		isLoading,
		isExpired,
		daysRemaining,
		createTrial,
		validateAccessCode,
		activateLiberationCode,
		clearTrial
	};
}
var TABS = [{
	id: "config",
	label: "Operacional"
}, {
	id: "pedidos",
	label: "Comandas"
}];
function AdminModal({ onClose }) {
	const { state, update } = useStore();
	const [tab, setTab] = (0, import_react.useState)("config");
	const [loginStep, setLoginStep] = (0, import_react.useState)("login");
	const [accessCode, setAccessCode] = (0, import_react.useState)("");
	const [storeName, setStoreName] = (0, import_react.useState)("");
	const [adminPhone, setAdminPhone] = (0, import_react.useState)("");
	const [liberationCode, setLiberationCode] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const { trial, isLoading, isExpired, daysRemaining, createTrial, validateAccessCode, activateLiberationCode } = useAdminTrial();
	async function handleLogin() {
		setError("");
		if (!accessCode.trim()) {
			setError("Digite o código de acesso");
			return;
		}
		const result = await validateAccessCode(accessCode.trim());
		if (result.valid) if (result.trial?.is_premium) setLoginStep("premium");
		else setLoginStep("trial");
		else setError("Código inválido");
	}
	async function handleCreateTrial() {
		setError("");
		if (!storeName.trim() || !adminPhone.trim()) {
			setError("Preencha todos os campos");
			return;
		}
		if (await createTrial(storeName.trim(), adminPhone.trim())) setLoginStep("trial");
		else setError("Erro ao criar trial");
	}
	async function handleActivateCode() {
		setError("");
		if (!liberationCode.trim()) {
			setError("Digite o código de liberação");
			return;
		}
		const result = await activateLiberationCode(liberationCode.trim());
		if (result.success) setLoginStep("premium");
		else setError(result.message);
	}
	function handleWhatsAppPayment() {
		const whatsappNumber = "5511999999999";
		const message = encodeURIComponent("Quero código do painel Pracinha. Trial expirou.");
		window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
	}
	if (!trial || isExpired) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto min-h-screen w-full max-w-md bg-slate-900 sm:my-6 sm:min-h-0 sm:rounded-2xl sm:border sm:border-border",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between border-b border-border px-5 py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-6 text-[color:var(--brass)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-stencil text-lg text-white",
						children: "ACESSO ADMINISTRATIVO"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-tech text-[9px] text-gray-300",
						children: isExpired ? "Trial expirado" : "Insira seu código de acesso"
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onClose,
					"aria-label": "Fechar",
					className: "text-white hover:text-gray-300",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-5 py-6",
				children: isExpired ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-lg border border-red-500/50 bg-red-500/10 p-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "size-5 text-red-400 shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-medium text-red-400",
									children: "Trial Expirado"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-gray-300",
									children: "Adquira o código para continuar."
								})] })]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: handleWhatsAppPayment,
							className: "w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors",
							children: "Solicitar Código"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-border bg-slate-800 p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-medium text-gray-200 mb-2",
									children: "Já tem o código?"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: liberationCode,
									onChange: (e) => setLiberationCode(e.target.value),
									placeholder: "Digite o código de liberação",
									className: "w-full rounded-lg border border-input bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-gray-500"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: handleActivateCode,
									className: "mt-2 w-full rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--matte)] hover:opacity-90 transition-opacity",
									children: "Ativar Código"
								})
							]
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-red-400",
							children: error
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-sm font-medium text-gray-200 mb-2",
							children: "Código de Acesso"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: accessCode,
							onChange: (e) => setAccessCode(e.target.value),
							placeholder: "Digite seu código",
							className: "w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-gray-500"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: handleLogin,
							className: "w-full rounded-lg bg-[color:var(--brass)] px-4 py-3 text-sm font-medium text-[color:var(--matte)] hover:opacity-90 transition-opacity",
							children: "Entrar"
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-red-400",
							children: error
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-t border-border pt-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-gray-300 mb-3",
								children: "Primeira vez?"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: storeName,
										onChange: (e) => setStoreName(e.target.value),
										placeholder: "Nome da loja",
										className: "w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-gray-500"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: adminPhone,
										onChange: (e) => setAdminPhone(e.target.value),
										placeholder: "WhatsApp do administrador",
										className: "w-full rounded-lg border border-input bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-gray-500"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: handleCreateTrial,
										className: "w-full rounded-lg border border-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--brass)] hover:bg-[color:var(--brass)]/10 transition-colors",
										children: "Trial Gratuito (2 dias)"
									})
								]
							})]
						})
					]
				})
			})]
		})
	});
	const showTrialBanner = trial && !trial.is_premium && !isExpired;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto min-h-screen w-full max-w-4xl bg-slate-900 sm:my-6 sm:min-h-0 sm:rounded-2xl sm:border sm:border-border",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-center justify-between border-b border-border px-5 py-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CobraFumando, { className: "size-9 text-[color:var(--brass)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-stencil text-xl text-white",
							children: "PAINEL ADMINISTRATIVO"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-tech text-[9px] text-gray-300",
							children: trial.is_premium ? "Premium" : `Trial - ${daysRemaining} dias restantes`
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						"aria-label": "Fechar painel",
						className: "text-white hover:text-gray-300",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					})]
				}),
				showTrialBanner && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "bg-yellow-500/10 border-b border-yellow-500/30 px-5 py-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-yellow-400",
						children: [
							"⚠️ Trial expira em ",
							daysRemaining,
							" dias. Adquira o código."
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "flex gap-1 overflow-x-auto border-b border-border px-3 py-2 bg-slate-800",
					children: TABS.map(({ id, label }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setTab(id),
						className: `text-tech flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[10px] ${tab === id ? "bg-[color:var(--olive)] text-white" : "text-gray-300 hover:bg-slate-700"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-3.5" }),
							" ",
							label
						]
					}, id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-5 py-6 bg-slate-900",
					children: [tab === "config" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfigOperacional, {}), tab === "pedidos" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-center text-sm text-gray-300",
						children: "Módulo de comandas em desenvolvimento"
					})]
				})
			]
		})
	});
}
function Index() {
	const [adminOpen, setAdminOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StoreProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cardapio, { onOpenAdmin: () => setAdminOpen(true) }), adminOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminModal, { onClose: () => setAdminOpen(false) })] });
}
//#endregion
export { Index as component };
