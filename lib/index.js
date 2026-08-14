export default {
  inject: ['webServer', 'credentials'],
  apply(ctx) {
    const credentials = ctx.get('credentials')
    const subprocess = ctx.get('subprocess')
    const fs = ctx.get('fs')
    const webServer = ctx.get('webServer')

    async function resolveApiKey() {
      if (credentials === undefined) return null
      try {
        const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
        if (resolved && typeof resolved.value === 'string' && resolved.value.length > 0) {
          return resolved.value
        }
      } catch (err) {
        console.error('[ibka-balance] credential resolve failed', err)
      }
      return null
    }

    async function fetchBalance() {
      const key = await resolveApiKey()
      if (key === null) return { ok: false, error: '未找到 DEEPSEEK_API_KEY 凭据' }
      if (subprocess === undefined) return { ok: false, error: 'subprocess 服务不可用' }

      let cwd = '/'
      if (fs !== undefined) {
        try {
          const target = await fs.resolve('.')
          cwd = fs.processPath(target)
        } catch (err) { /* keep '/' */ }
      }

      let handle
      try {
        handle = subprocess.spawn({
          argv: ['curl', '-sS', '-m', '15', '-H', 'Authorization: Bearer ' + key, 'https://api.deepseek.com/user/balance'],
          cwd,
          stdio: { stdin: 'ignore', stdout: { maxBytes: 65536 }, stderr: { maxBytes: 4096 } },
          graceMs: 5000,
        })
      } catch (err) {
        return { ok: false, error: '启动 curl 失败: ' + String((err && err.message) || err) }
      }

      let outcome
      try {
        outcome = await handle.done
      } catch (err) {
        return { ok: false, error: 'curl 启动失败: ' + String((err && err.message) || err) }
      }

      const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0) : null
      const text = ((stdout && stdout.text) || '').trim()
      if (outcome.exitCode !== 0) {
        const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0) : null
        return { ok: false, error: 'curl 退出码 ' + String(outcome.exitCode), detail: ((stderr && stderr.text) || '').trim().slice(0, 300) }
      }

      let data
      try {
        data = JSON.parse(text)
      } catch (err) {
        return { ok: false, error: '响应不是有效 JSON', detail: text.slice(0, 200) }
      }
      if (!data || typeof data !== 'object') return { ok: false, error: '响应格式异常' }

      const infos = Array.isArray(data.balance_infos) ? data.balance_infos : []
      return {
        ok: true,
        available: data.is_available === true,
        currencies: infos.map((info) => ({
          currency: String((info && info.currency) || ''),
          total: Number((info && info.total_balance) || 0),
          granted: Number((info && info.granted_balance) || 0),
          toppedUp: Number((info && info.topped_up_balance) || 0),
        })),
        fetchedAt: Date.now(),
      }
    }

    async function appendReport(text) {
      if (fs === undefined) return
      try {
        const target = await fs.resolve('balance-card-report.txt')
        await fs.writeText(target, String(text) + '\n' + new Date().toISOString() + '\n')
      } catch (err) {
        console.error('[ibka-balance] report write failed', err)
      }
    }

    if (webServer !== undefined) {
      ctx.effect(() => webServer.register({
        kind: 'exact',
        path: '/api/ibka-balance',
        async handler(req, res) {
          try {
            const result = await fetchBalance()
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(result))
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ ok: false, error: String((err && err.message) || err) }))
          }
        },
      }))
      ctx.effect(() => webServer.register({
        kind: 'exact',
        path: '/api/ibka-balance/log',
        async handler(req, res) {
          let body = ''
          try {
            for await (const chunk of req) body += chunk
          } catch (err) { /* keep what we have */ }
          await appendReport(String(body || '').slice(0, 2000))
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end('{"ok":true}')
        },
      }))
    }
  },
}
