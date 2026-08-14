window.__ModuleLoader__.load({
	id: "dsh-ibka-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		const REFRESH_MS = 5 * 60 * 1000;

		const postReport = (text) => {
			try {
				window.fetch('/api/ibka-balance/log', { method: 'POST', body: String(text), cache: 'no-store' }).catch(() => {});
			} catch (err) { /* ignore */ }
		};

		function BalanceView() {
			const [state, setState] = react.useState({ phase: 'loading', data: null, message: '', at: 0 });
			let refreshFn = null;

			react.useEffect(() => {
				let alive = true;
				const run = async () => {
					try {
						setState((prev) => ({ ...prev, phase: prev.phase === 'ok' || prev.phase === 'refreshing' ? 'refreshing' : 'loading' }));
						let result = null;
						try {
							const res = await window.fetch('/api/ibka-balance', { cache: 'no-store' });
							result = await res.json();
						} catch (err) {
							result = null;
						}
						if (!alive) return;
						if (result && result.ok) {
							setState({ phase: 'ok', data: result, message: '', at: Date.now() });
						} else {
							const msg = String((result && result.error) || '请求失败');
							setState((prev) => ({ phase: 'error', data: prev.data, message: msg, at: Date.now() }));
							postReport('card-error: ' + msg);
						}
					} catch (err) {
						const msg = 'card-crash: ' + String((err && err.message) || err);
						setState((prev) => ({ phase: 'error', data: prev.data, message: msg, at: Date.now() }));
						postReport(msg);
					}
				};
				try {
					refreshFn = run;
					run();
					const id = window.setInterval(run, REFRESH_MS);
					return () => { alive = false; refreshFn = null; window.clearInterval(id); };
				} catch (err) {
					postReport('effect-crash: ' + String((err && err.message) || err));
					return () => {};
				}
			}, []);

			const fmtTime = (ms) => {
				const d = new Date(ms);
				const p = (n) => String(n).padStart(2, '0');
				return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
			};

			const rowStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#9ca3af', lineHeight: 1.4 };
			const dotStyle = (color) => ({ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color, flex: 'none' });
			const btnStyle = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#9ca3af', fontSize: 12, lineHeight: 1 };

			let dotColor = '#9ca3af';
			let text = '';
			let title = '';

			if (state.phase === 'loading') {
				text = 'DeepSeek 余额 …';
			} else if (state.phase === 'error') {
				dotColor = '#ef4444';
				text = '余额读取失败';
				title = state.message || '';
			} else {
				const data = state.data || {};
				const c = Array.isArray(data.currencies) ? data.currencies : [];
				const total = c.reduce((s, x) => s + (x.total || 0), 0);
				const symbol = (c[0] && c[0].currency === 'CNY') ? '¥' : ((c[0] && c[0].currency) || '') + ' ';
				dotColor = total < 5 ? '#ef4444' : (total < 10 ? '#f59e0b' : '#22c55e');
				text = 'DeepSeek 余额 ' + symbol + total.toFixed(2) + (data.available === false ? ' · 不可用' : '');
				const parts = [];
				for (const x of c) {
					parts.push('充值 ' + ((x.currency === 'CNY') ? '¥' : x.currency + ' ') + (x.toppedUp || 0).toFixed(2) + ' · 赠金 ' + ((x.currency === 'CNY') ? '¥' : x.currency + ' ') + (x.granted || 0).toFixed(2));
				}
				title = parts.join(' | ') + ' | 自动每 5 分钟刷新';
				text += ' · 更新 ' + fmtTime(state.at);
			}

			const refresh = () => { if (refreshFn) refreshFn(); };
			return react.createElement('div', { style: rowStyle, title },
				react.createElement('span', { style: dotStyle(dotColor) }),
				react.createElement('span', null, text),
				react.createElement('button', { onClick: refresh, title: '立即刷新余额', style: btnStyle }, '⟳'),
			);
		}

		const apply = (ctx) => {
			const slots = ctx.get('slots');
			if (slots === undefined) return;
			let registered = false;
			const registerOnce = () => {
				if (registered) return () => {};
				registered = true;
				const dispose = slots.register(
					{ name: 'conversation.composer.dock', id: 'ibka-balance', order: 10, label: 'DeepSeek 余额' },
					() => react.createElement(BalanceView, null),
				);
				return () => { registered = false; dispose(); };
			};
			slots.inject('conversation.composer.dock', registerOnce);
		};

		exports.apply = apply;
		return module.exports;
	}
});
