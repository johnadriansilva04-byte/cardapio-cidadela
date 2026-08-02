import { r as __toESM } from "../_runtime.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { c as useStore, l as validateCidadelaCode, n as StoreProvider, s as supabase, t as CobraFumando } from "./webhook-CUJox4BT.mjs";
import { h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as Bot, o as Send, p as BrainCircuit, r as Swords, u as FlaskConical } from "../_libs/lucide-react.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/cidadela-C5X-JF2J.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var MODEL = "gemini-2.5-flash";
var ENDPOINT = (key) => `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
var SOVEREIGN_ANSWER = "Nossa empresa nasceu da busca por justiça, direitos humanos e dignidade para a família brasileira. Investimos em tecnologia e educação como ferramentas de libertação. Defendemos com orgulho a Força Expedicionária Brasileira (FEB), a soberania nacional e o brio intelectual de cada indivíduo. Nossa fundação é inspirada na luta incansável pela honra de um pai que passou 30 anos sem o direito ao seu próprio nome correto — uma batalha diária por dignidade que nos move a fazer o certo por todos os nossos clientes.";
var VALUES_PATTERNS = [
	/hist[óo]ria da (empresa|loja|marca)/i,
	/valores da (empresa|loja|marca)/i,
	/(qual|quais).*(prop[óo]sito|miss[ãa]o|valores)/i,
	/como (a empresa|voc[êe]s) (foi fundad|surgi|nasce)/i,
	/funda[çc][ãa]o da empresa/i,
	/por que (a empresa|voc[êe]s) existe/i
];
/** Easter egg estrito: só dispara sob pergunta explícita sobre história/valores/propósito/fundação. */
function isSovereignValuesQuestion(text) {
	return VALUES_PATTERNS.some((re) => re.test(text));
}
function buildSystemPrompt(menuSummary, storeName) {
	return `Você é o PRACINHA, assistente virtual da ${storeName}.
Estilo: ágil, educado, direto ao ponto, foco em suporte, venda e direcionamento para o cardápio.
Responda SEMPRE em português do Brasil, em 1 a 3 frases curtas. Nunca invente itens ou preços.
Cardápio disponível: ${menuSummary}.
Nunca inicie a conversa falando sobre história, valores ou fundação da empresa.`;
}
/** Chama o Gemini com autocura: timeout, anti-loop e tratamento de resposta nula. */
async function askPraxinha(opts) {
	const { apiKey, history, question, menuSummary, storeName, systemPrompt } = opts;
	if (isSovereignValuesQuestion(question)) return { text: SOVEREIGN_ANSWER };
	if (!apiKey) return {
		text: "Ainda não estou conectado. Um oficial precisa cadastrar a GEMINI_API_KEY nas Configurações Operacionais da Cidadela.",
		error: "missing_key"
	};
	const window = history.slice(-6);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 2e4);
	try {
		const res = await fetch(ENDPOINT(apiKey), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			signal: controller.signal,
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: systemPrompt || buildSystemPrompt(menuSummary, storeName) }] },
				contents: [...window.map((m) => ({
					role: m.role,
					parts: [{ text: m.text }]
				})), {
					role: "user",
					parts: [{ text: question }]
				}],
				generationConfig: {
					temperature: .6,
					maxOutputTokens: 320
				}
			})
		});
		if (!res.ok) {
			const body = await res.text();
			return {
				text: "Tive uma falha na linha de comunicação. Tente novamente em instantes.",
				error: `HTTP ${res.status}: ${body.slice(0, 200)}`
			};
		}
		const text = (await res.json()).candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
		if (!text) return {
			text: "Não consegui formular a resposta agora. Pode reformular a pergunta?",
			error: "empty_response"
		};
		const lastModel = [...window].reverse().find((m) => m.role === "model");
		if (lastModel && lastModel.text.trim() === text) return { text: "Só reforçando de outro jeito: me diga o que você quer pedir que eu monto o combo ideal pra você." };
		return { text };
	} catch (err) {
		const aborted = err instanceof DOMException && err.name === "AbortError";
		return {
			text: aborted ? "A resposta demorou demais e cancelei a missão. Tenta de novo?" : "Estou sem conexão com o comando agora. Tente novamente em instantes.",
			error: aborted ? "timeout" : String(err)
		};
	} finally {
		clearTimeout(timer);
	}
}
function PracinhaIA() {
	const { state, update } = useStore();
	const [input, setInput] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [selectedRobot, setSelectedRobot] = (0, import_react.useState)(null);
	const [showRobotSelector, setShowRobotSelector] = (0, import_react.useState)(false);
	const listRef = (0, import_react.useRef)(null);
	const menuSummary = (0, import_react.useMemo)(() => state.categories.map((c) => `${c.name}: ${c.items.map((i) => `${i.name} (R$${i.price.toFixed(2)})`).join(", ")}`).join(" | "), [state.categories]);
	async function send(e) {
		e.preventDefault();
		const question = input.trim();
		if (!question || loading) return;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const history = state.conversation;
		const systemPrompt = selectedRobot ? `Você é ${selectedRobot.name}, um robô com ideologia ${selectedRobot.ideology}, personalidade ${selectedRobot.personality}, estratégia ${selectedRobot.strategy}. Agressividade: ${selectedRobot.aggressiveness}%, Eloquência: ${selectedRobot.eloquence}%, Lógica: ${selectedRobot.logic}%. Responda de acordo com sua personalidade e ideologia.` : "Você é o Pracinha IA, assistente da Cantina do Pracinha.";
		update((prev) => ({
			...prev,
			conversation: [...prev.conversation, {
				role: "user",
				text: question,
				at: now
			}].slice(-40)
		}));
		setInput("");
		setLoading(true);
		const result = await askPraxinha({
			apiKey: state.integrations.geminiApiKey,
			history,
			question,
			menuSummary,
			storeName: state.store.name,
			systemPrompt
		});
		update((prev) => ({
			...prev,
			conversation: [...prev.conversation, {
				role: "model",
				text: result.text,
				at: (/* @__PURE__ */ new Date()).toISOString()
			}].slice(-40)
		}));
		setLoading(false);
		requestAnimationFrame(() => listRef.current?.scrollTo({
			top: 1e6,
			behavior: "smooth"
		}));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-[60vh] flex-col rounded-xl border border-border",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-border px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CobraFumando, { className: "size-6 text-[color:var(--brass)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-stencil text-sm",
						children: "PRACINHA IA"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-tech text-[9px] text-muted-foreground",
						children: [
							selectedRobot ? selectedRobot.name : "Gemini 2.5 Flash",
							" · memória de ",
							6,
							" ",
							"mensagens"
						]
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setShowRobotSelector(!showRobotSelector),
						className: "text-tech text-[9px] text-muted-foreground hover:text-foreground",
						children: selectedRobot ? "Trocar Robô" : "Usar Robô"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => update((prev) => ({
							...prev,
							conversation: []
						})),
						className: "text-tech text-[9px] text-muted-foreground hover:text-foreground",
						children: "Limpar"
					})]
				})]
			}),
			showRobotSelector && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-b border-border bg-secondary px-4 py-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setSelectedRobot(null);
								setShowRobotSelector(false);
							},
							className: "block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted",
							children: "Pracinha IA (padrão)"
						}),
						state.cidadela.robots.map((robot, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setSelectedRobot(robot);
								setShowRobotSelector(false);
							},
							className: "block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted",
							children: [
								robot.name,
								" (",
								robot.ideology,
								")"
							]
						}, index)),
						state.cidadela.robots.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: "Nenhum robô criado. Vá ao Laboratório de Robô."
						})
					]
				})
			}),
			selectedRobot && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-b border-border bg-secondary px-4 py-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: selectedRobot.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-2 text-muted-foreground",
							children: selectedRobot.ideology
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2 text-[10px] text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"Agr: ",
								selectedRobot.aggressiveness,
								"%"
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"Elo: ",
								selectedRobot.eloquence,
								"%"
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"Lóg: ",
								selectedRobot.logic,
								"%"
							] })
						]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: listRef,
				className: "flex-1 space-y-3 overflow-y-auto px-4 py-4",
				children: [
					state.conversation.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: selectedRobot ? `Converse com ${selectedRobot.name}. Ele responde de acordo com sua personalidade e ideologia.` : "Crie um robô no Laboratório e converse com ele aqui, ou use o Pracinha IA padrão para perguntas sobre o cardápio."
					}),
					state.conversation.map((m, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-[color:var(--olive)] text-[color:var(--sand)]" : "bg-secondary"}`,
						children: m.text
					}, `${m.at}-${idx}`)),
					loading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-tech text-[10px] text-muted-foreground",
						children: [selectedRobot?.name || "Pracinha", " digitando…"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: send,
				className: "flex gap-2 border-t border-border p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: input,
					onChange: (e) => setInput(e.target.value),
					placeholder: selectedRobot ? `Fale com ${selectedRobot.name}…` : "Fale com o Pracinha IA…",
					className: "flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					disabled: loading,
					"aria-label": "Enviar mensagem",
					className: "grid size-10 place-items-center rounded-lg bg-[color:var(--brass)] text-[color:var(--matte)] disabled:opacity-50",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-4" })
				})]
			})
		]
	});
}
var patternIdCounter = 0;
function FigureSVG({ figure, className }) {
	if (!figure) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className });
	const fig = figure;
	const sizeMap = {
		small: .6,
		medium: .8,
		large: 1
	};
	const colorMap = {
		red: "#ef4444",
		blue: "#3b82f6",
		green: "#22c55e",
		yellow: "#eab308",
		purple: "#a855f7",
		orange: "#f97316",
		pink: "#ec4899",
		cyan: "#06b6d4"
	};
	const scale = sizeMap[fig.size];
	const color = colorMap[fig.color];
	const hatchId = `hatch-${patternIdCounter++}`;
	const dotId = `dot-${patternIdCounter++}`;
	function renderShape() {
		const strokeWidth = fig.fill === "outline" ? 2.5 : fig.fill === "hatched" ? 1.5 : 0;
		const commonProps = {
			fill: fig.fill === "solid" ? color : fig.fill === "hatched" ? color : fig.fill === "dotted" ? color : "none",
			fillOpacity: fig.fill === "hatched" || fig.fill === "dotted" ? .3 : 1,
			stroke: color,
			strokeWidth,
			strokeLinecap: "round",
			strokeLinejoin: "round"
		};
		switch (fig.shape) {
			case "circle": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "50",
				cy: "50",
				r: 38 * scale,
				...commonProps
			});
			case "square": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: 50 - 33 * scale,
				y: 50 - 33 * scale,
				width: 66 * scale,
				height: 66 * scale,
				rx: 4,
				...commonProps
			});
			case "triangle": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
				points: `50,${12 * scale} ${88 * scale},${88 * scale} ${12 * scale},${88 * scale}`,
				...commonProps
			});
			case "diamond": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
				points: `50,${12 * scale} ${88 * scale},50 50,${88 * scale} ${12 * scale},50`,
				...commonProps
			});
			case "pentagon": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
				points: Array.from({ length: 5 }, (_, i) => {
					const angle = (i * 72 - 90) * (Math.PI / 180);
					const r = 38 * scale;
					return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
				}).join(" "),
				...commonProps
			});
			case "star": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
				points: Array.from({ length: 10 }, (_, i) => {
					const angle = (i * 36 - 90) * (Math.PI / 180);
					const r = i % 2 === 0 ? 38 * scale : 18 * scale;
					return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
				}).join(" "),
				...commonProps
			});
		}
	}
	function renderPatterns() {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [fig.fill === "hatched" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pattern", {
			id: hatchId,
			patternUnits: "userSpaceOnUse",
			width: "8",
			height: "8",
			patternTransform: "rotate(45)",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "0",
				y1: "0",
				x2: "0",
				y2: "8",
				stroke: color,
				strokeWidth: "1.5"
			})
		}), fig.fill === "dotted" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pattern", {
			id: dotId,
			patternUnits: "userSpaceOnUse",
			width: "8",
			height: "8",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "4",
				cy: "4",
				r: "1.5",
				fill: color
			})
		})] });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 100 100",
		className,
		children: [
			renderPatterns(),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
				transform: `rotate(${fig.rotation} 50 50)`,
				children: renderShape()
			}),
			fig.innerFigure && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
				transform: "translate(50, 50) scale(0.35) translate(-50, -50)",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FigureSVG, { figure: fig.innerFigure })
			})
		]
	});
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
/**
* Pracinha com prancheta — versão menor para o teste de QI
*/
function PracinhaWithClipboard({ mood = "idle", className }) {
	const eyeShape = () => {
		switch (mood) {
			case "cheer": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M62 78 q8 -10 16 0",
				stroke: "var(--pracinha-eye)",
				strokeWidth: "5",
				fill: "none",
				strokeLinecap: "round"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M102 78 q8 -10 16 0",
				stroke: "var(--pracinha-eye)",
				strokeWidth: "5",
				fill: "none",
				strokeLinecap: "round"
			})] });
			case "sleep": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M62 80 h16",
				stroke: "var(--pracinha-eye)",
				strokeWidth: "5",
				strokeLinecap: "round"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M102 80 h16",
				stroke: "var(--pracinha-eye)",
				strokeWidth: "5",
				strokeLinecap: "round"
			})] });
			case "worried": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "70",
					cy: "80",
					r: "7",
					fill: "var(--pracinha-eye)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "110",
					cy: "80",
					r: "7",
					fill: "var(--pracinha-eye)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: "M58 66 l16 6",
					stroke: "var(--pracinha-eye)",
					strokeWidth: "4",
					strokeLinecap: "round"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: "M122 66 l-16 6",
					stroke: "var(--pracinha-eye)",
					strokeWidth: "4",
					strokeLinecap: "round"
				})
			] });
			case "thinking": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "74",
					cy: "78",
					r: "8",
					fill: "var(--pracinha-eye)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "114",
					cy: "78",
					r: "8",
					fill: "var(--pracinha-eye)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "77",
					cy: "75",
					r: "2.6",
					fill: "var(--pracinha-visor)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "117",
					cy: "75",
					r: "2.6",
					fill: "var(--pracinha-visor)"
				})
			] });
			default: return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "70",
					cy: "79",
					r: "9",
					fill: "var(--pracinha-eye)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "110",
					cy: "79",
					r: "9",
					fill: "var(--pracinha-eye)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "73",
					cy: "75.5",
					r: "3",
					fill: "var(--pracinha-visor)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "113",
					cy: "75.5",
					r: "3",
					fill: "var(--pracinha-visor)"
				})
			] });
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 180 260",
		className: cn("pracinha", mood === "sleep" && "pracinha--sleep", className),
		role: "img",
		"aria-label": "Pracinha com prancheta",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
					id: "pracinha-body",
					x1: "0",
					y1: "0",
					x2: "0",
					y2: "1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
						offset: "0%",
						stopColor: "var(--pracinha-shell-light)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
						offset: "100%",
						stopColor: "var(--pracinha-shell-dark)"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
					id: "pracinha-visor",
					x1: "0",
					y1: "0",
					x2: "1",
					y2: "1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
						offset: "0%",
						stopColor: "var(--pracinha-visor)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
						offset: "100%",
						stopColor: "var(--pracinha-visor-deep)"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("radialGradient", {
					id: "pracinha-glow",
					cx: "50%",
					cy: "50%",
					r: "50%",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
						offset: "0%",
						stopColor: "var(--pracinha-accent)",
						stopOpacity: "0.55"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
						offset: "100%",
						stopColor: "var(--pracinha-accent)",
						stopOpacity: "0"
					})]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
				cx: "90",
				cy: "246",
				rx: "46",
				ry: "8",
				fill: "var(--pracinha-shadow)"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "90",
				cy: "90",
				r: "80",
				fill: "url(#pracinha-glow)"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
				className: "pracinha__float",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
							x: "62",
							y: "196",
							width: "16",
							height: "30",
							rx: "8",
							fill: "var(--pracinha-joint)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
							x: "102",
							y: "196",
							width: "16",
							height: "30",
							rx: "8",
							fill: "var(--pracinha-joint)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
							x: "52",
							y: "222",
							width: "34",
							height: "16",
							rx: "8",
							fill: "url(#pracinha-body)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
							x: "94",
							y: "222",
							width: "34",
							height: "16",
							rx: "8",
							fill: "url(#pracinha-body)"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
						className: "pracinha__arm-left",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
							x: "18",
							y: "140",
							width: "14",
							height: "46",
							rx: "7",
							fill: "var(--pracinha-joint)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							cx: "25",
							cy: "192",
							r: "11",
							fill: "url(#pracinha-body)"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
						className: "pracinha__arm-right",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
								x: "148",
								y: "140",
								width: "14",
								height: "46",
								rx: "7",
								fill: "var(--pracinha-joint)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
								cx: "155",
								cy: "192",
								r: "11",
								fill: "url(#pracinha-body)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
								x: "145",
								y: "160",
								width: "28",
								height: "40",
								rx: "3",
								fill: "var(--pracinha-clipboard)",
								stroke: "var(--pracinha-joint)",
								strokeWidth: "2"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
								x1: "150",
								y1: "170",
								x2: "168",
								y2: "170",
								stroke: "var(--pracinha-clipboard-line)",
								strokeWidth: "2"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
								x1: "150",
								y1: "178",
								x2: "168",
								y2: "178",
								stroke: "var(--pracinha-clipboard-line)",
								strokeWidth: "2"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
								x1: "150",
								y1: "186",
								x2: "162",
								y2: "186",
								stroke: "var(--pracinha-clipboard-line)",
								strokeWidth: "2"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: "36",
						y: "122",
						width: "108",
						height: "82",
						rx: "26",
						fill: "url(#pracinha-body)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: "M52 132 q38 22 76 0 v46 a20 20 0 0 1 -20 20 h-36 a20 20 0 0 1 -20 -20 z",
						fill: "var(--pracinha-shirt)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: "90",
						y: "180",
						textAnchor: "middle",
						fontSize: "42",
						fontWeight: "800",
						fontFamily: "var(--font-display)",
						fill: "var(--pracinha-shirt-ink)",
						children: "P"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: "80",
						y: "110",
						width: "20",
						height: "16",
						rx: "6",
						fill: "var(--pracinha-joint)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: "34",
						y: "40",
						width: "112",
						height: "76",
						rx: "30",
						fill: "url(#pracinha-body)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: "46",
						y: "54",
						width: "88",
						height: "48",
						rx: "22",
						fill: "url(#pracinha-visor)"
					}),
					eyeShape(),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: "M78 96 q12 9 24 0",
						stroke: "var(--pracinha-eye)",
						strokeWidth: "4",
						fill: "none",
						strokeLinecap: "round",
						opacity: mood === "worried" ? 0 : .85
					}),
					mood === "worried" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: "M78 100 q12 -9 24 0",
						stroke: "var(--pracinha-eye)",
						strokeWidth: "4",
						fill: "none",
						strokeLinecap: "round"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: "24",
						y: "66",
						width: "12",
						height: "26",
						rx: "6",
						fill: "var(--pracinha-joint)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: "144",
						y: "66",
						width: "12",
						height: "26",
						rx: "6",
						fill: "var(--pracinha-joint)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: "86",
						y: "18",
						width: "8",
						height: "24",
						rx: "4",
						fill: "var(--pracinha-joint)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "90",
						cy: "14",
						r: "9",
						fill: "var(--pracinha-accent)",
						className: "pracinha__bulb"
					})
				]
			})
		]
	});
}
function usePracinhaChat(sessionType = "iq_test") {
	const [messages, setMessages] = (0, import_react.useState)([]);
	const [isLoading, setIsLoading] = (0, import_react.useState)(true);
	const [userId] = (0, import_react.useState)(() => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
	(0, import_react.useEffect)(() => {
		async function loadMessages() {
			const { data, error } = await supabase.from("chat_messages").select("*").eq("user_id", userId).eq("session_type", sessionType).order("timestamp", { ascending: true });
			if (error) console.error("Error loading messages:", error);
			else setMessages(data || []);
			setIsLoading(false);
		}
		loadMessages();
	}, [userId, sessionType]);
	(0, import_react.useEffect)(() => {
		const subscription = supabase.channel("chat_channel").on("postgres_changes", {
			event: "INSERT",
			schema: "public",
			table: "chat_messages",
			filter: `user_id=eq.${userId}`
		}, (payload) => {
			const newMessage = payload.new;
			setMessages((prev) => [...prev, newMessage]);
		}).subscribe();
		return () => {
			supabase.removeChannel(subscription);
		};
	}, [userId]);
	async function sendMessage(text, role) {
		const { data, error } = await supabase.from("chat_messages").insert({
			user_id: userId,
			role,
			text,
			session_type: sessionType,
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		}).select().single();
		if (error) {
			console.error("Error sending message:", error);
			return null;
		}
		return data;
	}
	async function clearChat() {
		const { error } = await supabase.from("chat_messages").delete().eq("user_id", userId).eq("session_type", sessionType);
		if (error) {
			console.error("Error clearing chat:", error);
			return false;
		}
		setMessages([]);
		return true;
	}
	return {
		messages,
		isLoading,
		userId,
		sendMessage,
		clearChat
	};
}
function PracinhaChat() {
	const { messages: supabaseMessages, sendMessage, isLoading } = usePracinhaChat("iq_test");
	const [localMessages, setLocalMessages] = (0, import_react.useState)([{
		id: 1,
		role: "pracinha",
		text: "E aí, soldado! Tô aqui pra te ajudar com o que precisar. Pode perguntar!",
		timestamp: /* @__PURE__ */ new Date()
	}]);
	const [input, setInput] = (0, import_react.useState)("");
	const messagesEndRef = (0, import_react.useRef)(null);
	const messages = supabaseMessages.length > 0 ? supabaseMessages.map((msg) => ({
		id: msg.id,
		role: msg.role,
		text: msg.text,
		timestamp: new Date(msg.timestamp)
	})) : localMessages;
	(0, import_react.useEffect)(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);
	async function handleSend() {
		if (!input.trim()) return;
		const userMessage = {
			id: Date.now(),
			role: "user",
			text: input.trim(),
			timestamp: /* @__PURE__ */ new Date()
		};
		if (await sendMessage(input.trim(), "user")) {} else setLocalMessages((prev) => [...prev, userMessage]);
		setInput("");
		setTimeout(async () => {
			const pracinhaResponses = [
				"Boa pergunta! Vou pensar nisso...",
				"Interessante! Deixa eu ver o que eu sei sobre isso.",
				"Hmm, isso me lembra algo da trincheira...",
				"Bora lá! Tô aqui pra ajudar.",
				"Fica tranquilo, a gente resolve isso junto."
			];
			const randomResponse = pracinhaResponses[Math.floor(Math.random() * pracinhaResponses.length)];
			const pracinhaMessage = {
				id: Date.now() + 1,
				role: "pracinha",
				text: randomResponse,
				timestamp: /* @__PURE__ */ new Date()
			};
			if (!await sendMessage(randomResponse, "pracinha")) setLocalMessages((prev) => [...prev, pracinhaMessage]);
		}, 1e3);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-b border-slate-700 px-4 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-stencil text-sm text-slate-200",
					children: "Chat com Pracinha"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-y-auto p-4 space-y-3",
				children: [messages.map((msg) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `flex ${msg.role === "user" ? "justify-end" : "justify-start"}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-slate-700 text-slate-200" : "bg-slate-900/50 text-slate-300"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: msg.text }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[10px] opacity-70 text-slate-400",
							children: msg.timestamp.toLocaleTimeString("pt-BR", {
								hour: "2-digit",
								minute: "2-digit"
							})
						})]
					})
				}, msg.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: messagesEndRef })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-t border-slate-700 p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: input,
						onChange: (e) => setInput(e.target.value),
						onKeyDown: (e) => e.key === "Enter" && handleSend(),
						placeholder: "Pergunte ao Pracinha...",
						className: "flex-1 rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-slate-500"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: handleSend,
						disabled: !input.trim(),
						className: "rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-50 hover:bg-slate-600 transition-colors",
						children: "Enviar"
					})]
				})
			})
		]
	});
}
var SHAPES = [
	"circle",
	"square",
	"triangle",
	"diamond",
	"pentagon",
	"star"
];
var SIZES = [
	"small",
	"medium",
	"large"
];
var COLORS = [
	"red",
	"blue",
	"green",
	"yellow",
	"purple",
	"orange",
	"pink",
	"cyan"
];
var ROTATIONS = [
	0,
	30,
	45,
	60,
	90,
	120,
	135,
	150,
	180,
	210,
	225,
	240,
	270,
	300,
	315,
	330
];
var FILLS = [
	"solid",
	"outline",
	"hatched",
	"dotted"
];
function seededRandom(seed) {
	let s = seed;
	return () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
}
function pick(arr, rng) {
	return arr[Math.floor(rng() * arr.length)];
}
function generateFigure(rng, depth = 0) {
	if (depth > 2) return {
		shape: pick(SHAPES, rng),
		size: pick(SIZES, rng),
		color: pick(COLORS, rng),
		rotation: pick(ROTATIONS, rng),
		fill: pick(FILLS, rng)
	};
	const figure = {
		shape: pick(SHAPES, rng),
		size: pick(SIZES, rng),
		color: pick(COLORS, rng),
		rotation: pick(ROTATIONS, rng),
		fill: pick(FILLS, rng)
	};
	if (rng() > .7) figure.innerFigure = generateFigure(rng, depth + 1);
	return figure;
}
function cloneFigure(fig) {
	return {
		...fig,
		innerFigure: fig.innerFigure ? cloneFigure(fig.innerFigure) : void 0
	};
}
function applyRule(fig, rule, rng) {
	const cloned = cloneFigure(fig);
	switch (rule) {
		case "shape_cycle":
			cloned.shape = SHAPES[(SHAPES.indexOf(cloned.shape) + 1) % SHAPES.length];
			break;
		case "size_grow":
			const sizeIdx = SIZES.indexOf(cloned.size);
			cloned.size = SIZES[Math.min(sizeIdx + 1, SIZES.length - 1)];
			break;
		case "color_cycle":
			cloned.color = COLORS[(COLORS.indexOf(cloned.color) + 1) % COLORS.length];
			break;
		case "rotate_45":
			cloned.rotation = (cloned.rotation + 45) % 360;
			break;
		case "fill_cycle":
			cloned.fill = FILLS[(FILLS.indexOf(cloned.fill) + 1) % FILLS.length];
			break;
		case "add_inner":
			if (!cloned.innerFigure && rng() > .5) cloned.innerFigure = generateFigure(rng, 2);
			break;
		case "remove_inner":
			cloned.innerFigure = void 0;
			break;
	}
	return cloned;
}
function buildTest(seed, itemCount) {
	const rng = seededRandom(seed);
	const items = [];
	for (let i = 0; i < itemCount; i++) {
		const rules = [];
		const ruleTypes = [
			"shape_cycle",
			"size_grow",
			"color_cycle",
			"rotate_45",
			"fill_cycle",
			"add_inner",
			"remove_inner"
		];
		const selectedRules = ruleTypes.sort(() => rng() - .5).slice(0, 2 + Math.floor(rng() * 2));
		selectedRules.forEach((rule) => {
			rules.push({
				description: {
					shape_cycle: "Forma muda ciclicamente",
					size_grow: "Tamanho cresce",
					color_cycle: "Cor muda ciclicamente",
					rotate_45: "Rotação de 45 graus",
					fill_cycle: "Preenchimento muda ciclicamente",
					add_inner: "Figura interna adicionada",
					remove_inner: "Figura interna removida"
				}[rule],
				type: rule
			});
		});
		const baseFigure = generateFigure(rng);
		const cells = [];
		for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
			if (row === 2 && col === 2) {
				cells.push(null);
				continue;
			}
			let fig = cloneFigure(baseFigure);
			const ruleIndex = (row * 3 + col) % selectedRules.length;
			fig = applyRule(fig, selectedRules[ruleIndex], rng);
			cells.push(fig);
		}
		const answerIndex = Math.floor(rng() * 8);
		const answerFigure = applyRule(baseFigure, selectedRules[2 % selectedRules.length], rng);
		const options = [];
		for (let opt = 0; opt < 8; opt++) if (opt === answerIndex) options.push(answerFigure);
		else {
			const wrongRule = pick(ruleTypes.filter((r) => r !== selectedRules[2 % selectedRules.length]), rng);
			options.push(applyRule(baseFigure, wrongRule, rng));
		}
		items.push({
			id: `item-${i}`,
			cells,
			options,
			answerIndex,
			difficulty: .5 + rng() * 1.5,
			rules
		});
	}
	return {
		seed,
		items
	};
}
function scoreTest(attempts) {
	const totalItems = attempts.length;
	const rawScore = attempts.filter((a) => a.correct).length;
	let theta = 0;
	const a = 1.15;
	const c = .125;
	for (let i = 0; i < 10; i++) {
		let sum = 0;
		for (const attempt of attempts) {
			const p = c + (1 - c) / (1 + Math.exp(-1.15 * (theta - attempt.difficulty)));
			sum += (attempt.correct ? 1 : 0) - p;
		}
		theta += sum / (a * totalItems);
	}
	let information = 0;
	for (const attempt of attempts) {
		const p = c + (1 - c) / (1 + Math.exp(-1.15 * (theta - attempt.difficulty)));
		information += a * a * (p - c) * (1 - p) / ((1 - c) * (1 - c));
	}
	const seTheta = 1 / Math.sqrt(Math.max(information, .01));
	const iq = 100 + theta * 15;
	const iqLow = iq - 1.96 * seTheta * 15;
	const iqHigh = iq + 1.96 * seTheta * 15;
	const percentile = 50 * (1 + Math.tanh(.7 * theta));
	let classification = "";
	if (iq >= 130) classification = "Muito Superior";
	else if (iq >= 120) classification = "Superior";
	else if (iq >= 110) classification = "Acima da Média";
	else if (iq >= 90) classification = "Média";
	else if (iq >= 80) classification = "Abaixo da Média";
	else if (iq >= 70) classification = "Limítrofe";
	else classification = "Deficiente Intelectual";
	return {
		iq: Math.round(iq),
		iqLow: Math.round(iqLow),
		iqHigh: Math.round(iqHigh),
		theta,
		seTheta,
		rawScore,
		totalItems,
		percentile: Math.round(percentile),
		classification
	};
}
function hashSeed(...inputs) {
	const str = inputs.join("|");
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash);
}
var PRACINHA_LINES = {
	intro: ["Bora? Respira fundo. Eu fico aqui do lado o tempo todo.", "Cada matriz tem uma regra escondida. Ache a regra, ache a resposta."],
	running: [
		"Olha as linhas primeiro. Depois as colunas.",
		"Quantidade, forma, cor, giro, preenchimento. Um deles muda com padrão.",
		"Se travar, marca a melhor hipótese e segue. Dá pra revisar depois.",
		"Não conta figura no chute: conta a regra.",
		"Tá indo bem. Ritmo constante vence."
	],
	ending: ["Últimas questões. Foco total agora."],
	result: ["Fechou! Esse é o seu retrato cognitivo de hoje."]
};
function formatClock(totalSeconds) {
	const m = Math.floor(Math.max(0, totalSeconds) / 60);
	const s = Math.max(0, totalSeconds) % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function IQTest() {
	const [phase, setPhase] = (0, import_react.useState)("intro");
	const [seed, setSeed] = (0, import_react.useState)(0);
	const [answers, setAnswers] = (0, import_react.useState)([]);
	const [current, setCurrent] = (0, import_react.useState)(0);
	const [secondsLeft, setSecondsLeft] = (0, import_react.useState)(1500);
	const [result, setResult] = (0, import_react.useState)(null);
	const [showDetails, setShowDetails] = (0, import_react.useState)(false);
	const itemCount = 30;
	const durationMinutes = 25;
	const startedAt = (0, import_react.useRef)(0);
	const test = (0, import_react.useMemo)(() => seed ? buildTest(seed, itemCount) : null, [seed, itemCount]);
	const items = test?.items ?? [];
	const finish = (0, import_react.useCallback)((finalAnswers, itemList, usedSeed) => {
		const scored = scoreTest(itemList.map((it, i) => ({
			difficulty: it.difficulty,
			correct: finalAnswers[i] === it.answerIndex
		})));
		setResult(scored);
		setPhase("result");
	}, []);
	(0, import_react.useEffect)(() => {
		if (phase !== "running") return;
		const id = window.setInterval(() => {
			setSecondsLeft((s) => {
				if (s <= 1) {
					window.clearInterval(id);
					return 0;
				}
				return s - 1;
			});
		}, 1e3);
		return () => window.clearInterval(id);
	}, [phase]);
	(0, import_react.useEffect)(() => {
		if (phase === "running" && secondsLeft === 0 && test) finish(answers, test.items, test.seed);
	}, [
		secondsLeft,
		phase,
		test,
		answers,
		finish
	]);
	const start = () => {
		const s = hashSeed(Date.now(), Math.floor(Math.random() * 1e9), "anon");
		setSeed(s);
		setAnswers(Array.from({ length: itemCount }, () => null));
		setCurrent(0);
		setSecondsLeft(durationMinutes * 60);
		setResult(null);
		startedAt.current = Date.now();
		setPhase("running");
	};
	const answered = answers.filter((a) => a !== null).length;
	const progress = phase === "running" ? current / Math.max(1, itemCount) * 100 : 0;
	const mood = phase === "result" ? (result?.iq ?? 0) >= 100 ? "cheer" : "idle" : phase === "running" ? secondsLeft < 60 ? "worried" : "thinking" : "idle";
	const line = (0, import_react.useMemo)(() => {
		if (phase === "result") return PRACINHA_LINES.result[0];
		if (phase === "intro") return PRACINHA_LINES.intro[current % 2];
		if (current >= itemCount - 4) return PRACINHA_LINES.ending[0];
		return PRACINHA_LINES.running[current % PRACINHA_LINES.running.length];
	}, [
		phase,
		current,
		itemCount
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-[calc(100vh-73px)] flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "border-b border-border bg-slate-800/50 px-6 py-4 backdrop-blur-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-stencil text-xl text-white",
				children: "Teste de QI — Pracinha"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-slate-300",
				children: "Matrizes Progressivas 3×3 — Avaliação cognitiva com assistência do robô"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-1 overflow-hidden",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex-1 overflow-y-auto p-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto max-w-2xl",
					children: phase === "intro" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-slate-700 bg-slate-800/80 p-8 backdrop-blur-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "chip bg-slate-700 text-slate-200",
								children: "Teste de QI"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: start,
								className: "btn-primary w-full sm:w-auto",
								children: "Iniciar avaliação"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-4 text-lg text-slate-200",
								children: "🧠 Teste de QI com matrizes visuais"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-slate-400",
								children: "30 questões • 25 minutos • Resultado instantâneo"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 space-y-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-slate-700 bg-slate-900/50 p-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-semibold text-slate-200",
										children: "🎯 Como funciona"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm text-slate-400",
										children: "8 figuras, 1 espaço vazio. Descubra a regra."
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-slate-700 bg-slate-900/50 p-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-semibold text-slate-200",
										children: "⚡ Benefícios"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm text-slate-400",
										children: "TRI preciso • Sem repetição"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setShowDetails(!showDetails),
									className: "text-sm text-slate-400 hover:text-slate-200 transition-colors",
									children: showDetails ? "▼ Menos detalhes" : "▶ Saiba mais"
								}), showDetails && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 space-y-2 text-sm text-slate-400",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "• Reggra em cada linha/coluna" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "• 8 opções, 1 correta" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "• Pode revisar" })
									]
								})]
							})
						]
					}) : phase === "running" && test ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunPanel, {
						item: items[current],
						index: current,
						total: itemCount,
						answered,
						secondsLeft,
						progress,
						selected: answers[current],
						onSelect: (opt) => setAnswers((prev) => {
							const next = prev.slice();
							next[current] = opt;
							return next;
						}),
						onPrev: () => setCurrent((c) => Math.max(0, c - 1)),
						onNext: () => setCurrent((c) => Math.min(itemCount - 1, c + 1)),
						onFinish: () => finish(answers, test.items, test.seed),
						onJump: setCurrent,
						answers
					}) : phase === "result" && result && test ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultPanel, {
						result,
						items: test.items,
						answers,
						onExit: () => setPhase("intro")
					}) : null
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex w-72 flex-col border-l border-slate-700 bg-slate-800/50 backdrop-blur-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center p-3 border-b border-slate-700",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PracinhaWithClipboard, {
						mood,
						className: "w-24 h-auto"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xs uppercase tracking-[0.2em] text-slate-300",
						children: "Pracinha"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs leading-relaxed text-slate-400",
						children: line
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 p-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PracinhaChat, {})
				})]
			})]
		})]
	});
}
function RunPanel({ item, index, total, answered, secondsLeft, progress, selected, onSelect, onPrev, onNext, onFinish, onJump, answers }) {
	const cells = [...item.cells, null];
	const low = secondsLeft <= 60;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-slate-700 bg-slate-800/80 p-4 md:p-6 backdrop-blur-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-display text-xs uppercase tracking-[0.25em] text-slate-300",
					children: [
						"Questão ",
						index + 1,
						" de ",
						total
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-slate-400",
					children: [answered, " respondidas"]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `font-display rounded-full border px-4 py-1.5 text-lg tabular-nums ${low ? "border-red-500/60 bg-red-500/15 text-red-400" : "border-slate-600 bg-slate-700/50 text-slate-200"}`,
					"aria-live": "polite",
					children: formatClock(secondsLeft)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "progress mt-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "progress__bar",
					style: { width: `${progress}%` }
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-7 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "matrix",
					children: cells.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `matrix__cell ${f === null && "matrix__cell--missing"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FigureSVG, {
							figure: f,
							className: "h-full w-full"
						})
					}, i))
				}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 text-xs uppercase tracking-[0.2em] text-slate-400",
					children: "Escolha a peça que completa"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-4 gap-2.5",
					children: item.options.map((opt, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => onSelect(i),
						className: `option ${selected === i && "option--active"}`,
						"aria-pressed": selected === i,
						"aria-label": `Alternativa ${i + 1}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FigureSVG, {
							figure: opt,
							className: "h-full w-full"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "option__tag",
							children: i + 1
						})]
					}, i))
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "-mt-6 flex flex-wrap items-center justify-end gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onPrev,
						disabled: index === 0,
						className: "btn-ghost",
						children: "Anterior"
					}),
					index < total - 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onNext,
						className: "btn-primary",
						children: "Próxima"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onFinish,
						className: "btn-primary",
						children: "Finalizar e calcular"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onFinish,
						className: "btn-ghost",
						children: "Encerrar agora"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-wrap gap-1.5",
				children: answers.map((a, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => onJump(i),
					className: `dot ${a !== null && "dot--done"} ${i === index && "dot--current"}`,
					"aria-label": `Ir para a questão ${i + 1}`
				}, i))
			})
		]
	});
}
function ResultPanel({ result, items, answers, onExit }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-slate-700 bg-slate-800/80 p-6 md:p-9 backdrop-blur-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "chip bg-slate-700 text-slate-200",
				children: "Resultado aferido"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 flex flex-wrap items-end gap-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs uppercase tracking-[0.25em] text-slate-400",
					children: "QI estimado"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-7xl font-bold leading-none text-gradient",
					children: result.iq
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pb-2 text-sm text-slate-400",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-slate-200",
						children: result.classification
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1",
						children: [
							"Intervalo de 95%:",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
								className: "text-slate-200",
								children: [
									result.iqLow,
									"–",
									result.iqHigh
								]
							})
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 grid gap-3 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "stat rounded-lg border border-slate-700 bg-slate-900/50 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[0.68rem] uppercase tracking-[0.18em] text-slate-400",
								children: "Percentil"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-display mt-1.5 text-2xl font-semibold text-slate-200",
								children: [result.percentile, "%"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-xs text-slate-500",
								children: "da população"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "stat rounded-lg border border-slate-700 bg-slate-900/50 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[0.68rem] uppercase tracking-[0.18em] text-slate-400",
								children: "Acertos"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-display mt-1.5 text-2xl font-semibold text-slate-200",
								children: [
									result.rawScore,
									"/",
									result.totalItems
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-xs text-slate-500",
								children: "escore bruto"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "stat rounded-lg border border-slate-700 bg-slate-900/50 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[0.68rem] uppercase tracking-[0.18em] text-slate-400",
								children: "Theta (θ)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display mt-1.5 text-2xl font-semibold text-slate-200",
								children: result.theta.toFixed(2)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-xs text-slate-500",
								children: "habilidade latente"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "stat rounded-lg border border-slate-700 bg-slate-900/50 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[0.68rem] uppercase tracking-[0.18em] text-slate-400",
								children: "Erro-padrão"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-display mt-1.5 text-2xl font-semibold text-slate-200",
								children: ["±", (result.seTheta * 15).toFixed(1)]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-xs text-slate-500",
								children: "QI"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-7 flex flex-wrap gap-2",
				children: onExit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onExit,
					className: "btn-primary",
					children: "Voltar ao painel"
				})
			})
		]
	});
}
var FIELD_WIDTH = 12;
var FIELD_HEIGHT = 8;
var INITIAL_POSITIONS = {
	red: [
		{
			x: 1,
			y: 4
		},
		{
			x: 3,
			y: 2
		},
		{
			x: 3,
			y: 4
		},
		{
			x: 3,
			y: 6
		},
		{
			x: 5,
			y: 4
		}
	],
	blue: [
		{
			x: 11,
			y: 4
		},
		{
			x: 9,
			y: 2
		},
		{
			x: 9,
			y: 4
		},
		{
			x: 9,
			y: 6
		},
		{
			x: 7,
			y: 4
		}
	]
};
function FutebolBotao() {
	const [ball, setBall] = (0, import_react.useState)({
		x: 6,
		y: 4
	});
	const [positions, setPositions] = (0, import_react.useState)(INITIAL_POSITIONS);
	const [turn, setTurn] = (0, import_react.useState)("red");
	const [selectedPlayer, setSelectedPlayer] = (0, import_react.useState)(null);
	const [score, setScore] = (0, import_react.useState)({
		red: 0,
		blue: 0
	});
	function movePlayer(team, playerIndex, dx, dy) {
		if (team !== turn) return;
		const newPositions = { ...positions };
		const currentPos = newPositions[team][playerIndex];
		const newPos = {
			x: currentPos.x + dx,
			y: currentPos.y + dy
		};
		if (newPos.x < 0 || newPos.x >= FIELD_WIDTH || newPos.y < 0 || newPos.y >= FIELD_HEIGHT) return;
		newPositions[team][playerIndex] = newPos;
		setPositions(newPositions);
		checkBallCollision(newPos);
		setTurn(team === "red" ? "blue" : "red");
		setSelectedPlayer(null);
	}
	function checkBallCollision(playerPos) {
		if (Math.abs(playerPos.x - ball.x) <= 1 && Math.abs(playerPos.y - ball.y) <= 1) {
			const dx = ball.x - playerPos.x;
			const dy = ball.y - playerPos.y;
			const newBallX = Math.max(0, Math.min(FIELD_WIDTH - 1, ball.x + dx));
			const newBallY = Math.max(0, Math.min(FIELD_HEIGHT - 1, ball.y + dy));
			setBall({
				x: newBallX,
				y: newBallY
			});
			if (newBallX === 0 || newBallX === FIELD_WIDTH - 1) {
				const scoringTeam = newBallX === 0 ? "blue" : "red";
				setScore((prev) => ({
					...prev,
					[scoringTeam]: prev[scoringTeam] + 1
				}));
				setBall({
					x: 6,
					y: 4
				});
				setPositions(INITIAL_POSITIONS);
			}
		}
	}
	function resetGame() {
		setBall({
			x: 6,
			y: 4
		});
		setPositions(INITIAL_POSITIONS);
		setTurn("red");
		setSelectedPlayer(null);
		setScore({
			red: 0,
			blue: 0
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-[calc(100vh-73px)] flex-col items-center justify-center px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-2xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4 flex items-center justify-between",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-tech text-sm",
								children: ["Vermelho: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-red-500",
									children: score.red
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-tech text-sm",
								children: ["Azul: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-blue-500",
									children: score.blue
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-tech text-sm",
							children: [
								"Turno:",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: turn === "red" ? "text-red-500" : "text-blue-500",
									children: turn === "red" ? "Vermelho" : "Azul"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: resetGame,
							className: "text-tech rounded-md bg-secondary px-3 py-1 text-xs",
							children: "Reiniciar"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative rounded-lg border-2 border-border bg-green-900/20 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid gap-1",
							style: { gridTemplateColumns: `repeat(${FIELD_WIDTH}, 1fr)` },
							children: Array.from({ length: FIELD_HEIGHT }).map((_, y) => Array.from({ length: FIELD_WIDTH }).map((_, x) => {
								const redPlayer = positions.red.findIndex((p) => p.x === x && p.y === y);
								const bluePlayer = positions.blue.findIndex((p) => p.x === x && p.y === y);
								const isBall = ball.x === x && ball.y === y;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `aspect-square rounded border border-green-800/30 ${x === FIELD_WIDTH / 2 - 1 || x === FIELD_WIDTH / 2 ? "border-x-2 border-green-700/50" : ""}`,
									children: [
										redPlayer !== -1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setSelectedPlayer(selectedPlayer === redPlayer ? null : redPlayer),
											className: `size-full rounded-full ${selectedPlayer === redPlayer && turn === "red" ? "bg-red-500 ring-2 ring-white" : "bg-red-600"} transition-all`
										}),
										bluePlayer !== -1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setSelectedPlayer(selectedPlayer === bluePlayer + 100 ? null : bluePlayer + 100),
											className: `size-full rounded-full ${selectedPlayer === bluePlayer + 100 && turn === "blue" ? "bg-blue-500 ring-2 ring-white" : "bg-blue-600"} transition-all`
										}),
										isBall && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "absolute inset-0 flex items-center justify-center",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-3 rounded-full bg-white shadow-lg" })
										})
									]
								}, `${x}-${y}`);
							}))
						}),
						selectedPlayer !== null && turn === "red" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => movePlayer("red", selectedPlayer, -1, 0),
									className: "rounded bg-secondary px-3 py-2 text-xs",
									children: "←"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => movePlayer("red", selectedPlayer, 0, -1),
									className: "rounded bg-secondary px-3 py-2 text-xs",
									children: "↑"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => movePlayer("red", selectedPlayer, 0, 1),
									className: "rounded bg-secondary px-3 py-2 text-xs",
									children: "↓"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => movePlayer("red", selectedPlayer, 1, 0),
									className: "rounded bg-secondary px-3 py-2 text-xs",
									children: "→"
								})
							]
						}),
						selectedPlayer !== null && turn === "blue" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => movePlayer("blue", selectedPlayer - 100, -1, 0),
									className: "rounded bg-secondary px-3 py-2 text-xs",
									children: "←"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => movePlayer("blue", selectedPlayer - 100, 0, -1),
									className: "rounded bg-secondary px-3 py-2 text-xs",
									children: "↑"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => movePlayer("blue", selectedPlayer - 100, 0, 1),
									className: "rounded bg-secondary px-3 py-2 text-xs",
									children: "↓"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => movePlayer("blue", selectedPlayer - 100, 1, 0),
									className: "rounded bg-secondary px-3 py-2 text-xs",
									children: "→"
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-center text-xs text-muted-foreground",
					children: "Clique no seu jogador e use as setas para mover. Chute a bola para marcar!"
				})
			]
		})
	});
}
var IDEOLOGIES = [
	"Honor & Duty",
	"Freedom & Liberty",
	"Order & Discipline",
	"Progress & Innovation",
	"Tradition & Heritage"
];
var PERSONALITIES = [
	"Diplomatic",
	"Aggressive",
	"Analytical",
	"Charismatic",
	"Stoic"
];
var STRATEGIES = [
	"Logical Arguments",
	"Emotional Appeal",
	"Historical Precedent",
	"Future Vision",
	"Moral Superiority"
];
function RobotLab() {
	const { state, update } = useStore();
	const [config, setConfig] = (0, import_react.useState)({
		name: "Pracinha Bot",
		ideology: IDEOLOGIES[0],
		personality: PERSONALITIES[0],
		strategy: STRATEGIES[0],
		aggressiveness: 50,
		eloquence: 50,
		logic: 50
	});
	function saveRobot() {
		update((prev) => ({
			...prev,
			cidadela: {
				...prev.cidadela,
				robots: [...prev.cidadela.robots, { ...config }]
			}
		}));
		setConfig({
			name: "Pracinha Bot",
			ideology: IDEOLOGIES[0],
			personality: PERSONALITIES[0],
			strategy: STRATEGIES[0],
			aggressiveness: 50,
			eloquence: 50,
			logic: 50
		});
	}
	function loadRobot(robot) {
		setConfig({ ...robot });
	}
	function deleteRobot(index) {
		update((prev) => ({
			...prev,
			cidadela: {
				...prev.cidadela,
				robots: prev.cidadela.robots.filter((_, i) => i !== index)
			}
		}));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-[calc(100vh-73px)] flex-col px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto w-full max-w-2xl py-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-stencil text-2xl",
					children: "Laboratório de Robô"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Configure seu robô para usar no Pracinha IA e Arena de Batalha"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 space-y-6 rounded-xl border border-border bg-secondary p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-medium",
							children: "Nome do Robô"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: config.name,
							onChange: (e) => setConfig({
								...config,
								name: e.target.value
							}),
							className: "mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-medium",
							children: "Ideologia"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: config.ideology,
							onChange: (e) => setConfig({
								...config,
								ideology: e.target.value
							}),
							className: "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
							children: IDEOLOGIES.map((ideology) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: ideology,
								children: ideology
							}, ideology))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-medium",
							children: "Personalidade"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: config.personality,
							onChange: (e) => setConfig({
								...config,
								personality: e.target.value
							}),
							className: "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
							children: PERSONALITIES.map((personality) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: personality,
								children: personality
							}, personality))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-medium",
							children: "Estratégia de Debate"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: config.strategy,
							onChange: (e) => setConfig({
								...config,
								strategy: e.target.value
							}),
							className: "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
							children: STRATEGIES.map((strategy) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: strategy,
								children: strategy
							}, strategy))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block text-xs font-medium",
									children: [
										"Agressividade: ",
										config.aggressiveness,
										"%"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "range",
									min: "0",
									max: "100",
									value: config.aggressiveness,
									onChange: (e) => setConfig({
										...config,
										aggressiveness: Number(e.target.value)
									}),
									className: "mt-1 w-full"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block text-xs font-medium",
									children: [
										"Eloquência: ",
										config.eloquence,
										"%"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "range",
									min: "0",
									max: "100",
									value: config.eloquence,
									onChange: (e) => setConfig({
										...config,
										eloquence: Number(e.target.value)
									}),
									className: "mt-1 w-full"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block text-xs font-medium",
									children: [
										"Lógica: ",
										config.logic,
										"%"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "range",
									min: "0",
									max: "100",
									value: config.logic,
									onChange: (e) => setConfig({
										...config,
										logic: Number(e.target.value)
									}),
									className: "mt-1 w-full"
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: saveRobot,
							className: "text-tech w-full rounded-lg bg-[color:var(--brass)] py-3 text-sm text-[color:var(--matte)]",
							children: "Salvar Robô"
						})
					]
				}),
				state.cidadela.robots.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-stencil text-lg",
						children: "Robôs Salvos"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 space-y-2",
						children: state.cidadela.robots.map((robot, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between rounded-lg border border-border bg-secondary px-4 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-medium",
								children: robot.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted-foreground",
								children: [
									robot.ideology,
									" · ",
									robot.personality
								]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => loadRobot(robot),
									className: "rounded bg-background px-3 py-1 text-xs hover:bg-muted",
									children: "Carregar"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => deleteRobot(index),
									className: "rounded bg-destructive/10 px-3 py-1 text-xs text-destructive hover:bg-destructive/20",
									children: "Excluir"
								})]
							})]
						}, index))
					})]
				})
			]
		})
	});
}
var DEFAULT_TOPICS = ["A eugenia burocrática: políticas de controle populacional", "A força instituição brasileira foi a primeira vítima dessa eugenia"];
function BattleArena() {
	const { state, update } = useStore();
	const [selectedMyRobot, setSelectedMyRobot] = (0, import_react.useState)(null);
	const [inputArgument, setInputArgument] = (0, import_react.useState)("");
	const [isSearching, setIsSearching] = (0, import_react.useState)(false);
	const [battle, setBattle] = (0, import_react.useState)(null);
	const [isMyTurn, setIsMyTurn] = (0, import_react.useState)(false);
	const [selectedTopic, setSelectedTopic] = (0, import_react.useState)(null);
	const [showTopicSelector, setShowTopicSelector] = (0, import_react.useState)(true);
	const [newTopicName, setNewTopicName] = (0, import_react.useState)("");
	const [showPaywall, setShowPaywall] = (0, import_react.useState)(false);
	function startBattle() {
		if (!selectedMyRobot) {
			alert("Selecione um robô primeiro!");
			return;
		}
		if (!selectedTopic) {
			alert("Selecione um assunto primeiro!");
			return;
		}
		setIsSearching(true);
		setTimeout(() => {
			setIsSearching(false);
			setBattle({
				topic: selectedTopic,
				status: "active",
				current_round: 1,
				player1_name: selectedMyRobot.name,
				player2_name: "Oponente",
				messages: []
			});
			setIsMyTurn(true);
			setShowTopicSelector(false);
		}, 2e3);
	}
	function handleCreateCustomTopic() {
		if (!state.cidadela.isPremium && state.cidadela.customTopics.length >= 1) {
			setShowPaywall(true);
			return;
		}
		if (!newTopicName.trim()) {
			alert("Digite um nome para o assunto!");
			return;
		}
		const newTopic = {
			id: Date.now().toString(),
			name: newTopicName.trim(),
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		update((prev) => ({
			...prev,
			cidadela: {
				...prev.cidadela,
				customTopics: [...prev.cidadela.customTopics, newTopic]
			}
		}));
		setNewTopicName("");
		setSelectedTopic(newTopic.name);
	}
	function handleUnlockPremium() {
		const whatsappNumber = state.whatsapp || "5511999999999";
		const message = encodeURIComponent("Olá! Gostaria de desbloquear o plano Premium da Arena de Batalha por R$98,99/semestral.");
		window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
	}
	function handleSendArgument() {
		if (!inputArgument.trim() || !isMyTurn) return;
		setBattle((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				messages: [...prev.messages, {
					id: Date.now(),
					text: inputArgument
				}],
				current_round: prev.current_round + 1
			};
		});
		setInputArgument("");
		setIsMyTurn(false);
		setTimeout(() => setIsMyTurn(true), 1500);
	}
	const robot1 = battle?.player1_robot || {
		name: "Cobra Fumante",
		ideology: "Honor & Duty",
		personality: "Aggressive",
		strategy: "Moral Superiority",
		aggressiveness: 80,
		eloquence: 70,
		logic: 60,
		hp: 100
	};
	const robot2 = battle?.player2_robot || {
		name: "Monte Castelo",
		ideology: "Freedom & Liberty",
		personality: "Diplomatic",
		strategy: "Logical Arguments",
		aggressiveness: 30,
		eloquence: 80,
		logic: 90,
		hp: 100
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-[calc(100vh-73px)] flex-col px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto w-full max-w-4xl py-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-stencil text-2xl",
					children: "Arena de Batalha"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "6 rodadas • Sistema de vida"
				}),
				showTopicSelector && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 rounded-xl border border-border bg-secondary p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-stencil text-lg mb-4",
							children: "Assunto do Debate"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3",
							children: [
								DEFAULT_TOPICS.map((topic) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setSelectedTopic(topic),
									className: `text-left rounded-lg border px-4 py-3 transition-all ${selectedTopic === topic ? "border-[color:var(--brass)] bg-[color:var(--brass)]/10" : "border-border bg-background hover:border-[color:var(--brass)]/50"}`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-medium",
										children: topic
									})
								}, topic)),
								state.cidadela.customTopics.map((topic) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setSelectedTopic(topic.name),
									className: `text-left rounded-lg border px-4 py-3 transition-all ${selectedTopic === topic.name ? "border-[color:var(--brass)] bg-[color:var(--brass)]/10" : "border-border bg-background hover:border-[color:var(--brass)]/50"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-medium",
										children: topic.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground mt-1",
										children: "Customizado"
									})]
								}, topic.id)),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-dashed border-border bg-background/50 p-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: newTopicName,
											onChange: (e) => setNewTopicName(e.target.value),
											placeholder: "Novo assunto...",
											className: "flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: handleCreateCustomTopic,
											disabled: !state.cidadela.isPremium && state.cidadela.customTopics.length >= 1,
											className: "rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--matte)] disabled:opacity-50",
											children: "Criar"
										})]
									}), !state.cidadela.isPremium && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-muted-foreground mt-2",
										children: [
											"Grátis: ",
											state.cidadela.customTopics.length,
											"/1"
										]
									})]
								})
							]
						}),
						selectedTopic && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setShowTopicSelector(false),
							className: "mt-4 w-full rounded-lg bg-[color:var(--brass)] px-4 py-3 text-sm font-medium text-[color:var(--matte)]",
							children: "Selecionar Robô"
						})
					]
				}),
				showPaywall && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-4 max-w-md rounded-xl border border-border bg-secondary p-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-stencil text-xl mb-2",
								children: "🔒 Desbloquear Premium"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted-foreground mb-4",
								children: "Limite atingido. Desbloqueie para criar ilimitados."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg bg-background p-4 mb-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-lg font-bold text-[color:var(--brass)]",
									children: "R$98,99/semestral"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground mt-1",
									children: "Ilimitados"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleUnlockPremium,
								className: "w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors",
								children: "WhatsApp"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setShowPaywall(false),
								className: "mt-2 w-full rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-background transition-colors",
								children: "Cancelar"
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 grid gap-6 lg:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border bg-secondary p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-stencil text-lg",
									children: robot1.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs text-muted-foreground",
											children: "HP"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-2 w-24 rounded-full bg-muted",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "h-2 rounded-full bg-green-500 transition-all",
												style: { width: `${robot1.hp}%` }
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-bold",
											children: robot1.hp
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: robot1.ideology
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 space-y-1 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Personalidade: ", robot1.personality] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Estratégia: ", robot1.strategy] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
										"Agressividade: ",
										robot1.aggressiveness,
										"%"
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
										"Eloquência: ",
										robot1.eloquence,
										"%"
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
										"Lógica: ",
										robot1.logic,
										"%"
									] })
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border bg-secondary p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-stencil text-lg",
									children: robot2.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs text-muted-foreground",
											children: "HP"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-2 w-24 rounded-full bg-muted",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "h-2 rounded-full bg-blue-500 transition-all",
												style: { width: `${robot2.hp}%` }
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-bold",
											children: robot2.hp
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: robot2.ideology
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 space-y-1 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Personalidade: ", robot2.personality] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Estratégia: ", robot2.strategy] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
										"Agressividade: ",
										robot2.aggressiveness,
										"%"
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
										"Eloquência: ",
										robot2.eloquence,
										"%"
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
										"Lógica: ",
										robot2.logic,
										"%"
									] })
								]
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 rounded-lg border border-border bg-secondary p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "block text-xs font-medium mb-2",
						children: "Selecione seu robô (opcional)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: selectedMyRobot?.name || "",
						onChange: (e) => {
							const robot = state.cidadela.robots.find((r) => r.name === e.target.value);
							setSelectedMyRobot(robot || null);
						},
						className: "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "",
							children: "Usar robô padrão"
						}), state.cidadela.robots.map((robot, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
							value: robot.name,
							children: [
								robot.name,
								" (",
								robot.ideology,
								")"
							]
						}, index))]
					})]
				}),
				isSearching && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 rounded-lg border-2 border-yellow-500 bg-secondary px-4 py-3 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: "Buscando oponente..."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "Aguardando outro jogador entrar na arena"
					})]
				}),
				battle && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 rounded-lg border border-[color:var(--brass)] bg-secondary px-4 py-2 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm font-medium",
							children: ["Tema do Debate: ", battle.topic]
						}),
						battle.status === "active" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								"Rodada ",
								battle.current_round,
								"/6"
							]
						}),
						isMyTurn && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-green-400 font-medium",
							children: "Sua vez!"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 rounded-xl border border-border bg-secondary p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-stencil text-lg",
								children: "Debate"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: startBattle,
								disabled: battle?.status === "active" || isSearching,
								className: "text-tech rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--matte)] disabled:opacity-50",
								children: isSearching ? "Buscando..." : battle?.status === "active" ? "Em andamento" : "Iniciar Batalha"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "max-h-80 space-y-3 overflow-y-auto",
							children: [!battle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-center text-sm text-muted-foreground",
								children: "Clique em \"Iniciar Batalha\" para buscar um oponente e começar o debate"
							}), battle?.messages.map((msg) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg px-4 py-2 border-l-4 border-red-500 bg-red-500/10",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-medium",
									children: battle.player1_name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm",
									children: msg.text
								})]
							}, msg.id))]
						}),
						battle?.status === "active" && isMyTurn && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: inputArgument,
								onChange: (e) => setInputArgument(e.target.value),
								placeholder: "Digite seu argumento...",
								className: "flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleSendArgument,
								className: "rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--matte)]",
								children: "Enviar"
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 rounded-lg border border-border bg-secondary px-4 py-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Como funciona:" }), " Cada argumento causa dano baseado em eloquência, lógica e agressividade. O robô com maior defesa reduz o dano recebido. 6 rodadas ou até um robô perder todo o HP."]
					})
				})
			]
		})
	});
}
var tone = {
	war: {
		border: "border-war-dust/45",
		text: "text-war-dust",
		shadow: "shadow-[var(--shadow-dust)]",
		body: "bg-[color-mix(in_oklab,var(--war-deep)_92%,black)]",
		roof: "color-mix(in oklab, var(--war-dust) 72%, transparent)"
	},
	modern: {
		border: "border-modern-glow/45",
		text: "text-modern-glow",
		shadow: "shadow-[var(--shadow-ember)]",
		body: "bg-[color-mix(in_oklab,var(--modern-deep)_92%,black)]",
		roof: "color-mix(in oklab, var(--modern-glow) 72%, transparent)"
	},
	future: {
		border: "border-neon/55",
		text: "text-neon",
		shadow: "shadow-[var(--shadow-neon)]",
		body: "bg-[color-mix(in_oklab,var(--future-deep)_92%,black)]",
		roof: "color-mix(in oklab, var(--neon) 78%, transparent)"
	}
};
/** Casinha isométrica pequena, fincada no chão do mapa. */
function MapBuilding({ title, era, icon, href = "#", top, left, onClick }) {
	const t = tone[era];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		style: {
			top,
			left
		},
		className: `group absolute z-20 -translate-x-1/2 -translate-y-full focus:outline-none ${t.text}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				"aria-hidden": true,
				className: "absolute bottom-[-16px] left-1/2 -z-10 h-16 w-16 rounded-[4px] border border-current/25 bg-current/10 transition-all duration-300 group-hover:border-current/60",
				style: { transform: "translateX(-50%) rotateX(60deg) rotateZ(45deg)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "block transition-transform duration-300 group-hover:-translate-y-1",
				style: { animation: "floatY 8s ease-in-out infinite" },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					className: "mx-auto block h-0 w-0",
					style: {
						borderLeft: "1.85rem solid transparent",
						borderRight: "1.85rem solid transparent",
						borderBottom: `0.85rem solid ${t.roof}`
					}
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: `flex h-9 w-[3.7rem] items-center justify-center rounded-b-[4px] border ${t.border} ${t.shadow} ${t.body} backdrop-blur-[2px]`,
					children: icon
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `mt-2 block w-max max-w-[8rem] rounded-sm border ${t.border} ${t.body} px-2 py-[2px] text-center font-body text-[0.6rem] font-semibold tracking-[0.18em] uppercase backdrop-blur-[2px]`,
				children: title
			})
		]
	});
}
function TemporalLobby({ onNavigate }) {
	const scrollRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTo({
			left: (el.scrollWidth - el.clientWidth) / 2,
			top: el.scrollHeight
		});
	}, []);
	const handleModuleClick = (moduleId) => {
		onNavigate(moduleId);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative h-screen w-full overflow-hidden bg-[var(--future-deep)] font-body",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: scrollRef,
				className: "h-full w-full overflow-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "era-panel scanlines relative",
					style: {
						width: "max(100%, 1800px)",
						height: "2800px",
						background: "linear-gradient(to top, var(--war-deep) 0%, var(--war) 16%, var(--modern-deep) 42%, var(--modern) 56%, var(--future) 80%, var(--future-deep) 100%)"
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							"aria-hidden": true,
							className: "pointer-events-none absolute inset-0 opacity-[0.14]",
							style: { backgroundImage: "repeating-linear-gradient(45deg, oklch(1 0 0 / .5) 0 1px, transparent 1px 64px), repeating-linear-gradient(-45deg, oklch(1 0 0 / .5) 0 1px, transparent 1px 64px)" }
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							"aria-hidden": true,
							className: "dust-veil era-panel pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							"aria-hidden": true,
							className: "neon-veil era-panel pointer-events-none absolute inset-x-0 top-0 h-1/3"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							"aria-hidden": true,
							className: "pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-full w-[130px]",
									style: { background: "linear-gradient(to top, oklch(0.42 0.05 80), var(--road) 45%, oklch(0.3 0.05 285) 78%, oklch(0.4 0.12 300))" }
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-y-0 left-0 w-[3px] bg-foreground/10" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-y-0 right-0 w-[3px] bg-foreground/10" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 opacity-70",
									style: {
										backgroundImage: "repeating-linear-gradient(to bottom, color-mix(in oklab, var(--war-dust) 30%, transparent) 0 46px, transparent 46px 96px)",
										maskImage: "linear-gradient(to top, transparent 0%, black 22%, black 100%)",
										animation: "dashUp 5s linear infinite"
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "absolute top-0 left-0 h-[22%] w-[3px]",
									style: {
										background: "color-mix(in oklab, var(--neon) 85%, transparent)",
										boxShadow: "var(--shadow-neon)",
										animation: "flicker 5s ease-in-out infinite"
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "absolute top-0 right-0 h-[22%] w-[3px]",
									style: {
										background: "color-mix(in oklab, var(--neon-2) 85%, transparent)",
										boxShadow: "var(--shadow-neon)",
										animation: "flicker 6s ease-in-out infinite"
									}
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EraTag, {
							top: "88%",
							label: "1944 · A Era da Guerra",
							cls: "text-war-dust"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EraTag, {
							top: "52%",
							label: "Hoje · A Modernidade",
							cls: "text-modern-glow"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EraTag, {
							top: "14%",
							label: "2100 · O Futuro",
							cls: "text-neon"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Prop, {
							top: "95%",
							left: "calc(50% - 230px)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DryTree, { className: "h-14 text-war-dust/80" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Prop, {
							top: "90%",
							left: "calc(50% + 210px)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DryTree, { className: "h-10 text-war-dust/70" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Prop, {
							top: "83%",
							left: "calc(50% - 300px)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DryTree, { className: "h-12 text-war-dust/70" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Prop, {
							top: "79%",
							left: "calc(50% + 300px)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fence, { className: "h-6 w-56 text-war-dust/70" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Prop, {
							top: "93%",
							left: "calc(50% - 420px)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fence, { className: "h-6 w-64 text-war-dust/60" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapBuilding, {
							title: "A Arena",
							era: "war",
							top: "86%",
							left: "calc(50% - 130px)",
							onClick: () => handleModuleClick("battle-arena"),
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Swords, {
								size: 16,
								strokeWidth: 1.75
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Prop, {
							top: "58%",
							left: "calc(50% - 290px)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Favela, { className: "h-20 w-56 text-modern-deep/85" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Prop, {
							top: "47%",
							left: "calc(50% + 300px)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skyline, { className: "h-28 w-64 text-modern-deep/90" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Prop, {
							top: "63%",
							left: "calc(50% + 250px)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skyline, { className: "h-20 w-48 text-modern-deep/70" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapBuilding, {
							title: "Testes de QI",
							era: "modern",
							top: "53%",
							left: "calc(50% + 130px)",
							onClick: () => handleModuleClick("iq-test"),
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrainCircuit, {
								size: 16,
								strokeWidth: 1.75
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Prop, {
							top: "20%",
							left: "calc(50% - 320px)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FutureCity, { className: "h-32 w-72 text-future-deep" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Prop, {
							top: "12%",
							left: "calc(50% + 320px)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FutureCity, { className: "h-28 w-64 text-future-deep" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapBuilding, {
							title: "O Laboratório",
							era: "future",
							top: "26%",
							left: "calc(50% - 135px)",
							onClick: () => handleModuleClick("robot-lab"),
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlaskConical, {
								size: 16,
								strokeWidth: 1.75
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapBuilding, {
							title: "Chat da IA",
							era: "future",
							top: "10%",
							left: "calc(50% + 135px)",
							onClick: () => handleModuleClick("chat-ai"),
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bot, {
								size: 16,
								strokeWidth: 1.75
							})
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "pointer-events-none absolute top-4 left-1/2 z-30 -translate-x-1/2 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-lg font-bold tracking-[0.25em] text-war-dust uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] sm:text-2xl",
					children: "Cidadela Temporal"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-[0.65rem] tracking-[0.3em] text-war-dust/70 uppercase",
					children: "Role o mapa · a estrada sobe de 1944 até 2100"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "absolute bottom-4 left-1/2 z-30 -translate-x-1/2 px-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex flex-wrap items-center justify-center gap-2 rounded-xl border border-foreground/15 bg-[color-mix(in_oklab,var(--future-deep)_88%,black)]/90 p-2 shadow-lg backdrop-blur-md",
					children: [
						{
							label: "Arena",
							module: "battle-arena",
							icon: Swords,
							cls: "text-war-dust border-war-dust/50"
						},
						{
							label: "Testes",
							module: "iq-test",
							icon: BrainCircuit,
							cls: "text-modern-glow border-modern-glow/50"
						},
						{
							label: "Laboratório",
							module: "robot-lab",
							icon: FlaskConical,
							cls: "text-neon border-neon/50"
						},
						{
							label: "Chat",
							module: "chat-ai",
							icon: Bot,
							cls: "text-neon border-neon/50"
						}
					].map(({ label, module, icon: Icon, cls }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => handleModuleClick(module),
						className: `flex items-center gap-2 rounded-lg border px-3 py-2 text-[0.7rem] font-semibold tracking-[0.18em] uppercase transition-all duration-200 hover:-translate-y-0.5 hover:bg-foreground/5 ${cls}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							size: 15,
							strokeWidth: 1.75
						}), label]
					}) }, label))
				})
			})
		]
	});
}
function EraTag({ top, label, cls }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		style: { top },
		className: `absolute left-[calc(50%-560px)] z-10 -translate-y-1/2 ${cls}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-sm font-semibold tracking-[0.3em] uppercase opacity-80",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-1 h-px w-40 bg-current opacity-25" })]
	});
}
function Prop({ top, left, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		"aria-hidden": true,
		style: {
			top,
			left
		},
		className: "pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full",
		children
	});
}
function DryTree({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 40 100",
		className,
		fill: "none",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M20 100V38M20 52 6 34M20 60l14-18M20 40 12 22M20 44l10-16M20 30l-5-12M20 32l6-14",
			stroke: "currentColor",
			strokeWidth: "2.4",
			strokeLinecap: "round"
		})
	});
}
function Fence({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 400 40",
		preserveAspectRatio: "none",
		className,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
			stroke: "currentColor",
			strokeWidth: "3",
			children: [
				Array.from({ length: 21 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: i * 20 + 4,
					y1: 40,
					x2: i * 20 + 4,
					y2: 10
				}, i)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: 0,
					y1: 18,
					x2: 400,
					y2: 18
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: 0,
					y1: 30,
					x2: 400,
					y2: 30
				})
			]
		})
	});
}
function Favela({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 220 110",
		preserveAspectRatio: "none",
		className,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
			fill: "currentColor",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "0",
					y: "60",
					width: "46",
					height: "50"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "34",
					y: "42",
					width: "40",
					height: "68"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "70",
					y: "72",
					width: "36",
					height: "38"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "100",
					y: "50",
					width: "44",
					height: "60"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "138",
					y: "78",
					width: "34",
					height: "32"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "166",
					y: "58",
					width: "54",
					height: "52"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
			fill: "color-mix(in oklab, var(--modern-glow) 75%, transparent)",
			children: [
				[10, 70],
				[44, 54],
				[80, 84],
				[112, 62],
				[148, 88],
				[178, 70],
				[200, 88]
			].map(([x, y], i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x,
				y,
				width: "7",
				height: "9"
			}, i))
		})]
	});
}
function Skyline({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 240 160",
		preserveAspectRatio: "none",
		className,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
			fill: "currentColor",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "0",
					y: "60",
					width: "42",
					height: "100"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "48",
					y: "20",
					width: "46",
					height: "140"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "100",
					y: "76",
					width: "38",
					height: "84"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "144",
					y: "40",
					width: "44",
					height: "120"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "194",
					y: "88",
					width: "46",
					height: "72"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
			fill: "color-mix(in oklab, var(--modern-glow) 60%, transparent)",
			children: Array.from({ length: 40 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: 8 + i % 8 * 29,
				y: 40 + Math.floor(i / 8) * 24,
				width: "6",
				height: "10",
				opacity: i % 3 === 0 ? .35 : .85
			}, i))
		})]
	});
}
function FutureCity({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 260 180",
		preserveAspectRatio: "none",
		className,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
				fill: "currentColor",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 180V70l24-16 24 16v110z" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M66 180V34l20-14 20 14v146z" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: "118",
						y: "86",
						width: "42",
						height: "94",
						rx: "6"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M176 180V56l26-18 26 18v124z" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: "234",
						y: "104",
						width: "26",
						height: "76",
						rx: "5"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
				stroke: "color-mix(in oklab, var(--neon) 85%, transparent)",
				strokeWidth: "2",
				strokeLinecap: "round",
				style: { animation: "pulseGlow 4s ease-in-out infinite" },
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: "10",
						y1: "86",
						x2: 50,
						y2: 86
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: "70",
						y1: "52",
						x2: 102,
						y2: 52
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: "122",
						y1: "100",
						x2: 156,
						y2: 100
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: "180",
						y1: "74",
						x2: 224,
						y2: 74
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: "238",
						y1: "118",
						x2: 256,
						y2: 118
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
				stroke: "color-mix(in oklab, var(--neon-2) 80%, transparent)",
				strokeWidth: "2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: 0,
					y1: 30,
					x2: 120,
					y2: 14
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: 140,
					y1: 10,
					x2: 260,
					y2: 28
				})]
			})
		]
	});
}
function CidadelaWorld() {
	const { state, update } = useStore();
	const [unlocked, setUnlocked] = (0, import_react.useState)(false);
	const [code, setCode] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [activeModule, setActiveModule] = (0, import_react.useState)(null);
	const [validating, setValidating] = (0, import_react.useState)(false);
	async function tryUnlock(e) {
		e.preventDefault();
		const value = code.trim().toUpperCase();
		const isPremiumCode = value.startsWith("PREMIUM-") || value === "FEB-VIP";
		if (value === state.admin.accessKey.toUpperCase()) {
			update((prev) => ({
				...prev,
				cidadela: {
					...prev.cidadela,
					accessHistory: [(/* @__PURE__ */ new Date()).toISOString(), ...prev.cidadela.accessHistory].slice(0, 20),
					isPremium: isPremiumCode || prev.cidadela.isPremium
				}
			}));
			setUnlocked(true);
			setCode("");
			setError("");
			return;
		}
		setValidating(true);
		setError("");
		try {
			const response = await validateCidadelaCode(state.integrations.cidadelaAuthUrl, value);
			if (response.success && response.autenticado) {
				update((prev) => ({
					...prev,
					cidadela: {
						...prev.cidadela,
						accessHistory: [(/* @__PURE__ */ new Date()).toISOString(), ...prev.cidadela.accessHistory].slice(0, 20),
						isPremium: isPremiumCode || prev.cidadela.isPremium
					}
				}));
				setUnlocked(true);
				setCode("");
			} else if (state.cidadela.codes.some((c) => c.code.toUpperCase() === value)) {
				update((prev) => ({
					...prev,
					cidadela: {
						...prev.cidadela,
						accessHistory: [(/* @__PURE__ */ new Date()).toISOString(), ...prev.cidadela.accessHistory].slice(0, 20),
						isPremium: isPremiumCode || prev.cidadela.isPremium
					}
				}));
				setUnlocked(true);
				setCode("");
			} else {
				const errorMsg = response.erro === "codigo_expirado" ? "Código expirado. Solicite um novo código." : response.erro === "tentativas_excedidas" ? "Muitas tentativas. Tente novamente em 5 minutos." : "Código negado. Acesso restrito ao comando.";
				setError(errorMsg);
			}
		} catch {
			if (state.cidadela.codes.some((c) => c.code.toUpperCase() === value)) {
				update((prev) => ({
					...prev,
					cidadela: {
						...prev.cidadela,
						accessHistory: [(/* @__PURE__ */ new Date()).toISOString(), ...prev.cidadela.accessHistory].slice(0, 20),
						isPremium: isPremiumCode || prev.cidadela.isPremium
					}
				}));
				setUnlocked(true);
				setCode("");
			} else setError("Código negado. Acesso restrito ao comando.");
		} finally {
			setValidating(false);
		}
	}
	if (activeModule) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between border-b border-border px-6 py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CobraFumando, { className: "size-8 text-[color:var(--brass)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-stencil text-lg",
						children: "CIDADELA"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setActiveModule(null),
					className: "text-tech rounded-md bg-secondary px-4 py-2 text-sm",
					children: "Voltar ao Mundo"
				})]
			}),
			activeModule === "praxinha" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PracinhaIA, {}),
			activeModule === "iq" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IQTest, {}),
			activeModule === "arena" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BattleArena, {}),
			activeModule === "lab" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RobotLab, {}),
			activeModule === "futebol" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FutebolBotao, {})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen bg-background",
		children: !unlocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-screen flex-col items-center justify-center px-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto grid size-20 place-items-center rounded-full border-2 border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CobraFumando, { className: "size-10 text-[color:var(--brass)]" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-stencil mt-6 text-3xl",
					children: "CIDADELA"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-center text-muted-foreground",
					children: "Mundo de honra, dignidade e brio"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: tryUnlock,
					className: "mt-8 w-full max-w-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: code,
							onChange: (e) => {
								setCode(e.target.value);
								setError("");
							},
							placeholder: "Informe o código de acesso",
							className: "text-tech w-full rounded-lg border border-input bg-transparent px-4 py-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-center text-sm text-destructive",
							children: error
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							disabled: validating,
							className: "text-tech mt-4 w-full rounded-lg bg-[color:var(--brass)] py-3 text-sm text-[color:var(--matte)] disabled:opacity-50",
							children: validating ? "Validando..." : "Entrar na Cidadela"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "mt-6 text-sm text-muted-foreground hover:text-foreground",
					children: "← Voltar ao cardápio"
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-h-screen",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TemporalLobby, { onNavigate: (module) => {
				if (module === "battle-arena") setActiveModule("arena");
				else if (module === "iq-test") setActiveModule("iq");
				else if (module === "chat-ai") setActiveModule("praxinha");
				else if (module === "robot-lab") setActiveModule("lab");
			} })
		})
	});
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StoreProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CidadelaWorld, {}) });
//#endregion
export { SplitComponent as component };
