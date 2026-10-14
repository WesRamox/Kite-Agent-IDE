// Agente falso para os testes e2e: imprime, edita arquivos na worktree e espera comandos.
//   sair   -> termina com código 0
//   falhar -> termina com código 3
const fs = require('node:fs')

const name = process.env.KITE_AGENT_TASK ?? 'sem-nome'
const prompt = process.argv.slice(2).join(' ')
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

console.log(`agente falso iniciado: ${name}`)
console.log(`prompt: ${prompt}`)
fs.writeFileSync(`saida-${slug}.txt`, `${prompt}\n`)
fs.appendFileSync('README.md', `editado por ${name}\n`)
fs.writeFileSync('agent.pid', String(process.pid))
console.log('pronto, aguardando instrução')

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  if (!/[\r\n]/.test(buffer)) return
  const command = buffer.trim()
  buffer = ''
  if (command === 'sair') {
    console.log('tchau')
    process.exit(0)
  }
  if (command === 'falhar') process.exit(3)
  console.log(`recebido: ${command}`)
})
